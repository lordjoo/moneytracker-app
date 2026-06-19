import { defineStore } from 'pinia';
import { generateId, parseDate, readJson, writeJson } from '@/utils/storage';
import { notifyBackupDirty } from '@/utils/backupDirtySignal';
import { useTransactionsStore } from './transactions';
import { usePreferencesStore } from './preferences';
import { useHouseholdStore } from './household';

const STORAGE_KEY = 'accounts';
const FALLBACK_CURRENCY = 'USD';
const ACCOUNT_TYPES = ['cash', 'credit'];

function normaliseAccountType(value) {
  return ACCOUNT_TYPES.includes(value) ? value : 'cash';
}

function normaliseCreditLimit(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function deserialiseAccount(record, defaultCurrency = FALLBACK_CURRENCY) {
  const type = normaliseAccountType(record.type);
  return {
    ...record,
    type,
    creditLimit: type === 'credit' ? normaliseCreditLimit(record.creditLimit) : null,
    excludeFromHousehold: Boolean(record.excludeFromHousehold),
    ownerUid: String(record.ownerUid ?? ''),
    createdAt: parseDate(record.createdAt),
    updatedAt: parseDate(record.updatedAt),
    closedAt: parseDate(record.closedAt),
    currency: record.currency || defaultCurrency
  };
}

function serialiseAccount(account) {
  const type = normaliseAccountType(account.type);
  return {
    ...account,
    type,
    creditLimit: type === 'credit' ? normaliseCreditLimit(account.creditLimit) : null,
    excludeFromHousehold: Boolean(account.excludeFromHousehold),
    ownerUid: String(account.ownerUid ?? ''),
    createdAt: account.createdAt ? account.createdAt.toISOString() : null,
    updatedAt: account.updatedAt ? account.updatedAt.toISOString() : null,
    closedAt: account.closedAt ? account.closedAt.toISOString() : null,
    currency: account.currency || FALLBACK_CURRENCY
  };
}

function ensureNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Credit accounts store debt as a negative balance (a liability), so the
 * existing debit/transfer engine and net-worth math work unchanged: spending
 * (debit) makes the balance more negative, paying it (transfer in) brings it
 * back toward zero. This helper derives the friendly numbers for the UI.
 */
export function describeCreditAccount(account) {
  const balance = ensureNumber(account?.balance);
  const owed = Math.max(0, -balance);
  const overpaid = Math.max(0, balance); // they paid more than owed → statement credit
  const limit = normaliseCreditLimit(account?.creditLimit);
  const available = limit != null ? Math.max(0, limit - owed) : null;
  const utilization = limit != null && limit > 0 ? Math.min(1, owed / limit) : null;
  return { owed, overpaid, limit, available, utilization };
}

export const useAccountsStore = defineStore('accounts', {
  state: () => ({
    accounts: [],
    status: 'idle',
    activeAccountId: null,
    initialized: false
  }),
  getters: {
    visibleAccounts: (state) => {
      const householdStore = useHouseholdStore();
      const hasHousehold = Boolean(householdStore.household);
      const currentActor = householdStore.actor();
      return state.accounts.filter((account) => {
        if (!hasHousehold || !account.excludeFromHousehold) return true;
        if (!account.ownerUid) return true;
        return account.ownerUid === currentActor.uid;
      });
    },
    visibleSortedAccounts() {
      return [...this.visibleAccounts].sort((a, b) => {
        const closedDiff = Number(a.isClosed ?? false) - Number(b.isClosed ?? false);
        if (closedDiff !== 0) return closedDiff;
        return a.name.localeCompare(b.name);
      });
    },
    visibleOpenAccounts() {
      return this.visibleAccounts
        .filter((account) => !account.isClosed)
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    visibleClosedAccounts() {
      return this.visibleAccounts
        .filter((account) => account.isClosed)
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    sortedAccounts: (state) =>
      [...state.accounts].sort((a, b) => {
        const closedDiff = Number(a.isClosed ?? false) - Number(b.isClosed ?? false);
        if (closedDiff !== 0) return closedDiff;
        return a.name.localeCompare(b.name);
      }),
    openAccounts: (state) =>
      state.accounts
        .filter((account) => !account.isClosed)
        .sort((a, b) => a.name.localeCompare(b.name)),
    closedAccounts: (state) =>
      state.accounts
        .filter((account) => account.isClosed)
        .sort((a, b) => a.name.localeCompare(b.name)),
    totalWorth: (state) => state.accounts.reduce((sum, account) => sum + ensureNumber(account.balance), 0),
    visibleCashAccounts() {
      return this.visibleOpenAccounts.filter((account) => normaliseAccountType(account.type) !== 'credit');
    },
    visibleCreditAccounts() {
      return this.visibleOpenAccounts.filter((account) => normaliseAccountType(account.type) === 'credit');
    },
    // Sum of positive holdings (in their own currency — converted totals live in the currency store).
    totalCashWorth() {
      return this.visibleAccounts
        .filter((account) => normaliseAccountType(account.type) !== 'credit')
        .reduce((sum, account) => sum + ensureNumber(account.balance), 0);
    },
    // Total amount owed across credit accounts (positive number).
    totalCreditDebt() {
      return this.visibleAccounts
        .filter((account) => normaliseAccountType(account.type) === 'credit')
        .reduce((sum, account) => sum + Math.max(0, -ensureNumber(account.balance)), 0);
    },
    accountById: (state) => (id) => state.accounts.find((account) => account.id === id) ?? null,
    visibleAccountById() {
      return (id) => this.visibleAccounts.find((account) => account.id === id) ?? null;
    },
    isAccountVisible() {
      return (id) => Boolean(this.visibleAccountById(id));
    }
  },
  actions: {
    init() {
      if (this.initialized) return;
      this.status = 'loading';
      const preferencesStore = usePreferencesStore();
      if (!preferencesStore.initialized) {
        preferencesStore.init();
      }
      const baseCurrency = preferencesStore.baseCurrency || FALLBACK_CURRENCY;
      const records = readJson(STORAGE_KEY, []);
      this.accounts = Array.isArray(records)
        ? records.map((entry) => deserialiseAccount(entry, baseCurrency))
        : [];
      this.activeAccountId = this.determineActiveAccountId();
      this.status = 'ready';
      this.initialized = true;
    },
    determineActiveAccountId() {
      if (this.activeAccountId && this.visibleAccountById(this.activeAccountId)) {
        return this.activeAccountId;
      }
      const firstOpen = this.visibleOpenAccounts[0];
      if (firstOpen) return firstOpen.id;
      return this.visibleAccounts[0]?.id ?? null;
    },
    persist() {
      writeJson(STORAGE_KEY, this.accounts.map(serialiseAccount));
      notifyBackupDirty('accounts');
    },
    setActiveAccount(id) {
      this.activeAccountId = id;
      this.persist();
    },
    createAccount({
      name,
      openingBalance = 0,
      cycleDay = null,
      currency,
      excludeFromHousehold = false,
      type = 'cash',
      creditLimit = null
    } = {}) {
      const householdStore = useHouseholdStore();
      if (!householdStore.initialized) {
        householdStore.init();
      }
      householdStore.ensureCanEditFinancialData('create accounts');
      const trimmed = String(name ?? '').trim();
      if (!trimmed) {
        throw new Error('Account name is required');
      }
      const accountType = normaliseAccountType(type);
      // For a cash account the opening figure is money you hold; for a credit
      // account it is the balance you currently owe (recorded as debt).
      const amount = ensureNumber(openingBalance, 0);
      const now = new Date();
      const id = generateId('acct');
      const preferencesStore = usePreferencesStore();
      if (!preferencesStore.initialized) {
        preferencesStore.init();
      }
      const selectedCurrency = currency || preferencesStore.baseCurrency || FALLBACK_CURRENCY;
      const account = {
        id,
        name: trimmed,
        type: accountType,
        creditLimit: accountType === 'credit' ? normaliseCreditLimit(creditLimit) : null,
        balance: 0,
        cycleDay: cycleDay ? Number(cycleDay) : null,
        isClosed: false,
        excludeFromHousehold: Boolean(excludeFromHousehold),
        ownerUid: householdStore.actor().uid,
        closedAt: null,
        currency: selectedCurrency,
        createdAt: now,
        updatedAt: now
      };
      this.accounts.push(account);
      this.activeAccountId = id;
      this.persist();

      if (amount !== 0) {
        const transactionsStore = useTransactionsStore();
        transactionsStore.recordOpeningBalance({
          accountId: id,
          amount,
          occurredAt: now,
          // A credit account's opening balance is debt → record it as an outflow.
          direction: accountType === 'credit' ? 'debit' : 'credit'
        });
      }
      householdStore.logEvent('account.created', `Created ${accountType} account "${trimmed}"`, {
        accountId: id
      });
      return id;
    },
    updateAccount(id, updates) {
      const householdStore = useHouseholdStore();
      if (!householdStore.initialized) {
        householdStore.init();
      }
      householdStore.ensureCanEditFinancialData('edit accounts');
      const account = this.accountById(id);
      if (!account) {
        throw new Error('Account not found');
      }
      const payload = { ...updates };
      if (typeof payload.name === 'string') {
        payload.name = payload.name.trim();
        if (!payload.name) {
          throw new Error('Account name cannot be empty');
        }
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'cycleDay')) {
        payload.cycleDay = payload.cycleDay ? Number(payload.cycleDay) : null;
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'excludeFromHousehold')) {
        payload.excludeFromHousehold = Boolean(payload.excludeFromHousehold);
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'type')) {
        payload.type = normaliseAccountType(payload.type);
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'creditLimit')) {
        const resolvedType = payload.type ?? account.type;
        payload.creditLimit = resolvedType === 'credit' ? normaliseCreditLimit(payload.creditLimit) : null;
      }
      if (payload.currency) {
        payload.currency = String(payload.currency).toUpperCase();
      }
      Object.assign(account, payload, { updatedAt: new Date() });
      this.persist();
      householdStore.logEvent('account.updated', `Updated account "${account.name}"`, {
        accountId: id
      });
    },
    closeAccount(id) {
      const householdStore = useHouseholdStore();
      if (!householdStore.initialized) {
        householdStore.init();
      }
      householdStore.ensureCanEditFinancialData('close accounts');
      const account = this.accountById(id);
      if (!account) {
        throw new Error('Account not found');
      }
      if (account.isClosed) return;
      account.isClosed = true;
      account.closedAt = new Date();
      account.updatedAt = new Date();
      if (this.activeAccountId === id) {
        const fallback = this.visibleOpenAccounts.find((candidate) => candidate.id !== id);
        this.activeAccountId = fallback?.id ?? null;
      }
      this.persist();
      householdStore.logEvent('account.closed', `Closed account "${account.name}"`, {
        accountId: id
      });
    },
    applyBalanceDelta(id, delta) {
      const account = this.accountById(id);
      if (!account) {
        throw new Error('Account not found');
      }
      account.balance = ensureNumber(account.balance) + ensureNumber(delta);
      account.updatedAt = new Date();
      this.persist();
    },
    setBalance(id, balance) {
      const account = this.accountById(id);
      if (!account) {
        throw new Error('Account not found');
      }
      account.balance = ensureNumber(balance);
      account.updatedAt = new Date();
      this.persist();
    },
    replaceAll(records) {
      this.accounts = Array.isArray(records)
        ? records.map((entry) => deserialiseAccount(entry, FALLBACK_CURRENCY))
        : [];
      this.activeAccountId = this.determineActiveAccountId();
      this.status = 'ready';
      this.initialized = true;
      this.persist();
    },
    clear() {
      this.accounts = [];
      this.activeAccountId = null;
      this.status = 'idle';
      this.initialized = false;
      this.persist();
    }
  }
});
