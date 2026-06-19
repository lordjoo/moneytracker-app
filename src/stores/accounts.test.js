import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { writeJson } from '@/utils/storage';
import { useAuthStore } from './auth';
import { useHouseholdStore } from './household';
import { useAccountsStore, describeCreditAccount } from './accounts';
import { useTransactionsStore } from './transactions';

function resetStorage() {
  writeJson('accounts', undefined);
  writeJson('transactions', undefined);
  writeJson('household', undefined);
}

function asUser(authStore, { uid, email, displayName }) {
  authStore.user = { uid, email, displayName };
}

describe('accounts household visibility', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetStorage();
  });

  it('hides private household accounts from other users', () => {
    const authStore = useAuthStore();
    asUser(authStore, {
      uid: 'owner-1',
      email: 'owner@example.com',
      displayName: 'Owner'
    });

    const householdStore = useHouseholdStore();
    householdStore.init();
    householdStore.createHousehold({ name: 'Home' });

    const accountsStore = useAccountsStore();
    accountsStore.init();
    const accountId = accountsStore.createAccount({
      name: 'Personal Wallet',
      excludeFromHousehold: true
    });

    expect(accountsStore.visibleAccountById(accountId)?.name).toBe('Personal Wallet');

    asUser(authStore, {
      uid: 'viewer-1',
      email: 'viewer@example.com',
      displayName: 'Viewer'
    });

    expect(accountsStore.visibleAccountById(accountId)).toBeNull();
    expect(accountsStore.visibleOpenAccounts).toHaveLength(0);
    expect(accountsStore.accountById(accountId)).not.toBeNull();
  });

  it('keeps shared accounts visible to other household users', () => {
    const authStore = useAuthStore();
    asUser(authStore, {
      uid: 'owner-1',
      email: 'owner@example.com',
      displayName: 'Owner'
    });

    const householdStore = useHouseholdStore();
    householdStore.init();
    householdStore.createHousehold({ name: 'Home' });

    const accountsStore = useAccountsStore();
    accountsStore.init();
    const accountId = accountsStore.createAccount({
      name: 'Family Checking',
      excludeFromHousehold: false
    });

    asUser(authStore, {
      uid: 'viewer-1',
      email: 'viewer@example.com',
      displayName: 'Viewer'
    });

    expect(accountsStore.visibleAccountById(accountId)?.name).toBe('Family Checking');
    expect(accountsStore.visibleOpenAccounts).toHaveLength(1);
  });

  it('shows private accounts when household mode is not active', () => {
    const authStore = useAuthStore();
    asUser(authStore, {
      uid: 'owner-1',
      email: 'owner@example.com',
      displayName: 'Owner'
    });

    const accountsStore = useAccountsStore();
    accountsStore.init();
    const accountId = accountsStore.createAccount({
      name: 'Solo Account',
      excludeFromHousehold: true
    });

    asUser(authStore, {
      uid: 'someone-else',
      email: 'someone@example.com',
      displayName: 'Someone'
    });

    expect(accountsStore.visibleAccountById(accountId)?.name).toBe('Solo Account');
  });
});

describe('credit accounts', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetStorage();
    const authStore = useAuthStore();
    asUser(authStore, { uid: 'owner-1', email: 'owner@example.com', displayName: 'Owner' });
  });

  it('stores opening debt as a negative balance and reports it as owed', () => {
    const accountsStore = useAccountsStore();
    accountsStore.init();
    const id = accountsStore.createAccount({
      name: 'Visa',
      type: 'credit',
      openingBalance: 500,
      creditLimit: 2000
    });

    const account = accountsStore.accountById(id);
    expect(account.type).toBe('credit');
    expect(account.balance).toBe(-500);

    const credit = describeCreditAccount(account);
    expect(credit.owed).toBe(500);
    expect(credit.limit).toBe(2000);
    expect(credit.available).toBe(1500);
    expect(credit.utilization).toBeCloseTo(0.25);
  });

  it('subtracts credit debt from net worth and tracks total debt', () => {
    const accountsStore = useAccountsStore();
    accountsStore.init();
    accountsStore.createAccount({ name: 'Checking', openingBalance: 1000 });
    accountsStore.createAccount({ name: 'Visa', type: 'credit', openingBalance: 300 });

    expect(accountsStore.totalWorth).toBe(700);
    expect(accountsStore.totalCashWorth).toBe(1000);
    expect(accountsStore.totalCreditDebt).toBe(300);
  });

  it('reduces what is owed when paid from a cash account via transfer', () => {
    const accountsStore = useAccountsStore();
    const transactionsStore = useTransactionsStore();
    accountsStore.init();
    transactionsStore.init();

    const checkingId = accountsStore.createAccount({ name: 'Checking', openingBalance: 1000 });
    const cardId = accountsStore.createAccount({ name: 'Visa', type: 'credit', openingBalance: 400 });

    transactionsStore.addTransaction({
      type: 'transfer',
      accountId: checkingId,
      counterpartyAccountId: cardId,
      amount: 250
    });

    expect(accountsStore.accountById(checkingId).balance).toBe(750);
    expect(describeCreditAccount(accountsStore.accountById(cardId)).owed).toBe(150);
  });
});
