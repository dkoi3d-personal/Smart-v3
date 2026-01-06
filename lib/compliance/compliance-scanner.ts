/**
 * Code-to-Compliance Scanner Service
 *
 * Core scanning engine that analyzes source code for healthcare compliance violations.
 * Generates annotations, reports, and recommendations.
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import {
  ComplianceScanConfig,
  ComplianceScanResult,
  ComplianceViolation,
  ComplianceAnnotation,
  ComplianceRecommendation,
  ComplianceRule,
  RegulatoryCoverage,
  ComplianceSeverity,
  ComplianceCategory,
  RegulationType,
  DataClassification,
  AuditEventType,
  DetectedPHIField,
  AuditRequirementStatus,
  PHIType,
} from './types';
import { HIPAA_RULES, PHI_FIELD_PATTERNS, HIPAA_REFS } from './hipaa-rules';

// ============================================================================
// SCANNER CLASS
// ============================================================================

export class ComplianceScanner {
  private config: ComplianceScanConfig;
  private rules: ComplianceRule[];
  private violations: ComplianceViolation[] = [];
  private annotations: ComplianceAnnotation[] = [];
  private phiFields: DetectedPHIField[] = [];
  private auditRequirements: AuditRequirementStatus[] = [];
  private linesOfCode: number = 0;
  private scanStartTime: number = 0;

  constructor(config: Partial<ComplianceScanConfig> = {}) {
    this.config = this.mergeConfig(config);
    this.rules = this.loadRules();
  }

  private mergeConfig(userConfig: Partial<ComplianceScanConfig>): ComplianceScanConfig {
    return {
      regulations: userConfig.regulations || ['HIPAA'],
      minSeverity: userConfig.minSeverity || 'low',
      include: userConfig.include || ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      exclude: userConfig.exclude || [
        '**/node_modules/**',
        '**/.next/**',
        '**/dist/**',
        '**/build/**',
        '**/coverage/**',
        // Test files
        '**/__tests__/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/test/**',
        '**/tests/**',
        // Seed and mock data (contains fake PHI)
        '**/seed.ts',
        '**/seed.js',
        '**/seeds/**',
        '**/prisma/seed.*',
        '**/fixtures/**',
        '**/mocks/**',
        '**/__mocks__/**',
        '**/mock-data/**',
        '**/test-data/**',
        '**/sample-data/**',
        '**/examples/**',
      ],
      categories: userConfig.categories,
      phiFieldPatterns: userConfig.phiFieldPatterns || PHI_FIELD_PATTERNS,
      customRules: userConfig.customRules || [],
      autoAnnotate: userConfig.autoAnnotate ?? true,
      annotationStyle: userConfig.annotationStyle || 'comment',
      generateReport: userConfig.generateReport ?? true,
      reportFormat: userConfig.reportFormat || 'json',
    };
  }

  private loadRules(): ComplianceRule[] {
    let rules: ComplianceRule[] = [];

    // Load HIPAA rules if enabled
    if (this.config.regulations.includes('HIPAA')) {
      rules = [...rules, ...HIPAA_RULES];
    }

    // Add custom rules
    if (this.config.customRules) {
      rules = [...rules, ...this.config.customRules];
    }

    // Filter by severity
    const severityOrder: ComplianceSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
    const minIndex = severityOrder.indexOf(this.config.minSeverity);
    rules = rules.filter(rule => severityOrder.indexOf(rule.severity) <= minIndex);

    // Filter by enabled categories
    if (this.config.categories) {
      rules = rules.filter(rule => {
        const categoryConfig = this.config.categories?.[rule.category];
        return categoryConfig === undefined || categoryConfig.enabled;
      });
    }

    return rules;
  }

  // =========================================================================
  // MAIN SCAN METHOD
  // =========================================================================

  async scan(projectPath: string, projectId?: string): Promise<ComplianceScanResult> {
    this.scanStartTime = Date.now();
    this.violations = [];
    this.annotations = [];
    this.phiFields = [];
    this.auditRequirements = [];
    this.linesOfCode = 0;

    const scanId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Find files to scan
    const files = await this.findFiles(projectPath);
    let filesScanned = 0;
    let filesSkipped = 0;

    // Scan each file
    for (const file of files) {
      try {
        await this.scanFile(file);
        filesScanned++;
      } catch (error) {
        filesSkipped++;
        console.warn(`Failed to scan file: ${file}`, error);
      }
    }

    // Generate summary
    const summary = this.generateSummary(files.length, filesScanned, filesSkipped);

    // Generate recommendations
    const recommendations = this.generateRecommendations();

    // Generate regulatory coverage
    const regulatoryCoverage = this.generateRegulatoryCoverage();

    // Generate audit requirement status
    this.generateAuditRequirements();

    const result: ComplianceScanResult = {
      scanId,
      projectId: projectId || 'unknown',
      projectName: path.basename(projectPath),
      timestamp: new Date(),
      duration: Date.now() - this.scanStartTime,
      summary,
      violations: this.violations,
      annotations: this.annotations,
      phiFields: this.phiFields,
      auditRequirements: this.auditRequirements,
      recommendations,
      regulatoryCoverage,
    };

    return result;
  }

  // =========================================================================
  // FILE DISCOVERY
  // =========================================================================

  private async findFiles(projectPath: string): Promise<string[]> {
    const files: string[] = [];

    for (const pattern of this.config.include) {
      const matches = await glob(pattern, {
        cwd: projectPath,
        ignore: this.config.exclude,
        absolute: true,
        nodir: true,
      });
      files.push(...matches);
    }

    // Remove duplicates
    return [...new Set(files)];
  }

  // =========================================================================
  // FILE SCANNING
  // =========================================================================

  private async scanFile(filePath: string): Promise<void> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const language = this.detectLanguage(filePath);

    // Track lines of code (excluding empty lines and comments)
    this.linesOfCode += lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*');
    }).length;

    for (const rule of this.rules) {
      for (const pattern of rule.patterns) {
        // Check language applicability
        if (pattern.language && !pattern.language.includes(language)) {
          continue;
        }

        // Execute pattern matching
        const matches = this.findMatches(content, lines, pattern.pattern, pattern.flags);

        for (const match of matches) {
          // Check context if specified
          if (pattern.context && !this.checkContext(content, match.line, pattern.context)) {
            continue;
          }

          const violation: ComplianceViolation = {
            id: `${rule.id}_${filePath}_${match.line}_${match.column}`,
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            category: rule.category,
            file: filePath,
            line: match.line,
            column: match.column,
            endLine: match.endLine,
            endColumn: match.endColumn,
            codeSnippet: this.getCodeSnippet(lines, match.line),
            message: rule.description,
            regulations: rule.regulations,
            recommendation: rule.recommendation,
            autoFixAvailable: rule.autoFixable,
            suggestedFix: rule.codeExample?.good,
            timestamp: new Date(),
          };

          this.violations.push(violation);

          // Generate annotation if enabled
          if (this.config.autoAnnotate) {
            this.generateAnnotation(filePath, match.line, rule);
          }
        }
      }
    }

    // Scan for PHI fields to annotate
    await this.scanForPHIFields(filePath, content, lines);
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.cs': 'csharp',
      '.go': 'go',
      '.rb': 'ruby',
      '.php': 'php',
    };
    return languageMap[ext] || 'unknown';
  }

  private findMatches(
    content: string,
    lines: string[],
    pattern: string,
    flags?: string
  ): Array<{ line: number; column: number; endLine?: number; endColumn?: number; match: string }> {
    const matches: Array<{ line: number; column: number; endLine?: number; endColumn?: number; match: string }> = [];

    try {
      const regex = new RegExp(pattern, flags || 'g');
      let match: RegExpExecArray | null;

      while ((match = regex.exec(content)) !== null) {
        const position = this.getLineColumn(content, match.index);
        const endPosition = this.getLineColumn(content, match.index + match[0].length);

        matches.push({
          line: position.line,
          column: position.column,
          endLine: endPosition.line,
          endColumn: endPosition.column,
          match: match[0],
        });

        // Prevent infinite loops on zero-width matches
        if (match[0].length === 0) {
          regex.lastIndex++;
        }
      }
    } catch (error) {
      console.warn(`Invalid regex pattern: ${pattern}`, error);
    }

    return matches;
  }

  private getLineColumn(content: string, index: number): { line: number; column: number } {
    const lines = content.substring(0, index).split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1,
    };
  }

  private getCodeSnippet(lines: string[], lineNumber: number, contextLines: number = 2): string {
    const start = Math.max(0, lineNumber - contextLines - 1);
    const end = Math.min(lines.length, lineNumber + contextLines);

    return lines
      .slice(start, end)
      .map((line, i) => {
        const num = start + i + 1;
        const marker = num === lineNumber ? '>' : ' ';
        return `${marker} ${num.toString().padStart(4)} | ${line}`;
      })
      .join('\n');
  }

  private checkContext(content: string, lineNumber: number, context: any): boolean {
    // Simplified context checking - in production, use AST parsing
    const lines = content.split('\n');
    const surroundingCode = lines.slice(Math.max(0, lineNumber - 20), lineNumber + 5).join('\n');

    if (context.inApiRoute) {
      return /export\s+(async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)/.test(surroundingCode);
    }

    if (context.inLogStatement) {
      return /console\.(log|info|debug|warn|error)/.test(lines[lineNumber - 1] || '');
    }

    if (context.inDatabaseQuery) {
      return /(query|execute|find|select|insert|update|delete)/.test(surroundingCode);
    }

    if (context.inErrorHandler) {
      return /catch\s*\(/.test(surroundingCode);
    }

    return true;
  }

  // =========================================================================
  // PHI FIELD DETECTION
  // =========================================================================

  private async scanForPHIFields(filePath: string, content: string, lines: string[]): Promise<void> {
    const phiPatterns = this.config.phiFieldPatterns || PHI_FIELD_PATTERNS;
    const phiRegex = new RegExp(`\\b(${phiPatterns.join('|')})\\b`, 'gi');

    let match: RegExpExecArray | null;
    while ((match = phiRegex.exec(content)) !== null) {
      const position = this.getLineColumn(content, match.index);

      // Determine data classification
      const fieldName = match[1].toLowerCase();
      const classification = this.classifyPHIField(fieldName);
      const phiType = this.detectPHIType(fieldName);
      const sensitivity = this.classifyPHISensitivity(fieldName);

      // Determine audit event type
      const auditType = this.inferAuditType(content, match.index);

      // Add to PHI fields array (deduplicate by file+line+name)
      const phiFieldKey = `${filePath}:${position.line}:${fieldName}`;
      if (!this.phiFields.some(f => `${f.file}:${f.line}:${f.name}` === phiFieldKey)) {
        const detectedField: DetectedPHIField = {
          name: fieldName,
          type: phiType,
          sensitivity,
          file: filePath,
          line: position.line,
          column: position.column,
          context: this.getCodeSnippet(lines, position.line, 1),
          inScope: true,
        };
        this.phiFields.push(detectedField);
      }

      // Also add annotation
      const annotation: ComplianceAnnotation = {
        file: filePath,
        line: position.line,
        regulations: [HIPAA_REFS.MINIMUM_NECESSARY, HIPAA_REFS.AUDIT_CONTROLS],
        auditType,
        phiFields: [fieldName],
        dataClassification: classification,
      };

      // Avoid duplicate annotations for same location
      if (!this.annotations.some(a => a.file === filePath && a.line === position.line)) {
        this.annotations.push(annotation);
      }
    }
  }

  private detectPHIType(fieldName: string): PHIType {
    const fn = fieldName.toLowerCase();

    // Names
    if (fn.includes('name') || fn.includes('fname') || fn.includes('lname')) return 'name';

    // Addresses
    if (fn.includes('address') || fn.includes('street') || fn.includes('city') ||
        fn.includes('state') || fn.includes('zip') || fn.includes('postal')) return 'address';

    // Dates
    if (fn.includes('dob') || fn.includes('birth') || fn.includes('death') ||
        fn.includes('admission') || fn.includes('discharge')) return 'dates';

    // Contact info
    if (fn.includes('phone') || fn.includes('telephone') || fn.includes('mobile') || fn.includes('cell')) return 'phone';
    if (fn.includes('fax')) return 'fax';
    if (fn.includes('email')) return 'email';

    // Identifiers
    if (fn.includes('ssn') || fn.includes('social_security') || fn.includes('socialsecurity')) return 'ssn';
    if (fn.includes('mrn') || fn.includes('medical_record') || fn.includes('medicalrecord')) return 'mrn';
    if (fn.includes('health_plan') || fn.includes('insurance') || fn.includes('policy')) return 'health_plan_id';
    if (fn.includes('account')) return 'account_number';
    if (fn.includes('license') || fn.includes('certificate')) return 'certificate_license';

    // Clinical data
    if (fn.includes('diagnosis') || fn.includes('icd')) return 'diagnosis';
    if (fn.includes('medication') || fn.includes('prescription') || fn.includes('rx') || fn.includes('drug')) return 'medication';
    if (fn.includes('lab') || fn.includes('result') || fn.includes('test')) return 'lab_result';
    if (fn.includes('procedure') || fn.includes('cpt')) return 'procedure';

    // Tech identifiers
    if (fn.includes('ip_address') || fn.includes('ipaddress')) return 'ip_address';
    if (fn.includes('device') || fn.includes('mac_address')) return 'device_id';
    if (fn.includes('url') || fn.includes('web')) return 'url';

    // Biometric
    if (fn.includes('biometric') || fn.includes('fingerprint') || fn.includes('retina') || fn.includes('face')) return 'biometric';
    if (fn.includes('photo') || fn.includes('image') || fn.includes('picture')) return 'photo';

    // Default to provider notes for clinical context
    return 'provider_notes';
  }

  private classifyPHISensitivity(fieldName: string): 'standard' | 'sensitive' | 'highly_sensitive' {
    const fn = fieldName.toLowerCase();

    // Highly sensitive - 42 CFR Part 2, HIV, mental health, genetic
    const highlySensitive = ['hiv', 'aids', 'substance', 'drug_abuse', 'alcohol', 'psychiatric',
      'mental_health', 'psychotherapy', 'genetic', 'genomic', 'dna'];
    if (highlySensitive.some(s => fn.includes(s))) return 'highly_sensitive';

    // Sensitive - SSN, MRN, DOB, full address, biometric
    const sensitive = ['ssn', 'social_security', 'mrn', 'medical_record', 'dob', 'birth',
      'biometric', 'fingerprint', 'retina', 'diagnosis', 'medication'];
    if (sensitive.some(s => fn.includes(s))) return 'sensitive';

    // Standard - names, contact info, etc.
    return 'standard';
  }

  private classifyPHIField(fieldName: string): DataClassification {
    const sensitivity = this.classifyPHISensitivity(fieldName);

    if (sensitivity === 'highly_sensitive') return 'restricted_phi';
    if (sensitivity === 'sensitive') return 'phi';

    // Check for PII vs confidential
    const piiFields = ['name', 'email', 'phone', 'address', 'first', 'last'];
    if (piiFields.some(f => fieldName.includes(f))) return 'pii';

    return 'confidential';
  }

  private inferAuditType(content: string, position: number): AuditEventType {
    const context = content.substring(Math.max(0, position - 100), position + 100).toLowerCase();

    if (context.includes('create') || context.includes('insert') || context.includes('new ')) {
      return 'PHI_CREATE';
    }
    if (context.includes('update') || context.includes('modify') || context.includes('edit') || context.includes('save')) {
      return 'PHI_UPDATE';
    }
    if (context.includes('delete') || context.includes('remove') || context.includes('destroy')) {
      return 'PHI_DELETE';
    }
    if (context.includes('export') || context.includes('download') || context.includes('report')) {
      return 'PHI_EXPORT';
    }
    if (context.includes('send') || context.includes('transmit') || context.includes('email') || context.includes('fax')) {
      return 'PHI_TRANSMIT';
    }
    return 'PHI_ACCESS';
  }

  // =========================================================================
  // ANNOTATION GENERATION
  // =========================================================================

  private generateAnnotation(filePath: string, line: number, rule: ComplianceRule): void {
    const annotation: ComplianceAnnotation = {
      file: filePath,
      line,
      regulations: rule.regulations,
      dataClassification: 'phi',
    };

    this.annotations.push(annotation);
  }

  // =========================================================================
  // SUMMARY GENERATION
  // =========================================================================

  private generateSummary(
    totalFiles: number,
    filesScanned: number,
    filesSkipped: number
  ): ComplianceScanResult['summary'] {
    const bySeverity: Record<ComplianceSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    const byCategory: Record<string, number> = {};
    const byRegulation: Record<string, number> = {};

    for (const violation of this.violations) {
      bySeverity[violation.severity]++;
      byCategory[violation.category] = (byCategory[violation.category] || 0) + 1;

      for (const reg of violation.regulations) {
        byRegulation[reg.regulation] = (byRegulation[reg.regulation] || 0) + 1;
      }
    }

    // Calculate compliance score using a balanced algorithm
    // Base score is 100, deduct points based on weighted violations
    const weights = { critical: 10, high: 5, medium: 2, low: 1, info: 0 };
    const totalWeight = Object.entries(bySeverity).reduce(
      (sum, [severity, count]) => sum + count * weights[severity as ComplianceSeverity],
      0
    );

    // Calculate score with diminishing returns (logarithmic scale for large numbers)
    // This prevents a few critical issues from completely zeroing the score
    // while still penalizing poor compliance
    let complianceScore: number;
    if (totalWeight === 0) {
      complianceScore = 100;
    } else {
      // Use a formula that:
      // - 1 critical (10 pts) = ~85 score
      // - 5 critical (50 pts) = ~60 score
      // - 10 critical (100 pts) = ~40 score
      // - 20 critical (200 pts) = ~20 score
      const deduction = Math.min(100, Math.log10(totalWeight + 1) * 30 + totalWeight * 0.3);
      complianceScore = Math.max(0, Math.round(100 - deduction));
    }

    // Count audit gaps (annotations without proper audit logging)
    const auditGaps = this.annotations.filter(a =>
      a.auditType && !this.violations.some(v =>
        v.category === 'audit_logging' && v.file === a.file
      )
    ).length;

    return {
      totalFiles,
      filesScanned,
      filesSkipped,
      linesOfCode: this.linesOfCode,
      totalViolations: this.violations.length,
      bySeverity,
      byCategory: byCategory as Record<ComplianceCategory, number>,
      byRegulation: byRegulation as Record<RegulationType, number>,
      complianceScore,
      phiFieldsDetected: this.phiFields.length,
      auditGaps,
    };
  }

  // =========================================================================
  // AUDIT REQUIREMENTS
  // =========================================================================

  private generateAuditRequirements(): void {
    // Define required audit events based on detected PHI operations
    const auditEvents: AuditEventType[] = [
      'PHI_ACCESS', 'PHI_CREATE', 'PHI_UPDATE', 'PHI_DELETE',
      'PHI_EXPORT', 'PHI_TRANSMIT', 'LOGIN_SUCCESS', 'LOGIN_FAILURE',
      'LOGOUT', 'ACCESS_DENIED'
    ];

    const requiredFields = ['userId', 'timestamp', 'action', 'resourceType', 'resourceId', 'ipAddress'];

    // Check which audit events are present in annotations
    const detectedAuditTypes = new Set(
      this.annotations
        .filter(a => a.auditType)
        .map(a => a.auditType as AuditEventType)
    );

    // Check for audit logging violations
    const hasAuditViolations = this.violations.some(v => v.category === 'audit_logging');

    for (const eventType of auditEvents) {
      const isDetected = detectedAuditTypes.has(eventType);
      const description = this.getAuditEventDescription(eventType);

      // Find files where this event type is used
      const relevantAnnotations = this.annotations.filter(a => a.auditType === eventType);

      this.auditRequirements.push({
        eventType,
        description,
        implemented: isDetected && !hasAuditViolations,
        file: relevantAnnotations[0]?.file,
        line: relevantAnnotations[0]?.line,
        requiredFields,
        missingFields: hasAuditViolations ? ['proper implementation'] : [],
      });
    }
  }

  private getAuditEventDescription(eventType: AuditEventType): string {
    const descriptions: Record<AuditEventType, string> = {
      'PHI_ACCESS': 'Log when PHI is viewed or accessed',
      'PHI_CREATE': 'Log when new PHI records are created',
      'PHI_UPDATE': 'Log when PHI records are modified',
      'PHI_DELETE': 'Log when PHI records are deleted',
      'PHI_EXPORT': 'Log when PHI is exported or downloaded',
      'PHI_TRANSMIT': 'Log when PHI is transmitted externally',
      'LOGIN_SUCCESS': 'Log successful authentication attempts',
      'LOGIN_FAILURE': 'Log failed authentication attempts',
      'LOGOUT': 'Log user logout events',
      'SESSION_TIMEOUT': 'Log session timeout events',
      'ACCESS_DENIED': 'Log unauthorized access attempts',
      'BREAK_THE_GLASS': 'Log emergency access overrides',
      'CONSENT_GRANTED': 'Log patient consent grants',
      'CONSENT_REVOKED': 'Log patient consent revocations',
      'ENCRYPTION_KEY_ACCESS': 'Log encryption key access',
      'CONFIGURATION_CHANGE': 'Log system configuration changes',
    };
    return descriptions[eventType] || `Audit event: ${eventType}`;
  }

  // =========================================================================
  // RECOMMENDATIONS
  // =========================================================================

  private generateRecommendations(): ComplianceRecommendation[] {
    const recommendations: ComplianceRecommendation[] = [];
    const violationsByCategory = new Map<ComplianceCategory, ComplianceViolation[]>();

    // Group violations by category
    for (const violation of this.violations) {
      const existing = violationsByCategory.get(violation.category) || [];
      existing.push(violation);
      violationsByCategory.set(violation.category, existing);
    }

    // Generate recommendations for each category
    let priority = 1;
    for (const [category, violations] of violationsByCategory.entries()) {
      const criticalCount = violations.filter(v => v.severity === 'critical').length;
      const highCount = violations.filter(v => v.severity === 'high').length;

      // Prioritize by severity
      const effectivePriority = criticalCount > 0 ? priority : priority + 10;

      recommendations.push({
        priority: effectivePriority,
        title: this.getCategoryTitle(category),
        description: this.getCategoryDescription(category, violations.length),
        affectedFiles: [...new Set(violations.map(v => v.file))],
        estimatedEffort: this.estimateEffort(violations),
        regulations: [...new Set(violations.flatMap(v => v.regulations.map(r => r.regulation)))],
        steps: this.getRemediationSteps(category),
      });

      priority++;
    }

    // Sort by priority
    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  private getCategoryTitle(category: ComplianceCategory): string {
    const titles: Record<ComplianceCategory, string> = {
      phi_exposure: 'Address PHI Exposure Risks',
      encryption: 'Strengthen Encryption Implementation',
      access_control: 'Improve Access Control Mechanisms',
      audit_logging: 'Enhance Audit Logging',
      data_integrity: 'Ensure Data Integrity',
      transmission_security: 'Secure Data Transmission',
      authentication: 'Strengthen Authentication',
      session_management: 'Improve Session Management',
      error_handling: 'Secure Error Handling',
      input_validation: 'Add Input Validation',
      key_management: 'Improve Key Management',
      data_retention: 'Implement Data Retention Policies',
      consent_management: 'Add Consent Management',
      minimum_necessary: 'Apply Minimum Necessary Principle',
      breach_notification: 'Implement Breach Detection',
    };
    return titles[category] || 'Address Compliance Issues';
  }

  private getCategoryDescription(category: ComplianceCategory, count: number): string {
    return `Found ${count} ${category.replace(/_/g, ' ')} issue${count !== 1 ? 's' : ''} that require attention.`;
  }

  private estimateEffort(violations: ComplianceViolation[]): 'low' | 'medium' | 'high' {
    const uniqueFiles = new Set(violations.map(v => v.file)).size;
    const criticalCount = violations.filter(v => v.severity === 'critical').length;

    if (criticalCount > 5 || uniqueFiles > 10) return 'high';
    if (criticalCount > 0 || uniqueFiles > 5) return 'medium';
    return 'low';
  }

  private getRemediationSteps(category: ComplianceCategory): string[] {
    const steps: Record<ComplianceCategory, string[]> = {
      phi_exposure: [
        'Identify all locations where PHI is exposed in logs, URLs, or error messages',
        'Implement PHI redaction utility for logging',
        'Move PHI to request body instead of URL parameters',
        'Use generic error messages for client responses',
        'Add audit logging for PHI access',
      ],
      encryption: [
        'Upgrade to AES-256-GCM for symmetric encryption',
        'Use bcrypt or Argon2 for password hashing',
        'Implement proper key rotation procedures',
        'Store encryption keys in secure key management service',
      ],
      access_control: [
        'Implement authentication middleware for all PHI endpoints',
        'Add role-based access control (RBAC)',
        'Verify user permissions before data access',
        'Implement break-the-glass procedures for emergencies',
      ],
      audit_logging: [
        'Add comprehensive audit logging for all PHI access',
        'Include who, what, when, where in audit records',
        'Implement immutable audit log storage',
        'Set up log retention for 6+ years',
      ],
      data_integrity: [
        'Add checksums or hashing for data validation',
        'Implement optimistic locking for concurrent updates',
        'Add data validation at input boundaries',
      ],
      transmission_security: [
        'Enforce HTTPS for all external communications',
        'Enable TLS 1.2+ on all connections',
        'Implement HSTS headers',
        'Enable SSL on database connections',
      ],
      authentication: [
        'Implement multi-factor authentication',
        'Use secure session management',
        'Add brute force protection',
        'Implement proper password policies',
      ],
      session_management: [
        'Set appropriate session timeout (15-30 minutes)',
        'Use secure, httpOnly cookies',
        'Implement session invalidation on logout',
        'Add activity-based timeout extension',
      ],
      error_handling: [
        'Return generic error messages to clients',
        'Log detailed errors server-side with PHI redaction',
        'Implement error monitoring and alerting',
      ],
      input_validation: [
        'Use schema validation libraries (zod, yup, joi)',
        'Sanitize all user input',
        'Use parameterized queries for database operations',
        'Implement output encoding',
      ],
      key_management: [
        'Move secrets to environment variables',
        'Use secrets management service (AWS Secrets Manager, Vault)',
        'Implement key rotation',
        'Audit key access',
      ],
      data_retention: [
        'Define data retention policies by data type',
        'Implement automated data purging',
        'Document retention requirements',
      ],
      consent_management: [
        'Implement consent capture and tracking',
        'Check consent before data sharing',
        'Allow consent revocation',
      ],
      minimum_necessary: [
        'Review API responses for excess data',
        'Create DTOs with only necessary fields',
        'Replace SELECT * with explicit field lists',
        'Implement field-level access control',
      ],
      breach_notification: [
        'Implement security event monitoring',
        'Set up alerting for suspicious activity',
        'Create incident response procedures',
        'Document breach notification workflows',
      ],
    };

    return steps[category] || ['Review and address compliance issues'];
  }

  // =========================================================================
  // REGULATORY COVERAGE
  // =========================================================================

  private generateRegulatoryCoverage(): RegulatoryCoverage[] {
    const coverage: RegulatoryCoverage[] = [];

    if (this.config.regulations.includes('HIPAA')) {
      coverage.push(this.generateHIPAACoverage());
    }

    return coverage;
  }

  private generateHIPAACoverage(): RegulatoryCoverage {
    const sections = [
      { section: '164.312(a)(1)', title: 'Access Control' },
      { section: '164.312(b)', title: 'Audit Controls' },
      { section: '164.312(c)(1)', title: 'Integrity' },
      { section: '164.312(d)', title: 'Authentication' },
      { section: '164.312(e)(1)', title: 'Transmission Security' },
    ];

    const details = sections.map(({ section, title }) => {
      const sectionViolations = this.violations.filter(v =>
        v.regulations.some(r => r.section === section)
      );

      let status: 'met' | 'partial' | 'unmet';
      if (sectionViolations.length === 0) {
        status = 'met';
      } else if (sectionViolations.some(v => v.severity === 'critical')) {
        status = 'unmet';
      } else {
        status = 'partial';
      }

      return {
        section: `${section} - ${title}`,
        status,
        findings: sectionViolations.map(v => v.ruleName),
      };
    });

    const met = details.filter(d => d.status === 'met').length;
    const partial = details.filter(d => d.status === 'partial').length;
    const unmet = details.filter(d => d.status === 'unmet').length;

    return {
      regulation: 'HIPAA',
      totalRequirements: sections.length,
      metRequirements: met,
      partialRequirements: partial,
      unmetRequirements: unmet,
      coveragePercentage: Math.round((met / sections.length) * 100),
      details,
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export async function scanProject(
  projectPath: string,
  config?: Partial<ComplianceScanConfig>
): Promise<ComplianceScanResult> {
  const scanner = new ComplianceScanner(config);
  return scanner.scan(projectPath);
}

export function formatViolation(violation: ComplianceViolation): string {
  const severityColors: Record<ComplianceSeverity, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🔵',
    info: '⚪',
  };

  return `
${severityColors[violation.severity]} [${violation.severity.toUpperCase()}] ${violation.ruleName}
   File: ${violation.file}:${violation.line}:${violation.column}
   Rule: ${violation.ruleId}

${violation.codeSnippet}

   Regulations: ${violation.regulations.map(r => r.section).join(', ')}

   💡 ${violation.recommendation}
`;
}

export function generateComplianceComment(annotation: ComplianceAnnotation): string {
  const regs = annotation.regulations.map(r => `${r.regulation} ${r.section}`).join(', ');
  const audit = annotation.auditType ? `\n// @audit: ${annotation.auditType}` : '';
  const phi = annotation.phiFields ? `\n// @phi-fields: ${annotation.phiFields.join(', ')}` : '';
  const classification = annotation.dataClassification ? `\n// @data-classification: ${annotation.dataClassification}` : '';

  return `// @compliance: ${regs}${audit}${phi}${classification}`;
}
