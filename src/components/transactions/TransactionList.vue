<template>
  <div>
    <!-- Transactions List -->
    <div v-if="groupedTransactions.length > 0" class="space-y-4">
      <div v-for="group in groupedTransactions" :key="group.dateLabel" class="space-y-2">
        <!-- Date Header -->
        <div class="flex items-center gap-3">
          <h3 class="text-sm font-semibold opacity-70">{{ group.dateLabel }}</h3>
          <div class="flex-1 h-px bg-base-300"></div>
          <span class="text-xs opacity-50">
            {{ group.transactions.length }} transaction{{ group.transactions.length !== 1 ? 's' : '' }}
          </span>
        </div>

        <!-- Transaction Cards -->
        <div class="space-y-2">
          <TransactionCard
            v-for="item in group.transactions"
            :key="item.transaction.id"
            :transaction="item.transaction"
            :title="item.title"
            :icon="item.icon"
            :account-name="item.accountName"
            :formatted-amount="item.formattedAmount"
            :formatted-base="item.formattedBase"
            :is-pending="item.isPending"
            :bg-class="item.bgClass"
            :badge-class="item.badgeClass"
            :text-class="item.textClass"
            :is-locked-month="item.isLockedMonth"
            :can-edit="item.canEdit"
            :can-delete="item.canDelete"
            :disabled-reason="item.disabledReason"
            @edit="$emit('edit', $event)"
            @delete="$emit('delete', $event)"
          />
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="card bg-base-100 shadow">
      <div class="card-body items-center text-center py-12">
        <div class="p-4 rounded-full bg-base-200 mb-4">
          <BanknotesIcon class="h-12 w-12 opacity-50" />
        </div>
        <h3 class="text-lg font-semibold">No transactions found</h3>
        <p class="text-sm opacity-70 max-w-sm">
          {{ emptyMessage }}
        </p>
        <button 
          v-if="canAddTransaction" 
          class="btn btn-primary btn-sm gap-2 mt-4" 
          @click="$emit('add')"
        >
          <PlusIcon class="h-4 w-4" />
          Add Transaction
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { BanknotesIcon, PlusIcon } from '@heroicons/vue/24/outline';
import TransactionCard from './TransactionCard.vue';

defineProps({
  groupedTransactions: {
    type: Array,
    required: true
  },
  emptyMessage: {
    type: String,
    default: 'Start by adding your first transaction'
  },
  canAddTransaction: {
    type: Boolean,
    default: true
  }
});

defineEmits(['edit', 'delete', 'add']);
</script>
