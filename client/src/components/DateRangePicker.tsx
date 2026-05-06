import { useState, useEffect } from 'react';
import type { DatePreset, DateRange } from '../types/transaction';
// Import Material Icons component
import Icon from './Icon';

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

// German preset labels (hardcoded)
const PRESET_LABELS: Record<string, string> = {
  last7Days: 'Letzte 7 Tage',
  thisMonth: 'Dieser Monat',
  threeMonths: 'Letzten 3 Monate',
  ytd: 'Laufendes Jahr',
  allTime: 'Gesamt',
};

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [customStart, setCustomStart] = useState(value.startDate || '');
  const [customEnd, setCustomEnd] = useState(value.endDate || '');
  const isCustom = value.preset === 'custom';

  // Sync custom inputs when switching away from custom mode
  useEffect(() => {
    if (!isCustom) {
      setCustomStart('');
      setCustomEnd('');
    } else if (value.startDate && value.endDate) {
      // When entering custom mode, populate with existing dates
      setCustomStart(value.startDate);
      setCustomEnd(value.endDate);
    }
  }, [value.preset, isCustom]);

  const handlePresetChange = (preset: DatePreset) => {
    onChange({ preset });
  };

  const handleApplyCustom = () => {
    if (customStart && customEnd) {
      onChange({ preset: 'custom', startDate: customStart, endDate: customEnd });
    } else {
      // If no dates entered, fall back to all time
      onChange({ preset: 'allTime' });
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
      {/* Preset Buttons */}
      <div className="flex flex-wrap gap-1">
        {[
          { key: 'last7Days', label: PRESET_LABELS.last7Days },
          { key: 'thisMonth', label: PRESET_LABELS.thisMonth },
          { key: 'threeMonths', label: PRESET_LABELS.threeMonths },
          { key: 'ytd', label: PRESET_LABELS.ytd },
          { key: 'allTime', label: PRESET_LABELS.allTime },
        ].map(preset => (
          <button
            key={preset.key}
            onClick={() => handlePresetChange(preset.key as DatePreset)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              value.preset === preset.key
                ? 'bg-primary/20 text-primary border border-primary/40'
                : 'text-gray-400 hover:text-white bg-surface-hover hover:bg-border'
            }`}
          >
            {preset.label}
          </button>
        ))}

        {/* Custom Range Toggle */}
        <button
          onClick={() => handlePresetChange('custom')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            isCustom
              ? 'bg-primary/20 text-primary border border-primary/40'
              : 'text-gray-400 hover:text-white bg-surface-hover hover:bg-border'
          }`}
          >
            Zeitspanne
          </button>
      </div>

      {/* Custom Date Inputs - Native HTML5 date pickers (YYYY-MM-DD) */}
      {isCustom && (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-primary w-[140px]"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-primary w-[140px]"
          />
          <button
            onClick={handleApplyCustom}
            className="bg-primary hover:bg-primary-hover px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
          >
            Anwenden
          </button>
        </div>
      )}

      {/* Reset button when not all time */}
      {value.preset !== 'allTime' && !isCustom && (
        <button
          onClick={() => onChange({ preset: 'allTime' })}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1"
        >
          <Icon name="close" size={12} /> Reset
        </button>
      )}

      {/* Current range display */}
      {isCustom && customStart && customEnd ? (
        <span className="text-xs text-gray-400">
          {customStart} → {customEnd}
        </span>
      ) : !isCustom ? (
        <span className="text-xs text-white font-medium">
          {PRESET_LABELS[value.preset] || ''}
        </span>
      ) : null}
    </div>
  );
}
