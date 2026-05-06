import { Router } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { readTransactions, writeTransactions, readCategories, writeCategories } from '../services/storage.js';
import { parseDkbCsv } from '../services/csvParser.js';
import { categorizeTransactions, reCategorizeAllTransactions } from '../services/categorizer.js';
import { asyncHandler } from '../middleware/errorHandler.js';
// Consolidated imports: use single utility for date range handling
import { getPresetDateRange, isInDateRange as isInRange } from '../utils/dateRange.js';
// Import fingerprint utilities for duplicate detection
import { 
  generateTransactionFingerprint, 
  generateImportDataFingerprint,
  generateImportedTransactionFingerprint,
  generateManualTransactionFingerprint,
} from '../utils/transactionFingerprint.js';

const router = Router();

// Multer config for file uploads - use system temp dir for AppImage compatibility
const UPLOAD_TEMP_DIR = path.join(os.tmpdir(), 'dkb-uploads');
fsSync.mkdirSync(UPLOAD_TEMP_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_TEMP_DIR),
  filename: (_req, file, cb) => cb(null, `upload-${Date.now()}-${file.originalname}`),
});

const upload = multer({ storage });

// POST /api/import - Import a CSV bank statement file
router.post('/import', asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Read the uploaded file from disk
  const filePath = req.file.path;
  
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Clean up uploaded file immediately after reading
    await fs.unlink(filePath);

    const parsed = parseDkbCsv(content);
    const existingTransactions = readTransactions();
    
    // Build fingerprint set from ALL existing transactions for comprehensive deduplication
    const existingFingerprints = new Set<string>();
    const existingIds = new Set<string>();
    
    existingTransactions.forEach((t: any) => {
      if (t.id) existingIds.add(t.id);
      
      // Use the same fingerprint logic as for import data to ensure consistency
      const fp = generateTransactionFingerprint(t);
      existingFingerprints.add(fp);
    });

    console.log('[IMPORT] Debug: parsed', parsed.length, 'rows from CSV');
    console.log('[IMPORT] Debug:', existingTransactions.length, 'existing transactions,', existingFingerprints.size, 'unique fingerprints');
    
    // Filter out duplicates: remove by ID OR by fingerprint match
    const newTransactions = parsed.filter((t: any) => {
      // Skip if duplicate by ID (original check)
      if (existingIds.has(t.id)) return false;
      
      // Skip if duplicate by fingerprint (new check for re-imports)
      let fp: string;
      if (t.iban && t.iban.trim()) {
        const counterparty = t.type === 'Eingang' ? t.payer : t.payee;
        fp = generateImportDataFingerprint(t.bookingDate, t.amount, t.payee, t.payer, t.iban, t.description);
      } else {
        // Use payee/payer as counterpart for non-IBAN transactions (consistent with manual entry)
        const counterparty = t.payee || t.payer || '';
        fp = generateImportDataFingerprint(t.bookingDate, t.amount, counterparty, undefined, undefined, t.description);
      }
      
      const isMatch = existingFingerprints.has(fp);
      if (isMatch) {
        console.log('[IMPORT] FILTERED:', t.payee || t.payer, '|', t.amount, '|', t.bookingDate, '| desc:', t.description?.substring(0, 40), '| iban:', t.iban || '(none)', '-> fp:', fp);
      }
      
      return !isMatch;
    });

    console.log('[IMPORT] Debug: keeping', newTransactions.length, 'rows (filtered out', parsed.length - newTransactions.length, ')');
    
    // Add categories to new transactions using categorizer
    const categories = readCategories();
    const categorizedNew = categorizeTransactions(newTransactions, categories);
    
    // Merge all transactions (keep existing + add new)
    const allTransactions = [...existingTransactions, ...categorizedNew];
    writeTransactions(allTransactions);

    res.json({ 
      importedCount: categorizedNew.length, 
      totalTransactions: allTransactions.length,
      duplicatesFound: parsed.length - categorizedNew.length // Report how many were skipped as duplicates
    });
  } catch (err) {
    // Clean up file if it still exists on error
    try { await fs.unlink(filePath); } catch {}
    
    console.error('Failed to read or parse CSV:', err);
    res.status(500).json({ error: 'Failed to process uploaded file', details: String(err) });
  }
}));

// POST /api/transactions - Create a new manual/custom transaction
router.post('/transactions', asyncHandler(async (req, res) => {
  const { bookingDate, payee, description, type, amount } = req.body;

  if (!bookingDate || !payee || !description || !type || amount === undefined) {
    return res.status(400).json({ 
      error: 'Missing required fields: bookingDate, payee, description, type, amount' 
    });
  }

  // Validate date format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  // Validate type
  if (type !== 'Eingang' && type !== 'Ausgang') {
    return res.status(400).json({ error: 'Type must be "Eingang" or "Ausgang"' });
  }

  const amountNum = parseFloat(amount) || 0;
  
  // Check for duplicate before creating - use fingerprint to detect existing transactions
  const existingTransactions = readTransactions();
  let isDuplicate = false;
  
  // Build fingerprints from all existing transactions
  const existingFingerprints = new Set<string>();
  existingTransactions.forEach((t: any) => {
    if (t.iban && t.iban.trim()) {
      const counterparty = t.type === 'Eingang' ? t.payer : t.payee;
      const fp = generateImportedTransactionFingerprint(
        t.bookingDate, t.iban, t.amount, counterparty || ''
      );
      existingFingerprints.add(fp);
    } else {
      existingFingerprints.add(generateTransactionFingerprint(t));
    }
  });
  
  // Generate fingerprint for the new transaction being added
  const newFp = generateManualTransactionFingerprint(bookingDate, amountNum, payee, description);
  isDuplicate = existingFingerprints.has(newFp);

  if (isDuplicate) {
    return res.status(409).json({ 
      error: 'A transaction with these details already exists',
      duplicate: true,
      totalTransactions: existingTransactions.length
    });
  }

  const newTransaction = {
    id: uuidv4(),
    bookingDate,
    valueDate: bookingDate, // Use same date for valueDate
    status: 'Gebucht',      // Auto-booked since it's manual
    payer: '',
    payee,
    description,
    type,
    iban: '',
    amount: amountNum,
    category: req.body.category || undefined,
    importedAt: new Date().toISOString(),
    source: 'custom',       // Mark as manually added transaction
  };

  const transactions = readTransactions();
  transactions.push(newTransaction);
  writeTransactions(transactions);

  res.json({ 
    message: 'Transaction created', 
    transaction: newTransaction,
    totalTransactions: transactions.length
  });
}));

// GET /api/transactions - List all transactions with optional date filtering
router.get('/transactions', asyncHandler(async (req, res) => {
  let transactions = readTransactions();
  
  // Use centralized date range resolution from utility module
  const preset = req.query.preset as string | undefined;
  const resolvedRange = getPresetDateRange(preset);
  const startDate = resolvedRange?.startDate || (req.query.startDate as string | undefined);
  const endDate = resolvedRange?.endDate || (req.query.endDate as string | undefined);
  
  if (startDate && endDate) {
    transactions = transactions.filter(t => isInRange(t.bookingDate, startDate, endDate));
  }
  
  res.json(transactions);
}));

// PUT /api/transactions/:id/category - Update transaction category
router.put('/transactions/:id/category', asyncHandler(async (req, res) => {
  const transactions = readTransactions();
  const id = req.params.id;
  
  const index = transactions.findIndex(t => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  transactions[index].category = req.body.category;
  writeTransactions(transactions);
  
  res.json({ message: 'Category updated', transaction: transactions[index] });
}));

// DELETE /api/transactions/:id - Delete a transaction by ID
router.delete('/transactions/:id', asyncHandler(async (req, res) => {
  const transactions = readTransactions();
  const id = req.params.id;

  // Check if the transaction exists
  const index = transactions.findIndex(t => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  // Remove the transaction from the array
  const updatedTransactions = transactions.filter(t => t.id !== id);
  
  // Write back to storage
  writeTransactions(updatedTransactions);
  
  res.json({ 
    message: 'Transaction deleted', 
    totalTransactions: updatedTransactions.length 
  });
}));

// GET /api/categories - List all category rules
router.get('/categories', asyncHandler(async (_req, res) => {
  const categories = readCategories();
  res.json(categories);
}));

// POST /api/categories - Create a new category rule
router.post('/categories', asyncHandler(async (req, res) => {
  const categories = readCategories();
  
  // Check for duplicate name
  if (categories.some(c => c.name === req.body.name)) {
    return res.status(400).json({ error: 'Category with this name already exists' });
  }

  const newCategory = {
    id: uuidv4(),
    name: req.body.name,
    keywords: req.body.keywords || [],
    color: req.body.color || '#9ca3af',
  };

  categories.push(newCategory);
  writeCategories(categories);
  
  // Re-categorize all existing transactions with new category rules
  const currentTransactions = readTransactions();
  const reCategorized = reCategorizeAllTransactions(currentTransactions, categories);
  if (reCategorized > 0) {
    writeTransactions([...currentTransactions]);
  }
  
  res.json({ 
    message: 'Category created', 
    category: newCategory,
    recategorizedCount: reCategorized || 0
  });
}));

// PUT /api/categories/:id - Update a category rule
router.put('/categories/:id', asyncHandler(async (req, res) => {
  const categories = readCategories();
  const id = req.params.id;
  
  const index = categories.findIndex(c => c.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Category not found' });
  }

  // Check if keywords changed before deciding to re-categorize
  const oldKeywords = categories[index].keywords || [];
  const newKeywords = req.body.keywords || [];
  const keywordsChanged = JSON.stringify(oldKeywords.sort()) !== JSON.stringify(newKeywords.sort());
  
  categories[index] = { ...categories[index], ...req.body };
  writeCategories(categories);
  
  // Re-categorize all transactions if keywords were modified
  let recategorizedCount = 0;
  if (keywordsChanged) {
    const currentTransactions = readTransactions();
    recategorizedCount = reCategorizeAllTransactions(currentTransactions, categories);
    if (recategorizedCount > 0) {
      writeTransactions([...currentTransactions]);
    }
  }
  
  res.json({ 
    message: 'Category updated', 
    category: categories[index],
    recategorizedCount: recategorizedCount || 0
  });
}));

// DELETE /api/categories/:id - Delete a category rule
router.delete('/categories/:id', asyncHandler(async (req, res) => {
  const categories = readCategories();
  const filtered = categories.filter(c => c.id !== req.params.id);
  
  if (filtered.length === categories.length) {
    return res.status(404).json({ error: 'Category not found' });
  }

  writeCategories(filtered);
  res.json({ message: 'Category deleted' });
}));

// POST /api/recategorize-all - Manually trigger full re-categorization of all transactions
router.post('/recategorize-all', asyncHandler(async (_req, res) => {
  const categories = readCategories();
  const transactions = readTransactions();
  
  if (!categories || !transactions) {
    return res.status(500).json({ error: 'Data not found' });
  }
  
  const recategorizedCount = reCategorizeAllTransactions(transactions, categories);
  writeTransactions(transactions);
  
  res.json({ 
    message: 'Re-categorization complete',
    recategorizedCount: recategorizedCount || 0
  });
}));

// POST /api/reset - Wipe all data (transactions and categories)
router.post('/reset', asyncHandler(async (_req, res) => {
  writeTransactions([]);
  writeCategories([]);
  
  res.json({ 
    message: 'All data has been reset',
  });
}));

export default router;
