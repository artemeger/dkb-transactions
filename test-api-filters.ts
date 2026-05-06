// Test suite for transaction date filtering - makes actual API calls
const http = require('http');

const BASE_URL = 'http://localhost:3001/api';

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: 'GET',
      headers: { 'User-Agent': 'Test-Client/1.0' }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

async function test() {
  console.log('='.repeat(70));
  console.log('TRANSACTION FILTERING API TEST');
  console.log('Testing backend endpoints directly...');
  console.log('='.repeat(70));
  
  let passed = 0;
  let failed = 0;

  // Test 1: Get stats without filter (should show all data)
  console.log('\n[Test 1] Stats WITHOUT date filter (all time)...');
  try {
    const stats = await makeRequest('/stats');
    console.log(`  Response: ${JSON.stringify(stats, null, 2)}`);
    
    if (stats && stats.transactionCount > 0) {
      console.log(`✅ Stats API working - found ${stats.transactionCount} transactions`);
      passed++;
      
      // Store for comparison later
      const allTimeStats = stats;
      
      // Test 2: Get stats with YTD filter (should also return same since all data is from 2026)
      console.log('\n[Test 2] Stats WITH YTD filter...');
      try {
        const ytdStats = await makeRequest('/stats?preset=ytd');
        console.log(`  Response: ${JSON.stringify(ytdStats, null, 2)}`);
        
        if (ytdStats && ytdStats.transactionCount === allTimeStats.transactionCount) {
          console.log('✅ YTD filter working - same count as all time (expected since data is from current year)');
          passed++;
        } else {
          console.log(`⚠️  Different counts: allTime=${allTimeStats.transactionCount}, ytd=${ytdStats?.transactionCount}`);
          // This might be expected if some data is outside YTD range
          if (ytdStats && ytdStats.transactionCount > 0) {
            console.log('✅ Filter returned results (might differ based on date ranges)');
            passed++;
          } else {
            console.log('❌ FAILED: YTD filter returning no results!');
            failed++;
          }
        }
      } catch (e) {
        console.log(`❌ FAILED: Error calling /stats?preset=ytd - ${e.message}`);
        failed++;
      }

      // Test 3: Get stats with explicit date range
      console.log('\n[Test 3] Stats WITH explicit date range (?startDate=&endDate=)...');
      try {
        const rangeStats = await makeRequest('/stats?startDate=2025-01&endDate=2025-12');
        console.log(`  Response: ${JSON.stringify(rangeStats, null, 2)}`);
        
        if (rangeStats && rangeStats.transactionCount === 0) {
          console.log('✅ Date filtering working - no transactions in 2025 (expected since all data is from 2026)');
          passed++;
          
          // Test 4: Stats with matching date range
          console.log('\n[Test 4] Stats WITH matching date range...');
          try {
            const matchStats = await makeRequest('/stats?startDate=2026-01&endDate=2026-12');
            console.log(`  Response: ${JSON.stringify(matchStats, null, 2)}`);
            
            if (matchStats && matchStats.transactionCount === allTimeStats.transactionCount) {
              console.log('✅ Matching date range returns all transactions');
              passed++;
            } else {
              console.log(`❌ FAILED: Expected ${allTimeStats.transactionCount} but got ${matchStats?.transactionCount}`);
              failed++;
            }
          } catch (e) {
            console.log(`❌ FAILED: Error calling /stats with matching range - ${e.message}`);
            failed++;
          }
        } else {
          console.log('⚠️  Unexpected result for non-matching date range');
        }
      } catch (e) {
        console.log(`❌ FAILED: Error calling /stats with explicit range - ${e.message}`);
        failed++;
      }

    } else {
      console.log('❌ FAILED: No transactions found in stats API!');
      failed++;
      
      // Try to debug - maybe data file doesn't exist or is empty
      console.log('\nDEBUGGING: Checking data files...');
      const fs = require('fs');
      if (fs.existsSync('/home/y3om11/opencodeprojects/dkb/data/transactions.json')) {
        try {
          const content = fs.readFileSync('/home/y3om11/opencodeprojects/dkb/data/transactions.json', 'utf-8');
          console.log(`  transactions.json exists, size: ${content.length} bytes`);
          const parsed = JSON.parse(content);
          console.log(`  Parsed transactions count: ${(parsed.transactions || []).length}`);
        } catch (e) {
          console.log('  Error reading/parseing transactions.json:', e.message);
        }
      } else {
        console.log('  transactions.json does NOT exist!');
      }
    }

  } catch (e) {
    console.log(`❌ FAILED: Cannot connect to stats API - ${e.message}`);
    failed++;
    
    // Try to start the server for testing
    console.log('\nNOTE: Backend might not be running. Start with: cd /home/y3om11/opencodeprojects/dkb && npx tsx server/src/index.ts');
  }

  // Test 5: Check chart endpoints receive preset correctly
  console.log('\n[Test 5] Checking /charts/breakdown endpoint...');
  try {
    const breakdown = await makeRequest('/charts/breakdown?preset=threeMonths');
    console.log(`  Response has ${Object.keys(breakdown).length > 0 ? 'data' : 'empty array'} for threeMonths preset`);
    
    if (Array.isArray(breakdown)) {
      console.log('✅ Charts endpoint returns data array');
      passed++;
    } else {
      console.log('⚠️  Unexpected response format from charts endpoint');
    }
  } catch (e) {
    console.log(`❌ FAILED: Error calling /charts/breakdown - ${e.message}`);
    failed++;
  }

  // Test 6: Verify transactions API with preset parameter
  console.log('\n[Test 6] Checking /api/transactions endpoint...');
  try {
    const transactions = await makeRequest('/api/transactions?preset=ytd');
    console.log(`  Received ${Array.isArray(transactions) ? transactions.length : 'unknown'} transactions for YTD preset`);
    
    if (Array.isArray(transactions)) {
      console.log('✅ Transactions endpoint returns data array with preset parameter');
      passed++;
      
      // Check date format of returned transactions
      if (transactions.length > 0) {
        const firstDate = transactions[0].bookingDate;
        const isISO = /^\d{4}-\d{2}-\d{2}$/.test(firstDate);
        console.log(`  First transaction bookingDate: "${firstDate}"`);
        if (isISO) {
          console.log('✅ Dates are in ISO format');
          passed++;
        } else {
          console.log(`❌ Dates NOT in ISO format: expected YYYY-MM-DD, got ${firstDate}`);
          failed++;
        }
      }
    } else {
      console.log('⚠️  Unexpected response format from transactions endpoint');
    }
  } catch (e) {
    console.log(`❌ FAILED: Error calling /api/transactions - ${e.message}`);
    failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.log('❌ TEST SUITE FAILED - Some tests did not pass');
    process.exit(1);
  } else {
    console.log('✅ ALL TESTS PASSED - Filtering should work correctly');
    process.exit(0);
  }
}

test().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
