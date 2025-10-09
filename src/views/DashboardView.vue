<template>
  <div class="space-y-6">
    <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <article class="card bg-base-100 shadow">
        <div class="card-body">
          <h2 class="card-title">Total Net Worth</h2>
          <p class="text-3xl font-semibold">{{ formatCurrency(totalWorth) }}</p>
          <p class="text-xs opacity-70">Across {{ accountsStore.accounts.length }} accounts</p>
        </div>
      </article>
      <article class="card bg-base-100 shadow">
        <div class="card-body">
          <h2 class="card-title">Spent This Month</h2>
          <p class="text-3xl font-semibold text-error">{{ formatCurrency(currentMonth.spent) }}</p>
          <p :class="currentMonth.deltaClass">{{ currentMonth.deltaLabel }}</p>
        </div>
      </article>
      <article class="card bg-base-100 shadow sm:col-span-2 lg:col-span-1">
        <div class="card-body">
          <h2 class="card-title">Saved This Month</h2>
          <p class="text-3xl font-semibold text-success">{{ formatCurrency(currentMonth.saved) }}</p>
          <p class="text-xs opacity-70">Inflow minus outflow</p>
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
            <li v-for="account in accountsStore.sortedAccounts" :key="account.id" class="flex items-center justify-between py-3">
            <div>
              <p class="font-medium flex items-center gap-2">
                {{ account.name }}
                <span v-if="account.isClosed" class="badge badge-outline badge-xs">Closed</span>
              </p>
              <p class="text-xs opacity-70">Cycle day: {{ account.cycleDay ? account.cycleDay : 'None set' }}</p>
            </div>
            <div class="text-right">
              <p class="font-semibold">{{ formatCurrency(account.balance) }}</p>
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
            <RouterLink to="/categories" class="link text-xs">Manage categories</RouterLink>
          </div>
          <ul class="space-y-3">
            <li v-for="category in topSpendingCategories" :key="category.id" class="space-y-1">
              <div class="flex items-center justify-between text-sm">
                <div class="flex items-center gap-2">
                  <CategoryIcon :icon="category.icon" class="h-5 w-5" />
                  <span>{{ category.name }}</span>
                </div>
                <span class="font-medium text-error">{{ formatCurrency(category.total) }}</span>
              </div>
              <progress class="progress progress-error" :value="category.percentage" max="100"></progress>
            </li>
            <li v-if="!topSpendingCategories.length" class="text-sm opacity-60">No spending recorded yet.</li>
          </ul>
        </div>
      </article>
      <article class="card bg-base-100 shadow">
        <div class="card-body gap-4">
          <div class="flex items-center justify-between">
            <h2 class="card-title">Recent Transactions</h2>
            <RouterLink to="/transactions" class="link text-xs">See all</RouterLink>
          </div>
          <ul class="space-y-3">
            <li v-for="tx in visibleRecentTransactions" :key="tx.id" class="flex items-center justify-between text-sm">
              <div class="flex items-center gap-3">
                <CategoryIcon :icon="transactionIcon(tx)" class="h-6 w-6" />
                <div>
                  <p class="font-medium">{{ renderTransactionTitle(tx) }}</p>
                  <p class="opacity-60">
                    {{ formatDate(tx.occurredAt) }}
                  </p>
                </div>
              </div>
              <span :class="txClass(tx)">{{ formatCurrency(txSign(tx) * tx.amount) }}</span>
            </li>
            <li v-if="!visibleRecentTransactions.length" class="text-sm opacity-60">
              Add your first transaction to populate insights.
            </li>
          </ul>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useTransactionsStore } from '@/stores/transactions';
import { useCategoriesStore } from '@/stores/categories';
import { RouterLink } from 'vue-router';
import CategoryIcon from '@/components/CategoryIcon.vue';

const accountsStore = useAccountsStore();
const transactionsStore = useTransactionsStore();
const categoriesStore = useCategoriesStore();

if (!accountsStore.initialized) {
  accountsStore.init();
}
if (!transactionsStore.initialized) {
  transactionsStore.init();
}
if (!categoriesStore.initialized) {
  categoriesStore.init();
}

const totalWorth = computed(() => accountsStore.totalWorth);

const currentMonth = computed(() => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  let spent = 0;
  let saved = 0;
  let prevSpent = 0;

  for (const tx of transactionsStore.transactions) {
    const account = accountsStore.accountById(tx.accountId);
    if (!account || account.isClosed) continue;
    const date = tx.occurredAt ?? tx.createdAt ?? new Date();
    const amount = Number(tx.amount) || 0;
    const isExpense = tx.type === 'debit' || (tx.type === 'transfer' && tx.direction === 'outgoing');
    const isIncome = tx.type === 'credit' || (tx.type === 'transfer' && tx.direction === 'incoming');

    if (date >= startOfMonth) {
      if (isExpense) spent += amount;
      if (isIncome) saved += amount;
    } else if (date >= startOfPrevMonth && date <= endOfPrevMonth) {
      if (isExpense) prevSpent += amount;
    }
  }

  const delta = spent - prevSpent;
  const deltaLabel = prevSpent
    ? `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta / prevSpent * 100).toFixed(1)}% vs last month`
    : 'First month of tracking';
  const deltaClass = delta >= 0 ? 'text-error text-xs' : 'text-success text-xs';

  return {
    spent,
    saved: Math.max(saved - spent, 0),
    deltaLabel,
    deltaClass
  };
});

const topSpendingCategories = computed(() => {
  const totals = new Map();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  for (const tx of transactionsStore.transactions) {
    const account = accountsStore.accountById(tx.accountId);
    if (!account || account.isClosed) continue;
    const date = tx.occurredAt ?? tx.createdAt ?? new Date();
    if (date < startOfMonth) continue;
    const isExpense = tx.type === 'debit' || (tx.type === 'transfer' && tx.direction === 'outgoing');
    if (!isExpense) continue;
    const key = tx.categoryId ?? 'uncategorized';
    const amount = Number(tx.amount) || 0;
    totals.set(key, (totals.get(key) ?? 0) + amount);
  }

  const entries = Array.from(totals.entries())
    .map(([categoryId, total]) => {
      const category = categoriesStore.byId(categoryId) ?? { name: 'Uncategorized', icon: '' };
      return {
        id: categoryId,
        name: category.name,
        icon: category.icon,
        total
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const max = entries[0]?.total ?? 1;

  return entries.map((entry) => ({
    ...entry,
    percentage: Math.round((entry.total / max) * 100)
  }));
});

const recentTransactions = computed(() => transactionsStore.transactions.slice(0, 5));
const visibleRecentTransactions = computed(() =>
  recentTransactions.value.filter((tx) => !accountsStore.accountById(tx.accountId)?.isClosed)
);

function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD'
  }).format(Number(value ?? 0));
}

function formatDate(date) {
  return date ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date) : 'Unknown date';
}

function renderTransactionTitle(tx) {
  if (tx.type === 'transfer') {
    return `${tx.direction === 'outgoing' ? 'Sent to' : 'Received from'} ${accountsStore.accountById(tx.counterpartyAccountId)?.name ?? 'Account'}`;
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
</script>
