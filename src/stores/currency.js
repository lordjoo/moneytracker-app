import { computed, onScopeDispose, reactive, ref, watch, nextTick } from 'vue';
import { defineStore } from 'pinia';
import { usePreferencesStore } from '@/stores/preferences';
import { useAccountsStore } from '@/stores/accounts';
import currencyList, { currencyNames } from '@/utils/currencies';

const RATE_TTL = 60 * 60 * 1000; // 1 hour
const STORAGE_KEY = 'currency_rates';
const EXCHANGE_RATE_API_BASE_URL = 'https://v6.exchangerate-api.com/v6';

function makeRateKey(from, to) {
  return `${normalizeCurrencyCode(from)}_${normalizeCurrencyCode(to)}`;
}

function normalizeCurrencyCode(value) {
  return String(value ?? '').trim().toUpperCase();
}

// localStorage utilities for currency rates
function loadRatesFromStorage() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    
    const data = JSON.parse(stored);
    const now = Date.now();
    const validRates = {};
    
    // Filter out expired rates
    Object.entries(data).forEach(([key, value]) => {
      if (value && typeof value === 'object' && value.fetchedAt && value.rate) {
        if (now - value.fetchedAt < RATE_TTL) {
          validRates[key] = value;
        }
      }
    });
    
    return validRates;
  } catch (error) {
    console.warn('Failed to load currency rates from storage:', error);
    return {};
  }
}

function saveRatesToStorage(rates) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rates));
  } catch (error) {
    console.warn('Failed to save currency rates to storage:', error);
  }
}

function currencyApiErrorMessage(error) {
  if (error instanceof TypeError && /failed to fetch/i.test(error.message)) {
    return 'Failed to reach ExchangeRate-API. Check your internet connection, ad blocker, DNS, or browser privacy settings.';
  }
  return error?.message ?? 'Failed to fetch currency rates';
}

export const useCurrencyStore = defineStore('currency', () => {
  const preferencesStore = usePreferencesStore();
  const accountsStore = useAccountsStore();

  if (!preferencesStore.initialized) {
    preferencesStore.init();
  }
  if (!accountsStore.initialized) {
    accountsStore.init();
  }

  // Initialize rates from localStorage
  const rates = reactive(loadRatesFromStorage());
  const pendingBatches = reactive(new Set());
  const lastError = ref('');
  const status = ref('idle');
  const lastUpdate = ref(Date.now()); // Force reactivity trigger

  const mainCurrency = computed(() => preferencesStore.baseCurrency || 'USD');
  const apiToken = computed(() => preferencesStore.currencyToken || '');
  const hasToken = computed(() => Boolean(apiToken.value));

  function clearRates() {
    for (const key of Object.keys(rates)) {
      delete rates[key];
    }
    saveRatesToStorage({});
    triggerReactivityUpdate();
  }

  function triggerReactivityUpdate() {
    lastUpdate.value = Date.now();
    // Force Vue to re-evaluate computed properties
    nextTick();
  }

  watch(
    () => apiToken.value,
    (newToken, oldToken) => {
      if (newToken !== oldToken) {
        clearRates();
        lastError.value = '';
      }
    }
  );

  // Batch fetch multiple currencies at once
  async function fetchRates(baseCurrency, targetCurrencies) {
    const normalizedBase = normalizeCurrencyCode(baseCurrency);
    const normalizedTargets = [...new Set((targetCurrencies || []).map(normalizeCurrencyCode).filter(Boolean))];
    if (!normalizedBase || normalizedTargets.length === 0) {
      return {};
    }

    // Filter out currencies that are the same as base or already cached
    const currenciesToFetch = normalizedTargets.filter(currency => {
      if (currency === normalizedBase) return false;
      const key = makeRateKey(normalizedBase, currency);
      const record = rates[key];
      return !record || Date.now() - record.fetchedAt >= RATE_TTL;
    });

    if (currenciesToFetch.length === 0) {
      // Return cached rates
      const result = {};
      normalizedTargets.forEach(currency => {
        if (currency === normalizedBase) {
          result[currency] = 1;
        } else {
          const key = makeRateKey(normalizedBase, currency);
          result[currency] = rates[key]?.rate || null;
        }
      });
      return result;
    }

    if (!apiToken.value) {
      throw new Error('Currency conversion requires an API token');
    }

    const batchKey = `${normalizedBase}:${[...currenciesToFetch].sort().join(',')}`;
    if (pendingBatches.has(batchKey)) {
      // Return what we have in cache for now
      const result = {};
      normalizedTargets.forEach(currency => {
        if (currency === normalizedBase) {
          result[currency] = 1;
        } else {
          const key = makeRateKey(normalizedBase, currency);
          result[currency] = rates[key]?.rate || null;
        }
      });
      return result;
    }

    pendingBatches.add(batchKey);
    status.value = 'loading';

    try {
      const url = new URL(
        `${EXCHANGE_RATE_API_BASE_URL}/${encodeURIComponent(apiToken.value)}/latest/${encodeURIComponent(normalizedBase)}`
      );

      const response = await fetch(url.toString(), {
        cache: 'no-store',
        mode: 'cors'
      });
      
      if (!response.ok) {
        throw new Error(`Currency API responded with status ${response.status}`);
      }
      
      const payload = await response.json();
      if (payload?.result && payload.result !== 'success') {
        throw new Error(payload['error-type'] || 'Currency API request failed');
      }
      const data = payload?.conversion_rates || {};
      
      // exchangerate-api.com returns conversion_rates as { CODE: rate }.
      const fetchedAt = Date.now();
      currenciesToFetch.forEach(currency => {
        const rate = Number(data[currency]);
        if (Number.isFinite(rate)) {
          const key = makeRateKey(normalizedBase, currency);
          rates[key] = { rate, fetchedAt };
        }
      });
      const missingCurrencies = currenciesToFetch.filter(currency => !Number.isFinite(Number(data[currency])));
      if (missingCurrencies.length > 0) {
        throw new Error(`Currency API did not return rates for ${missingCurrencies.join(', ')}`);
      }

      // Save to localStorage and trigger reactivity
      saveRatesToStorage(rates);
      triggerReactivityUpdate();
      lastError.value = '';
      
      // Return all requested rates (including cached and newly fetched)
      const result = {};
      normalizedTargets.forEach(currency => {
        if (currency === normalizedBase) {
          result[currency] = 1;
        } else {
          const key = makeRateKey(normalizedBase, currency);
          result[currency] = rates[key]?.rate || null;
        }
      });
      
      return result;
    } catch (error) {
      console.error(error);
      lastError.value = currencyApiErrorMessage(error);
      throw error;
    } finally {
      pendingBatches.delete(batchKey);
      if (pendingBatches.size === 0) {
        status.value = 'idle';
      }
    }
  }

  // Legacy single rate fetch for backward compatibility
  async function fetchRate(from, to) {
    const normalizedFrom = normalizeCurrencyCode(from);
    const normalizedTo = normalizeCurrencyCode(to);
    if (!normalizedFrom || !normalizedTo || normalizedFrom === normalizedTo) {
      return 1;
    }
    
    const rates = await fetchRates(normalizedFrom, [normalizedTo]);
    return rates[normalizedTo];
  }

  function requestRate(from, to) {
    if (!hasToken.value) return;
    const normalizedFrom = normalizeCurrencyCode(from);
    const normalizedTo = normalizeCurrencyCode(to);
    if (!normalizedFrom || !normalizedTo || normalizedFrom === normalizedTo) return;
    fetchRates(normalizedFrom, [normalizedTo]).catch(() => {
      /* handled via lastError */
    });
  }

  // Get all unique currencies needed for accounts
  function getNeededCurrencies() {
    const target = normalizeCurrencyCode(mainCurrency.value);
    const currencies = new Set([target]);
    
    for (const account of accountsStore.visibleAccounts) {
      const sourceCurrency = normalizeCurrencyCode(account.currency || target);
      if (sourceCurrency && sourceCurrency !== target) {
        currencies.add(sourceCurrency);
      }
    }
    
    return Array.from(currencies);
  }

  // Request rates for all needed currencies at once
  function requestNeededRates() {
    if (!hasToken.value) return;
    
    const target = normalizeCurrencyCode(mainCurrency.value);
    const neededCurrencies = getNeededCurrencies();
    const currenciesToFetch = neededCurrencies.filter(currency => currency !== target);
    
    if (currenciesToFetch.length === 0) return;
    
    // Check if we need to fetch any rates (looking for rates FROM account currency TO main currency OR vice versa)
    const needsFetch = currenciesToFetch.some(currency => {
      const directKey = makeRateKey(currency, target);
      const inverseKey = makeRateKey(target, currency);
      const directRecord = rates[directKey];
      const inverseRecord = rates[inverseKey];
      
      const hasValidDirect = directRecord && Date.now() - directRecord.fetchedAt < RATE_TTL;
      const hasValidInverse = inverseRecord && Date.now() - inverseRecord.fetchedAt < RATE_TTL;
      
      return !hasValidDirect && !hasValidInverse;
    });
    
    if (needsFetch) {
      // Try to fetch from main currency to other currencies (this often works better with APIs)
      fetchRates(target, currenciesToFetch).catch(() => {
        /* handled via lastError */
      });
    }
  }

  function convertAmount(amount, from, to = mainCurrency.value, { requestIfMissing = true } = {}) {
    // Include lastUpdate in dependency tracking to force re-evaluation
    lastUpdate.value; // This makes the function reactive to rate updates
    
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount)) {
      return null;
    }
    const normalizedFrom = normalizeCurrencyCode(from);
    const normalizedTo = normalizeCurrencyCode(to);
    if (!normalizedFrom || !normalizedTo || normalizedFrom === normalizedTo) {
      return numericAmount;
    }
    
    // Try direct rate first
    const key = makeRateKey(normalizedFrom, normalizedTo);
    const record = rates[key];
    
    if (record && Date.now() - record.fetchedAt < RATE_TTL) {
      return numericAmount * record.rate;
    }
    
    // Try inverse rate if direct rate not found
    const inverseKey = makeRateKey(normalizedTo, normalizedFrom);
    const inverseRecord = rates[inverseKey];
    
    if (inverseRecord && Date.now() - inverseRecord.fetchedAt < RATE_TTL) {
      return numericAmount / inverseRecord.rate;
    }
    
    if (requestIfMissing && hasToken.value) {
      requestRate(normalizedFrom, normalizedTo);
    }
    return null;
  }

  const convertedAccountBalances = computed(() => {
    // Force reactivity by depending on lastUpdate
    lastUpdate.value;
    
    const results = new Map();
    const target = normalizeCurrencyCode(mainCurrency.value);
    for (const account of accountsStore.visibleAccounts) {
      const sourceCurrency = normalizeCurrencyCode(account.currency || target);
      const value = convertAmount(account.balance, sourceCurrency, target, {
        requestIfMissing: false
      });
      if (value === null && sourceCurrency !== target) {
        results.set(account.id, null);
      } else {
        const fallback = Number(account.balance) || 0;
        const amount = value ?? fallback;
        results.set(account.id, amount);
      }
    }
    return results;
  });

  const accountsMissingConversion = computed(() => {
    // Force reactivity by depending on lastUpdate
    lastUpdate.value;
    
    const target = normalizeCurrencyCode(mainCurrency.value);
    const missing = [];
    for (const account of accountsStore.visibleAccounts) {
      const sourceCurrency = normalizeCurrencyCode(account.currency || target);
      if (sourceCurrency === target) continue;
      const converted = convertAmount(account.balance, sourceCurrency, target, {
        requestIfMissing: false
      });
      if (converted === null) {
        missing.push(account.id);
      }
    }
    return missing;
  });

  const hasPendingConversions = computed(() => {
    // Force reactivity by depending on lastUpdate
    lastUpdate.value;
    
    const target = normalizeCurrencyCode(mainCurrency.value);
    for (const account of accountsStore.visibleAccounts) {
      const sourceCurrency = normalizeCurrencyCode(account.currency || target);
      if (sourceCurrency === target) continue;
      const key = makeRateKey(sourceCurrency, target);
      const inverseKey = makeRateKey(target, sourceCurrency);
      if (!rates[key] && !rates[inverseKey]) {
        return hasToken.value;
      }
    }
    return false;
  });

  const totalWorthInMain = computed(() => {
    // Force reactivity by depending on lastUpdate
    lastUpdate.value;
    
    const target = normalizeCurrencyCode(mainCurrency.value);
    let total = 0;
    for (const account of accountsStore.visibleAccounts) {
      const amount = Number(account.balance) || 0;
      const sourceCurrency = normalizeCurrencyCode(account.currency || target);
      if (sourceCurrency === target) {
        total += amount;
        continue;
      }
      const converted = convertAmount(amount, sourceCurrency, target, {
        requestIfMissing: false
      });
      if (converted !== null) {
        total += converted;
      }
    }
    return total;
  });

  // Watch for changes in main currency or accounts and fetch needed rates
  // Using watch instead of watchEffect to have more control over reactivity
  watch(
    [() => mainCurrency.value, () => accountsStore.visibleAccounts.map((a) => a.currency).join(','), () => hasToken.value],
    () => {
      if (hasToken.value && accountsStore.visibleAccounts.length > 0) {
        // Clean expired rates first
        cleanExpiredRates();
        
        // Debounce the rate fetching to avoid rapid successive calls
        setTimeout(() => {
          requestNeededRates();
        }, 100);
      }
    },
    { immediate: true }
  );

  function formatCurrency(value, currency = mainCurrency.value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) {
      return '—';
    }
    const code = currency || mainCurrency.value;
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: code
      }).format(amount);
    } catch (error) {
      console.error(error);
      return `${code} ${amount.toFixed(2)}`;
    }
  }

  function describeCurrency(code) {
    return currencyNames[code] || code;
  }

  function setMainCurrency(code) {
    preferencesStore.setMainCurrency(normalizeCurrencyCode(code) || 'USD');
  }

  function setApiToken(token) {
    preferencesStore.setCurrencyApiToken(token);
  }

  // Force refresh all currency rates
  function forceRefreshRates() {
    if (!hasToken.value) {
      throw new Error('Currency API token is required to refresh rates');
    }
    
    // Clear all cached rates to force fresh fetch
    clearRates();
    
    // Trigger immediate fetch of needed rates
    const target = normalizeCurrencyCode(mainCurrency.value);
    let currenciesToFetch = getNeededCurrencies().filter(currency => currency !== target);
    if (currenciesToFetch.length === 0) {
      currenciesToFetch = [target === 'USD' ? 'EGP' : 'USD'];
    }
    return fetchRates(target, currenciesToFetch);
  }

  // Add function to clean expired rates from storage
  function cleanExpiredRates() {
    const now = Date.now();
    let hasExpiredRates = false;
    
    Object.keys(rates).forEach(key => {
      const record = rates[key];
      if (record && record.fetchedAt && now - record.fetchedAt >= RATE_TTL) {
        delete rates[key];
        hasExpiredRates = true;
      }
    });
    
    if (hasExpiredRates) {
      saveRatesToStorage(rates);
      triggerReactivityUpdate();
    }
  }

  // Clean expired rates on startup and periodically
  cleanExpiredRates();
  const cleanupInterval = setInterval(cleanExpiredRates, 5 * 60 * 1000); // Every 5 minutes
  onScopeDispose(() => clearInterval(cleanupInterval));

  return {
    status,
    lastError,
    lastUpdate: computed(() => lastUpdate.value), // Expose as computed for reactivity
    supportedCurrencies: currencyList,
    mainCurrency,
    apiToken,
    hasToken,
    convertedAccountBalances,
    totalWorthInMain,
    accountsMissingConversion,
    hasPendingConversions,
    formatCurrency,
    describeCurrency,
    convertAmount,
    fetchRates,
    fetchRate, // Keep for backward compatibility
    requestRate,
    requestNeededRates,
    forceRefreshRates,
    cleanExpiredRates,
    setMainCurrency,
    setApiToken
  };
});
