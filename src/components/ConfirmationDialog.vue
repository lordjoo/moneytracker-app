<template>
  <TransitionRoot appear :show="open" as="template">
    <Dialog as="div" class="relative z-50" @close="emitClose">
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
            <DialogPanel class="w-full max-w-md space-y-4 rounded-2xl bg-base-100 p-6 shadow-xl">
              <div class="space-y-2">
                <DialogTitle class="text-lg font-semibold">{{ title }}</DialogTitle>
                <p v-if="message" class="text-sm opacity-70">{{ message }}</p>
              </div>
              <div class="flex justify-end gap-2">
                <button type="button" class="btn btn-ghost" @click="emitClose">{{ cancelLabel }}</button>
                <button type="button" :class="confirmButtonClass" @click="handleConfirm">
                  <span v-if="confirmIcon" class="inline-flex items-center gap-2">
                    <component :is="confirmIcon" class="h-4 w-4" />
                    <span>{{ confirmLabel }}</span>
                  </span>
                  <span v-else>{{ confirmLabel }}</span>
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { computed } from 'vue';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: 'Confirm action'
  },
  message: {
    type: String,
    default: ''
  },
  confirmLabel: {
    type: String,
    default: 'Confirm'
  },
  cancelLabel: {
    type: String,
    default: 'Cancel'
  },
  confirmVariant: {
    type: String,
    default: 'primary'
  },
  confirmIcon: {
    type: [Object, Function, String],
    default: null
  }
});

const emit = defineEmits(['update:open', 'confirm']);

const confirmButtonClass = computed(() => {
  if (props.confirmVariant === 'danger') {
    return 'btn btn-error';
  }
  if (props.confirmVariant === 'outline') {
    return 'btn btn-outline';
  }
  return 'btn btn-primary';
});

function emitClose() {
  emit('update:open', false);
}

function handleConfirm() {
  emit('confirm');
  emitClose();
}
</script>
