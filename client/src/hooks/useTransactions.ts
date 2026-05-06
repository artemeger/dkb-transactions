import { useState, useEffect } from 'react';
import type { Transaction, CategoryRule, MonthlyDataPoint, CategoryBreakdown, MerchantDataPoint, DateRange } from '../types/transaction';
// Import centralized API config instead of hardcoding
import { API_BASE, buildDateQueryString as buildQueryStr } from '../utils/api';

// Helper for consistent rounding (mirrors server-side roundToTwoDecimals)
function roundToCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/transactions`)
      .then(res => res.json())
      .then(data => {
        setTransactions(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load transactions:', err);
        setLoading(false);
      });
  }, []);

  const refetch = () => {
    fetch(`${API_BASE}/transactions`)
      .then(res => res.json())
      .then(data => setTransactions(Array.isArray(data) ? data : []));
  };

  // Add a new custom/manual transaction
  const addTransaction = async (transaction: Omit<Transaction, 'id' | 'status' | 'valueDate' | 'payer' | 'iban' | 'importedAt'>): Promise<void> => {
    const response = await fetch(`${API_BASE}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingDate: transaction.bookingDate,
        payee: transaction.payee,
        description: transaction.description,
        type: transaction.type,
        amount: transaction.amount.toString(),
        category: transaction.category,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Failed to create transaction');
    }

    // Refetch transactions to include the newly added one
    refetch();
  };

  return { transactions, loading, refetch, addTransaction };
}

export function useFilteredTransactions(dateRange?: DateRange | null, refreshTrigger?: number) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  useEffect(() => {
    // Use centralized query builder instead of duplicating logic
    let url = `${API_BASE}/transactions`;
    
    if (dateRange?.preset && dateRange.preset !== 'allTime' && dateRange.preset !== 'custom') {
      url += `?preset=${encodeURIComponent(dateRange.preset)}`;
    } else if (dateRange?.startDate && dateRange.endDate) {
      // Fallback: send explicit dates for custom ranges or backwards compatibility
      url += `?startDate=${encodeURIComponent(dateRange.startDate)}&endDate=${encodeURIComponent(dateRange.endDate)}`;
    }
    
    fetch(url)
      .then(res => res.json())
      .then(data => setTransactions(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [dateRange?.preset, dateRange?.startDate, dateRange?.endDate, refreshTrigger]);

  return transactions;
}

export function useCategories() {
  const [categories, setCategories] = useState<CategoryRule[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Track recategorized count for UI feedback after category changes
  const [lastRecategorizedCount, setLastRecategorizedCount] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/categories`)
      .then(res => res.json())
      .then(data => {
        setCategories(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load categories:', err);
        setLoading(false);
      });
  }, []);

  const addCategory = (category: Omit<CategoryRule, 'id'>) => {
    return fetch(`${API_BASE}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(category),
    }).then(res => res.json()).then((data: any) => {
      setLastRecategorizedCount(data.recategorizedCount || 0);
      refetch();
    });
  };

  const updateCategory = (id: string, updates: Partial<CategoryRule>) => {
    return fetch(`${API_BASE}/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).then(res => res.json()).then((data: any) => {
      setLastRecategorizedCount(data.recategorizedCount || 0);
      refetch();
    });
  };

  const deleteCategory = (id: string) => {
    return fetch(`${API_BASE}/categories/${id}`, { method: 'DELETE' })
      .then(() => refetch());
  };

  const updateTransactionCategory = (transactionId: string, category: string) => {
    return fetch(`${API_BASE}/transactions/${transactionId}/category`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    });
  };

  // Delete a transaction by ID (both imported and custom)
  const deleteTransaction = async (transactionId: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/transactions/${transactionId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Failed to delete transaction');
    }

    // Refetch transactions after deletion
    refetch();
  };

  const refetch = () => {
    fetch(`${API_BASE}/categories`)
      .then(res => res.json())
      .then(data => setCategories(Array.isArray(data) ? data : []));
  };

  // Manually re-categorize all transactions using current rules
  const recategorizeAll = async (): Promise<{ recategorizedCount: number }> => {
    const response = await fetch(`${API_BASE}/recategorize-all`, { method: 'POST' });
    if (!response.ok) throw new Error('Re-categorization failed');
    const data = await response.json();
    setLastRecategorizedCount(data.recategorizedCount || 0);
    refetch();
    return data;
  };

  // Reset all data (transactions and categories)
  const resetAllData = async (): Promise<void> => {
    const response = await fetch(`${API_BASE}/reset`, { method: 'POST' });
    if (!response.ok) throw new Error('Reset failed');
    setCategories([]);
    setLastRecategorizedCount(null);
  };

  return { 
    categories, 
    loading, 
    addCategory, 
    updateCategory, 
    deleteCategory, 
    updateTransactionCategory, 
    deleteTransaction,
    refetch,
    lastRecategorizedCount,
    clearLastRecategorizedCount: () => setLastRecategorizedCount(null),
    recategorizeAll,
    resetAllData,
  };
}

export function useImport() {
  const importFile = async (file: File): Promise<{ importedCount: number; totalTransactions: number }> => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE}/import`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        // Try to get error details from server response
        let errorMsg = 'Import failed';
        try {
          const errorBody = await response.json();
          errorMsg = errorBody.error || `Import failed: ${response.statusText}`;
        } catch {
          errorMsg = `Import failed (${response.status}): ${response.statusText}`;
        }
        throw new Error(errorMsg);
      }
      
      return response.json() as Promise<{ importedCount: number; totalTransactions: number }>;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        throw new Error('Cannot connect to server. Make sure the app is running.');
      }
      throw error;
    }
  };

  return { importFile };
}

export function useDashboardData(dateRange?: DateRange | null, excludedTransactionIds?: Set<string>, refreshTrigger?: number) {
  const [monthlyOverview, setMonthlyOverview] = useState<MonthlyDataPoint[]>([]);
  const [granularity, setGranularity] = useState<'day' | 'month'>('month');
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [topMerchants, setTopMerchants] = useState<MerchantDataPoint[]>([]);
  const [stats, setStats] = useState({
    totalIncome: 0, totalExpenses: 0, netBalance: 0, transactionCount: 0, averageExpense: 0,
  });

  useEffect(() => {
    // Use centralized query builder instead of duplicating logic
    let qs = '';
    if (dateRange?.preset && dateRange.preset !== 'allTime' && dateRange.preset !== 'custom') {
      qs = `?preset=${encodeURIComponent(dateRange.preset)}`;
    } else if (dateRange?.startDate && dateRange.endDate) {
      // Fallback for custom ranges or backwards compatibility
      qs = `?startDate=${encodeURIComponent(dateRange.startDate)}&endDate=${encodeURIComponent(dateRange.endDate)}`;
    }

    const hasSelections = excludedTransactionIds && excludedTransactionIds.size > 0;

    if (hasSelections) {
      // When transactions are selected:
      // - Stats and category breakdown use client-side aggregation (selection-aware)
      // - Charts that show account-level metrics always use server data for accuracy
      Promise.all([
        // Fetch all filtered transactions for chart aggregation
        fetch(`${API_BASE}/transactions${qs}`).then(res => res.json()).then((d: any) => 
          Array.isArray(d) ? d : []
        ),
        // Fetch stats - will be recalculated from selected transactions
        fetch(`${API_BASE}/stats${qs}`).then(res => res.json()),
      ]).then(([rawTransactions, currentStats]) => {
        const filtered = Array.isArray(rawTransactions) 
          ? rawTransactions.filter(t => !excludedTransactionIds!.has(t.id))  // EXCLUDE items in the exclusion set
          : [];

        // Recalculate stats from selected transactions only
        let totalIncome = 0;
        let totalExpenses = 0;
        
        for (const t of filtered) {
          if (t.amount >= 0) {
            totalIncome += t.amount;
          } else {
            totalExpenses += Math.abs(t.amount);
          }
        }

        const expensesOnly = filtered.filter(t => t.type === 'Ausgang');
        const averageExpense = expensesOnly.length > 0 
          ? roundToCurrency(totalExpenses / expensesOnly.length)
          : 0;

        setStats({
          totalIncome: roundToCurrency(totalIncome),
          totalExpenses: roundToCurrency(totalExpenses),
          netBalance: roundToCurrency(totalIncome - totalExpenses),
          transactionCount: filtered.length,
          averageExpense,
        });
        setGranularity('day'); // Always 'day' - we aggregate daily data regardless of date range

        // All charts use client-side aggregation - selection aware
        // Calculate daily overview including running balance for BalanceTrend and CashFlowTimeline
        const monthlyMap = new Map<string, { income: number; expenses: number }>();
        let balanceCounter = 0;
        
        for (const t of filtered) {
          const dayKey = t.bookingDate.substring(0, 10);
          if (!dayKey) continue;

          const existing = monthlyMap.get(dayKey) || { income: 0, expenses: 0 };
          
          if (t.amount >= 0) {
            existing.income += t.amount;
          } else {
            existing.expenses += Math.abs(t.amount);
          }
          
          balanceCounter += t.amount;
          monthlyMap.set(dayKey, existing);
        }

        const days = Array.from(monthlyMap.keys()).sort();
        let runningBalanceIdx = 0;
        
        const overviewData: MonthlyDataPoint[] = days.map((day) => {
          const data = monthlyMap.get(day)!;
          if (runningBalanceIdx === 0) {
            balanceCounter = data.income - data.expenses;
          } else {
            balanceCounter += data.income - data.expenses;
          }
          runningBalanceIdx++;

          return {
            month: day,
            income: roundToCurrency(data.income),
            expenses: roundToCurrency(data.expenses),
            balance: roundToCurrency(data.income - data.expenses),
            runningBalance: roundToCurrency(balanceCounter),
          };
        });

        setMonthlyOverview(overviewData);

        // Build category breakdown from filtered transactions (selection-aware)
        const categoryMap = new Map<string, number>();
        for (const t of filtered) {
          if (t.type === 'Ausgang' && t.category) {
            const current = categoryMap.get(t.category) || 0;
            categoryMap.set(t.category, current + Math.abs(t.amount));
          }
        }

        setCategoryBreakdown(Array.from(categoryMap.entries())
          .map(([category, total]) => ({ category, total: roundToCurrency(total) }))
          .sort((a, b) => b.total - a.total));

        // Build merchant data from filtered transactions
        const merchantMap = new Map<string, { totalSpent: number; count: number }>();
        for (const t of filtered) {
          if (t.type === 'Ausgang' && t.payee.trim()) {
            const merchant = t.payee.trim();
            const existing = merchantMap.get(merchant) || { totalSpent: 0, count: 0 };
            existing.totalSpent += Math.abs(t.amount);
            existing.count++;
            merchantMap.set(merchant, existing);
          }
        }

        setTopMerchants(Array.from(merchantMap.entries())
          .map(([merchant, data]) => ({
            merchant,
            totalSpent: !isNaN(data.totalSpent) ? roundToCurrency(data.totalSpent) : 0,
            transactionCount: data.count,
          }))
          .sort((a, b) => b.totalSpent - a.totalSpent)
          .slice(0, 15));

      }).catch(() => {
        // Keep existing values on error
      });
    } else {
      // No selections - use backend aggregated data as before
      Promise.all([
        fetch(`${API_BASE}/charts/monthly${qs}`).then(res => res.json()).then((d: any) => {
          if (Array.isArray(d)) {
            setMonthlyOverview(d);
            setGranularity('month');
          } else if (d && Array.isArray(d.data)) {
            setMonthlyOverview(d.data);
            setGranularity(d.granularity || 'month');
          } else {
            setMonthlyOverview([]);
            setGranularity('month');
          }
        }),
        fetch(`${API_BASE}/charts/breakdown${qs}`).then(res => res.json()).then(d => setCategoryBreakdown(Array.isArray(d) ? d : [])),
        fetch(`${API_BASE}/charts/merchants${qs}`).then(res => res.json()).then(d => {
          // Ensure totalSpent is a number (API may return strings or NaN)
          const merchants = Array.isArray(d) ? d.map((m: any) => {
            const rawValue = Number(m.totalSpent);
            return { ...m, totalSpent: !isNaN(rawValue) ? roundToCurrency(rawValue) : 0 };
          }) : [];
          setTopMerchants(merchants);
        }),
        fetch(`${API_BASE}/stats${qs}`).then(res => res.json()).then(d => setStats(d)).catch(() => {}),
      ]);
    }
  }, [dateRange?.preset, dateRange?.startDate, dateRange?.endDate, excludedTransactionIds, refreshTrigger]);

  return { monthlyOverview, categoryBreakdown, topMerchants, stats, granularity };
}
