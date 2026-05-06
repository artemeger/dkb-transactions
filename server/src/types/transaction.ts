// Local type declarations referencing client types
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
