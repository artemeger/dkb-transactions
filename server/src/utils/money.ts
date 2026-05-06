/**
 * Math and currency formatting utilities.
 * Centralizes common patterns used across server and client code.
 */

/**
 * Round a number to two decimal places for consistent currency handling.
 * Replaces the repeated pattern: Math.round(value * 100) / 100
 */
export function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Format a currency amount for display.
 * Uses Intl.NumberFormat for locale-aware formatting.
 */
export function formatCurrency(amount: number, locale = 'de-DE'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(roundToTwoDecimals(amount));
}

/**
 * Format a number with thousand separators for display.
 */
export function formatNumber(value: number, locale = 'de-DE'): string {
  return new Intl.NumberFormat(locale).format(roundToTwoDecimals(value));
}
