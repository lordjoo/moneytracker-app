import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { writeJson } from '@/utils/storage';
import { usePreferencesStore } from './preferences';
import { useCurrencyStore } from './currency';

function resetStorage() {
  writeJson('preferences', undefined);
  writeJson('accounts', undefined);
}

describe('currency store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetStorage();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          result: 'success',
          base_code: 'USD',
          conversion_rates: {
            USD: 1,
            EGP: 52.9496,
            EUR: 0.8599
          }
        })
      }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches EGP from ExchangeRate-API v6 keyed latest endpoint', async () => {
    const preferencesStore = usePreferencesStore();
    preferencesStore.init();
    preferencesStore.setCurrencyApiToken('test-api-key');

    const currencyStore = useCurrencyStore();
    const rate = await currencyStore.fetchRate('usd', 'egp');

    expect(rate).toBe(52.9496);
    expect(fetch).toHaveBeenCalledWith('https://v6.exchangerate-api.com/v6/test-api-key/latest/USD', {
      cache: 'no-store',
      mode: 'cors'
    });
    expect(currencyStore.convertAmount(10, 'USD', 'EGP', { requestIfMissing: false })).toBeCloseTo(529.496);
  });
});
