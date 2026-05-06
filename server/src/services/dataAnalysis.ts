import type { Transaction, MonthlyDataPoint, CategoryBreakdown, MerchantDataPoint } from '../types/transaction.js';
// Import centralized utilities instead of duplicating implementations
import { roundToTwoDecimals } from '../utils/money.js';
import { isInDateRange as isInRange, detectGranularity as detectGranularityOrig } from '../utils/dateRange.js';

// Re-export centralized date range functions for backward compatibility
export { isInRange as isInDateRange, detectGranularityOrig as detectGranularity };

// Helper: Filter transactions by date range (uses centralized utility)
export function filterByDateRange(transactions: Transaction[], startDate: string, endDate: string): Transaction[] {
  return transactions.filter(t => isInRange(t.bookingDate, startDate, endDate));
}

// Extract YYYY-MM from a YYYY-MM-DD date for monthly grouping
function extractMonth(dateStr: string): string {
  return dateStr.substring(0, 7); // "2026-04"
}

// Extract YYYY-MM-DD from a YYYY-MM-DD date for daily grouping  
function extractDay(dateStr: string): string {
  return dateStr.substring(0, 10); // "2026-04-15"
}

export function getMonthlyOverview(transactions: Transaction[], options?: { startDate?: string; endDate?: string; preset?: string }): MonthlyDataPoint[] {
  const granularity = detectGranularityOrig(options?.startDate, options?.endDate);
  
  const monthlyMap = new Map<string, { income: number; expenses: number }>();

  // Filter by date range if provided
  let filteredTransactions = transactions;
  if (options?.startDate && options?.endDate) {
    filteredTransactions = filterByDateRange(transactions, options.startDate, options.endDate);
  }

  const sorted = [...filteredTransactions].sort((a, b) => 
    a.valueDate.localeCompare(b.valueDate)
  );

  let runningBalance = 0;
  
  // Choose key extraction function based on granularity
  const extractKey = granularity === 'day' ? extractDay : extractMonth;

  for (const t of sorted) {
    const monthKey = extractKey(t.bookingDate);
    if (!monthKey) continue;

    const existing = monthlyMap.get(monthKey) || { income: 0, expenses: 0 };
    
    if (t.amount >= 0) {
      existing.income += t.amount;
    } else {
      existing.expenses += Math.abs(t.amount);
    }
    
    runningBalance += t.amount;
    monthlyMap.set(monthKey, existing);
  }

  // Build result array in chronological order
  const months = Array.from(monthlyMap.keys()).sort();
  
  let balanceCounter = 0;
  return months.map((month, index) => {
    const data = monthlyMap.get(month)!;
    if (index === 0) {
      // Estimate initial balance from first month + running total
      balanceCounter = data.income - data.expenses;
    } else {
      balanceCounter += data.income - data.expenses;
    }

    return {
      month,
      income: roundToTwoDecimals(data.income),
      expenses: roundToTwoDecimals(data.expenses),
      balance: roundToTwoDecimals(data.income - data.expenses),
      runningBalance: roundToTwoDecimals(balanceCounter),
    };
  });
}

export function getCategoryBreakdown(transactions: Transaction[], options?: { month?: string; startDate?: string; endDate?: string }): CategoryBreakdown[] {
  let filtered = transactions;

  // Filter by single month if provided
  if (options?.month) {
    const targetMonth = options.month.substring(0, 7);
    filtered = transactions.filter(t => extractMonth(t.bookingDate) === targetMonth);
  } 
  // Filter by date range if provided (overrides month)
  else if (options?.startDate && options?.endDate) {
    filtered = filterByDateRange(transactions, options.startDate!, options.endDate!);
  }

  const categoryMap = new Map<string, number>();
  
  for (const t of filtered) {
    if (t.type === 'Ausgang' && t.category) {
      const current = categoryMap.get(t.category) || 0;
      categoryMap.set(t.category, current + Math.abs(t.amount));
    }
  }

  return Array.from(categoryMap.entries())
    .map(([category, total]) => ({ category, total: roundToTwoDecimals(total) }))
    .sort((a, b) => b.total - a.total);
}

export function getTopMerchants(transactions: Transaction[], limit = 15, options?: { startDate?: string; endDate?: string }): MerchantDataPoint[] {
  const merchantMap = new Map<string, { totalSpent: number; count: number }>();

  let filtered = transactions;
  if (options?.startDate && options?.endDate) {
    filtered = filterByDateRange(transactions, options.startDate!, options.endDate!);
  }

  for (const t of filtered) {
    if (t.type === 'Ausgang' && t.payee.trim()) {
      const merchant = t.payee.trim();
      const existing = merchantMap.get(merchant) || { totalSpent: 0, count: 0 };
      existing.totalSpent += Math.abs(t.amount);
      existing.count++;
      merchantMap.set(merchant, existing);
    }
  }

  return Array.from(merchantMap.entries())
    .map(([merchant, data]) => ({
      merchant,
      totalSpent: roundToTwoDecimals(data.totalSpent),
      transactionCount: data.count,
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, limit);
}

// Helper to format YYYY-MM as readable string (e.g., "Apr 2026")
export function formatMonth(month: string): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const parts = month.split('-');
  if (parts.length === 2) {
    return `${months[parseInt(parts[1]) - 1]} ${parts[0]}`;
  }
  return month;
}
