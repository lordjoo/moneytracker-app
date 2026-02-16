<template>
  <div v-if="account" class="space-y-6">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-2xl font-semibold">{{ account.name }}</h1>
          <span v-if="account.isClosed" class="badge badge-outline badge-sm">Closed</span>
          <span v-if="account.excludeFromHousehold" class="badge badge-warning badge-sm">Private</span>
        </div>
        <p class="text-sm opacity-70">Cycle day: {{ account.cycleDay ?? 'Not set' }}</p>
        <p class="text-sm opacity-70">Currency: {{ account.currency ?? currencyStore.mainCurrency }}</p>
      </div>
      <div class="flex flex-col items-end gap-1 text-right">
        <span class="text-xs opacity-60">Current balance</span>
        <span class="text-3xl font-semibold">{{ formatCurrency(account.balance) }}</span>
        <p v-if="account.currency !== currencyStore.mainCurrency" class="text-xs opacity-60">
          <span v-if="convertedAccountBalance !== null">
            ≈ {{ formatBaseCurrency(convertedAccountBalance) }}
          </span>
          <span v-else>Conversion pending…</span>
        </p>
        <button class="btn btn-primary btn-sm" :disabled="isClosed || !canEditFinancialData" @click="openTransaction = true">
          {{ isClosed ? 'Account closed' : (canEditFinancialData ? 'Add transaction' : 'Read-only role') }}
        </button>
      </div>
    </header>

    <p v-if="!canEditFinancialData" class="rounded-lg bg-base-100/80 px-4 py-3 text-sm opacity-80">
      Your role is read-only. You can review activity but cannot modify transactions.
    </p>

    <p v-if="isClosed" class="rounded-lg bg-base-100/80 px-4 py-3 text-sm opacity-80">
      This account is closed. You can review history, but new transactions cannot be recorded.
    </p>

    <section class="grid gap-4 sm:grid-cols-3">
      <article class="card bg-base-100 shadow">
        <div class="card-body">
          <p class="text-xs uppercase tracking-wide opacity-60">Inflow this month</p>
          <p class="text-2xl font-semibold text-success">{{ formatCurrency(monthly.inflow) }}</p>
        </div>
      </article>
      <article class="card bg-base-100 shadow">
        <div class="card-body">
          <p class="text-xs uppercase tracking-wide opacity-60">Outflow this month</p>
          <p class="text-2xl font-semibold text-error">{{ formatCurrency(monthly.outflow) }}</p>
        </div>
      </article>
      <article class="card bg-base-100 shadow">
        <div class="card-body">
          <p class="text-xs uppercase tracking-wide opacity-60">Net</p>
          <p :class="monthly.net >= 0 ? 'text-success' : 'text-error'" class="text-2xl font-semibold">
            {{ formatCurrency(monthly.net) }}
          </p>
        </div>
      </article>
    </section>

    <section v-if="!isClosed" class="card bg-base-100 shadow">
      <div class="card-body">
        <h2 class="card-title">Transactions</h2>
        <div class="divide-y divide-base-300">
          <article
            v-for="item in accountTransactionSummaries"
            :key="item.tx.id"
            class="flex items-start justify-between gap-4 py-3 text-sm"
          >
            <div class="flex items-start gap-3">
              <CategoryIcon :icon="transactionIcon(item.tx)" class="h-6 w-6 mt-1" />
              <div>
                <p class="font-medium">{{ renderTransactionTitle(item.tx) }}</p>
                <p class="opacity-60">
                  {{ formatDate(item.tx.occurredAt) }} &middot; {{ item.tx.note || 'No note' }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-3">
                <span class="badge badge-outline">{{ item.tx.type }}</span>
                <span v-if="item.tx.excludeFromInsights" class="badge badge-ghost">Excluded</span>
                <span v-if="item.isLockedMonth" class="badge badge-warning badge-outline">Locked month</span>
              <div class="text-right">
                <span :class="txClass(item.tx)">{{ item.formattedAccount }}</span>
                <p v-if="item.formattedBase" class="text-xs opacity-60">≈ {{ item.formattedBase }}</p>
                <p v-else-if="item.pending" class="text-xs opacity-60">Conversion pending…</p>
              </div>
              <button
                class="btn btn-ghost btn-xs text-error"
                :title="`Delete ${renderTransactionTitle(item.tx)}`"
                :disabled="item.isLockedMonth || !canEditFinancialData"
                @click="requestDelete(item.tx)"
              >
                <TrashIcon class="h-4 w-4" />
              </button>
            </div>
          </article>
          <p v-if="!accountTransactionSummaries.length" class="py-4 text-sm opacity-60">No transactions yet.</p>
        </div>
      </div>
    </section>
    <p v-else class="rounded-lg bg-base-100/80 px-4 py-3 text-sm opacity-80">
      Transactions for closed accounts are hidden. Reopen the account to review history.
    </p>

    <TransitionRoot appear :show="openTransaction && !isClosed" as="template">
      <Dialog as="div" class="relative z-50" @close="openTransaction = false">
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
                <DialogTitle class="text-lg font-semibold">Add transaction</DialogTitle>
                <form class="mt-4 space-y-4" @submit.prevent="handleTransaction">
                  <label class="form-control w-full">
                    <span class="label-text">Type</span>
                    <select v-model="transactionForm.type" class="select select-bordered" required>
                      <option value="credit">Credit (money in)</option>
                      <option value="debit">Debit (money out)</option>
                      <option value="transfer">Transfer</option>
                    </select>
                  </label>
                  <label class="form-control w-full">
                    <span class="label-text">Amount</span>
                    <input v-model.number="transactionForm.amount" type="number" min="0" step="0.01" class="input input-bordered" required />
                  </label>
                  <label class="form-control w-full">
                    <span class="label-text">Date</span>
                    <input v-model="transactionForm.date" type="date" class="input input-bordered" required />
                  </label>
                  <label class="form-control w-full" v-if="transactionForm.type !== 'transfer'">
                    <span class="label-text">Category</span>
                    <select v-model="transactionForm.categoryId" class="select select-bordered" required>
                      <option disabled value="">Select a category</option>
                      <optgroup
                        label="Income"
                        v-if="transactionForm.type === 'credit' && incomeCategories.length"
                      >
                        <option v-for="cat in incomeCategories" :key="cat.id" :value="cat.id">
                          {{ cat.name }}
                        </option>
                      </optgroup>
                      <optgroup
                        label="Expenses"
                        v-else-if="transactionForm.type === 'debit' && expenseCategories.length"
                      >
                        <option v-for="cat in expenseCategories" :key="cat.id" :value="cat.id">
                          {{ cat.name }}
                        </option>
                      </optgroup>
                    </select>
                  </label>
                <label class="form-control w-full" v-else>
                  <span class="label-text">Transfer to</span>
                  <select
                    v-model="transactionForm.counterpartyAccountId"
                    class="select select-bordered"
                    :disabled="!transferTargets.length"
                    required
                  >
                    <option disabled value="">Select destination</option>
                    <option
                      v-for="candidate in transferTargets"
                      :key="candidate.id"
                      :value="candidate.id"
                    >
                      {{ candidate.name }}
                    </option>
                  </select>
                  <span v-if="!transferTargets.length" class="label-text-alt text-warning">No other active accounts available.</span>
                </label>
                  <label class="form-control w-full">
                    <span class="label-text">Note</span>
                    <textarea v-model="transactionForm.note" class="textarea textarea-bordered" rows="2" placeholder="Optional memo"></textarea>
                  </label>
                  <label class="label cursor-pointer justify-start gap-3 rounded-lg border border-base-300 p-3">
                    <input v-model="transactionForm.excludeFromInsights" type="checkbox" class="checkbox checkbox-sm" />
                    <div>
                      <p class="text-sm font-medium">Exclude from insights</p>
                      <p class="text-xs opacity-65">Still affects balance, excluded from reports and budgets.</p>
                    </div>
                  </label>
                  <div class="flex justify-end gap-2 pt-2">
                    <button type="button" class="btn btn-ghost" @click="openTransaction = false">Cancel</button>
                    <button type="submit" class="btn btn-primary" :class="{ loading: isProcessing }">Save</button>
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
  <p v-else class="text-sm opacity-60">Account not found.</p>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { useAccountsStore } from '@/stores/accounts';
import { useTransactionsStore } from '@/stores/transactions';
import { useCategoriesStore } from '@/stores/categories';
import { useCurrencyStore } from '@/stores/currency';
import { useHouseholdStore } from '@/stores/household';
import { useMonthClosuresStore } from '@/stores/monthClosures';
import { coerceDateKey, toDateKey } from '@/utils/dates';
import CategoryIcon from '@/components/CategoryIcon.vue';
import ConfirmationDialog from '@/components/ConfirmationDialog.vue';
import { TrashIcon } from '@heroicons/vue/24/outline';

const route = useRoute();
const accountsStore = useAccountsStore();
const transactionsStore = useTransactionsStore();
const categoriesStore = useCategoriesStore();
const currencyStore = useCurrencyStore();
const householdStore = useHouseholdStore();
const monthClosuresStore = useMonthClosuresStore();

if (!accountsStore.initialized) {
  accountsStore.init();
}
if (!transactionsStore.initialized) {
  transactionsStore.init();
}
if (!categoriesStore.initialized) {
  categoriesStore.init();
}
if (!householdStore.initialized) {
  householdStore.init();
}
if (!monthClosuresStore.initialized) {
  monthClosuresStore.init();
}

const account = computed(() => accountsStore.visibleAccountById(route.params.id));
const openTransaction = ref(false);
const isProcessing = ref(false);
const isClosed = computed(() => account.value?.isClosed ?? false);
const canEditFinancialData = computed(() => householdStore.canEditFinancialData);
const openDeleteDialog = ref(false);
const transactionToDelete = ref(null);
const deletePrompt = computed(() => {
  if (!transactionToDelete.value) return '';
  const title = renderTransactionTitle(transactionToDelete.value);
  const amount = formatCurrency(txSign(transactionToDelete.value) * transactionToDelete.value.amount);
  return `Delete "${title}" (${amount})? This action cannot be undone.`;
});

const transactionForm = reactive({
  type: 'debit',
  amount: 0,
  date: toDateKey(new Date()),
  categoryId: '',
  counterpartyAccountId: '',
  note: '',
  excludeFromInsights: false
});

watch(
  () => transactionForm.type,
  (next) => {
    transactionForm.categoryId = '';
    if (next !== 'transfer') {
      transactionForm.counterpartyAccountId = '';
    } else {
      transactionForm.excludeFromInsights = false;
    }
  }
);

watch(
  () => transactionForm.categoryId,
  (categoryId) => {
    if (!categoryId || transactionForm.type === 'transfer') return;
    const category = categoriesStore.byId(categoryId);
    if (category) {
      transactionForm.excludeFromInsights = Boolean(category.excludeByDefault);
    }
  }
);

watch(
  isClosed,
  (closed) => {
    if (closed) {
      openTransaction.value = false;
    }
  },
  { immediate: true }
);

watch(openDeleteDialog, (isOpen) => {
  if (!isOpen) {
    transactionToDelete.value = null;
  }
});

const expenseCategories = computed(() => categoriesStore.expenseCategories);
const incomeCategories = computed(() => categoriesStore.incomeCategories);

const transferTargets = computed(() =>
  accountsStore.visibleOpenAccounts.filter(
    (candidate) => candidate.id !== account.value?.id && !candidate.isClosed
  )
);

function compareTransactionsDesc(a, b) {
  const left = (a.occurredAt ?? a.createdAt ?? new Date(0)).getTime();
  const right = (b.occurredAt ?? b.createdAt ?? new Date(0)).getTime();
  if (right !== left) {
    return right - left;
  }
  return (b.updatedAt ?? new Date(0)).getTime() - (a.updatedAt ?? new Date(0)).getTime();
}

const accountTransactions = computed(() =>
  transactionsStore.transactions
    .filter((tx) => tx.accountId === account.value?.id)
    .sort(compareTransactionsDesc)
);

const convertedAccountBalance = computed(() => {
  if (!account.value) return null;
  const baseCurrency = currencyStore.mainCurrency;
  const accountCurrency = account.value.currency || baseCurrency;
  if (accountCurrency === baseCurrency) {
    return Number(account.value.balance) || 0;
  }
  const converted = currencyStore.convertAmount(account.value.balance, accountCurrency, baseCurrency, {
    requestIfMissing: true
  });
  if (converted === null) {
    return null;
  }
  return converted;
});

const monthly = computed(() => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  let inflow = 0;
  let outflow = 0;

  for (const tx of accountTransactions.value) {
    if (tx.excludeFromInsights) continue;
    const date = tx.occurredAt ?? tx.createdAt ?? new Date();
    if (date < startOfMonth) continue;
    const amount = Number(tx.amount) || 0;
    if (tx.type === 'credit' || (tx.type === 'transfer' && tx.direction === 'incoming')) {
      inflow += amount;
    } else if (tx.type === 'debit' || (tx.type === 'transfer' && tx.direction === 'outgoing')) {
      outflow += amount;
    }
  }

  return { inflow, outflow, net: inflow - outflow };
});

const accountCurrencyCode = computed(
  () => account.value?.currency || currencyStore.mainCurrency
);

function formatCurrency(value, currency = accountCurrencyCode.value) {
  return currencyStore.formatCurrency(value, currency);
}

function formatBaseCurrency(value) {
  return currencyStore.formatCurrency(value, currencyStore.mainCurrency);
}

function formatDate(date) {
  return date ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date) : 'Unknown date';
}

function renderTransactionTitle(tx) {
  if (tx.type === 'transfer') {
    return `${tx.direction === 'outgoing' ? 'Transfer to' : 'Transfer from'} ${accountsStore.visibleAccountById(tx.counterpartyAccountId)?.name ?? 'Account'}`;
  }
  const category = categoriesStore.byId(tx.categoryId);
  return category?.name ?? 'Uncategorized';
}

function transactionIcon(tx) {
  if (tx.type === 'transfer') {
    return categoriesStore.byId(tx.categoryId)?.icon ?? 'banknotes';
  }
  return categoriesStore.byId(tx.categoryId)?.icon ?? '';
}

function txSign(tx) {
  if (tx.type === 'debit' || (tx.type === 'transfer' && tx.direction === 'outgoing')) return -1;
  return 1;
}

function isTransactionLocked(tx) {
  const monthKey = coerceDateKey(tx.occurredOn ?? tx.occurredAt ?? tx.createdAt, '').slice(0, 7);
  return monthKey ? monthClosuresStore.isMonthClosed(monthKey) : false;
}

function txClass(tx) {
  return txSign(tx) > 0 ? 'text-success font-medium' : 'text-error font-medium';
}

const accountTransactionSummaries = computed(() =>
  accountTransactions.value.map((tx) => {
    const sign = txSign(tx);
    const amount = Number(tx.amount) || 0;
    const accountCurrency = accountCurrencyCode.value;
    const converted = currencyStore.convertAmount(amount, accountCurrency, currencyStore.mainCurrency, {
      requestIfMissing: true
    });
    const pending =
      accountCurrency !== currencyStore.mainCurrency && converted === null;
    const formattedAccount = formatCurrency(sign * amount, accountCurrency);
    const formattedBase =
      accountCurrency !== currencyStore.mainCurrency && !pending
        ? formatBaseCurrency(sign * converted)
        : null;
    return {
      tx,
      formattedAccount,
      formattedBase,
      pending,
      isLockedMonth: isTransactionLocked(tx)
    };
  })
);

async function handleTransaction() {
  if (isClosed.value) {
    alert('Cannot add transactions to a closed account.');
    return;
  }
  if (!canEditFinancialData.value) {
    alert('Your role does not allow editing transactions.');
    return;
  }
  try {
    isProcessing.value = true;
    const payload = {
      type: transactionForm.type,
      accountId: account.value.id,
      amount: transactionForm.amount,
      note: transactionForm.note,
      occurredAt: coerceDateKey(transactionForm.date, toDateKey(new Date())),
      excludeFromInsights: Boolean(transactionForm.excludeFromInsights)
    };

    if (transactionForm.type === 'transfer') {
      payload.counterpartyAccountId = transactionForm.counterpartyAccountId;
    } else {
      payload.categoryId = transactionForm.categoryId;
    }

    await transactionsStore.addTransaction(payload);
    openTransaction.value = false;
    Object.assign(transactionForm, {
      type: 'debit',
      amount: 0,
      date: toDateKey(new Date()),
      categoryId: '',
      counterpartyAccountId: '',
      note: '',
      excludeFromInsights: false
    });
  } catch (error) {
    console.error(error);
    alert(error.message ?? 'Failed to save transaction');
  } finally {
    isProcessing.value = false;
  }
}

function requestDelete(tx) {
  if (!canEditFinancialData.value) {
    alert('Your role does not allow deleting transactions.');
    return;
  }
  if (isTransactionLocked(tx)) {
    alert(`Cannot delete transaction from ${(tx.occurredOn ?? '').slice(0, 7)} because that month is closed.`);
    return;
  }
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
