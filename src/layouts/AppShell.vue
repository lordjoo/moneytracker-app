<template>
  <div class="min-h-screen bg-base-200">
    <header v-if="!isFullscreen" class="sticky top-0 z-40 border-b border-base-300 bg-base-100/90 backdrop-blur">
      <div class="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <RouterLink to="/" class="flex items-center gap-2 text-lg font-semibold">
          <span class="btn btn-circle btn-sm bg-primary text-primary-content border-none">₿</span>
          <span>MyMoney</span>
        </RouterLink>
        <div class="ms-auto flex items-center gap-3">
          <p class="hidden text-sm font-medium opacity-80 sm:block">
            Net worth: {{ netWorthLabel }}
            <span v-if="showNetWorthHint" class="text-xs opacity-60">(partial)</span>
          </p>
          <button class="btn btn-outline btn-sm" @click="toggleTheme" :aria-label="themeLabel">
            <component :is="themeIcon" class="h-4 w-4" />
          </button>
          <RouterLink to="/settings" class="btn btn-ghost btn-sm">
            Settings
          </RouterLink>
        </div>
      </div>
      <nav v-if="!isFullscreen" class="hidden border-t border-base-300 bg-base-100/80 sm:block">
        <div class="mx-auto flex max-w-5xl items-center px-4">
          <RouterLink
            v-for="item in navigation"
            :key="item.to"
            :to="item.to"
            class="-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition"
            :class="item.active ? 'border-primary text-primary' : 'border-transparent opacity-70 hover:opacity-100'"
          >
            <component :is="item.icon" class="h-4 w-4" />
            <span>{{ item.label }}</span>
          </RouterLink>
        </div>
      </nav>
    </header>

    <main
      :class="[
        'mx-auto flex w-full flex-1 flex-col px-4 pb-24 pt-4 sm:pb-8',
        isFullscreen ? 'max-w-6xl' : 'max-w-5xl'
      ]"
    >
      <RouterView v-slot="{ Component }">
        <Transition name="fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>

    <nav
      v-if="!isFullscreen"
      class="btm-nav z-40 border-t border-base-300 bg-base-100/90 sm:hidden"
    >
      <RouterLink
        v-for="item in navigation"
        :key="item.to"
        :to="item.to"
        :class="item.active ? 'active text-primary' : ''"
        class="text-xs"
      >
        <component :is="item.icon" class="h-5 w-5" />
        {{ item.label }}
      </RouterLink>
    </nav>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import {
  MoonIcon,
  SunIcon,
  HomeModernIcon,
  BanknotesIcon,
  ArrowsRightLeftIcon,
  TagIcon,
  Cog6ToothIcon
} from '@heroicons/vue/24/outline';
import { useAuthStore } from '@/stores/auth';
import { useAccountsStore } from '@/stores/accounts';
import { useTransactionsStore } from '@/stores/transactions';
import { useCategoriesStore } from '@/stores/categories';
import { usePreferencesStore } from '@/stores/preferences';
import { useCurrencyStore } from '@/stores/currency';

const route = useRoute();
const authStore = useAuthStore();
const accountsStore = useAccountsStore();
const transactionsStore = useTransactionsStore();
const categoriesStore = useCategoriesStore();
const preferencesStore = usePreferencesStore();
const currencyStore = useCurrencyStore();

preferencesStore.init();

const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
const defaultTheme = prefersDark ? 'mymoney-dark' : 'mymoney-light';
const theme = ref(preferencesStore.activeTheme || defaultTheme);

const isFullscreen = computed(() => Boolean(route.meta?.fullscreen));

const navigation = computed(() => [
  { to: '/', label: 'Dashboard', icon: HomeModernIcon, active: route.path === '/' },
  { to: '/accounts', label: 'Accounts', icon: BanknotesIcon, active: route.path.startsWith('/accounts') },
  { to: '/transactions', label: 'Transactions', icon: ArrowsRightLeftIcon, active: route.path.startsWith('/transactions') },
  { to: '/categories', label: 'Categories', icon: TagIcon, active: route.path.startsWith('/categories') },
  { to: '/settings', label: 'Settings', icon: Cog6ToothIcon, active: route.path.startsWith('/settings') }
]);

const themeIcon = computed(() => (theme.value === 'mymoney-dark' ? SunIcon : MoonIcon));
const themeLabel = computed(() =>
  theme.value === 'mymoney-dark' ? 'Switch to light theme' : 'Switch to dark theme'
);

const netWorthLabel = computed(() =>
  currencyStore.formatCurrency(currencyStore.totalWorthInMain.value)
);
const showNetWorthHint = computed(
  () => currencyStore.accountsMissingConversion.value.length > 0
);

onMounted(async () => {
  applyTheme();
  accountsStore.init();
  transactionsStore.init();
  categoriesStore.init();
  authStore.init();
});

watch(
  () => preferencesStore.activeTheme,
  (next) => {
    if (next && next !== theme.value) {
      theme.value = next;
      applyTheme();
    }
  }
);

function applyTheme() {
  document.documentElement.setAttribute('data-theme', theme.value);
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute('content', theme.value === 'mymoney-dark' ? '#0b1120' : '#f8fafc');
  }
  if (preferencesStore.activeTheme !== theme.value) {
    preferencesStore.setTheme(theme.value);
  }
}

function toggleTheme() {
  theme.value = theme.value === 'mymoney-dark' ? 'mymoney-light' : 'mymoney-dark';
  applyTheme();
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
