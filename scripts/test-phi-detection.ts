/**
 * Test script to verify PHI field detection is working
 *
 * Run with: npx tsx scripts/test-phi-detection.ts
 */

import { ComplianceScanner, PHI_FIELD_PATTERNS } from '../lib/compliance';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Sample code with various PHI field patterns
const TEST_CODE_WITH_PHI = `
// Patient data interface
interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  ssn: string;
  dateOfBirth: Date;
  email: string;
  phoneNumber: string;
  address: string;
  zipCode: string;
  mrn: string;  // Medical Record Number
  diagnosis: string[];
  medications: string[];
  labResults: any[];
}

// API endpoint that handles patient data
export async function GET(req: Request) {
  const patientId = req.url.split('?patientId=')[1];

  // BAD: Logging PHI
  console.log('Fetching patient SSN:', patient.ssn);

  // BAD: PHI in URL
  const response = await fetch(\`/api/data?ssn=\${patient.ssn}\`);

  // BAD: Returning full patient object
  return Response.json(patient);
}

// Database query with PHI
async function getPatientBySSN(socialSecurityNumber: string) {
  // BAD: SQL with PHI in string
  const query = \`SELECT * FROM patients WHERE ssn = '\${socialSecurityNumber}'\`;
  return db.execute(query);
}

// Local storage (browser)
function savePatientLocally(patient: Patient) {
  // BAD: PHI in localStorage
  localStorage.setItem('patientSSN', patient.ssn);
  sessionStorage.setItem('patientDOB', patient.dateOfBirth.toString());
}

// Error handling
function handlePatientError(patient: Patient, error: Error) {
  // BAD: PHI in error message
  throw new Error(\`Failed to process patient \${patient.firstName} \${patient.lastName} with SSN \${patient.ssn}\`);
}

// Audit log (good example)
function auditPatientAccess(userId: string, patientId: string) {
  auditLogger.log({
    event: 'PHI_ACCESS',
    userId,
    resourceType: 'Patient',
    resourceId: patientId,
    timestamp: new Date().toISOString(),
  });
}
`;

async function runTest() {
  console.log('='.repeat(60));
  console.log('PHI DETECTION TEST');
  console.log('='.repeat(60));

  // Show available patterns
  console.log(`\nLoaded ${PHI_FIELD_PATTERNS.length} PHI field patterns:`);
  console.log(PHI_FIELD_PATTERNS.slice(0, 20).join(', ') + '...\n');

  // Create temp directory with test file
  const tempDir = path.join(os.tmpdir(), `phi-test-${Date.now()}`);
  await fs.promises.mkdir(tempDir, { recursive: true });

  const testFilePath = path.join(tempDir, 'test-patient-service.ts');
  await fs.promises.writeFile(testFilePath, TEST_CODE_WITH_PHI);

  console.log(`Created test file: ${testFilePath}\n`);

  try {
    // Run scanner
    const scanner = new ComplianceScanner({
      regulations: ['HIPAA'],
      minSeverity: 'low',
      autoAnnotate: true,
    });

    console.log('Running compliance scan...\n');
    const result = await scanner.scan(tempDir);

    // Display results
    console.log('='.repeat(60));
    console.log('SCAN RESULTS');
    console.log('='.repeat(60));

    console.log(`\nCompliance Score: ${result.summary.complianceScore}/100`);
    console.log(`Total Violations: ${result.summary.totalViolations}`);
    console.log(`  Critical: ${result.summary.bySeverity.critical}`);
    console.log(`  High: ${result.summary.bySeverity.high}`);
    console.log(`  Medium: ${result.summary.bySeverity.medium}`);
    console.log(`  Low: ${result.summary.bySeverity.low}`);

    console.log('\n' + '-'.repeat(60));
    console.log('VIOLATIONS FOUND:');
    console.log('-'.repeat(60));

    for (const violation of result.violations) {
      console.log(`\n[${violation.severity.toUpperCase()}] ${violation.ruleName}`);
      console.log(`  Rule: ${violation.ruleId}`);
      console.log(`  File: ${path.basename(violation.file)}:${violation.line}`);
      console.log(`  Category: ${violation.category}`);
      console.log(`  Message: ${violation.message}`);
      console.log(`  Auto-fix: ${violation.autoFixAvailable ? 'YES' : 'NO'}`);
    }

    console.log('\n' + '-'.repeat(60));
    console.log('PHI FIELDS DETECTED:');
    console.log('-'.repeat(60));

    for (const field of result.phiFields) {
      console.log(`\n  ${field.name}`);
      console.log(`    Type: ${field.type}`);
      console.log(`    Sensitivity: ${field.sensitivity}`);
      console.log(`    Location: ${path.basename(field.file)}:${field.line}`);
    }

    console.log('\n' + '-'.repeat(60));
    console.log('AUDIT REQUIREMENTS:');
    console.log('-'.repeat(60));

    for (const req of result.auditRequirements) {
      const status = req.implemented ? '✓' : '✗';
      console.log(`  ${status} ${req.eventType}: ${req.description}`);
    }

    console.log('\n' + '-'.repeat(60));
    console.log('RECOMMENDATIONS:');
    console.log('-'.repeat(60));

    for (const rec of result.recommendations.slice(0, 5)) {
      console.log(`\n  ${rec.priority}. ${rec.title} [${rec.estimatedEffort} effort]`);
      console.log(`     ${rec.description}`);
    }

    // Check what's missing
    console.log('\n' + '='.repeat(60));
    console.log('ANALYSIS:');
    console.log('='.repeat(60));

    // Check for specific PHI patterns we expect to find
    const expectedPatterns = ['ssn', 'firstName', 'lastName', 'dateOfBirth', 'email', 'phoneNumber', 'mrn', 'diagnosis', 'medications'];
    const foundInAnnotations = new Set(result.annotations.flatMap(a => a.phiFields || []));

    console.log('\nExpected PHI fields vs Found:');
    for (const pattern of expectedPatterns) {
      const found = foundInAnnotations.has(pattern.toLowerCase()) ||
                    result.annotations.some(a => a.phiFields?.some(f => f.toLowerCase().includes(pattern.toLowerCase())));
      console.log(`  ${pattern}: ${found ? '✓ FOUND' : '✗ MISSING'}`);
    }

    // Return summary for further analysis
    return {
      score: result.summary.complianceScore,
      violations: result.violations.length,
      phiFields: result.phiFields.length,
      auditRequirements: result.auditRequirements.filter(r => r.implemented).length,
      linesOfCode: result.summary.linesOfCode,
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
    console.log(`Final Score: ${summary.score}/100`);
    console.log(`Lines of Code: ${summary.linesOfCode}`);
    console.log(`Violations: ${summary.violations}`);
    console.log(`PHI Fields Detected: ${summary.phiFields}`);
    console.log(`Audit Requirements Met: ${summary.auditRequirements}/10`);

    if (summary.phiFields === 0) {
      console.log('\n⚠️  WARNING: No PHI fields detected! Detection may not be working correctly.');
    } else {
      console.log('\n✓ PHI detection is working correctly!');
    }
  })
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
