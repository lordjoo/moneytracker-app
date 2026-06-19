<template>
  <div class="space-y-1.5">
    <div
      v-if="credit.limit"
      class="w-full overflow-hidden rounded-full"
      :class="[heightClass, trackClass]"
    >
      <div
        class="h-full rounded-full transition-all duration-300"
        :class="creditUtilizationClass(credit.utilization)"
        :style="{ width: meterWidth(credit.utilization) }"
      ></div>
    </div>
    <div v-if="showLabels" class="flex flex-wrap justify-between gap-x-4 text-xs" :class="labelClass">
      <span v-if="credit.limit">
        {{ percentLabel }}% of {{ format(credit.limit) }} limit{{ verbose ? ' used' : '' }}
      </span>
      <span v-else>No credit limit set</span>
      <span v-if="credit.available !== null" class="font-medium" :class="availableClass">
        {{ format(credit.available) }} available
      </span>
    </div>
    <p v-if="showOverpaid && credit.overpaid > 0" class="text-xs text-success">
      {{ format(credit.overpaid) }} statement credit
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useCurrencyStore } from '@/stores/currency';
import { creditUtilizationClass, meterWidth } from '@/utils/accountDisplay';

const props = defineProps({
  // Shape from describeCreditAccount(): { owed, overpaid, limit, available, utilization }
  credit: { type: Object, required: true },
  currency: { type: String, default: '' },
  tone: { type: String, default: 'default' }, // 'default' | 'inverted'
  size: { type: String, default: 'md' }, // 'sm' | 'md'
  showLabels: { type: Boolean, default: true },
  showOverpaid: { type: Boolean, default: false },
  verbose: { type: Boolean, default: false }
});

const currencyStore = useCurrencyStore();
const inverted = computed(() => props.tone === 'inverted');

const heightClass = computed(() => (props.size === 'sm' ? 'h-1.5' : 'h-2'));
const trackClass = computed(() => (inverted.value ? 'bg-neutral-content/15' : 'bg-base-300'));
const labelClass = computed(() => (inverted.value ? 'text-neutral-content/65' : 'text-base-content/60'));
const availableClass = computed(() => (inverted.value ? '' : 'text-success'));

const percentLabel = computed(() => ((Number(props.credit.utilization) || 0) * 100).toFixed(0));

function format(value) {
  return currencyStore.formatCurrency(value, props.currency || currencyStore.mainCurrency);
}
</script>
