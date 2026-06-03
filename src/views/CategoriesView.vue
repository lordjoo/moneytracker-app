<template>
  <div class="space-y-6">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Categories</h1>
        <p class="text-sm opacity-70">Organize your transactions by creating custom income and expense categories.</p>
      </div>
      <button class="btn btn-primary" :disabled="!canEditFinancialData" @click="openFormFor()">New category</button>
    </header>

    <div v-if="!canEditFinancialData" class="alert alert-info text-sm">
      <span>Your role is read-only. Category changes are disabled.</span>
    </div>

    <section class="grid gap-4 md:grid-cols-2">
      <article class="card bg-base-100 shadow">
        <div class="card-body gap-4">
          <h2 class="card-title">Expense categories</h2>
          <ul class="space-y-3">
            <li v-for="category in expenseCategories" :key="category.id" class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <CategoryIcon :icon="category.icon" class="h-6 w-6" />
                <p class="font-medium">
                  {{ category.name }}
                  <span v-if="category.excludeByDefault" class="badge badge-ghost badge-xs ms-1">Excluded by default</span>
                </p>
              </div>
              <button class="btn btn-ghost btn-xs" :disabled="!canEditFinancialData" @click="openFormFor(category)">Edit</button>
            </li>
          </ul>
          <p v-if="!expenseCategories.length" class="text-sm opacity-60">No expense categories yet.</p>
        </div>
      </article>
      <article class="card bg-base-100 shadow">
        <div class="card-body gap-4">
          <h2 class="card-title">Income categories</h2>
          <ul class="space-y-3">
            <li v-for="category in incomeCategories" :key="category.id" class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <CategoryIcon :icon="category.icon" class="h-6 w-6" />
                <p class="font-medium">
                  {{ category.name }}
                  <span v-if="category.excludeByDefault" class="badge badge-ghost badge-xs ms-1">Excluded by default</span>
                </p>
              </div>
              <button class="btn btn-ghost btn-xs" :disabled="!canEditFinancialData" @click="openFormFor(category)">Edit</button>
            </li>
          </ul>
          <p v-if="!incomeCategories.length" class="text-sm opacity-60">No income categories yet.</p>
        </div>
      </article>
    </section>

    <TransitionRoot appear :show="isOpen" as="template">
      <Dialog as="div" class="relative z-50" @close="isOpen = false">
        <TransitionChild as="template" enter="ease-out duration-200" enter-from="opacity-0" enter-to="opacity-100" leave="ease-in duration-150" leave-from="opacity-100" leave-to="opacity-0">
          <div class="fixed inset-0 bg-base-content/40" />
        </TransitionChild>
        <div class="fixed inset-0 overflow-y-auto">
          <div class="flex min-h-full items-center justify-center px-4 py-8">
            <TransitionChild
              as="template"
              enter="ease-out duration-200"
              enter-from="opacity-0 scale-95"
              enter-to="opacity-100 scale-100"
              leave="ease-in duration-150"
              leave-from="opacity-100 scale-100"
              leave-to="opacity-0 scale-95"
            >
              <DialogPanel class="w-full max-w-md rounded-2xl bg-base-100 p-6 shadow-xl">
                <DialogTitle class="text-lg font-semibold">{{ form.id ? 'Edit' : 'Create' }} category</DialogTitle>
                <form class="mt-4 space-y-4" @submit.prevent="handleSubmit">
                  <label class="form-control w-full">
                    <span class="label-text">Name</span>
                    <input v-model.trim="form.name" type="text" class="input input-bordered" required />
                  </label>
                  <label class="form-control w-full">
                    <span class="label-text">Type</span>
                    <select v-model="form.type" class="select select-bordered" required>
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                    </select>
                  </label>
                  <div class="form-control w-full gap-2">
                    <span class="label-text">Icon</span>
                    <div class="grid max-h-56 grid-cols-5 gap-2 overflow-y-auto rounded-lg border border-base-300 p-2 sm:grid-cols-6">
                      <button
                        v-for="option in iconOptions"
                        :key="option.value"
                        type="button"
                        class="btn btn-sm"
                        :class="form.icon === option.value ? 'btn-primary' : 'btn-outline'"
                        @click="form.icon = option.value"
                      >
                        <CategoryIcon :icon="option.value" class="h-5 w-5" />
                        <span class="sr-only">{{ option.label }}</span>
                      </button>
                    </div>
                    <div class="divider text-xs">or</div>
                    <input
                      v-model.trim="form.icon"
                      type="text"
                      class="input input-bordered"
                      placeholder="Emoji or custom keyword"
                    />
                    <span class="label-text-alt">Pick a preset icon or enter an emoji (e.g. 🍔).</span>
                  </div>
                  <label class="label cursor-pointer justify-start gap-3 rounded-lg border border-base-300 p-3">
                    <input v-model="form.excludeByDefault" type="checkbox" class="checkbox checkbox-sm" />
                    <div>
                      <p class="text-sm font-medium">Exclude transactions by default</p>
                      <p class="text-xs opacity-65">
                        Transactions in this category will be excluded from insights and budgets unless overridden.
                      </p>
                    </div>
                  </label>
                  <div class="flex justify-end gap-2 pt-2">
                    <button type="button" class="btn btn-ghost" @click="isOpen = false">Cancel</button>
                    <button type="submit" class="btn btn-primary" :class="{ loading: isSaving }">Save</button>
                  </div>
                </form>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import CategoryIcon from '@/components/CategoryIcon.vue';
import { CATEGORY_ICON_OPTIONS } from '@/utils/categoryIcons';
import { useCategoriesStore } from '@/stores/categories';
import { useHouseholdStore } from '@/stores/household';

const categoriesStore = useCategoriesStore();
const householdStore = useHouseholdStore();

if (!categoriesStore.initialized) {
  categoriesStore.init();
}
if (!householdStore.initialized) {
  householdStore.init();
}

const expenseCategories = computed(() => categoriesStore.expenseCategories);
const incomeCategories = computed(() => categoriesStore.incomeCategories);

const iconOptions = CATEGORY_ICON_OPTIONS;
const canEditFinancialData = computed(() => householdStore.canEditFinancialData);

const isOpen = ref(false);
const isSaving = ref(false);
const form = reactive({ id: '', name: '', type: 'expense', icon: '', excludeByDefault: false });

function openFormFor(category) {
  if (!canEditFinancialData.value) return;
  if (category) {
    Object.assign(form, category);
  } else {
    Object.assign(form, {
      id: '',
      name: '',
      type: 'expense',
      icon: iconOptions[0]?.value ?? '',
      excludeByDefault: false
    });
  }
  isOpen.value = true;
}

async function handleSubmit() {
  try {
    isSaving.value = true;
    await categoriesStore.upsertCategory({ ...form });
    isOpen.value = false;
  } catch (error) {
    console.error(error);
    alert(error.message ?? 'Failed to save category');
  } finally {
    isSaving.value = false;
  }
}
</script>
