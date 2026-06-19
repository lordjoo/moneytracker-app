<template>
  <div class="min-h-screen bg-base-200">
    <header v-if="!isFullscreen" class="sticky top-0 z-40 border-b border-base-300 bg-base-100/85 backdrop-blur-md">
      <div class="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <RouterLink to="/" class="flex items-center gap-2.5 font-bold tracking-tight">
          <AppLogo :size="36" class="shadow-sm rounded-xl" />
          <span class="text-lg">MyMoney</span>
        </RouterLink>
        <div class="ms-auto flex items-center gap-2">
          <div class="mr-1 hidden text-right sm:block">
            <p class="text-[0.7rem] font-medium uppercase tracking-wide text-base-content/45">Net worth</p>
            <p class="-mt-0.5 text-sm font-semibold tnum">
              {{ netWorthLabel }}
              <span v-if="showNetWorthHint" class="text-xs font-normal text-base-content/50">(partial)</span>
            </p>
          </div>
          <button class="btn btn-ghost btn-sm btn-square" @click="toggleTheme" :aria-label="themeLabel">
            <component :is="themeIcon" class="h-5 w-5" />
          </button>
          <RouterLink to="/more" class="btn btn-ghost btn-sm btn-square sm:hidden" aria-label="More">
            <EllipsisHorizontalCircleIcon class="h-5 w-5" />
          </RouterLink>
        </div>
      </div>
      <nav v-if="!isFullscreen" class="hidden border-t border-base-300 bg-base-100/60 sm:block">
        <div class="mx-auto flex max-w-5xl items-center gap-1 px-3">
          <RouterLink
            v-for="item in navigation"
            :key="item.to"
            :to="item.to"
            class="-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition"
            :class="item.active ? 'border-primary text-primary' : 'border-transparent text-base-content/60 hover:text-base-content'"
          >
            <component :is="item.icon" class="h-4 w-4" />
            <span>{{ item.label }}</span>
          </RouterLink>
        </div>
      </nav>
    </header>

    <section
      v-if="backupSyncStore.showBanner"
      class="mx-auto w-full max-w-5xl px-4 pt-4"
    >
      <div class="alert shadow-sm" :class="backupAlertClass">
        <div class="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
          <span class="flex-1 text-sm">{{ backupSyncStore.bannerMessage }}</span>
          <div class="flex shrink-0 items-center gap-2">
            <button
              v-if="backupSyncStore.canPush"
              class="btn btn-primary btn-xs"
              :disabled="backupSyncStore.status === 'pushing' || backupSyncStore.status === 'pulling'"
              :class="{ loading: backupSyncStore.status === 'pushing' }"
              @click="pushBackup"
            >
              Push Local
            </button>
            <button
              v-if="backupSyncStore.canPull"
              class="btn btn-outline btn-xs"
              :disabled="backupSyncStore.status === 'pushing' || backupSyncStore.status === 'pulling'"
              :class="{ loading: backupSyncStore.status === 'pulling' }"
              @click="pullBackup"
            >
              Pull Cloud
            </button>
            <button
              v-if="backupSyncStore.hasConflict"
              class="btn btn-outline btn-xs"
              @click="exportLocalBackup"
            >
              Export
            </button>
            <RouterLink
              v-if="backupSyncStore.hasConflict"
              to="/settings/backup"
              class="btn btn-primary btn-xs"
            >
              Resolve
            </RouterLink>
            <button class="btn btn-ghost btn-xs btn-square" aria-label="Dismiss backup alert" @click="backupSyncStore.dismissBanner()">
              <XMarkIcon class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      <p v-if="backupSyncStore.lastError" class="px-1 pt-1 text-xs text-error">
        {{ backupSyncStore.lastError }}
      </p>
    </section>

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
  EllipsisHorizontalCircleIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline';
import AppLogo from '@/components/AppLogo.vue';
import { useAuthStore } from '@/stores/auth';
import { useAccountsStore } from '@/stores/accounts';
import { useTransactionsStore } from '@/stores/transactions';
import { useCategoriesStore } from '@/stores/categories';
import { usePreferencesStore } from '@/stores/preferences';
import { useCurrencyStore } from '@/stores/currency';
import { useBudgetsStore } from '@/stores/budgets';
import { useRecurringStore } from '@/stores/recurring';
import { useGoalsStore } from '@/stores/goals';
import { useHouseholdStore } from '@/stores/household';
import { useMonthClosuresStore } from '@/stores/monthClosures';
import { useBackupSyncStore } from '@/stores/backupSync';

const route = useRoute();
const authStore = useAuthStore();
const accountsStore = useAccountsStore();
const transactionsStore = useTransactionsStore();
const categoriesStore = useCategoriesStore();
const preferencesStore = usePreferencesStore();
const currencyStore = useCurrencyStore();
const budgetsStore = useBudgetsStore();
const recurringStore = useRecurringStore();
const goalsStore = useGoalsStore();
const householdStore = useHouseholdStore();
const monthClosuresStore = useMonthClosuresStore();
const backupSyncStore = useBackupSyncStore();

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
  {
    to: '/more',
    label: 'More',
    icon: EllipsisHorizontalCircleIcon,
    active:
      route.path.startsWith('/more') ||
      route.path.startsWith('/settings') ||
      route.path.startsWith('/planning') ||
      route.path.startsWith('/spending')
  }
]);

const themeIcon = computed(() => (theme.value === 'mymoney-dark' ? SunIcon : MoonIcon));
const themeLabel = computed(() =>
  theme.value === 'mymoney-dark' ? 'Switch to light theme' : 'Switch to dark theme'
);

const netWorthLabel = computed(() =>
  currencyStore.formatCurrency(currencyStore.totalWorthInMain)
);
const showNetWorthHint = computed(
  () => (currencyStore.accountsMissingConversion || []).length > 0
);
const backupAlertClass = computed(() => {
  if (backupSyncStore.pendingMode === 'conflict') return 'alert-warning';
  if (backupSyncStore.pendingMode === 'pull') return 'alert-info';
  if (backupSyncStore.pendingMode === 'push') return 'alert-accent';
  return 'alert-info';
});

onMounted(async () => {
  applyTheme();
  await authStore.init();
  accountsStore.init();
  transactionsStore.init();
  categoriesStore.init();
  budgetsStore.init();
  recurringStore.init();
  goalsStore.init();
  householdStore.init();
  monthClosuresStore.init();
  backupSyncStore.init();
  recurringStore.syncDueItems();
  try {
    await householdStore.handleAuthStateChanged();
  } catch (error) {
    console.error('Initial household cloud sync failed', error);
  }
  try {
    await backupSyncStore.handleAuthChange();
  } catch (error) {
    console.error('Initial backup sync metadata check failed', error);
  }
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

watch(
  () => authStore.user?.uid ?? '',
  async () => {
    try {
      await householdStore.handleAuthStateChanged();
    } catch (error) {
      console.error('Household cloud sync failed after auth state change', error);
    }
    try {
      backupSyncStore.init();
      await backupSyncStore.handleAuthChange();
    } catch (error) {
      console.error('Backup cloud metadata check failed after auth state change', error);
    }
  }
);

function applyTheme() {
  document.documentElement.setAttribute('data-theme', theme.value);
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute('content', theme.value === 'mymoney-dark' ? '#1A1613' : '#F4F1ED');
  }
  if (preferencesStore.activeTheme !== theme.value) {
    preferencesStore.setTheme(theme.value);
  }
}

function toggleTheme() {
  theme.value = theme.value === 'mymoney-dark' ? 'mymoney-light' : 'mymoney-dark';
  applyTheme();
}

async function pushBackup() {
  try {
    await backupSyncStore.pushNow();
  } catch (error) {
    console.error('Push backup from banner failed', error);
  }
}

async function pullBackup() {
  if (!confirm('Pull cloud backup now? Local data on this device will be replaced.')) {
    return;
  }
  try {
    await backupSyncStore.pullNow();
  } catch (error) {
    console.error('Pull backup from banner failed', error);
  }
}

function exportLocalBackup() {
  try {
    backupSyncStore.exportLocalBackup();
  } catch (error) {
    console.error('Local export from banner failed', error);
  }
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
