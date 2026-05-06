// Helper: Map preset to actual date range for filtering
function pad(num: number, size = 2): string {
  return String(num).padStart(size, '0');
}

function getFirstDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getLastDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getPresetDateRange(preset?: string): { startDate?: string; endDate?: string } | undefined {
  if (!preset || preset === 'allTime') return undefined;

  const now = new Date();

  switch (preset) {
    case 'last7Days': {
      let sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      // Return actual calculated dates for proper filtering
      return { startDate: formatDate(sevenDaysAgo), endDate: formatDate(now) };
    }

    case 'thisMonth':
      return { 
        startDate: formatDate(getFirstDayOfMonth(now)), 
        endDate: formatDate(getLastDayOfMonth(now)) 
      };

    case 'threeMonths': {
      let threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 2);
      return { 
        startDate: formatDate(getFirstDayOfMonth(threeMonthsAgo)), 
        endDate: formatDate(getLastDayOfMonth(now)) 
      };
    }

    case 'ytd':
      return { startDate: `${now.getFullYear()}-01-01` };

    default:
      return undefined;
  }
}
