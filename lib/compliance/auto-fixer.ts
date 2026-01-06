/**
 * Compliance Auto-Fix Engine
 *
 * Automatically generates and applies fixes for compliance violations.
 * Supports both automatic fixes (safe transformations) and suggested fixes
 * (require human review).
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ComplianceViolation,
  ComplianceFix,
  AutoFixResult,
  ComplianceSeverity,
} from './types';

// ============================================================================
// TYPES
// ============================================================================

export interface FixStrategy {
  ruleId: string;
  name: string;
  description: string;
  canAutoFix: boolean;
  requiresReview: boolean;
  generateFix: (violation: ComplianceViolation, fileContent: string) => FixResult | null;
}

export interface FixResult {
  originalCode: string;
  fixedCode: string;
  explanation: string;
  imports?: string[];  // Additional imports needed
  reviewNotes?: string;
}

export interface ApplyFixOptions {
  dryRun?: boolean;
  backup?: boolean;
  validateAfter?: boolean;
}

// ============================================================================
// FIX STRATEGIES
// ============================================================================

const FIX_STRATEGIES: Map<string, FixStrategy> = new Map();

// -------------------------------------------------------------------------
// HIPAA-PHI-001: PHI in Console Logs
// -------------------------------------------------------------------------
FIX_STRATEGIES.set('HIPAA-PHI-001', {
  ruleId: 'HIPAA-PHI-001',
  name: 'Replace console.log with audit logger',
  description: 'Replaces PHI logging with HIPAA-compliant audit logging',
  canAutoFix: true,
  requiresReview: true,
  generateFix: (violation, fileContent) => {
    const lines = fileContent.split('\n');
    const line = lines[violation.line - 1];

    if (!line) return null;

    // Extract the PHI field being logged
    const phiMatch = line.match(/console\.(log|info|debug|warn|error)\s*\([^)]*\b(ssn|mrn|patient_id|first_name|last_name|dob|email|phone|address|diagnosis|medication)\b/i);
    if (!phiMatch) {
      // Generic console log replacement
      const fixedLine = line.replace(
        /console\.(log|info|debug|warn|error)\s*\([^)]*\)/,
        `auditLogger.log('PHI_ACCESS', { action: 'view', timestamp: new Date().toISOString() })`
      );
      return {
        originalCode: line.trim(),
        fixedCode: fixedLine.trim(),
        explanation: 'Replaced console logging with audit logger to prevent PHI exposure',
        imports: ["import { auditLogger } from '@/lib/audit-logger';"],
        reviewNotes: 'Ensure auditLogger is properly configured for HIPAA compliance',
      };
    }

    const phiField = phiMatch[2];
    const fixedLine = line.replace(
      /console\.(log|info|debug|warn|error)\s*\([^)]*\)/,
      `auditLogger.log('PHI_ACCESS', { field: '${phiField}', action: 'view', timestamp: new Date().toISOString() })`
    );

    return {
      originalCode: line.trim(),
      fixedCode: fixedLine.trim(),
      explanation: `Replaced console logging of ${phiField} with secure audit logging`,
      imports: ["import { auditLogger } from '@/lib/audit-logger';"],
      reviewNotes: 'Review audit log configuration and ensure PHI is not logged',
    };
  },
});

// -------------------------------------------------------------------------
// HIPAA-PHI-002: PHI in URL Parameters
// -------------------------------------------------------------------------
FIX_STRATEGIES.set('HIPAA-PHI-002', {
  ruleId: 'HIPAA-PHI-002',
  name: 'Move PHI from URL to POST body',
  description: 'Converts GET requests with PHI in URL to POST requests with encrypted body',
  canAutoFix: false,
  requiresReview: true,
  generateFix: (violation, fileContent) => {
    const lines = fileContent.split('\n');
    const line = lines[violation.line - 1];

    if (!line) return null;

    // Suggest conversion to POST
    return {
      originalCode: line.trim(),
      fixedCode: `// TODO: Convert to POST request with PHI in body
// Example: await fetch('/api/patient', {
//   method: 'POST',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify({ patientId: patient.id }),
// });`,
      explanation: 'PHI must not be passed in URL parameters. Use POST requests with encrypted body instead.',
      reviewNotes: 'Manually convert this to a POST request and update the API endpoint to accept POST',
    };
  },
});

// -------------------------------------------------------------------------
// HIPAA-PHI-004: PHI in LocalStorage/SessionStorage
// -------------------------------------------------------------------------
FIX_STRATEGIES.set('HIPAA-PHI-004', {
  ruleId: 'HIPAA-PHI-004',
  name: 'Remove PHI from browser storage',
  description: 'Removes PHI from localStorage/sessionStorage',
  canAutoFix: true,
  requiresReview: true,
  generateFix: (violation, fileContent) => {
    const lines = fileContent.split('\n');
    const line = lines[violation.line - 1];

    if (!line) return null;

    // Comment out the storage operation
    return {
      originalCode: line.trim(),
      fixedCode: `// REMOVED: PHI should not be stored in browser storage
// ${line.trim()}
// TODO: Store only session tokens in httpOnly secure cookies`,
      explanation: 'PHI must not be stored in browser storage. Use server-side storage with proper access controls.',
      reviewNotes: 'Consider using httpOnly secure cookies for session management only',
    };
  },
});

// -------------------------------------------------------------------------
// HIPAA-ENC-001: Hardcoded Encryption Keys
// -------------------------------------------------------------------------
FIX_STRATEGIES.set('HIPAA-ENC-001', {
  ruleId: 'HIPAA-ENC-001',
  name: 'Move key to environment variable',
  description: 'Replaces hardcoded encryption key with environment variable reference',
  canAutoFix: true,
  requiresReview: false,
  generateFix: (violation, fileContent) => {
    const lines = fileContent.split('\n');
    const line = lines[violation.line - 1];

    if (!line) return null;

    // Extract variable name
    const varMatch = line.match(/(const|let|var)\s+(\w+)\s*[:=]/);
    const varName = varMatch ? varMatch[2] : 'encryptionKey';
    const envVarName = varName.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();

    // Replace with env var
    const fixedLine = line.replace(
      /['"`][A-Za-z0-9+/=]{16,}['"`]/,
      `process.env.${envVarName}`
    );

    return {
      originalCode: line.trim(),
      fixedCode: fixedLine.trim(),
      explanation: `Moved hardcoded key to environment variable ${envVarName}`,
      reviewNotes: `Add ${envVarName} to your .env file and secrets management`,
    };
  },
});

// -------------------------------------------------------------------------
// HIPAA-ENC-002: Weak Encryption Algorithm
// -------------------------------------------------------------------------
FIX_STRATEGIES.set('HIPAA-ENC-002', {
  ruleId: 'HIPAA-ENC-002',
  name: 'Upgrade to strong encryption',
  description: 'Replaces weak algorithms (MD5, SHA1, DES) with HIPAA-compliant alternatives',
  canAutoFix: true,
  requiresReview: false,
  generateFix: (violation, fileContent) => {
    const lines = fileContent.split('\n');
    const line = lines[violation.line - 1];

    if (!line) return null;

    let fixedLine = line;

    // Replace MD5 with SHA-256
    if (line.includes('md5')) {
      fixedLine = line.replace(/['"]md5['"]/gi, "'sha256'");
    }
    // Replace SHA1 with SHA-256
    else if (line.includes('sha1')) {
      fixedLine = line.replace(/['"]sha1['"]/gi, "'sha256'");
    }
    // Replace DES with AES-256-GCM
    else if (line.match(/des|3des|des3/i)) {
      fixedLine = line.replace(/['"](?:des|3des|des3)['"]/gi, "'aes-256-gcm'");
    }

    if (fixedLine === line) return null;

    return {
      originalCode: line.trim(),
      fixedCode: fixedLine.trim(),
      explanation: 'Upgraded to HIPAA-compliant encryption algorithm',
    };
  },
});

// -------------------------------------------------------------------------
// HIPAA-ENC-003: Missing HTTPS
// -------------------------------------------------------------------------
FIX_STRATEGIES.set('HIPAA-ENC-003', {
  ruleId: 'HIPAA-ENC-003',
  name: 'Upgrade HTTP to HTTPS',
  description: 'Replaces http:// with https:// for external URLs',
  canAutoFix: true,
  requiresReview: false,
  generateFix: (violation, fileContent) => {
    const lines = fileContent.split('\n');
    const line = lines[violation.line - 1];

    if (!line) return null;

    // Don't fix localhost URLs
    if (line.includes('localhost') || line.includes('127.0.0.1') || line.includes('0.0.0.0')) {
      return null;
    }

    const fixedLine = line.replace(/http:\/\//g, 'https://');

    return {
      originalCode: line.trim(),
      fixedCode: fixedLine.trim(),
      explanation: 'Upgraded to HTTPS for secure transmission of PHI',
    };
  },
});

// -------------------------------------------------------------------------
// HIPAA-ENC-004: Unencrypted Database Connection
// -------------------------------------------------------------------------
FIX_STRATEGIES.set('HIPAA-ENC-004', {
  ruleId: 'HIPAA-ENC-004',
  name: 'Enable SSL on database connection',
  description: 'Adds SSL/TLS requirement to database connection strings',
  canAutoFix: true,
  requiresReview: true,
  generateFix: (violation, fileContent) => {
    const lines = fileContent.split('\n');
    const line = lines[violation.line - 1];

    if (!line) return null;

    let fixedLine = line;

    // PostgreSQL
    if (line.includes('postgres://') || line.includes('postgresql://')) {
      if (!line.includes('sslmode=') && !line.includes('ssl=')) {
        fixedLine = line.includes('?')
          ? line.replace(/(['"])$/, '&sslmode=require$1')
          : line.replace(/(['"])$/, '?sslmode=require$1');
      }
    }
    // MySQL
    else if (line.includes('mysql://')) {
      if (!line.includes('ssl')) {
        fixedLine = line.includes('?')
          ? line.replace(/(['"])$/, '&ssl=true$1')
          : line.replace(/(['"])$/, '?ssl=true$1');
      }
    }
    // MongoDB
    else if (line.includes('mongodb://') || line.includes('mongodb+srv://')) {
      if (!line.includes('ssl=') && !line.includes('tls=')) {
        fixedLine = line.includes('?')
          ? line.replace(/(['"])$/, '&tls=true$1')
          : line.replace(/(['"])$/, '?tls=true$1');
      }
    }
    // ssl: false → ssl: true
    else if (line.match(/ssl\s*:\s*(false|0)/)) {
      fixedLine = line.replace(/ssl\s*:\s*(false|0)/, 'ssl: true');
    }

    if (fixedLine === line) return null;

    return {
      originalCode: line.trim(),
      fixedCode: fixedLine.trim(),
      explanation: 'Enabled SSL/TLS encryption for database connection',
      reviewNotes: 'Ensure your database server has SSL configured and certificates are valid',
    };
  },
});

// -------------------------------------------------------------------------
// HIPAA-ACC-003: Missing Session Timeout
// -------------------------------------------------------------------------
FIX_STRATEGIES.set('HIPAA-ACC-003', {
  ruleId: 'HIPAA-ACC-003',
  name: 'Set HIPAA-compliant session timeout',
  description: 'Sets session timeout to 15 minutes as recommended by HIPAA',
  canAutoFix: true,
  requiresReview: false,
  generateFix: (violation, fileContent) => {
    const lines = fileContent.split('\n');
    const line = lines[violation.line - 1];

    if (!line) return null;

    // Replace long/infinite timeout with 15 minutes
    const fixedLine = line.replace(
      /(maxAge|expires)\s*[:=]\s*(\d{8,}|Infinity|null|undefined)/,
      '$1: 15 * 60 * 1000 // 15 minutes - HIPAA compliant'
    );

    if (fixedLine === line) return null;

    return {
      originalCode: line.trim(),
      fixedCode: fixedLine.trim(),
      explanation: 'Set session timeout to 15 minutes for HIPAA compliance',
    };
  },
});

// -------------------------------------------------------------------------
// HIPAA-INT-002: SQL Injection Risk
// -------------------------------------------------------------------------
FIX_STRATEGIES.set('HIPAA-INT-002', {
  ruleId: 'HIPAA-INT-002',
  name: 'Convert to parameterized query',
  description: 'Converts string interpolation in SQL to parameterized queries',
  canAutoFix: false,
  requiresReview: true,
  generateFix: (violation, fileContent) => {
    const lines = fileContent.split('\n');
    const line = lines[violation.line - 1];

    if (!line) return null;

    return {
      originalCode: line.trim(),
      fixedCode: `// TODO: Convert to parameterized query
// Example: db.query('SELECT * FROM patients WHERE id = $1', [patientId])`,
      explanation: 'SQL queries must use parameterized queries to prevent injection attacks',
      reviewNotes: 'Manually convert to parameterized query or use an ORM like Prisma',
    };
  },
});

// ============================================================================
// AUTO-FIXER CLASS
// ============================================================================

export class ComplianceAutoFixer {
  private strategies: Map<string, FixStrategy>;

  constructor() {
    this.strategies = FIX_STRATEGIES;
  }

  /**
   * Generate fix for a single violation
   */
  generateFix(violation: ComplianceViolation, fileContent: string): ComplianceFix | null {
    const strategy = this.strategies.get(violation.ruleId);

    if (!strategy) {
      return null;
    }

    const result = strategy.generateFix(violation, fileContent);

    if (!result) {
      return null;
    }

    return {
      violationId: violation.id,
      file: violation.file,
      originalCode: result.originalCode,
      fixedCode: result.fixedCode,
      explanation: result.explanation,
      regulations: violation.regulations,
      requiresReview: strategy.requiresReview,
      reviewNotes: result.reviewNotes,
    };
  }

  /**
   * Generate fixes for multiple violations
   */
  generateFixes(violations: ComplianceViolation[], fileContents: Map<string, string>): ComplianceFix[] {
    const fixes: ComplianceFix[] = [];

    for (const violation of violations) {
      const fileContent = fileContents.get(violation.file);
      if (!fileContent) continue;

      const fix = this.generateFix(violation, fileContent);
      if (fix) {
        fixes.push(fix);
      }
    }

    return fixes;
  }

  /**
   * Apply fixes to files
   */
  async applyFixes(fixes: ComplianceFix[], options: ApplyFixOptions = {}): Promise<AutoFixResult> {
    const { dryRun = false, backup = true } = options;

    const result: AutoFixResult = {
      success: true,
      fixesApplied: 0,
      fixesFailed: 0,
      fixes: [],
      errors: [],
    };

    // Group fixes by file
    const fixesByFile = new Map<string, ComplianceFix[]>();
    for (const fix of fixes) {
      const existing = fixesByFile.get(fix.file) || [];
      existing.push(fix);
      fixesByFile.set(fix.file, existing);
    }

    // Apply fixes file by file
    for (const [filePath, fileFixes] of fixesByFile.entries()) {
      try {
        let content = await fs.promises.readFile(filePath, 'utf-8');
        const originalContent = content;

        // Create backup if requested
        if (backup && !dryRun) {
          await fs.promises.writeFile(`${filePath}.backup`, content);
        }

        // Sort fixes by line number (descending) to apply from bottom to top
        // This prevents line number shifts from affecting subsequent fixes
        const sortedFixes = [...fileFixes].sort((a, b) => {
          const lineA = this.extractLineNumber(a, content);
          const lineB = this.extractLineNumber(b, content);
          return lineB - lineA;
        });

        // Apply each fix
        for (const fix of sortedFixes) {
          // Skip fixes that require review in auto mode
          if (fix.requiresReview && !options.validateAfter) {
            continue;
          }

          const newContent = content.replace(fix.originalCode, fix.fixedCode);

          if (newContent !== content) {
            content = newContent;
            result.fixes.push(fix);
            result.fixesApplied++;
          } else {
            // Code may have changed or fix couldn't be applied
            result.errors.push(`Could not apply fix for ${fix.violationId} - original code not found`);
            result.fixesFailed++;
          }
        }

        // Write file if not dry run and changes were made
        if (!dryRun && content !== originalContent) {
          await fs.promises.writeFile(filePath, content);
        }

      } catch (error) {
        result.success = false;
        result.errors.push(`Failed to process ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.fixesFailed += fileFixes.length;
      }
    }

    return result;
  }

  /**
   * Preview fixes without applying them
   */
  previewFixes(fixes: ComplianceFix[]): string {
    let preview = '# Compliance Fix Preview\n\n';

    for (const fix of fixes) {
      preview += `## ${fix.violationId}\n`;
      preview += `**File:** ${fix.file}\n`;
      preview += `**Requires Review:** ${fix.requiresReview ? 'Yes' : 'No'}\n\n`;
      preview += `### Original Code\n\`\`\`\n${fix.originalCode}\n\`\`\`\n\n`;
      preview += `### Fixed Code\n\`\`\`\n${fix.fixedCode}\n\`\`\`\n\n`;
      preview += `**Explanation:** ${fix.explanation}\n`;
      if (fix.reviewNotes) {
        preview += `**Review Notes:** ${fix.reviewNotes}\n`;
      }
      preview += '\n---\n\n';
    }

    return preview;
  }

  /**
   * Get available fix strategies
   */
  getAvailableStrategies(): FixStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Check if a rule has an auto-fix available
   */
  hasAutoFix(ruleId: string): boolean {
    return this.strategies.has(ruleId);
  }

  private extractLineNumber(fix: ComplianceFix, content: string): number {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(fix.originalCode.split('\n')[0])) {
        return i + 1;
      }
    }
    return 0;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const autoFixer = new ComplianceAutoFixer();

export async function generateAndPreviewFixes(
  violations: ComplianceViolation[],
  projectPath: string
): Promise<{ fixes: ComplianceFix[]; preview: string }> {
  const fixer = new ComplianceAutoFixer();

  // Read all affected files
  const fileContents = new Map<string, string>();
  const uniqueFiles = [...new Set(violations.map(v => v.file))];

  for (const file of uniqueFiles) {
    try {
      const content = await fs.promises.readFile(file, 'utf-8');
      fileContents.set(file, content);
    } catch (error) {
      console.warn(`Could not read file: ${file}`);
    }
  }

  const fixes = fixer.generateFixes(violations, fileContents);
  const preview = fixer.previewFixes(fixes);

  return { fixes, preview };
}

export async function applyComplianceFixes(
  violations: ComplianceViolation[],
  options: ApplyFixOptions = {}
): Promise<AutoFixResult> {
  const fixer = new ComplianceAutoFixer();

  // Read all affected files
  const fileContents = new Map<string, string>();
  const uniqueFiles = [...new Set(violations.map(v => v.file))];

  for (const file of uniqueFiles) {
    try {
      const content = await fs.promises.readFile(file, 'utf-8');
      fileContents.set(file, content);
    } catch (error) {
      console.warn(`Could not read file: ${file}`);
    }
  }

  const fixes = fixer.generateFixes(violations, fileContents);
  return fixer.applyFixes(fixes, options);
}
