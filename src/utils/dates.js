const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_KEY_PATTERN = /^(\d{4})-(\d{2})$/;

function pad(value) {
  return String(value).padStart(2, '0');
}

export function toDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
}

export function toMonthKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  return `${year}-${month}`;
}

export function isMonthKey(value) {
  return typeof value === 'string' && MONTH_KEY_PATTERN.test(value);
}

export function shiftMonthKey(monthKey, delta = 0) {
  if (!isMonthKey(monthKey)) {
    return null;
  }
  const [, yearText, monthText] = monthKey.match(MONTH_KEY_PATTERN);
  const year = Number(yearText);
  const month = Number(monthText);
  const shifted = new Date(year, month - 1 + Number(delta || 0), 1, 12, 0, 0, 0);
  if (Number.isNaN(shifted.getTime())) {
    return null;
  }
  return toMonthKey(shifted);
}

export function isDateKey(value) {
  return typeof value === 'string' && DATE_KEY_PATTERN.test(value);
}

export function parseDateKey(dateKey) {
  if (!isDateKey(dateKey)) {
    return null;
  }
  const [, yearText, monthText, dayText] = dateKey.match(DATE_KEY_PATTERN);
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

export function coerceDateKey(value, fallback = null) {
  if (isDateKey(value)) {
    return value;
  }
  const derived = toDateKey(value);
  if (derived) {
    return derived;
  }
  if (fallback == null) {
    return null;
  }
  return isDateKey(fallback) ? fallback : toDateKey(fallback);
}

export function getDateOrFallback(dateKey, fallback = new Date()) {
  return parseDateKey(dateKey) ?? (fallback instanceof Date ? fallback : new Date(fallback));
}
