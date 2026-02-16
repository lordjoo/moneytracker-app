import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { writeJson } from '@/utils/storage';
import { usePreferencesStore } from './preferences';
import { useAccountsStore } from './accounts';
import { useTransactionsStore } from './transactions';
import { useGoalsStore } from './goals';

function resetStorage() {
  writeJson('preferences', undefined);
  writeJson('accounts', undefined);
  writeJson('transactions', undefined);
  writeJson('categories', undefined);
  writeJson('goals', undefined);
  writeJson('household', undefined);
  writeJson('month_closures', undefined);
}

function setupStores() {
  setActivePinia(createPinia());
  resetStorage();

  const preferencesStore = usePreferencesStore();
  preferencesStore.init();
  preferencesStore.setMainCurrency('USD');

  const accountsStore = useAccountsStore();
  accountsStore.init();

  const transactionsStore = useTransactionsStore();
  transactionsStore.init();

  const goalsStore = useGoalsStore();
  goalsStore.init();

  return { accountsStore, transactionsStore, goalsStore };
}

describe('goals store', () => {
  beforeEach(() => {
    resetStorage();
  });

  it('combines tracked and manual contributions in goal summary', () => {
    const { accountsStore, transactionsStore, goalsStore } = setupStores();
    const salaryAccountId = accountsStore.createAccount({ name: 'Salary', currency: 'USD' });

    transactionsStore.addTransaction({
      type: 'credit',
      accountId: salaryAccountId,
      amount: 100,
      categoryId: 'salary',
      occurredAt: '2026-02-01'
    });
    transactionsStore.addTransaction({
      type: 'credit',
      accountId: salaryAccountId,
      amount: 40,
      categoryId: 'savings',
      occurredAt: '2026-02-02'
    });

    goalsStore.upsertGoal({
      name: 'Emergency Fund',
      targetAmount: 200,
      linkedAccountIds: [salaryAccountId],
      contributionCategoryId: 'salary'
    });

    const goalId = goalsStore.goals[0].id;
    goalsStore.addManualContribution(goalId, {
      amount: 50,
      date: '2026-02-10'
    });

    const summary = goalsStore.getGoalSummary(goalId);

    expect(summary.tracked).toBe(100);
    expect(summary.manual).toBe(50);
    expect(summary.total).toBe(150);
    expect(summary.remaining).toBe(50);
    expect(summary.progressPercent).toBe(75);
  });
});
