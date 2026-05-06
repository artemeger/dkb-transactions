import type { Transaction } from '../types/transaction.js';

// Helper: Convert DD.MM.YY or DD/MM/YYYY to ISO 8601 YYYY-MM-DD
function convertToISO(dateStr: string): string {
  try {
    const parts = dateStr.match(/(\d{2})[./](\d{2})[./](\d{4}|\d{2})/);
    if (parts) {
      const year = parts[3].length === 2 ? '20' + parts[3] : parts[3];
      return `${year}-${parts[2]}-${parts[1]}`; // YYYY-MM-DD
    }
  } catch {}
  return dateStr; // Return as-is if parsing fails
}

// DKB CSV uses semicolon delimiter with quoted fields and UTF-8 BOM
export function parseDkbCsv(fileContent: string): Omit<Transaction, 'category' | 'id'>[] {
  const lines = fileContent.split('\n');
  
  // Find the header line (starts with "Buchungsdatum")
  let headerIndex = -1;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    if (lines[i].includes('Buchungsdatum')) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) return [];

  const headers = lines[headerIndex]
    .split(';')
    .map(h => h.replace(/^"|"$/g, '').trim());

  // Map column indices to semantic fields
  const colMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    if (h.includes('Buchungsdatum')) colMap.bookingDate = i;
    else if (h.includes('Wertstellung')) colMap.valueDate = i;
    else if (h.includes('Status')) colMap.status = i;
    else if (h.includes('Zahlungspflichtige')) colMap.payer = i;
    else if (h.includes('Zahlungsempfaenger') || h.includes('Zahlungsempfaeger') || h.includes('Zahlungsempfänger')) colMap.payee = i;
    else if (h.includes('Verwendungszweck')) colMap.description = i;
    else if (h.includes('Umsatztyp')) colMap.type = i;
    else if (h.includes('IBAN')) colMap.iban = i;
    else if (h.includes('Betrag') || h.includes('EUR')) colMap.amount = i;
  });

  const transactions: Omit<Transaction, 'category' | 'id'>[] = [];

  // Process data rows (after header)
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('"Kontostand')) continue;

    const values = parseCsvLine(line);
    
    // Need at least the core fields
    const bookingDateRaw = colMap.bookingDate !== undefined ? values[colMap.bookingDate] : '';
    const payee = colMap.payee !== undefined ? values[colMap.payee] : '';
    const amountStr = colMap.amount !== undefined ? values[colMap.amount] : '';
    
    if (!bookingDateRaw || !payee || !amountStr) continue;

    // Convert German number format (dot = thousand separator, comma = decimal) to JS number
    // "3.456,78" → remove dots → "3456,78" → replace comma with dot → "3456.78"
    let cleanedAmount = amountStr.replace(/\./g, '');  // Remove thousand separators (dots)
    cleanedAmount = cleanedAmount.replace(',', '.');   // Replace decimal separator (comma → dot)
    const amount = parseFloat(cleanedAmount) || 0;

    // Determine transaction type
    let type: 'Eingang' | 'Ausgang' = amount >= 0 ? 'Eingang' : 'Ausgang';
    
    // Override with explicit type if available
    if (colMap.type !== undefined && values[colMap.type]) {
      const explicitType = values[colMap.type];
      if (explicitType === 'Eingang') type = 'Eingang';
      else if (explicitType === 'Ausgang') type = 'Ausgang';
    }

    transactions.push({
      bookingDate: convertToISO(bookingDateRaw.trim()),
      valueDate: colMap.valueDate !== undefined ? convertToISO(values[colMap.valueDate]?.trim() || '') : convertToISO(bookingDateRaw.trim()),
      status: colMap.status !== undefined ? values[colMap.status]?.trim() || 'Gebucht' : 'Gebucht',
      payer: colMap.payer !== undefined ? values[colMap.payer]?.trim() : '',
      payee,
      description: colMap.description !== undefined ? values[colMap.description]?.trim() : '',
      type,
      iban: colMap.iban !== undefined ? values[colMap.iban]?.trim() || '' : '',
      amount,
      importedAt: new Date().toISOString(),
    });
  }

  return transactions;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ';' && !inQuotes) {
      result.push(current.replace(/^"|"$/g, '').trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Push the last field
  result.push(current.replace(/^"|"$/g, '').trim());
  
  return result;
}
