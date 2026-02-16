<template>
  <section class="space-y-4">
    <article class="card bg-base-100 shadow">
      <div class="card-body space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="card-title">Monthly Close Workflow</h2>
          <span class="badge badge-outline">Immutable snapshots</span>
        </div>

        <div class="grid gap-3 sm:grid-cols-3">
          <label class="form-control">
            <span class="label-text">Month</span>
            <input v-model="selectedMonth" type="month" class="input input-bordered" />
          </label>
          <label class="form-control sm:col-span-2">
            <span class="label-text">Reopen reason (required for reopen)</span>
            <input v-model.trim="reopenReason" type="text" class="input input-bordered" placeholder="Correction, late statement, etc." />
          </label>
        </div>

        <div v-if="selectedClosure && selectedClosure.status === 'closed'" class="alert alert-warning text-sm">
          <span>
            {{ selectedMonth }} is closed since {{ formatDateTime(selectedClosure.closedAt) }}.
            Transactions in this month are locked.
          </span>
        </div>
        <div v-else class="alert alert-info text-sm">
          <span>{{ selectedMonth }} is currently open.</span>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            class="btn btn-primary"
            :disabled="!canCloseMonth"
            @click="closeMonth"
          >
            Close month
          </button>
          <button
            class="btn btn-outline"
            :disabled="!canReopenMonth"
            @click="reopenMonth"
          >
            Reopen month
          </button>
        </div>

        <p class="text-xs opacity-70">
          Close permission: owner/editor. Reopen permission: owner only.
        </p>

        <p v-if="statusMessage" class="text-xs" :class="statusKind === 'error' ? 'text-error' : 'text-success'">
          {{ statusMessage }}
        </p>
      </div>
    </article>

    <article class="card bg-base-100 shadow">
      <div class="card-body">
        <h2 class="card-title">Closed Months</h2>
        <ul class="space-y-3">
          <li
            v-for="closure in monthClosuresStore.sortedClosures"
            :key="closure.id"
            class="rounded-lg border border-base-300 p-3"
          >
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p class="font-medium">
                  {{ closure.monthKey }}
                  <span class="badge badge-outline ml-2" :class="closure.status === 'closed' ? 'badge-warning' : ''">
                    {{ closure.status }}
                  </span>
                </p>
                <p class="text-xs opacity-65">
                  Closed {{ formatDateTime(closure.closedAt) }}
                  <span v-if="closure.closedBy?.displayName">by {{ closure.closedBy.displayName }}</span>
                </p>
                <p v-if="closure.reopenedAt" class="text-xs opacity-65">
                  Reopened {{ formatDateTime(closure.reopenedAt) }}
                  <span v-if="closure.reopenedBy?.displayName">by {{ closure.reopenedBy.displayName }}</span>
                </p>
              </div>
              <div class="text-right text-sm">
                <p>Tx: <strong>{{ closure.snapshot?.summary?.txCount ?? 0 }}</strong></p>
                <p>Inflow: <strong>{{ formatAmount(closure.snapshot?.summary?.inflow) }}</strong></p>
                <p>Outflow: <strong>{{ formatAmount(closure.snapshot?.summary?.outflow) }}</strong></p>
              </div>
            </div>
            <details class="mt-2">
              <summary class="cursor-pointer text-sm opacity-80">Snapshot details</summary>
              <div class="mt-2 grid gap-2 lg:grid-cols-2">
                <div class="rounded-md bg-base-200/60 p-2">
                  <p class="text-xs font-semibold opacity-70">Accounts</p>
                  <ul class="mt-1 space-y-1 text-xs">
                    <li v-for="account in closure.snapshot?.accounts ?? []" :key="account.accountId">
                      {{ account.accountName }}: {{ formatAmount(account.net) }} (close {{ formatAmount(account.closingBalance) }})
                    </li>
                    <li v-if="!(closure.snapshot?.accounts ?? []).length" class="opacity-65">No account rows</li>
                  </ul>
                </div>
                <div class="rounded-md bg-base-200/60 p-2">
                  <p class="text-xs font-semibold opacity-70">Categories</p>
                  <ul class="mt-1 space-y-1 text-xs">
                    <li v-for="category in closure.snapshot?.categories ?? []" :key="category.categoryId">
                      {{ category.categoryName }}: +{{ formatAmount(category.income) }} / -{{ formatAmount(category.expense) }}
                    </li>
                    <li v-if="!(closure.snapshot?.categories ?? []).length" class="opacity-65">No category rows</li>
                  </ul>
                </div>
              </div>
            </details>
          </li>
          <li v-if="!monthClosuresStore.sortedClosures.length" class="text-sm opacity-65">
            No closed months yet.
          </li>
        </ul>
      </div>
    </article>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useCurrencyStore } from '@/stores/currency';
import { useHouseholdStore } from '@/stores/household';
import { useMonthClosuresStore } from '@/stores/monthClosures';
import { toMonthKey } from '@/utils/dates';

const monthClosuresStore = useMonthClosuresStore();
const householdStore = useHouseholdStore();
const currencyStore = useCurrencyStore();

if (!monthClosuresStore.initialized) {
  monthClosuresStore.init();
}
if (!householdStore.initialized) {
  householdStore.init();
}

const selectedMonth = ref(toMonthKey(new Date()));
const reopenReason = ref('');
const statusMessage = ref('');
const statusKind = ref('success');

const selectedClosure = computed(() => monthClosuresStore.closureByMonth(selectedMonth.value));
const canCloseMonth = computed(
  () => householdStore.canEditFinancialData && !(selectedClosure.value && selectedClosure.value.status === 'closed')
);
const canReopenMonth = computed(
  () =>
    householdStore.canReopenMonths &&
    Boolean(selectedClosure.value && selectedClosure.value.status === 'closed') &&
    reopenReason.value.trim().length > 0
);

function setStatus(kind, message) {
  statusKind.value = kind;
  statusMessage.value = message;
}

function formatDateTime(value) {
  if (!value) return 'Unknown';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function formatAmount(value) {
  return currencyStore.formatCurrency(Number(value || 0), currencyStore.mainCurrency);
}

function closeMonth() {
  try {
    monthClosuresStore.closeMonth(selectedMonth.value);
    setStatus('success', `${selectedMonth.value} closed successfully.`);
  } catch (error) {
    setStatus('error', error.message ?? 'Failed to close month.');
  }
}

function reopenMonth() {
  try {
    monthClosuresStore.reopenMonth(selectedMonth.value, reopenReason.value);
    setStatus('success', `${selectedMonth.value} reopened.`);
    reopenReason.value = '';
  } catch (error) {
    setStatus('error', error.message ?? 'Failed to reopen month.');
  }
}
</script>
