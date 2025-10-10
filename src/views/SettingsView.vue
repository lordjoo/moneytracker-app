<template>
  <div class="space-y-6">
    <header>
      <h1 class="text-2xl font-semibold">Settings</h1>
      <p class="text-sm opacity-70">
        Manage backups, account preferences and currency conversions.
      </p>
    </header>

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
import { RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useAccountsStore } from '@/stores/accounts';
import { useCategoriesStore } from '@/stores/categories';
import { useTransactionsStore } from '@/stores/transactions';
import { usePreferencesStore } from '@/stores/preferences';

const authStore = useAuthStore();
const accountsStore = useAccountsStore();
const categoriesStore = useCategoriesStore();
const transactionsStore = useTransactionsStore();
const preferencesStore = usePreferencesStore();

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
  { to: '/settings/currency', label: 'Currency' }
];
</script>
