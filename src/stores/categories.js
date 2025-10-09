import { defineStore } from 'pinia';
import { generateId, parseDate, readJson, writeJson } from '@/utils/storage';

const STORAGE_KEY = 'categories';

const DEFAULT_CATEGORIES = [
  { id: 'housing', name: 'Housing', type: 'expense', icon: 'home' },
  { id: 'food-dining', name: 'Food & Dining', type: 'expense', icon: 'shopping-bag' },
  { id: 'transportation', name: 'Transportation', type: 'expense', icon: 'truck' },
  { id: 'entertainment', name: 'Entertainment', type: 'expense', icon: 'sparkles' },
  { id: 'healthcare', name: 'Healthcare', type: 'expense', icon: 'heart' },
  { id: 'savings', name: 'Savings', type: 'income', icon: 'wallet' },
  { id: 'salary', name: 'Salary', type: 'income', icon: 'banknotes' },
  { id: 'opening-balance', name: 'Opening balance', type: 'income', icon: 'banknotes' },
  { id: 'transfer', name: 'Transfer', type: 'income', icon: 'arrows-right-left' }
];

function deserialiseCategory(record) {
  return {
    ...record,
    createdAt: parseDate(record.createdAt),
    updatedAt: parseDate(record.updatedAt)
  };
}

function serialiseCategory(category) {
  return {
    ...category,
    createdAt: category.createdAt ? category.createdAt.toISOString() : null,
    updatedAt: category.updatedAt ? category.updatedAt.toISOString() : null
  };
}

export const useCategoriesStore = defineStore('categories', {
  state: () => ({
    categories: [],
    status: 'idle',
    initialized: false
  }),
  getters: {
    byId: (state) => (id) => state.categories.find((category) => category.id === id) ?? null,
    expenseCategories: (state) => state.categories.filter((category) => category.type === 'expense'),
    incomeCategories: (state) => state.categories.filter((category) => category.type === 'income')
  },
  actions: {
    init() {
      if (this.initialized) return;
      this.status = 'loading';
      const records = readJson(STORAGE_KEY, []);
      if (!records || records.length === 0) {
        const seeded = DEFAULT_CATEGORIES.map((category) => ({
          ...category,
          createdAt: new Date(),
          updatedAt: new Date()
        }));
        this.categories = seeded;
        this.persist();
      } else {
        this.categories = records.map(deserialiseCategory).sort((a, b) => a.name.localeCompare(b.name));
      }
      this.status = 'ready';
      this.initialized = true;
    },
    persist() {
      const serialised = this.categories.map(serialiseCategory).sort((a, b) => a.name.localeCompare(b.name));
      writeJson(STORAGE_KEY, serialised);
    },
    upsertCategory(category) {
      const payload = {
        ...category,
        name: String(category.name ?? '').trim(),
        type: category.type === 'income' ? 'income' : 'expense',
        icon: String(category.icon ?? '').trim()
      };
      if (!payload.name) {
        throw new Error('Category name is required');
      }
      const now = new Date();
      if (payload.id) {
        const index = this.categories.findIndex((existing) => existing.id === payload.id);
        if (index === -1) {
          throw new Error('Category not found');
        }
        this.categories[index] = {
          ...this.categories[index],
          ...payload,
          updatedAt: now
        };
      } else {
        const id = generateId('cat');
        this.categories.push({
          ...payload,
          id,
          createdAt: now,
          updatedAt: now
        });
        payload.id = id;
      }
      this.categories.sort((a, b) => a.name.localeCompare(b.name));
      this.persist();
      return payload.id;
    },
    replaceAll(categories) {
      this.categories = categories.map(deserialiseCategory).sort((a, b) => a.name.localeCompare(b.name));
      this.status = 'ready';
      this.initialized = true;
      this.persist();
    },
    clear() {
      this.categories = [];
      this.status = 'idle';
      this.initialized = false;
      this.persist();
    }
  }
});
