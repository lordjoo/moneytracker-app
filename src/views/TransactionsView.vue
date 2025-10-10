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

    <!-- Quick Filters and Search -->
    <section class="card bg-base-100 shadow">
      <div class="card-body p-5">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <!-- Search -->
          <div class="flex-1 max-w-md">
            <label class="form-control w-full">
              <div class="label pb-2">
                <span class="label-text text-xs font-medium">Search</span>
              </div>
              <div class="relative">
                <MagnifyingGlassIcon class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
                <input 
                  v-model="searchQuery" 
                  type="text" 
                  placeholder="Search transactions..." 
                  class="input input-bordered input-sm w-full pl-9"
                />
              </div>
            </label>
          </div>

          <!-- Filters -->
          <div class="flex flex-wrap gap-3">
            <label class="form-control w-40">
              <div class="label pb-2">
                <span class="label-text text-xs font-medium">Account</span>
              </div>
              <select v-model="filters.accountId" class="select select-bordered select-sm">
                <option value="">All</option>
                <option v-for="account in accountsStore.sortedAccounts || []" :key="account.id" :value="account.id">
                  {{ account.name }}
                </option>
              </select>
            </label>
            <label class="form-control w-40">
              <div class="label pb-2">
                <span class="label-text text-xs font-medium">Category</span>
              </div>
              <select v-model="filters.categoryId" class="select select-bordered select-sm">
                <option value="">All</option>
                <option v-for="category in categoriesStore.categories || []" :key="category.id" :value="category.id">
                  {{ category.name }}
                </option>
              </select>
            </label>
            <label class="form-control w-32">
              <div class="label pb-2">
                <span class="label-text text-xs font-medium">Type</span>
              </div>
              <select v-model="filters.type" class="select select-bordered select-sm">
                <option value="">All</option>
                <option value="credit">Credit</option>
                <option value="debit">Debit</option>
                <option value="transfer">Transfer</option>
              </select>
            </label>
          </div>
        </div>
      </div>
    </section>

    <!-- Transactions List -->
    <div v-if="groupedTransactions.length > 0" class="space-y-4">
      <div v-for="group in groupedTransactions" :key="group.date" class="space-y-2">
        <!-- Date Header -->
        <div class="flex items-center gap-3">
          <h3 class="text-sm font-semibold opacity-70">{{ group.dateLabel }}</h3>
          <div class="flex-1 h-px bg-base-300"></div>
          <span class="text-xs opacity-50">{{ group.transactions.length }} transaction{{ group.transactions.length !== 1 ? 's' : '' }}</span>
        </div>

        <!-- Transaction Cards -->
        <div class="space-y-2">
          <article
            v-for="item in group.transactions"
            :key="item.tx.id"
            class="card bg-base-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <div class="card-body p-4">
              <div class="flex items-start justify-between gap-3">
                <!-- Icon and Details -->
                <div class="flex items-start gap-3 flex-1 min-w-0">
                  <div class="mt-0.5">
                    <div class="p-2 rounded-lg" :class="getTransactionBgClass(item.tx)">
                      <CategoryIcon :icon="transactionIcon(item.tx)" class="h-5 w-5" />
                    </div>
                  </div>
                  <div class="flex-1 min-w-0 space-y-1">
                    <div class="flex items-center gap-2">
                      <h4 class="font-medium truncate">{{ renderTransactionTitle(item.tx) }}</h4>
                      <span class="badge badge-sm" :class="getTypeBadgeClass(item.tx.type)">
                        {{ item.tx.type }}
                      </span>
                    </div>
                    <div class="flex flex-wrap items-center gap-2 text-xs opacity-60">
                      <span class="flex items-center gap-1">
                        <BanknotesIcon class="h-3 w-3" />
                        {{ accountsStore.accountById(item.tx.accountId)?.name ?? 'Unknown' }}
                      </span>
                      <span>·</span>
                      <span class="flex items-center gap-1">
                        <ClockIcon class="h-3 w-3" />
                        {{ formatTime(item.tx.occurredAt) }}
                      </span>
                    </div>
                    <p v-if="item.tx.note" class="text-sm opacity-70 line-clamp-2">{{ item.tx.note }}</p>
                  </div>
                </div>

                <!-- Amount and Actions -->
                <div class="flex items-start gap-2">
                  <div class="text-right">
                    <p class="font-semibold" :class="txClass(item.tx)">
                      {{ item.formattedAccount }}
                    </p>
                    <p v-if="item.formattedBase" class="text-xs opacity-60">
                      ≈ {{ item.formattedBase }}
                    </p>
                    <p v-else-if="item.pending" class="text-xs opacity-60">
                      Pending...
                    </p>
                  </div>
                  
                  <!-- Actions Dropdown -->
                  <div class="dropdown dropdown-end">
                    <label tabindex="0" class="btn btn-ghost btn-sm btn-square">
                      <EllipsisVerticalIcon class="h-4 w-4" />
                    </label>
                    <ul tabindex="0" class="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-40 border border-base-300 z-10">
                      <li>
                        <button @click="openTransactionForm(item.tx)" class="text-sm gap-2">
                          <PencilIcon class="h-4 w-4" />
                          Edit
                        </button>
                      </li>
                      <li>
                        <button @click="requestDelete(item.tx)" class="text-sm gap-2 text-error hover:bg-error hover:text-error-content">
                          <TrashIcon class="h-4 w-4" />
                          Delete
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="card bg-base-100 shadow">
      <div class="card-body items-center text-center py-12">
        <div class="p-4 rounded-full bg-base-200 mb-4">
          <BanknotesIcon class="h-12 w-12 opacity-50" />
        </div>
        <h3 class="text-lg font-semibold">No transactions found</h3>
        <p class="text-sm opacity-70 max-w-sm">
          {{ searchQuery || filters.accountId || filters.categoryId || filters.type 
            ? 'Try adjusting your filters or search term' 
            : 'Start by adding your first transaction' 
          }}
        </p>
        <button 
          v-if="canRecord" 
          class="btn btn-primary btn-sm gap-2 mt-4" 
          @click="openTransactionForm()"
        >
          <PlusIcon class="h-4 w-4" />
          Add Transaction
        </button>
      </div>
    </div>

    <!-- Transaction Form Dialog -->
    <TransitionRoot appear :show="openForm" as="template">
      <Dialog as="div" class="relative z-50" @close="closeForm">
        <TransitionChild 
          as="template" 
          enter="ease-out duration-200" 
          enter-from="opacity-0" 
          enter-to="opacity-100" 
          leave="ease-in duration-150" 
          leave-from="opacity-100" 
          leave-to="opacity-0"
        >
          <div class="fixed inset-0 bg-base-content/40" />
        </TransitionChild>
        <div class="fixed inset-0 overflow-y-auto">
          <div class="flex min-h-full items-center justify-center px-4 py-8">
            <TransitionChild
              as="template"
              enter="ease-out duration-200"
              enter-from="opacity-0 scale-95"
              enter-to="opacity-100 scale-100"
              leave="ease-in duration-150"
              leave-from="opacity-100 scale-100"
              leave-to="opacity-0 scale-95"
            >
              <DialogPanel class="w-full max-w-lg rounded-2xl bg-base-100 p-6 shadow-xl">
                <DialogTitle class="text-lg font-semibold flex items-center gap-2">
                  {{ editingTransaction ? 'Edit Transaction' : 'New Transaction' }}
                  <span v-if="editingTransaction" class="badge badge-primary badge-sm">Editing</span>
                </DialogTitle>
                <form class="mt-4 space-y-4" @submit.prevent="handleSave">
                  <label class="form-control">
                    <span class="label-text font-medium">Account</span>
                    <select v-model="form.accountId" class="select select-bordered" :disabled="!openAccounts.length" required>
                      <option disabled value="">Select account</option>
                      <option v-for="account in openAccounts || []" :key="account.id" :value="account.id">
                        {{ account.name }}
                      </option>
                    </select>
                  </label>

                  <label class="form-control">
                    <span class="label-text font-medium">Type</span>
                    <select v-model="form.type" class="select select-bordered" required>
                      <option value="credit">Credit (money in)</option>
                      <option value="debit">Debit (money out)</option>
                      <option value="transfer">Transfer</option>
                    </select>
                  </label>

                  <label class="form-control">
                    <span class="label-text font-medium">Amount</span>
                    <input 
                      v-model.number="form.amount" 
                      type="number" 
                      min="0" 
                      step="0.01" 
                      class="input input-bordered" 
                      placeholder="0.00" 
                      required 
                    />
                  </label>

                  <label class="form-control">
                    <span class="label-text font-medium">Date</span>
                    <input v-model="form.date" type="date" class="input input-bordered" required />
                  </label>

                  <label class="form-control" v-if="form.type !== 'transfer'">
                    <span class="label-text font-medium">Category</span>
                    <CategorySelect
                      v-model="form.categoryId"
                      :options="(form.type === 'credit' ? incomeCategories : expenseCategories).map(cat => ({ id: cat.id, name: cat.name, icon: cat.icon }))"
                      placeholder="Search category..."
                      required
                    />
                  </label>

                  <label class="form-control" v-else-if="form.type === 'transfer'">
                    <span class="label-text font-medium">Transfer to</span>
                    <select v-model="form.counterpartyAccountId" class="select select-bordered" required>
                      <option disabled value="">Select destination</option>
                      <option v-for="account in transferTargets || []" :key="account.id" :value="account.id">
                        {{ account.name }}
                      </option>
                    </select>
                  </label>

                  <label class="form-control">
                    <span class="label-text font-medium">Note (optional)</span>
                    <textarea 
                      v-model="form.note" 
                      class="textarea textarea-bordered" 
                      rows="2" 
                      placeholder="Add a note..."
                    ></textarea>
                  </label>

                  <div class="flex justify-end gap-2 pt-2">
                    <button type="button" class="btn btn-ghost" @click="closeForm">Cancel</button>
                    <button type="submit" class="btn btn-primary" :class="{ loading: isSaving }">
                      {{ editingTransaction ? 'Update' : 'Save' }}
                    </button>
                  </div>
                </form>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>

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
import { ref, computed, watch } from 'vue';
import { Dialog, DialogPanel, DialogTitle, TransitionRoot, TransitionChild } from '@headlessui/vue';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  BanknotesIcon,
  ClockIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/vue/24/outline';
import { useTransactionsStore } from '../stores/transactions';
import { useAccountsStore } from '../stores/accounts';
import { useCategoriesStore } from '../stores/categories';
import { useCurrencyStore } from '../stores/currency';
import CategoryIcon from '../components/CategoryIcon.vue';
import CategorySelect from '../components/CategorySelect.vue';
import ConfirmationDialog from '../components/ConfirmationDialog.vue';

// Initialize stores
const transactionsStore = useTransactionsStore();
const accountsStore = useAccountsStore();
const categoriesStore = useCategoriesStore();
const currencyStore = useCurrencyStore();

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

const transferTargets = computed(() => 
  openAccounts.value.filter(acc => acc.id !== form.value.accountId)
);

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

// Transaction summaries with currency conversion
const transactionSummaries = computed(() => {
  return filteredTransactions.value.map(tx => {
    const account = accountsStore.accountById(tx.accountId);
    const amount = Number(tx.amount) || 0;
    
    // Determine sign based on transaction type
    let sign = 1;
    if (tx.type === 'debit' || (tx.type === 'transfer' && tx.direction === 'outgoing')) {
      sign = -1;
    }
    
    if (!account) {
      return {
        tx,
        formattedAccount: `${(sign * amount).toFixed(2)} ???`,
        formattedBase: null,
        pending: false
      };
    }

    const accountCurrency = account.currency || currencyStore.baseCurrency;
    const formatted = currencyStore.formatCurrency(sign * amount, accountCurrency);
    
    if (accountCurrency === currencyStore.baseCurrency) {
      return {
        tx,
        formattedAccount: formatted,
        formattedBase: null,
        pending: false
      };
    }

    const converted = currencyStore.convertAmount(amount, accountCurrency, currencyStore.baseCurrency, {
      requestIfMissing: true
    });
    
    if (converted === null) {
      return {
        tx,
        formattedAccount: formatted,
        formattedBase: null,
        pending: true
      };
    }

    const formattedBase = currencyStore.formatCurrency(sign * converted, currencyStore.baseCurrency);
    
    return {
      tx,
      formattedAccount: formatted,
      formattedBase,
      pending: false
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
    today: { dateLabel: 'Today', transactions: [], date: today.getTime() },
    yesterday: { dateLabel: 'Yesterday', transactions: [], date: yesterday.getTime() },
    thisWeek: { dateLabel: 'This Week', transactions: [], date: weekAgo.getTime() },
    older: { dateLabel: 'Older', transactions: [], date: 0 }
  };

  transactionSummaries.value.forEach(item => {
    const txDate = new Date(item.tx.occurredAt);
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

const deletePrompt = computed(() => {
  if (!transactionToDelete.value) return '';
  const tx = transactionToDelete.value;
  const title = renderTransactionTitle(tx);
  const account = accountsStore.accountById(tx.accountId);
  const formatted = account ? accountsStore.formatCurrency(tx.amount, account.currency) : tx.amount;
  return `Are you sure you want to delete "${title}" (${formatted})?`;
});

// Watchers
watch(() => form.value.type, (newType) => {
  form.value.categoryId = '';
  form.value.counterpartyAccountId = '';
});

watch(() => form.value.accountId, () => {
  if (form.value.type === 'transfer') {
    form.value.counterpartyAccountId = '';
  }
});

// Form functions
function openTransactionForm(transaction = null) {
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
}

function closeForm() {
  openForm.value = false;
  editingTransaction.value = null;
  isSaving.value = false;
}

async function handleSave() {
  isSaving.value = true;
  
  try {
    const transactionData = {
      type: form.value.type,
      accountId: form.value.accountId,
      amount: form.value.amount,
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
    alert('Failed to save transaction. Please try again.');
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

// Helper functions
function renderTransactionTitle(tx) {
  if (tx.type === 'transfer') {
    const counterparty = accountsStore.accountById(tx.counterpartyAccountId);
    return `Transfer to ${counterparty?.name ?? 'Unknown'}`;
  }
  
  const category = categoriesStore.categories?.find(c => c.id === tx.categoryId);
  return category?.name ?? 'Uncategorized';
}

function transactionIcon(tx) {
  if (tx.type === 'transfer') {
    return 'arrows-right-left';
  }
  const category = categoriesStore.categories?.find(c => c.id === tx.categoryId);
  return category?.icon ?? 'question-mark-circle';
}

function getTransactionBgClass(tx) {
  if (tx.type === 'credit') return 'bg-success/10 text-success';
  if (tx.type === 'debit') return 'bg-error/10 text-error';
  return 'bg-info/10 text-info';
}

function getTypeBadgeClass(type) {
  if (type === 'credit') return 'badge-success';
  if (type === 'debit') return 'badge-error';
  return 'badge-info';
}

function txClass(tx) {
  if (tx.type === 'credit') return 'text-success';
  if (tx.type === 'debit') return 'text-error';
  return 'text-info';
}

function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
