/**
 * Client-side API configuration utilities.
 * Centralizes API base URL and provides helper functions for building queries.
 */

export const API_BASE = '/api';

export interface DateRange {
  preset?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Build query string for date range filtering.
 * Prefers sending preset to server (server resolves it).
 * Falls back to explicit dates only when necessary.
 */
export function buildDateQueryString(dateRange: DateRange | null): string {
  if (!dateRange) return '';
  
  // Always send preset to server - it handles resolution server-side
  if (dateRange.preset && dateRange.preset !== 'allTime' && dateRange.preset !== 'custom') {
    return `?preset=${encodeURIComponent(dateRange.preset)}`;
  }
  
  // Fallback: use explicit dates for custom ranges or when no preset available
  if (dateRange.startDate && dateRange.endDate) {
    return `?startDate=${encodeURIComponent(dateRange.startDate)}&endDate=${encodeURIComponent(dateRange.endDate)}`;
  }
  
  return '';
}
