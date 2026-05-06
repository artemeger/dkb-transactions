import type { Transaction, CategoryRule } from '../types/transaction.js';
import { v4 as uuidv4 } from 'uuid';

// Normalize text for better matching: lowercase, remove special chars except German umlauts
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\säöüÄÖÜß]/g, ' ')  // Replace non-word chars (except German) with space
    .replace(/\s+/g, ' ')             // Collapse multiple spaces
    .trim();
}

// Minimum score required to override "Sonstige" category
const SONSTIGE_OVERRIDE_THRESHOLD = 8;

// Score a single keyword match against text - higher score = better match
function scoreKeywordMatch(text: string, keyword: string): number {
  const normalizedText = normalizeText(text);
  const normalizedKeyword = keyword.toLowerCase().replace(/\s+/g, '');
  
  // Exact full match (case-insensitive) - highest score
  if (normalizedText === normalizedKeyword) return 10;
  
  // Keyword is a complete word within the text - high score
  const words = normalizedText.split(/\s+/);
  for (const word of words) {
    if (word === normalizedKeyword) return 8;
    
    // Only match if there's actual substring containment, not just length difference
    if (word.includes(normalizedKeyword)) {
      // Word contains keyword - score based on specificity
      // Higher score for exact matches or near-exact containment
      const ratio = normalizedKeyword.length / word.length;
      return Math.round(5 + ratio * 3); // Range: ~5-8 based on how much of the word is matched
    }
  }
  
  // Text contains keyword as substring (but not as a complete word) - medium score
  if (normalizedText.includes(normalizedKeyword)) {
    const ratio = normalizedKeyword.length / normalizedText.length;
    return Math.round(3 + ratio * 2); // Range: ~3-5 based on coverage
  }
  
  return 0;
}

// Calculate total score for a category based on all its keywords
function calculateCategoryScore(transaction: Omit<Transaction, 'id' | 'category'>, category: CategoryRule): number {
  if (!category.keywords || category.keywords.length === 0) return 0;
  
  const payee = transaction.payee;
  const description = transaction.description;
  let totalScore = 0;
  
  for (const keyword of category.keywords) {
    // Score matches in both fields separately, with higher weight for payee
    const payeeScore = scoreKeywordMatch(payee, keyword);
    const descScore = scoreKeywordMatch(description, keyword);
    
    // Take the maximum of payee and description scores (payee weighted higher)
    totalScore += Math.max(payeeScore * 1.5, descScore);
  }
  
  return totalScore;
}

// Find the best matching category by scoring all categories
function findBestCategory(transaction: Omit<Transaction, 'id' | 'category'>, categories: CategoryRule[]): string {
  let bestMatch = '';
  let highestScore = 0;
  
  for (const category of categories) {
    const score = calculateCategoryScore(transaction, category);
    
    if (score > highestScore) {
      // Only override Sonstige if we have a strong match above threshold
      if (score >= SONSTIGE_OVERRIDE_THRESHOLD || bestMatch === '') {
        // Require minimum meaningful match for first assignment
        if (highestScore === 0 && score < SONSTIGE_OVERRIDE_THRESHOLD * 0.5) continue;
        bestMatch = category.name;
        highestScore = score;
      }
    }
  }

  // Always fallback to "Sonstige" or uncategorized - never leave unclassified
  const other = categories.find(c => c.name === 'Sonstige');
  return bestMatch || (other ? other.name : 'Sonstige');
}

export function categorizeTransaction(
  transaction: Omit<Transaction, 'id' | 'category'>,
  categories: CategoryRule[]
): string {
  return findBestCategory(transaction, categories);
}

export function categorizeTransactions(
  transactions: Omit<Transaction, 'id' | 'category'>[],
  categories: CategoryRule[]
): (Transaction & { id: string })[] {
  return transactions.map(t => ({
    ...t,
    category: categorizeTransaction(t, categories),
    id: uuidv4(),
  }));
}

// Re-categorize all existing transactions using current category rules
export function reCategorizeAllTransactions(
  transactions: Transaction[],
  categories: CategoryRule[]
): number {
  let recategorizedCount = 0;
  
  for (const transaction of transactions) {
    const newCategory = categorizeTransaction(transaction, categories);
    
    // Only update if the category actually changed
    if (transaction.category !== newCategory) {
      (transaction as any).category = newCategory;
      recategorizedCount++;
    }
  }
  
  return recategorizedCount;
}
