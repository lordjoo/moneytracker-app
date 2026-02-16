import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { writeJson } from '@/utils/storage';
import { useAccountsStore } from './accounts';
import { useMonthClosuresStore } from './monthClosures';
import { usePreferencesStore } from './preferences';
import { useTransactionsStore } from './transactions';

function resetStorage() {
  writeJson('preferences', undefined);
  writeJson('accounts', undefined);
  writeJson('transactions', undefined);
  writeJson('categories', undefined);
  writeJson('month_closures', undefined);
  writeJson('household', undefined);
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

  const monthClosuresStore = useMonthClosuresStore();
  monthClosuresStore.init();

  return { accountsStore, transactionsStore, monthClosuresStore };
}

describe('month closures store', () => {
  beforeEach(() => {
    resetStorage();
  });

  it('closes a month with immutable snapshot and locks writes', () => {
    const { accountsStore, transactionsStore, monthClosuresStore } = setupStores();
    const accountId = accountsStore.createAccount({ name: 'Wallet', currency: 'USD' });

    transactionsStore.addTransaction({
      type: 'debit',
      accountId,
      amount: 55,
      categoryId: 'food-dining',
      occurredAt: '2026-02-10'
    });

    const closure = monthClosuresStore.closeMonth('2026-02');

    expect(closure.snapshot.summary.txCount).toBe(1);
    expect(monthClosuresStore.isMonthClosed('2026-02')).toBe(true);

    expect(() =>
      transactionsStore.addTransaction({
        type: 'debit',
        accountId,
        amount: 10,
        categoryId: 'food-dining',
        occurredAt: '2026-02-22'
      })
    ).toThrow('this month is closed');
  });

  it('requires explicit reopen reason and unlocks month after reopen', () => {
    const { accountsStore, transactionsStore, monthClosuresStore } = setupStores();
    const accountId = accountsStore.createAccount({ name: 'Wallet', currency: 'USD' });

    transactionsStore.addTransaction({
      type: 'debit',
      accountId,
      amount: 20,
      categoryId: 'food-dining',
      occurredAt: '2026-02-05'
    });

    monthClosuresStore.closeMonth('2026-02');
    monthClosuresStore.reopenMonth('2026-02', 'late statement correction');

    expect(monthClosuresStore.isMonthClosed('2026-02')).toBe(false);
    expect(monthClosuresStore.closureByMonth('2026-02').status).toBe('reopened');

    transactionsStore.addTransaction({
      type: 'debit',
      accountId,
      amount: 7,
      categoryId: 'food-dining',
      occurredAt: '2026-02-25'
    });

    expect(transactionsStore.transactions.filter((tx) => tx.occurredOn === '2026-02-25')).toHaveLength(1);
  });
});
