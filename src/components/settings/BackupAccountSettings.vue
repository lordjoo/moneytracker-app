<template>
  <section class="grid gap-4 lg:grid-cols-2">
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
          <li>Budgets: <strong>{{ budgetsStore.budgets.length }}</strong></li>
          <li>Recurring rules: <strong>{{ recurringStore.rules.length }}</strong></li>
          <li>Goals: <strong>{{ goalsStore.goals.length }}</strong></li>
          <li>Household members: <strong>{{ householdStore.activeMembers.length }}</strong></li>
          <li>Month closures: <strong>{{ monthClosuresStore.closures.length }}</strong></li>
          <li>Last backup: <strong>{{ lastBackupLabel }}</strong></li>
          <li>Last restore: <strong>{{ lastRestoreLabel }}</strong></li>
          <li>Sync mode: <strong>Manual push/pull</strong></li>
          <li>Sync status: <strong>{{ syncStateLabel }}</strong></li>
        </ul>
        <div class="alert" v-if="!authStore.isAuthenticated">
          <span>Sign in to enable cloud backups.</span>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="btn btn-outline" @click="exportLocalData">
            Export local JSON
          </button>
          <button
            class="btn btn-primary"
            :disabled="!authStore.isAuthenticated || backupSyncStore.hasConflict || backupSyncStore.status === 'pushing' || backupSyncStore.status === 'pulling'"
            :class="{ loading: backupSyncStore.status === 'pushing' }"
            @click="backupNow"
          >
            {{ authStore.isAuthenticated ? 'Push to Firebase' : 'Sign in to backup' }}
          </button>
          <button
            class="btn btn-outline"
            :disabled="!authStore.isAuthenticated || backupSyncStore.hasConflict || backupSyncStore.status === 'pushing' || backupSyncStore.status === 'pulling'"
            :class="{ loading: backupSyncStore.status === 'pulling' }"
            @click="restoreNow"
          >
            Pull from Firebase
          </button>
        </div>
        <div v-if="backupSyncStore.hasConflict" class="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <p class="font-medium text-warning-content">Sync conflict detected</p>
          <p class="mt-1 opacity-80">
            Local data and Firebase both changed. Export a local JSON backup before replacing either side.
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button class="btn btn-warning btn-sm" @click="forceBackupNow">
              Force push local
            </button>
            <button class="btn btn-outline btn-sm" @click="forceRestoreNow">
              Replace local with cloud
            </button>
          </div>
        </div>
        <p v-if="authStore.isAuthenticated" class="text-xs opacity-70">
          Cloud checks are metadata-only and run periodically to reduce Firestore reads.
        </p>
        <p v-if="statusMessage" class="text-xs" :class="statusClass">{{ statusMessage }}</p>
      </div>
    </article>

    <article class="card bg-base-100 shadow">
      <div class="card-body space-y-4">
        <h2 class="card-title">Account</h2>
        <p class="text-sm opacity-70">
          Backups are stored against your signed-in account. You can sign out anytime; local data stays on this device.
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
        <div v-else class="space-y-4">
          <form class="space-y-3" @submit.prevent="sendPasswordlessLink">
            <label class="form-control">
              <span class="label-text">Email address</span>
              <input
                v-model.trim="emailForm.email"
                type="email"
                autocomplete="email"
                class="input input-bordered"
                required
              />
            </label>
            <div class="flex flex-wrap gap-2">
              <button type="submit" class="btn btn-primary" :class="{ loading: isAuthenticating }">
                Send sign-in link
              </button>
            </div>
            <p class="text-xs opacity-70">
              Open the link from your email on this device to finish signing in.
            </p>
          </form>
          <div class="divider text-xs">or</div>
          <button class="btn btn-primary" :class="{ loading: isAuthenticating }" @click="signIn">
            Continue with Google
          </button>
          <p v-if="authStore.lastError && !statusMessage" class="text-xs text-error">
            {{ authStore.lastError }}
          </p>
        </div>
      </div>
    </article>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useAccountsStore } from '@/stores/accounts';
import { useCategoriesStore } from '@/stores/categories';
import { useTransactionsStore } from '@/stores/transactions';
import { useBudgetsStore } from '@/stores/budgets';
import { useRecurringStore } from '@/stores/recurring';
import { useGoalsStore } from '@/stores/goals';
import { useHouseholdStore } from '@/stores/household';
import { useMonthClosuresStore } from '@/stores/monthClosures';
import { usePreferencesStore } from '@/stores/preferences';
import { useBackupSyncStore } from '@/stores/backupSync';

const authStore = useAuthStore();
const accountsStore = useAccountsStore();
const categoriesStore = useCategoriesStore();
const transactionsStore = useTransactionsStore();
const budgetsStore = useBudgetsStore();
const recurringStore = useRecurringStore();
const goalsStore = useGoalsStore();
const householdStore = useHouseholdStore();
const monthClosuresStore = useMonthClosuresStore();
const preferencesStore = usePreferencesStore();
const backupSyncStore = useBackupSyncStore();

if (!budgetsStore.initialized) {
  budgetsStore.init();
}
if (!recurringStore.initialized) {
  recurringStore.init();
}
if (!goalsStore.initialized) {
  goalsStore.init();
}
if (!householdStore.initialized) {
  householdStore.init();
}
if (!monthClosuresStore.initialized) {
  monthClosuresStore.init();
}
backupSyncStore.init();

const statusMessage = ref('');
const statusKind = ref('info');
const fallbackAvatar = ref(makeFallbackAvatar(authStore.displayName));
const emailForm = ref({
  email: ''
});

const lastBackupLabel = computed(() => formatTimestamp(preferencesStore.lastBackupDate));
const lastRestoreLabel = computed(() => formatTimestamp(preferencesStore.lastRestoreDate));
const isAuthenticating = computed(() => authStore.status === 'authenticating');
const syncStateLabel = computed(() => {
  if (backupSyncStore.pendingMode === 'pull') return 'Cloud has newer changes';
  if (backupSyncStore.pendingMode === 'push') return 'Local changes waiting to push';
  return 'In sync';
});

const statusClass = computed(() => {
  if (statusKind.value === 'error') return 'text-error';
  if (statusKind.value === 'success') return 'text-success';
  return 'opacity-70';
});

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
    setStatus('info', 'Opening Google sign-in…');
    await authStore.signIn();
    fallbackAvatar.value = makeFallbackAvatar(authStore.displayName);
    setStatus('success', 'Successfully signed in with Google!');
  } catch (error) {
    console.error('[BackupSettings] Sign-in error:', error);
    
    let errorMessage = 'Failed to sign in';
    if (error.code === 'auth/unauthorized-domain') {
      errorMessage = 'This domain is not authorized for Google sign-in. Please check Firebase console settings.';
    } else if (error.code === 'auth/operation-not-allowed') {
      errorMessage = 'Google sign-in is not enabled. Please check Firebase console settings.';
    } else if (error.code === 'auth/network-request-failed') {
      errorMessage = 'Network error. Please check your internet connection and try again.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    setStatus('error', `${errorMessage} (Code: ${error.code || 'unknown'})`);
  }
}

function authErrorMessage(error) {
  if (error?.code === 'auth/missing-email') return 'Enter your email address.';
  if (error?.code === 'auth/invalid-email') return 'Enter a valid email address.';
  if (error?.code === 'auth/user-disabled') return 'This account has been disabled.';
  if (error?.code === 'auth/operation-not-allowed') return 'Enable Email link sign-in in Firebase Authentication.';
  if (error?.code === 'auth/unauthorized-domain') return 'Authorize this domain in Firebase Authentication settings.';
  if (error?.code === 'auth/network-request-failed') return 'Network error. Please check your connection and try again.';
  if (error?.code === 'auth/too-many-requests') return 'Too many attempts. Please wait a bit and try again.';
  return error?.message ?? 'Authentication failed.';
}

async function sendPasswordlessLink() {
  if (!emailForm.value.email) {
    setStatus('error', 'Enter your email address first.');
    return;
  }
  try {
    setStatus('info', 'Sending sign-in link...');
    await authStore.sendEmailLink(emailForm.value.email);
    setStatus('success', 'Sign-in link sent. Open it from your email to finish signing in.');
  } catch (error) {
    console.error(error);
    setStatus('error', authErrorMessage(error));
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

async function backupNow() {
  if (!authStore.user) {
    setStatus('error', 'Sign in to create backups.');
    return;
  }
  try {
    setStatus('info', 'Pushing local changes…');
    await backupSyncStore.pushNow();
    setStatus('success', 'Local data pushed to Firebase.');
  } catch (error) {
    console.error(error);
    setStatus('error', error.message ?? 'Push failed.');
  }
}

function exportLocalData() {
  try {
    const payload = backupSyncStore.exportLocalBackup();
    setStatus('success', `Exported ${payload.data.transactions.length} transactions to a local JSON file.`);
  } catch (error) {
    console.error(error);
    setStatus('error', error.message ?? 'Export failed.');
  }
}

async function forceBackupNow() {
  if (!authStore.user) {
    setStatus('error', 'Sign in to create backups.');
    return;
  }
  if (!confirm('Force push local data to Firebase? This replaces the current cloud backup.')) {
    return;
  }
  try {
    setStatus('info', 'Replacing cloud backup with local data...');
    await backupSyncStore.pushNow({ force: true });
    setStatus('success', 'Local data replaced the Firebase backup.');
  } catch (error) {
    console.error(error);
    setStatus('error', error.message ?? 'Force push failed.');
  }
}

async function restoreNow() {
  if (!authStore.user) {
    setStatus('error', 'Sign in to restore backups.');
    return;
  }
  if (!confirm('Restore from cloud backup? Local data will be replaced.')) {
    return;
  }
  try {
    setStatus('info', 'Pulling cloud changes…');
    await backupSyncStore.pullNow();
    setStatus('success', 'Cloud backup pulled to this device.');
  } catch (error) {
    console.error(error);
    setStatus('error', error.message ?? 'Pull failed.');
  }
}

async function forceRestoreNow() {
  if (!authStore.user) {
    setStatus('error', 'Sign in to restore backups.');
    return;
  }
  if (!confirm('Replace local data with Firebase backup? Export local JSON first if you need a copy.')) {
    return;
  }
  try {
    setStatus('info', 'Replacing local data with cloud backup...');
    await backupSyncStore.pullNow({ force: true });
    setStatus('success', 'Cloud backup replaced local data.');
  } catch (error) {
    console.error(error);
    setStatus('error', error.message ?? 'Force pull failed.');
  }
}
</script>
