import { defineStore } from 'pinia';
import { generateId, parseDate, readJson, writeJson } from '@/utils/storage';
import { shiftMonthKey, toMonthKey } from '@/utils/dates';
import { notifyBackupDirty } from '@/utils/backupDirtySignal';
import { useTransactionsStore } from './transactions';
import { useAccountsStore } from './accounts';
import { useHouseholdStore } from './household';

const STORAGE_KEY = 'budgets';
const DEFAULT_THRESHOLDS = [80, 100, 120];

function ensureNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normaliseThresholds(value) {
  const source = Array.isArray(value) ? value : DEFAULT_THRESHOLDS;
  const unique = new Set();
  for (const raw of source) {
    const threshold = ensureNumber(raw, NaN);
    if (!Number.isFinite(threshold) || threshold <= 0) continue;
    unique.add(Math.round(threshold));
  }
  const list = [...unique].sort((a, b) => a - b);
  return list.length ? list : [...DEFAULT_THRESHOLDS];
}

function deserialiseBudget(record) {
  return {
    ...record,
    amount: ensureNumber(record.amount, 0),
    rolloverEnabled: Boolean(record.rolloverEnabled),
    alertThresholds: normaliseThresholds(record.alertThresholds),
    createdAt: parseDate(record.createdAt),
    updatedAt: parseDate(record.updatedAt)
  };
}

function serialiseBudget(record) {
  return {
    ...record,
    amount: ensureNumber(record.amount, 0),
    rolloverEnabled: Boolean(record.rolloverEnabled),
    alertThresholds: normaliseThresholds(record.alertThresholds),
    createdAt: record.createdAt ? record.createdAt.toISOString() : null,
    updatedAt: record.updatedAt ? record.updatedAt.toISOString() : null
  };
}

function compareMonthKey(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function resolveTransactionMonth(transaction) {
  if (transaction?.occurredOn && /^\d{4}-\d{2}-\d{2}$/.test(transaction.occurredOn)) {
    return transaction.occurredOn.slice(0, 7);
  }
  const raw = transaction?.occurredAt ?? transaction?.createdAt;
  return toMonthKey(raw);
}

function calculateBudgetAvailable(budget, monthKey, spentByCategoryMonth, cache, depth = 0) {
  const cacheKey = `${budget.id}:${monthKey}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const baseAmount = ensureNumber(budget.amount, 0);
  if (!budget.rolloverEnabled || depth > 240) {
    cache.set(cacheKey, baseAmount);
    return baseAmount;
  }

  const createdMonth = toMonthKey(budget.createdAt) ?? monthKey;
  if (compareMonthKey(monthKey, createdMonth) <= 0) {
    cache.set(cacheKey, baseAmount);
    return baseAmount;
  }

  const previousMonth = shiftMonthKey(monthKey, -1);
  if (!previousMonth) {
    cache.set(cacheKey, baseAmount);
    return baseAmount;
  }

  const previousAvailable = calculateBudgetAvailable(
    budget,
    previousMonth,
    spentByCategoryMonth,
    cache,
    depth + 1
  );
  const previousSpent = spentByCategoryMonth.get(`${budget.categoryId}:${previousMonth}`) ?? 0;
  const carryover = Math.max(previousAvailable - previousSpent, 0);
  const available = baseAmount + carryover;
  cache.set(cacheKey, available);
  return available;
}

export const useBudgetsStore = defineStore('budgets', {
  state: () => ({
    budgets: [],
    status: 'idle',
    initialized: false
  }),
  getters: {
    budgetById: (state) => (id) => state.budgets.find((budget) => budget.id === id) ?? null,
    sortedBudgets: (state) => [...state.budgets].sort((a, b) => a.categoryId.localeCompare(b.categoryId))
  },
  actions: {
    init() {
      if (this.initialized) return;
      this.status = 'loading';
      const records = readJson(STORAGE_KEY, []);
      this.budgets = Array.isArray(records) ? records.map(deserialiseBudget) : [];
      this.status = 'ready';
      this.initialized = true;
    },
    persist() {
      writeJson(STORAGE_KEY, this.budgets.map(serialiseBudget));
      notifyBackupDirty('budgets');
    },
    upsertBudget({
      id,
      categoryId,
      amount,
      rolloverEnabled = false,
      alertThresholds = DEFAULT_THRESHOLDS
    }) {
      const householdStore = useHouseholdStore();
      if (!householdStore.initialized) {
        householdStore.init();
      }
      householdStore.ensureCanEditFinancialData('edit budgets');
      const normalizedCategoryId = String(categoryId ?? '').trim();
      if (!normalizedCategoryId) {
        throw new Error('Category is required');
      }
      const normalizedAmount = ensureNumber(amount, NaN);
      if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        throw new Error('Budget amount must be greater than zero');
      }

      const now = new Date();
      const payload = {
        categoryId: normalizedCategoryId,
        amount: normalizedAmount,
        rolloverEnabled: Boolean(rolloverEnabled),
        alertThresholds: normaliseThresholds(alertThresholds)
      };

      if (id) {
        const index = this.budgets.findIndex((item) => item.id === id);
        if (index === -1) {
          throw new Error('Budget not found');
        }
        this.budgets[index] = {
          ...this.budgets[index],
          ...payload,
          updatedAt: now
        };
      } else {
        const existingIndex = this.budgets.findIndex((item) => item.categoryId === normalizedCategoryId);
        if (existingIndex !== -1) {
          this.budgets[existingIndex] = {
            ...this.budgets[existingIndex],
            ...payload,
            updatedAt: now
          };
        } else {
          this.budgets.push({
            id: generateId('budget'),
            ...payload,
            createdAt: now,
            updatedAt: now
          });
        }
      }

      this.persist();
      householdStore.logEvent('budget.upserted', 'Saved budget rule', {
        budgetId: id ?? normalizedCategoryId,
        categoryId: normalizedCategoryId
      });
    },
    removeBudget(id) {
      const householdStore = useHouseholdStore();
      if (!householdStore.initialized) {
        householdStore.init();
      }
      householdStore.ensureCanEditFinancialData('delete budgets');
      this.budgets = this.budgets.filter((budget) => budget.id !== id);
      this.persist();
      householdStore.logEvent('budget.deleted', 'Deleted budget rule', {
        budgetId: id
      });
    },
    getMonthlySummary(monthKey = toMonthKey(new Date())) {
      const transactionsStore = useTransactionsStore();
      const accountsStore = useAccountsStore();
      if (!transactionsStore.initialized) {
        transactionsStore.init();
      }
      if (!accountsStore.initialized) {
        accountsStore.init();
      }

      const spentByCategoryMonth = new Map();
      for (const transaction of transactionsStore.transactions) {
        if (transaction.type !== 'debit') continue;
        if (transaction.excludeFromInsights) continue;
        if (!accountsStore.isAccountVisible(transaction.accountId)) continue;
        if (!transaction.categoryId) continue;
        const txMonth = resolveTransactionMonth(transaction);
        if (!txMonth) continue;
        const key = `${transaction.categoryId}:${txMonth}`;
        const next = (spentByCategoryMonth.get(key) ?? 0) + ensureNumber(transaction.amount, 0);
        spentByCategoryMonth.set(key, next);
      }

      const availableCache = new Map();
      const summaries = this.sortedBudgets.map((budget) => {
        const available = calculateBudgetAvailable(
          budget,
          monthKey,
          spentByCategoryMonth,
          availableCache
        );
        const spent = spentByCategoryMonth.get(`${budget.categoryId}:${monthKey}`) ?? 0;
        const remaining = available - spent;
        const usagePercent = available > 0 ? (spent / available) * 100 : (spent > 0 ? 100 : 0);
        const breachedThreshold = budget.alertThresholds
          .filter((threshold) => usagePercent >= threshold)
          .pop() ?? null;

        return {
          id: budget.id,
          categoryId: budget.categoryId,
          budgetAmount: budget.amount,
          available,
          spent,
          remaining,
          rolloverEnabled: budget.rolloverEnabled,
          usagePercent,
          breachedThreshold,
          thresholds: budget.alertThresholds
        };
      });

      return summaries.sort((a, b) => b.usagePercent - a.usagePercent);
    },
    replaceAll(records) {
      this.budgets = Array.isArray(records) ? records.map(deserialiseBudget) : [];
      this.status = 'ready';
      this.initialized = true;
      this.persist();
    },
    clear() {
      this.budgets = [];
      this.status = 'idle';
      this.initialized = false;
      this.persist();
    }
  }
});
