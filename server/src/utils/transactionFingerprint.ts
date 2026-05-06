/**
 * Transaction fingerprint utility for duplicate detection.
 * Generates a hash from key transaction attributes to identify duplicates.
 */

import type { Transaction } from '../types/transaction.js';

// Normalization config for consistent fingerprint generation
const NORMALIZATION_CONFIG = {
  trimWhitespace: true,
  lowercaseText: true,
};

/**
 * Normalize a string for comparison.
 * Trims whitespace and lowercases text for case-insensitive matching.
 */
function normalizeString(str: string): string {
  let normalized = str.trim();
  if (NORMALIZATION_CONFIG.lowercaseText) {
    normalized = normalized.toLowerCase();
  }
  // Collapse multiple spaces into single space
  return normalized.replace(/\s+/g, ' ');
}

/**
 * Normalize a date string to YYYY-MM-DD format.
 */
function normalizeDate(dateStr: string): string {
  // Remove any non-standard characters and ensure consistent format
  const cleaned = dateStr.trim().replace(/[./-]/g, '-');
  
  // Handle DD-MM-YYYY or similar formats
  if (/^\d{2}-\d{2}-\d{4}$/.test(cleaned)) {
    return `${cleaned.substring(6)}-${cleaned.substring(3, 5)}-${cleaned.substring(0, 2)}`;
  }
  
  // Return as-is if already YYYY-MM-DD or couldn't normalize
  return cleaned;
}

/**
 * Generate a fingerprint for an imported transaction (from CSV).
 * Uses IBAN + date + amount + counterpart + description since we have full data.
 */
export function generateImportedTransactionFingerprint(
  bookingDate: string,
  iban: string,
  amount: number,
  counterparty: string, // payee OR payer depending on transaction type
  description?: string   // optional description for better uniqueness
): string {
  const date = normalizeDate(bookingDate);
  const ibanNormalized = normalizeString(iban);
  const amountStr = Math.abs(amount).toFixed(2).replace('.', ''); // Remove decimal for consistency
  const counterpart = normalizeString(counterparty);
  const desc = description ? normalizeString(description) : '';
  
  return `${date}|${ibanNormalized}|${amountStr}|${counterpart}${desc ? '|' + desc : ''}`;
}

/**
 * Generate a fingerprint for a manually added transaction.
 * Uses date + amount + payee + description since we lack IBAN.
 */
export function generateManualTransactionFingerprint(
  bookingDate: string,
  amount: number,
  payee: string,
  description: string
): string {
  const date = normalizeDate(bookingDate);
  const amountStr = Math.abs(amount).toFixed(2).replace('.', '');
  const payeeNormalized = normalizeString(payee);
  const descNormalized = normalizeString(description);
  
  return `${date}|${amountStr}|${payeeNormalized}|${descNormalized}`;
}

/**
 * Generate a fingerprint from an existing transaction object.
 */
export function generateTransactionFingerprint(transaction: Transaction): string {
  if (transaction.iban && transaction.iban.trim()) {
    // Use IBAN-based fingerprint for imported transactions
    const counterparty = transaction.type === 'Eingang' ? transaction.payer : transaction.payee;
    return generateImportedTransactionFingerprint(
      transaction.bookingDate,
      transaction.iban,
      transaction.amount,
      counterparty,
      transaction.description  // include description for consistent fingerprinting
    );
  } else {
    // Use manual entry fingerprint for non-imported transactions
    return generateManualTransactionFingerprint(
      transaction.bookingDate,
      transaction.amount,
      transaction.payee || transaction.payer || '',
      transaction.description
    );
  }
}

/**
 * Generate a fingerprint from raw import data (before full conversion).
 */
export function generateImportDataFingerprint(
  bookingDate: string,
  amount: number,
  payee?: string,
  payer?: string,
  iban?: string,
  description?: string
): string {
  if (iban && iban.trim()) {
    // For imported transactions with IBAN: use correct counterparty based on transaction direction
    const isIncome = amount >= 0;
    const counterparty = isIncome ? payer : payee;
    return generateImportedTransactionFingerprint(bookingDate, iban, amount, counterparty || '', description);
  } else {
    // For manual entries without IBAN: use payee + description
    const counterpart = payee || payer || '';
    const desc = description || '';
    return generateManualTransactionFingerprint(bookingDate, amount, counterpart, desc);
  }
}

/**
 * Check if a transaction is a potential duplicate against existing fingerprints.
 */
export function isDuplicateTransaction(
  fingerprint: string,
  existingFingerprints: Set<string>,
  toleranceSeconds?: number // Allow matching within this time window (default: 1 hour)
): boolean {
  return existingFingerprints.has(fingerprint);
}
