/**
 * Code-to-Compliance Pipeline - Type Definitions
 *
 * This module defines all types for the healthcare compliance scanning system.
 * Supports HIPAA, HITRUST, FDA 21 CFR Part 11, and state-specific regulations.
 */

// ============================================================================
// REGULATION DEFINITIONS
// ============================================================================

export type RegulationType =
  | 'HIPAA'
  | 'HITECH'
  | 'HITRUST'
  | 'FDA_21_CFR_11'
  | '42_CFR_PART_2'
  | 'GINA'
  | 'STATE_CCPA'
  | 'STATE_TX_HB300'
  | 'STATE_NY_SHIELD';

export type HIPAASection =
  | '164.312(a)(1)'   // Access Control
  | '164.312(a)(2)'   // Access Control - Implementation
  | '164.312(b)'      // Audit Controls
  | '164.312(c)(1)'   // Integrity
  | '164.312(c)(2)'   // Integrity - Mechanism
  | '164.312(d)'      // Authentication
  | '164.312(e)(1)'   // Transmission Security
  | '164.312(e)(2)'   // Transmission Security - Encryption
  | '164.308(a)(1)'   // Security Management
  | '164.308(a)(3)'   // Workforce Security
  | '164.308(a)(4)'   // Information Access Management
  | '164.308(a)(5)'   // Security Awareness
  | '164.310(a)(1)'   // Facility Access
  | '164.310(b)'      // Workstation Use
  | '164.310(c)'      // Workstation Security
  | '164.310(d)(1)'   // Device and Media Controls
  | '164.502'         // Uses and Disclosures
  | '164.514'         // De-identification;

export interface RegulationReference {
  regulation: RegulationType;
  section: string;
  title: string;
  description: string;
  requirement: 'required' | 'addressable';
  url?: string;
}

// ============================================================================
// COMPLIANCE RULES
// ============================================================================

export type ComplianceSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type ComplianceCategory =
  | 'phi_exposure'           // PHI data exposed in logs, URLs, etc.
  | 'encryption'             // Missing or weak encryption
  | 'access_control'         // Missing authentication/authorization
  | 'audit_logging'          // Missing or incomplete audit trails
  | 'data_integrity'         // Missing validation/checksums
  | 'transmission_security'  // Insecure data transmission
  | 'authentication'         // Weak or missing authentication
  | 'session_management'     // Session security issues
  | 'error_handling'         // PHI in error messages
  | 'input_validation'       // SQL injection, XSS with PHI
  | 'key_management'         // Hardcoded keys, weak key storage
  | 'data_retention'         // Improper data lifecycle
  | 'consent_management'     // Missing consent checks
  | 'minimum_necessary'      // Excess data access
  | 'breach_notification'    // Missing breach detection;

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  category: ComplianceCategory;
  severity: ComplianceSeverity;
  regulations: RegulationReference[];
  patterns: RulePattern[];
  recommendation: string;
  codeExample?: {
    bad: string;
    good: string;
  };
  autoFixable: boolean;
  tags: string[];
}

export interface RulePattern {
  type: 'regex' | 'ast' | 'semantic';
  pattern: string;
  flags?: string;
  language?: string[];  // e.g., ['typescript', 'javascript', 'python']
  context?: PatternContext;
}

export interface PatternContext {
  // Where in code this pattern applies
  inFunction?: boolean;
  inClass?: boolean;
  inApiRoute?: boolean;
  inDatabaseQuery?: boolean;
  inLogStatement?: boolean;
  inErrorHandler?: boolean;
  inHttpRequest?: boolean;
  inFileOperation?: boolean;
}

// ============================================================================
// SCAN RESULTS
// ============================================================================

export interface ComplianceViolation {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: ComplianceSeverity;
  category: ComplianceCategory;
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  codeSnippet: string;
  message: string;
  regulations: RegulationReference[];
  recommendation: string;
  autoFixAvailable: boolean;
  suggestedFix?: string;
  timestamp: Date;
}

export interface ComplianceAnnotation {
  file: string;
  line: number;
  regulations: RegulationReference[];
  auditType?: AuditEventType;
  phiFields?: string[];
  dataClassification?: DataClassification;
}

export type DataClassification =
  | 'public'
  | 'internal'
  | 'confidential'
  | 'phi'
  | 'restricted_phi'  // 42 CFR Part 2, HIV, mental health
  | 'pii';

export type AuditEventType =
  | 'PHI_ACCESS'
  | 'PHI_CREATE'
  | 'PHI_UPDATE'
  | 'PHI_DELETE'
  | 'PHI_EXPORT'
  | 'PHI_TRANSMIT'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGOUT'
  | 'SESSION_TIMEOUT'
  | 'ACCESS_DENIED'
  | 'BREAK_THE_GLASS'
  | 'CONSENT_GRANTED'
  | 'CONSENT_REVOKED'
  | 'ENCRYPTION_KEY_ACCESS'
  | 'CONFIGURATION_CHANGE';

// ============================================================================
// SCAN CONFIGURATION
// ============================================================================

export interface ComplianceScanConfig {
  // Which regulations to check
  regulations: RegulationType[];

  // Severity threshold (only report this level and above)
  minSeverity: ComplianceSeverity;

  // File patterns to include/exclude
  include: string[];
  exclude: string[];

  // Category-specific settings
  categories?: {
    [key in ComplianceCategory]?: {
      enabled: boolean;
      customPatterns?: RulePattern[];
    };
  };

  // PHI field detection
  phiFieldPatterns?: string[];

  // Custom rules
  customRules?: ComplianceRule[];

  // Auto-annotation settings
  autoAnnotate: boolean;
  annotationStyle: 'comment' | 'jsdoc' | 'decorator';

  // Report settings
  generateReport: boolean;
  reportFormat: 'json' | 'html' | 'pdf' | 'sarif';
}

// ============================================================================
// SCAN REPORT
// ============================================================================

export interface ComplianceScanResult {
  scanId: string;
  projectId: string;
  projectName: string;
  timestamp: Date;
  duration: number;  // milliseconds

  // Summary
  summary: {
    totalFiles: number;
    filesScanned: number;
    filesSkipped: number;
    linesOfCode: number;
    totalViolations: number;
    bySeverity: Record<ComplianceSeverity, number>;
    byCategory: Record<ComplianceCategory, number>;
    byRegulation: Record<RegulationType, number>;
    complianceScore: number;  // 0-100
    phiFieldsDetected: number;
    auditGaps: number;
  };

  // Detailed results
  violations: ComplianceViolation[];
  annotations: ComplianceAnnotation[];

  // PHI fields detected in codebase
  phiFields: DetectedPHIField[];

  // Audit requirements status
  auditRequirements: AuditRequirementStatus[];

  // Recommendations
  recommendations: ComplianceRecommendation[];

  // Regulatory coverage
  regulatoryCoverage: RegulatoryCoverage[];
}

export interface DetectedPHIField {
  name: string;
  type: PHIType;
  sensitivity: 'standard' | 'sensitive' | 'highly_sensitive';
  file: string;
  line: number;
  column: number;
  context: string;  // surrounding code snippet
  deIdentificationMethod?: DeIdentificationMethod;
  inScope: boolean;  // whether it's in scope for this scan
}

export interface AuditRequirementStatus {
  eventType: AuditEventType;
  description: string;
  implemented: boolean;
  file?: string;
  line?: number;
  requiredFields: string[];
  missingFields: string[];
}

export interface ComplianceRecommendation {
  priority: number;
  title: string;
  description: string;
  affectedFiles: string[];
  estimatedEffort: 'low' | 'medium' | 'high';
  regulations: RegulationType[];
  steps: string[];
}

export interface RegulatoryCoverage {
  regulation: RegulationType;
  totalRequirements: number;
  metRequirements: number;
  partialRequirements: number;
  unmetRequirements: number;
  coveragePercentage: number;
  details: {
    section: string;
    status: 'met' | 'partial' | 'unmet' | 'not_applicable';
    findings: string[];
  }[];
}

// ============================================================================
// PHI DETECTION
// ============================================================================

export interface PHIField {
  name: string;
  type: PHIType;
  sensitivity: 'standard' | 'sensitive' | 'highly_sensitive';
  deIdentificationMethod?: DeIdentificationMethod;
}

export type PHIType =
  | 'name'
  | 'address'
  | 'dates'           // DOB, admission, discharge, death
  | 'phone'
  | 'fax'
  | 'email'
  | 'ssn'
  | 'mrn'             // Medical record number
  | 'health_plan_id'
  | 'account_number'
  | 'certificate_license'
  | 'vehicle_id'
  | 'device_id'
  | 'url'
  | 'ip_address'
  | 'biometric'
  | 'photo'
  | 'diagnosis'
  | 'medication'
  | 'lab_result'
  | 'procedure'
  | 'provider_notes';

export type DeIdentificationMethod =
  | 'safe_harbor'     // Remove all 18 identifiers
  | 'expert_determination'
  | 'limited_data_set'
  | 'pseudonymization'
  | 'tokenization'
  | 'encryption';

// ============================================================================
// AUTO-FIX
// ============================================================================

export interface ComplianceFix {
  violationId: string;
  file: string;
  originalCode: string;
  fixedCode: string;
  explanation: string;
  regulations: RegulationReference[];
  requiresReview: boolean;
  reviewNotes?: string;
}

export interface AutoFixResult {
  success: boolean;
  fixesApplied: number;
  fixesFailed: number;
  fixes: ComplianceFix[];
  errors: string[];
}

// ============================================================================
// COMPLIANCE AGENT
// ============================================================================

export interface ComplianceAgentConfig {
  mode: 'scan' | 'annotate' | 'fix' | 'report';
  scanConfig: ComplianceScanConfig;
  outputPath?: string;
  verbose: boolean;
  dryRun: boolean;
}

export interface ComplianceAgentResult {
  mode: string;
  success: boolean;
  scanResult?: ComplianceScanResult;
  fixResult?: AutoFixResult;
  reportPath?: string;
  errors: string[];
  warnings: string[];
}
