<template>
  <div class="space-y-6">
    <section class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Dashboard</h1>
        <p class="text-sm opacity-70">{{ currentCycleLabel }}</p>
      </div>
      <div class="flex w-full flex-col gap-2 rounded-lg border border-base-300 bg-base-100 p-2 shadow-sm lg:w-auto lg:min-w-[34rem]">
        <div class="flex items-center justify-between gap-2">
          <span class="px-2 text-xs font-medium uppercase opacity-60">Period</span>
          <button class="btn btn-ghost btn-xs" type="button" @click="selectedMonthKey = currentMonthKey">
            Current
          </button>
        </div>
        <div class="grid grid-cols-[auto_1fr_auto] gap-2">
          <button class="btn btn-outline btn-square" type="button" aria-label="Previous month" @click="moveSelectedMonth(-1)">
            <ChevronLeftIcon class="h-5 w-5" />
          </button>
          <label class="form-control">
            <span class="sr-only">Month / Year</span>
            <select v-model="selectedMonthKey" class="select select-bordered w-full">
              <option v-for="option in monthOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>
          <button class="btn btn-outline btn-square" type="button" aria-label="Next month" @click="moveSelectedMonth(1)">
            <ChevronRightIcon class="h-5 w-5" />
          </button>
        </div>
      </div>
    </section>

    <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <article class="card bg-base-100 shadow">
        <div class="card-body">
          <h2 class="card-title">Total Net Worth</h2>
          <p class="text-3xl font-semibold">{{ formatCurrency(totalWorth) }}</p>
          <p class="text-xs opacity-70">Across {{ accountsStore.visibleAccounts.length }} accounts</p>
        </div>
      </article>
      <article class="card bg-base-100 shadow">
        <div class="card-body">
          <h2 class="card-title">Spent This Month</h2>
          <p class="text-3xl font-semibold text-error">{{ formatCurrency(currentMonth.spent) }}</p>
          <p :class="currentMonth.deltaClass">{{ currentMonth.deltaLabel }}</p>
          <p class="text-xs opacity-70">{{ currentCycleLabel }}</p>
          <p v-if="currentMonth.pending" class="text-xs opacity-60">Waiting for exchange rates…</p>
        </div>
      </article>
      <article class="card bg-base-100 shadow sm:col-span-2 lg:col-span-1">
        <div class="card-body">
          <h2 class="card-title">Saved This Month</h2>
          <p class="text-3xl font-semibold text-success">{{ formatCurrency(currentMonth.saved) }}</p>
          <p class="text-xs opacity-70">Previous month: {{ formatCurrency(previousMonth.saved) }}</p>
          <p :class="savedDeltaClass">{{ savedDeltaLabel }}</p>
        </div>
      </article>
    </section>

    <section class="grid gap-4 lg:grid-cols-3">
      <article class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <h2 class="card-title text-base">Budget Health</h2>
            <RouterLink to="/planning" class="link text-xs">Open planning</RouterLink>
          </div>
          <p class="text-2xl font-semibold">{{ planningSnapshot.averageBudgetUsage.toFixed(1) }}%</p>
          <p class="text-xs opacity-70">Average usage across {{ planningSnapshot.budgetCount }} monthly budgets</p>
          <p v-if="planningSnapshot.overBudgetCount" class="text-xs text-error">
            {{ planningSnapshot.overBudgetCount }} categories over budget
          </p>
        </div>
      </article>
      <article class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <h2 class="card-title text-base">Recurring Due</h2>
            <RouterLink to="/planning" class="link text-xs">Review now</RouterLink>
          </div>
          <p class="text-2xl font-semibold">{{ visibleRecurringDueCount }}</p>
          <p class="text-xs opacity-70">Pending recurring items waiting to post</p>
          <button
            class="btn btn-outline btn-sm mt-2 w-fit"
            :disabled="!visibleRecurringDueCount"
            @click="postAllDue"
          >
            Post all due
          </button>
        </div>
      </article>
      <article class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <h2 class="card-title text-base">Goals Progress</h2>
            <RouterLink to="/planning" class="link text-xs">View goals</RouterLink>
          </div>
          <p class="text-2xl font-semibold">{{ planningSnapshot.averageGoalProgress.toFixed(1) }}%</p>
          <p class="text-xs opacity-70">Average completion across {{ planningSnapshot.goalCount }} goals</p>
          <progress class="progress progress-success mt-2" :value="planningSnapshot.averageGoalProgress" max="100"></progress>
        </div>
      </article>
    </section>

    <section class="card bg-base-100 shadow">
      <div class="card-body">
        <div class="flex flex-wrap items-center gap-3">
          <h2 class="card-title">Account Cycles</h2>
          <span class="badge badge-outline">Better monthly tracking</span>
        </div>
          <ul class="divide-y divide-base-300">
            <li v-for="account in accountsStore.visibleSortedAccounts" :key="account.id" class="flex items-center justify-between py-3">
              <div>
                <p class="font-medium flex items-center gap-2">
                  {{ account.name }}
                  <span v-if="account.isClosed" class="badge badge-outline badge-xs">Closed</span>
                  <span v-if="account.excludeFromHousehold" class="badge badge-warning badge-xs">Private</span>
                </p>
                <p class="text-xs opacity-70">Cycle day: {{ account.cycleDay ? account.cycleDay : 'None set' }}</p>
                <p class="text-xs opacity-70">
                  Currency: {{ account.currency }}
                </p>
              </div>
              <div class="text-right">
                <p class="font-semibold">{{ formatCurrency(account.balance, account.currency) }}</p>
                <p
                  v-if="account.currency !== currencyStore.mainCurrency && accountBalanceInBase(account.id) !== null"
                  class="text-xs opacity-60"
                >
                  ≈ {{ formatCurrency(accountBalanceInBase(account.id)) }}
                </p>
                <p
                  v-else-if="account.currency !== currencyStore.mainCurrency && hasCurrencyToken"
                  class="text-xs opacity-60"
                >
                  Conversion pending…
                </p>
                <RouterLink :to="`/accounts/${account.id}`" class="link text-xs">View details</RouterLink>
              </div>
            </li>
          </ul>
        </div>
    </section>

    <section class="grid gap-4 lg:grid-cols-2">
      <article class="card bg-base-100 shadow">
        <div class="card-body gap-4">
          <div class="flex items-center justify-between">
            <h2 class="card-title">Top Spending Categories</h2>
            <RouterLink :to="{ name: 'spending-categories', query: { month: selectedMonthKey } }" class="link text-xs">View report</RouterLink>
          </div>
          <ul class="space-y-3">
            <li v-for="category in topSpendingCategories.categories" :key="category.id" class="space-y-1">
              <div class="flex items-center justify-between text-sm">
                <div class="flex items-center gap-2">
                  <CategoryIcon :icon="category.icon" class="h-5 w-5" />
                  <span>{{ category.name }}</span>
                </div>
                <span class="font-medium text-error">{{ formatCurrency(category.total) }}</span>
              </div>
              <progress class="progress progress-error" :value="category.percentage" max="100"></progress>
            </li>
            <li v-if="!topSpendingCategories.categories.length" class="text-sm opacity-60">No spending recorded yet.</li>
          </ul>
          <p v-if="topSpendingCategories.pending" class="text-xs opacity-60">Waiting for exchange rates…</p>
        </div>
      </article>
      <article class="card bg-base-100 shadow">
        <div class="card-body gap-4">
          <div class="flex items-center justify-between">
            <h2 class="card-title">Recent Transactions</h2>
            <RouterLink to="/transactions" class="link text-xs">See all</RouterLink>
          </div>
          <ul class="space-y-3">
            <li v-for="item in recentTransactionSummaries" :key="item.tx.id" class="flex items-center justify-between text-sm">
              <div class="flex items-center gap-3">
                <CategoryIcon :icon="transactionIcon(item.tx)" class="h-6 w-6" />
                <div>
                  <p class="font-medium">{{ renderTransactionTitle(item.tx) }}</p>
                  <p class="opacity-60">
                    {{ formatDate(item.tx.occurredAt) }}
                  </p>
                </div>
              </div>
              <div class="text-right">
                <span :class="txClass(item.tx)">{{ item.primary }}</span>
                <p v-if="item.converted" class="text-xs opacity-60">
                  ≈ {{ item.converted }}
                </p>
                <p v-else-if="item.pendingConversion" class="text-xs opacity-60">Conversion pending…</p>
              </div>
            </li>
            <li v-if="!recentTransactionSummaries.length" class="text-sm opacity-60">
              Add your first transaction to populate insights.
            </li>
          </ul>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/vue/24/outline';
import { useAccountsStore } from '@/stores/accounts';
import { useTransactionsStore } from '@/stores/transactions';
import { useCategoriesStore } from '@/stores/categories';
import { useCurrencyStore } from '@/stores/currency';
import { useBudgetsStore } from '@/stores/budgets';
import { useRecurringStore } from '@/stores/recurring';
import { useGoalsStore } from '@/stores/goals';
import { RouterLink } from 'vue-router';
import { shiftMonthKey } from '@/utils/dates';
import { useSpendingInsights } from '@/composables/useSpendingInsights';
import CategoryIcon from '@/components/CategoryIcon.vue';

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

const selectedMonthKey = ref(currentMonthKey.value);
const monthOptions = computed(() => buildMonthOptions(24));
const currentCycleStats = computed(() => summarizeCycle(transactionsStore.transactions, selectedMonthKey.value));
const previousMonthKey = computed(() => shiftMonthKey(selectedMonthKey.value, -1));
const previousCycleStats = computed(() => summarizeCycle(transactionsStore.transactions, previousMonthKey.value));
const currentCycleLabel = computed(() => formatCycleLabel(currentCycleStats.value.bounds));

watch(currentMonthKey, (next) => {
  if (!selectedMonthKey.value) {
    selectedMonthKey.value = next;
  }
});

const totalWorth = computed(() => {
  const target = currencyStore.mainCurrency;
  let total = 0;
  for (const account of accountsStore.visibleAccounts) {
    const amount = Number(account.balance) || 0;
    const sourceCurrency = account.currency || target;
    if (sourceCurrency === target) {
      total += amount;
      continue;
    }
    const converted = currencyStore.convertAmount(amount, sourceCurrency, target, {
      requestIfMissing: false
    });
    if (converted !== null) {
      total += converted;
    }
  }
  return total;
});
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

  return {
    budgetCount,
    overBudgetCount,
    averageBudgetUsage,
    goalCount,
    averageGoalProgress
  };
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
  const deltaClass = delta >= 0 ? 'text-error text-xs' : 'text-success text-xs';

  return {
    spent: current.spent,
    saved: current.saved,
    deltaLabel,
    deltaClass,
    pending: current.pending
  };
});

const previousMonth = computed(() => previousCycleStats.value);

const savedDelta = computed(() => currentMonth.value.saved - previousMonth.value.saved);
const savedDeltaLabel = computed(() => {
  if (!previousMonth.value.saved) return 'First month of savings data';
  const direction = savedDelta.value >= 0 ? '▲' : '▼';
  return `${direction} ${Math.abs((savedDelta.value / previousMonth.value.saved) * 100).toFixed(1)}% vs last month`;
});
const savedDeltaClass = computed(() =>
  savedDelta.value >= 0 ? 'text-success text-xs' : 'text-error text-xs'
);

const topSpendingCategories = computed(() => {
  const entries = currentCycleStats.value.categories.slice(0, 5);

  return {
    pending: currentCycleStats.value.pending,
    categories: entries
  };
});

const recentTransactions = computed(() =>
  transactionsStore.transactions.filter((tx) => accountsStore.isAccountVisible(tx.accountId)).slice(0, 5)
);
const visibleRecentTransactions = computed(() =>
  recentTransactions.value.filter((tx) => !accountsStore.visibleAccountById(tx.accountId)?.isClosed)
);

function formatCurrency(value, currency = currencyStore.mainCurrency) {
  return currencyStore.formatCurrency(value, currency);
}

const accountConversions = currencyStore.convertedAccountBalances;
const hasCurrencyToken = computed(() => currencyStore.hasToken);

function accountBalanceInBase(accountId) {
  return accountConversions?.get?.(accountId) ?? null;
}

const recentTransactionSummaries = computed(() =>
  visibleRecentTransactions.value.map((tx) => {
    const account = accountsStore.visibleAccountById(tx.accountId);
    const baseAmount = convertAmountForAccount(Number(tx.amount) || 0, account);
    const sign = txSign(tx);
    const accountCurrency = account?.currency || currencyStore.mainCurrency;
    const primary = formatCurrency(sign * (Number(tx.amount) || 0), accountCurrency);
    const converted =
      accountCurrency !== currencyStore.mainCurrency && !baseAmount.pending
        ? formatCurrency(sign * baseAmount.value)
        : null;
    const pendingConversion =
      accountCurrency !== currencyStore.mainCurrency && baseAmount.pending;
    return {
      tx,
      primary,
      converted,
      pendingConversion
    };
  })
);

function formatDate(date) {
  return date ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date) : 'Unknown date';
}

function renderTransactionTitle(tx) {
  if (tx.type === 'transfer') {
    return `${tx.direction === 'outgoing' ? 'Sent to' : 'Received from'} ${accountsStore.visibleAccountById(tx.counterpartyAccountId)?.name ?? 'Account'}`;
  }
  const categoryName = categoriesStore.byId(tx.categoryId)?.name ?? 'Uncategorized';
  return `${categoryName}`;
}

function transactionIcon(tx) {
  if (tx.type === 'transfer') {
    return categoriesStore.byId(tx.categoryId)?.icon ?? 'banknotes';
  }
  return categoriesStore.byId(tx.categoryId)?.icon ?? '';
}

function txSign(tx) {
  if (tx.type === 'debit' || (tx.type === 'transfer' && tx.direction === 'outgoing')) return -1;
  return 1;
}

function txClass(tx) {
  return txSign(tx) > 0 ? 'text-success font-medium' : 'text-error font-medium';
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
