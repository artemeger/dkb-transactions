import { Router } from 'express';
// Consolidated imports: use centralized utilities instead of duplicating logic
import { getCategoryBreakdown, getMonthlyOverview, getTopMerchants } from '../services/dataAnalysis.js';
import { readTransactions } from '../services/storage.js';
import { detectGranularity as detectGranularityOriginal } from '../services/dataAnalysis.js';
import { roundToTwoDecimals } from '../utils/money.js';

// Import centralized date range utilities - single source of truth
import { getPresetDateRange, isInDateRange as isInRange } from '../utils/dateRange.js';

const router = Router();

/**
 * Helper to resolve date range for chart endpoints.
 * Consolidates duplicated preset → dates resolution logic.
 */
function resolveChartDates(preset?: string, startDateQuery?: string, endDateQuery?: string) {
  const resolved = getPresetDateRange(preset);
  return {
    startDate: resolved?.startDate || startDateQuery,
    endDate: resolved?.endDate || endDateQuery,
  };
}

// GET /api/charts/monthly - Get monthly income/expense overview
router.get('/charts/monthly', (req, res) => {
  const { startDate, endDate } = resolveChartDates(
    req.query.preset as string | undefined,
    req.query.startDate as string | undefined,
    req.query.endDate as string | undefined
  );
  
  const transactions = readTransactions();
  const data = getMonthlyOverview(transactions, { startDate, endDate });
  
  // Include granularity info for frontend formatting
  const granularity = detectGranularityOriginal(startDate, endDate);
  res.json({ data, granularity });
});

// GET /api/charts/breakdown - Get spending breakdown by category
router.get('/charts/breakdown', (req, res) => {
  const { startDate, endDate } = resolveChartDates(
    req.query.preset as string | undefined,
    req.query.startDate as string | undefined,
    req.query.endDate as string | undefined
  );
  
  const transactions = readTransactions();
  const data = getCategoryBreakdown(transactions, { month: req.query.month as string, startDate, endDate });
  res.json(data);
});

// GET /api/charts/merchants - Get top merchants by spending
router.get('/charts/merchants', (req, res) => {
  const { startDate, endDate } = resolveChartDates(
    req.query.preset as string | undefined,
    req.query.startDate as string | undefined,
    req.query.endDate as string | undefined
  );
  
  const limit = parseInt(req.query.limit as string) || 15;
  const transactions = readTransactions();
  const data = getTopMerchants(transactions, limit, { startDate, endDate });
  res.json(data);
});

// GET /api/stats - Get summary statistics with optional date filter
router.get('/stats', (req, res) => {
  const { startDate, endDate } = resolveChartDates(
    req.query.preset as string | undefined,
    req.query.startDate as string | undefined,
    req.query.endDate as string | undefined
  );
  
  let transactions = readTransactions();
  
  // Apply date filtering if provided
  if (startDate && endDate) {
    transactions = transactions.filter(t => isInRange(t.bookingDate, startDate, endDate));
  }

  let totalIncome = 0;
  let totalExpenses = 0;
  let transactionCount = transactions.length;
  let averageExpense = 0;

  for (const t of transactions) {
    if (t.amount >= 0) {
      totalIncome += t.amount;
    } else {
      totalExpenses += Math.abs(t.amount);
    }
  }

  const expensesOnly = transactions.filter(t => t.type === 'Ausgang');
  averageExpense = expensesOnly.length > 0 
    ? roundToTwoDecimals(totalExpenses / expensesOnly.length)
    : 0;

  res.json({
    totalIncome: roundToTwoDecimals(totalIncome),
    totalExpenses: roundToTwoDecimals(totalExpenses),
    netBalance: roundToTwoDecimals(totalIncome - totalExpenses),
    transactionCount,
    averageExpense,
  });
});

export default router;
