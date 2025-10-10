<template>
  <div class="relative" ref="container">
    <input
      v-model="search"
      type="text"
      class="input input-bordered w-full pr-10"
      :placeholder="placeholder"
      @focus="open = true"
      @input="open = true"
      @keydown.down.prevent="move(1)"
      @keydown.up.prevent="move(-1)"
      @keydown.enter.prevent="selectActive"
      @keydown.esc="open = false"
    />
    <button v-if="search" type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-xl opacity-60 hover:opacity-100" @click="clear">&times;</button>
    <ul
      v-show="open && filteredOptions.length"
      class="absolute z-10 mt-1 w-full bg-base-100 border border-base-300 rounded shadow max-h-60 overflow-auto"
    >
      <li
        v-for="(option, i) in filteredOptions"
        :key="option.id"
        :class="['flex items-center gap-2 px-3 py-2 cursor-pointer', { 'bg-primary text-primary-content': i === activeIndex }]"
        @mousedown.prevent="select(option)"
        @mouseenter="activeIndex = i"
      >
        <CategoryIcon :icon="option.icon" class="h-5 w-5" />
        <span>{{ option.name }}</span>
      </li>
      <li v-if="!filteredOptions.length" class="px-3 py-2 text-sm opacity-60">No results</li>
    </ul>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import CategoryIcon from '@/components/CategoryIcon.vue';

const props = defineProps({
  modelValue: String,
  options: Array, // [{ id, name, icon }]
  placeholder: {
    type: String,
    default: 'Search category...'
  }
});
const emit = defineEmits(['update:modelValue']);

const search = ref('');
const open = ref(false);
const activeIndex = ref(-1);
const container = ref(null);

const filteredOptions = computed(() => {
  if (!search.value) return props.options || [];
  return (props.options || []).filter(opt =>
    opt.name.toLowerCase().includes(search.value.toLowerCase())
  );
});

watch(() => props.modelValue, (val) => {
  if (!val) {
    search.value = '';
  } else {
    const found = (props.options || []).find(opt => opt.id === val);
    if (found) search.value = found.name;
  }
}, { immediate: true });

function select(option) {
  emit('update:modelValue', option.id);
  search.value = option.name;
  open.value = false;
}
function selectActive() {
  if (activeIndex.value >= 0 && activeIndex.value < filteredOptions.value.length) {
    select(filteredOptions.value[activeIndex.value]);
  }
}
function move(dir) {
  if (!filteredOptions.value.length) return;
  let idx = activeIndex.value + dir;
  if (idx < 0) idx = filteredOptions.value.length - 1;
  if (idx >= filteredOptions.value.length) idx = 0;
  activeIndex.value = idx;
}
function clear() {
  search.value = '';
  emit('update:modelValue', '');
  open.value = true;
}

function onClickOutside(e) {
  if (container.value && !container.value.contains(e.target)) {
    open.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside);
});
</script>
