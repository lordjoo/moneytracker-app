<template>
  <TransitionRoot appear :show="open" as="template">
    <Dialog as="div" class="relative z-50" @close="$emit('close')">
      <TransitionChild 
        as="template" 
        enter="ease-out duration-200" 
        enter-from="opacity-0" 
        enter-to="opacity-100" 
        leave="ease-in duration-150" 
        leave-from="opacity-100" 
        leave-to="opacity-0"
      >
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
            <DialogPanel class="w-full max-w-lg rounded-2xl bg-base-100 p-6 shadow-xl">
              <DialogTitle class="text-lg font-semibold flex items-center gap-2">
                {{ isEditing ? 'Edit Transaction' : 'New Transaction' }}
                <span v-if="isEditing" class="badge badge-primary badge-sm">Editing</span>
              </DialogTitle>
              
              <form class="mt-4 space-y-4" @submit.prevent="$emit('submit')">
                <!-- Account -->
                <label class="form-control">
                  <span class="label-text font-medium">Account</span>
                  <select 
                    :value="form.accountId" 
                    @input="$emit('update:form', { ...form, accountId: $event.target.value })"
                    class="select select-bordered" 
                    :disabled="!accounts.length" 
                    required
                  >
                    <option disabled value="">Select account</option>
                    <option v-for="account in accounts" :key="account.id" :value="account.id">
                      {{ account.name }}
                    </option>
                  </select>
                </label>

                <!-- Type -->
                <label class="form-control">
                  <span class="label-text font-medium">Type</span>
                  <select 
                    :value="form.type" 
                    @input="$emit('update:form', { ...form, type: $event.target.value })"
                    class="select select-bordered" 
                    required
                  >
                    <option value="credit">Credit (money in)</option>
                    <option value="debit">Debit (money out)</option>
                    <option value="transfer">Transfer</option>
                  </select>
                </label>

                <!-- Amount -->
                <label class="form-control">
                  <span class="label-text font-medium">Amount</span>
                  <input 
                    :value="form.amount" 
                    @input="$emit('update:form', { ...form, amount: parseFloat($event.target.value) || 0 })"
                    type="number" 
                    min="0" 
                    step="0.01" 
                    class="input input-bordered" 
                    placeholder="0.00" 
                    required 
                  />
                </label>

                <!-- Date -->
                <label class="form-control">
                  <span class="label-text font-medium">Date</span>
                  <input 
                    :value="form.date" 
                    @input="$emit('update:form', { ...form, date: $event.target.value })"
                    type="date" 
                    class="input input-bordered" 
                    required 
                  />
                </label>

                <!-- Category (for credit/debit) -->
                <label class="form-control" v-if="form.type !== 'transfer'">
                  <span class="label-text font-medium">Category</span>
                  <CategorySelect
                    :model-value="form.categoryId"
                    @update:model-value="$emit('update:form', { ...form, categoryId: $event })"
                    :options="categoryOptions"
                    placeholder="Search category..."
                    required
                  />
                </label>

                <!-- Transfer destination -->
                <label class="form-control" v-else-if="form.type === 'transfer'">
                  <span class="label-text font-medium">Transfer to</span>
                  <select 
                    :value="form.counterpartyAccountId" 
                    @input="$emit('update:form', { ...form, counterpartyAccountId: $event.target.value })"
                    class="select select-bordered" 
                    required
                  >
                    <option disabled value="">Select destination</option>
                    <option v-for="account in transferTargets" :key="account.id" :value="account.id">
                      {{ account.name }}
                    </option>
                  </select>
                </label>

                <!-- Currency conversion info -->
                <div v-if="currencyConversionInfo" 
                  class="alert text-sm"
                  :class="currencyConversionInfo.warning ? 'alert-warning' : 'alert-info'">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-5 h-5">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span>{{ currencyConversionInfo.message }}</span>
                </div>

                <!-- Note -->
                <label class="form-control">
                  <span class="label-text font-medium">Note (optional)</span>
                  <textarea 
                    :value="form.note" 
                    @input="$emit('update:form', { ...form, note: $event.target.value })"
                    class="textarea textarea-bordered" 
                    rows="2" 
                    placeholder="Add a note..."
                  ></textarea>
                </label>

                <!-- Actions -->
                <div class="flex justify-end gap-2 pt-2">
                  <button type="button" class="btn btn-ghost" @click="$emit('close')">
                    Cancel
                  </button>
                  <button type="submit" class="btn btn-primary" :class="{ loading: isSaving }">
                    {{ isEditing ? 'Update' : 'Save' }}
                  </button>
                </div>
              </form>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { Dialog, DialogPanel, DialogTitle, TransitionRoot, TransitionChild } from '@headlessui/vue';
import CategorySelect from '../CategorySelect.vue';

defineProps({
  open: {
    type: Boolean,
    required: true
  },
  form: {
    type: Object,
    required: true
  },
  isEditing: {
    type: Boolean,
    default: false
  },
  isSaving: {
    type: Boolean,
    default: false
  },
  accounts: {
    type: Array,
    default: () => []
  },
  categoryOptions: {
    type: Array,
    default: () => []
  },
  transferTargets: {
    type: Array,
    default: () => []
  },
  currencyConversionInfo: {
    type: Object,
    default: null
  }
});

defineEmits(['close', 'submit', 'update:form']);
</script>
