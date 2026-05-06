/**
 * Client-side money formatting utilities.
 * Uses German locale for consistent currency display: 1.234,56 €
 */

const GERMAN_LOCALE = 'de-DE';

/**
 * Format a number as EUR currency with German locale formatting.
 * Example: 1234.56 → "1.234,56 €"
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat(GERMAN_LOCALE, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a plain number with German locale (period as thousands separator).
 * Example: 1234.56 → "1.234,56"
 */
export function formatNumberGerman(value: number): string {
  return new Intl.NumberFormat(GERMAN_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format an amount without currency symbol for inline display.
 * Example: 100 → "100,00"
 */
export function formatAmountInline(value: number): string {
  return new Intl.NumberFormat(GERMAN_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a percentage with German locale.
 */
export function formatPercent(percent: number): string {
  return `${new Intl.NumberFormat(GERMAN_LOCALE, {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(percent / 100)}`;
}
