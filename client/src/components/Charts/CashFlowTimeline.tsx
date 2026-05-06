import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
// Import centralized German number formatting for charts
import { formatAmountInline } from '../../utils/money';
import { useTheme } from '../../contexts/ThemeContext';

interface MonthlyDataPoint {
  month: string;
  income: number;
  expenses: number;
  balance: number;
  runningBalance: number;
}

function formatDateLabel(dateStr: string): string {
  if (dateStr.length === 10) {
    const months = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parseInt(parts[2])} ${months[parseInt(parts[1]) - 1]}`;
    }
  }
  const months = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  const parts = dateStr.split('-');
  if (parts.length === 2) {
    return `${months[parseInt(parts[1]) - 1]} ${parts[0]}`;
  }
  return dateStr;
}

// Custom tooltip for enhanced display
interface ChartPayloadData {
  month: string;
  [key: string]: unknown;
}

function CashFlowTooltip({ active, payload, tooltipDateColor, tooltipLabelColor, tooltipValueColor }: { 
  active?: boolean; 
  payload?: Array<{ value: number; name?: string; color?: string; payload?: ChartPayloadData }>;
  tooltipDateColor?: string;
  tooltipLabelColor?: string;
  tooltipValueColor?: string;
}) {
  if (active && payload?.[0]) {
    const data = payload[0].payload!;
    return (
      <div className="bg-surface/95 backdrop-blur-md border border-border rounded-xl p-3 shadow-card">
        <p className="font-medium text-sm mb-2" style={{ color: tooltipDateColor || '#9ca3af' }}>{formatDateLabel(data.month)}</p>
        <div className="space-y-1">
          {payload.map((entry, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: (entry.color as string) || '#10b981' }} />
              <span style={{ color: tooltipLabelColor || '#9ca3af', fontSize: '12px' }}>{entry.name}:</span>
              <span className="font-semibold text-xs" style={{ color: tooltipValueColor || '#f1f5f9' }}>{formatAmountInline(entry.value)} €</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

export default function CashFlowTimeline({ data, granularity }: { data: MonthlyDataPoint[]; granularity?: 'day' | 'month' }) {
  const { theme } = useTheme();
  const axisColor = theme === 'dark' ? '#9ca3af' : '#4b5563';
  const legendColor = theme === 'dark' ? '#9ca3af' : '#4b5563';
  const tooltipDateColor = theme === 'dark' ? '#9ca3af' : '#6b7280';
  const tooltipLabelColor = theme === 'dark' ? '#9ca3af' : '#4b5563';
  const tooltipValueColor = theme === 'dark' ? '#f1f5f9' : '#0f172a';

  const chartData = data.map(d => ({
    month: d.month,
    'Einnahmen': d.income,
    'Ausgaben': d.expenses,
  }));

  // Determine subtitle based on granularity (German hardcoded)
  const subtitle = granularity === 'day' ? 'Täglicher Cashflow-Verlauf' : 'Monatlicher Cashflow-Verlauf';

  return (
    <div className="bg-surface rounded-xl p-6 border border-border shadow-card hover:shadow-card-hover transition-shadow duration-300">
      <h3 className="text-lg font-semibold mb-1">Cashflow-Übersicht</h3>
      <p className="text-gray-400 text-sm mb-6">{subtitle}</p>
      
      {/* Subtle reference lines only - no harsh grid */}
      <div className="h-[380px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            {/* Minimal horizontal reference lines */}
            <XAxis 
              dataKey="month" 
              tick={{ fill: axisColor, fontSize: 12 }} 
              tickFormatter={(v) => formatDateLabel(v as string)}
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              tick={{ fill: axisColor, fontSize: 12 }} 
              tickFormatter={(v) => `${(v/1000).toFixed(0)}k`}
              axisLine={false}
              tickLine={false}
            />
            
            {/* Custom tooltip */}
            <Tooltip 
              content={<CashFlowTooltip tooltipDateColor={tooltipDateColor} tooltipLabelColor={tooltipLabelColor} tooltipValueColor={tooltipValueColor} />}
              cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
            />
            
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              formatter={(value) => <span style={{ color: legendColor, fontSize: '12px' }}>{value}</span>}
            />
            
            {/* Gradient-like bars using opacity and slight gradient effect */}
            <Bar 
              dataKey="Einnahmen" 
              fill={theme === 'dark' ? '#10b981' : '#059669'} 
              radius={[6, 6, 0, 0]} 
              name="Einnahmen"
              style={{ filter: 'brightness(1.1)' }}
            />
            <Bar 
              dataKey="Ausgaben" 
              fill={theme === 'dark' ? '#ef4444' : '#dc2626'} 
              radius={[6, 6, 0, 0]} 
              name="Ausgaben"
              style={{ filter: 'brightness(1.1)' }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
