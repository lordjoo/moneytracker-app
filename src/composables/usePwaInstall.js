import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const promptEvent = ref(null);
const standalone = ref(false);
const listeners = new Set();

function getStandaloneState() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || Boolean(window.navigator.standalone);
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function setPwaInstallPrompt(event = null) {
  promptEvent.value = event;
  standalone.value = getStandaloneState();
  notify();
}

export function markPwaInstalled() {
  promptEvent.value = null;
  standalone.value = true;
  notify();
}

export function usePwaInstall() {
  const refresh = () => {
    standalone.value = getStandaloneState();
    if (typeof window !== 'undefined' && window.deferredPrompt) {
      promptEvent.value = window.deferredPrompt;
    }
  };

  const canPromptInstall = computed(() => Boolean(promptEvent.value) && !standalone.value);

  async function promptInstall() {
    refresh();
    if (!promptEvent.value) return false;
    const event = promptEvent.value;
    event.prompt();
    await event.userChoice.catch(() => null);
    promptEvent.value = null;
    notify();
    return true;
  }

  onMounted(() => {
    refresh();
    listeners.add(refresh);
  });

  onBeforeUnmount(() => {
    listeners.delete(refresh);
  });

  return {
    canPromptInstall,
    isStandalone: computed(() => standalone.value),
    promptInstall,
    refreshInstallState: refresh
  };
}
