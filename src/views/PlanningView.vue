<template>
  <div class="space-y-6">
    <header class="rounded-2xl bg-gradient-to-br from-primary/15 via-base-100 to-secondary/10 p-5 shadow">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-2xl font-semibold">Planning</h1>
          <p class="text-sm opacity-75">
            Budgets, recurring transactions, and goals in one workspace.
          </p>
        </div>
        <div class="grid grid-cols-3 gap-2 text-xs sm:text-sm">
          <div class="rounded-lg bg-base-100/90 px-3 py-2 text-center">
            <p class="opacity-60">Budgets</p>
            <p class="font-semibold">{{ budgetSummaries.length }}</p>
          </div>
          <div class="rounded-lg bg-base-100/90 px-3 py-2 text-center">
            <p class="opacity-60">Due</p>
            <p class="font-semibold">{{ visibleRecurringDueCount }}</p>
          </div>
          <div class="rounded-lg bg-base-100/90 px-3 py-2 text-center">
            <p class="opacity-60">Goals</p>
            <p class="font-semibold">{{ goalSummaries.length }}</p>
          </div>
        </div>
      </div>
    </header>

    <div class="tabs tabs-boxed w-full overflow-x-auto">
      <button
        v-for="item in tabs"
        :key="item.key"
        type="button"
        class="tab whitespace-nowrap"
        :class="{ 'tab-active': activeTab === item.key }"
        @click="activeTab = item.key"
      >
        {{ item.label }}
      </button>
    </div>

    <div v-if="!canEditFinancialData" class="alert alert-info text-sm">
      <span>Your role is read-only. Planning edits are disabled.</span>
    </div>

    <section v-if="activeTab === 'budgets'" class="space-y-4">
      <article class="card bg-base-100 shadow">
        <div class="card-body gap-4">
          <div class="flex items-center justify-between">
            <h2 class="card-title">Monthly Budgets</h2>
            <span class="badge badge-outline">{{ currentMonthLabel }}</span>
          </div>

          <form class="grid gap-3 md:grid-cols-5" @submit.prevent="saveBudget">
            <label class="form-control md:col-span-2">
              <span class="label-text">Category</span>
              <select v-model="budgetForm.categoryId" class="select select-bordered" required>
                <option disabled value="">Choose category</option>
                <option v-for="category in expenseCategories" :key="category.id" :value="category.id">
                  {{ category.name }}
                </option>
              </select>
            </label>
            <label class="form-control">
              <span class="label-text">Budget</span>
              <input
                v-model.number="budgetForm.amount"
                type="number"
                min="0"
                step="0.01"
                class="input input-bordered"
                required
              />
            </label>
            <label class="form-control">
              <span class="label-text">Thresholds</span>
              <input
                v-model.trim="budgetForm.thresholds"
                type="text"
                class="input input-bordered"
                placeholder="80,100,120"
              />
            </label>
            <div class="form-control justify-end">
              <label class="label cursor-pointer justify-start gap-2">
                <input v-model="budgetForm.rolloverEnabled" type="checkbox" class="checkbox checkbox-primary checkbox-sm" />
                <span class="label-text">Rollover</span>
              </label>
              <div class="mt-2 flex gap-2">
                <button type="button" class="btn btn-ghost btn-sm" @click="resetBudgetForm">Reset</button>
                <button type="submit" class="btn btn-primary btn-sm" :disabled="!canEditFinancialData">{{ budgetForm.id ? 'Update' : 'Save' }}</button>
              </div>
            </div>
          </form>

          <ul class="grid gap-3 md:grid-cols-2">
            <li v-for="summary in budgetSummaries" :key="summary.id" class="rounded-xl border border-base-300 p-4">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="font-medium">{{ categoryName(summary.categoryId) }}</p>
                  <p class="text-xs opacity-65">
                    Budget {{ formatCurrency(summary.budgetAmount) }}
                    <span v-if="summary.rolloverEnabled"> • rollover on</span>
                  </p>
                </div>
                <div class="flex gap-1">
                  <button class="btn btn-ghost btn-xs" :disabled="!canEditFinancialData" @click="editBudget(summary.id)">Edit</button>
                  <button class="btn btn-ghost btn-xs text-error" :disabled="!canEditFinancialData" @click="removeBudget(summary.id)">Delete</button>
                </div>
              </div>
              <div class="mt-3 space-y-2">
                <div class="flex items-center justify-between text-sm">
                  <span>Spent: {{ formatCurrency(summary.spent) }}</span>
                  <span :class="summary.remaining < 0 ? 'text-error' : 'text-success'">
                    {{ summary.remaining < 0 ? 'Over' : 'Left' }}: {{ formatCurrency(Math.abs(summary.remaining)) }}
                  </span>
                </div>
                <progress
                  class="progress"
                  :class="summary.breachedThreshold ? 'progress-warning' : 'progress-primary'"
                  :value="Math.min(summary.usagePercent, 100)"
                  max="100"
                ></progress>
                <p class="text-xs opacity-60">
                  Using {{ summary.usagePercent.toFixed(1) }}% of {{ formatCurrency(summary.available) }} available
                </p>
              </div>
            </li>
            <li v-if="!budgetSummaries.length" class="rounded-xl border border-dashed border-base-300 p-6 text-sm opacity-70">
              Add your first monthly budget to start tracking category limits.
            </li>
          </ul>
        </div>
      </article>
    </section>

    <section v-else-if="activeTab === 'recurring'" class="space-y-4">
      <article class="card bg-base-100 shadow">
        <div class="card-body gap-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="card-title">Recurring Transactions</h2>
            <div class="flex gap-2">
              <button class="btn btn-outline btn-sm" :disabled="!canEditFinancialData" @click="recurringStore.syncDueItems()">Sync due</button>
              <button
                class="btn btn-primary btn-sm"
                :disabled="!visibleRecurringDueCount || !canEditFinancialData"
                @click="postAllDue"
              >
                Post all due ({{ visibleRecurringDueCount }})
              </button>
            </div>
          </div>

          <form class="grid gap-3 md:grid-cols-6" @submit.prevent="saveRecurringRule">
            <label class="form-control md:col-span-2">
              <span class="label-text">Name</span>
              <input v-model.trim="recurringForm.name" type="text" class="input input-bordered" required />
            </label>
            <label class="form-control">
              <span class="label-text">Type</span>
              <select v-model="recurringForm.type" class="select select-bordered" required>
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
                <option value="transfer">Transfer</option>
              </select>
            </label>
            <label class="form-control">
              <span class="label-text">Amount</span>
              <input
                v-model.number="recurringForm.amount"
                type="number"
                min="0"
                step="0.01"
                class="input input-bordered"
                required
              />
            </label>
            <label class="form-control">
              <span class="label-text">Source account</span>
              <select v-model="recurringForm.accountId" class="select select-bordered" required>
                <option disabled value="">Select</option>
                <option v-for="account in openAccounts" :key="account.id" :value="account.id">
                  {{ account.name }}
                </option>
              </select>
            </label>
            <label v-if="recurringForm.type !== 'transfer'" class="form-control md:col-span-2">
              <span class="label-text">Category</span>
              <select v-model="recurringForm.categoryId" class="select select-bordered" required>
                <option disabled value="">Select</option>
                <option
                  v-for="category in recurringCategories"
                  :key="category.id"
                  :value="category.id"
                >
                  {{ category.name }}
                </option>
              </select>
            </label>
            <label v-else class="form-control md:col-span-2">
              <span class="label-text">Destination account</span>
              <select v-model="recurringForm.counterpartyAccountId" class="select select-bordered" required>
                <option disabled value="">Select</option>
                <option
                  v-for="account in transferTargets"
                  :key="account.id"
                  :value="account.id"
                >
                  {{ account.name }}
                </option>
              </select>
            </label>
            <label class="form-control">
              <span class="label-text">Frequency</span>
              <select v-model="recurringForm.frequency" class="select select-bordered" required>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="every-n-days">Every N days</option>
              </select>
            </label>
            <label v-if="recurringForm.frequency === 'every-n-days'" class="form-control">
              <span class="label-text">Interval (days)</span>
              <input
                v-model.number="recurringForm.intervalDays"
                type="number"
                min="1"
                class="input input-bordered"
              />
            </label>
            <label v-else-if="recurringForm.frequency === 'monthly'" class="form-control">
              <span class="label-text">Day of month</span>
              <input
                v-model.number="recurringForm.dayOfMonth"
                type="number"
                min="1"
                max="31"
                class="input input-bordered"
              />
            </label>
            <label class="form-control">
              <span class="label-text">Next run</span>
              <input v-model="recurringForm.nextRunOn" type="date" class="input input-bordered" required />
            </label>
            <label class="form-control md:col-span-2">
              <span class="label-text">Note</span>
              <input v-model.trim="recurringForm.note" type="text" class="input input-bordered" />
            </label>
            <div class="form-control justify-end">
              <label class="label cursor-pointer justify-start gap-2">
                <input v-model="recurringForm.isActive" type="checkbox" class="checkbox checkbox-primary checkbox-sm" />
                <span class="label-text">Active</span>
              </label>
              <div class="mt-2 flex gap-2">
                <button type="button" class="btn btn-ghost btn-sm" @click="resetRecurringForm">Reset</button>
                <button type="submit" class="btn btn-primary btn-sm" :disabled="!canEditFinancialData">{{ recurringForm.id ? 'Update' : 'Save' }}</button>
              </div>
            </div>
          </form>

          <div class="grid gap-4 lg:grid-cols-2">
            <article class="rounded-xl border border-base-300 p-4">
              <h3 class="font-medium">Due now</h3>
              <ul class="mt-2 space-y-2 text-sm">
                <li
                  v-for="instance in visibleDueInstances"
                  :key="instance.id"
                  class="rounded-lg bg-base-200/50 p-3"
                >
                  <div class="flex items-center justify-between gap-2">
                    <div>
                      <p class="font-medium">{{ recurringRuleName(instance.ruleId) }}</p>
                      <p class="text-xs opacity-65">Due {{ formatDateKey(instance.dueOn) }}</p>
                    </div>
                    <div class="flex gap-1">
                      <button class="btn btn-ghost btn-xs text-success" :disabled="!canEditFinancialData" @click="postDue(instance.id)">Post</button>
                      <button class="btn btn-ghost btn-xs" :disabled="!canEditFinancialData" @click="skipDue(instance.id)">Skip</button>
                    </div>
                  </div>
                </li>
                <li v-if="!visibleDueInstances.length" class="text-xs opacity-65">No due recurring items.</li>
              </ul>
            </article>

            <article class="rounded-xl border border-base-300 p-4">
              <h3 class="font-medium">Rules</h3>
              <ul class="mt-2 space-y-2 text-sm">
                <li
                  v-for="rule in visibleRecurringRules"
                  :key="rule.id"
                  class="rounded-lg bg-base-200/50 p-3"
                >
                  <div class="flex items-center justify-between gap-2">
                    <div>
                      <p class="font-medium">{{ rule.name }}</p>
                      <p class="text-xs opacity-65">
                        {{ rule.type }} • {{ formatCurrency(rule.amount) }} • next {{ formatDateKey(rule.nextRunOn) }}
                      </p>
                    </div>
                    <div class="flex gap-1">
                      <button class="btn btn-ghost btn-xs" :disabled="!canEditFinancialData" @click="editRecurringRule(rule.id)">Edit</button>
                      <button
                        class="btn btn-ghost btn-xs"
                        :disabled="!canEditFinancialData"
                        :class="rule.isActive ? 'text-warning' : 'text-success'"
                        @click="toggleRecurringRule(rule.id)"
                      >
                        {{ rule.isActive ? 'Pause' : 'Resume' }}
                      </button>
                      <button class="btn btn-ghost btn-xs text-error" :disabled="!canEditFinancialData" @click="removeRecurringRule(rule.id)">Delete</button>
                    </div>
                  </div>
                </li>
                <li v-if="!visibleRecurringRules.length" class="text-xs opacity-65">
                  Add rules for salary, rent, subscriptions, and more.
                </li>
              </ul>
            </article>
          </div>
        </div>
      </article>
    </section>

    <section v-else class="space-y-4">
      <article class="card bg-base-100 shadow">
        <div class="card-body gap-4">
          <h2 class="card-title">Savings Goals</h2>

          <form class="grid gap-3 md:grid-cols-6" @submit.prevent="saveGoal">
            <label class="form-control md:col-span-2">
              <span class="label-text">Goal name</span>
              <input v-model.trim="goalForm.name" type="text" class="input input-bordered" required />
            </label>
            <label class="form-control">
              <span class="label-text">Target amount</span>
              <input
                v-model.number="goalForm.targetAmount"
                type="number"
                min="0"
                step="0.01"
                class="input input-bordered"
                required
              />
            </label>
            <label class="form-control">
              <span class="label-text">Target date</span>
              <input v-model="goalForm.targetDate" type="date" class="input input-bordered" />
            </label>
            <label class="form-control md:col-span-2">
              <span class="label-text">Tracked category (optional)</span>
              <select v-model="goalForm.contributionCategoryId" class="select select-bordered">
                <option value="">Manual only</option>
                <option
                  v-for="category in incomeCategories"
                  :key="category.id"
                  :value="category.id"
                >
                  {{ category.name }}
                </option>
              </select>
            </label>

            <div class="form-control md:col-span-4">
              <span class="label-text">Linked accounts (optional)</span>
              <div class="mt-1 flex flex-wrap gap-2 rounded-lg border border-base-300 p-3">
                <label v-for="account in openAccounts" :key="account.id" class="label cursor-pointer gap-2 p-0">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm checkbox-primary"
                    :checked="goalForm.linkedAccountIds.includes(account.id)"
                    @change="toggleGoalAccount(account.id, $event.target.checked)"
                  />
                  <span class="label-text">{{ account.name }}</span>
                </label>
                <span v-if="!openAccounts.length" class="text-xs opacity-65">Create an account first.</span>
              </div>
            </div>

            <div class="form-control justify-end">
              <div class="mt-7 flex gap-2">
                <button type="button" class="btn btn-ghost btn-sm" @click="resetGoalForm">Reset</button>
                <button type="submit" class="btn btn-primary btn-sm" :disabled="!canEditFinancialData">{{ goalForm.id ? 'Update' : 'Save' }}</button>
              </div>
            </div>
          </form>

          <ul class="grid gap-3 md:grid-cols-2">
            <li v-for="summary in goalSummaries" :key="summary.id" class="rounded-xl border border-base-300 p-4">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="font-medium">{{ summary.name }}</p>
                  <p class="text-xs opacity-65">
                    {{ formatCurrency(summary.total) }} / {{ formatCurrency(summary.targetAmount) }}
                  </p>
                  <p v-if="summary.targetDate" class="text-xs opacity-60">Target {{ formatDateKey(summary.targetDate) }}</p>
                </div>
                <div class="flex gap-1">
                  <button class="btn btn-ghost btn-xs" :disabled="!canEditFinancialData" @click="editGoal(summary.id)">Edit</button>
                  <button class="btn btn-ghost btn-xs text-error" :disabled="!canEditFinancialData" @click="removeGoal(summary.id)">Delete</button>
                </div>
              </div>
              <div class="mt-3 space-y-2">
                <progress class="progress progress-success" :value="summary.progressPercent" max="100"></progress>
                <p class="text-xs opacity-70">
                  {{ summary.progressPercent.toFixed(1) }}% complete • Remaining {{ formatCurrency(summary.remaining) }}
                </p>
                <p class="text-xs opacity-60">
                  Tracked {{ formatCurrency(summary.tracked) }} • Manual {{ formatCurrency(summary.manual) }}
                </p>
              </div>
              <form class="mt-3 flex gap-2" @submit.prevent="addContribution(summary.id)">
                <input
                  v-model.number="contributionForms[summary.id]"
                  type="number"
                  min="0"
                  step="0.01"
                  class="input input-bordered input-sm w-full"
                  placeholder="Add manual contribution"
                />
                <button type="submit" class="btn btn-sm btn-outline" :disabled="!canEditFinancialData">Add</button>
              </form>
            </li>
            <li v-if="!goalSummaries.length" class="rounded-xl border border-dashed border-base-300 p-6 text-sm opacity-70">
              Add your first goal to track progress toward savings milestones.
            </li>
          </ul>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { useCategoriesStore } from '@/stores/categories';
import { useCurrencyStore } from '@/stores/currency';
import { useBudgetsStore } from '@/stores/budgets';
import { useRecurringStore } from '@/stores/recurring';
import { useGoalsStore } from '@/stores/goals';
import { useHouseholdStore } from '@/stores/household';
import { toDateKey, toMonthKey } from '@/utils/dates';

const tabs = [
  { key: 'budgets', label: 'Budgets' },
  { key: 'recurring', label: 'Recurring' },
  { key: 'goals', label: 'Goals' }
];

const activeTab = ref('budgets');

const accountsStore = useAccountsStore();
const categoriesStore = useCategoriesStore();
const currencyStore = useCurrencyStore();
const budgetsStore = useBudgetsStore();
const recurringStore = useRecurringStore();
const goalsStore = useGoalsStore();
const householdStore = useHouseholdStore();

if (!accountsStore.initialized) accountsStore.init();
if (!categoriesStore.initialized) categoriesStore.init();
if (!budgetsStore.initialized) budgetsStore.init();
if (!recurringStore.initialized) recurringStore.init();
if (!goalsStore.initialized) goalsStore.init();
if (!householdStore.initialized) householdStore.init();

onMounted(() => {
  recurringStore.syncDueItems();
});

const openAccounts = computed(() => accountsStore.visibleOpenAccounts);
const expenseCategories = computed(() => categoriesStore.expenseCategories);
const incomeCategories = computed(() => categoriesStore.incomeCategories);
const currentMonthKey = computed(() => toMonthKey(new Date()));
const currentMonthLabel = computed(() =>
  new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date())
);

const budgetForm = reactive({
  id: '',
  categoryId: '',
  amount: 0,
  rolloverEnabled: false,
  thresholds: '80,100,120'
});

const recurringForm = reactive({
  id: '',
  name: '',
  type: 'debit',
  accountId: '',
  counterpartyAccountId: '',
  categoryId: '',
  amount: 0,
  note: '',
  frequency: 'monthly',
  intervalDays: 30,
  dayOfMonth: new Date().getDate(),
  nextRunOn: toDateKey(new Date()),
  isActive: true
});

const goalForm = reactive({
  id: '',
  name: '',
  targetAmount: 0,
  targetDate: '',
  linkedAccountIds: [],
  contributionCategoryId: ''
});

const contributionForms = reactive({});

const budgetSummaries = computed(() => budgetsStore.getMonthlySummary(currentMonthKey.value));
const goalSummaries = computed(() => goalsStore.getAllGoalSummaries());
const recurringCategories = computed(() =>
  recurringForm.type === 'credit' ? incomeCategories.value : expenseCategories.value
);
const transferTargets = computed(() =>
  openAccounts.value.filter((account) => account.id !== recurringForm.accountId)
);
const visibleRecurringRules = computed(() =>
  recurringStore.rules.filter((rule) => {
    if (!accountsStore.isAccountVisible(rule.accountId)) return false;
    if (rule.type === 'transfer' && !accountsStore.isAccountVisible(rule.counterpartyAccountId)) return false;
    return true;
  })
);
const visibleRuleIds = computed(() => new Set(visibleRecurringRules.value.map((rule) => rule.id)));
const visibleDueInstances = computed(() =>
  recurringStore.dueInstances.filter((instance) => visibleRuleIds.value.has(instance.ruleId))
);
const visibleRecurringDueCount = computed(() => visibleDueInstances.value.length);
const canEditFinancialData = computed(() => householdStore.canEditFinancialData);

function formatCurrency(value, currency = currencyStore.mainCurrency) {
  return currencyStore.formatCurrency(value, currency);
}

function formatDateKey(dateKey) {
  if (!dateKey) return 'No date';
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function categoryName(categoryId) {
  return categoriesStore.byId(categoryId)?.name ?? 'Unknown';
}

function parseThresholds(text) {
  return String(text ?? '')
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function resetBudgetForm() {
  Object.assign(budgetForm, {
    id: '',
    categoryId: '',
    amount: 0,
    rolloverEnabled: false,
    thresholds: '80,100,120'
  });
}

function saveBudget() {
  try {
    budgetsStore.upsertBudget({
      id: budgetForm.id || undefined,
      categoryId: budgetForm.categoryId,
      amount: budgetForm.amount,
      rolloverEnabled: budgetForm.rolloverEnabled,
      alertThresholds: parseThresholds(budgetForm.thresholds)
    });
    resetBudgetForm();
  } catch (error) {
    alert(error.message ?? 'Failed to save budget');
  }
}

function editBudget(id) {
  const target = budgetsStore.budgetById(id);
  if (!target) return;
  Object.assign(budgetForm, {
    id: target.id,
    categoryId: target.categoryId,
    amount: target.amount,
    rolloverEnabled: target.rolloverEnabled,
    thresholds: (target.alertThresholds ?? [80, 100, 120]).join(',')
  });
}

function removeBudget(id) {
  budgetsStore.removeBudget(id);
  if (budgetForm.id === id) {
    resetBudgetForm();
  }
}

function resetRecurringForm() {
  Object.assign(recurringForm, {
    id: '',
    name: '',
    type: 'debit',
    accountId: '',
    counterpartyAccountId: '',
    categoryId: '',
    amount: 0,
    note: '',
    frequency: 'monthly',
    intervalDays: 30,
    dayOfMonth: new Date().getDate(),
    nextRunOn: toDateKey(new Date()),
    isActive: true
  });
}

function saveRecurringRule() {
  try {
    recurringStore.upsertRule({
      id: recurringForm.id || undefined,
      name: recurringForm.name,
      type: recurringForm.type,
      accountId: recurringForm.accountId,
      counterpartyAccountId: recurringForm.counterpartyAccountId,
      categoryId: recurringForm.categoryId,
      amount: recurringForm.amount,
      note: recurringForm.note,
      frequency: recurringForm.frequency,
      intervalDays: recurringForm.intervalDays,
      dayOfMonth: recurringForm.dayOfMonth,
      nextRunOn: recurringForm.nextRunOn,
      isActive: recurringForm.isActive
    });
    resetRecurringForm();
  } catch (error) {
    alert(error.message ?? 'Failed to save recurring rule');
  }
}

function editRecurringRule(id) {
  const target = recurringStore.ruleById(id);
  if (!target) return;
  Object.assign(recurringForm, {
    id: target.id,
    name: target.name,
    type: target.type,
    accountId: target.accountId,
    counterpartyAccountId: target.counterpartyAccountId || '',
    categoryId: target.categoryId || '',
    amount: target.amount,
    note: target.note || '',
    frequency: target.frequency || 'monthly',
    intervalDays: target.intervalDays || 30,
    dayOfMonth: target.dayOfMonth ?? new Date().getDate(),
    nextRunOn: target.nextRunOn || toDateKey(new Date()),
    isActive: target.isActive
  });
}

function removeRecurringRule(id) {
  recurringStore.removeRule(id);
  if (recurringForm.id === id) {
    resetRecurringForm();
  }
}

function toggleRecurringRule(id) {
  const target = recurringStore.ruleById(id);
  if (!target) return;
  recurringStore.setRuleActive(id, !target.isActive);
}

function recurringRuleName(ruleId) {
  return recurringStore.ruleById(ruleId)?.name ?? 'Recurring item';
}

async function postDue(instanceId) {
  try {
    await recurringStore.postInstance(instanceId);
  } catch (error) {
    alert(error.message ?? 'Failed to post recurring item');
  }
}

function skipDue(instanceId) {
  recurringStore.skipInstance(instanceId);
}

async function postAllDue() {
  try {
    for (const instance of visibleDueInstances.value) {
      await recurringStore.postInstance(instance.id);
    }
  } catch (error) {
    alert(error.message ?? 'Failed to post all due items');
  }
}

function resetGoalForm() {
  Object.assign(goalForm, {
    id: '',
    name: '',
    targetAmount: 0,
    targetDate: '',
    linkedAccountIds: [],
    contributionCategoryId: ''
  });
}

function toggleGoalAccount(accountId, enabled) {
  const set = new Set(goalForm.linkedAccountIds);
  if (enabled) {
    set.add(accountId);
  } else {
    set.delete(accountId);
  }
  goalForm.linkedAccountIds = [...set];
}

function saveGoal() {
  try {
    goalsStore.upsertGoal({
      id: goalForm.id || undefined,
      name: goalForm.name,
      targetAmount: goalForm.targetAmount,
      targetDate: goalForm.targetDate || null,
      linkedAccountIds: goalForm.linkedAccountIds,
      contributionCategoryId: goalForm.contributionCategoryId
    });
    resetGoalForm();
  } catch (error) {
    alert(error.message ?? 'Failed to save goal');
  }
}

function editGoal(id) {
  const target = goalsStore.goalById(id);
  if (!target) return;
  Object.assign(goalForm, {
    id: target.id,
    name: target.name,
    targetAmount: target.targetAmount,
    targetDate: target.targetDate || '',
    linkedAccountIds: [...(target.linkedAccountIds ?? [])],
    contributionCategoryId: target.contributionCategoryId || ''
  });
}

function removeGoal(id) {
  goalsStore.removeGoal(id);
  if (goalForm.id === id) {
    resetGoalForm();
  }
}

function addContribution(goalId) {
  const raw = Number(contributionForms[goalId]);
  if (!Number.isFinite(raw) || raw <= 0) {
    return;
  }
  try {
    goalsStore.addManualContribution(goalId, {
      amount: raw,
      date: toDateKey(new Date())
    });
    contributionForms[goalId] = '';
  } catch (error) {
    alert(error.message ?? 'Failed to add contribution');
  }
}
</script>
