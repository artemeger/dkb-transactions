import { useState, useEffect } from 'react';
// Import Material Icons component and Spinner
import Icon, { Spinner } from './Icon';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Delete',
  cancelText = 'Cancel',
}: ConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setIsConfirming(false);
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm modal-backdrop-animate"
        onClick={onCancel}
      />

      {/* Dialog Content - matches AddTransactionModal styling */}
      <div className="relative bg-surface border border-border rounded-2xl w-full max-w-sm shadow-2xl modal-animate">
        {/* Inner highlight for depth */}
        <div className="absolute inset-x-[1px] top-[1px] h-[1px] bg-white/10 rounded-t-2xl" />
        
        <div className="p-6">
          {/* Header with icon */}
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icon name="warning" size={20} className="text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
          </div>

          <p className="text-gray-300 mb-6 ml-[52px] leading-relaxed">
            {message}
          </p>

          {/* Buttons */}
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isConfirming}
              className="px-4 py-2.5 border border-border text-gray-300 hover:bg-surface-hover rounded-lg transition-colors disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isConfirming}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-red-500/20"
            >
              {isConfirming ? (
                <>
                  <Spinner size={16} />
                  Deleting...
                </>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
