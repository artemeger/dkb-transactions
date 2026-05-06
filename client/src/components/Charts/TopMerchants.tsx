import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
// Import centralized German number formatting for charts
import { formatAmountInline } from '../../utils/money';
import { useTheme } from '../../contexts/ThemeContext';

interface MerchantDataPoint {
  merchant: string;
  totalSpent: number;
}

function truncateMerchant(name: string): string {
  if (name.length > 16) return name.substring(0, 14) + '…';
  return name;
}

// Custom tooltip for enhanced display
interface MerchantPayloadData {
  merchant: string;
  totalSpent?: number;
  [key: string]: unknown;
}

function MerchantTooltip({ active, payload, tooltipLabelColor, tooltipValueColor }: { 
  active?: boolean; 
  payload?: Array<{ value: number | null; name?: string; payload?: MerchantPayloadData }>;
  tooltipLabelColor?: string;
  tooltipValueColor?: string;
}) {
  if (active && payload?.[0]) {
    const barValue = payload[0].value; // Recharts passes the bar dataKey value here
    const data = payload[0].payload!;
    const rawValue = Number(barValue ?? data.totalSpent);
    const formattedAmount = !isNaN(rawValue) ? formatAmountInline(rawValue) : 'N/A';
    return (
      <div className="bg-surface/95 backdrop-blur-md border border-border rounded-xl p-3 shadow-card">
        <p className="font-medium text-sm mb-1" style={{ color: tooltipLabelColor || '#f1f5f9' }}>{data.merchant}</p>
        <p className="text-lg font-bold" style={{ color: tooltipValueColor || '#f1f5f9' }}>{formattedAmount} €</p>
      </div>
    );
  }
  return null;
}

export default function TopMerchants({ data }: { data: MerchantDataPoint[] }) {
  const { theme } = useTheme();
  const axisColor = theme === 'dark' ? '#9ca3af' : '#4b5563';
  const yAxisColor = theme === 'dark' ? '#d1d5db' : '#374151';
  const barColor = theme === 'dark' ? '#3b82f6' : '#2563eb';
  const tooltipLabelColor = theme === 'dark' ? '#f1f5f9' : '#0f172a';
  const tooltipValueColor = theme === 'dark' ? '#f1f5f9' : '#0f172a';

  // Sort by spending descending (highest first) to show biggest spenders at top, ensure spent is a number (defensive)
  const chartData = [...data]
    .map(d => {
      // Explicitly handle NaN - Number() can return NaN for non-numeric strings
      const rawValue = d.totalSpent == null ? 0 : Number(d.totalSpent);
      const spent = !isNaN(rawValue) && isFinite(rawValue) ? Math.max(0, rawValue) : 0;
      return {
        merchant: d.merchant,
        merchantShort: truncateMerchant(d.merchant),
        spent,
      };
    })
    .filter(d => d.spent > 0 || d.merchant) // Remove empty entries
    .sort((a, b) => b.spent - a.spent) // Sort descending by spending
    .slice(0, 15); // Take top 15

  return (
    <div className="bg-surface rounded-xl p-6 border border-border shadow-card hover:shadow-card-hover transition-shadow duration-300">
      <h3 className="text-lg font-semibold mb-1">Top Schuldiger</h3>
      <p className="text-gray-400 text-sm mb-6">Die grössten Schuldiger nach Ausgaben</p>
      
      {/* Subtle glow behind chart */}
      <div className="h-[380px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 60 }}>
            {/* Clean axes - no grid lines */}
            <XAxis 
              type="number" 
              tick={{ fill: axisColor, fontSize: 12 }} 
              tickFormatter={(v) => {
                const num = Number(v);
                return isNaN(num) ? '' : `${Math.round(num / 1000)}k`;
              }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              type="category" 
              dataKey="merchantShort" 
              width={90} 
              tick={{ fill: yAxisColor, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            
            {/* Value labels at bar ends - rendered via tooltip for simplicity */}
            <Tooltip 
              content={<MerchantTooltip tooltipLabelColor={tooltipLabelColor} tooltipValueColor={tooltipValueColor} />}
              cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
            />
            
            {/* Gradient-like effect using layered approach */}
            <Bar 
              dataKey="spent" 
              fill={barColor} 
              radius={[0, 8, 8, 0]} 
              name="Gesamt ausgegeben"
              style={{ filter: 'brightness(1.1)' }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
