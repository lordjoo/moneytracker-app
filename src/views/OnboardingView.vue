<template>
  <div class="min-h-screen bg-base-200">
    <div class="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-10">
      <header class="flex items-center justify-between">
        <div class="flex items-center gap-2 text-lg font-semibold">
          <span class="btn btn-circle btn-sm bg-primary text-primary-content border-none">₿</span>
          <span>MyMoney</span>
        </div>
        <button class="btn btn-ghost btn-sm" @click="skip">Skip</button>
      </header>

      <main class="flex flex-1 flex-col items-center justify-center gap-10 text-center">
        <Transition name="fade" mode="out-in">
          <section :key="activeStep.id" class="space-y-6">
            <component :is="activeStep.icon" class="mx-auto h-16 w-16 text-primary" />
            <div class="space-y-3">
              <h1 class="text-3xl font-bold">{{ activeStep.title }}</h1>
              <p class="mx-auto max-w-xl text-sm opacity-80">{{ activeStep.description }}</p>
            </div>
            <div v-if="activeStep.list?.length" class="text-left">
              <ul class="list-disc space-y-2 text-sm opacity-80">
                <li v-for="item in activeStep.list" :key="item" class="ms-5">{{ item }}</li>
              </ul>
            </div>
          </section>
        </Transition>
      </main>

      <footer class="flex flex-col gap-4 pb-6">
        <progress class="progress progress-primary" :value="progressValue" :max="activeSteps.length"></progress>
        <div class="flex items-center justify-between">
          <button class="btn btn-ghost" :disabled="isFirst" @click="prev">Back</button>
          <div class="flex gap-2">
            <button class="btn btn-outline" v-if="!isLast" @click="next">Next</button>
            <button class="btn btn-primary" v-else @click="finish">Get started</button>
          </div>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { SparklesIcon, ArrowTrendingUpIcon, ShieldCheckIcon } from '@heroicons/vue/24/outline';
import { usePreferencesStore } from '@/stores/preferences';

const router = useRouter();
const preferencesStore = usePreferencesStore();
preferencesStore.init();

const activeSteps = [
  {
    id: 'local-first',
    title: 'Keep finances close',
    description: 'Accounts, categories, and transactions are stored securely in your browser by default.',
    icon: ShieldCheckIcon,
    list: ['Works offline automatically', 'No cloud account required', 'Your data stays on this device until you back it up']
  },
  {
    id: 'backup',
    title: 'Optional cloud backups',
    description: 'Connect your Google account in Settings to sync encrypted backups to Firebase whenever you choose.',
    icon: ArrowTrendingUpIcon,
    list: ['Manual backup and restore controls', 'Keep multiple devices aligned', 'Backups never overwrite local data without confirmation']
  },
  {
    id: 'get-productive',
    title: 'Start tracking in seconds',
    description: 'Create accounts, organise categories, and log transactions with powerful filters and insights.',
    icon: SparklesIcon,
    list: ['Quick add shortcuts from your home screen', 'Switch themes for light or dark workspaces', 'Insights update instantly as you record changes']
  }
];

const stepIndex = ref(0);
const activeStep = computed(() => activeSteps[stepIndex.value]);
const progressValue = computed(() => stepIndex.value + 1);
const isFirst = computed(() => stepIndex.value === 0);
const isLast = computed(() => stepIndex.value === activeSteps.length - 1);

function next() {
  if (!isLast.value) {
    stepIndex.value += 1;
  }
}

function prev() {
  if (!isFirst.value) {
    stepIndex.value -= 1;
  }
}

function finish() {
  preferencesStore.completeOnboarding();
  router.replace('/');
}

function skip() {
  finish();
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
