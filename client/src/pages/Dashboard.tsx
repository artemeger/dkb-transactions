import { useState, useMemo } from 'react';
import DateRangePicker from '../components/DateRangePicker';
import MonthlyBreakdown from '../components/Charts/MonthlyBreakdown';
import CashFlowTimeline from '../components/Charts/CashFlowTimeline';
import BalanceTrend from '../components/Charts/BalanceTrend';
import TopMerchants from '../components/Charts/TopMerchants';
import ImportPanel from '../components/ImportPanel';
import AddTransactionModal from '../components/AddTransactionModal';
import ConfirmDialog from '../components/ConfirmDialog';
import Icon from '../components/Icon';
import type { DateRange } from '../types/transaction';
import { useDashboardData, useCategories, useFilteredTransactions } from '../hooks/useTransactions';
// Import centralized money formatting with German locale
import { formatCurrency, formatAmountInline } from '../utils/money';

// German preset labels (hardcoded)
const PRESET_LABELS: Record<string, string> = {
  allTime: 'Gesamt',
  ytd: 'Laufendes Jahr',
  threeMonths: 'Letzten 3 Monate',
  thisMonth: 'Dieser Monat',
  last7Days: 'Letzte 7 Tage',
};

// Helper to get human-readable label for date presets (hardcoded German)
function getPresetLabel(preset: string): string {
  return PRESET_LABELS[preset] ?? preset;
}

export default function Dashboard() {
  const [dateRange, setDateRange] = useState<DateRange>({ preset: 'allTime' });
  
  // Shared state for table filters (independent from date filter)
  const [sortField, setSortField] = useState<'bookingDate' | 'amount'>('bookingDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Transaction selection state - tracks which transactions should be EXCLUDED from chart calculations
  // Default: empty set (nothing excluded, all items included in charts)
  // When user unchecks a box: that ID is added to exclusion list
  const [excludedTransactionIds, setExcludedTransactionIds] = useState<Set<string>>(new Set());

  // Modal state for adding custom transactions
  const [showAddTransaction, setShowAddTransaction] = useState(false);

  // Confirm dialog state for deletion
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeletePayee, setConfirmDeletePayee] = useState<string>('');

  // Counter to force table and chart refresh after add/delete/import operations
  const [chartRefreshTrigger, setChartRefreshTrigger] = useState(0);

  // Dashboard chart data with date filtering AND selection filter
  const { monthlyOverview, categoryBreakdown, topMerchants, stats, granularity } = useDashboardData(dateRange, excludedTransactionIds, chartRefreshTrigger);
  
  // Get categories for color map and delete function
  const { categories, deleteTransaction } = useCategories();
  
  // Get transactions filtered by date range (shared with dashboard) - always show all in table
  const allTransactions = useFilteredTransactions(dateRange, chartRefreshTrigger);

  // Client-side filter and sort for the table - ALWAYS show all rows regardless of selection
  const categoryColors: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    if (categories) {
      categories.forEach(c => { map[c.name] = c.color; });
    }
    return map;
  }, [categories]);

  // Client-side filter and sort for the table
  const filteredTransactionsMemo = useMemo(() => {
    let result = [...allTransactions];

    if (filterCategory !== 'all') {
      result = result.filter(t => t.category === filterCategory);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(t => 
        t.payee.toLowerCase().includes(term) ||
        t.description.toLowerCase().includes(term) ||
        t.bookingDate.includes(term)
      );
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'bookingDate') {
        cmp = a.bookingDate.localeCompare(b.bookingDate);
      } else {
        cmp = a.amount - b.amount;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [allTransactions, filterCategory, searchTerm, sortField, sortDir]);

  const handleSort = (field: 'bookingDate' | 'amount') => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const handleDeleteTransaction = async (id: string, payee: string) => {
    setConfirmDeleteId(id);
    setConfirmDeletePayee(payee);
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    
    try {
      await deleteTransaction(confirmDeleteId);
      // Force table and chart refresh after deletion
      setChartRefreshTrigger(k => k + 1);
    } catch (err) {
      console.error('Fehler beim Löschen:', err);
      alert(err instanceof Error ? err.message : 'Löschen fehlgeschlagen');
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const cancelDelete = () => {
    setConfirmDeleteId(null);
  };

  const handleAddTransactionSuccess = () => {
    setShowAddTransaction(false);
    // Force table and chart refresh after adding a transaction
    setChartRefreshTrigger(k => k + 1);
  };

  const handleImportSuccess = (importedCount: number) => {
    // Force table and chart refresh after importing new transactions
    setChartRefreshTrigger(k => k + 1);
  };

  // Selection management helpers - checkboxes checked by default (included in charts)
  // Unchecking a checkbox adds that ID to exclusion list (excluded from chart calculations)
  const toggleTransaction = (id: string) => {
    setExcludedTransactionIds(prev => {
      if (prev.has(id)) {
        // Checkbox re-checked → remove from exclusion → charts will include this item again
        const next = new Set(prev);
        next.delete(id);
        return next;
      } else {
        // Checkbox unchecked → add to exclusion → charts exclude this item
        const next = new Set(prev);
        next.add(id);
        return next;
      }
    });
  };

  const clearSelections = () => {
    setExcludedTransactionIds(new Set());
  };

  // Check if any transactions have been explicitly excluded (non-empty set means filtering active)
  const hasFilteringActive = excludedTransactionIds.size > 0;

  const formatAmount = (amount: number) => {
    // Use imported utility for consistent German formatting with sign handling
    if (amount < 0) return `-${formatAmountInline(Math.abs(amount))} €`;
    return `${formatAmountInline(amount)} €`;
  };

  // Calculate totals for currently visible/filtered transactions (not excluded)
  const { totalIncome: tableIncome, totalExpenses: tableExpenses } = useMemo(() => {
    let income = 0;
    let expenses = 0;
    
    for (const t of filteredTransactionsMemo) {
      // Only include non-excluded transactions in the visible totals
      if (!excludedTransactionIds.has(t.id)) {
        const absAmount = Math.abs(t.amount);
        if (t.type === 'Eingang') {
          income += absAmount;
        } else {
          expenses += absAmount;
        }
      }
    }
    
    return { totalIncome: income, totalExpenses: expenses };
  }, [filteredTransactionsMemo, excludedTransactionIds]);

  const tableNetBalance = tableIncome - tableExpenses;

  // German labels (hardcoded)
  const FILTER_LABEL = 'Filter:';
  const EXCLUDED_FROM_CHARTS = 'Ausgeschlossen von Charts:';
  const DATE_RANGE_LABEL = 'Zeitraum für alle Diagramme und Statistiken auswählen';
  const TOTAL_INCOME = 'Gesamteinnahmen';
  const TOTAL_EXPENSES = 'Gesamtausgaben';
  const NET_BALANCE = 'Nettosaldo';
  const TRANSACTIONS = 'Transaktionen';
  const AVERAGE_EXPENSE = 'Ø: {{value}} €';
  const TABLE_TITLE = 'Transaktionen';
  const SEARCH_PLACEHOLDER = 'Empfänger, Beschreibung durchsuchen...';
  const CATEGORY_FILTER_ALL = 'Alle Kategorien';
  const ACTIONS_COL = 'Aktionen';
  const DATE_COL = 'Datum';
  const PAYEE_COL = 'Empfänger';
  const DESCRIPTION_COL = 'Beschreibung';
  const CATEGORY_COL = 'Kategorie';
  const AMOUNT_COL = 'Betrag';
  const EMPTY_TITLE = 'Keine Transaktionen gefunden';
  const EMPTY_SUBTITLE = 'Passen Sie Ihre Filter an oder importieren Sie mehr Daten';

  return (
    <div className="space-y-8">
      {/* Header with Date Range Selector */}
      <div>
        <h1 className="text-2xl font-bold mb-4">Übersicht</h1>
        
        {/* Active Filter Display */}
        {(dateRange.preset !== 'allTime' || hasFilteringActive) && (
          <div className="mb-6 flex items-center gap-3 flex-wrap">
            {dateRange.preset !== 'allTime' && (
              <>
                <span className="text-sm text-gray-400">{FILTER_LABEL}:</span>
                <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-sm font-medium shadow-card">
                  {getPresetLabel(dateRange.preset)}
                </span>
              </>
            )}
            {hasFilteringActive && (
              <>
                <span className="text-sm text-gray-400">{EXCLUDED_FROM_CHARTS}:</span>
                <button
                  onClick={clearSelections}
                  className="inline-flex items-center px-3 py-1 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-500 text-sm font-medium hover:bg-yellow-500/20 transition-colors"
                >
                  {excludedTransactionIds.size} Transaktion(en) (klicken zum Wiederherstellen aller in Diagrammen)
                </button>
              </>
            )}
            {dateRange.startDate && dateRange.endDate && !hasFilteringActive && (
              <span className="text-xs text-gray-500 ml-2">
                ({dateRange.startDate} → {dateRange.endDate})
              </span>
            )}
          </div>
        )}

        {/* Date Range Picker */}
        <div className="mb-6 p-5 bg-surface rounded-xl border border-border shadow-card hover:shadow-card-hover transition-shadow">
          <p className="text-xs text-gray-400 mb-2">{DATE_RANGE_LABEL}</p>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={TOTAL_INCOME} value={formatCurrency(stats.totalIncome)} color="#10b981" />
        <StatCard title={TOTAL_EXPENSES} value={formatCurrency(stats.totalExpenses)} color="#ef4444" />
        <StatCard title={NET_BALANCE} value={formatCurrency(stats.netBalance)} color={stats.netBalance >= 0 ? '#10b981' : '#ef4444'} />
        <StatCard title={TRANSACTIONS} value={stats.transactionCount.toString()} subtitle={AVERAGE_EXPENSE.replace('{{value}}', formatAmountInline(stats.averageExpense))} color="#3b82f6" />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MonthlyBreakdown data={categoryBreakdown} categoryColors={categoryColors} />
        <CashFlowTimeline data={monthlyOverview} granularity={granularity} />
        <BalanceTrend data={monthlyOverview} granularity={granularity} />
        <TopMerchants data={topMerchants} />
      </div>

        {/* Transaction Table */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">{TABLE_TITLE}</h2>
          
          {/* Search and Category Filters */}
          <div className="flex flex-wrap gap-4 items-center">
            <input
              type="text"
              placeholder={SEARCH_PLACEHOLDER}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-surface border border-border rounded-lg px-4 py-2 text-sm w-full sm:w-64 focus:outline-none focus:border-primary"
            />
            
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-surface border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary"
            >
              <option value="all">{CATEGORY_FILTER_ALL}</option>
              {categories?.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>

            <span className="text-gray-400 text-sm ml-auto">
              {filteredTransactionsMemo.length} Transaktionen
            </span>
          </div>

          {/* Table with scrolling rows and sticky header/footer */}
          <div className="bg-surface rounded-xl border border-border flex flex-col overflow-hidden" style={{ maxHeight: '600px' }}>
            {/* Single table with scrollable body and sticky header for proper column alignment */}
            <div className="overflow-y-auto flex-1 min-h-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface z-10 border-b-2 border-border">
                    <th className="text-center px-3 py-3 w-[48px] sticky top-0 bg-surface shadow-md"></th>
                    <th 
                      className="text-left px-4 py-3 font-medium text-gray-400 cursor-pointer hover:text-white sticky top-0 bg-surface shadow-md"
                      onClick={() => handleSort('bookingDate')}
                      >
                        {DATE_COL} {sortField === 'bookingDate' ? (
                        sortDir === 'asc' 
                          ? <Icon name="arrow_upward" size={14} className="inline ml-0.5" />
                          : <Icon name="arrow_downward" size={14} className="inline ml-0.5" />
                      ) : ''}
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-400 sticky top-0 bg-surface shadow-md">{PAYEE_COL}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-400 hidden md:table-cell sticky top-0 bg-surface shadow-md">{DESCRIPTION_COL}</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-400 hidden sm:table-cell sticky top-0 bg-surface shadow-md">{CATEGORY_COL}</th>
                    <th 
                      className="text-right px-4 py-3 font-medium text-gray-400 cursor-pointer hover:text-white sticky top-0 bg-surface shadow-md"
                      onClick={() => handleSort('amount')}
                      >
                        {AMOUNT_COL} {sortField === 'amount' ? (
                        sortDir === 'asc' 
                          ? <Icon name="arrow_upward" size={14} className="inline ml-0.5" />
                          : <Icon name="arrow_downward" size={14} className="inline ml-0.5" />
                      ) : ''}
                    </th>
                    <th className="text-center px-2 py-3 w-[48px] font-medium text-gray-400 sticky top-0 bg-surface shadow-md">{ACTIONS_COL}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactionsMemo.map((t) => (
                    <tr key={t.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors group">
                      <td className="px-3 py-3 text-center w-[48px]">
                        <input
                          type="checkbox"
                          checked={!excludedTransactionIds.has(t.id)}
                          onChange={() => toggleTransaction(t.id)}
                          className="w-4 h-4 rounded border-gray-500 bg-transparent cursor-pointer accent-primary"
                        />
                      </td>
                      <td className="px-4 py-3 text-gray-300">{t.bookingDate}</td>
                      <td className="px-4 py-3 font-medium text-white">{t.payee}</td>
                      <td className="px-4 py-3 text-gray-400 hidden md:table-cell truncate max-w-xs">{t.description}</td>
                      <td className="px-4 py-3 text-center">
                        <span 
                          className="inline-block px-2 py-1 rounded-full text-xs font-medium"
                          style={{ backgroundColor: (categoryColors[t.category] || '#6b7280') + '33', color: categoryColors[t.category] || '#9ca3af' }}
                        >
                          {t.category}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${t.type === 'Eingang' ? 'text-success' : 'text-danger'}`}>
                        {formatAmount(t.amount)}
                      </td>
                      <td className="px-1 py-3 text-center w-[48px]">
                        <button
                          onClick={() => handleDeleteTransaction(t.id, t.payee)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 p-1 rounded"
                          title="Transaktion löschen"
                        >
                          <Icon name="delete" size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer with Totals */}
            <div className="bg-surface/90 border-t-2 border-border px-4 py-3">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="text-gray-300 pr-6">Total:</span>
                <span className={`font-bold ${tableNetBalance >= 0 ? 'text-success' : 'text-danger'}`}>
                  {formatAmountInline(tableNetBalance)} €
                </span>
              </div>
            </div>
          </div>

          {/* Empty state when no transactions match */}
      {filteredTransactionsMemo.length === 0 && (
        <div className="text-center py-12 bg-surface rounded-xl border border-border">
          <p className="text-gray-400 text-lg">{EMPTY_TITLE}</p>
          <p className="text-gray-500 text-sm mt-2">{EMPTY_SUBTITLE}</p>
        </div>
      )}
      </section>

      {/* Import Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Bankauszug importieren</h2>
          <button
            onClick={() => setShowAddTransaction(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Icon name="add" size={16} />
            Transaktion hinzufügen
          </button>
        </div>
        <ImportPanel onImportComplete={handleImportSuccess} />
      </section>

      {/* Add Transaction Modal */}
      <AddTransactionModal
        isOpen={showAddTransaction}
        onClose={() => setShowAddTransaction(false)}
        onSuccess={handleAddTransactionSuccess}
        categories={categories}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDeleteId !== null}
        title="Transaktion löschen"
        message={`Sind Sie sicher, dass Sie diese Transaktion (${confirmDeletePayee}) löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.`}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        confirmText="Löschen"
        cancelText="Abbrechen"
      />
    </div>
  );
}

function StatCard({ title, value, subtitle, color }: { title: string; value: string; subtitle?: string; color: string }) {
  return (
    <div className="bg-surface rounded-xl p-6 border border-border shadow-card hover:shadow-card-hover transition-shadow">
      {/* Inner highlight for depth */}
      <div className="absolute inset-x-[1px] top-[1px] h-[1px] bg-white/5 rounded-t-xl" />
      <p className="text-gray-400 text-sm">{title}</p>
      <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}
