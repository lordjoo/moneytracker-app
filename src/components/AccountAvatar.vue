<template>
  <span class="grid shrink-0 place-items-center rounded-xl" :class="[sizeClasses.box, toneClass]">
    <CreditCardIcon v-if="isCredit" :class="sizeClasses.icon" />
    <BanknotesIcon v-else :class="sizeClasses.icon" />
  </span>
</template>

<script setup>
import { computed } from 'vue';
import { CreditCardIcon, BanknotesIcon } from '@heroicons/vue/24/outline';
import { isCreditAccount } from '@/utils/accountDisplay';

const props = defineProps({
  // Pass either a full account object or just its type string.
  account: { type: Object, default: null },
  type: { type: String, default: 'cash' },
  size: { type: String, default: 'md' }, // 'sm' | 'md' | 'lg'
  // 'default' for light surfaces, 'inverted' for the dark balance hero.
  tone: { type: String, default: 'default' }
});

const isCredit = computed(() =>
  props.account ? isCreditAccount(props.account) : props.type === 'credit'
);

const SIZES = {
  sm: { box: 'h-9 w-9', icon: 'h-4 w-4' },
  md: { box: 'h-10 w-10', icon: 'h-5 w-5' },
  lg: { box: 'h-12 w-12 rounded-2xl', icon: 'h-6 w-6' }
};
const sizeClasses = computed(() => SIZES[props.size] ?? SIZES.md);

const toneClass = computed(() => {
  if (props.tone === 'inverted') return 'bg-neutral-content/10 text-neutral-content';
  return isCredit.value ? 'bg-primary/10 text-primary' : 'bg-base-200 text-base-content/70';
});
</script>
