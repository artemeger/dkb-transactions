import { useState, useEffect, useCallback } from 'react';
import type { CategoryRule } from '../types/transaction';
// Import Material Icons component and Spinner
import Icon, { Spinner } from './Icon';

interface AddTransactionFormState {
  date: string;
  payee: string;
  description: string;
  amount: string;
  type: 'Eingang' | 'Ausgang';
}

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (transactionId?: string) => void;
  categories?: CategoryRule[];
}

// German labels (hardcoded)
const MODAL_TITLE = 'Neue Transaktion hinzufügen';
const DATE_LABEL = 'Datum';
const TYPE_LABEL = 'Typ';
const PAYEE_LABEL = 'Empfänger';
const DESCRIPTION_LABEL = 'Beschreibung';
const AMOUNT_LABEL = 'Betrag';
const SUBMIT_LABEL = 'Hinzufügen';
const ADDING_LABEL = 'Wird hinzugefügt...';
const VALIDATION_REQUIRED = 'Bitte füllen Sie alle Pflichtfelder aus';
const VALIDATION_AMOUNT = 'Der Betrag muss eine gültige Zahl sein';
const ERROR_CREATE_TRANSACTION = 'Transaktion konnte nicht erstellt werden';

export default function AddTransactionModal({
  isOpen,
  onClose,
  onSuccess,
  categories = [],
}: AddTransactionModalProps) {
  const today = new Date().toISOString().split('T')[0];
  
  const [form, setForm] = useState<AddTransactionFormState>({
    date: today,
    payee: '',
    description: '',
    amount: '',
    type: 'Ausgang',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens/closes
  const handleOpenClose = useCallback(() => {
    if (!isOpen) return;
    setForm({
      date: today,
      payee: '',
      description: '',
      amount: '',
      type: 'Ausgang',
    });
    setError(null);
  }, [isOpen, today]);

  // Watch for modal open state changes and reset form
  useEffect(() => {
    if (isOpen) handleOpenClose();
  }, [isOpen, handleOpenClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!form.payee.trim() || !form.description.trim() || !form.amount.trim()) {
      setError(VALIDATION_REQUIRED);
      return;
    }

    // Support both European (1.234,56) and US (1,234.56) decimal formats
    let amountStr = form.amount.replace(/\s/g, '');
    
    // Detect format: if there's a comma after the last dot or no dots at all with comma
    const hasDot = amountStr.includes('.');
    const hasComma = amountStr.includes(',');
    
    if (hasDot && hasComma) {
      // Both present - determine which is decimal separator
      const lastDotIdx = amountStr.lastIndexOf('.');
      const lastCommaIdx = amountStr.lastIndexOf(',');
      if (lastCommaIdx > lastDotIdx) {
        // European format: 1.234,56 -> remove dots, replace comma with dot
        amountStr = amountStr.replace(/\./g, '').replace(',', '.');
      } else {
        // US format: 1,234.56 -> remove commas
        amountStr = amountStr.replace(/,/g, '');
      }
    } else if (hasComma && !hasDot) {
      // Only comma present - could be European decimal or thousand separator
      const parts = amountStr.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        // Likely European decimal: 12,34 -> 12.34
        amountStr = amountStr.replace(',', '.');
      } else {
        // Likely thousand separator: 1,000 -> 1000
        amountStr = amountStr.replace(/,/g, '');
      }
    }

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || Math.abs(amount) < 0.01) {
      setError(VALIDATION_AMOUNT);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Determine the actual amount value based on type
      const body = {
        bookingDate: form.date,
        payee: form.payee.trim(),
        description: form.description.trim(),
        type: form.type,
        amount: Math.abs(amount).toString(),
      };

      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: ERROR_CREATE_TRANSACTION }));
        throw new Error(errorData.error || ERROR_CREATE_TRANSACTION);
      }

      const data = await response.json();
      
      // Reset form and close modal on success
      setForm({
        date: today,
        payee: '',
        description: '',
        amount: '',
        type: 'Ausgang',
      });
      (onSuccess as (id?: string) => void)(data.transaction?.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : ERROR_CREATE_TRANSACTION);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof AddTransactionFormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Enhanced backdrop with glassmorphism */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm modal-backdrop-animate"
        onClick={onClose}
      />

      {/* Modal Content - elevated card with animation */}
      <div className="relative bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl modal-animate">
        {/* Inner highlight for depth */}
        <div className="absolute inset-x-[1px] top-[1px] h-[1px] bg-white/10 rounded-t-2xl" />
        
        <div className="p-6">
          {/* Header with close button */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">{MODAL_TITLE}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-surface-hover"
            >
              <Icon name="close" size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Date and Type Row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{DATE_LABEL}</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => handleChange('date', e.target.value)}
                  className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{TYPE_LABEL}</label>
                <select
                  value={form.type}
                  onChange={(e) => handleChange('type', e.target.value)}
                  className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                >
                  <option value="Ausgang">Expense (Ausgang)</option>
                  <option value="Eingang">Income (Eingang)</option>
                </select>
              </div>
            </div>

            {/* Payee */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">{PAYEE_LABEL}</label>
              <input
                type="text"
                value={form.payee}
                onChange={(e) => handleChange('payee', e.target.value)}
                placeholder="z.B., Amazon, Gehalt..."
                className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">{DESCRIPTION_LABEL}</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Wofür war das?"
                className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                required
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">{AMOUNT_LABEL} €</label>
              <input
                type="text"
                value={form.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                placeholder="0,00"
                className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all font-mono"
                required
              />
            </div>

            {/* Error Message */}
            {error && (
              <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-primary hover:bg-primary-hover text-white font-medium py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size={16} />
                    {ADDING_LABEL}
                  </span>
                ) : (
                  SUBMIT_LABEL
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 border border-border text-gray-300 hover:bg-surface-hover rounded-lg transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
