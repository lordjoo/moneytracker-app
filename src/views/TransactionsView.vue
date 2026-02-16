<template>
  <div class="space-y-6">
    <!-- Header -->
    <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Transactions</h1>
        <p class="text-sm opacity-70">Track all your financial activities</p>
      </div>
      <button 
        class="btn btn-primary gap-2" 
        :disabled="!canCreateTransactions" 
        :title="createButtonTitle" 
        @click="openTransactionForm()"
      >
        <PlusIcon class="h-5 w-5" />
        <span>New Transaction</span>
      </button>
    </header>

    <div v-if="!householdStore.canEditFinancialData" class="alert alert-info text-sm">
      <span>Your role is read-only. You can view transactions but cannot edit them.</span>
    </div>
    <div v-if="closedMonthLabels.length" class="alert alert-warning text-sm">
      <span>Locked months: {{ closedMonthLabels.join(', ') }}. Transactions in these periods cannot be edited.</span>
    </div>

    <!-- Filters -->
    <TransactionFilters
      v-model:search="searchQuery"
      v-model:filters="filters"
      :accounts="accountsStore.visibleSortedAccounts || []"
      :categories="categoriesStore.categories || []"
    />

    <!-- Transactions List -->
    <TransactionList
      :grouped-transactions="groupedTransactions"
      :empty-message="emptyStateMessage"
      :can-add-transaction="canCreateTransactions"
      @edit="openTransactionForm"
      @delete="requestDelete"
      @add="openTransactionForm()"
    />

    <!-- Transaction Form Dialog -->
    <TransactionFormDialog
      :open="openForm"
      v-model:form="form"
      :is-editing="!!editingTransaction"
      :is-saving="isSaving"
      :accounts="openAccounts"
      :category-options="categoryOptions"
      :transfer-targets="transferTargets"
      :currency-conversion-info="transferCurrencyInfo"
      @close="closeForm"
      @submit="handleSave"
    />

    <!-- Delete Confirmation -->
    <ConfirmationDialog
      v-model:open="openDeleteDialog"
      title="Delete Transaction"
      :message="deletePrompt"
      confirm-label="Delete"
      confirm-variant="danger"
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { PlusIcon } from '@heroicons/vue/24/outline';
import { useTransactionsStore } from '../stores/transactions';
import { useAccountsStore } from '../stores/accounts';
import { useCategoriesStore } from '../stores/categories';
import { useCurrencyStore } from '../stores/currency';
import { useHouseholdStore } from '../stores/household';
import { useMonthClosuresStore } from '../stores/monthClosures';
import { useTransactionHelpers } from '../composables/useTransactionHelpers';
import { coerceDateKey, getDateOrFallback, toDateKey, toMonthKey } from '../utils/dates';
import TransactionFilters from '../components/transactions/TransactionFilters.vue';
import TransactionList from '../components/transactions/TransactionList.vue';
import TransactionFormDialog from '../components/transactions/TransactionFormDialog.vue';
import ConfirmationDialog from '../components/ConfirmationDialog.vue';

// Router
const route = useRoute();
const router = useRouter();

// Initialize stores
const transactionsStore = useTransactionsStore();
const accountsStore = useAccountsStore();
const categoriesStore = useCategoriesStore();
const currencyStore = useCurrencyStore();
const householdStore = useHouseholdStore();
const monthClosuresStore = useMonthClosuresStore();

if (!householdStore.initialized) {
  householdStore.init();
}
if (!monthClosuresStore.initialized) {
  monthClosuresStore.init();
}

// Use helper composable
const {
  getTransactionTitle,
  getTransactionIcon,
  getTransactionBgClass,
  getTypeBadgeClass,
  getTransactionTextClass,
  formatTransactionAmount
} = useTransactionHelpers();

// Search and filters
const searchQuery = ref('');
const filters = ref({
  accountId: '',
  categoryId: '',
  type: '',
  excludeMode: 'all'
});

// Form state
const openForm = ref(false);
const isSaving = ref(false);
const editingTransaction = ref(null);
const form = ref({
  accountId: '',
  type: 'debit',
  amount: 0,
  date: toDateKey(new Date()),
  categoryId: '',
  counterpartyAccountId: '',
  note: '',
  excludeFromInsights: false
});

// Delete state
const openDeleteDialog = ref(false);
const transactionToDelete = ref(null);

// Computed properties
const openAccounts = computed(() => 
  accountsStore.visibleSortedAccounts?.filter((acc) => !acc.isClosed) || []
);

const canRecord = computed(() => openAccounts.value.length > 0);
const canCreateTransactions = computed(() => canRecord.value && householdStore.canEditFinancialData);
const createButtonTitle = computed(() => {
  if (!canRecord.value) return 'Add an active account first';
  if (!householdStore.canEditFinancialData) return 'Your role does not allow editing transactions';
  return 'Add new transaction';
});
const closedMonthLabels = computed(() =>
  Array.from(monthClosuresStore.closedMonthKeys)
    .sort()
    .reverse()
    .slice(0, 6)
);

const incomeCategories = computed(() => 
  categoriesStore.categories?.filter(c => c.type === 'income') || []
);

const expenseCategories = computed(() => 
  categoriesStore.categories?.filter(c => c.type === 'expense') || []
);

const categoryOptions = computed(() => {
  const categories = form.value.type === 'credit' ? incomeCategories.value : expenseCategories.value;
  return categories.map(cat => ({
    id: cat.id,
    name: cat.name,
    icon: cat.icon,
    excludeByDefault: Boolean(cat.excludeByDefault)
  }));
});

const transferTargets = computed(() => 
  openAccounts.value.filter(acc => acc.id !== form.value.accountId)
);

// Currency conversion info for transfers
const transferCurrencyInfo = computed(() => {
  if (form.value.type !== 'transfer' || !form.value.accountId || !form.value.counterpartyAccountId || !form.value.amount) {
    return null;
  }
  
  const sourceAccount = accountsStore.visibleAccountById(form.value.accountId);
  const destAccount = accountsStore.visibleAccountById(form.value.counterpartyAccountId);
  
  if (!sourceAccount || !destAccount) return null;
  
  const sourceCurrency = sourceAccount.currency;
  const destCurrency = destAccount.currency;
  
  if (sourceCurrency === destCurrency) return null;
  
  const converted = currencyStore.convertAmount(form.value.amount, sourceCurrency, destCurrency, {
    requestIfMissing: true
  });
  
  if (converted === null) {
    return {
      warning: true,
      message: `⚠️ Currency conversion rate not available. Transfer will use same amount for both accounts.`
    };
  }
  
  const sourceFormatted = currencyStore.formatCurrency(form.value.amount, sourceCurrency);
  const destFormatted = currencyStore.formatCurrency(converted, destCurrency);
  
  return {
    warning: false,
    message: `${sourceFormatted} will be converted to ${destFormatted}`
  };
});

function transactionDate(transaction) {
  const key = coerceDateKey(
    transaction?.occurredOn ?? transaction?.occurredAt ?? transaction?.createdAt,
    toDateKey(new Date())
  );
  return getDateOrFallback(key, new Date());
}

// Filter transactions based on search and filters
const filteredTransactions = computed(() => {
  // Start with all transactions
  const visibleAccountIds = new Set((accountsStore.visibleAccounts ?? []).map((account) => account.id));
  let result = transactionsStore.transactions.filter((tx) => visibleAccountIds.has(tx.accountId));

  // Apply account filter
  if (filters.value.accountId) {
    result = result.filter(tx => tx.accountId === filters.value.accountId);
  }

  // Apply category filter
  if (filters.value.categoryId) {
    result = result.filter(tx => tx.categoryId === filters.value.categoryId);
  }

  // Type filter
  if (filters.value.type) {
    result = result.filter(tx => tx.type === filters.value.type);
  }

  if (filters.value.excludeMode === 'included') {
    result = result.filter((tx) => !tx.excludeFromInsights);
  } else if (filters.value.excludeMode === 'excluded') {
    result = result.filter((tx) => tx.excludeFromInsights);
  }

  // Search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(tx => {
      const note = tx.note?.toLowerCase() || '';
      const category = tx.categoryId 
        ? categoriesStore.categories?.find(c => c.id === tx.categoryId)?.name.toLowerCase() || ''
        : '';
      const account = accountsStore.visibleAccountById(tx.accountId)?.name.toLowerCase() || '';
      const amount = tx.amount.toString();
      
      return note.includes(query) || 
             category.includes(query) || 
             account.includes(query) || 
             amount.includes(query);
    });
  }

  // Sort by date (most recent first)
  return result.sort((a, b) => transactionDate(b).getTime() - transactionDate(a).getTime());
});

// Transaction summaries with formatted data
const transactionSummaries = computed(() => {
  return filteredTransactions.value.map(tx => {
    const amountData = formatTransactionAmount(tx);
    const account = accountsStore.visibleAccountById(tx.accountId);
    const monthKey = toMonthKey(transactionDate(tx));
    const isLockedMonth = monthClosuresStore.isMonthClosed(monthKey);
    const canMutate = householdStore.canEditFinancialData && !isLockedMonth;
    const disabledReason = !householdStore.canEditFinancialData
      ? 'Your role is read-only.'
      : 'This transaction belongs to a closed month.';
    
    return {
      transaction: tx,
      title: getTransactionTitle(tx),
      icon: getTransactionIcon(tx),
      accountName: account?.name ?? 'Unknown',
      formattedAmount: amountData.formatted,
      formattedBase: amountData.formattedBase,
      isPending: amountData.pending,
      bgClass: getTransactionBgClass(tx),
      badgeClass: getTypeBadgeClass(tx.type),
      textClass: getTransactionTextClass(tx),
      isLockedMonth,
      canEdit: canMutate,
      canDelete: canMutate,
      disabledReason
    };
  });
});

// Group transactions by date
const groupedTransactions = computed(() => {
  const groups = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groupMap = {
    today: { dateLabel: 'Today', transactions: [] },
    yesterday: { dateLabel: 'Yesterday', transactions: [] },
    thisWeek: { dateLabel: 'This Week', transactions: [] },
    older: { dateLabel: 'Older', transactions: [] }
  };

  transactionSummaries.value.forEach(item => {
    const txDate = transactionDate(item.transaction);
    txDate.setHours(0, 0, 0, 0);
    const txTime = txDate.getTime();

    if (txTime === today.getTime()) {
      groupMap.today.transactions.push(item);
    } else if (txTime === yesterday.getTime()) {
      groupMap.yesterday.transactions.push(item);
    } else if (txTime >= weekAgo.getTime()) {
      groupMap.thisWeek.transactions.push(item);
    } else {
      groupMap.older.transactions.push(item);
    }
  });

  // Add non-empty groups to result
  if (groupMap.today.transactions.length > 0) groups.push(groupMap.today);
  if (groupMap.yesterday.transactions.length > 0) groups.push(groupMap.yesterday);
  if (groupMap.thisWeek.transactions.length > 0) groups.push(groupMap.thisWeek);
  if (groupMap.older.transactions.length > 0) groups.push(groupMap.older);

  return groups;
});

const emptyStateMessage = computed(() => {
  if (
    searchQuery.value ||
    filters.value.accountId ||
    filters.value.categoryId ||
    filters.value.type ||
    filters.value.excludeMode !== 'all'
  ) {
    return 'Try adjusting your filters or search term';
  }
  return 'Start by adding your first transaction';
});

const deletePrompt = computed(() => {
  if (!transactionToDelete.value) return '';
  const tx = transactionToDelete.value;
  const title = getTransactionTitle(tx);
  const account = accountsStore.visibleAccountById(tx.accountId);
  // FIX: Use currencyStore.formatCurrency instead of accountsStore.formatCurrency
  const formatted = account 
    ? currencyStore.formatCurrency(tx.amount, account.currency) 
    : tx.amount.toFixed(2);
  return `Are you sure you want to delete "${title}" (${formatted})?`;
});

// Flag to prevent watchers from firing during form initialization
const isInitializingForm = ref(false);

// Watchers - only clear fields when user changes type manually (not during form init)
watch(() => form.value.type, (newType, oldType) => {
  // Skip if we're initializing the form
  if (isInitializingForm.value) {
    return;
  }
  
  // Skip if there's no old value (shouldn't happen after init flag, but safety check)
  if (oldType === undefined) {
    return;
  }
  
  // Only clear when type actually changes
  form.value.categoryId = '';
  form.value.counterpartyAccountId = '';
  if (newType === 'transfer') {
    form.value.excludeFromInsights = false;
  }
});

watch(() => form.value.accountId, (newAccountId, oldAccountId) => {
  // Skip if we're initializing the form
  if (isInitializingForm.value) {
    return;
  }
  
  // Skip if no old value
  if (oldAccountId === undefined) {
    return;
  }
  
  if (form.value.type === 'transfer') {
    form.value.counterpartyAccountId = '';
  }
});

watch(() => form.value.categoryId, (categoryId) => {
  if (isInitializingForm.value) {
    return;
  }
  if (!categoryId || form.value.type === 'transfer') {
    return;
  }
  const category = categoriesStore.byId(categoryId);
  if (category) {
    form.value.excludeFromInsights = Boolean(category.excludeByDefault);
  }
});

// Form functions
function openTransactionForm(transaction = null, overrides = {}) {
  if (!householdStore.canEditFinancialData) {
    alert('Your role does not allow editing transactions.');
    return;
  }
  if (transaction) {
    const transactionMonth = toMonthKey(transactionDate(transaction));
    if (monthClosuresStore.isMonthClosed(transactionMonth)) {
      alert(`Cannot edit transaction in ${transactionMonth}: this month is closed.`);
      return;
    }
  }
  // Set flag to prevent watchers from clearing fields during initialization
  isInitializingForm.value = true;
  
  if (transaction) {
    // Edit mode
    editingTransaction.value = transaction;
    form.value = {
      accountId: transaction.accountId,
      type: transaction.type,
      amount: transaction.amount,
      date: coerceDateKey(transaction.occurredOn ?? transaction.occurredAt, toDateKey(new Date())),
      categoryId: transaction.categoryId || '',
      counterpartyAccountId: transaction.counterpartyAccountId || '',
      note: transaction.note || '',
      excludeFromInsights: Boolean(transaction.excludeFromInsights)
    };
  } else {
    // Create mode
    editingTransaction.value = null;
    form.value = {
      accountId: openAccounts.value[0]?.id || '',
      type: 'debit',
      amount: 0,
      date: toDateKey(new Date()),
      categoryId: '',
      counterpartyAccountId: '',
      note: '',
      excludeFromInsights: false
    };
  }
  form.value = {
    ...form.value,
    ...overrides
  };
  
  openForm.value = true;
  
  // Re-enable watchers after Vue's next tick (after reactivity has settled)
  nextTick(() => {
    isInitializingForm.value = false;
  });
}

function closeForm() {
  openForm.value = false;
  editingTransaction.value = null;
  isSaving.value = false;
}

async function handleSave() {
  isSaving.value = true;
  
  try {
    if (!householdStore.canEditFinancialData) {
      throw new Error('Your role does not allow editing transactions.');
    }
    // Validation
    if (!form.value.accountId) {
      alert('Please select an account');
      isSaving.value = false;
      return;
    }

    const amount = Number(form.value.amount);
    if (!amount || amount <= 0) {
      alert('Please enter a valid amount greater than zero');
      isSaving.value = false;
      return;
    }

    if (form.value.type === 'transfer') {
      if (!form.value.counterpartyAccountId) {
        alert('Please select a destination account for the transfer');
        isSaving.value = false;
        return;
      }
      if (form.value.counterpartyAccountId === form.value.accountId) {
        alert('Cannot transfer to the same account');
        isSaving.value = false;
        return;
      }
    } else {
      // Credit or Debit requires category
      if (!form.value.categoryId) {
        alert('Please select a category');
        isSaving.value = false;
        return;
      }
    }

    const transactionData = {
      type: form.value.type,
      accountId: form.value.accountId,
      amount: amount,
      occurredAt: form.value.date,
      note: form.value.note,
      excludeFromInsights: Boolean(form.value.excludeFromInsights)
    };

    const draftMonth = toMonthKey(form.value.date);
    if (monthClosuresStore.isMonthClosed(draftMonth)) {
      throw new Error(`Cannot save transaction for ${draftMonth}: this month is closed.`);
    }

    if (form.value.type === 'transfer') {
      transactionData.counterpartyAccountId = form.value.counterpartyAccountId;
    } else {
      transactionData.categoryId = form.value.categoryId;
    }

    if (editingTransaction.value) {
      // Update existing transaction
      await transactionsStore.updateTransaction(editingTransaction.value.id, transactionData);
    } else {
      // Create new transaction
      await transactionsStore.addTransaction(transactionData);
    }

    closeForm();
  } catch (error) {
    console.error('Failed to save transaction:', error);
    alert(error.message || 'Failed to save transaction. Please try again.');
  } finally {
    isSaving.value = false;
  }
}

// Delete functions
function requestDelete(transaction) {
  if (!householdStore.canEditFinancialData) {
    alert('Your role does not allow deleting transactions.');
    return;
  }
  const transactionMonth = toMonthKey(transactionDate(transaction));
  if (monthClosuresStore.isMonthClosed(transactionMonth)) {
    alert(`Cannot delete transaction in ${transactionMonth}: this month is closed.`);
    return;
  }
  transactionToDelete.value = transaction;
  openDeleteDialog.value = true;
}

async function confirmDelete() {
  if (!transactionToDelete.value) return;
  
  try {
    await transactionsStore.deleteTransaction(transactionToDelete.value.id);
    transactionToDelete.value = null;
  } catch (error) {
    console.error('Failed to delete transaction:', error);
    alert('Failed to delete transaction. Please try again.');
  }
}

// Handle PWA shortcuts on mount
onMounted(() => {
  const quickAction = route.query.quick;
  if (quickAction && canCreateTransactions.value) {
    console.log('[PWA Shortcut] Detected quick action:', quickAction);
    
    // Set the transaction type based on shortcut
    if (['debit', 'credit', 'transfer'].includes(quickAction)) {
      openTransactionForm(null, { type: quickAction });
      
      // Clean URL after opening form
      router.replace({ query: {} });
    }
  }
});
</script>
