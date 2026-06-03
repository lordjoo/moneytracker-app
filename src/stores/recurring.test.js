import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { writeJson } from '@/utils/storage';
import { usePreferencesStore } from './preferences';
import { useAccountsStore } from './accounts';
import { useTransactionsStore } from './transactions';
import { useRecurringStore } from './recurring';

function resetStorage() {
  writeJson('preferences', undefined);
  writeJson('accounts', undefined);
  writeJson('transactions', undefined);
  writeJson('categories', undefined);
  writeJson('recurring', undefined);
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

  const recurringStore = useRecurringStore();
  recurringStore.init();

  return { accountsStore, transactionsStore, recurringStore };
}

describe('recurring store', () => {
  beforeEach(() => {
    resetStorage();
  });

  it('creates due instances and advances next run date', () => {
    const { accountsStore, recurringStore } = setupStores();
    const accountId = accountsStore.createAccount({ name: 'Checking', currency: 'USD' });

    recurringStore.upsertRule({
      name: 'Gym Membership',
      type: 'debit',
      accountId,
      categoryId: 'healthcare',
      amount: 25,
      frequency: 'monthly',
      dayOfMonth: 10,
      nextRunOn: '2099-02-10'
    });

    recurringStore.syncDueItems('2099-02-15');

    expect(recurringStore.dueCount).toBe(1);
    expect(recurringStore.dueInstances[0].dueOn).toBe('2099-02-10');
    expect(recurringStore.rules[0].nextRunOn).toBe('2099-03-10');
  });

  it('posts a due transfer instance and updates both balances', async () => {
    const { accountsStore, transactionsStore, recurringStore } = setupStores();
    const checkingId = accountsStore.createAccount({ name: 'Checking', currency: 'USD' });
    const savingsId = accountsStore.createAccount({ name: 'Savings', currency: 'USD' });

    recurringStore.upsertRule({
      name: 'Auto Save',
      type: 'transfer',
      accountId: checkingId,
      counterpartyAccountId: savingsId,
      amount: 40,
      frequency: 'weekly',
      nextRunOn: '2099-02-15'
    });

    recurringStore.syncDueItems('2099-02-15');
    const instanceId = recurringStore.dueInstances[0].id;

    await recurringStore.postInstance(instanceId);

    expect(recurringStore.dueCount).toBe(0);
    expect(transactionsStore.transactions).toHaveLength(2);
    expect(accountsStore.accountById(checkingId).balance).toBe(-40);
    expect(accountsStore.accountById(savingsId).balance).toBe(40);
  });
});
