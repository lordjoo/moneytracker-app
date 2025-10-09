import { defineStore } from 'pinia';
import { generateId, parseDate, readJson, writeJson } from '@/utils/storage';
import { useTransactionsStore } from './transactions';

const STORAGE_KEY = 'accounts';

function deserialiseAccount(record) {
  return {
    ...record,
    createdAt: parseDate(record.createdAt),
    updatedAt: parseDate(record.updatedAt),
    closedAt: parseDate(record.closedAt)
  };
}

function serialiseAccount(account) {
  return {
    ...account,
    createdAt: account.createdAt ? account.createdAt.toISOString() : null,
    updatedAt: account.updatedAt ? account.updatedAt.toISOString() : null,
    closedAt: account.closedAt ? account.closedAt.toISOString() : null
  };
}

function ensureNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const useAccountsStore = defineStore('accounts', {
  state: () => ({
    accounts: [],
    status: 'idle',
    activeAccountId: null,
    initialized: false
  }),
  getters: {
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
    accountById: (state) => (id) => state.accounts.find((account) => account.id === id) ?? null
  },
  actions: {
    init() {
      if (this.initialized) return;
      this.status = 'loading';
      const records = readJson(STORAGE_KEY, []);
      this.accounts = Array.isArray(records) ? records.map(deserialiseAccount) : [];
      this.activeAccountId = this.determineActiveAccountId();
      this.status = 'ready';
      this.initialized = true;
    },
    determineActiveAccountId() {
      if (this.activeAccountId && this.accountById(this.activeAccountId)) {
        return this.activeAccountId;
      }
      const firstOpen = this.openAccounts[0];
      if (firstOpen) return firstOpen.id;
      return this.accounts[0]?.id ?? null;
    },
    persist() {
      writeJson(STORAGE_KEY, this.accounts.map(serialiseAccount));
    },
    setActiveAccount(id) {
      this.activeAccountId = id;
      this.persist();
    },
    createAccount({ name, openingBalance = 0, cycleDay = null }) {
      const trimmed = String(name ?? '').trim();
      if (!trimmed) {
        throw new Error('Account name is required');
      }
      const amount = ensureNumber(openingBalance, 0);
      const now = new Date();
      const id = generateId('acct');
      const account = {
        id,
        name: trimmed,
        balance: 0,
        cycleDay: cycleDay ? Number(cycleDay) : null,
        isClosed: false,
        closedAt: null,
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
          occurredAt: now
        });
      }
      return id;
    },
    updateAccount(id, updates) {
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
      Object.assign(account, payload, { updatedAt: new Date() });
      this.persist();
    },
    closeAccount(id) {
      const account = this.accountById(id);
      if (!account) {
        throw new Error('Account not found');
      }
      if (account.isClosed) return;
      account.isClosed = true;
      account.closedAt = new Date();
      account.updatedAt = new Date();
      if (this.activeAccountId === id) {
        const fallback = this.openAccounts.find((candidate) => candidate.id !== id);
        this.activeAccountId = fallback?.id ?? null;
      }
      this.persist();
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
      this.accounts = Array.isArray(records) ? records.map(deserialiseAccount) : [];
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
