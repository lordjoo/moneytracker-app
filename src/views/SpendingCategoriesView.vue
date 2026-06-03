<template>
  <div class="space-y-6">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Spending by Category</h1>
        <p class="text-sm opacity-70">{{ cycleLabel }}</p>
      </div>
      <label class="form-control w-full sm:w-80">
        <span class="label-text">Month / Year</span>
        <select v-model="selectedMonthKey" class="select select-bordered">
          <option v-for="option in monthOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>
    </header>

    <section class="grid gap-4 md:grid-cols-3">
      <article class="card bg-base-100 shadow">
        <div class="card-body">
          <p class="text-xs uppercase opacity-60">Total spent</p>
          <p class="text-3xl font-semibold text-error">{{ formatCurrency(report.spent) }}</p>
          <p v-if="report.pending" class="text-xs opacity-60">Waiting for exchange rates...</p>
        </div>
      </article>
      <article class="card bg-base-100 shadow">
        <div class="card-body">
          <p class="text-xs uppercase opacity-60">Categories</p>
          <p class="text-3xl font-semibold">{{ report.categories.length }}</p>
          <p class="text-xs opacity-70">With spend in this period</p>
        </div>
      </article>
      <article class="card bg-base-100 shadow">
        <div class="card-body">
          <p class="text-xs uppercase opacity-60">Transactions</p>
          <p class="text-3xl font-semibold">{{ report.expenseCount }}</p>
          <p class="text-xs opacity-70">Included in insights</p>
        </div>
      </article>
    </section>

    <section class="card bg-base-100 shadow">
      <div class="card-body gap-4">
        <div class="flex items-center justify-between">
          <h2 class="card-title">Categories</h2>
          <RouterLink to="/" class="link text-xs">Back to dashboard</RouterLink>
        </div>

        <ul v-if="report.categories.length" class="space-y-3">
          <li
            v-for="category in report.categories"
            :key="category.id"
            class="rounded-lg border border-base-300 p-3"
          >
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex min-w-0 items-center gap-3">
                <div class="rounded-lg bg-error/10 p-2 text-error">
                  <CategoryIcon :icon="category.icon" class="h-5 w-5" />
                </div>
                <div class="min-w-0">
                  <p class="font-medium">{{ category.name }}</p>
                  <p class="text-xs opacity-60">
                    {{ category.count }} transaction{{ category.count === 1 ? '' : 's' }}
                  </p>
                </div>
              </div>
              <div class="text-left sm:text-right">
                <p class="font-semibold text-error">{{ formatCurrency(category.total) }}</p>
                <p class="text-xs opacity-60">{{ category.percentage }}% of spending</p>
              </div>
            </div>
            <progress class="progress progress-error mt-3" :value="category.percentage" max="100"></progress>
          </li>
        </ul>

        <div v-else class="rounded-lg border border-dashed border-base-300 p-6 text-center text-sm opacity-70">
          No category spending for this period.
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useAccountsStore } from '@/stores/accounts';
import { useTransactionsStore } from '@/stores/transactions';
import { useCategoriesStore } from '@/stores/categories';
import { useCurrencyStore } from '@/stores/currency';
import { usePreferencesStore } from '@/stores/preferences';
import { useSpendingInsights } from '@/composables/useSpendingInsights';
import CategoryIcon from '@/components/CategoryIcon.vue';

const route = useRoute();
const router = useRouter();
const accountsStore = useAccountsStore();
const transactionsStore = useTransactionsStore();
const categoriesStore = useCategoriesStore();
const currencyStore = useCurrencyStore();
const preferencesStore = usePreferencesStore();

if (!preferencesStore.initialized) preferencesStore.init();
if (!accountsStore.initialized) accountsStore.init();
if (!transactionsStore.initialized) transactionsStore.init();
if (!categoriesStore.initialized) categoriesStore.init();

const {
  currentMonthKey,
  buildMonthOptions,
  summarizeCycle,
  formatCycleLabel
} = useSpendingInsights();

const initialMonth = typeof route.query.month === 'string' ? route.query.month : currentMonthKey.value;
const selectedMonthKey = ref(initialMonth || currentMonthKey.value);
const monthOptions = computed(() => buildMonthOptions(36));
const report = computed(() => summarizeCycle(transactionsStore.transactions, selectedMonthKey.value));
const cycleLabel = computed(() => formatCycleLabel(report.value.bounds));

watch(selectedMonthKey, (month) => {
  router.replace({
    query: {
      ...route.query,
      month
    }
  });
});

function formatCurrency(value) {
  return currencyStore.formatCurrency(value, currencyStore.mainCurrency);
}
</script>
