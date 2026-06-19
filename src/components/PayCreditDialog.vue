<template>
  <TransitionRoot appear :show="open" as="template">
    <Dialog as="div" class="relative" :style="{ zIndex: 'var(--z-modal)' }" @close="$emit('close')">
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-150"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-base-content/40 backdrop-blur-sm" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4">
          <TransitionChild
            as="template"
            enter="ease-out duration-200"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="ease-in duration-150"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel class="w-full max-w-md rounded-2xl bg-base-100 p-6 shadow-xl">
              <div class="flex items-center gap-3">
                <span class="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <CreditCardIcon class="h-5 w-5" />
                </span>
                <div>
                  <DialogTitle class="text-lg font-semibold">Pay {{ account?.name }}</DialogTitle>
                  <p class="text-xs text-base-content/60">Move money from an account to clear this card.</p>
                </div>
              </div>

              <!-- Owed summary -->
              <div class="mt-4 flex items-center justify-between rounded-xl bg-base-200 px-4 py-3">
                <span class="text-sm text-base-content/70">Currently owed</span>
                <span class="amount-hero text-lg" :class="owed > 0 ? 'text-error' : 'text-success'">
                  {{ formatCurrency(owed, cardCurrency) }}
                </span>
              </div>

              <form v-if="owed > 0 || hasSources" class="mt-5 space-y-4" @submit.prevent="submit">
                <!-- Pay from -->
                <label class="form-control w-full">
                  <span class="label-text mb-1 font-medium">Pay from</span>
                  <select v-model="sourceId" class="select select-bordered" required>
                    <option disabled value="">Select an account</option>
                    <option v-for="src in sourceAccounts" :key="src.id" :value="src.id">
                      {{ src.name }} — {{ formatCurrency(src.balance, src.currency) }}
                    </option>
                  </select>
                  <span v-if="!hasSources" class="mt-1 text-xs text-warning">No other open account to pay from. Add one first.</span>
                </label>

                <!-- Amount -->
                <label class="form-control w-full">
                  <div class="mb-1 flex items-center justify-between">
                    <span class="label-text font-medium">Amount{{ sourceCurrency ? ` (${sourceCurrency})` : '' }}</span>
                    <button
                      v-if="canPayFull"
                      type="button"
                      class="text-xs font-medium text-primary hover:underline"
                      @click="amount = roundMoney(owed)"
                    >
                      Pay full balance
                    </button>
                  </div>
                  <input
                    v-model.number="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    class="input input-bordered tnum"
                    placeholder="0.00"
                    required
                  />
                  <span v-if="crossCurrency" class="mt-1 text-xs text-base-content/60">
                    This account is in {{ sourceCurrency }}; the card is in {{ cardCurrency }}. The amount will be converted at the latest rate.
                  </span>
                  <span v-else-if="amount > owed" class="mt-1 text-xs text-base-content/60">
                    This is more than you owe — the extra becomes a credit on the card.
                  </span>
                </label>

                <!-- Date -->
                <label class="form-control w-full">
                  <span class="label-text mb-1 font-medium">Date</span>
                  <input v-model="date" type="date" class="input input-bordered" required />
                </label>

                <!-- Note -->
                <label class="form-control w-full">
                  <span class="label-text mb-1 font-medium">Note (optional)</span>
                  <input v-model="note" type="text" class="input input-bordered" placeholder="e.g. June statement" />
                </label>

                <div class="flex justify-end gap-2 pt-1">
                  <button type="button" class="btn btn-ghost" @click="$emit('close')">Cancel</button>
                  <button type="submit" class="btn btn-primary" :class="{ loading: isSaving }" :disabled="!canSubmit">
                    Pay {{ amount > 0 ? formatCurrency(amount, sourceCurrency) : '' }}
                  </button>
                </div>
              </form>

              <div v-else class="mt-5 rounded-xl border border-dashed border-base-300 px-4 py-6 text-center text-sm text-base-content/60">
                This card is fully paid off. Nothing to pay right now.
                <div class="mt-4">
                  <button type="button" class="btn btn-ghost btn-sm" @click="$emit('close')">Close</button>
                </div>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { CreditCardIcon } from '@heroicons/vue/24/outline';
import { useAccountsStore, describeCreditAccount } from '@/stores/accounts';
import { useTransactionsStore } from '@/stores/transactions';
import { useCurrencyStore } from '@/stores/currency';
import { toDateKey, coerceDateKey } from '@/utils/dates';

const props = defineProps({
  open: { type: Boolean, default: false },
  account: { type: Object, default: null }
});
const emit = defineEmits(['close', 'paid']);

const accountsStore = useAccountsStore();
const transactionsStore = useTransactionsStore();
const currencyStore = useCurrencyStore();

const sourceId = ref('');
const amount = ref(0);
const date = ref(toDateKey(new Date()));
const note = ref('');
const isSaving = ref(false);

const cardCurrency = computed(() => props.account?.currency || currencyStore.mainCurrency);
const owed = computed(() => describeCreditAccount(props.account).owed);

// Any open account that isn't this card can be a payment source.
const sourceAccounts = computed(() =>
  accountsStore.visibleOpenAccounts.filter(
    (acct) => acct.id !== props.account?.id && acct.type !== 'credit'
  )
);
const hasSources = computed(() => sourceAccounts.value.length > 0);
const selectedSource = computed(() => sourceAccounts.value.find((acct) => acct.id === sourceId.value) ?? null);
const sourceCurrency = computed(() => selectedSource.value?.currency ?? '');
const crossCurrency = computed(
  () => Boolean(sourceCurrency.value) && sourceCurrency.value !== cardCurrency.value
);
const canPayFull = computed(() => !crossCurrency.value && owed.value > 0);
const canSubmit = computed(() => hasSources.value && sourceId.value && amount.value > 0 && !isSaving.value);

function formatCurrency(value, currency) {
  return currencyStore.formatCurrency(value, currency || currencyStore.mainCurrency);
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

// Reset the form whenever the dialog (re)opens.
watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    sourceId.value = sourceAccounts.value[0]?.id ?? '';
    date.value = toDateKey(new Date());
    note.value = '';
    // Prefill with the full balance when currencies match.
    amount.value = !crossCurrency.value ? roundMoney(owed.value) : 0;
  },
  { immediate: true }
);

async function submit() {
  if (!canSubmit.value || !props.account) return;
  try {
    isSaving.value = true;
    transactionsStore.addTransaction({
      type: 'transfer',
      accountId: sourceId.value,
      counterpartyAccountId: props.account.id,
      amount: roundMoney(amount.value),
      occurredAt: coerceDateKey(date.value, toDateKey(new Date())),
      note: note.value?.trim() || `Payment to ${props.account.name}`
    });
    emit('paid');
    emit('close');
  } catch (error) {
    console.error('Failed to record credit payment:', error);
    alert(error.message ?? 'Failed to record payment.');
  } finally {
    isSaving.value = false;
  }
}
</script>
