/**
 * Code-to-Compliance Pipeline
 *
 * Healthcare compliance scanning for HIPAA, HITECH, HITRUST, and related regulations.
 *
 * @example
 * ```typescript
 * import { scanProject, generateHTMLReport } from '@/lib/compliance';
 *
 * const result = await scanProject('/path/to/project', {
 *   regulations: ['HIPAA'],
 *   minSeverity: 'medium',
 * });
 *
 * console.log(`Compliance Score: ${result.summary.complianceScore}`);
 * console.log(`Violations: ${result.summary.totalViolations}`);
 *
 * const htmlReport = generateHTMLReport(result, {
 *   companyName: 'Ochsner Health',
 *   projectName: 'Patient Portal',
 * });
 * ```
 */

// Types
export * from './types';

// HIPAA Rules
export {
  HIPAA_RULES,
  HIPAA_REFS,
  PHI_FIELD_PATTERNS,
  getRuleById,
  getRulesByCategory,
  getRulesBySeverity,
  getCriticalRules,
  getAutoFixableRules,
} from './hipaa-rules';

// Scanner
export {
  ComplianceScanner,
  scanProject,
  formatViolation,
  generateComplianceComment,
} from './compliance-scanner';

// Report Generator
export {
  ComplianceReportGenerator,
  generateReport,
  generateHTMLReport,
  generateSARIFReport,
  generateMarkdownReport,
} from './report-generator';

export type { ReportFormat, ReportOptions } from './report-generator';

// Auto-Fixer
export {
  ComplianceAutoFixer,
  autoFixer,
  generateAndPreviewFixes,
  applyComplianceFixes,
} from './auto-fixer';

export type { FixStrategy, FixResult, ApplyFixOptions } from './auto-fixer';
