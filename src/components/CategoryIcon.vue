<template>
  <component v-if="component" :is="component" :class="size" v-bind="attrs" />
  <span
    v-else-if="icon"
    :class="['inline-flex items-center justify-center rounded-full bg-base-200 font-semibold', fallbackSize]"
    v-bind="attrs"
  >
    {{ icon.slice(0, 2) }}
  </span>
  <component
    v-else
    :is="fallbackComponent"
    :class="size"
    v-bind="attrs"
  />
</template>

<script setup>
import { computed, useAttrs } from 'vue';
import { resolveCategoryIcon, FALLBACK_CATEGORY_ICON } from '@/utils/categoryIcons';

const props = defineProps({
  icon: {
    type: String,
    default: ''
  },
  size: {
    type: String,
    default: 'h-5 w-5'
  },
  fallbackSize: {
    type: String,
    default: 'h-6 w-6 text-xs'
  }
});

const component = computed(() => resolveCategoryIcon(props.icon));
const fallbackComponent = FALLBACK_CATEGORY_ICON;
const attrs = useAttrs();
</script>
