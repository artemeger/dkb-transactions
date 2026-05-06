export interface Transaction {
  id: string;
  bookingDate: string;
  valueDate: string;
  status: string;
  payer: string;
  payee: string;
  description: string;
  type: 'Eingang' | 'Ausgang';
  iban: string;
  amount: number;
  category?: string;
  importedAt: string;
  source?: 'imported' | 'custom'; // Distinguish bank-imported vs manually added transactions
}

export interface CategoryRule {
  id: string;
  name: string;
  keywords: string[];
  color: string;
}

export interface MonthlyDataPoint {
  month: string;
  income: number;
  expenses: number;
  balance: number;
  runningBalance: number;
}

// Response wrapper for monthly overview API endpoint
export interface MonthlyOverviewResponse {
  data: MonthlyDataPoint[];
  granularity: 'day' | 'month';
}

export interface CategoryBreakdown {
  category: string;
  total: number;
  color?: string;
}

export interface MerchantDataPoint {
  merchant: string;
  totalSpent: number;
  transactionCount: number;
}

// Date range selection types
export type DatePreset = 'allTime' | 'ytd' | 'threeMonths' | 'thisMonth' | 'last7Days' | 'custom';

export interface DateRange {
  preset: DatePreset;
  startDate?: string; // YYYY-MM format
  endDate?: string;   // YYYY-MM format
}
