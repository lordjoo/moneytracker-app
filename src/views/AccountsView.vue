<template>
  <div class="space-y-6">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Accounts</h1>
        <p class="text-sm text-base-content/60">Track cash and credit in one place. Assign a cycle day for cleaner monthly views.</p>
      </div>
      <button class="btn btn-primary gap-2" :disabled="!canEditFinancialData" @click="startCreate">
        <PlusIcon class="h-5 w-5" /> Add account
      </button>
    </header>

    <div v-if="!canEditFinancialData" class="alert bg-info/10 text-sm text-info-content/90">
      <InformationCircleIcon class="h-5 w-5 shrink-0 text-info" />
      <span>Your role is read-only. Account edits are disabled.</span>
    </div>

    <!-- Totals strip -->
    <section v-if="openAccounts.length" class="grid gap-3 sm:grid-cols-3">
      <div class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
        <p class="text-xs font-medium uppercase tracking-wide text-base-content/50">Net worth</p>
        <p class="amount-hero mt-1 text-xl">{{ currencyStore.formatCurrency(currencyStore.totalWorthInMain) }}</p>
      </div>
      <div class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
        <p class="text-xs font-medium uppercase tracking-wide text-base-content/50">Cash &amp; savings</p>
        <p class="amount-hero mt-1 text-xl text-success">{{ currencyStore.formatCurrency(assetsTotal) }}</p>
      </div>
      <div class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
        <p class="text-xs font-medium uppercase tracking-wide text-base-content/50">Credit owed</p>
        <p class="amount-hero mt-1 text-xl" :class="debtTotal > 0 ? 'text-error' : ''">
          {{ currencyStore.formatCurrency(debtTotal) }}
        </p>
      </div>
    </section>

    <!-- Open accounts -->
    <section v-if="openAccounts.length" class="grid gap-4 stagger md:grid-cols-2">
      <article
        v-for="account in decoratedOpenAccounts"
        :key="account.id"
        class="flex flex-col rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        :class="account.isCredit ? 'ring-1 ring-primary/15' : ''"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <AccountAvatar :account="account" size="lg" />
            <div>
              <h2 class="flex items-center gap-2 font-semibold leading-tight">
                {{ account.name }}
                <span v-if="account.excludeFromHousehold" class="badge badge-warning badge-sm">Private</span>
              </h2>
              <p class="text-xs text-base-content/55">
                {{ account.isCredit ? 'Credit card' : 'Cash account' }} ·
                {{ currencyStore.describeCurrency(account.currency) }} ({{ account.currency }})
                <span v-if="account.cycleDay"> · cycle {{ account.cycleDay }}</span>
              </p>
            </div>
          </div>
          <div class="text-right">
            <p class="amount-hero text-2xl" :class="account.isCredit && account.credit.owed > 0 ? 'text-error' : ''">
              {{ account.isCredit ? currencyStore.formatCurrency(account.credit.owed, account.currency) : currencyStore.formatCurrency(account.balance, account.currency) }}
            </p>
            <p class="text-[0.7rem] uppercase tracking-wide text-base-content/45">
              {{ account.isCredit ? 'owed' : 'balance' }}
            </p>
            <p
              v-if="account.currency !== currencyStore.mainCurrency && accountCurrencyInBase(account.id) !== null"
              class="text-xs text-base-content/55"
            >
              ≈ {{ currencyStore.formatCurrency(accountCurrencyInBase(account.id)) }}
            </p>
            <p
              v-else-if="account.currency !== currencyStore.mainCurrency && hasCurrencyToken"
              class="text-xs text-base-content/55"
            >
              Conversion pending…
            </p>
          </div>
        </div>

        <!-- Credit detail: utilization meter + limit/available -->
        <CreditUtilizationBar
          v-if="account.isCredit"
          class="mt-4"
          verbose
          show-overpaid
          :credit="account.credit"
          :currency="account.currency"
        />

        <div class="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-base-300/70 pt-4">
          <button
            v-if="account.isCredit"
            class="btn btn-primary btn-sm mr-auto gap-1.5"
            :disabled="!canEditFinancialData"
            @click="startPay(account)"
          >
            <ArrowRightIcon class="h-4 w-4" /> Pay card
          </button>
          <button class="btn btn-ghost btn-sm" :disabled="!canEditFinancialData" @click="startEdit(account)">Edit</button>
          <button class="btn btn-ghost btn-sm" :disabled="!canEditFinancialData" @click="requestClose(account)">Close</button>
          <RouterLink class="btn btn-ghost btn-sm" :to="`/accounts/${account.id}`">Details</RouterLink>
        </div>
      </article>
    </section>
    <p v-else class="rounded-2xl border border-dashed border-base-300 bg-base-100 px-4 py-8 text-center text-sm text-base-content/60">
      No active accounts yet. <button class="font-medium text-primary hover:underline" :disabled="!canEditFinancialData" @click="startCreate">Create one</button> to start tracking.
    </p>

    <!-- Closed accounts -->
    <section v-if="closedAccounts.length" class="space-y-3">
      <h2 class="text-lg font-semibold">Closed accounts</h2>
      <div class="grid gap-4 md:grid-cols-2">
        <article
          v-for="account in closedAccounts"
          :key="account.id"
          class="rounded-2xl border border-dashed border-base-300 bg-base-100/70 p-5 shadow-sm"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <h2 class="font-semibold text-base-content/80">{{ account.name }}</h2>
              <span class="badge badge-outline badge-sm">Closed</span>
            </div>
            <div class="text-right">
              <p class="amount-hero text-lg">{{ currencyStore.formatCurrency(account.balance, account.currency) }}</p>
              <p class="text-[0.7rem] uppercase tracking-wide text-base-content/45">final balance</p>
            </div>
          </div>
          <div class="mt-3 flex items-center justify-between">
            <p class="text-xs text-base-content/55">Closed {{ formatDate(account.closedAt) }}</p>
            <RouterLink class="btn btn-ghost btn-sm" :to="`/accounts/${account.id}`">History</RouterLink>
          </div>
        </article>
      </div>
    </section>

    <!-- Create dialog -->
    <TransitionRoot appear :show="openCreate" as="template">
      <Dialog as="div" class="relative" :style="{ zIndex: 'var(--z-modal)' }" @close="openCreate = false">
        <TransitionChild as="template" enter="ease-out duration-200" enter-from="opacity-0" enter-to="opacity-100" leave="ease-in duration-150" leave-from="opacity-100" leave-to="opacity-0">
          <div class="fixed inset-0 bg-base-content/40 backdrop-blur-sm" />
        </TransitionChild>
        <div class="fixed inset-0 overflow-y-auto">
          <div class="flex min-h-full items-center justify-center p-4">
            <TransitionChild as="template" enter="ease-out duration-200" enter-from="opacity-0 scale-95" enter-to="opacity-100 scale-100" leave="ease-in duration-150" leave-from="opacity-100 scale-100" leave-to="opacity-0 scale-95">
              <DialogPanel class="w-full max-w-md rounded-2xl bg-base-100 p-6 shadow-xl">
                <DialogTitle class="text-lg font-semibold">New account</DialogTitle>
                <form class="mt-4 space-y-4" @submit.prevent="handleCreate">
                  <!-- Account type segmented control -->
                  <div class="grid grid-cols-2 gap-2 rounded-xl bg-base-200 p-1">
                    <button
                      v-for="option in accountTypeOptions"
                      :key="option.value"
                      type="button"
                      class="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition"
                      :class="form.type === option.value ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/60 hover:text-base-content'"
                      @click="form.type = option.value"
                    >
                      <component :is="option.icon" class="h-4 w-4" /> {{ option.label }}
                    </button>
                  </div>

                  <label class="form-control w-full">
                    <span class="label-text mb-1">Account name</span>
                    <input v-model.trim="form.name" type="text" class="input input-bordered" required :placeholder="form.type === 'credit' ? 'e.g. Visa Platinum' : 'e.g. Checking'" />
                  </label>

                  <label class="form-control w-full">
                    <span class="label-text mb-1">{{ form.type === 'credit' ? 'Current balance owed' : 'Opening balance' }}</span>
                    <input v-model.number="form.openingBalance" type="number" min="0" step="0.01" class="input input-bordered tnum" required />
                    <span class="label-text-alt mt-1 text-base-content/55">
                      {{ form.type === 'credit'
                        ? 'How much you currently owe on this card (0 if paid off).'
                        : 'An opening balance transaction is created automatically.' }}
                    </span>
                  </label>

                  <label v-if="form.type === 'credit'" class="form-control w-full">
                    <span class="label-text mb-1">Credit limit (optional)</span>
                    <input v-model.number="form.creditLimit" type="number" min="0" step="0.01" class="input input-bordered tnum" placeholder="e.g. 5000" />
                    <span class="label-text-alt mt-1 text-base-content/55">Enables available-credit and utilization tracking.</span>
                  </label>

                  <div class="grid gap-4 sm:grid-cols-2">
                    <label class="form-control w-full">
                      <span class="label-text mb-1">{{ form.type === 'credit' ? 'Statement day' : 'Cycle day' }} <span class="text-base-content/45">(optional)</span></span>
                      <input v-model.number="form.cycleDay" type="number" min="1" max="31" class="input input-bordered" placeholder="1–31" />
                    </label>
                    <label class="form-control w-full">
                      <span class="label-text mb-1">Currency</span>
                      <select v-model="form.currency" class="select select-bordered" :disabled="!hasCurrencyToken">
                        <option v-for="option in currencyOptions" :key="option.code" :value="option.code">{{ option.code }} — {{ option.name }}</option>
                      </select>
                    </label>
                  </div>
                  <p v-if="!hasCurrencyToken" class="text-xs text-warning">⚠ Add an API token in Settings → Currency to enable per-account currencies.</p>

                  <label v-if="hasActiveHousehold" class="label cursor-pointer justify-start gap-3 rounded-xl border border-base-300 p-3">
                    <input v-model="form.excludeFromHousehold" type="checkbox" class="checkbox checkbox-sm" />
                    <div>
                      <p class="text-sm font-medium">Keep private from household</p>
                      <p class="text-xs text-base-content/60">Only you will see this account.</p>
                    </div>
                  </label>

                  <div class="flex justify-end gap-2 pt-1">
                    <button type="button" class="btn btn-ghost" @click="openCreate = false">Cancel</button>
                    <button type="submit" class="btn btn-primary" :class="{ loading: isSubmitting }">Create</button>
                  </div>
                </form>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>

    <!-- Edit dialog -->
    <TransitionRoot appear :show="openEdit" as="template">
      <Dialog as="div" class="relative" :style="{ zIndex: 'var(--z-modal)' }" @close="openEdit = false">
        <TransitionChild as="template" enter="ease-out duration-200" enter-from="opacity-0" enter-to="opacity-100" leave="ease-in duration-150" leave-from="opacity-100" leave-to="opacity-0">
          <div class="fixed inset-0 bg-base-content/40 backdrop-blur-sm" />
        </TransitionChild>
        <div class="fixed inset-0 overflow-y-auto">
          <div class="flex min-h-full items-center justify-center p-4">
            <TransitionChild as="template" enter="ease-out duration-200" enter-from="opacity-0 scale-95" enter-to="opacity-100 scale-100" leave="ease-in duration-150" leave-from="opacity-100 scale-100" leave-to="opacity-0 scale-95">
              <DialogPanel class="w-full max-w-md rounded-2xl bg-base-100 p-6 shadow-xl">
                <DialogTitle class="text-lg font-semibold">Edit account</DialogTitle>
                <form class="mt-4 space-y-4" @submit.prevent="handleEdit">
                  <label class="form-control w-full">
                    <span class="label-text mb-1">Account name</span>
                    <input v-model.trim="editForm.name" type="text" class="input input-bordered" required />
                  </label>
                  <label v-if="editForm.type === 'credit'" class="form-control w-full">
                    <span class="label-text mb-1">Credit limit (optional)</span>
                    <input v-model.number="editForm.creditLimit" type="number" min="0" step="0.01" class="input input-bordered tnum" placeholder="No limit" />
                  </label>
                  <div class="grid gap-4 sm:grid-cols-2">
                    <label class="form-control w-full">
                      <span class="label-text mb-1">{{ editForm.type === 'credit' ? 'Statement day' : 'Cycle day' }}</span>
                      <input v-model.number="editForm.cycleDay" type="number" min="1" max="31" class="input input-bordered" placeholder="Unset" />
                    </label>
                    <label class="form-control w-full">
                      <span class="label-text mb-1">Currency</span>
                      <select v-model="editForm.currency" class="select select-bordered" :disabled="!hasCurrencyToken">
                        <option v-for="option in currencyOptions" :key="option.code" :value="option.code">{{ option.code }} — {{ option.name }}</option>
                      </select>
                    </label>
                  </div>
                  <p v-if="editForm.type === 'credit'" class="text-xs text-base-content/55">Changing the currency does not adjust existing balances or transactions.</p>
                  <label v-if="hasActiveHousehold" class="label cursor-pointer justify-start gap-3 rounded-xl border border-base-300 p-3">
                    <input v-model="editForm.excludeFromHousehold" type="checkbox" class="checkbox checkbox-sm" />
                    <div>
                      <p class="text-sm font-medium">Keep private from household</p>
                      <p class="text-xs text-base-content/60">Private accounts stay hidden from other members.</p>
                    </div>
                  </label>
                  <div class="flex justify-end gap-2 pt-1">
                    <button type="button" class="btn btn-ghost" @click="openEdit = false">Cancel</button>
                    <button type="submit" class="btn btn-primary" :class="{ loading: isUpdating }">Save changes</button>
                  </div>
                </form>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>

    <PayCreditDialog :open="openPay" :account="accountToPay" @close="openPay = false" />

    <ConfirmationDialog
      v-model:open="openCloseDialog"
      title="Close account"
      :message="closePrompt"
      confirm-label="Close account"
      confirm-variant="danger"
      @confirm="confirmClose"
    />
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import {
  PlusIcon,
  CreditCardIcon,
  BanknotesIcon,
  ArrowRightIcon,
  InformationCircleIcon
} from '@heroicons/vue/24/outline';
import { useAccountsStore, describeCreditAccount } from '@/stores/accounts';
import { useCurrencyStore } from '@/stores/currency';
import { useHouseholdStore } from '@/stores/household';
import currencyList from '@/utils/currencies';
import ConfirmationDialog from '@/components/ConfirmationDialog.vue';
import PayCreditDialog from '@/components/PayCreditDialog.vue';
import AccountAvatar from '@/components/AccountAvatar.vue';
import CreditUtilizationBar from '@/components/CreditUtilizationBar.vue';

const accountsStore = useAccountsStore();
const currencyStore = useCurrencyStore();
const householdStore = useHouseholdStore();
if (!accountsStore.initialized) accountsStore.init();
if (!householdStore.initialized) householdStore.init();

const accountTypeOptions = [
  { value: 'cash', label: 'Cash / bank', icon: BanknotesIcon },
  { value: 'credit', label: 'Credit card', icon: CreditCardIcon }
];

const openCreate = ref(false);
const openEdit = ref(false);
const openPay = ref(false);
const isSubmitting = ref(false);
const isUpdating = ref(false);
const openCloseDialog = ref(false);
const accountToClose = ref(null);
const accountToPay = ref(null);

const form = reactive({
  name: '',
  type: 'cash',
  openingBalance: 0,
  creditLimit: null,
  cycleDay: null,
  currency: currencyStore.mainCurrency,
  excludeFromHousehold: false
});

const editForm = reactive({
  id: '',
  name: '',
  type: 'cash',
  creditLimit: null,
  cycleDay: null,
  currency: currencyStore.mainCurrency,
  excludeFromHousehold: false
});

const openAccounts = computed(() => accountsStore.visibleOpenAccounts);
const closedAccounts = computed(() => accountsStore.visibleClosedAccounts);
const decoratedOpenAccounts = computed(() =>
  openAccounts.value.map((account) => ({
    ...account,
    isCredit: account.type === 'credit',
    credit: describeCreditAccount(account)
  }))
);
const hasActiveHousehold = computed(() => Boolean(householdStore.household));
const closePrompt = computed(() =>
  accountToClose.value
    ? `Close ${accountToClose.value.name}? You will keep its history but no new transactions can be added.`
    : ''
);

const currencyOptions = currencyList;
const hasCurrencyToken = computed(() => currencyStore.hasToken);
const canEditFinancialData = computed(() => householdStore.canEditFinancialData);
const convertedBalances = currencyStore.convertedAccountBalances;

function convertedOrRaw(account) {
  const converted = accountCurrencyInBase(account.id);
  return converted ?? (Number(account.balance) || 0);
}
const assetsTotal = computed(() =>
  openAccounts.value
    .filter((a) => a.type !== 'credit')
    .reduce((sum, a) => sum + convertedOrRaw(a), 0)
);
const debtTotal = computed(() =>
  openAccounts.value
    .filter((a) => a.type === 'credit')
    .reduce((sum, a) => sum + Math.max(0, -convertedOrRaw(a)), 0)
);

watch(
  () => currencyStore.mainCurrency,
  (value) => {
    if (!hasCurrencyToken.value) {
      form.currency = value;
      if (!openEdit.value) editForm.currency = value;
    }
  }
);

watch(openCloseDialog, (isOpen) => {
  if (!isOpen) accountToClose.value = null;
});

watch(
  hasCurrencyToken,
  (enabled) => {
    if (enabled) return;
    const fallback = currencyStore.mainCurrency;
    form.currency = fallback;
    if (!openEdit.value) editForm.currency = fallback;
  },
  { immediate: true }
);

function accountCurrencyInBase(accountId) {
  return convertedBalances?.get?.(accountId) ?? null;
}

function startCreate() {
  if (!canEditFinancialData.value) return;
  Object.assign(form, {
    name: '',
    type: 'cash',
    openingBalance: 0,
    creditLimit: null,
    cycleDay: null,
    currency: currencyStore.mainCurrency,
    excludeFromHousehold: false
  });
  openCreate.value = true;
}

function startEdit(account) {
  if (!canEditFinancialData.value) return;
  Object.assign(editForm, {
    id: account.id,
    name: account.name,
    type: account.type ?? 'cash',
    creditLimit: account.creditLimit ?? null,
    cycleDay: account.cycleDay,
    currency: account.currency,
    excludeFromHousehold: Boolean(account.excludeFromHousehold)
  });
  openEdit.value = true;
}

function startPay(account) {
  if (!canEditFinancialData.value) return;
  accountToPay.value = account;
  openPay.value = true;
}

async function handleEdit() {
  try {
    isUpdating.value = true;
    await accountsStore.updateAccount(editForm.id, {
      name: editForm.name,
      cycleDay: editForm.cycleDay || null,
      currency: editForm.currency,
      creditLimit: editForm.type === 'credit' ? editForm.creditLimit || null : null,
      excludeFromHousehold: Boolean(editForm.excludeFromHousehold)
    });
    openEdit.value = false;
  } catch (error) {
    console.error(error);
    alert(error.message ?? 'Failed to update account');
  } finally {
    isUpdating.value = false;
  }
}

function handleClose(account) {
  try {
    accountsStore.closeAccount(account.id);
  } catch (error) {
    console.error(error);
    alert(error.message ?? 'Failed to close account');
  }
}

function requestClose(account) {
  if (!canEditFinancialData.value) return;
  accountToClose.value = account;
  openCloseDialog.value = true;
}

function confirmClose() {
  if (!accountToClose.value) return;
  handleClose(accountToClose.value);
  accountToClose.value = null;
}

function formatDate(timestamp) {
  if (!timestamp) return 'Unknown';
  const date = timestamp?.toDate ? timestamp.toDate() : timestamp;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

async function handleCreate() {
  try {
    isSubmitting.value = true;
    await accountsStore.createAccount({
      name: form.name,
      type: form.type,
      openingBalance: form.openingBalance,
      creditLimit: form.type === 'credit' ? form.creditLimit || null : null,
      cycleDay: form.cycleDay,
      currency: form.currency,
      excludeFromHousehold: form.excludeFromHousehold
    });
    openCreate.value = false;
  } catch (error) {
    console.error(error);
    alert(error.message ?? 'Failed to create account');
  } finally {
    isSubmitting.value = false;
  }
}
</script>
