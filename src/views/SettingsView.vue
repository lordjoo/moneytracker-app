<template>
  <div class="space-y-6">
    <header>
      <h1 class="text-2xl font-semibold">Settings</h1>
      <p class="text-sm opacity-70">
        Manage backups, account preferences and currency conversions.
      </p>
    </header>

    <div class="tabs tabs-boxed w-full overflow-x-auto">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab whitespace-nowrap"
        :class="{ 'tab-active': activeTab === tab.id }"
        type="button"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <section v-if="activeTab === 'general'" class="grid gap-4 lg:grid-cols-2">
      <article class="card bg-base-100 shadow">
        <div class="card-body space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="card-title">Local data</h2>
            <span class="badge badge-outline">Browser storage</span>
          </div>
          <ul class="space-y-2 text-sm">
            <li>Accounts: <strong>{{ accountsStore.accounts.length }}</strong></li>
            <li>Categories: <strong>{{ categoriesStore.categories.length }}</strong></li>
            <li>Transactions: <strong>{{ transactionsStore.transactions.length }}</strong></li>
            <li>Last backup: <strong>{{ lastBackupLabel }}</strong></li>
            <li>Last restore: <strong>{{ lastRestoreLabel }}</strong></li>
          </ul>
          <div class="alert" v-if="!authStore.isAuthenticated">
            <span>Sign in to enable cloud backups.</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              class="btn btn-primary"
              :disabled="!authStore.isAuthenticated || isBackingUp"
              :class="{ loading: isBackingUp }"
              @click="backupNow"
            >
              {{ authStore.isAuthenticated ? 'Backup to Firebase' : 'Sign in to backup' }}
            </button>
            <button
              class="btn btn-outline"
              :disabled="!authStore.isAuthenticated || isRestoring"
              :class="{ loading: isRestoring }"
              @click="restoreNow"
            >
              Restore from Firebase
            </button>
          </div>
          <p v-if="statusMessage" class="text-xs" :class="statusClass">{{ statusMessage }}</p>
        </div>
      </article>

      <article class="card bg-base-100 shadow">
        <div class="card-body space-y-4">
          <h2 class="card-title">Account</h2>
          <p class="text-sm opacity-70">
            Backups are stored against your Google account. You can sign out anytime; local data stays on this device.
          </p>
          <div v-if="authStore.isAuthenticated" class="flex items-center gap-3 rounded-lg border border-base-300 p-3">
            <img
              :src="authStore.photoURL ?? fallbackAvatar"
              :alt="authStore.displayName"
              class="h-10 w-10 rounded-full border border-base-300"
              @error="handleAvatarError"
            />
            <div class="flex-1">
              <p class="font-medium">{{ authStore.displayName }}</p>
              <p class="text-xs opacity-70">{{ authStore.user?.email }}</p>
            </div>
            <button class="btn btn-ghost btn-sm" @click="signOut">Sign out</button>
          </div>
          <div v-else class="space-y-3">
            <p class="text-sm">Connect with Google to enable backup and restore.</p>
            <button class="btn btn-primary" :class="{ loading: isAuthenticating }" @click="signIn">
              Continue with Google
            </button>
          </div>
        </div>
      </article>
    </section>

    <section v-else class="grid gap-4 lg:grid-cols-2">
      <article class="card bg-base-100 shadow lg:col-span-2">
        <div class="card-body space-y-4">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 class="card-title">Currency preferences</h2>
            <div class="flex flex-wrap items-center gap-2">
              <span class="badge badge-primary badge-sm gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
                currencyapi.com
              </span>
              <span class="badge badge-info badge-sm gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                Applies to all accounts
              </span>
            </div>
          </div>
          <p class="text-sm opacity-70">
            Choose the main currency for reporting and provide a CurrencyAPI token to enable per-account conversions.
          </p>
          <form class="grid gap-4 md:grid-cols-2" @submit.prevent="saveCurrencySettings">
            <label class="form-control">
              <span class="label-text font-medium">Main currency</span>
              <select v-model="currencyForm.mainCurrency" class="select select-bordered">
                <option v-for="option in currencyOptions" :key="option.code" :value="option.code">
                  {{ option.code }} — {{ option.name }}
                </option>
              </select>
            </label>
            <label class="form-control">
              <span class="label-text font-medium">Currency API token</span>
              <div class="join w-full">
                <input
                  v-model.trim="currencyForm.apiToken"
                  :type="showApiToken ? 'text' : 'password'"
                  class="input input-bordered join-item flex-1 font-mono text-sm"
                  placeholder="Enter CurrencyAPI token"
                />
                <button
                  type="button"
                  class="btn btn-square join-item"
                  @click="showApiToken = !showApiToken"
                  :title="showApiToken ? 'Hide token' : 'Show token'"
                >
                  <svg v-if="showApiToken" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L21 21m-4.242-4.242L21 21"></path>
                  </svg>
                  <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                  </svg>
                </button>
              </div>
              <div class="label">
                <span class="label-text-alt flex items-center gap-1.5">
                  <span v-if="hasCurrencyToken" class="inline-flex items-center gap-1 text-success font-medium">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                    </svg>
                    Token configured
                  </span>
                  <span v-else class="inline-flex items-center gap-1 text-warning font-medium">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                    </svg>
                    Required for conversions
                  </span>
                </span>
              </div>
            </label>
            <div class="md:col-span-2 border-t border-base-300 pt-4 mt-2">
              <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div class="text-sm space-y-2">
                  <p class="opacity-70">
                    Generate a token at
                    <a
                      href="https://currencyapi.com/"
                      target="_blank"
                      rel="noopener"
                      class="link link-primary font-medium hover:underline"
                    >
                      currencyapi.com
                    </a>
                  </p>
                  <p class="flex items-center gap-2">
                    <span class="opacity-70">Per-account currency fields are</span>
                    <span v-if="hasCurrencyToken" class="badge badge-success badge-sm gap-1">
                      <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                      </svg>
                      enabled
                    </span>
                    <span v-else class="badge badge-warning badge-sm gap-1">
                      <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
                      </svg>
                      disabled
                    </span>
                  </p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="btn btn-outline gap-2"
                    :disabled="!hasCurrencyToken || currencyStore.status === 'loading'"
                    :class="{ loading: currencyStore.status === 'loading' }"
                    @click="forceRefreshRates"
                    title="Force refresh all currency rates"
                  >
                    <svg v-if="currencyStore.status !== 'loading'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg>
                    Refresh rates
                  </button>
                  <button type="submit" class="btn btn-primary" :class="{ loading: savingCurrency }">
                    Save currency settings
                  </button>
                </div>
              </div>
            </div>
          </form>
          <p v-if="currencyStatusMessage" class="text-sm" :class="currencyStatusClass">
            {{ currencyStatusMessage }}
          </p>
          <div v-if="currencyStore.lastError" class="alert alert-warning text-sm">
            <span>{{ currencyStore.lastError }}</span>
          </div>
          <div v-if="currencyStore.accountsMissingConversion.length && hasCurrencyToken" class="alert alert-info text-sm">
            <span>
              Waiting for live rates for {{ currencyStore.accountsMissingConversion.length }} account{{
                currencyStore.accountsMissingConversion.length === 1 ? '' : 's'
              }}.
            </span>
          </div>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useAccountsStore } from '@/stores/accounts';
import { useCategoriesStore } from '@/stores/categories';
import { useTransactionsStore } from '@/stores/transactions';
import { usePreferencesStore } from '@/stores/preferences';
import { useCurrencyStore } from '@/stores/currency';
import { currencyList } from '@/utils/currencies';
import { uploadBackup, downloadBackup } from '@/utils/backupService';

const authStore = useAuthStore();
const accountsStore = useAccountsStore();
const categoriesStore = useCategoriesStore();
const transactionsStore = useTransactionsStore();
const preferencesStore = usePreferencesStore();
const currencyStore = useCurrencyStore();

if (!preferencesStore.initialized) {
  preferencesStore.init();
}
if (!accountsStore.initialized) {
  accountsStore.init();
}
if (!transactionsStore.initialized) {
  transactionsStore.init();
}
if (!categoriesStore.initialized) {
  categoriesStore.init();
}
if (!authStore.initialized) {
  authStore.init();
}

const tabs = [
  { id: 'general', label: 'Backup & Account' },
  { id: 'currency', label: 'Currency' }
];
const activeTab = ref('general');

const currencyOptions = currencyList;
const currencyForm = reactive({
  mainCurrency: currencyStore.mainCurrency.value,
  apiToken: currencyStore.apiToken.value
});
const savingCurrency = ref(false);
const currencyStatusMessage = ref('');
const currencyStatusKind = ref('info');
const showApiToken = ref(false);

watch(
  () => currencyStore.mainCurrency,
  (value) => {
    currencyForm.mainCurrency = value;
  },
  { immediate: true }
);

watch(
  () => currencyStore.apiToken,
  (value) => {
    currencyForm.apiToken = value;
  },
  { immediate: true }
);

const isBackingUp = ref(false);
const isRestoring = ref(false);
const statusMessage = ref('');
const statusKind = ref('info');
const fallbackAvatar = ref(makeFallbackAvatar(authStore.displayName));

const lastBackupLabel = computed(() => formatTimestamp(preferencesStore.lastBackupDate));
const lastRestoreLabel = computed(() => formatTimestamp(preferencesStore.lastRestoreDate));
const isAuthenticating = computed(() => authStore.status === 'authenticating');
const hasCurrencyToken = computed(() => currencyStore.hasToken);
const currencyStatusClass = computed(() => {
  if (currencyStatusKind.value === 'error') return 'text-error';
  if (currencyStatusKind.value === 'success') return 'text-success';
  return 'opacity-70';
});

function setCurrencyStatus(kind, message) {
  currencyStatusKind.value = kind;
  currencyStatusMessage.value = message;
}

async function saveCurrencySettings() {
  try {
    savingCurrency.value = true;
    currencyStore.setMainCurrency(currencyForm.mainCurrency);
    currencyStore.setApiToken(currencyForm.apiToken);
    setCurrencyStatus('success', 'Currency preferences saved.');
  } catch (error) {
    console.error(error);
    setCurrencyStatus('error', error?.message ?? 'Failed to update currency preferences');
  } finally {
    savingCurrency.value = false;
  }
}

async function forceRefreshRates() {
  try {
    setCurrencyStatus('info', 'Refreshing currency rates...');
    await currencyStore.forceRefreshRates();
    setCurrencyStatus('success', 'Currency rates refreshed successfully.');
  } catch (error) {
    console.error(error);
    setCurrencyStatus('error', error?.message ?? 'Failed to refresh currency rates');
  }
}

function formatTimestamp(date) {
  if (!date) return 'Never';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function setStatus(kind, message) {
  statusKind.value = kind;
  statusMessage.value = message;
}

const statusClass = computed(() => {
  if (statusKind.value === 'error') return 'text-error';
  if (statusKind.value === 'success') return 'text-success';
  return 'opacity-70';
});

function makeFallbackAvatar(displayName = 'User') {
  const source = displayName || 'User';
  const initials = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase?.() ?? '')
    .join('') || 'MM';
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="16" fill="#1d4ed8" />
    <text x="50%" y="55%" font-size="26" font-family="Inter, Arial, sans-serif" font-weight="600" text-anchor="middle" fill="#f8fafc">${initials}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function handleAvatarError(event) {
  if (event?.target) {
    event.target.src = fallbackAvatar.value;
  }
}

async function signIn() {
  try {
    await authStore.signIn();
    fallbackAvatar.value = makeFallbackAvatar(authStore.displayName);
  } catch (error) {
    console.error(error);
    setStatus('error', error.message ?? 'Failed to sign in');
  }
}

async function signOut() {
  try {
    await authStore.signOut();
    setStatus('info', 'Signed out. Local data is unaffected.');
  } catch (error) {
    console.error(error);
    setStatus('error', error.message ?? 'Failed to sign out');
  }
}

function toPlain(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

async function backupNow() {
  if (!authStore.user) {
    setStatus('error', 'Sign in with Google to create backups.');
    return;
  }
  try {
    isBackingUp.value = true;
    setStatus('info', 'Preparing backup…');
    const payload = {
      accounts: toPlain(accountsStore.accounts),
      categories: toPlain(categoriesStore.categories),
      transactions: toPlain(transactionsStore.transactions)
    };
    await uploadBackup(authStore.user.uid, payload);
    const now = new Date();
    preferencesStore.markBackup(now);
    setStatus('success', `Backup completed at ${formatTimestamp(now)}.`);
  } catch (error) {
    console.error(error);
    setStatus('error', error.message ?? 'Backup failed.');
  } finally {
    isBackingUp.value = false;
  }
}

async function restoreNow() {
  if (!authStore.user) {
    setStatus('error', 'Sign in with Google to restore backups.');
    return;
  }
  if (!confirm('Restore from cloud backup? Local data will be replaced.')) {
    return;
  }
  try {
    isRestoring.value = true;
    setStatus('info', 'Fetching backup…');
    const snapshot = await downloadBackup(authStore.user.uid);
    if (!snapshot) {
      setStatus('error', 'No backup found for this account.');
      return;
    }
    accountsStore.replaceAll(snapshot.accounts ?? []);
    categoriesStore.replaceAll(snapshot.categories ?? []);
    transactionsStore.replaceAll(snapshot.transactions ?? []);
    const restoredAt = new Date();
    preferencesStore.markRestore(restoredAt);
    setStatus('success', `Restore completed at ${formatTimestamp(restoredAt)}.`);
  } catch (error) {
    console.error(error);
    setStatus('error', error.message ?? 'Restore failed.');
  } finally {
    isRestoring.value = false;
  }
}
</script>
