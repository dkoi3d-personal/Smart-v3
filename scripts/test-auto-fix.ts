/**
 * Test script to verify auto-fix functionality
 *
 * Run with: npx tsx scripts/test-auto-fix.ts
 */

import { ComplianceScanner } from '../lib/compliance';
import { ComplianceAutoFixer } from '../lib/compliance/auto-fixer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Sample code with fixable issues
const TEST_CODE = `
// Patient API with compliance issues
const encryptionKey = 'MyHardcodedSecretKey12345678901234';

// Using weak hash
const hash = crypto.createHash('md5').update(data).digest('hex');

// HTTP instead of HTTPS
const apiUrl = 'http://api.hospital.com/patients';

// Database without SSL
const dbUrl = 'postgres://user:pass@host:5432/patientdb';

// Session with infinite timeout
const session = { maxAge: Infinity };

// Logging PHI
console.log('Patient SSN:', patient.ssn);

// PHI in localStorage
localStorage.setItem('patientSSN', patient.ssn);
`;

async function runTest() {
  console.log('='.repeat(60));
  console.log('AUTO-FIX TEST');
  console.log('='.repeat(60));

  // Create temp directory with test file
  const tempDir = path.join(os.tmpdir(), `autofix-test-${Date.now()}`);
  await fs.promises.mkdir(tempDir, { recursive: true });

  const testFilePath = path.join(tempDir, 'test-api.ts');
  await fs.promises.writeFile(testFilePath, TEST_CODE);

  console.log(`Created test file: ${testFilePath}\n`);

  try {
    // Run scanner to get violations
    const scanner = new ComplianceScanner({
      regulations: ['HIPAA'],
      minSeverity: 'low',
    });

    console.log('Running compliance scan...\n');
    const result = await scanner.scan(tempDir);

    console.log(`Found ${result.violations.length} violations\n`);

    // Generate fixes
    const fixer = new ComplianceAutoFixer();
    const fileContents = new Map<string, string>();
    fileContents.set(testFilePath, TEST_CODE);

    console.log('-'.repeat(60));
    console.log('GENERATING FIXES:');
    console.log('-'.repeat(60));

    const fixes = fixer.generateFixes(result.violations, fileContents);

    for (const fix of fixes) {
      console.log(`\n[${fix.violationId.split('_')[0]}]`);
      console.log(`  File: ${path.basename(fix.file)}`);
      console.log(`  Requires Review: ${fix.requiresReview ? 'YES' : 'NO'}`);
      console.log(`  Original: ${fix.originalCode.substring(0, 50)}...`);
      console.log(`  Fixed: ${fix.fixedCode.substring(0, 50)}...`);
      console.log(`  Explanation: ${fix.explanation}`);
    }

    console.log('\n' + '-'.repeat(60));
    console.log('FIX PREVIEW (Markdown):');
    console.log('-'.repeat(60));

    const preview = fixer.previewFixes(fixes.slice(0, 3)); // Show first 3
    console.log(preview.substring(0, 1000) + '...\n');

    // Apply fixes (dry run)
    console.log('-'.repeat(60));
    console.log('APPLYING FIXES (Dry Run):');
    console.log('-'.repeat(60));

    const applyResult = await fixer.applyFixes(fixes, { dryRun: true });

    console.log(`\nSuccess: ${applyResult.success}`);
    console.log(`Fixes Applied: ${applyResult.fixesApplied}`);
    console.log(`Fixes Failed: ${applyResult.fixesFailed}`);

    if (applyResult.errors.length > 0) {
      console.log(`Errors:`);
      for (const err of applyResult.errors) {
        console.log(`  - ${err}`);
      }
    }

    // Show available strategies
    console.log('\n' + '-'.repeat(60));
    console.log('AVAILABLE FIX STRATEGIES:');
    console.log('-'.repeat(60));

    const strategies = fixer.getAvailableStrategies();
    for (const strategy of strategies) {
      const autoIcon = strategy.canAutoFix ? '✓' : '✗';
      const reviewIcon = strategy.requiresReview ? '👁' : '';
      console.log(`  ${autoIcon} ${strategy.ruleId}: ${strategy.name} ${reviewIcon}`);
    }

    return {
      violations: result.violations.length,
      fixesGenerated: fixes.length,
      fixesApplied: applyResult.fixesApplied,
    };

  } finally {
    // Cleanup
    await fs.promises.rm(tempDir, { recursive: true, force: true });
    console.log('\nTest cleanup complete.');
  }
}

// Run the test
runTest()
  .then(summary => {
    console.log('\n' + '='.repeat(60));
    console.log('TEST COMPLETE');
    console.log('='.repeat(60));
    console.log(`Violations Found: ${summary.violations}`);
    console.log(`Fixes Generated: ${summary.fixesGenerated}`);
    console.log(`Fixes Applied (Dry Run): ${summary.fixesApplied}`);

    if (summary.fixesGenerated > 0) {
      console.log('\n✓ Auto-fix engine is working correctly!');
    } else {
      console.log('\n⚠️ No fixes were generated. Check violation matching.');
    }
  })
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
