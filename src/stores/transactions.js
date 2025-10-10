import { defineStore } from 'pinia';
import { generateId, parseDate, readJson, writeJson } from '@/utils/storage';
import { useAccountsStore } from './accounts';

const STORAGE_KEY = 'transactions';

function ensureNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function deserialiseTransaction(record) {
  return {
    ...record,
    occurredAt: parseDate(record.occurredAt),
    createdAt: parseDate(record.createdAt),
    updatedAt: parseDate(record.updatedAt),
    groupId: record.groupId ?? null
  };
}

function serialiseTransaction(transaction) {
  return {
    ...transaction,
    occurredAt: transaction.occurredAt ? transaction.occurredAt.toISOString() : null,
    createdAt: transaction.createdAt ? transaction.createdAt.toISOString() : null,
    updatedAt: transaction.updatedAt ? transaction.updatedAt.toISOString() : null,
    groupId: transaction.groupId ?? null
  };
}

function sortTransactions(list) {
  return [...list].sort((a, b) => {
    const left = (a.occurredAt ?? a.createdAt ?? new Date(0)).getTime();
    const right = (b.occurredAt ?? b.createdAt ?? new Date(0)).getTime();
    if (right !== left) {
      return right - left;
    }
    return (b.updatedAt ?? new Date(0)).getTime() - (a.updatedAt ?? new Date(0)).getTime();
  });
}

function normaliseDate(value) {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function resolveTransferGroup(transactions, seedGroupId, occurredAt, amount, accountId, counterpartyAccountId) {
  if (seedGroupId) {
    return transactions.filter((tx) => tx.groupId === seedGroupId && tx.type === 'transfer');
  }
  return transactions.filter(
    (tx) =>
      tx.type === 'transfer' &&
      Math.abs(ensureNumber(tx.amount) - amount) < 1e-6 &&
      (tx.occurredAt ?? tx.createdAt ?? new Date(0)).getTime() === occurredAt.getTime() &&
      ((tx.accountId === accountId && tx.counterpartyAccountId === counterpartyAccountId) ||
        (tx.accountId === counterpartyAccountId && tx.counterpartyAccountId === accountId))
  );
}

export const useTransactionsStore = defineStore('transactions', {
  state: () => ({
    transactions: [],
    status: 'idle',
    filters: {
      accountId: null,
      categoryId: null
    },
    initialized: false
  }),
  getters: {
    filteredTransactions(state) {
      const filtered = state.transactions.filter((tx) => {
        if (state.filters.accountId && tx.accountId !== state.filters.accountId) {
          return false;
        }
        if (state.filters.categoryId && tx.categoryId !== state.filters.categoryId) {
          return false;
        }
        return true;
      });
      return sortTransactions(filtered);
    },
    monthlySummary: (state) => {
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthKey = `${prevDate.getFullYear()}-${prevDate.getMonth() + 1}`;

      const summary = {
        [currentMonthKey]: { credit: 0, debit: 0 },
        [prevMonthKey]: { credit: 0, debit: 0 }
      };

      for (const tx of state.transactions) {
        const occurred = tx.occurredAt ?? tx.createdAt ?? new Date();
        const key = `${occurred.getFullYear()}-${occurred.getMonth() + 1}`;
        if (!summary[key]) {
          summary[key] = { credit: 0, debit: 0 };
        }
        const amount = ensureNumber(tx.amount);
        if (tx.type === 'credit' || (tx.type === 'transfer' && tx.direction === 'incoming')) {
          summary[key].credit += amount;
        }
        if (tx.type === 'debit' || (tx.type === 'transfer' && tx.direction === 'outgoing')) {
          summary[key].debit += amount;
        }
      }

      return summary;
    }
  },
  actions: {
    init() {
      if (this.initialized) return;
      this.status = 'loading';
      const records = readJson(STORAGE_KEY, []);
      this.transactions = Array.isArray(records)
        ? sortTransactions(records.map(deserialiseTransaction))
        : [];
      this.status = 'ready';
      this.initialized = true;
    },
    persist() {
      writeJson(STORAGE_KEY, this.transactions.map(serialiseTransaction));
    },
    setFilter(filter, value) {
      if (!Object.prototype.hasOwnProperty.call(this.filters, filter)) return;
      this.filters[filter] = value;
    },
    ensureInitialised() {
      if (!this.initialized) {
        this.init();
      }
    },
    recordOpeningBalance({ accountId, amount, occurredAt = new Date() }) {
      this.ensureInitialised();
      const value = ensureNumber(amount, 0);
      if (value === 0) return;
      const accountsStore = useAccountsStore();
      const account = accountsStore.accountById(accountId);
      if (!account) return;
      const timestamp = normaliseDate(occurredAt);
      const now = new Date();
      const tx = {
        id: generateId('tx'),
        type: 'credit',
        subtype: 'opening-balance',
        accountId,
        amount: value,
        categoryId: 'opening-balance',
        note: 'Opening balance',
        occurredAt: timestamp,
        createdAt: now,
        updatedAt: now,
        groupId: generateId('txgrp')
      };
      this.transactions = sortTransactions([...this.transactions, tx]);
      this.persist();
      accountsStore.applyBalanceDelta(accountId, value);
    },
    addTransaction({
      type,
      accountId,
      amount,
      categoryId,
      note = '',
      occurredAt = new Date(),
      counterpartyAccountId
    }) {
      this.ensureInitialised();
      const accountsStore = useAccountsStore();
      const sourceAccount = accountsStore.accountById(accountId);
      if (!sourceAccount) {
        throw new Error('Account not found');
      }
      if (sourceAccount.isClosed) {
        throw new Error('Cannot record transactions on a closed account');
      }

      const value = ensureNumber(amount);
      if (value <= 0) {
        throw new Error('Amount must be greater than zero');
      }

      const timestamp = normaliseDate(occurredAt);
      const now = new Date();
      const trimmedNote = note?.trim?.() ?? '';

      if (type === 'transfer') {
        if (!counterpartyAccountId) {
          throw new Error('Transfer requires a destination account');
        }
        if (counterpartyAccountId === accountId) {
          throw new Error('Cannot transfer to the same account');
        }
        const destinationAccount = accountsStore.accountById(counterpartyAccountId);
        if (!destinationAccount) {
          throw new Error('Destination account not found');
        }
        if (destinationAccount.isClosed) {
          throw new Error('Cannot transfer to a closed account');
        }

        const groupId = generateId('txgrp');
        const outgoing = {
          id: generateId('tx'),
          type: 'transfer',
          direction: 'outgoing',
          accountId,
          counterpartyAccountId,
          amount: value,
          categoryId: 'transfer',
          note: trimmedNote,
          occurredAt: timestamp,
          createdAt: now,
          updatedAt: now,
          groupId
        };
        const incoming = {
          id: generateId('tx'),
          type: 'transfer',
          direction: 'incoming',
          accountId: counterpartyAccountId,
          counterpartyAccountId: accountId,
          amount: value,
          categoryId: 'transfer',
          note: trimmedNote,
          occurredAt: timestamp,
          createdAt: now,
          updatedAt: now,
          groupId
        };

        this.transactions = sortTransactions([...this.transactions, outgoing, incoming]);
        this.persist();
        accountsStore.applyBalanceDelta(accountId, -value);
        accountsStore.applyBalanceDelta(counterpartyAccountId, value);
        return;
      }

      if (!['credit', 'debit'].includes(type)) {
        throw new Error('Unsupported transaction type');
      }

      if (!categoryId) {
        throw new Error('Please choose a category');
      }

      const tx = {
        id: generateId('tx'),
        type,
        accountId,
        amount: value,
        categoryId,
        note: trimmedNote,
        occurredAt: timestamp,
        createdAt: now,
        updatedAt: now,
        groupId: generateId('txgrp')
      };

      this.transactions = sortTransactions([...this.transactions, tx]);
      this.persist();
      const delta = type === 'credit' ? value : -value;
      accountsStore.applyBalanceDelta(accountId, delta);
    },
    updateTransaction(id, updates) {
      this.ensureInitialised();
      const accountsStore = useAccountsStore();
      const target = this.transactions.find((tx) => tx.id === id);
      if (!target) {
        throw new Error('Transaction not found');
      }

      // For now, we'll delete and recreate to handle all the balance logic
      // First, reverse the old transaction's balance effects
      this.deleteTransaction(id);
      
      // Then create a new transaction with the updated data
      this.addTransaction({
        type: updates.type ?? target.type,
        accountId: updates.accountId ?? target.accountId,
        amount: updates.amount ?? target.amount,
        categoryId: updates.categoryId ?? target.categoryId,
        note: updates.note ?? target.note,
        occurredAt: updates.occurredAt ?? target.occurredAt,
        counterpartyAccountId: updates.counterpartyAccountId ?? target.counterpartyAccountId
      });
    },
    deleteTransaction(id) {
      this.ensureInitialised();
      const accountsStore = useAccountsStore();
      const target = this.transactions.find((tx) => tx.id === id);
      if (!target) {
        throw new Error('Transaction not found');
      }

      let related = [target];
      if (target.type === 'transfer') {
        related = resolveTransferGroup(
          this.transactions,
          target.groupId,
          target.occurredAt ?? target.createdAt ?? new Date(),
          ensureNumber(target.amount),
          target.accountId,
          target.counterpartyAccountId
        );
        if (!related.length) {
          related = [target];
        }
      }

      const idsToRemove = new Set(related.map((tx) => tx.id));

      for (const tx of related) {
        const amount = ensureNumber(tx.amount);
        if (tx.type === 'transfer') {
          if (tx.direction === 'outgoing') {
            accountsStore.applyBalanceDelta(tx.accountId, amount);
          } else {
            accountsStore.applyBalanceDelta(tx.accountId, -amount);
          }
        } else if (tx.type === 'credit') {
          accountsStore.applyBalanceDelta(tx.accountId, -amount);
        } else if (tx.type === 'debit') {
          accountsStore.applyBalanceDelta(tx.accountId, amount);
        }
      }

      this.transactions = sortTransactions(this.transactions.filter((tx) => !idsToRemove.has(tx.id)));
      this.persist();
    },
    replaceAll(transactions) {
      this.transactions = sortTransactions(transactions.map(deserialiseTransaction));
      this.status = 'ready';
      this.initialized = true;
      this.persist();
    },
    clear() {
      this.transactions = [];
      this.status = 'idle';
      this.initialized = false;
      this.persist();
    }
  }
});
