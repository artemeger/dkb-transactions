/**
 * Server-side date range utilities for building API queries.
 * Consolidates duplicated date handling logic from routes and hooks.
 */

export type DatePreset = 'allTime' | 'ytd' | 'threeMonths' | 'thisMonth' | 'last7Days' | 'custom';

export interface ResolvedDateRange {
  startDate?: string;
  endDate?: string;
}

/**
 * Convert a date preset to actual start/end dates.
 * This is the single source of truth for server-side date resolution.
 */
export function getPresetDateRange(preset?: string): ResolvedDateRange | undefined {
  if (!preset || preset === 'allTime') return undefined;

  const now = new Date();

  switch (preset) {
    case 'last7Days': {
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      return { 
        startDate: formatDate(sevenDaysAgo), 
        endDate: formatDate(now) 
      };
    }

    case 'thisMonth':
      return { 
        startDate: getFirstDayOfMonth(now), 
        endDate: getLastDayOfMonth(now) 
      };

    case 'threeMonths': {
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 2);
      return { 
        startDate: getFirstDayOfMonth(threeMonthsAgo), 
        endDate: getLastDayOfMonth(now) 
      };
    }

    case 'ytd':
      return { startDate: `${now.getFullYear()}-01-01` };

    default:
      return undefined;
  }
}

/**
 * Build the query string for API requests based on date range.
 * Prefers preset over explicit dates when available (server resolves it).
 */
export function buildDateQueryString(
  preset?: string,
  startDate?: string,
  endDate?: string
): string {
  // Always send preset to server - it handles resolution server-side
  if (preset && preset !== 'allTime' && preset !== 'custom') {
    return `?preset=${encodeURIComponent(preset)}`;
  }
  
  // Fallback: use explicit dates for custom ranges or when no preset available
  if (startDate && endDate) {
    return `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
  }
  
  return '';
}

/**
 * Check if a date is within the given range.
 */
export function isInDateRange(bookingDate: string, startDate?: string, endDate?: string): boolean {
  if (!startDate && !endDate) return true;
  
  const date = new Date(bookingDate);
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  
  // If booking date is after start and before end, it's in range
  if (start && date < start) return false;
  if (end && date > end) return false;
  
  return true;
}

/**
 * Detect whether to use daily or monthly granularity based on date span.
 */
export function detectGranularity(startDate?: string, endDate?: string): 'day' | 'month' {
  if (!startDate || !endDate) return 'month';
  
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  const days = Math.round(Math.abs((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
  
  return days <= 60 ? 'day' : 'month';
}

// Helper functions
function pad(num: number, size = 2): string {
  return String(num).padStart(size, '0');
}

export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getFirstDayOfMonth(date: Date): string {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  return formatDate(firstDay);
}

function getLastDayOfMonth(date: Date): string {
  // JavaScript Date automatically handles month overflow
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return formatDate(lastDay);
}
