import { defineStore } from 'pinia';
import { generateId, parseDate, readJson, writeJson } from '@/utils/storage';
import { coerceDateKey, getDateOrFallback, parseDateKey, toDateKey } from '@/utils/dates';
import { notifyBackupDirty } from '@/utils/backupDirtySignal';
import { useAccountsStore } from './accounts';
import { useCategoriesStore } from './categories';
import { useCurrencyStore } from './currency';
import { useHouseholdStore } from './household';
import { useMonthClosuresStore } from './monthClosures';

const STORAGE_KEY = 'transactions';

function ensureNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function deserialiseTransaction(record) {
  const occurredOn = coerceDateKey(record.occurredOn ?? record.occurredAt ?? record.createdAt, toDateKey(new Date()));
  const occurredAt = parseDateKey(occurredOn) ?? parseDate(record.occurredAt) ?? parseDate(record.createdAt) ?? new Date();
  return {
    ...record,
    excludeFromInsights: Boolean(record.excludeFromInsights),
    occurredOn,
    occurredAt,
    createdAt: parseDate(record.createdAt),
    updatedAt: parseDate(record.updatedAt),
    groupId: record.groupId ?? null
  };
}

function serialiseTransaction(transaction) {
  const occurredOn = coerceDateKey(
    transaction.occurredOn ?? transaction.occurredAt ?? transaction.createdAt,
    toDateKey(new Date())
  );
  const occurredAt = parseDateKey(occurredOn) ?? parseDate(transaction.occurredAt) ?? new Date();
  return {
    ...transaction,
    excludeFromInsights: Boolean(transaction.excludeFromInsights),
    occurredOn,
    occurredAt: occurredAt.toISOString(),
    createdAt: transaction.createdAt ? transaction.createdAt.toISOString() : null,
    updatedAt: transaction.updatedAt ? transaction.updatedAt.toISOString() : null,
    groupId: transaction.groupId ?? null
  };
}

function resolveExcludeFromInsights({
  type,
  categoryId,
  explicitValue
}) {
  if (explicitValue != null) {
    return Boolean(explicitValue);
  }
  if (type === 'transfer') {
    return false;
  }
  const categoriesStore = useCategoriesStore();
  if (!categoriesStore.initialized) {
    categoriesStore.init();
  }
  const category = categoriesStore.byId(categoryId);
  return Boolean(category?.excludeByDefault);
}

function serialiseAccountSnapshot(account) {
  return {
    ...account,
    createdAt: account.createdAt ? account.createdAt.toISOString() : null,
    updatedAt: account.updatedAt ? account.updatedAt.toISOString() : null,
    closedAt: account.closedAt ? account.closedAt.toISOString() : null
  };
}

function deserialiseAccountSnapshot(record) {
  return {
    ...record,
    createdAt: parseDate(record.createdAt),
    updatedAt: parseDate(record.updatedAt),
    closedAt: parseDate(record.closedAt)
  };
}

function resolveOccurredDate(transaction) {
  if (transaction.occurredOn) {
    const parsedFromKey = parseDateKey(transaction.occurredOn);
    if (parsedFromKey) return parsedFromKey;
  }
  if (transaction.occurredAt instanceof Date && !Number.isNaN(transaction.occurredAt.getTime())) {
    return transaction.occurredAt;
  }
  const parsed = parseDate(transaction.occurredAt) ?? parseDate(transaction.createdAt);
  return parsed ?? new Date(0);
}

function sortTransactions(list) {
  return [...list].sort((a, b) => {
    const left = resolveOccurredDate(a).getTime();
    const right = resolveOccurredDate(b).getTime();
    if (right !== left) {
      return right - left;
    }
    return (b.updatedAt ?? new Date(0)).getTime() - (a.updatedAt ?? new Date(0)).getTime();
  });
}

function normaliseTransactionDate(value) {
  const occurredOn = coerceDateKey(value, toDateKey(new Date()));
  return {
    occurredOn,
    occurredAt: getDateOrFallback(occurredOn, new Date())
  };
}

function resolveTransferGroup(transactions, seedGroupId, occurredAt, amount, accountId, counterpartyAccountId) {
  if (seedGroupId) {
    return transactions.filter((tx) => tx.groupId === seedGroupId && tx.type === 'transfer');
  }
  return transactions.filter(
    (tx) =>
      tx.type === 'transfer' &&
      Math.abs(ensureNumber(tx.amount) - amount) < 1e-6 &&
      resolveOccurredDate(tx).getTime() === occurredAt.getTime() &&
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
      const accountsStore = useAccountsStore();
      const filtered = state.transactions.filter((tx) => {
        if (!accountsStore.isAccountVisible(tx.accountId)) {
          return false;
        }
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
      const accountsStore = useAccountsStore();
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthKey = `${prevDate.getFullYear()}-${prevDate.getMonth() + 1}`;

      const summary = {
        [currentMonthKey]: { credit: 0, debit: 0 },
        [prevMonthKey]: { credit: 0, debit: 0 }
      };

      for (const tx of state.transactions) {
        if (!accountsStore.isAccountVisible(tx.accountId)) continue;
        if (tx.excludeFromInsights) continue;
        const occurred = resolveOccurredDate(tx);
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
      notifyBackupDirty('transactions');
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
      const { occurredOn, occurredAt: timestamp } = normaliseTransactionDate(occurredAt);
      const now = new Date();
      const tx = {
        id: generateId('tx'),
        type: 'credit',
        subtype: 'opening-balance',
        accountId,
        amount: value,
        categoryId: 'opening-balance',
        note: 'Opening balance',
        excludeFromInsights: false,
        occurredOn,
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
      counterpartyAccountId,
      excludeFromInsights
    }) {
      this.ensureInitialised();
      const householdStore = useHouseholdStore();
      const monthClosuresStore = useMonthClosuresStore();
      if (!householdStore.initialized) {
        householdStore.init();
      }
      if (!monthClosuresStore.initialized) {
        monthClosuresStore.init();
      }
      householdStore.ensureCanEditFinancialData('create transactions');
      const accountsStore = useAccountsStore();
      const sourceAccount = accountsStore.accountById(accountId);
      if (!sourceAccount) {
        throw new Error('Account not found');
      }
      if (!accountsStore.isAccountVisible(accountId)) {
        throw new Error('This account is private in the household.');
      }
      if (sourceAccount.isClosed) {
        throw new Error('Cannot record transactions on a closed account');
      }

      const value = ensureNumber(amount);
      if (value <= 0) {
        throw new Error('Amount must be greater than zero');
      }

      const { occurredOn, occurredAt: timestamp } = normaliseTransactionDate(occurredAt);
      monthClosuresStore.assertMonthOpen(occurredOn, 'record transactions');
      const now = new Date();
      const trimmedNote = note?.trim?.() ?? '';
      const shouldExclude = resolveExcludeFromInsights({
        type,
        categoryId,
        explicitValue: excludeFromInsights
      });

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
        if (!accountsStore.isAccountVisible(counterpartyAccountId)) {
          throw new Error('Destination account is private in the household.');
        }
        if (destinationAccount.isClosed) {
          throw new Error('Cannot transfer to a closed account');
        }

        // Handle currency conversion for transfers between different currencies
        const sourceCurrency = sourceAccount.currency;
        const destinationCurrency = destinationAccount.currency;
        let convertedAmount = value;
        
        if (sourceCurrency !== destinationCurrency) {
          const currencyStore = useCurrencyStore();
          const converted = currencyStore.convertAmount(value, sourceCurrency, destinationCurrency, {
            requestIfMissing: true
          });
          
          if (converted !== null) {
            convertedAmount = converted;
          } else {
            // If conversion fails, warn the user but proceed with same amount
            console.warn(`Could not convert ${value} from ${sourceCurrency} to ${destinationCurrency}. Using same amount.`);
          }
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
          excludeFromInsights: shouldExclude,
          occurredOn,
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
          amount: convertedAmount, // Use converted amount for destination account
          categoryId: 'transfer',
          note: trimmedNote,
          excludeFromInsights: shouldExclude,
          occurredOn,
          occurredAt: timestamp,
          createdAt: now,
          updatedAt: now,
          groupId
        };

        this.transactions = sortTransactions([...this.transactions, outgoing, incoming]);
        this.persist();
        accountsStore.applyBalanceDelta(accountId, -value);
        accountsStore.applyBalanceDelta(counterpartyAccountId, convertedAmount); // Use converted amount
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
        excludeFromInsights: shouldExclude,
        occurredOn,
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
      const householdStore = useHouseholdStore();
      const monthClosuresStore = useMonthClosuresStore();
      if (!householdStore.initialized) {
        householdStore.init();
      }
      if (!monthClosuresStore.initialized) {
        monthClosuresStore.init();
      }
      householdStore.ensureCanEditFinancialData('update transactions');
      const accountsStore = useAccountsStore();
      const target = this.transactions.find((tx) => tx.id === id);
      if (!target) {
        throw new Error('Transaction not found');
      }
      if (!accountsStore.isAccountVisible(target.accountId)) {
        throw new Error('This transaction belongs to a private household account.');
      }
      monthClosuresStore.assertMonthOpen(
        target.occurredOn ?? target.occurredAt ?? target.createdAt,
        'edit transactions'
      );

      const previousTransactions = this.transactions.map(serialiseTransaction);
      const previousAccounts = accountsStore.accounts.map(serialiseAccountSnapshot);
      const previousActiveAccountId = accountsStore.activeAccountId;
      const nextType = updates.type ?? target.type;

      const updateData = {
        type: nextType,
        accountId: updates.accountId ?? target.accountId,
        amount: updates.amount ?? target.amount,
        note: updates.note ?? target.note,
        excludeFromInsights:
          updates.excludeFromInsights ??
          target.excludeFromInsights ??
          false,
        occurredAt:
          updates.occurredAt ??
          updates.occurredOn ??
          target.occurredOn ??
          target.occurredAt ??
          target.createdAt
      };

      if (nextType === 'transfer') {
        const baseAccountId = updates.accountId ?? target.accountId;
        const baseCounterparty = updates.counterpartyAccountId ?? target.counterpartyAccountId;
        const editingIncomingTransfer = target.type === 'transfer' && target.direction === 'incoming';
        if (editingIncomingTransfer) {
          updateData.accountId = baseCounterparty;
          updateData.counterpartyAccountId = baseAccountId;
        } else {
          updateData.accountId = baseAccountId;
          updateData.counterpartyAccountId = baseCounterparty;
        }
      } else {
        updateData.categoryId = updates.categoryId ?? target.categoryId;
      }

      if (Object.prototype.hasOwnProperty.call(updateData, 'occurredAt')) {
        monthClosuresStore.assertMonthOpen(updateData.occurredAt, 'edit transactions');
      }

      try {
        this.deleteTransaction(id, { skipAudit: true, skipPermissionCheck: true });
        this.addTransaction(updateData);
        householdStore.logEvent('transaction.updated', 'Updated a transaction', {
          transactionId: id
        });
      } catch (error) {
        this.transactions = sortTransactions(previousTransactions.map(deserialiseTransaction));
        this.persist();
        accountsStore.accounts = previousAccounts.map(deserialiseAccountSnapshot);
        accountsStore.activeAccountId = previousActiveAccountId;
        accountsStore.persist();
        throw error;
      }
    },
    deleteTransaction(id, { skipAudit = false, skipPermissionCheck = false } = {}) {
      this.ensureInitialised();
      const householdStore = useHouseholdStore();
      const monthClosuresStore = useMonthClosuresStore();
      if (!householdStore.initialized) {
        householdStore.init();
      }
      if (!monthClosuresStore.initialized) {
        monthClosuresStore.init();
      }
      if (!skipPermissionCheck) {
        householdStore.ensureCanEditFinancialData('delete transactions');
      }
      const accountsStore = useAccountsStore();
      const target = this.transactions.find((tx) => tx.id === id);
      if (!target) {
        throw new Error('Transaction not found');
      }
      if (!accountsStore.isAccountVisible(target.accountId)) {
        throw new Error('This transaction belongs to a private household account.');
      }
      monthClosuresStore.assertMonthOpen(
        target.occurredOn ?? target.occurredAt ?? target.createdAt,
        'delete transactions'
      );

      let related = [target];
      if (target.type === 'transfer') {
        related = resolveTransferGroup(
          this.transactions,
          target.groupId,
          resolveOccurredDate(target),
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
        monthClosuresStore.assertMonthOpen(
          tx.occurredOn ?? tx.occurredAt ?? tx.createdAt,
          'delete transactions'
        );
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
      if (!skipAudit) {
        householdStore.logEvent('transaction.deleted', 'Deleted transaction record(s)', {
          transactionId: id,
          affectedCount: idsToRemove.size
        });
      }
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
