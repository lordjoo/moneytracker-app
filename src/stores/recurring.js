import { defineStore } from 'pinia';
import { generateId, parseDate, readJson, writeJson } from '@/utils/storage';
import { coerceDateKey, parseDateKey, toDateKey } from '@/utils/dates';
import { notifyBackupDirty } from '@/utils/backupDirtySignal';
import { useTransactionsStore } from './transactions';
import { useAccountsStore } from './accounts';
import { useHouseholdStore } from './household';

const STORAGE_KEY = 'recurring';
const DEFAULT_INTERVAL_DAYS = 30;

function ensureNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampDayOfMonth(day) {
  const parsed = Math.round(ensureNumber(day, NaN));
  if (!Number.isFinite(parsed)) return null;
  return Math.min(31, Math.max(1, parsed));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + Number(days || 0));
  return next;
}

function toDateFromKeyOrFallback(dateKey, fallback = new Date()) {
  return parseDateKey(dateKey) ?? (fallback instanceof Date ? fallback : new Date(fallback));
}

function getNextMonthlyDate(fromKey, dayOfMonth) {
  const base = toDateFromKeyOrFallback(fromKey, new Date());
  const targetDay = clampDayOfMonth(dayOfMonth ?? base.getDate()) ?? base.getDate();
  const nextMonth = new Date(base.getFullYear(), base.getMonth() + 1, 1, 12, 0, 0, 0);
  const maxDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
  nextMonth.setDate(Math.min(targetDay, maxDay));
  return toDateKey(nextMonth);
}

function computeNextRunOn(rule, fromDateKey) {
  const fromDate = toDateFromKeyOrFallback(fromDateKey, new Date());
  if (rule.frequency === 'weekly') {
    return toDateKey(addDays(fromDate, 7));
  }
  if (rule.frequency === 'every-n-days') {
    const intervalDays = Math.max(1, Math.round(ensureNumber(rule.intervalDays, DEFAULT_INTERVAL_DAYS)));
    return toDateKey(addDays(fromDate, intervalDays));
  }
  return getNextMonthlyDate(fromDateKey, rule.dayOfMonth);
}

function serialiseRule(rule) {
  return {
    ...rule,
    amount: ensureNumber(rule.amount, 0),
    intervalDays: Math.max(1, Math.round(ensureNumber(rule.intervalDays, DEFAULT_INTERVAL_DAYS))),
    dayOfMonth: clampDayOfMonth(rule.dayOfMonth),
    nextRunOn: coerceDateKey(rule.nextRunOn, toDateKey(new Date())),
    lastRunOn: coerceDateKey(rule.lastRunOn, null),
    createdAt: rule.createdAt ? rule.createdAt.toISOString() : null,
    updatedAt: rule.updatedAt ? rule.updatedAt.toISOString() : null
  };
}

function deserialiseRule(rule) {
  return {
    ...rule,
    amount: ensureNumber(rule.amount, 0),
    intervalDays: Math.max(1, Math.round(ensureNumber(rule.intervalDays, DEFAULT_INTERVAL_DAYS))),
    dayOfMonth: clampDayOfMonth(rule.dayOfMonth),
    nextRunOn: coerceDateKey(rule.nextRunOn, toDateKey(new Date())),
    lastRunOn: coerceDateKey(rule.lastRunOn, null),
    createdAt: parseDate(rule.createdAt),
    updatedAt: parseDate(rule.updatedAt)
  };
}

function serialiseInstance(instance) {
  return {
    ...instance,
    dueOn: coerceDateKey(instance.dueOn, toDateKey(new Date())),
    resolvedAt: instance.resolvedAt ? new Date(instance.resolvedAt).toISOString() : null
  };
}

function deserialiseInstance(instance) {
  return {
    ...instance,
    dueOn: coerceDateKey(instance.dueOn, toDateKey(new Date())),
    resolvedAt: parseDate(instance.resolvedAt)
  };
}

export const useRecurringStore = defineStore('recurring', {
  state: () => ({
    rules: [],
    instances: [],
    status: 'idle',
    initialized: false
  }),
  getters: {
    activeRules: (state) =>
      state.rules.filter((rule) => rule.isActive).sort((a, b) => (a.nextRunOn ?? '').localeCompare(b.nextRunOn ?? '')),
    dueInstances: (state) =>
      state.instances
        .filter((instance) => instance.status === 'pending')
        .sort((a, b) => (a.dueOn ?? '').localeCompare(b.dueOn ?? '')),
    dueCount() {
      return this.dueInstances.length;
    },
    ruleById: (state) => (id) => state.rules.find((rule) => rule.id === id) ?? null
  },
  actions: {
    init() {
      if (this.initialized) return;
      this.status = 'loading';
      const payload = readJson(STORAGE_KEY, { rules: [], instances: [] });
      this.rules = Array.isArray(payload?.rules) ? payload.rules.map(deserialiseRule) : [];
      this.instances = Array.isArray(payload?.instances)
        ? payload.instances.map(deserialiseInstance)
        : [];
      this.status = 'ready';
      this.initialized = true;
    },
    persist() {
      writeJson(STORAGE_KEY, {
        rules: this.rules.map(serialiseRule),
        instances: this.instances.map(serialiseInstance)
      });
      notifyBackupDirty('recurring');
    },
    upsertRule({
      id,
      name,
      type,
      accountId,
      counterpartyAccountId = '',
      categoryId = '',
      amount,
      note = '',
      frequency = 'monthly',
      intervalDays = DEFAULT_INTERVAL_DAYS,
      dayOfMonth = null,
      nextRunOn = toDateKey(new Date()),
      isActive = true
    }) {
      const householdStore = useHouseholdStore();
      if (!householdStore.initialized) {
        householdStore.init();
      }
      householdStore.ensureCanEditFinancialData('edit recurring rules');
      const normalizedName = String(name ?? '').trim();
      if (!normalizedName) {
        throw new Error('Rule name is required');
      }
      const normalizedType = ['credit', 'debit', 'transfer'].includes(type) ? type : 'debit';
      const normalizedAccountId = String(accountId ?? '').trim();
      if (!normalizedAccountId) {
        throw new Error('Source account is required');
      }
      const accountsStore = useAccountsStore();
      if (!accountsStore.initialized) {
        accountsStore.init();
      }
      if (!accountsStore.isAccountVisible(normalizedAccountId)) {
        throw new Error('Source account is private in the household.');
      }
      const normalizedAmount = ensureNumber(amount, NaN);
      if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        throw new Error('Amount must be greater than zero');
      }

      if (normalizedType === 'transfer') {
        if (!String(counterpartyAccountId ?? '').trim()) {
          throw new Error('Destination account is required for transfers');
        }
        if (!accountsStore.isAccountVisible(String(counterpartyAccountId).trim())) {
          throw new Error('Destination account is private in the household.');
        }
      } else if (!String(categoryId ?? '').trim()) {
        throw new Error('Category is required for debit/credit rules');
      }

      const normalizedFrequency = ['weekly', 'monthly', 'every-n-days'].includes(frequency)
        ? frequency
        : 'monthly';
      const normalizedInterval = Math.max(1, Math.round(ensureNumber(intervalDays, DEFAULT_INTERVAL_DAYS)));
      const normalizedDayOfMonth = clampDayOfMonth(dayOfMonth);
      const normalizedNextRun = coerceDateKey(nextRunOn, toDateKey(new Date()));
      const now = new Date();

      const payload = {
        name: normalizedName,
        type: normalizedType,
        accountId: normalizedAccountId,
        counterpartyAccountId: normalizedType === 'transfer' ? String(counterpartyAccountId).trim() : '',
        categoryId: normalizedType === 'transfer' ? '' : String(categoryId).trim(),
        amount: normalizedAmount,
        note: String(note ?? '').trim(),
        frequency: normalizedFrequency,
        intervalDays: normalizedInterval,
        dayOfMonth: normalizedFrequency === 'monthly' ? normalizedDayOfMonth : null,
        nextRunOn: normalizedNextRun,
        isActive: Boolean(isActive)
      };

      if (id) {
        const index = this.rules.findIndex((rule) => rule.id === id);
        if (index === -1) {
          throw new Error('Recurring rule not found');
        }
        this.rules[index] = {
          ...this.rules[index],
          ...payload,
          updatedAt: now
        };
      } else {
        this.rules.push({
          id: generateId('rrule'),
          ...payload,
          lastRunOn: null,
          createdAt: now,
          updatedAt: now
        });
      }

      this.persist();
      this.syncDueItems();
      householdStore.logEvent('recurring.rule.upserted', `Saved recurring rule "${normalizedName}"`, {
        ruleId: id ?? normalizedName
      });
    },
    removeRule(id) {
      const householdStore = useHouseholdStore();
      if (!householdStore.initialized) {
        householdStore.init();
      }
      householdStore.ensureCanEditFinancialData('delete recurring rules');
      this.rules = this.rules.filter((rule) => rule.id !== id);
      this.instances = this.instances.filter((instance) => instance.ruleId !== id);
      this.persist();
      householdStore.logEvent('recurring.rule.deleted', 'Deleted recurring rule', {
        ruleId: id
      });
    },
    setRuleActive(id, enabled) {
      const householdStore = useHouseholdStore();
      if (!householdStore.initialized) {
        householdStore.init();
      }
      householdStore.ensureCanEditFinancialData('update recurring rules');
      const rule = this.ruleById(id);
      if (!rule) return;
      rule.isActive = Boolean(enabled);
      rule.updatedAt = new Date();
      this.persist();
      householdStore.logEvent('recurring.rule.toggled', `${enabled ? 'Enabled' : 'Paused'} recurring rule`, {
        ruleId: id
      });
    },
    syncDueItems(today = toDateKey(new Date())) {
      const todayKey = coerceDateKey(today, toDateKey(new Date()));
      for (const rule of this.rules) {
        if (!rule.isActive) continue;
        let cursor = coerceDateKey(rule.nextRunOn, todayKey);
        let guard = 0;

        while (cursor && cursor <= todayKey && guard < 720) {
          const exists = this.instances.some(
            (instance) => instance.ruleId === rule.id && instance.dueOn === cursor
          );
          if (!exists) {
            this.instances.push({
              id: generateId('rinst'),
              ruleId: rule.id,
              dueOn: cursor,
              status: 'pending',
              createdAt: new Date().toISOString(),
              resolvedAt: null,
              transactionId: null
            });
          }
          const nextRun = computeNextRunOn(rule, cursor);
          if (!nextRun || nextRun === cursor) {
            break;
          }
          cursor = nextRun;
          guard += 1;
        }

        if (cursor && cursor !== rule.nextRunOn) {
          rule.nextRunOn = cursor;
          rule.updatedAt = new Date();
        }
      }

      this.persist();
    },
    async postInstance(instanceId) {
      const householdStore = useHouseholdStore();
      if (!householdStore.initialized) {
        householdStore.init();
      }
      householdStore.ensureCanEditFinancialData('post recurring items');
      const instance = this.instances.find((item) => item.id === instanceId);
      if (!instance || instance.status !== 'pending') return;
      const rule = this.ruleById(instance.ruleId);
      if (!rule) {
        throw new Error('Rule not found for this item');
      }
      const accountsStore = useAccountsStore();
      if (!accountsStore.initialized) {
        accountsStore.init();
      }
      if (!accountsStore.isAccountVisible(rule.accountId)) {
        throw new Error('Recurring rule source account is private in the household.');
      }
      if (rule.type === 'transfer' && !accountsStore.isAccountVisible(rule.counterpartyAccountId)) {
        throw new Error('Recurring rule destination account is private in the household.');
      }

      const transactionsStore = useTransactionsStore();
      if (!transactionsStore.initialized) {
        transactionsStore.init();
      }

      const payload = {
        type: rule.type,
        accountId: rule.accountId,
        amount: rule.amount,
        note: rule.note,
        occurredAt: instance.dueOn
      };

      if (rule.type === 'transfer') {
        payload.counterpartyAccountId = rule.counterpartyAccountId;
      } else {
        payload.categoryId = rule.categoryId;
      }

      await transactionsStore.addTransaction(payload);
      instance.status = 'posted';
      instance.resolvedAt = new Date();
      rule.lastRunOn = instance.dueOn;
      rule.updatedAt = new Date();
      this.persist();
      householdStore.logEvent('recurring.instance.posted', 'Posted recurring instance', {
        instanceId,
        ruleId: rule.id
      });
    },
    skipInstance(instanceId) {
      const householdStore = useHouseholdStore();
      if (!householdStore.initialized) {
        householdStore.init();
      }
      householdStore.ensureCanEditFinancialData('skip recurring items');
      const instance = this.instances.find((item) => item.id === instanceId);
      if (!instance || instance.status !== 'pending') return;
      instance.status = 'skipped';
      instance.resolvedAt = new Date();
      const rule = this.ruleById(instance.ruleId);
      if (rule) {
        rule.updatedAt = new Date();
      }
      this.persist();
      householdStore.logEvent('recurring.instance.skipped', 'Skipped recurring instance', {
        instanceId
      });
    },
    async postAllDue() {
      const pending = [...this.dueInstances];
      for (const instance of pending) {
        await this.postInstance(instance.id);
      }
    },
    replaceAll(payload) {
      this.rules = Array.isArray(payload?.rules) ? payload.rules.map(deserialiseRule) : [];
      this.instances = Array.isArray(payload?.instances)
        ? payload.instances.map(deserialiseInstance)
        : [];
      this.status = 'ready';
      this.initialized = true;
      this.persist();
    },
    clear() {
      this.rules = [];
      this.instances = [];
      this.status = 'idle';
      this.initialized = false;
      this.persist();
    }
  }
});
