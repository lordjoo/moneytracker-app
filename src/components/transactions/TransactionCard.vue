<template>
  <article class="card bg-base-100 shadow-sm hover:shadow-md transition-shadow">
    <div class="card-body p-4">
      <div class="flex items-start justify-between gap-3">
        <!-- Icon and Details -->
        <div class="flex items-start gap-3 flex-1 min-w-0">
          <div class="mt-0.5">
            <div class="p-2 rounded-lg" :class="bgClass">
              <CategoryIcon :icon="icon" class="h-5 w-5" />
            </div>
          </div>
          <div class="flex-1 min-w-0 space-y-1">
            <div class="flex items-start gap-2">
              <h4 class="font-medium break-words flex-1">{{ title }}</h4>
              <span class="badge badge-sm whitespace-nowrap" :class="badgeClass">
                {{ transaction.type }}
              </span>
              <span
                v-if="transaction.excludeFromInsights"
                class="badge badge-ghost badge-sm whitespace-nowrap"
              >
                Excluded
              </span>
              <span v-if="isLockedMonth" class="badge badge-warning badge-sm whitespace-nowrap">
                Locked month
              </span>
            </div>
            <div class="flex flex-wrap items-center gap-2 text-xs opacity-60">
              <span class="flex items-center gap-1">
                <BanknotesIcon class="h-3 w-3" />
                {{ accountName }}
              </span>
              <span>·</span>
              <span class="flex items-center gap-1">
                <CalendarDaysIcon class="h-3 w-3" />
                {{ displayDate }}
              </span>
            </div>
            <p v-if="transaction.note" class="text-sm opacity-70 line-clamp-2">
              {{ transaction.note }}
            </p>
          </div>
        </div>

        <!-- Amount and Actions -->
        <div class="flex items-start gap-2">
          <div class="text-right">
            <p class="font-semibold" :class="textClass">
              {{ formattedAmount }}
            </p>
            <p v-if="formattedBase" class="text-xs opacity-60">
              ≈ {{ formattedBase }}
            </p>
            <p v-else-if="isPending" class="text-xs opacity-60">
              Pending...
            </p>
          </div>
          
          <!-- Actions Dropdown -->
          <div class="dropdown dropdown-end">
            <label tabindex="0" class="btn btn-ghost btn-sm btn-square">
              <EllipsisVerticalIcon class="h-4 w-4" />
            </label>
            <ul tabindex="0" class="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-40 border border-base-300 z-10">
              <li>
                <button
                  @click="$emit('edit', transaction)"
                  class="text-sm gap-2"
                  :disabled="!canEdit"
                  :title="!canEdit ? disabledReason : ''"
                >
                  <PencilIcon class="h-4 w-4" />
                  Edit
                </button>
              </li>
              <li>
                <button
                  @click="$emit('delete', transaction)"
                  class="text-sm gap-2 text-error hover:bg-error hover:text-error-content"
                  :disabled="!canDelete"
                  :title="!canDelete ? disabledReason : ''"
                >
                  <TrashIcon class="h-4 w-4" />
                  Delete
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue';
import {
  BanknotesIcon,
  CalendarDaysIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/vue/24/outline';
import { parseDateKey } from '@/utils/dates';
import CategoryIcon from '../CategoryIcon.vue';

const props = defineProps({
  transaction: {
    type: Object,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    required: true
  },
  accountName: {
    type: String,
    required: true
  },
  formattedAmount: {
    type: String,
    required: true
  },
  formattedBase: {
    type: String,
    default: null
  },
  isPending: {
    type: Boolean,
    default: false
  },
  bgClass: {
    type: String,
    required: true
  },
  badgeClass: {
    type: String,
    required: true
  },
  textClass: {
    type: String,
    required: true
  },
  isLockedMonth: {
    type: Boolean,
    default: false
  },
  canEdit: {
    type: Boolean,
    default: true
  },
  canDelete: {
    type: Boolean,
    default: true
  },
  disabledReason: {
    type: String,
    default: 'This transaction is locked.'
  }
});

const displayDate = computed(() => {
  const tx = props.transaction ?? {};
  const dateFromKey = parseDateKey(tx.occurredOn);
  const date = dateFromKey ?? new Date(tx.occurredAt ?? tx.createdAt ?? Date.now());
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
});

defineEmits(['edit', 'delete']);
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
