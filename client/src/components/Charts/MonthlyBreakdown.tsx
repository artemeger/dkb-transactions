import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
// Import centralized German number formatting for charts
import { formatAmountInline } from '../../utils/money';
import { useTheme } from '../../contexts/ThemeContext';

interface CategoryBreakdown {
  category: string;
  total: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  formatter?: (value: number) => string;
}

// Glassmorphism tooltip style - works in both themes
const tooltipStyle = {
  backgroundColor: 'rgba(30, 41, 59, 0.9)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(51, 65, 85, 0.5)',
  borderRadius: '12px',
  padding: '12px 16px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
};

// Light mode tooltip override applied via CSS class
const lightTooltipStyle = {
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(203, 213, 225, 0.8)',
  borderRadius: '12px',
  padding: '12px 16px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
};

function CustomTooltip({ active, payload, textColor }: CustomTooltipProps & { textColor?: string }) {
  if (active && payload?.[0]) {
    const data = payload[0];
    return (
      <div className="bg-surface/95 backdrop-blur-md border border-border rounded-xl p-3 shadow-card">
        <p className="font-medium text-sm mb-1" style={{ color: data.color }}>{data.name}</p>
        <p className="text-lg font-bold" style={{ color: textColor || '#f1f5f9' }}>{formatAmountInline(data.value)} €</p>
      </div>
    );
  }
  return null;
}

export default function MonthlyBreakdown({ data, categoryColors }: { data: CategoryBreakdown[]; categoryColors?: Record<string, string> }) {
  const { theme } = useTheme();
  const tooltipTextColor = theme === 'dark' ? '#f1f5f9' : '#0f172a';

  // Generate consistent colors for each segment
  const segmentColors = data.map((entry) => categoryColors?.[entry.category] || '#6b7280');

  return (
    <div className="bg-surface rounded-xl p-6 border border-border shadow-card hover:shadow-card-hover transition-shadow duration-300">
      <h3 className="text-lg font-semibold mb-1">Monatliche Ausgaben</h3>
      <p className="text-gray-400 text-sm mb-6">Verteilung der Ausgaben nach Kategorie</p>
      
      <div className="h-[380px] flex items-center justify-center relative">
        {/* Shadow/blur behind chart */}
        <div className="absolute inset-0 bg-primary/5 rounded-full blur-3xl" />
        
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              {segmentColors.map((color, i) => (
                <linearGradient key={`grad-${i}`} id={`pieGrad${i}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={1} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                </linearGradient>
              ))}
            </defs>
            
            <Pie
              data={data}
              cx="50%"
              cy="48%"
              innerRadius={70}
              outerRadius={130}
              paddingAngle={3}
              dataKey="total"
              nameKey="category"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${entry.category}`} 
                  fill={`url(#pieGrad${index})`}
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}
                />
              ))}
            </Pie>
            
            <Tooltip 
              content={<CustomTooltip payload={data.map((d, i) => ({ value: d.total, name: d.category, color: segmentColors[i] }))} textColor={tooltipTextColor} />}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
