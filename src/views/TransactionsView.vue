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
        :disabled="!canRecord" 
        :title="canRecord ? 'Add new transaction' : 'Add an active account first'" 
        @click="openTransactionForm()"
      >
        <PlusIcon class="h-5 w-5" />
        <span>New Transaction</span>
      </button>
    </header>

    <!-- Filters -->
    <TransactionFilters
      v-model:search="searchQuery"
      v-model:filters="filters"
      :accounts="accountsStore.sortedAccounts || []"
      :categories="categoriesStore.categories || []"
    />

    <!-- Transactions List -->
    <TransactionList
      :grouped-transactions="groupedTransactions"
      :empty-message="emptyStateMessage"
      :can-add-transaction="canRecord"
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
import { useTransactionHelpers } from '../composables/useTransactionHelpers';
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

// Use helper composable
const {
  getTransactionTitle,
  getTransactionIcon,
  getTransactionBgClass,
  getTypeBadgeClass,
  getTransactionTextClass,
  formatTime,
  formatTransactionAmount
} = useTransactionHelpers();

// Search and filters
const searchQuery = ref('');
const filters = ref({
  accountId: '',
  categoryId: '',
  type: ''
});

// Form state
const openForm = ref(false);
const isSaving = ref(false);
const editingTransaction = ref(null);
const form = ref({
  accountId: '',
  type: 'debit',
  amount: 0,
  date: new Date().toISOString().split('T')[0],
  categoryId: '',
  counterpartyAccountId: '',
  note: ''
});

// Delete state
const openDeleteDialog = ref(false);
const transactionToDelete = ref(null);

// Computed properties
const openAccounts = computed(() => 
  accountsStore.sortedAccounts?.filter(acc => !acc.closed) || []
);

const canRecord = computed(() => openAccounts.value.length > 0);

const incomeCategories = computed(() => 
  categoriesStore.categories?.filter(c => c.type === 'income') || []
);

const expenseCategories = computed(() => 
  categoriesStore.categories?.filter(c => c.type === 'expense') || []
);

const categoryOptions = computed(() => {
  const categories = form.value.type === 'credit' ? incomeCategories.value : expenseCategories.value;
  return categories.map(cat => ({ id: cat.id, name: cat.name, icon: cat.icon }));
});

const transferTargets = computed(() => 
  openAccounts.value.filter(acc => acc.id !== form.value.accountId)
);

// Currency conversion info for transfers
const transferCurrencyInfo = computed(() => {
  if (form.value.type !== 'transfer' || !form.value.accountId || !form.value.counterpartyAccountId || !form.value.amount) {
    return null;
  }
  
  const sourceAccount = accountsStore.accountById(form.value.accountId);
  const destAccount = accountsStore.accountById(form.value.counterpartyAccountId);
  
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

// Filter transactions based on search and filters
const filteredTransactions = computed(() => {
  // Start with all transactions
  let result = [...transactionsStore.transactions];

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

  // Search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(tx => {
      const note = tx.note?.toLowerCase() || '';
      const category = tx.categoryId 
        ? categoriesStore.categories?.find(c => c.id === tx.categoryId)?.name.toLowerCase() || ''
        : '';
      const account = accountsStore.accountById(tx.accountId)?.name.toLowerCase() || '';
      const amount = tx.amount.toString();
      
      return note.includes(query) || 
             category.includes(query) || 
             account.includes(query) || 
             amount.includes(query);
    });
  }

  // Sort by date (most recent first)
  return result.sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
});

// Transaction summaries with formatted data
const transactionSummaries = computed(() => {
  return filteredTransactions.value.map(tx => {
    const amountData = formatTransactionAmount(tx);
    const account = accountsStore.accountById(tx.accountId);
    
    return {
      transaction: tx,
      title: getTransactionTitle(tx),
      icon: getTransactionIcon(tx),
      accountName: account?.name ?? 'Unknown',
      time: formatTime(tx.occurredAt),
      formattedAmount: amountData.formatted,
      formattedBase: amountData.formattedBase,
      isPending: amountData.pending,
      bgClass: getTransactionBgClass(tx),
      badgeClass: getTypeBadgeClass(tx.type),
      textClass: getTransactionTextClass(tx)
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
    const txDate = new Date(item.transaction.occurredAt);
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
  if (searchQuery.value || filters.value.accountId || filters.value.categoryId || filters.value.type) {
    return 'Try adjusting your filters or search term';
  }
  return 'Start by adding your first transaction';
});

const deletePrompt = computed(() => {
  if (!transactionToDelete.value) return '';
  const tx = transactionToDelete.value;
  const title = getTransactionTitle(tx);
  const account = accountsStore.accountById(tx.accountId);
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

// Form functions
function openTransactionForm(transaction = null) {
  // Set flag to prevent watchers from clearing fields during initialization
  isInitializingForm.value = true;
  
  if (transaction) {
    // Edit mode
    editingTransaction.value = transaction;
    form.value = {
      accountId: transaction.accountId,
      type: transaction.type,
      amount: transaction.amount,
      date: new Date(transaction.occurredAt).toISOString().split('T')[0],
      categoryId: transaction.categoryId || '',
      counterpartyAccountId: transaction.counterpartyAccountId || '',
      note: transaction.note || ''
    };
  } else {
    // Create mode
    editingTransaction.value = null;
    form.value = {
      accountId: openAccounts.value[0]?.id || '',
      type: 'debit',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      categoryId: '',
      counterpartyAccountId: '',
      note: ''
    };
  }
  
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
      occurredAt: new Date(form.value.date).toISOString(),
      note: form.value.note
    };

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
  if (quickAction && openAccounts.value.length > 0) {
    console.log('[PWA Shortcut] Detected quick action:', quickAction);
    
    // Set the transaction type based on shortcut
    if (['debit', 'credit', 'transfer'].includes(quickAction)) {
      form.value.type = quickAction;
      openTransactionForm();
      
      // Clean URL after opening form
      router.replace({ query: {} });
    }
  }
});
</script>
