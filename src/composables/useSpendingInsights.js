import { computed } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useCategoriesStore } from '@/stores/categories';
import { useCurrencyStore } from '@/stores/currency';
import { usePreferencesStore } from '@/stores/preferences';
import { getCycleBoundsForMonthKey, shiftMonthKey, toCycleMonthKey } from '@/utils/dates';

function isExpenseTransaction(transaction) {
  return transaction.type === 'debit' || (transaction.type === 'transfer' && transaction.direction === 'outgoing');
}

function isIncomeTransaction(transaction) {
  return transaction.type === 'credit' || (transaction.type === 'transfer' && transaction.direction === 'incoming');
}

function transactionDate(transaction) {
  const date = transaction?.occurredAt ?? transaction?.createdAt ?? new Date(0);
  return date instanceof Date ? date : new Date(date);
}

function formatCycleOptionLabel(bounds) {
  if (!bounds) return 'Unknown';
  const monthYear = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric'
  }).format(bounds.start);
  const dayRange = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric'
  });
  return `${monthYear} (${dayRange.format(bounds.start)} - ${dayRange.format(bounds.endInclusive)})`;
}

export function useSpendingInsights() {
  const accountsStore = useAccountsStore();
  const categoriesStore = useCategoriesStore();
  const currencyStore = useCurrencyStore();
  const preferencesStore = usePreferencesStore();

  const cycleStartDay = computed(() => preferencesStore.cycleStartDay);
  const currentMonthKey = computed(() => toCycleMonthKey(new Date(), cycleStartDay.value));

  function buildMonthOptions(count = 24) {
    const options = [];
    let monthKey = currentMonthKey.value;
    for (let index = 0; index < count && monthKey; index += 1) {
      const bounds = getCycleBoundsForMonthKey(monthKey, cycleStartDay.value);
      options.push({
        value: monthKey,
        label: formatCycleOptionLabel(bounds),
        shortLabel: bounds
          ? new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(bounds.start)
          : 'Unknown'
      });
      monthKey = shiftMonthKey(monthKey, -1);
    }
    return options;
  }

  function convertAmountForAccount(amount, account) {
    const baseCurrency = currencyStore.mainCurrency;
    const sourceCurrency = account?.currency || baseCurrency;
    const converted = currencyStore.convertAmount(amount, sourceCurrency, baseCurrency, {
      requestIfMissing: true
    });
    if (converted === null && sourceCurrency !== baseCurrency) {
      return { value: 0, pending: true };
    }
    return { value: converted ?? (Number(amount) || 0), pending: false };
  }

  function summarizeCycle(transactions, monthKey) {
    const bounds = getCycleBoundsForMonthKey(monthKey, cycleStartDay.value);
    const categories = new Map();
    let spent = 0;
    let income = 0;
    let pending = false;
    let expenseCount = 0;
    let incomeCount = 0;

    if (!bounds) {
      return {
        monthKey,
        bounds,
        spent,
        income,
        saved: 0,
        pending,
        expenseCount,
        incomeCount,
        categories: []
      };
    }

    for (const transaction of transactions) {
      if (transaction.excludeFromInsights) continue;
      const account = accountsStore.visibleAccountById(transaction.accountId);
      if (!account || account.isClosed) continue;
      const date = transactionDate(transaction);
      if (Number.isNaN(date.getTime()) || date < bounds.start || date >= bounds.endExclusive) continue;

      const amount = Number(transaction.amount) || 0;
      const conversion = convertAmountForAccount(amount, account);
      if (conversion.pending) {
        pending = true;
        continue;
      }

      if (isExpenseTransaction(transaction)) {
        spent += conversion.value;
        expenseCount += 1;
        const categoryId = transaction.categoryId || 'uncategorized';
        const category = categoriesStore.byId(categoryId) ?? {
          name: 'Uncategorized',
          icon: 'question-mark-circle'
        };
        const row = categories.get(categoryId) ?? {
          id: categoryId,
          name: category.name,
          icon: category.icon,
          total: 0,
          count: 0,
          percentage: 0
        };
        row.total += conversion.value;
        row.count += 1;
        categories.set(categoryId, row);
      }

      if (isIncomeTransaction(transaction)) {
        income += conversion.value;
        incomeCount += 1;
      }
    }

    const categoryRows = Array.from(categories.values()).sort((left, right) => right.total - left.total);
    for (const row of categoryRows) {
      row.percentage = spent > 0 ? Math.round((row.total / spent) * 100) : 0;
    }

    return {
      monthKey,
      bounds,
      spent,
      income,
      saved: Math.max(income - spent, 0),
      pending,
      expenseCount,
      incomeCount,
      categories: categoryRows
    };
  }

  function formatCycleLabel(bounds) {
    if (!bounds) return 'Current cycle';
    const formatter = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric'
    });
    return `${formatter.format(bounds.start)} - ${formatter.format(bounds.endInclusive)}`;
  }

  return {
    currentMonthKey,
    cycleStartDay,
    buildMonthOptions,
    summarizeCycle,
    formatCycleLabel,
    convertAmountForAccount
  };
}
