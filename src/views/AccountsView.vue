<template>
  <div class="space-y-6">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Accounts</h1>
        <p class="text-sm opacity-70">Create multiple accounts and assign a billing cycle day for better monthly tracking.</p>
      </div>
      <button class="btn btn-primary" @click="openCreate = true">Add Account</button>
    </header>

    <section class="grid gap-4 md:grid-cols-2" v-if="openAccounts.length">
      <article
        v-for="account in openAccounts"
        :key="account.id"
        class="card bg-base-100 shadow transition hover:-translate-y-1"
      >
        <div class="card-body gap-3">
          <div class="flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2">
                <h2 class="card-title">{{ account.name }}</h2>
              </div>
              <p class="text-xs opacity-70">Cycle day: {{ account.cycleDay ?? 'Not set' }}</p>
              <p class="text-xs opacity-70">
                Currency: {{ currencyStore.describeCurrency(account.currency) }} ({{ account.currency }})
              </p>
            </div>
            <div class="text-right">
              <p class="text-sm opacity-70">Balance</p>
              <p class="text-2xl font-semibold">
                {{ currencyStore.formatCurrency(account.balance, account.currency) }}
              </p>
              <p
                v-if="account.currency !== currencyStore.mainCurrency && accountCurrencyInBase(account.id) !== null"
                class="text-xs opacity-60"
              >
                ≈ {{ currencyStore.formatCurrency(accountCurrencyInBase(account.id)) }}
              </p>
              <p
                v-else-if="account.currency !== currencyStore.mainCurrency && hasCurrencyToken"
                class="text-xs opacity-60"
              >
                Conversion pending…
              </p>
            </div>
          </div>
          <div class="card-actions justify-end gap-2">
            <button class="btn btn-ghost btn-sm" @click="startEdit(account)">Edit</button>
            <button class="btn btn-outline btn-sm" @click="requestClose(account)">Close</button>
            <RouterLink class="btn btn-ghost btn-sm" :to="`/accounts/${account.id}`">View details</RouterLink>
          </div>
        </div>
      </article>
    </section>
    <p v-else class="text-sm opacity-60">
      No active accounts. Create a new one to continue tracking.
    </p>

    <section v-if="closedAccounts.length" class="space-y-3">
      <h2 class="text-lg font-semibold">Closed accounts</h2>
      <div class="grid gap-4 md:grid-cols-2">
        <article
          v-for="account in closedAccounts"
          :key="account.id"
          class="card bg-base-100/80 border border-dashed border-base-300 shadow-sm"
        >
          <div class="card-body gap-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <h2 class="card-title text-base">{{ account.name }}</h2>
                <span class="badge badge-outline badge-sm">Closed</span>
              </div>
              <div class="text-right">
              <p class="text-sm opacity-70">Final balance</p>
              <p class="text-xl font-semibold">
                {{ currencyStore.formatCurrency(account.balance, account.currency) }}
              </p>
              <p
                v-if="account.currency !== currencyStore.mainCurrency && accountCurrencyInBase(account.id) !== null"
                class="text-xs opacity-60"
              >
                ≈ {{ currencyStore.formatCurrency(accountCurrencyInBase(account.id)) }}
              </p>
            </div>
          </div>
          <p class="text-xs opacity-60">Closed on {{ formatDate(account.closedAt) }}</p>
            <div class="card-actions justify-end">
              <RouterLink class="btn btn-ghost btn-sm" :to="`/accounts/${account.id}`">View history</RouterLink>
            </div>
          </div>
        </article>
      </div>
    </section>

    <TransitionRoot appear :show="openCreate" as="template">
      <Dialog as="div" class="relative z-50" @close="openCreate = false">
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
              <DialogPanel class="w-full max-w-md rounded-2xl bg-base-100 p-6 shadow-xl">
                <DialogTitle class="text-lg font-semibold">Create account</DialogTitle>
                <form class="mt-4 space-y-4" @submit.prevent="handleCreate">
                  <label class="form-control w-full">
                    <span class="label-text">Account name</span>
                    <input v-model.trim="form.name" type="text" class="input input-bordered" required placeholder="e.g. Checking" />
                  </label>
                  <label class="form-control w-full">
                    <span class="label-text">Opening balance</span>
                    <input
                      v-model.number="form.openingBalance"
                      type="number"
                      min="0"
                      step="0.01"
                      class="input input-bordered"
                      required
                    />
                    <span class="label-text-alt">An opening balance transaction will be created automatically.</span>
                  </label>
                  <label class="form-control w-full">
                    <span class="label-text">Cycle day (optional)</span>
                    <input
                      v-model.number="form.cycleDay"
                      type="number"
                      min="1"
                      max="31"
                      class="input input-bordered"
                      placeholder="Select billing cycle day"
                    />
                  </label>
                  <label class="form-control w-full">
                    <span class="label-text">Currency</span>
                    <select
                      v-model="form.currency"
                      class="select select-bordered"
                      :disabled="!hasCurrencyToken"
                    >
                      <option v-for="option in currencyOptions" :key="option.code" :value="option.code">
                        {{ option.code }} — {{ option.name }}
                      </option>
                    </select>
                    <span class="label-text-alt">
                      <span v-if="hasCurrencyToken" class="text-success">
                        ✓ Multi-currency enabled — Select the currency for this account.
                      </span>
                      <span v-else class="text-warning">
                        ⚠ Set an API token in Settings → Currency to enable per-account currencies.
                      </span>
                    </span>
                  </label>
                  <div class="flex justify-end gap-2 pt-2">
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

    <TransitionRoot appear :show="openEdit" as="template">
      <Dialog as="div" class="relative z-50" @close="openEdit = false">
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
              <DialogPanel class="w-full max-w-md rounded-2xl bg-base-100 p-6 shadow-xl">
                <DialogTitle class="text-lg font-semibold">Edit account</DialogTitle>
                <form class="mt-4 space-y-4" @submit.prevent="handleEdit">
                  <label class="form-control w-full">
                    <span class="label-text">Account name</span>
                    <input v-model.trim="editForm.name" type="text" class="input input-bordered" required />
                  </label>
                  <label class="form-control w-full">
                    <span class="label-text">Cycle day</span>
                    <input
                      v-model.number="editForm.cycleDay"
                      type="number"
                      min="1"
                      max="31"
                      class="input input-bordered"
                      placeholder="Leave blank to unset"
                    />
                  </label>
                  <label class="form-control w-full">
                    <span class="label-text">Currency</span>
                    <select
                      v-model="editForm.currency"
                      class="select select-bordered"
                      :disabled="!hasCurrencyToken"
                    >
                      <option v-for="option in currencyOptions" :key="option.code" :value="option.code">
                        {{ option.code }} — {{ option.name }}
                      </option>
                    </select>
                    <span class="label-text-alt">
                      <span v-if="hasCurrencyToken" class="text-info">
                        ℹ Changing the currency does not adjust existing balances or transactions.
                      </span>
                      <span v-else class="text-warning">
                        ⚠ Set an API token in Settings → Currency to enable per-account currencies.
                      </span>
                    </span>
                  </label>
                  <div class="flex justify-end gap-2 pt-2">
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
import { useAccountsStore } from '@/stores/accounts';
import { useCurrencyStore } from '@/stores/currency';
import currencyList from '@/utils/currencies';
import ConfirmationDialog from '@/components/ConfirmationDialog.vue';

const accountsStore = useAccountsStore();
const currencyStore = useCurrencyStore();
if (!accountsStore.initialized) {
  accountsStore.init();
}
const openCreate = ref(false);
const openEdit = ref(false);
const isSubmitting = ref(false);
const isUpdating = ref(false);
const openCloseDialog = ref(false);
const accountToClose = ref(null);

const form = reactive({
  name: '',
  openingBalance: 0,
  cycleDay: null,
  currency: currencyStore.mainCurrency.value
});

const editForm = reactive({
  id: '',
  name: '',
  cycleDay: null,
  currency: currencyStore.mainCurrency.value
});

const openAccounts = computed(() => accountsStore.openAccounts);
const closedAccounts = computed(() => accountsStore.closedAccounts);
const closePrompt = computed(() =>
  accountToClose.value
    ? `Close ${accountToClose.value.name}? You will keep its history but no new transactions can be added.`
    : ''
);

const currencyOptions = currencyList;
const hasCurrencyToken = computed(() => currencyStore.hasToken);
const convertedBalances = currencyStore.convertedAccountBalances;

watch(
  () => currencyStore.mainCurrency,
  (value) => {
    if (!hasCurrencyToken.value) {
      form.currency = value;
      if (!openEdit.value) {
        editForm.currency = value;
      }
    }
  }
);

watch(openCloseDialog, (isOpen) => {
  if (!isOpen) {
    accountToClose.value = null;
  }
});

watch(
  hasCurrencyToken,
  (enabled) => {
    if (enabled) return;
    const fallback = currencyStore.mainCurrency.value;
    form.currency = fallback;
    if (!openEdit.value) {
      editForm.currency = fallback;
    }
  },
  { immediate: true }
);

function accountCurrencyInBase(accountId) {
  return convertedBalances.value?.get?.(accountId) ?? null;
}

function startEdit(account) {
  Object.assign(editForm, {
    id: account.id,
    name: account.name,
    cycleDay: account.cycleDay,
    currency: account.currency
  });
  openEdit.value = true;
}

async function handleEdit() {
  try {
    isUpdating.value = true;
    await accountsStore.updateAccount(editForm.id, {
      name: editForm.name,
      cycleDay: editForm.cycleDay || null,
      currency: editForm.currency
    });
    openEdit.value = false;
  } catch (error) {
    console.error(error);
    alert(error.message ?? 'Failed to update account');
  } finally {
    isUpdating.value = false;
  }
}

async function handleClose(account) {
  try {
    accountsStore.closeAccount(account.id);
  } catch (error) {
    console.error(error);
    alert(error.message ?? 'Failed to close account');
  }
}

function requestClose(account) {
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
    await accountsStore.createAccount(form);
    openCreate.value = false;
    Object.assign(form, {
      name: '',
      openingBalance: 0,
      cycleDay: null,
      currency: currencyStore.mainCurrency.value
    });
  } catch (error) {
    console.error(error);
    alert(error.message ?? 'Failed to create account');
  } finally {
    isSubmitting.value = false;
  }
}
</script>
