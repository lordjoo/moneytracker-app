import { defineStore } from 'pinia';
import { generateId, parseDate, readJson, writeJson } from '@/utils/storage';
import { coerceDateKey, isMonthKey, toDateKey, toMonthKey } from '@/utils/dates';
import { notifyBackupDirty } from '@/utils/backupDirtySignal';
import { useAccountsStore } from '@/stores/accounts';
import { useCategoriesStore } from '@/stores/categories';
import { useTransactionsStore } from '@/stores/transactions';
import { useHouseholdStore } from '@/stores/household';

const STORAGE_KEY = 'month_closures';

function ensureNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function serialiseClosure(entry) {
  return {
    ...entry,
    closedAt: toIso(entry.closedAt),
    reopenedAt: toIso(entry.reopenedAt),
    updatedAt: toIso(entry.updatedAt)
  };
}

function deserialiseClosure(entry) {
  return {
    ...entry,
    closedAt: parseDate(entry.closedAt),
    reopenedAt: parseDate(entry.reopenedAt),
    updatedAt: parseDate(entry.updatedAt)
  };
}

function resolveTxDateKey(transaction) {
  return coerceDateKey(
    transaction?.occurredOn ?? transaction?.occurredAt ?? transaction?.createdAt,
    toDateKey(new Date())
  );
}

function isExpenseTransaction(transaction) {
  return transaction.type === 'debit' || (transaction.type === 'transfer' && transaction.direction === 'outgoing');
}

function isIncomeTransaction(transaction) {
  return transaction.type === 'credit' || (transaction.type === 'transfer' && transaction.direction === 'incoming');
}

function monthEndDateKey(monthKey) {
  if (!isMonthKey(monthKey)) return null;
  const [yearText, monthText] = monthKey.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const lastDay = new Date(year, month, 0).getDate();
  return `${monthKey}-${String(lastDay).padStart(2, '0')}`;
}

export const useMonthClosuresStore = defineStore('monthClosures', {
  state: () => ({
    closures: [],
    status: 'idle',
    initialized: false
  }),
  getters: {
    sortedClosures: (state) =>
      [...state.closures].sort((a, b) => (b.monthKey || '').localeCompare(a.monthKey || '')),
    closureByMonth: (state) => (monthKey) =>
      state.closures.find((entry) => entry.monthKey === monthKey) ?? null,
    closedMonthKeys: (state) =>
      new Set(
        state.closures
          .filter((entry) => entry.status === 'closed')
          .map((entry) => entry.monthKey)
      ),
    isMonthClosed() {
      return (monthKey) => this.closedMonthKeys.has(monthKey);
    }
  },
  actions: {
    init() {
      if (this.initialized) return;
      this.status = 'loading';
      const records = readJson(STORAGE_KEY, []);
      this.closures = Array.isArray(records) ? records.map(deserialiseClosure) : [];
      this.status = 'ready';
      this.initialized = true;
    },
    persist() {
      writeJson(STORAGE_KEY, this.closures.map(serialiseClosure));
      notifyBackupDirty('month-closures');
    },
    assertMonthOpen(dateLike, actionLabel = 'modify transactions') {
      const monthKey = toMonthKey(dateLike);
      if (!monthKey) return;
      if (this.isMonthClosed(monthKey)) {
        throw new Error(`Cannot ${actionLabel} for ${monthKey}: this month is closed.`);
      }
    },
    buildSnapshot(monthKey) {
      if (!isMonthKey(monthKey)) {
        throw new Error('Invalid month key');
      }

      const accountsStore = useAccountsStore();
      const categoriesStore = useCategoriesStore();
      const transactionsStore = useTransactionsStore();

      if (!accountsStore.initialized) accountsStore.init();
      if (!categoriesStore.initialized) categoriesStore.init();
      if (!transactionsStore.initialized) transactionsStore.init();

      const monthTransactions = transactionsStore.transactions.filter((transaction) =>
        accountsStore.isAccountVisible(transaction.accountId) &&
        resolveTxDateKey(transaction).startsWith(monthKey)
      );

      const categoryTotals = new Map();
      const accountMonthTotals = new Map();
      let inflow = 0;
      let outflow = 0;

      for (const transaction of monthTransactions) {
        const amount = ensureNumber(transaction.amount, 0);
        const categoryId = transaction.categoryId || 'uncategorized';
        const category = categoriesStore.byId(categoryId);
        const existingCategory = categoryTotals.get(categoryId) ?? {
          categoryId,
          categoryName: category?.name ?? 'Uncategorized',
          income: 0,
          expense: 0,
          transfer: 0
        };

        if (transaction.type === 'transfer') {
          existingCategory.transfer += amount;
        } else if (isIncomeTransaction(transaction)) {
          existingCategory.income += amount;
        } else if (isExpenseTransaction(transaction)) {
          existingCategory.expense += amount;
        }
        categoryTotals.set(categoryId, existingCategory);

        const account = accountsStore.accountById(transaction.accountId);
        const existingAccount = accountMonthTotals.get(transaction.accountId) ?? {
          accountId: transaction.accountId,
          accountName: account?.name ?? 'Unknown account',
          currency: account?.currency ?? 'USD',
          inflow: 0,
          outflow: 0,
          net: 0,
          closingBalance: 0
        };

        if (isIncomeTransaction(transaction)) {
          existingAccount.inflow += amount;
          inflow += amount;
        }
        if (isExpenseTransaction(transaction)) {
          existingAccount.outflow += amount;
          outflow += amount;
        }
        existingAccount.net = existingAccount.inflow - existingAccount.outflow;
        accountMonthTotals.set(transaction.accountId, existingAccount);
      }

      const endDateKey = monthEndDateKey(monthKey);
      const allThroughMonth = transactionsStore.transactions.filter(
        (transaction) =>
          accountsStore.isAccountVisible(transaction.accountId) &&
          resolveTxDateKey(transaction) <= endDateKey
      );
      const runningBalances = new Map();
      for (const transaction of allThroughMonth) {
        const current = runningBalances.get(transaction.accountId) ?? 0;
        const amount = ensureNumber(transaction.amount, 0);
        let next = current;
        if (isIncomeTransaction(transaction)) next += amount;
        if (isExpenseTransaction(transaction)) next -= amount;
        runningBalances.set(transaction.accountId, next);
      }

      const accountTotals = Array.from(accountMonthTotals.values())
        .map((entry) => ({
          ...entry,
          closingBalance: runningBalances.get(entry.accountId) ?? 0
        }))
        .sort((a, b) => a.accountName.localeCompare(b.accountName));

      return {
        monthKey,
        summary: {
          txCount: monthTransactions.length,
          inflow,
          outflow,
          net: inflow - outflow
        },
        accounts: accountTotals,
        categories: Array.from(categoryTotals.values()).sort((a, b) => a.categoryName.localeCompare(b.categoryName)),
        createdAt: new Date().toISOString()
      };
    },
    closeMonth(monthKey = toMonthKey(new Date())) {
      const normalizedMonthKey = isMonthKey(monthKey) ? monthKey : toMonthKey(`${monthKey}-01`);
      if (!isMonthKey(normalizedMonthKey)) {
        throw new Error('Please provide a valid month');
      }
      const householdStore = useHouseholdStore();
      if (!householdStore.initialized) householdStore.init();
      householdStore.ensureCanEditFinancialData('close a month');

      if (this.isMonthClosed(normalizedMonthKey)) {
        throw new Error(`${normalizedMonthKey} is already closed`);
      }

      const snapshot = this.buildSnapshot(normalizedMonthKey);
      const actor = householdStore.actor();
      const closure = {
        id: generateId('monthclose'),
        monthKey: normalizedMonthKey,
        status: 'closed',
        closedAt: new Date(),
        updatedAt: new Date(),
        closedBy: {
          uid: actor.uid,
          email: actor.email,
          displayName: actor.displayName
        },
        reopenedAt: null,
        reopenedBy: null,
        reopenReason: '',
        snapshot
      };
      this.closures.push(closure);
      this.persist();
      householdStore.logEvent('month.closed', `Closed month ${normalizedMonthKey}`, {
        monthKey: normalizedMonthKey,
        txCount: snapshot.summary.txCount
      });
      return closure;
    },
    reopenMonth(monthKey, reason = '') {
      const normalizedMonthKey = isMonthKey(monthKey) ? monthKey : toMonthKey(`${monthKey}-01`);
      if (!isMonthKey(normalizedMonthKey)) {
        throw new Error('Please provide a valid month');
      }

      const householdStore = useHouseholdStore();
      if (!householdStore.initialized) householdStore.init();
      householdStore.ensureCanReopenMonths('reopen a closed month');

      const closure = this.closureByMonth(normalizedMonthKey);
      if (!closure || closure.status !== 'closed') {
        throw new Error(`${normalizedMonthKey} is not currently closed`);
      }

      const actor = householdStore.actor();
      closure.status = 'reopened';
      closure.reopenedAt = new Date();
      closure.reopenedBy = {
        uid: actor.uid,
        email: actor.email,
        displayName: actor.displayName
      };
      closure.updatedAt = new Date();
      closure.reopenReason = String(reason ?? '').trim();
      this.persist();
      householdStore.logEvent('month.reopened', `Reopened month ${normalizedMonthKey}`, {
        monthKey: normalizedMonthKey,
        reason: closure.reopenReason
      });
    },
    replaceAll(records) {
      this.closures = Array.isArray(records) ? records.map(deserialiseClosure) : [];
      this.status = 'ready';
      this.initialized = true;
      this.persist();
    },
    clear() {
      this.closures = [];
      this.status = 'idle';
      this.initialized = false;
      this.persist();
    }
  }
});
