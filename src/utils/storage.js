const STORAGE_PREFIX = 'mymoney';

const memoryFallback = new Map();

function clone(value) {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch (error) {
      console.warn('structuredClone failed, falling back to JSON clone.', error);
    }
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    console.warn('JSON clone fallback failed, returning original value.', error);
    return value;
  }
}

function getStorage() {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage;
  } catch (error) {
    console.warn('LocalStorage unavailable, falling back to in-memory store.', error);
    return null;
  }
}

function buildKey(name) {
  return `${STORAGE_PREFIX}:${name}`;
}

export function readJson(name, fallback) {
  const key = buildKey(name);
  const storage = getStorage();
  if (!storage) {
    const memo = memoryFallback.get(key);
    if (memo !== undefined) {
      return clone(memo);
    }
    return clone(fallback);
  }
  try {
    const raw = storage.getItem(key);
    if (raw == null) {
      return clone(fallback);
    }
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Failed to read key ${key} from localStorage. Using fallback.`, error);
    return clone(fallback);
  }
}

export function writeJson(name, value) {
  const key = buildKey(name);
  const storage = getStorage();
  const serialisable = value === undefined ? null : JSON.stringify(value);
  if (!storage) {
    if (serialisable === null) {
      memoryFallback.delete(key);
    } else {
      memoryFallback.set(key, JSON.parse(serialisable));
    }
    return;
  }
  try {
    if (serialisable === null) {
      storage.removeItem(key);
    } else {
      storage.setItem(key, serialisable);
    }
  } catch (error) {
    console.error(`Failed to write key ${key} to localStorage.`, error);
  }
}

export function generateId(prefix) {
  const base = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return prefix ? `${prefix}_${base}` : base;
}

export function nowISO() {
  return new Date().toISOString();
}

export function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
