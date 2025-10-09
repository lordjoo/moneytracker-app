import { computed, reactive, ref, watch, watchEffect } from 'vue';
import { defineStore } from 'pinia';
import { usePreferencesStore } from '@/stores/preferences';
import { useAccountsStore } from '@/stores/accounts';
import currencyList, { currencyNames } from '@/utils/currencies';

const RATE_TTL = 60 * 60 * 1000; // 1 hour

function makeRateKey(from, to) {
  return `${from}_${to}`;
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

  const rates = reactive({});
  const pendingKeys = reactive(new Set());
  const lastError = ref('');
  const status = ref('idle');

  const mainCurrency = computed(() => preferencesStore.baseCurrency || 'USD');
  const apiToken = computed(() => preferencesStore.currencyToken || '');
  const hasToken = computed(() => Boolean(apiToken.value));

  function clearRates() {
    for (const key of Object.keys(rates)) {
      delete rates[key];
    }
  }

  watch(
    () => apiToken.value,
    () => {
      clearRates();
      lastError.value = '';
    }
  );

  async function fetchRate(from, to) {
    if (!from || !to || from === to) {
      return 1;
    }
    const key = makeRateKey(from, to);
    if (pendingKeys.has(key)) {
      return rates[key]?.rate ?? null;
    }
    if (!apiToken.value) {
      throw new Error('Currency conversion requires an API token');
    }
    pendingKeys.add(key);
    status.value = 'loading';
    try {
      const url = new URL('https://api.freecurrencyapi.com/v1/latest');
      url.searchParams.set('apikey', apiToken.value);
      url.searchParams.set('base_currency', from);
      url.searchParams.set('currencies', to);
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Currency API responded with status ${response.status}`);
      }
      const payload = await response.json();
      const rate = Number(payload?.data?.[to]);
      if (!Number.isFinite(rate)) {
        throw new Error('Currency API returned invalid rate data');
      }
      rates[key] = { rate, fetchedAt: Date.now() };
      lastError.value = '';
      return rate;
    } catch (error) {
      console.error(error);
      lastError.value = error?.message ?? 'Failed to fetch currency rates';
      throw error;
    } finally {
      pendingKeys.delete(key);
      if (pendingKeys.size === 0) {
        status.value = 'idle';
      }
    }
  }

  function requestRate(from, to) {
    if (!from || !to || from === to || !hasToken.value) {
      return;
    }
    const key = makeRateKey(from, to);
    const record = rates[key];
    if (record && Date.now() - record.fetchedAt < RATE_TTL) {
      return;
    }
    if (pendingKeys.has(key)) {
      return;
    }
    fetchRate(from, to).catch(() => {
      /* handled via lastError */
    });
  }

  function convertAmount(amount, from, to = mainCurrency.value, { requestIfMissing = true } = {}) {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount)) {
      return null;
    }
    if (!from || !to || from === to) {
      return numericAmount;
    }
    const key = makeRateKey(from, to);
    const record = rates[key];
    if (record && Date.now() - record.fetchedAt < RATE_TTL) {
      return numericAmount * record.rate;
    }
    if (requestIfMissing && hasToken.value) {
      requestRate(from, to);
    }
    return null;
  }

  const convertedAccountBalances = computed(() => {
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
    const target = mainCurrency.value;
    for (const account of accountsStore.accounts) {
      const sourceCurrency = account.currency || target;
      if (sourceCurrency === target) continue;
      const key = makeRateKey(sourceCurrency, target);
      if (!rates[key]) {
        return hasToken.value;
      }
    }
    return false;
  });

  const totalWorthInMain = computed(() => {
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

  watchEffect(() => {
    if (!hasToken.value) return;
    const target = mainCurrency.value;
    for (const account of accountsStore.accounts) {
      const sourceCurrency = account.currency || target;
      if (!sourceCurrency || sourceCurrency === target) continue;
      requestRate(sourceCurrency, target);
    }
  });

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

  return {
    status,
    lastError,
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
    requestRate,
    setMainCurrency,
    setApiToken
  };
});
