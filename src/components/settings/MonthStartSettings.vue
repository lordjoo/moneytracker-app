<template>
  <section class="space-y-4">
    <article class="card bg-base-100 shadow">
      <div class="card-body space-y-4">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="card-title">Start of Month</h2>
            <p class="text-sm opacity-70">
              Choose the day that starts each tracking month.
            </p>
          </div>
          <span class="badge badge-outline">Current cycle: {{ currentCycleLabel }}</span>
        </div>

        <form class="grid gap-4 md:grid-cols-[minmax(0,16rem)_1fr] md:items-end" @submit.prevent="save">
          <label class="form-control">
            <span class="label-text font-medium">Start day</span>
            <input
              v-model.number="form.monthStartDay"
              type="number"
              min="1"
              max="31"
              step="1"
              class="input input-bordered"
              required
            />
            <span class="label-text-alt">Use 25 for a salary cycle that starts on payday.</span>
          </label>

          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p class="text-sm opacity-70">
              Day {{ savedStartDay }} tracks {{ currentCycleLabel }} right now.
            </p>
            <button type="submit" class="btn btn-primary w-fit">Save start day</button>
          </div>
        </form>

        <p v-if="statusMessage" class="text-sm" :class="statusClass">
          {{ statusMessage }}
        </p>
      </div>
    </article>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { usePreferencesStore } from '@/stores/preferences';
import { getCycleBounds, normalizeCycleStartDay } from '@/utils/dates';

const preferencesStore = usePreferencesStore();

if (!preferencesStore.initialized) {
  preferencesStore.init();
}

const form = reactive({
  monthStartDay: preferencesStore.cycleStartDay
});
const statusMessage = ref('');
const statusKind = ref('success');

const savedStartDay = computed(() => preferencesStore.cycleStartDay);
const currentCycle = computed(() => getCycleBounds(new Date(), savedStartDay.value));
const currentCycleLabel = computed(() => {
  const bounds = currentCycle.value;
  if (!bounds) return 'Unknown';
  return `${formatDate(bounds.start)} - ${formatDate(bounds.endInclusive)}`;
});
const statusClass = computed(() => (statusKind.value === 'error' ? 'text-error' : 'text-success'));

watch(
  () => preferencesStore.cycleStartDay,
  (value) => {
    form.monthStartDay = value;
  },
  { immediate: true }
);

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric'
  }).format(value);
}

function save() {
  try {
    preferencesStore.setMonthStartDay(normalizeCycleStartDay(form.monthStartDay));
    statusKind.value = 'success';
    statusMessage.value = 'Start of month saved.';
  } catch (error) {
    console.error(error);
    statusKind.value = 'error';
    statusMessage.value = error?.message ?? 'Failed to save start of month.';
  }
}
</script>
