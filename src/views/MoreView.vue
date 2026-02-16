<template>
  <div class="space-y-6">
    <header class="rounded-2xl bg-gradient-to-br from-accent/20 via-base-100 to-primary/15 p-5 shadow">
      <h1 class="text-2xl font-semibold">More</h1>
      <p class="text-sm opacity-75">Planning tools, install options, and app settings.</p>
    </header>

    <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <RouterLink
        to="/planning"
        class="card bg-base-100 shadow transition hover:-translate-y-0.5 hover:shadow-lg"
      >
        <div class="card-body">
          <div class="flex items-center gap-3">
            <div class="rounded-lg bg-accent/15 p-3">
              <SparklesIcon class="h-6 w-6 text-accent" />
            </div>
            <div class="flex-1">
              <h2 class="card-title text-lg">Planning</h2>
              <p class="text-sm opacity-70">Budgets, recurring, and goals</p>
            </div>
            <ChevronRightIcon class="h-5 w-5 opacity-50" />
          </div>
          <div class="stats stats-vertical border border-base-200 bg-base-200/40 lg:stats-horizontal">
            <div class="stat py-2">
              <div class="stat-title text-xs">Budgets</div>
              <div class="stat-value text-lg">{{ budgetsStore.budgets.length }}</div>
            </div>
            <div class="stat py-2">
              <div class="stat-title text-xs">Due</div>
              <div class="stat-value text-lg">{{ visibleRecurringDueCount }}</div>
            </div>
            <div class="stat py-2">
              <div class="stat-title text-xs">Goals</div>
              <div class="stat-value text-lg">{{ goalsStore.goals.length }}</div>
            </div>
          </div>
        </div>
      </RouterLink>

      <RouterLink
        to="/settings"
        class="card bg-base-100 shadow transition hover:-translate-y-0.5 hover:shadow-lg"
      >
        <div class="card-body">
          <div class="flex items-center gap-3">
            <div class="rounded-lg bg-primary/10 p-3">
              <Cog6ToothIcon class="h-6 w-6 text-primary" />
            </div>
            <div class="flex-1">
              <h2 class="card-title text-lg">Settings</h2>
              <p class="text-sm opacity-70">Backup, account, and currency</p>
            </div>
            <ChevronRightIcon class="h-5 w-5 opacity-50" />
          </div>
          <p class="text-sm opacity-65">
            Secure backups and restore are available from your account settings.
          </p>
        </div>
      </RouterLink>

      <article class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="flex items-center gap-3">
            <div class="rounded-lg bg-info/10 p-3">
              <DevicePhoneMobileIcon class="h-6 w-6 text-info" />
            </div>
            <div class="flex-1">
              <h2 class="card-title text-lg">Install App</h2>
              <p class="text-sm opacity-70">Use MyMoney like a native app</p>
            </div>
          </div>

          <div v-if="isStandalone" class="alert alert-success py-2 text-sm">
            <CheckBadgeIcon class="h-5 w-5" />
            <span>Already running in standalone mode.</span>
          </div>
          <div v-else-if="canPromptInstall" class="space-y-2">
            <p class="text-sm opacity-70">Install is available on this browser.</p>
            <button class="btn btn-info btn-sm" @click="promptInstall">
              <ArrowDownTrayIcon class="h-4 w-4" />
              Install now
            </button>
          </div>
          <div v-else-if="isIos" class="rounded-lg border border-base-300 bg-base-200/40 p-3 text-sm">
            <p class="font-medium">Install on iPhone/iPad</p>
            <p class="mt-1 opacity-75">Open in Safari, tap <ShareIcon class="mx-1 inline h-4 w-4" /> Share, then tap "Add to Home Screen".</p>
          </div>
          <p v-else class="text-sm opacity-70">
            Install prompt appears when browser criteria are met (HTTPS, visit engagement, and available service worker).
          </p>
        </div>
      </article>
    </section>

    <section class="card bg-base-100 shadow">
      <div class="card-body">
        <h2 class="card-title">App Information</h2>
        <div class="grid gap-3 text-sm">
          <div class="flex items-center justify-between border-b border-base-200 py-2">
            <span class="opacity-70">Version</span>
            <span class="font-medium">0.1.0</span>
          </div>
          <div class="flex items-center justify-between border-b border-base-200 py-2">
            <span class="opacity-70">Storage</span>
            <span class="font-medium">Browser local storage</span>
          </div>
          <div class="flex items-center justify-between border-b border-base-200 py-2">
            <span class="opacity-70">Standalone mode</span>
            <span class="font-medium">{{ isStandalone ? 'Enabled' : 'No' }}</span>
          </div>
          <div class="flex items-center justify-between py-2">
            <span class="opacity-70">Built with</span>
            <span class="font-medium">Vue 3 + Vite + DaisyUI</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import {
  ArrowDownTrayIcon,
  CheckBadgeIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
  DevicePhoneMobileIcon,
  ShareIcon,
  SparklesIcon
} from '@heroicons/vue/24/outline';
import { useBudgetsStore } from '@/stores/budgets';
import { useRecurringStore } from '@/stores/recurring';
import { useGoalsStore } from '@/stores/goals';
import { useAccountsStore } from '@/stores/accounts';

const budgetsStore = useBudgetsStore();
const recurringStore = useRecurringStore();
const goalsStore = useGoalsStore();
const accountsStore = useAccountsStore();

if (!budgetsStore.initialized) budgetsStore.init();
if (!recurringStore.initialized) recurringStore.init();
if (!goalsStore.initialized) goalsStore.init();
if (!accountsStore.initialized) accountsStore.init();
recurringStore.syncDueItems();

const deferredPrompt = ref(null);
const isStandalone = ref(false);

const isIos = computed(() => {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
});

const canPromptInstall = computed(() => Boolean(deferredPrompt.value) && !isStandalone.value);
const visibleRecurringDueCount = computed(() =>
  recurringStore.dueInstances.filter((instance) => {
    const rule = recurringStore.ruleById(instance.ruleId);
    if (!rule) return false;
    if (!accountsStore.isAccountVisible(rule.accountId)) return false;
    if (rule.type === 'transfer' && !accountsStore.isAccountVisible(rule.counterpartyAccountId)) return false;
    return true;
  }).length
);

function evaluateStandalone() {
  if (typeof window === 'undefined') return;
  isStandalone.value = window.matchMedia('(display-mode: standalone)').matches || Boolean(window.navigator.standalone);
}

function handleBeforeInstallPrompt(event) {
  event.preventDefault();
  deferredPrompt.value = event;
}

function handleAppInstalled() {
  deferredPrompt.value = null;
  isStandalone.value = true;
}

function handleInstallAvailable(event) {
  deferredPrompt.value = event?.detail?.prompt || deferredPrompt.value;
}

async function promptInstall() {
  if (!deferredPrompt.value) return;
  deferredPrompt.value.prompt();
  await deferredPrompt.value.userChoice.catch(() => null);
  deferredPrompt.value = null;
}

onMounted(() => {
  evaluateStandalone();
  if (typeof window === 'undefined') return;
  if (window.deferredPrompt) {
    deferredPrompt.value = window.deferredPrompt;
  }
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);
  window.addEventListener('pwa-install-available', handleInstallAvailable);
  window.addEventListener('pwa-installed', handleAppInstalled);
});

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return;
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.removeEventListener('appinstalled', handleAppInstalled);
  window.removeEventListener('pwa-install-available', handleInstallAvailable);
  window.removeEventListener('pwa-installed', handleAppInstalled);
});
</script>
