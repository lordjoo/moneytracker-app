<template>
  <div class="space-y-6">
    <header>
      <h1 class="text-2xl font-semibold">Settings</h1>
      <p class="text-sm opacity-70">
        Manage backups, household roles, month tracking, close controls, and currency preferences.
      </p>
    </header>

    <section class="rounded-lg border border-base-300 bg-base-100 p-4 shadow-sm">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-3">
          <DevicePhoneMobileIcon class="h-6 w-6 text-info" />
          <div>
            <h2 class="font-semibold">Install app</h2>
            <p class="text-sm opacity-70">
              {{ installMessage }}
            </p>
          </div>
        </div>
        <button
          v-if="canPromptInstall"
          class="btn btn-info btn-sm"
          type="button"
          @click="promptInstall"
        >
          <ArrowDownTrayIcon class="h-4 w-4" />
          Install now
        </button>
        <CheckBadgeIcon v-else-if="isStandalone" class="h-6 w-6 text-success" />
      </div>
    </section>

    <div class="tabs tabs-boxed w-full overflow-x-auto">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="tab whitespace-nowrap"
        :class="{ 'tab-active': $route.path.includes(tab.to) }"
      >
        {{ tab.label }}
      </RouterLink>
    </div>

    <RouterView />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import {
  ArrowDownTrayIcon,
  CheckBadgeIcon,
  DevicePhoneMobileIcon
} from '@heroicons/vue/24/outline';
import { useAuthStore } from '@/stores/auth';
import { useAccountsStore } from '@/stores/accounts';
import { useCategoriesStore } from '@/stores/categories';
import { useTransactionsStore } from '@/stores/transactions';
import { usePreferencesStore } from '@/stores/preferences';
import { usePwaInstall } from '@/composables/usePwaInstall';

const authStore = useAuthStore();
const accountsStore = useAccountsStore();
const categoriesStore = useCategoriesStore();
const transactionsStore = useTransactionsStore();
const preferencesStore = usePreferencesStore();
const { canPromptInstall, isStandalone, promptInstall } = usePwaInstall();

// Initialize stores
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
  { to: '/settings/backup', label: 'Backup & Account' },
  { to: '/settings/currency', label: 'Currency' },
  { to: '/settings/month-start', label: 'Start of Month' },
  { to: '/settings/household', label: 'Household' },
  { to: '/settings/month-close', label: 'Month Close' }
];

const installMessage = computed(() => {
  if (isStandalone.value) return 'Already running as an installed app.';
  if (canPromptInstall.value) return 'This browser is ready to install MyMoney.';
  return 'Install appears here once the browser confirms this device is eligible.';
});
</script>
