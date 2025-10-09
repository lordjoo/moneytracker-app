import { defineStore } from 'pinia';
import { parseDate, readJson, writeJson } from '@/utils/storage';

const STORAGE_KEY = 'preferences';

export const usePreferencesStore = defineStore('preferences', {
  state: () => ({
    lastBackupAt: null,
    lastRestoreAt: null,
    theme: 'mymoney-light',
    onboardingCompleted: false,
    initialized: false
  }),
  getters: {
    lastBackupDate: (state) => state.lastBackupAt,
    lastRestoreDate: (state) => state.lastRestoreAt,
    activeTheme: (state) => state.theme,
    hasCompletedOnboarding: (state) => state.onboardingCompleted
  },
  actions: {
    init() {
      if (this.initialized) return;
      const record = readJson(STORAGE_KEY, {
        lastBackupAt: null,
        lastRestoreAt: null,
        theme: 'mymoney-light',
        onboardingCompleted: false
      });
      this.lastBackupAt = parseDate(record.lastBackupAt);
      this.lastRestoreAt = parseDate(record.lastRestoreAt);
      this.theme = record.theme ?? 'mymoney-light';
      this.onboardingCompleted = Boolean(record.onboardingCompleted);
      this.initialized = true;
    },
    persist() {
      writeJson(STORAGE_KEY, {
        lastBackupAt: this.lastBackupAt ? this.lastBackupAt.toISOString() : null,
        lastRestoreAt: this.lastRestoreAt ? this.lastRestoreAt.toISOString() : null,
        theme: this.theme,
        onboardingCompleted: this.onboardingCompleted
      });
    },
    markBackup(date = new Date()) {
      this.lastBackupAt = date instanceof Date ? date : new Date(date);
      this.persist();
    },
    markRestore(date = new Date()) {
      this.lastRestoreAt = date instanceof Date ? date : new Date(date);
      this.persist();
    },
    setTheme(theme) {
      this.theme = theme;
      this.persist();
    },
    completeOnboarding() {
      this.onboardingCompleted = true;
      this.persist();
    }
  }
});
