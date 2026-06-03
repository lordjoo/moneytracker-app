import { defineStore } from 'pinia';
import { parseDate, readJson, writeJson } from '@/utils/storage';
import { normalizeCycleStartDay } from '@/utils/dates';

const STORAGE_KEY = 'preferences';

export const usePreferencesStore = defineStore('preferences', {
  state: () => ({
    lastBackupAt: null,
    lastRestoreAt: null,
    theme: 'mymoney-light',
    onboardingCompleted: false,
    mainCurrency: 'USD',
    currencyApiToken: '',
    monthStartDay: 1,
    initialized: false
  }),
  getters: {
    lastBackupDate: (state) => state.lastBackupAt,
    lastRestoreDate: (state) => state.lastRestoreAt,
    activeTheme: (state) => state.theme,
    hasCompletedOnboarding: (state) => state.onboardingCompleted,
    baseCurrency: (state) => state.mainCurrency,
    currencyToken: (state) => state.currencyApiToken,
    hasCurrencyToken: (state) => Boolean(state.currencyApiToken),
    cycleStartDay: (state) => normalizeCycleStartDay(state.monthStartDay)
  },
  actions: {
    init() {
      if (this.initialized) return;
      const record = readJson(STORAGE_KEY, {
        lastBackupAt: null,
        lastRestoreAt: null,
        theme: 'mymoney-light',
        onboardingCompleted: false,
        mainCurrency: 'USD',
        currencyApiToken: '',
        monthStartDay: 1
      });
      this.lastBackupAt = parseDate(record.lastBackupAt);
      this.lastRestoreAt = parseDate(record.lastRestoreAt);
      this.theme = record.theme ?? 'mymoney-light';
      this.onboardingCompleted = Boolean(record.onboardingCompleted);
      this.mainCurrency = record.mainCurrency || 'USD';
      this.currencyApiToken = record.currencyApiToken || '';
      this.monthStartDay = normalizeCycleStartDay(record.monthStartDay);
      this.initialized = true;
    },
    persist() {
      writeJson(STORAGE_KEY, {
        lastBackupAt: this.lastBackupAt ? this.lastBackupAt.toISOString() : null,
        lastRestoreAt: this.lastRestoreAt ? this.lastRestoreAt.toISOString() : null,
        theme: this.theme,
        onboardingCompleted: this.onboardingCompleted,
        mainCurrency: this.mainCurrency,
        currencyApiToken: this.currencyApiToken,
        monthStartDay: normalizeCycleStartDay(this.monthStartDay)
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
    setMainCurrency(currency) {
      this.mainCurrency = currency || 'USD';
      this.persist();
    },
    setCurrencyApiToken(token) {
      this.currencyApiToken = token?.trim?.() ?? '';
      this.persist();
    },
    setMonthStartDay(day) {
      this.monthStartDay = normalizeCycleStartDay(day);
      this.persist();
    },
    completeOnboarding() {
      this.onboardingCompleted = true;
      this.persist();
    }
  }
});
