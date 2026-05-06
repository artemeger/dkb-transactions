import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import transactionsRouter from './routes/transactions.js';
import chartsRouter from './routes/charts.js';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer config for direct file upload endpoint - use system temp dir for AppImage compatibility
const uploadDir = path.join(os.tmpdir(), 'dkb-uploads');
fsSync.mkdirSync(uploadDir, { recursive: true });
const multerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `dev-upload-${Date.now()}-${file.originalname}`),
});
const directUpload = multer({ storage: multerStorage });

// Direct file upload endpoint for dev mode (when Vite proxy can't handle multipart)
app.post('/api/import', directUpload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const content = await fs.readFile(req.file.path, 'utf-8');
    
    // Clean up uploaded file immediately after reading
    await fs.unlink(req.file.path);

    // Import all necessary modules dynamically to avoid circular dependencies
    const { parseDkbCsv } = await import('./services/csvParser.js');
    const parsed = parseDkbCsv(content);
    
    const { readTransactions, writeTransactions, readCategories } = await import('./services/storage.js');
    const existingTransactions = readTransactions();
    
    const { generateTransactionFingerprint, generateImportDataFingerprint } = await import('./utils/transactionFingerprint.js');
    const { categorizeTransactions } = await import('./services/categorizer.js');

    // Build fingerprint set from ALL existing transactions for comprehensive deduplication
    const existingFingerprints = new Set<string>();
    const existingIds = new Set<string>();
    
    existingTransactions.forEach((t: any) => {
      if (t.id) existingIds.add(t.id);
      
      // Use the same fingerprint logic as for import data to ensure consistency
      const fp = generateTransactionFingerprint(t);
      existingFingerprints.add(fp);
    });

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
      
      return !existingFingerprints.has(fp);
    });

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
    try { await fs.unlink(req.file.path); } catch {}
    
    console.error('Failed to read or parse CSV:', err);
    res.status(500).json({ error: 'Failed to process uploaded file', details: String(err) });
  }
});

// API Routes (after direct import endpoint so it takes precedence)
app.use('/api', transactionsRouter);
app.use('/api', chartsRouter);

// Serve static files in production (client build)
const __dirname_server = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname_server, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  
  // Keep the process alive - prevent Node from exiting when event loop is idle
  const keepAlive = setInterval(() => {}, 3600000);
  if (keepAlive.unref) keepAlive.unref();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...');
  server.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down...');
  server.close();
  process.exit(0);
});
