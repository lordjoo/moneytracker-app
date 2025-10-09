<template>
  <div class="space-y-6">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Transactions</h1>
        <p class="text-sm opacity-70">Track credits, debits and transfers between accounts.</p>
      </div>
      <button class="btn btn-primary" :disabled="!canRecord" :title="canRecord ? '' : 'Add an active account first'" @click="openForm = true">
        {{ canRecord ? 'Record transaction' : 'No active accounts' }}
      </button>
    </header>

    <section class="flex flex-col gap-3 sm:flex-row">
      <label class="form-control w-full sm:w-48">
        <span class="label-text">Account</span>
        <select v-model="filters.accountId" class="select select-bordered">
          <option value="">All accounts</option>
          <option v-for="account in accountsStore.sortedAccounts" :key="account.id" :value="account.id">
            {{ account.name }}{{ account.isClosed ? ' (Closed)' : '' }}
          </option>
        </select>
      </label>
      <label class="form-control w-full sm:w-48">
        <span class="label-text">Category</span>
        <select v-model="filters.categoryId" class="select select-bordered">
          <option value="">All categories</option>
          <option v-for="category in categoriesStore.categories" :key="category.id" :value="category.id">
            {{ category.name }}
          </option>
        </select>
      </label>
    </section>

    <section class="card bg-base-100 shadow">
      <div class="card-body">
        <h2 class="card-title">History</h2>
        <div class="divide-y divide-base-300">
          <article
            v-for="item in transactionSummaries"
            :key="item.tx.id"
            class="flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="space-y-1">
              <div class="flex items-center gap-2 font-medium">
                <CategoryIcon :icon="transactionIcon(item.tx)" class="h-6 w-6" />
                <span>{{ renderTransactionTitle(item.tx) }}</span>
              </div>
              <p class="opacity-60">
                {{ formatDate(item.tx.occurredAt) }} · {{ accountsStore.accountById(item.tx.accountId)?.name ?? 'Unknown account' }}
              </p>
              <p class="text-xs opacity-60" v-if="item.tx.note">{{ item.tx.note }}</p>
            </div>
            <div class="flex items-center gap-3 text-sm">
              <span class="badge badge-outline">{{ item.tx.type }}</span>
              <div class="text-right">
                <span :class="txClass(item.tx)">{{ item.formattedAccount }}</span>
                <p v-if="item.formattedBase" class="text-xs opacity-60">≈ {{ item.formattedBase }}</p>
                <p v-else-if="item.pending" class="text-xs opacity-60">Conversion pending…</p>
              </div>
              <button
                class="btn btn-ghost btn-xs text-error"
                :title="`Delete ${renderTransactionTitle(item.tx)}`"
                @click="requestDelete(item.tx)"
              >
                <TrashIcon class="h-4 w-4" />
              </button>
            </div>
          </article>
          <p v-if="!transactionSummaries.length" class="py-4 text-sm opacity-60">No transactions yet.</p>
        </div>
      </div>
    </section>

    <TransitionRoot appear :show="openForm" as="template">
      <Dialog as="div" class="relative z-50" @close="openForm = false">
        <TransitionChild as="template" enter="ease-out duration-200" enter-from="opacity-0" enter-to="opacity-100" leave="ease-in duration-150" leave-from="opacity-100" leave-to="opacity-0">
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
                <DialogTitle class="text-lg font-semibold">Record transaction</DialogTitle>
                <form class="mt-4 space-y-4" @submit.prevent="handleSave">
                  <label class="form-control w-full">
                    <span class="label-text">Account</span>
                    <select v-model="form.accountId" class="select select-bordered" :disabled="!openAccounts.length" required>
                      <option disabled value="">Select account</option>
                      <option v-for="account in openAccounts" :key="account.id" :value="account.id">
                        {{ account.name }}
                      </option>
                    </select>
                    <span v-if="!openAccounts.length" class="label-text-alt text-warning">
                      Close this dialog once an account is reopened or created.
                    </span>
                  </label>
                  <label class="form-control w-full">
                    <span class="label-text">Type</span>
                    <select v-model="form.type" class="select select-bordered" required>
                      <option value="credit">Credit (money in)</option>
                      <option value="debit">Debit (money out)</option>
                      <option value="transfer">Transfer</option>
                    </select>
                  </label>
                  <label class="form-control w-full">
                    <span class="label-text">Amount</span>
                    <input v-model.number="form.amount" type="number" min="0" step="0.01" class="input input-bordered" required />
                  </label>
                  <label class="form-control w-full">
                    <span class="label-text">Date</span>
                    <input v-model="form.date" type="date" class="input input-bordered" required />
                  </label>
                  <label class="form-control w-full" v-if="form.type !== 'transfer'">
                    <span class="label-text">Category</span>
                    <select v-model="form.categoryId" class="select select-bordered" required>
                      <option disabled value="">Select a category</option>
                      <optgroup label="Income" v-if="incomeCategories.length">
                        <option v-for="cat in incomeCategories" :key="cat.id" :value="cat.id" v-if="form.type === 'credit'">
                          {{ cat.name }}
                        </option>
                      </optgroup>
                      <optgroup label="Expenses" v-if="expenseCategories.length">
                        <option v-for="cat in expenseCategories" :key="cat.id" :value="cat.id" v-if="form.type === 'debit'">
                          {{ cat.name }}
                        </option>
                      </optgroup>
                    </select>
                  </label>
                  <label class="form-control w-full" v-else>
                    <span class="label-text">Transfer to</span>
                    <select v-model="form.counterpartyAccountId" class="select select-bordered" required>
                      <option disabled value="">Select destination account</option>
                      <option v-for="account in transferTargets" :key="account.id" :value="account.id">
                        {{ account.name }}
                      </option>
                    </select>
                  </label>
                  <label class="form-control w-full">
                    <span class="label-text">Note</span>
                    <textarea v-model="form.note" class="textarea textarea-bordered" rows="2" placeholder="Optional"></textarea>
                  </label>
                  <div class="flex justify-end gap-2 pt-2">
                    <button type="button" class="btn btn-ghost" @click="openForm = false">Cancel</button>
                    <button type="submit" class="btn btn-primary" :class="{ loading: isSaving }">Save</button>
                  </div>
                </form>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>

    <ConfirmationDialog
      v-model:open="openDeleteDialog"
      title="Delete transaction"
      :message="deletePrompt"
      confirm-label="Delete"
      confirm-variant="danger"
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { useRoute, useRouter } from 'vue-router';
import CategoryIcon from '@/components/CategoryIcon.vue';
import { useAccountsStore } from '@/stores/accounts';
import { useTransactionsStore } from '@/stores/transactions';
import { useCategoriesStore } from '@/stores/categories';
import { useCurrencyStore } from '@/stores/currency';
import ConfirmationDialog from '@/components/ConfirmationDialog.vue';
import { TrashIcon } from '@heroicons/vue/24/outline';

const route = useRoute();
const router = useRouter();
const accountsStore = useAccountsStore();
const transactionsStore = useTransactionsStore();
const categoriesStore = useCategoriesStore();
const currencyStore = useCurrencyStore();

if (!accountsStore.initialized) {
  accountsStore.init();
}
if (!transactionsStore.initialized) {
  transactionsStore.init();
}
if (!categoriesStore.initialized) {
  categoriesStore.init();
}

const filters = reactive({
  accountId: '',
  categoryId: ''
});

const openForm = ref(false);
const isSaving = ref(false);
const form = reactive({
  accountId: '',
  type: 'debit',
  amount: 0,
  date: new Date().toISOString().slice(0, 10),
  categoryId: '',
  counterpartyAccountId: '',
  note: ''
});
const openDeleteDialog = ref(false);
const transactionToDelete = ref(null);
const deletePrompt = computed(() => {
  if (!transactionToDelete.value) return '';
  const title = renderTransactionTitle(transactionToDelete.value);
  const summary = describeTransactionAmount(transactionToDelete.value);
  const amountLabel = summary.formattedAccount;
  return `Delete "${title}" (${amountLabel})? This action cannot be undone.`;
});

watch(
  () => form.type,
  (next) => {
    form.categoryId = '';
    if (next !== 'transfer') {
      form.counterpartyAccountId = '';
    }
  }
);

watch(
  () => filters.accountId,
  (value) => transactionsStore.setFilter('accountId', value || null)
);
watch(
  () => filters.categoryId,
  (value) => transactionsStore.setFilter('categoryId', value || null)
);

watch(
  () => form.accountId,
  () => {
    form.counterpartyAccountId = '';
  }
);

const filteredTransactions = computed(() => {
  const base = transactionsStore.filteredTransactions;
  return base.filter((tx) => {
    const account = accountsStore.accountById(tx.accountId);
    if (!account) return false;
    if (account.isClosed && (!filters.accountId || filters.accountId !== account.id)) {
      return false;
    }
    return true;
  });
});
const transactionSummaries = computed(() =>
  filteredTransactions.value.map((tx) => ({
    tx,
    ...describeTransactionAmount(tx)
  }))
);
const expenseCategories = computed(() => categoriesStore.expenseCategories);
const incomeCategories = computed(() => categoriesStore.incomeCategories);
const openAccounts = computed(() => accountsStore.openAccounts);
const canRecord = computed(() => openAccounts.value.length > 0);
const transferTargets = computed(() =>
  openAccounts.value.filter((account) => account.id !== form.accountId)
);

watch(
  openAccounts,
  (accounts) => {
    if (!accounts.length) {
      form.accountId = '';
      return;
    }
    if (!accounts.some((account) => account.id === form.accountId)) {
      form.accountId = accounts[0].id;
    }
  },
  { immediate: true }
);

watch(openDeleteDialog, (isOpen) => {
  if (!isOpen) {
    transactionToDelete.value = null;
  }
});

watch(
  () => route.query.quick,
  (value) => {
    if (!value) return;
    const allowed = ['debit', 'credit', 'transfer'];
    const initial = String(value).toLowerCase();
    if (!allowed.includes(initial)) {
      return;
    }
    form.type = initial;
    if (initial === 'transfer') {
      form.categoryId = '';
    }
    openForm.value = true;
    const nextQuery = { ...route.query };
    delete nextQuery.quick;
    router.replace({ path: route.path, query: nextQuery, hash: route.hash });
  },
  { immediate: true }
);

function formatCurrency(value, currency = currencyStore.mainCurrency.value) {
  return currencyStore.formatCurrency(value, currency);
}

function describeTransactionAmount(tx) {
  const account = accountsStore.accountById(tx.accountId);
  const amount = Number(tx.amount) || 0;
  const sign = txSign(tx);
  const accountCurrency = account?.currency || currencyStore.mainCurrency.value;
  const converted = currencyStore.convertAmount(amount, accountCurrency, currencyStore.mainCurrency.value, {
    requestIfMissing: true
  });
  const pending = accountCurrency !== currencyStore.mainCurrency.value && converted === null;
  const formattedAccount = formatCurrency(sign * amount, accountCurrency);
  const formattedBase =
    accountCurrency !== currencyStore.mainCurrency.value && !pending
      ? formatCurrency(sign * converted)
      : null;
  return {
    formattedAccount,
    formattedBase,
    pending
  };
}

function formatDate(date) {
  return date ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date) : 'Unknown date';
}

function renderTransactionTitle(tx) {
  if (tx.type === 'transfer') {
    return `${tx.direction === 'outgoing' ? 'Transfer to' : 'Transfer from'} ${accountsStore.accountById(tx.counterpartyAccountId)?.name ?? 'Account'}`;
  }
  const category = categoriesStore.byId(tx.categoryId);
  return category?.name ?? 'Uncategorized';
}

function txSign(tx) {
  if (tx.type === 'debit' || (tx.type === 'transfer' && tx.direction === 'outgoing')) return -1;
  return 1;
}

function txClass(tx) {
  return txSign(tx) > 0 ? 'text-success font-medium' : 'text-error font-medium';
}

function transactionIcon(tx) {
  if (tx.type === 'transfer') {
    return categoriesStore.byId(tx.categoryId)?.icon ?? 'banknotes';
  }
  return categoriesStore.byId(tx.categoryId)?.icon ?? '';
}

async function handleSave() {
  if (!form.accountId) {
    alert('Select an active account before recording transactions.');
    return;
  }
  try {
    isSaving.value = true;
    const payload = {
      type: form.type,
      accountId: form.accountId,
      amount: form.amount,
      note: form.note,
      occurredAt: new Date(form.date)
    };
    if (form.type === 'transfer') {
      payload.counterpartyAccountId = form.counterpartyAccountId;
    } else {
      payload.categoryId = form.categoryId;
    }
    await transactionsStore.addTransaction(payload);
    openForm.value = false;
    Object.assign(form, {
      accountId: '',
      type: 'debit',
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
      categoryId: '',
      counterpartyAccountId: '',
      note: ''
    });
  } catch (error) {
    console.error(error);
    alert(error.message ?? 'Failed to save transaction');
  } finally {
    isSaving.value = false;
  }
}

function requestDelete(tx) {
  transactionToDelete.value = tx;
  openDeleteDialog.value = true;
}

function confirmDelete() {
  if (!transactionToDelete.value) return;
  try {
    transactionsStore.deleteTransaction(transactionToDelete.value.id);
  } catch (error) {
    console.error(error);
    alert(error.message ?? 'Failed to delete transaction');
  } finally {
    transactionToDelete.value = null;
  }
}
</script>
