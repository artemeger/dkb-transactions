import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

// Data directory - resolve from project root (server/src/services -> data needs 3 levels up)
const MODULE_PATH = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(MODULE_PATH, '..', '..', '..');

// Use DKB_DATA_DIR env var if set (from Electron main process), otherwise use project-relative path
const STORAGE_DIR = process.env.DKB_DATA_DIR || path.join(PROJECT_ROOT, 'data');

console.log('[STORAGE] Using data directory:', STORAGE_DIR);

// Ensure data directory exists before writing files
function ensureDataDir() {
  if (!existsSync(STORAGE_DIR)) {
    console.log('[STORAGE] Creating data directory:', STORAGE_DIR);
    mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

export function writeTransactions(transactions: any[]): void {
  ensureDataDir();
  const filePath = path.join(STORAGE_DIR, 'transactions.json');
  const data = JSON.stringify({ transactions }, null, 2);
  writeFileSync(filePath, data, { encoding: 'utf-8' });
}

export function readTransactions(): any[] {
  try {
    const filePath = path.join(STORAGE_DIR, 'transactions.json');
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as { transactions: any[] };
    return parsed.transactions || [];
  } catch {
    return [];
  }
}

export function writeCategories(rules: any[]): void {
  ensureDataDir();
  const filePath = path.join(STORAGE_DIR, 'categories.json');
  const data = JSON.stringify({ rules }, null, 2);
  writeFileSync(filePath, data, { encoding: 'utf-8' });
}

export function readCategories(): any[] {
  const filePath = path.join(STORAGE_DIR, 'categories.json');
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as { rules: any[] };
    return parsed.rules || [];
  } catch {
    // Return default categories
    return getDefaultCategories();
  }
}

function getDefaultCategories(): any[] {
  return [
    { id: '1', name: 'Lebensmittel', keywords: ['REWE', 'EDEKA', 'ALDI', 'LIDL', 'MINDERLEINSMUEHLE'], color: '#3b82f6' },
    { id: '2', name: 'Einzelhandel/Baumarkt', keywords: ['HORNBAKH', 'TOOM', 'OBI', 'HORNBERG'], color: '#ef4444' },
    { id: '3', name: 'Zahlungsdienste', keywords: ['AMAZON PAYMENTS', 'PAYPAL', 'KLARNA'], color: '#8b5cf6' },
    { id: '4', name: 'Telekom/Internet', keywords: ['TELEKOM', 'HETZNER', 'STRATO', 'IONOS'], color: '#06b6d4' },
    { id: '5', name: 'Energie/Versorgung', keywords: ['MUEENCH ENERGIE', 'ENBW', 'STADTWERK'], color: '#f59e0b' },
    { id: '6', name: 'Tanken/Mobilitaet', keywords: ['ARAL', 'SHELL', 'BAYWA', 'AVIA', 'JET'], color: '#10b981' },
    { id: '7', name: 'Restaurant/Gastronomie', keywords: ['BAECKER', 'RESTAURANT', 'CAFE', 'PIZZA'], color: '#ec4899' },
    { id: '8', name: 'Versicherung', keywords: ['VERSIHERUNG', 'ALLIANZ', 'HUK24', 'TARGO'], color: '#6366f1' },
    { id: '9', name: 'Unterkunft/Miete', keywords: ['MIETE', 'WOHNUNG', 'IMMOBILIEN'], color: '#78716c' },
    { id: '10', name: 'Sonstige', keywords: [], color: '#9ca3af' }
  ];
}
