import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { writeJson } from '@/utils/storage';
import { usePreferencesStore } from './preferences';
import { useAccountsStore } from './accounts';
import { useTransactionsStore } from './transactions';
import { useBudgetsStore } from './budgets';

function resetStorage() {
  writeJson('preferences', undefined);
  writeJson('accounts', undefined);
  writeJson('transactions', undefined);
  writeJson('categories', undefined);
  writeJson('budgets', undefined);
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

  const budgetsStore = useBudgetsStore();
  budgetsStore.init();

  return { accountsStore, transactionsStore, budgetsStore };
}

describe('budgets store', () => {
  beforeEach(() => {
    resetStorage();
  });

  it('applies monthly rollover from prior month balance', () => {
    const { accountsStore, transactionsStore, budgetsStore } = setupStores();
    const accountId = accountsStore.createAccount({ name: 'Wallet', currency: 'USD' });

    transactionsStore.addTransaction({
      type: 'debit',
      accountId,
      amount: 60,
      categoryId: 'food-dining',
      occurredAt: '2026-01-12'
    });
    transactionsStore.addTransaction({
      type: 'debit',
      accountId,
      amount: 50,
      categoryId: 'food-dining',
      occurredAt: '2026-02-03'
    });

    budgetsStore.upsertBudget({
      categoryId: 'food-dining',
      amount: 100,
      rolloverEnabled: true,
      alertThresholds: [80, 100, 120]
    });
    budgetsStore.budgets[0].createdAt = new Date('2026-01-01T12:00:00');

    const summary = budgetsStore.getMonthlySummary('2026-02')[0];

    expect(summary.available).toBe(140);
    expect(summary.spent).toBe(50);
    expect(summary.remaining).toBe(90);
    expect(summary.usagePercent).toBeCloseTo(35.714, 2);
  });

  it('flags breached threshold for heavy overspend', () => {
    const { accountsStore, transactionsStore, budgetsStore } = setupStores();
    const accountId = accountsStore.createAccount({ name: 'Wallet', currency: 'USD' });

    transactionsStore.addTransaction({
      type: 'debit',
      accountId,
      amount: 130,
      categoryId: 'food-dining',
      occurredAt: '2026-02-15'
    });

    budgetsStore.upsertBudget({
      categoryId: 'food-dining',
      amount: 100,
      rolloverEnabled: false,
      alertThresholds: [80, 100, 120]
    });

    const summary = budgetsStore.getMonthlySummary('2026-02')[0];

    expect(summary.breachedThreshold).toBe(120);
    expect(summary.remaining).toBe(-30);
  });

  it('ignores excluded transactions in budget consumption', () => {
    const { accountsStore, transactionsStore, budgetsStore } = setupStores();
    const accountId = accountsStore.createAccount({ name: 'Wallet', currency: 'USD' });

    transactionsStore.addTransaction({
      type: 'debit',
      accountId,
      amount: 80,
      categoryId: 'food-dining',
      occurredAt: '2026-02-12',
      excludeFromInsights: true
    });
    transactionsStore.addTransaction({
      type: 'debit',
      accountId,
      amount: 25,
      categoryId: 'food-dining',
      occurredAt: '2026-02-13'
    });

    budgetsStore.upsertBudget({
      categoryId: 'food-dining',
      amount: 100,
      rolloverEnabled: false,
      alertThresholds: [80, 100, 120]
    });

    const summary = budgetsStore.getMonthlySummary('2026-02')[0];
    expect(summary.spent).toBe(25);
    expect(summary.remaining).toBe(75);
  });
});
