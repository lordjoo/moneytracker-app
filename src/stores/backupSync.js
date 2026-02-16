import { defineStore } from 'pinia';
import { generateId, parseDate, readJson, writeJson } from '@/utils/storage';
import {
  computeBackupFingerprint,
  createBackupPayload,
  downloadBackup,
  getBackupMetadata,
  uploadBackup
} from '@/utils/backupService';
import { subscribeBackupDirty } from '@/utils/backupDirtySignal';
import { useAuthStore } from '@/stores/auth';
import { useAccountsStore } from '@/stores/accounts';
import { useCategoriesStore } from '@/stores/categories';
import { useTransactionsStore } from '@/stores/transactions';
import { useBudgetsStore } from '@/stores/budgets';
import { useRecurringStore } from '@/stores/recurring';
import { useGoalsStore } from '@/stores/goals';
import { useHouseholdStore } from '@/stores/household';
import { useMonthClosuresStore } from '@/stores/monthClosures';
import { usePreferencesStore } from '@/stores/preferences';

const STORAGE_KEY = 'backup_sync_state';
const REMOTE_CHECK_MIN_GAP_MS = 60 * 1000;
const REMOTE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

let dirtyTimer = null;
let remoteInterval = null;
let unsubscribeDirty = null;
let focusListener = null;

function normalizeFingerprint(value) {
  return String(value ?? '').trim();
}

function formatDateTime(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export const useBackupSyncStore = defineStore('backupSync', {
  state: () => ({
    initialized: false,
    status: 'idle',
    lastError: '',
    deviceId: '',
    baseFingerprint: '',
    localFingerprint: '',
    remoteFingerprint: '',
    remoteUpdatedAt: null,
    lastCheckedAt: null,
    localDirty: false,
    dismissedBannerKey: '',
    suppressDirtySignals: false
  }),
  getters: {
    stateKey(state) {
      return [
        normalizeFingerprint(state.baseFingerprint),
        normalizeFingerprint(state.localFingerprint),
        normalizeFingerprint(state.remoteFingerprint)
      ].join('|');
    },
    hasLocalChanges(state) {
      const local = normalizeFingerprint(state.localFingerprint);
      const base = normalizeFingerprint(state.baseFingerprint);
      const remote = normalizeFingerprint(state.remoteFingerprint);
      if (!local) return Boolean(state.localDirty);
      if (base) return local !== base;
      if (remote) return local !== remote;
      return local !== base;
    },
    hasRemoteChanges(state) {
      const remote = normalizeFingerprint(state.remoteFingerprint);
      const base = normalizeFingerprint(state.baseFingerprint);
      const local = normalizeFingerprint(state.localFingerprint);
      if (!remote) return false;
      if (base) return remote !== base;
      if (local) return remote !== local;
      return true;
    },
    pendingMode() {
      if (this.hasLocalChanges) return 'push';
      if (this.hasRemoteChanges) return 'pull';
      return 'clean';
    },
    showBanner() {
      const authStore = useAuthStore();
      if (!authStore.isAuthenticated) return false;
      if (this.pendingMode === 'clean') return false;
      return this.dismissedBannerKey !== this.stateKey;
    },
    bannerMessage() {
      if (this.pendingMode === 'push') {
        if (this.hasRemoteChanges) {
          const remoteAt = formatDateTime(this.remoteUpdatedAt);
          return remoteAt
            ? `Local changes detected. Push to backup (this will replace cloud changes from ${remoteAt}).`
            : 'Local changes detected. Push to backup (this will replace cloud changes).';
        }
        return 'You have local changes not yet backed up.';
      }
      if (this.pendingMode === 'pull') {
        const remoteAt = formatDateTime(this.remoteUpdatedAt);
        return remoteAt
          ? `Cloud backup changed (${remoteAt}). Pull updates to this device.`
          : 'Cloud backup changed. Pull updates to this device.';
      }
      return '';
    },
    canPush() {
      return this.pendingMode === 'push';
    },
    canPull() {
      return this.pendingMode === 'pull';
    }
  },
  actions: {
    init() {
      if (this.initialized) return;
      const state = readJson(STORAGE_KEY, {
        deviceId: '',
        baseFingerprint: '',
        localFingerprint: '',
        remoteFingerprint: '',
        remoteUpdatedAt: null,
        lastCheckedAt: null,
        localDirty: false,
        dismissedBannerKey: ''
      });
      this.deviceId = state.deviceId || '';
      this.baseFingerprint = normalizeFingerprint(state.baseFingerprint);
      this.localFingerprint = normalizeFingerprint(state.localFingerprint);
      this.remoteFingerprint = normalizeFingerprint(state.remoteFingerprint);
      this.remoteUpdatedAt = parseDate(state.remoteUpdatedAt);
      this.lastCheckedAt = parseDate(state.lastCheckedAt);
      this.localDirty = Boolean(state.localDirty);
      this.dismissedBannerKey = state.dismissedBannerKey || '';
      this.ensureDeviceId();
      this.initialized = true;

      if (!unsubscribeDirty) {
        unsubscribeDirty = subscribeBackupDirty((reason) => this.markLocalChange(reason));
      }
      this.startRemoteChecks();
      if (!this.localFingerprint) {
        void this.refreshLocalFingerprint();
      }
    },
    persist() {
      writeJson(STORAGE_KEY, {
        deviceId: this.deviceId,
        baseFingerprint: this.baseFingerprint,
        localFingerprint: this.localFingerprint,
        remoteFingerprint: this.remoteFingerprint,
        remoteUpdatedAt: this.remoteUpdatedAt ? this.remoteUpdatedAt.toISOString() : null,
        lastCheckedAt: this.lastCheckedAt ? this.lastCheckedAt.toISOString() : null,
        localDirty: this.localDirty,
        dismissedBannerKey: this.dismissedBannerKey
      });
    },
    ensureDeviceId() {
      if (this.deviceId) return this.deviceId;
      this.deviceId = generateId('device');
      this.persist();
      return this.deviceId;
    },
    collectBackupData() {
      const accountsStore = useAccountsStore();
      const categoriesStore = useCategoriesStore();
      const transactionsStore = useTransactionsStore();
      const budgetsStore = useBudgetsStore();
      const recurringStore = useRecurringStore();
      const goalsStore = useGoalsStore();
      const householdStore = useHouseholdStore();
      const monthClosuresStore = useMonthClosuresStore();

      if (!accountsStore.initialized) accountsStore.init();
      if (!categoriesStore.initialized) categoriesStore.init();
      if (!transactionsStore.initialized) transactionsStore.init();
      if (!budgetsStore.initialized) budgetsStore.init();
      if (!recurringStore.initialized) recurringStore.init();
      if (!goalsStore.initialized) goalsStore.init();
      if (!householdStore.initialized) householdStore.init();
      if (!monthClosuresStore.initialized) monthClosuresStore.init();

      return {
        accounts: accountsStore.accounts,
        categories: categoriesStore.categories,
        transactions: transactionsStore.transactions,
        budgets: budgetsStore.budgets,
        recurring: {
          rules: recurringStore.rules,
          instances: recurringStore.instances
        },
        goals: goalsStore.goals,
        household: {
          household: householdStore.household,
          members: householdStore.members,
          invites: householdStore.invites,
          auditEvents: householdStore.auditEvents
        },
        monthClosures: monthClosuresStore.closures
      };
    },
    getLocalFingerprint() {
      const snapshot = createBackupPayload(this.collectBackupData());
      return computeBackupFingerprint(snapshot);
    },
    evaluateState() {
      if (this.pendingMode === 'clean') {
        this.dismissedBannerKey = '';
      } else if (this.dismissedBannerKey && this.dismissedBannerKey !== this.stateKey) {
        this.dismissedBannerKey = '';
      }
      this.persist();
    },
    async refreshLocalFingerprint() {
      this.status = 'checking';
      this.lastError = '';
      try {
        this.localFingerprint = this.getLocalFingerprint();
        this.localDirty = this.hasLocalChanges;
      } catch (error) {
        this.lastError = error?.message ?? 'Failed to evaluate local backup changes.';
      } finally {
        this.status = 'idle';
        this.evaluateState();
      }
    },
    markLocalChange() {
      if (this.suppressDirtySignals) return;
      this.localDirty = true;
      if (dirtyTimer) {
        clearTimeout(dirtyTimer);
      }
      dirtyTimer = setTimeout(() => {
        void this.refreshLocalFingerprint();
      }, 350);
      this.evaluateState();
    },
    async checkRemoteMetadata({ force = false } = {}) {
      const authStore = useAuthStore();
      if (!authStore.isAuthenticated || !authStore.user?.uid) return;
      const now = Date.now();
      if (
        !force &&
        this.lastCheckedAt instanceof Date &&
        now - this.lastCheckedAt.getTime() < REMOTE_CHECK_MIN_GAP_MS
      ) {
        return;
      }
      this.status = 'checking';
      this.lastError = '';
      try {
        const metadata = await getBackupMetadata(authStore.user.uid);
        this.lastCheckedAt = new Date();
        if (!metadata) {
          this.remoteFingerprint = '';
          this.remoteUpdatedAt = null;
        } else {
          this.remoteFingerprint = normalizeFingerprint(metadata.fingerprint);
          this.remoteUpdatedAt = metadata.updatedAt ?? null;
        }
        if (!this.localFingerprint) {
          this.localFingerprint = this.getLocalFingerprint();
        }
        this.localDirty = this.hasLocalChanges;
      } catch (error) {
        this.lastError = error?.message ?? 'Failed to check cloud backup metadata.';
      } finally {
        this.status = 'idle';
        this.evaluateState();
      }
    },
    async handleAuthChange() {
      const authStore = useAuthStore();
      if (!authStore.isAuthenticated) {
        this.remoteFingerprint = '';
        this.remoteUpdatedAt = null;
        this.lastCheckedAt = null;
        this.evaluateState();
        return;
      }
      if (!this.localFingerprint) {
        this.localFingerprint = this.getLocalFingerprint();
      }
      await this.checkRemoteMetadata({ force: true });
    },
    async pushNow() {
      const authStore = useAuthStore();
      const preferencesStore = usePreferencesStore();
      if (!preferencesStore.initialized) preferencesStore.init();
      if (!authStore.isAuthenticated || !authStore.user?.uid) {
        throw new Error('Sign in with Google to push backup changes.');
      }

      this.status = 'pushing';
      this.lastError = '';
      try {
        const data = this.collectBackupData();
        const payload = createBackupPayload(data);
        const fingerprint = computeBackupFingerprint(payload);
        await uploadBackup(authStore.user.uid, data, {
          deviceId: this.ensureDeviceId(),
          fingerprint
        });
        this.baseFingerprint = fingerprint;
        this.localFingerprint = fingerprint;
        this.remoteFingerprint = fingerprint;
        this.remoteUpdatedAt = new Date();
        this.localDirty = false;
        preferencesStore.markBackup(new Date());
      } catch (error) {
        this.lastError = error?.message ?? 'Failed to push backup.';
        throw error;
      } finally {
        this.status = 'idle';
        this.evaluateState();
      }
    },
    async pullNow() {
      const authStore = useAuthStore();
      const preferencesStore = usePreferencesStore();
      if (!preferencesStore.initialized) preferencesStore.init();
      if (!authStore.isAuthenticated || !authStore.user?.uid) {
        throw new Error('Sign in with Google to pull backup changes.');
      }

      this.status = 'pulling';
      this.lastError = '';
      try {
        const snapshot = await downloadBackup(authStore.user.uid);
        if (!snapshot) {
          throw new Error('No cloud backup found.');
        }

        const accountsStore = useAccountsStore();
        const categoriesStore = useCategoriesStore();
        const transactionsStore = useTransactionsStore();
        const budgetsStore = useBudgetsStore();
        const recurringStore = useRecurringStore();
        const goalsStore = useGoalsStore();
        const householdStore = useHouseholdStore();
        const monthClosuresStore = useMonthClosuresStore();

        this.suppressDirtySignals = true;
        accountsStore.replaceAll(snapshot.accounts ?? []);
        categoriesStore.replaceAll(snapshot.categories ?? []);
        transactionsStore.replaceAll(snapshot.transactions ?? []);
        budgetsStore.replaceAll(snapshot.budgets ?? []);
        recurringStore.replaceAll(snapshot.recurring ?? { rules: [], instances: [] });
        goalsStore.replaceAll(snapshot.goals ?? []);
        householdStore.replaceAll(snapshot.household ?? { household: null, members: [], invites: [], auditEvents: [] });
        monthClosuresStore.replaceAll(snapshot.monthClosures ?? []);
        recurringStore.syncDueItems();
        this.suppressDirtySignals = false;

        const localPayload = createBackupPayload({
          accounts: snapshot.accounts ?? [],
          categories: snapshot.categories ?? [],
          transactions: snapshot.transactions ?? [],
          budgets: snapshot.budgets ?? [],
          recurring: snapshot.recurring ?? { rules: [], instances: [] },
          goals: snapshot.goals ?? [],
          household: snapshot.household ?? { household: null, members: [], invites: [], auditEvents: [] },
          monthClosures: snapshot.monthClosures ?? []
        });
        const fingerprint = normalizeFingerprint(snapshot.fingerprint) || computeBackupFingerprint(localPayload);
        this.baseFingerprint = fingerprint;
        this.localFingerprint = fingerprint;
        this.remoteFingerprint = fingerprint;
        this.remoteUpdatedAt = snapshot.updatedAt ?? new Date();
        this.localDirty = false;
        preferencesStore.markRestore(new Date());
      } catch (error) {
        this.suppressDirtySignals = false;
        this.lastError = error?.message ?? 'Failed to pull backup.';
        throw error;
      } finally {
        this.status = 'idle';
        this.evaluateState();
      }
    },
    dismissBanner() {
      this.dismissedBannerKey = this.stateKey;
      this.persist();
    },
    startRemoteChecks() {
      if (typeof window === 'undefined') return;
      if (!focusListener) {
        focusListener = () => {
          void this.checkRemoteMetadata({ force: true });
        };
        window.addEventListener('focus', focusListener);
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) {
            void this.checkRemoteMetadata({ force: true });
          }
        });
      }
      if (!remoteInterval) {
        remoteInterval = setInterval(() => {
          void this.checkRemoteMetadata();
        }, REMOTE_CHECK_INTERVAL_MS);
      }
    }
  }
});
