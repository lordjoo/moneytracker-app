/**
 * Presentation helpers for accounts. Keeping the magic numbers and label
 * strings here (rather than inline across views) makes the credit-card UI
 * easy to re-tune in one place.
 */

// Utilization at/above these fractions flips the meter colour.
export const CREDIT_UTILIZATION_THRESHOLDS = Object.freeze({
  warning: 0.5,
  danger: 0.9
});

/**
 * DaisyUI background class for a credit utilization meter.
 * @param {number} utilization 0–1
 */
export function creditUtilizationClass(utilization) {
  const value = Number(utilization) || 0;
  if (value >= CREDIT_UTILIZATION_THRESHOLDS.danger) return 'bg-error';
  if (value >= CREDIT_UTILIZATION_THRESHOLDS.warning) return 'bg-warning';
  return 'bg-success';
}

/** Minimum rendered width (%) so a tiny balance is still visible on the meter. */
export const MIN_METER_WIDTH = 2;

export function meterWidth(utilization) {
  return `${Math.max(MIN_METER_WIDTH, (Number(utilization) || 0) * 100)}%`;
}

export function isCreditAccount(account) {
  return account?.type === 'credit';
}

export function accountTypeLabel(account) {
  return isCreditAccount(account) ? 'Credit card' : 'Cash account';
}
