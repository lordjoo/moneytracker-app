import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { writeJson } from '@/utils/storage';
import { toDateKey } from '@/utils/dates';
import { usePreferencesStore } from './preferences';
import { useAccountsStore } from './accounts';
import { useCategoriesStore } from './categories';
import { useTransactionsStore } from './transactions';

function resetStorage() {
  writeJson('accounts', undefined);
  writeJson('transactions', undefined);
  writeJson('preferences', undefined);
  writeJson('categories', undefined);
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

  const categoriesStore = useCategoriesStore();
  categoriesStore.init();

  return { accountsStore, transactionsStore, categoriesStore };
}

describe('transactions store', () => {
  beforeEach(() => {
    resetStorage();
  });

  it('updates balance correctly for credit and debit transactions', () => {
    const { accountsStore, transactionsStore } = setupStores();
    const walletId = accountsStore.createAccount({ name: 'Wallet', currency: 'USD' });

    transactionsStore.addTransaction({
      type: 'credit',
      accountId: walletId,
      amount: 100,
      categoryId: 'salary',
      occurredAt: '2026-02-15'
    });
    transactionsStore.addTransaction({
      type: 'debit',
      accountId: walletId,
      amount: 25,
      categoryId: 'food-dining',
      occurredAt: '2026-02-15'
    });

    expect(transactionsStore.transactions).toHaveLength(2);
    expect(accountsStore.accountById(walletId).balance).toBe(75);
  });

  it('creates paired transfer transactions and updates both account balances', () => {
    const { accountsStore, transactionsStore } = setupStores();
    const sourceId = accountsStore.createAccount({ name: 'Checking', currency: 'USD' });
    const destinationId = accountsStore.createAccount({ name: 'Savings', currency: 'USD' });

    transactionsStore.addTransaction({
      type: 'transfer',
      accountId: sourceId,
      counterpartyAccountId: destinationId,
      amount: 40,
      occurredAt: '2026-02-15'
    });

    const outgoing = transactionsStore.transactions.find((tx) => tx.type === 'transfer' && tx.direction === 'outgoing');
    const incoming = transactionsStore.transactions.find((tx) => tx.type === 'transfer' && tx.direction === 'incoming');

    expect(outgoing).toBeTruthy();
    expect(incoming).toBeTruthy();
    expect(accountsStore.accountById(sourceId).balance).toBe(-40);
    expect(accountsStore.accountById(destinationId).balance).toBe(40);
  });

  it('deletes both sides of a transfer when deleting one transfer transaction', () => {
    const { accountsStore, transactionsStore } = setupStores();
    const sourceId = accountsStore.createAccount({ name: 'Checking', currency: 'USD' });
    const destinationId = accountsStore.createAccount({ name: 'Savings', currency: 'USD' });

    transactionsStore.addTransaction({
      type: 'transfer',
      accountId: sourceId,
      counterpartyAccountId: destinationId,
      amount: 30,
      occurredAt: '2026-02-15'
    });

    const incoming = transactionsStore.transactions.find(
      (tx) => tx.type === 'transfer' && tx.direction === 'incoming'
    );
    transactionsStore.deleteTransaction(incoming.id);

    expect(transactionsStore.transactions).toHaveLength(0);
    expect(accountsStore.accountById(sourceId).balance).toBe(0);
    expect(accountsStore.accountById(destinationId).balance).toBe(0);
  });

  it('rolls back state if updateTransaction fails mid-update', () => {
    const { accountsStore, transactionsStore } = setupStores();
    const walletId = accountsStore.createAccount({ name: 'Wallet', currency: 'USD' });

    transactionsStore.addTransaction({
      type: 'debit',
      accountId: walletId,
      amount: 20,
      categoryId: 'food-dining',
      occurredAt: '2026-02-15'
    });

    const original = transactionsStore.transactions.find((tx) => tx.type === 'debit');
    const addTransactionOriginal = transactionsStore.addTransaction;
    transactionsStore.addTransaction = () => {
      throw new Error('simulated failure');
    };

    expect(() =>
      transactionsStore.updateTransaction(original.id, {
        amount: 50,
        categoryId: 'food-dining'
      })
    ).toThrow('simulated failure');

    transactionsStore.addTransaction = addTransactionOriginal;

    expect(transactionsStore.transactions).toHaveLength(1);
    expect(transactionsStore.transactions[0].id).toBe(original.id);
    expect(accountsStore.accountById(walletId).balance).toBe(-20);
  });

  it('preserves source/destination direction when editing the incoming side of a transfer', () => {
    const { accountsStore, transactionsStore } = setupStores();
    const sourceId = accountsStore.createAccount({ name: 'Checking', currency: 'USD' });
    const destinationId = accountsStore.createAccount({ name: 'Savings', currency: 'USD' });

    transactionsStore.addTransaction({
      type: 'transfer',
      accountId: sourceId,
      counterpartyAccountId: destinationId,
      amount: 60,
      occurredAt: '2026-02-15'
    });

    const incoming = transactionsStore.transactions.find(
      (tx) => tx.type === 'transfer' && tx.direction === 'incoming'
    );

    transactionsStore.updateTransaction(incoming.id, {
      amount: 75,
      note: 'Adjusted amount'
    });

    const outgoingAfter = transactionsStore.transactions.find(
      (tx) => tx.type === 'transfer' && tx.direction === 'outgoing'
    );
    const incomingAfter = transactionsStore.transactions.find(
      (tx) => tx.type === 'transfer' && tx.direction === 'incoming'
    );

    expect(outgoingAfter.accountId).toBe(sourceId);
    expect(outgoingAfter.counterpartyAccountId).toBe(destinationId);
    expect(incomingAfter.accountId).toBe(destinationId);
    expect(incomingAfter.counterpartyAccountId).toBe(sourceId);
    expect(accountsStore.accountById(sourceId).balance).toBe(-75);
    expect(accountsStore.accountById(destinationId).balance).toBe(75);
  });

  it('stores transaction date as a local-safe date key', () => {
    const { accountsStore, transactionsStore } = setupStores();
    const walletId = accountsStore.createAccount({ name: 'Wallet', currency: 'USD' });

    transactionsStore.addTransaction({
      type: 'debit',
      accountId: walletId,
      amount: 10,
      categoryId: 'food-dining',
      occurredAt: '2026-02-15'
    });

    const tx = transactionsStore.transactions[0];
    expect(tx.occurredOn).toBe('2026-02-15');
    expect(toDateKey(tx.occurredAt)).toBe('2026-02-15');
  });

  it('defaults exclusion flag from category excludeByDefault setting', () => {
    const { accountsStore, transactionsStore, categoriesStore } = setupStores();
    const walletId = accountsStore.createAccount({ name: 'Wallet', currency: 'USD' });
    const categoryId = categoriesStore.upsertCategory({
      name: 'Pass-through',
      type: 'expense',
      icon: 'arrows-right-left',
      excludeByDefault: true
    });

    transactionsStore.addTransaction({
      type: 'debit',
      accountId: walletId,
      amount: 30,
      categoryId,
      occurredAt: '2026-02-15'
    });

    expect(transactionsStore.transactions[0].excludeFromInsights).toBe(true);
  });

  it('excludes flagged transactions from monthly summary while keeping balance impact', () => {
    const { accountsStore, transactionsStore } = setupStores();
    const walletId = accountsStore.createAccount({ name: 'Wallet', currency: 'USD' });

    transactionsStore.addTransaction({
      type: 'debit',
      accountId: walletId,
      amount: 20,
      categoryId: 'food-dining',
      occurredAt: '2026-02-15',
      excludeFromInsights: true
    });
    transactionsStore.addTransaction({
      type: 'debit',
      accountId: walletId,
      amount: 10,
      categoryId: 'food-dining',
      occurredAt: '2026-02-16'
    });

    const now = new Date();
    const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
    expect(transactionsStore.monthlySummary[monthKey].debit).toBe(10);
    expect(accountsStore.accountById(walletId).balance).toBe(-30);
  });
});
