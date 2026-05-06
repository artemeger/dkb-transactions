import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
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

// Enhanced tooltip for balance trend
interface BalancePayloadData {
  month: string;
  balance: number;
  runningBalance?: number;
  [key: string]: unknown;
}

function BalanceTooltip({ active, payload, tooltipDateColor, tooltipValueColor }: { 
  active?: boolean; 
  payload?: Array<{ value: number; name?: string; payload?: BalancePayloadData }>;
  tooltipDateColor?: string;
  tooltipValueColor?: string;
}) {
  if (active && payload?.[0]) {
    const data = payload[0].payload!;
    return (
      <div className="bg-surface/95 backdrop-blur-md border border-border rounded-xl p-3 shadow-card">
        <p className="font-medium text-sm mb-1" style={{ color: tooltipDateColor || '#9ca3af' }}>{formatDateLabel(data.month)}</p>
        <p className="text-lg font-bold" style={{ color: tooltipValueColor || '#f1f5f9' }}>
          {data.balance >= 0 ? '' : '-'}
          {formatAmountInline(Math.abs(data.balance))} €
        </p>
      </div>
    );
  }
  return null;
}

export default function BalanceTrend({ data, granularity }: { data: MonthlyDataPoint[]; granularity?: 'day' | 'month' }) {
  const { theme } = useTheme();
  const axisColor = theme === 'dark' ? '#9ca3af' : '#4b5563';
  const lineColor = theme === 'dark' ? '#3b82f6' : '#2563eb';
  const lineColorLight = theme === 'dark' ? '#60a5fa' : '#3b82f6';
  const dotStrokeColor = theme === 'dark' ? '#ffffff' : '#1e293b';
  const tooltipDateColor = theme === 'dark' ? '#9ca3af' : '#6b7280';
  const tooltipValueColor = theme === 'dark' ? '#f1f5f9' : '#0f172a';

  const chartData = data.map(d => ({
    month: d.month,
    balance: d.runningBalance,
  }));

  return (
    <div className="bg-surface rounded-xl p-6 border border-border shadow-card hover:shadow-card-hover transition-shadow duration-300">
      <h3 className="text-lg font-semibold mb-1">Saldo-Trend</h3>
      <p className="text-gray-400 text-sm mb-6">Entwicklung des laufenden Saldo über die Zeit</p>
      
      {/* Visual depth behind chart */}
      <div className="h-[280px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            {/* Gradient area fill beneath the line */}
            <defs>
              <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
                <stop offset="50%" stopColor={lineColor} stopOpacity={0.1} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            
            {/* Minimal axes - clean look */}
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
            
            {/* Gradient area fill */}
            <Area 
              type="monotone" 
              dataKey="balance" 
              stroke="none"
              fill="url(#balanceGradient)" 
            />
            
            {/* Line on top of the area */}
            <Line 
              type="monotone" 
              dataKey="balance" 
              stroke={lineColor} 
              strokeWidth={3}
              dot={{ fill: lineColor, r: 4, strokeWidth: 0 }}
              activeDot={{ r: 7, fill: lineColorLight, strokeWidth: 2, stroke: dotStrokeColor }}
            />
            
            <Tooltip 
              content={<BalanceTooltip tooltipDateColor={tooltipDateColor} tooltipValueColor={tooltipValueColor} />}
              cursor={{ stroke: 'rgba(59, 130, 246, 0.3)', strokeWidth: 1 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
