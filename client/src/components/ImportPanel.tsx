import { useState } from 'react';
import { useImport } from '../hooks/useTransactions';
// Import Material Icons component
import Icon from './Icon';

interface ImportPanelProps {
  onImportComplete?: (importedCount: number) => void;
}

// German labels (hardcoded)
const UPLOADING = 'Wird hochgeladen...';
const DROP_OR_BROWSE = 'Datei hier ablegen oder durchsuchen';
const SUBTITLE = 'Bankauszug importieren';
const OR_CLICK_TO_BROWSE = 'oder klicken zum Durchsuchen';
const SUCCESS = 'Import erfolgreich!';
const IMPORTED_COUNT = '{{count}} von {{total}} Transaktionen importiert';
const NO_NEW_TRANSACTIONS = 'Keine neuen Transaktionen gefunden (alle bereits vorhanden)';
const IMPORT_ERROR = 'Import fehlgeschlagen: ';
const HINT = 'Unterstützt DKB Export CSV Formate';

export default function ImportPanel({ onImportComplete }: ImportPanelProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ importedCount: number; totalTransactions: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { importFile } = useImport();

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (!file) return;
    
    await processFile(file);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    setUploading(true);
    setResult(null);
    setError(null);
    
    try {
      const data = await importFile(file);
      setResult(data);
      onImportComplete?.(data.importedCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      console.error('Import fehlgeschlagen:', err);
    } finally {
      setUploading(false);
    }
  };

  // Helper to format imported count message with interpolation
  const getImportedCountMessage = () => {
    if (!result) return '';
    if (result.importedCount === 0) return NO_NEW_TRANSACTIONS;
    return IMPORTED_COUNT.replace('{{count}}', String(result.importedCount)).replace('{{total}}', String(result.totalTransactions));
  };

  return (
    <div className={`bg-surface rounded-xl p-8 border-2 border-dashed transition-all duration-300 ${
      dragging ? 'border-primary bg-primary/5 shadow-card' : 'border-border hover:border-border-hover'
    }`}>
      <input
        type="file"
        accept=".csv,.txt"
        onChange={handleFileSelect}
        className="hidden"
        id="csv-upload"
      />
      
      <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-all duration-300 ${
          dragging ? 'bg-primary/25' : 'bg-primary/20'
        }`}>
          <Icon name="file_upload" size={32} className="text-primary" />
        </div>
        
        <p className="text-lg font-medium mb-1">
          {uploading ? UPLOADING : dragging ? DROP_OR_BROWSE : SUBTITLE}
        </p>
        <p className="text-gray-400 text-sm">{OR_CLICK_TO_BROWSE}</p>
      </label>

      {result && (
        <div className="mt-6 p-4 bg-success/10 border border-success/30 rounded-lg shadow-card">
          <p className="text-success font-medium flex items-center gap-1">
            <Icon name="check" size={16} /> {SUCCESS}
          </p>
          <p className="text-gray-400 text-sm mt-1">
            {getImportedCountMessage()}
          </p>
        </div>
      )}

      {error && (
        <div className="mt-6 p-4 bg-error/10 border border-error/30 rounded-lg shadow-card">
          <p className="text-red-500 font-medium flex items-center gap-1">
            <Icon name="error" size={16} /> {IMPORT_ERROR}{error}
          </p>
        </div>
      )}

      <div className="mt-4 text-center">
        <span className="text-xs text-gray-500">{HINT}</span>
      </div>
    </div>
  );
}
