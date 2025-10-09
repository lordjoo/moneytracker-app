import { computed, reactive, ref, watch, nextTick } from 'vue';
import { defineStore } from 'pinia';
import { usePreferencesStore } from '@/stores/preferences';
import { useAccountsStore } from '@/stores/accounts';
import currencyList, { currencyNames } from '@/utils/currencies';

const RATE_TTL = 60 * 60 * 1000; // 1 hour
const STORAGE_KEY = 'currency_rates';

function makeRateKey(from, to) {
  return `${from}_${to}`;
}

// localStorage utilities for currency rates
function loadRatesFromStorage() {
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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rates));
  } catch (error) {
    console.warn('Failed to save currency rates to storage:', error);
  }
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
    if (!baseCurrency || !targetCurrencies || targetCurrencies.length === 0) {
      return {};
    }

    // Filter out currencies that are the same as base or already cached
    const currenciesToFetch = targetCurrencies.filter(currency => {
      if (currency === baseCurrency) return false;
      const key = makeRateKey(baseCurrency, currency);
      const record = rates[key];
      return !record || Date.now() - record.fetchedAt >= RATE_TTL;
    });

    if (currenciesToFetch.length === 0) {
      // Return cached rates
      const result = {};
      targetCurrencies.forEach(currency => {
        if (currency === baseCurrency) {
          result[currency] = 1;
        } else {
          const key = makeRateKey(baseCurrency, currency);
          result[currency] = rates[key]?.rate || null;
        }
      });
      return result;
    }

    if (!apiToken.value) {
      throw new Error('Currency conversion requires an API token');
    }

    const batchKey = `${baseCurrency}:${currenciesToFetch.sort().join(',')}`;
    if (pendingBatches.has(batchKey)) {
      // Return what we have in cache for now
      const result = {};
      targetCurrencies.forEach(currency => {
        if (currency === baseCurrency) {
          result[currency] = 1;
        } else {
          const key = makeRateKey(baseCurrency, currency);
          result[currency] = rates[key]?.rate || null;
        }
      });
      return result;
    }

    pendingBatches.add(batchKey);
    status.value = 'loading';

    try {
      const url = new URL('https://api.currencyapi.com/v3/latest');
      url.searchParams.set('base_currency', baseCurrency);
      url.searchParams.set('currencies', currenciesToFetch.join(','));
      
      const response = await fetch(url.toString(), {
        headers: {
          'apikey': apiToken.value
        }
      });
      
      if (!response.ok) {
        throw new Error(`Currency API responded with status ${response.status}`);
      }
      
      const payload = await response.json();
      const data = payload?.data || {};
      
      // Store all fetched rates (currencyapi.com returns data as {CODE: {code: "CODE", value: rate}})
      const fetchedAt = Date.now();
      currenciesToFetch.forEach(currency => {
        const currencyData = data[currency];
        const rate = Number(currencyData?.value);
        if (Number.isFinite(rate)) {
          const key = makeRateKey(baseCurrency, currency);
          rates[key] = { rate, fetchedAt };
        }
      });

      // Save to localStorage and trigger reactivity
      saveRatesToStorage(rates);
      triggerReactivityUpdate();
      lastError.value = '';
      
      // Return all requested rates (including cached and newly fetched)
      const result = {};
      targetCurrencies.forEach(currency => {
        if (currency === baseCurrency) {
          result[currency] = 1;
        } else {
          const key = makeRateKey(baseCurrency, currency);
          result[currency] = rates[key]?.rate || null;
        }
      });
      
      return result;
    } catch (error) {
      console.error(error);
      lastError.value = error?.message ?? 'Failed to fetch currency rates';
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
    if (!from || !to || from === to) {
      return 1;
    }
    
    const rates = await fetchRates(from, [to]);
    return rates[to];
  }

  // Get all unique currencies needed for accounts
  function getNeededCurrencies() {
    const target = mainCurrency.value;
    const currencies = new Set([target]);
    
    for (const account of accountsStore.accounts) {
      const sourceCurrency = account.currency || target;
      if (sourceCurrency && sourceCurrency !== target) {
        currencies.add(sourceCurrency);
      }
    }
    
    return Array.from(currencies);
  }

  // Request rates for all needed currencies at once
  function requestNeededRates() {
    if (!hasToken.value) return;
    
    const target = mainCurrency.value;
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
    if (!from || !to || from === to) {
      return numericAmount;
    }
    
    // Try direct rate first
    const key = makeRateKey(from, to);
    const record = rates[key];
    
    if (record && Date.now() - record.fetchedAt < RATE_TTL) {
      return numericAmount * record.rate;
    }
    
    // Try inverse rate if direct rate not found
    const inverseKey = makeRateKey(to, from);
    const inverseRecord = rates[inverseKey];
    
    if (inverseRecord && Date.now() - inverseRecord.fetchedAt < RATE_TTL) {
      return numericAmount / inverseRecord.rate;
    }
    
    if (requestIfMissing && hasToken.value) {
      // Use the optimized batch fetch instead of individual requests
      requestNeededRates();
    }
    return null;
  }

  const convertedAccountBalances = computed(() => {
    // Force reactivity by depending on lastUpdate
    lastUpdate.value;
    
    const results = new Map();
    const target = mainCurrency.value;
    for (const account of accountsStore.accounts) {
      const sourceCurrency = account.currency || target;
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
    
    const target = mainCurrency.value;
    const missing = [];
    for (const account of accountsStore.accounts) {
      const sourceCurrency = account.currency || target;
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
    
    const target = mainCurrency.value;
    for (const account of accountsStore.accounts) {
      const sourceCurrency = account.currency || target;
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
    
    const target = mainCurrency.value;
    let total = 0;
    for (const account of accountsStore.accounts) {
      const amount = Number(account.balance) || 0;
      const sourceCurrency = account.currency || target;
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
    [() => mainCurrency.value, () => accountsStore.accounts.map(a => a.currency).join(','), () => hasToken.value],
    () => {
      if (hasToken.value && accountsStore.accounts.length > 0) {
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
    preferencesStore.setMainCurrency(code);
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
    requestNeededRates();
    
    return Promise.resolve();
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
  setInterval(cleanExpiredRates, 5 * 60 * 1000); // Every 5 minutes

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
    requestNeededRates,
    forceRefreshRates,
    cleanExpiredRates,
    setMainCurrency,
    setApiToken
  };
});
