import { useAccountsStore } from '../stores/accounts';
import { useCategoriesStore } from '../stores/categories';
import { useCurrencyStore } from '../stores/currency';
import { parseDateKey } from '../utils/dates';

/**
 * Composable for transaction-related helper functions
 */
export function useTransactionHelpers() {
  const accountsStore = useAccountsStore();
  const categoriesStore = useCategoriesStore();
  const currencyStore = useCurrencyStore();

  /**
   * Get the title for a transaction
   */
  function getTransactionTitle(tx) {
    if (tx.type === 'transfer') {
      const counterparty = accountsStore.visibleAccountById(tx.counterpartyAccountId);
      if (tx.direction === 'incoming') {
        return `Transfer from ${counterparty?.name ?? 'Unknown'}`;
      }
      return `Transfer to ${counterparty?.name ?? 'Unknown'}`;
    }
    
    const category = categoriesStore.categories?.find(c => c.id === tx.categoryId);
    return category?.name ?? 'Uncategorized';
  }

  /**
   * Get the icon for a transaction
   */
  function getTransactionIcon(tx) {
    if (tx.type === 'transfer') {
      return 'arrows-right-left';
    }
    const category = categoriesStore.categories?.find(c => c.id === tx.categoryId);
    return category?.icon ?? 'question-mark-circle';
  }

  /**
   * Get background class based on transaction type
   */
  function getTransactionBgClass(tx) {
    if (tx.type === 'credit') return 'bg-success/10 text-success';
    if (tx.type === 'debit') return 'bg-error/10 text-error';
    return 'bg-info/10 text-info';
  }

  /**
   * Get badge class based on transaction type
   */
  function getTypeBadgeClass(type) {
    if (type === 'credit') return 'badge-success';
    if (type === 'debit') return 'badge-error';
    return 'badge-info';
  }

  /**
   * Get text class based on transaction type
   */
  function getTransactionTextClass(tx) {
    if (tx.type === 'credit') return 'text-success';
    if (tx.type === 'debit') return 'text-error';
    return 'text-info';
  }

  function toDate(value) {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'string') {
      const fromDateKey = parseDateKey(value);
      if (fromDateKey) {
        return fromDateKey;
      }
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  /**
   * Format transaction date (date only, no time)
   */
  function formatDateLabel(value) {
    const date = toDate(value);
    if (!date) {
      return '--';
    }
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium'
    }).format(date);
  }

  // Backward-compatible alias for callers still using old helper name.
  function formatTime(value) {
    return formatDateLabel(value);
  }

  /**
   * Get sign for transaction amount (positive or negative)
   */
  function getTransactionSign(tx) {
    if (tx.type === 'debit' || (tx.type === 'transfer' && tx.direction === 'outgoing')) {
      return -1;
    }
    return 1;
  }

  /**
   * Format transaction amount with currency
   */
  function formatTransactionAmount(tx) {
    const account = accountsStore.visibleAccountById(tx.accountId);
    const amount = Number(tx.amount) || 0;
    const sign = getTransactionSign(tx);
    
    if (!account) {
      return {
        formatted: `${(sign * amount).toFixed(2)} ???`,
        formattedBase: null,
        pending: false
      };
    }

    const baseCurrency = currencyStore.mainCurrency || 'USD';
    const accountCurrency = account.currency || baseCurrency;
    const formatted = currencyStore.formatCurrency(sign * amount, accountCurrency);
    
    if (accountCurrency === baseCurrency) {
      return {
        formatted,
        formattedBase: null,
        pending: false
      };
    }

    const converted = currencyStore.convertAmount(amount, accountCurrency, baseCurrency, {
      requestIfMissing: true
    });
    
    if (converted === null) {
      return {
        formatted,
        formattedBase: null,
        pending: true
      };
    }

    const formattedBase = currencyStore.formatCurrency(sign * converted, baseCurrency);
    
    return {
      formatted,
      formattedBase,
      pending: false
    };
  }

  return {
    getTransactionTitle,
    getTransactionIcon,
    getTransactionBgClass,
    getTypeBadgeClass,
    getTransactionTextClass,
    formatDateLabel,
    formatTime,
    getTransactionSign,
    formatTransactionAmount
  };
}
