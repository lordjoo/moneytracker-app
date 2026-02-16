<template>
  <section class="card bg-base-100 shadow">
    <div class="card-body p-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <!-- Search -->
        <div class="flex-1 max-w-md">
          <label class="form-control w-full">
            <div class="label pb-2">
              <span class="label-text text-xs font-medium">Search</span>
            </div>
            <div class="relative">
              <MagnifyingGlassIcon class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
              <input 
                :value="search" 
                @input="$emit('update:search', $event.target.value)"
                type="text" 
                placeholder="Search transactions..." 
                class="input input-bordered input-sm w-full pl-9"
              />
            </div>
          </label>
        </div>

        <!-- Filters -->
        <div class="flex flex-wrap gap-3">
          <label class="form-control min-w-[160px]">
            <div class="label pb-2">
              <span class="label-text text-xs font-medium">Account</span>
            </div>
            <select 
              :value="filters.accountId" 
              @change="$emit('update:filters', { ...filters, accountId: $event.target.value })"
              class="select select-bordered select-md w-full text-base-content"
            >
              <option value="">All Accounts</option>
              <option v-for="account in accounts" :key="account.id" :value="account.id">
                {{ account.name }}
              </option>
            </select>
          </label>
          
          <label class="form-control min-w-[160px]">
            <div class="label pb-2">
              <span class="label-text text-xs font-medium">Category</span>
            </div>
            <select 
              :value="filters.categoryId" 
              @change="$emit('update:filters', { ...filters, categoryId: $event.target.value })"
              class="select select-bordered select-md w-full text-base-content"
            >
              <option value="">All Categories</option>
              <option v-for="category in categories" :key="category.id" :value="category.id">
                {{ category.name }}
              </option>
            </select>
          </label>
          
          <label class="form-control min-w-[140px]">
            <div class="label pb-2">
              <span class="label-text text-xs font-medium">Type</span>
            </div>
            <select 
              :value="filters.type" 
              @change="$emit('update:filters', { ...filters, type: $event.target.value })"
              class="select select-bordered select-md w-full text-base-content"
            >
              <option value="">All Types</option>
              <option value="credit">Credit</option>
              <option value="debit">Debit</option>
              <option value="transfer">Transfer</option>
            </select>
          </label>

          <label class="form-control min-w-[150px]">
            <div class="label pb-2">
              <span class="label-text text-xs font-medium">Insights</span>
            </div>
            <select
              :value="filters.excludeMode"
              @change="$emit('update:filters', { ...filters, excludeMode: $event.target.value })"
              class="select select-bordered select-md w-full text-base-content"
            >
              <option value="all">All</option>
              <option value="included">Included only</option>
              <option value="excluded">Excluded only</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline';

defineProps({
  search: {
    type: String,
    default: ''
  },
  filters: {
    type: Object,
    required: true
  },
  accounts: {
    type: Array,
    default: () => []
  },
  categories: {
    type: Array,
    default: () => []
  }
});

defineEmits(['update:search', 'update:filters']);
</script>

<style scoped>
select.select {
  color: inherit;
  font-size: 0.875rem;
}

select.select option {
  color: inherit;
  background-color: inherit;
}
</style>
