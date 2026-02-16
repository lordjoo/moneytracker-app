import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { writeJson } from '@/utils/storage';
import { useAuthStore } from './auth';
import { useHouseholdStore } from './household';
import { useAccountsStore } from './accounts';

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
