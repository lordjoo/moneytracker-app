<template>
  <div class="space-y-6">
    <!-- Title + period -->
    <section class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Overview</h1>
        <p class="text-sm text-base-content/60">{{ currentCycleLabel }}</p>
      </div>
      <div class="flex items-center gap-0.5 self-start rounded-xl border border-base-300 bg-base-100 p-1 shadow-sm">
        <button class="btn btn-ghost btn-sm btn-square" type="button" aria-label="Previous month" @click="moveSelectedMonth(-1)">
          <ChevronLeftIcon class="h-4 w-4" />
        </button>
        <label class="relative flex min-w-[8.5rem] cursor-pointer items-center justify-center gap-1 rounded-lg px-2 py-1.5 hover:bg-base-200">
          <span class="text-sm font-semibold">{{ selectedMonthLabel }}</span>
          <ChevronDownIcon class="h-3.5 w-3.5 text-base-content/50" />
          <select
            v-model="selectedMonthKey"
            class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label="Select month"
          >
            <option v-for="option in monthOptions" :key="option.value" :value="option.value">
              {{ option.shortLabel }}
            </option>
          </select>
        </label>
        <button class="btn btn-ghost btn-sm btn-square" type="button" aria-label="Next month" @click="moveSelectedMonth(1)">
          <ChevronRightIcon class="h-4 w-4" />
        </button>
        <button
          class="btn btn-ghost btn-sm"
          :class="selectedMonthKey === currentMonthKey ? 'text-base-content/40' : 'text-primary'"
          type="button"
          :disabled="selectedMonthKey === currentMonthKey"
          @click="selectedMonthKey = currentMonthKey"
        >
          Today
        </button>
      </div>
    </section>

    <!-- Balance hero — one committed warm surface anchors the page -->
    <section class="overflow-hidden rounded-3xl bg-neutral text-neutral-content shadow-lg">
      <div class="flex flex-col gap-6 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
        <div>
          <p class="text-sm font-medium text-neutral-content/65">Net worth</p>
          <p class="amount-hero mt-1 text-4xl sm:text-5xl">{{ formatCurrency(netWorth) }}</p>
          <p v-if="showNetWorthHint" class="mt-1 text-xs text-neutral-content/55">Some balances awaiting exchange rates</p>
        </div>
        <div class="flex gap-3">
          <div class="flex-1 rounded-2xl bg-neutral-content/10 px-4 py-3 sm:min-w-[8.5rem]">
            <div class="flex items-center gap-1.5 text-xs font-medium text-neutral-content/65">
              <ArrowUpRightIcon class="h-3.5 w-3.5" /> Assets
            </div>
            <p class="amount-hero mt-1 text-lg">{{ formatCurrency(assetsTotal) }}</p>
          </div>
          <div class="flex-1 rounded-2xl bg-neutral-content/10 px-4 py-3 sm:min-w-[8.5rem]">
            <div class="flex items-center gap-1.5 text-xs font-medium text-neutral-content/65">
              <CreditCardIcon class="h-3.5 w-3.5" /> Owe
            </div>
            <p class="amount-hero mt-1 text-lg" :class="debtTotal > 0 ? 'text-error' : ''">
              {{ formatCurrency(debtTotal) }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- This month: spent / saved as a paired strip -->
    <section class="grid gap-4 sm:grid-cols-2">
      <div class="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-base-content/60">Spent this month</p>
          <span class="grid h-8 w-8 place-items-center rounded-full bg-error/10 text-error">
            <ArrowTrendingDownIcon class="h-4 w-4" />
          </span>
        </div>
        <p class="amount-hero mt-2 text-2xl">{{ formatCurrency(currentMonth.spent) }}</p>
        <p class="mt-1 text-xs" :class="currentMonth.deltaClass">{{ currentMonth.deltaLabel }}</p>
      </div>
      <div class="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-base-content/60">Saved this month</p>
          <span class="grid h-8 w-8 place-items-center rounded-full bg-success/10 text-success">
            <ArrowTrendingUpIcon class="h-4 w-4" />
          </span>
        </div>
        <p class="amount-hero mt-2 text-2xl" :class="currentMonth.saved >= 0 ? 'text-success' : 'text-error'">
          {{ formatCurrency(currentMonth.saved) }}
        </p>
        <p class="mt-1 text-xs" :class="savedDeltaClass">{{ savedDeltaLabel }}</p>
      </div>
    </section>

    <!-- Planning glance: budgets / recurring / goals as a compact row -->
    <section class="grid gap-3 sm:grid-cols-3">
      <RouterLink
        to="/planning"
        class="group flex items-center gap-3 rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md"
      >
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <ChartPieIcon class="h-5 w-5" />
        </span>
        <div class="min-w-0">
          <p class="text-lg font-semibold leading-tight tnum">{{ planningSnapshot.averageBudgetUsage.toFixed(0) }}%</p>
          <p class="truncate text-xs text-base-content/60">
            Budget used<span v-if="planningSnapshot.overBudgetCount" class="text-error"> · {{ planningSnapshot.overBudgetCount }} over</span>
          </p>
        </div>
      </RouterLink>
      <button
        type="button"
        class="group flex items-center gap-3 rounded-2xl border border-base-300 bg-base-100 p-4 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md disabled:opacity-60"
        :disabled="!visibleRecurringDueCount"
        @click="postAllDue"
      >
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary/15 text-secondary">
          <ArrowPathIcon class="h-5 w-5" />
        </span>
        <div class="min-w-0">
          <p class="text-lg font-semibold leading-tight tnum">{{ visibleRecurringDueCount }}</p>
          <p class="truncate text-xs text-base-content/60">
            {{ visibleRecurringDueCount ? 'Recurring — post all' : 'Recurring due' }}
          </p>
        </div>
      </button>
      <RouterLink
        to="/planning"
        class="group flex items-center gap-3 rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md"
      >
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-success/10 text-success">
          <FlagIcon class="h-5 w-5" />
        </span>
        <div class="min-w-0">
          <p class="text-lg font-semibold leading-tight tnum">{{ planningSnapshot.averageGoalProgress.toFixed(0) }}%</p>
          <p class="truncate text-xs text-base-content/60">Goals progress</p>
        </div>
      </RouterLink>
    </section>

    <!-- Accounts -->
    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">Accounts</h2>
        <RouterLink to="/accounts" class="text-sm font-medium text-primary hover:underline">Manage</RouterLink>
      </div>
      <div class="grid gap-3 stagger sm:grid-cols-2">
        <RouterLink
          v-for="account in dashboardAccounts"
          :key="account.id"
          :to="`/accounts/${account.id}`"
          class="block rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              <AccountAvatar :account="account" size="md" />
              <div>
                <p class="flex items-center gap-1.5 font-semibold leading-tight">
                  {{ account.name }}
                  <span v-if="account.excludeFromHousehold" class="badge badge-warning badge-xs">Private</span>
                </p>
                <p class="text-xs text-base-content/55">
                  {{ account.isCredit ? 'Credit card' : account.currency }}
                </p>
              </div>
            </div>
            <div class="text-right">
              <p class="amount-hero text-base" :class="account.isCredit && account.credit.owed > 0 ? 'text-error' : ''">
                {{ account.isCredit ? formatCurrency(account.credit.owed, account.currency) : formatCurrency(account.balance, account.currency) }}
              </p>
              <p class="text-[0.7rem] uppercase tracking-wide text-base-content/45">
                {{ account.isCredit ? 'owed' : 'balance' }}
              </p>
            </div>
          </div>
          <!-- Credit utilization meter -->
          <CreditUtilizationBar
            v-if="account.isCredit && account.credit.limit"
            class="mt-3"
            size="sm"
            :credit="account.credit"
            :currency="account.currency"
          />
        </RouterLink>
      </div>
      <p v-if="!dashboardAccounts.length" class="rounded-2xl border border-dashed border-base-300 bg-base-100 px-4 py-6 text-center text-sm text-base-content/60">
        No accounts yet. <RouterLink to="/accounts" class="font-medium text-primary hover:underline">Add one</RouterLink> to start tracking.
      </p>
    </section>

    <!-- Activity -->
    <section class="grid gap-4 lg:grid-cols-2">
      <article class="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="font-semibold">Top spending</h2>
          <RouterLink :to="{ name: 'spending-categories', query: { month: selectedMonthKey } }" class="text-sm font-medium text-primary hover:underline">Report</RouterLink>
        </div>
        <ul class="space-y-3.5">
          <li v-for="category in topSpendingCategories.categories" :key="category.id" class="space-y-1.5">
            <div class="flex items-center justify-between text-sm">
              <div class="flex items-center gap-2">
                <CategoryIcon :icon="category.icon" class="h-4 w-4 text-base-content/70" />
                <span class="font-medium">{{ category.name }}</span>
              </div>
              <span class="tnum font-semibold">{{ formatCurrency(category.total) }}</span>
            </div>
            <div class="h-1.5 w-full overflow-hidden rounded-full bg-base-300">
              <div class="h-full rounded-full bg-primary" :style="{ width: `${Math.max(3, category.percentage)}%` }"></div>
            </div>
          </li>
          <li v-if="!topSpendingCategories.categories.length" class="py-4 text-center text-sm text-base-content/55">No spending recorded yet.</li>
        </ul>
        <p v-if="topSpendingCategories.pending" class="mt-3 text-xs text-base-content/55">Waiting for exchange rates…</p>
      </article>

      <article class="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="font-semibold">Recent activity</h2>
          <RouterLink to="/transactions" class="text-sm font-medium text-primary hover:underline">See all</RouterLink>
        </div>
        <ul class="divide-y divide-base-300/70">
          <li v-for="item in recentTransactionSummaries" :key="item.tx.id" class="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <div class="flex min-w-0 items-center gap-3">
              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-base-200 text-base-content/70">
                <CategoryIcon :icon="getTransactionIcon(item.tx)" class="h-4 w-4" />
              </span>
              <div class="min-w-0">
                <p class="truncate text-sm font-medium">{{ getTransactionTitle(item.tx) }}</p>
                <p class="text-xs text-base-content/55">{{ formatDate(item.tx.occurredAt) }}</p>
              </div>
            </div>
            <div class="text-right">
              <span class="tnum text-sm font-semibold" :class="txClass(item.tx)">{{ item.primary }}</span>
              <p v-if="item.converted" class="text-xs text-base-content/55">≈ {{ item.converted }}</p>
              <p v-else-if="item.pendingConversion" class="text-xs text-base-content/55">pending…</p>
            </div>
          </li>
          <li v-if="!recentTransactionSummaries.length" class="py-4 text-center text-sm text-base-content/55">
            Add your first transaction to populate insights.
          </li>
        </ul>
      </article>
    </section>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ArrowUpRightIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  ChartPieIcon,
  ArrowPathIcon,
  FlagIcon,
  CreditCardIcon
} from '@heroicons/vue/24/outline';
import { useAccountsStore, describeCreditAccount } from '@/stores/accounts';
import { useTransactionsStore } from '@/stores/transactions';
import { useCategoriesStore } from '@/stores/categories';
import { useCurrencyStore } from '@/stores/currency';
import { useBudgetsStore } from '@/stores/budgets';
import { useRecurringStore } from '@/stores/recurring';
import { useGoalsStore } from '@/stores/goals';
import { RouterLink } from 'vue-router';
import { shiftMonthKey } from '@/utils/dates';
import { useSpendingInsights } from '@/composables/useSpendingInsights';
import { useTransactionHelpers } from '@/composables/useTransactionHelpers';
import CategoryIcon from '@/components/CategoryIcon.vue';
import AccountAvatar from '@/components/AccountAvatar.vue';
import CreditUtilizationBar from '@/components/CreditUtilizationBar.vue';

const accountsStore = useAccountsStore();
const transactionsStore = useTransactionsStore();
const categoriesStore = useCategoriesStore();
const budgetsStore = useBudgetsStore();
const recurringStore = useRecurringStore();
const goalsStore = useGoalsStore();

if (!accountsStore.initialized) {
  accountsStore.init();
}
if (!transactionsStore.initialized) {
  transactionsStore.init();
}
if (!categoriesStore.initialized) {
  categoriesStore.init();
}
if (!budgetsStore.initialized) {
  budgetsStore.init();
}
if (!recurringStore.initialized) {
  recurringStore.init();
}
if (!goalsStore.initialized) {
  goalsStore.init();
}
const currencyStore = useCurrencyStore();
recurringStore.syncDueItems();
const {
  currentMonthKey,
  buildMonthOptions,
  summarizeCycle,
  formatCycleLabel,
  convertAmountForAccount
} = useSpendingInsights();
const { getTransactionTitle, getTransactionIcon, getTransactionSign } = useTransactionHelpers();

const selectedMonthKey = ref(currentMonthKey.value);
const monthOptions = computed(() => buildMonthOptions(24));
const selectedMonthLabel = computed(
  () => monthOptions.value.find((option) => option.value === selectedMonthKey.value)?.shortLabel ?? ''
);
const currentCycleStats = computed(() => summarizeCycle(transactionsStore.transactions, selectedMonthKey.value));
const previousMonthKey = computed(() => shiftMonthKey(selectedMonthKey.value, -1));
const previousCycleStats = computed(() => summarizeCycle(transactionsStore.transactions, previousMonthKey.value));
const currentCycleLabel = computed(() => formatCycleLabel(currentCycleStats.value.bounds));

watch(currentMonthKey, (next) => {
  if (!selectedMonthKey.value) {
    selectedMonthKey.value = next;
  }
});

function convertedBalance(account) {
  const target = currencyStore.mainCurrency;
  const amount = Number(account.balance) || 0;
  const sourceCurrency = account.currency || target;
  if (sourceCurrency === target) return amount;
  const converted = currencyStore.convertAmount(amount, sourceCurrency, target, { requestIfMissing: false });
  return converted; // may be null when a rate is pending
}

const netWorth = computed(() => {
  let total = 0;
  for (const account of accountsStore.visibleAccounts) {
    const converted = convertedBalance(account);
    if (converted !== null) total += converted;
  }
  return total;
});

const assetsTotal = computed(() => {
  let total = 0;
  for (const account of accountsStore.visibleAccounts) {
    if (account.type === 'credit') continue;
    const converted = convertedBalance(account);
    if (converted !== null) total += Math.max(0, converted);
  }
  return total;
});

const debtTotal = computed(() => {
  let total = 0;
  for (const account of accountsStore.visibleAccounts) {
    if (account.type !== 'credit') continue;
    const converted = convertedBalance(account);
    if (converted !== null) total += Math.max(0, -converted);
  }
  return total;
});

const dashboardAccounts = computed(() =>
  accountsStore.visibleSortedAccounts
    .filter((account) => !account.isClosed)
    .map((account) => ({
      ...account,
      isCredit: account.type === 'credit',
      credit: describeCreditAccount(account)
    }))
);

const planningSnapshot = computed(() => {
  const budgetSummaries = budgetsStore.getMonthlySummary(selectedMonthKey.value);
  const budgetCount = budgetSummaries.length;
  const overBudgetCount = budgetSummaries.filter((entry) => entry.remaining < 0).length;
  const totalUsage = budgetSummaries.reduce((sum, entry) => sum + entry.usagePercent, 0);
  const averageBudgetUsage = budgetCount ? totalUsage / budgetCount : 0;

  const goalSummaries = goalsStore.getAllGoalSummaries();
  const goalCount = goalSummaries.length;
  const goalProgressTotal = goalSummaries.reduce((sum, entry) => sum + entry.progressPercent, 0);
  const averageGoalProgress = goalCount ? goalProgressTotal / goalCount : 0;

  return { budgetCount, overBudgetCount, averageBudgetUsage, goalCount, averageGoalProgress };
});

const visibleRecurringDueInstances = computed(() =>
  recurringStore.dueInstances.filter((instance) => {
    const rule = recurringStore.ruleById(instance.ruleId);
    if (!rule) return false;
    if (!accountsStore.isAccountVisible(rule.accountId)) return false;
    if (rule.type === 'transfer' && !accountsStore.isAccountVisible(rule.counterpartyAccountId)) return false;
    return true;
  })
);
const visibleRecurringDueCount = computed(() => visibleRecurringDueInstances.value.length);

const currentMonth = computed(() => {
  const current = currentCycleStats.value;
  const previous = previousCycleStats.value;
  const delta = current.spent - previous.spent;
  const deltaLabel = previous.spent
    ? `${delta >= 0 ? '▲' : '▼'} ${Math.abs((delta / previous.spent) * 100).toFixed(1)}% vs last month`
    : 'First month of tracking';
  const deltaClass = delta >= 0 ? 'text-error' : 'text-success';

  return { spent: current.spent, saved: current.saved, deltaLabel, deltaClass, pending: current.pending };
});

const previousMonth = computed(() => previousCycleStats.value);

const savedDelta = computed(() => currentMonth.value.saved - previousMonth.value.saved);
const savedDeltaLabel = computed(() => {
  if (!previousMonth.value.saved) return 'First month of savings data';
  const direction = savedDelta.value >= 0 ? '▲' : '▼';
  return `${direction} ${Math.abs((savedDelta.value / previousMonth.value.saved) * 100).toFixed(1)}% vs last month`;
});
const savedDeltaClass = computed(() => (savedDelta.value >= 0 ? 'text-success' : 'text-error'));

const topSpendingCategories = computed(() => {
  const entries = currentCycleStats.value.categories.slice(0, 5);
  return { pending: currentCycleStats.value.pending, categories: entries };
});

const recentTransactions = computed(() =>
  transactionsStore.transactions.filter((tx) => accountsStore.isAccountVisible(tx.accountId)).slice(0, 6)
);
const visibleRecentTransactions = computed(() =>
  recentTransactions.value.filter((tx) => !accountsStore.visibleAccountById(tx.accountId)?.isClosed)
);

function formatCurrency(value, currency = currencyStore.mainCurrency) {
  return currencyStore.formatCurrency(value, currency);
}

const showNetWorthHint = computed(() => (currencyStore.accountsMissingConversion || []).length > 0);

const recentTransactionSummaries = computed(() =>
  visibleRecentTransactions.value.map((tx) => {
    const account = accountsStore.visibleAccountById(tx.accountId);
    const baseAmount = convertAmountForAccount(Number(tx.amount) || 0, account);
    const sign = getTransactionSign(tx);
    const accountCurrency = account?.currency || currencyStore.mainCurrency;
    const primary = formatCurrency(sign * (Number(tx.amount) || 0), accountCurrency);
    const converted =
      accountCurrency !== currencyStore.mainCurrency && !baseAmount.pending
        ? formatCurrency(sign * baseAmount.value)
        : null;
    const pendingConversion = accountCurrency !== currencyStore.mainCurrency && baseAmount.pending;
    return { tx, primary, converted, pendingConversion };
  })
);

function formatDate(date) {
  return date ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date) : 'Unknown date';
}

function txClass(tx) {
  return getTransactionSign(tx) > 0 ? 'text-success' : 'text-base-content';
}

function moveSelectedMonth(delta) {
  selectedMonthKey.value = shiftMonthKey(selectedMonthKey.value, delta);
}

async function postAllDue() {
  try {
    for (const instance of visibleRecurringDueInstances.value) {
      await recurringStore.postInstance(instance.id);
    }
  } catch (error) {
    console.error('Failed to post recurring items from dashboard:', error);
    alert(error.message ?? 'Failed to post recurring items.');
  }
}
</script>
