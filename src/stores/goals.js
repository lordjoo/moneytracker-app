import { defineStore } from 'pinia';
import { generateId, parseDate, readJson, writeJson } from '@/utils/storage';
import { coerceDateKey, toDateKey } from '@/utils/dates';
import { notifyBackupDirty } from '@/utils/backupDirtySignal';
import { useTransactionsStore } from './transactions';
import { useAccountsStore } from './accounts';
import { useHouseholdStore } from './household';

const STORAGE_KEY = 'goals';

function ensureNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function serialiseContribution(item) {
  return {
    ...item,
    amount: ensureNumber(item.amount, 0),
    date: coerceDateKey(item.date, toDateKey(new Date())),
    createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : null
  };
}

function deserialiseContribution(item) {
  return {
    ...item,
    amount: ensureNumber(item.amount, 0),
    date: coerceDateKey(item.date, toDateKey(new Date())),
    createdAt: parseDate(item.createdAt)
  };
}

function serialiseGoal(goal) {
  return {
    ...goal,
    targetAmount: ensureNumber(goal.targetAmount, 0),
    targetDate: coerceDateKey(goal.targetDate, null),
    linkedAccountIds: Array.isArray(goal.linkedAccountIds) ? [...goal.linkedAccountIds] : [],
    contributionCategoryId: goal.contributionCategoryId || '',
    manualContributions: Array.isArray(goal.manualContributions)
      ? goal.manualContributions.map(serialiseContribution)
      : [],
    createdAt: goal.createdAt ? goal.createdAt.toISOString() : null,
    updatedAt: goal.updatedAt ? goal.updatedAt.toISOString() : null
  };
}

function deserialiseGoal(goal) {
  return {
    ...goal,
    targetAmount: ensureNumber(goal.targetAmount, 0),
    targetDate: coerceDateKey(goal.targetDate, null),
    linkedAccountIds: Array.isArray(goal.linkedAccountIds) ? [...goal.linkedAccountIds] : [],
    contributionCategoryId: goal.contributionCategoryId || '',
    manualContributions: Array.isArray(goal.manualContributions)
      ? goal.manualContributions.map(deserialiseContribution)
      : [],
    createdAt: parseDate(goal.createdAt),
    updatedAt: parseDate(goal.updatedAt)
  };
}

function sumManualContributions(goal) {
  return (goal.manualContributions ?? []).reduce((sum, item) => sum + ensureNumber(item.amount, 0), 0);
}

function sumTrackedContributions(goal, transactions) {
  const accountScope = new Set(goal.linkedAccountIds ?? []);
  const hasAccountScope = accountScope.size > 0;
  const categoryScope = goal.contributionCategoryId || '';
  let total = 0;

  for (const tx of transactions) {
    if (tx.type !== 'credit') continue;
    if (hasAccountScope && !accountScope.has(tx.accountId)) continue;
    if (categoryScope && tx.categoryId !== categoryScope) continue;
    total += ensureNumber(tx.amount, 0);
  }

  return total;
}

export const useGoalsStore = defineStore('goals', {
  state: () => ({
    goals: [],
    status: 'idle',
    initialized: false
  }),
  getters: {
    goalById: (state) => (id) => state.goals.find((goal) => goal.id === id) ?? null,
    sortedGoals: (state) =>
      [...state.goals].sort((a, b) => {
        const left = a.targetDate || '9999-12-31';
        const right = b.targetDate || '9999-12-31';
        if (left !== right) return left.localeCompare(right);
        return a.name.localeCompare(b.name);
      })
  },
  actions: {
    init() {
      if (this.initialized) return;
      this.status = 'loading';
      const records = readJson(STORAGE_KEY, []);
      this.goals = Array.isArray(records) ? records.map(deserialiseGoal) : [];
      this.status = 'ready';
      this.initialized = true;
    },
    persist() {
      writeJson(STORAGE_KEY, this.goals.map(serialiseGoal));
      notifyBackupDirty('goals');
    },
    upsertGoal({
      id,
      name,
      targetAmount,
      targetDate = null,
      linkedAccountIds = [],
      contributionCategoryId = ''
    }) {
      const householdStore = useHouseholdStore();
      if (!householdStore.initialized) {
        householdStore.init();
      }
      householdStore.ensureCanEditFinancialData('edit goals');
      const normalizedName = String(name ?? '').trim();
      if (!normalizedName) {
        throw new Error('Goal name is required');
      }
      const normalizedTarget = ensureNumber(targetAmount, NaN);
      if (!Number.isFinite(normalizedTarget) || normalizedTarget <= 0) {
        throw new Error('Target amount must be greater than zero');
      }

      const payload = {
        name: normalizedName,
        targetAmount: normalizedTarget,
        targetDate: coerceDateKey(targetDate, null),
        linkedAccountIds: Array.isArray(linkedAccountIds)
          ? linkedAccountIds.filter(Boolean)
          : [],
        contributionCategoryId: String(contributionCategoryId ?? '').trim()
      };
      const now = new Date();

      if (id) {
        const index = this.goals.findIndex((goal) => goal.id === id);
        if (index === -1) {
          throw new Error('Goal not found');
        }
        this.goals[index] = {
          ...this.goals[index],
          ...payload,
          updatedAt: now
        };
      } else {
        this.goals.push({
          id: generateId('goal'),
          ...payload,
          manualContributions: [],
          createdAt: now,
          updatedAt: now
        });
      }

      this.persist();
      householdStore.logEvent('goal.upserted', `Saved goal "${normalizedName}"`, {
        goalId: id ?? normalizedName
      });
    },
    removeGoal(id) {
      const householdStore = useHouseholdStore();
      if (!householdStore.initialized) {
        householdStore.init();
      }
      householdStore.ensureCanEditFinancialData('delete goals');
      this.goals = this.goals.filter((goal) => goal.id !== id);
      this.persist();
      householdStore.logEvent('goal.deleted', 'Deleted goal', {
        goalId: id
      });
    },
    addManualContribution(goalId, { amount, date = toDateKey(new Date()), note = '' }) {
      const householdStore = useHouseholdStore();
      if (!householdStore.initialized) {
        householdStore.init();
      }
      householdStore.ensureCanEditFinancialData('add goal contributions');
      const goal = this.goalById(goalId);
      if (!goal) {
        throw new Error('Goal not found');
      }
      const normalizedAmount = ensureNumber(amount, NaN);
      if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        throw new Error('Contribution amount must be greater than zero');
      }

      goal.manualContributions.push({
        id: generateId('goalcontrib'),
        amount: normalizedAmount,
        date: coerceDateKey(date, toDateKey(new Date())),
        note: String(note ?? '').trim(),
        createdAt: new Date()
      });
      goal.updatedAt = new Date();
      this.persist();
      householdStore.logEvent('goal.contribution.added', 'Added goal contribution', {
        goalId
      });
    },
    removeManualContribution(goalId, contributionId) {
      const householdStore = useHouseholdStore();
      if (!householdStore.initialized) {
        householdStore.init();
      }
      householdStore.ensureCanEditFinancialData('remove goal contributions');
      const goal = this.goalById(goalId);
      if (!goal) return;
      goal.manualContributions = goal.manualContributions.filter((item) => item.id !== contributionId);
      goal.updatedAt = new Date();
      this.persist();
      householdStore.logEvent('goal.contribution.removed', 'Removed goal contribution', {
        goalId,
        contributionId
      });
    },
    getGoalSummary(goalId) {
      const goal = this.goalById(goalId);
      if (!goal) return null;
      const transactionsStore = useTransactionsStore();
      const accountsStore = useAccountsStore();
      if (!transactionsStore.initialized) {
        transactionsStore.init();
      }
      if (!accountsStore.initialized) {
        accountsStore.init();
      }

      const manual = sumManualContributions(goal);
      const visibleTransactions = transactionsStore.transactions.filter((tx) =>
        accountsStore.isAccountVisible(tx.accountId)
      );
      const tracked = sumTrackedContributions(goal, visibleTransactions);
      const total = manual + tracked;
      const target = ensureNumber(goal.targetAmount, 0);
      const remaining = Math.max(target - total, 0);
      const progressPercent = target > 0 ? Math.min((total / target) * 100, 100) : 0;

      return {
        id: goal.id,
        name: goal.name,
        targetAmount: target,
        targetDate: goal.targetDate,
        linkedAccountIds: goal.linkedAccountIds,
        contributionCategoryId: goal.contributionCategoryId,
        manual,
        tracked,
        total,
        remaining,
        progressPercent
      };
    },
    getAllGoalSummaries() {
      return this.sortedGoals
        .map((goal) => this.getGoalSummary(goal.id))
        .filter(Boolean);
    },
    replaceAll(records) {
      this.goals = Array.isArray(records) ? records.map(deserialiseGoal) : [];
      this.status = 'ready';
      this.initialized = true;
      this.persist();
    },
    clear() {
      this.goals = [];
      this.status = 'idle';
      this.initialized = false;
      this.persist();
    }
  }
});
