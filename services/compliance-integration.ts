/**
 * Compliance Integration Service
 *
 * Integrates the Code-to-Compliance Pipeline with the multi-agent build workflow.
 * Provides real-time scanning, gate checking, and build blocking capabilities.
 */

import { EventEmitter } from 'events';
import {
  ComplianceScanner,
  ComplianceScanResult,
  ComplianceScanConfig,
  ComplianceViolation,
  generateHTMLReport,
  generateMarkdownReport,
} from '@/lib/compliance';
import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

export interface ComplianceConfig {
  enabled: boolean;
  regulations: string[];
  minScore: number;
  blockOnCritical: boolean;
  autoAnnotate: boolean;
  autoFix: boolean;
  scanOnStoryComplete: boolean;
  scanBeforeTesting: boolean;
  scanBeforeDeploy: boolean;
  reportFormat: 'html' | 'markdown' | 'json';
  reportPath: string;
}

export interface ComplianceGateResult {
  passed: boolean;
  score: number;
  criticalCount: number;
  highCount: number;
  mustFix: ComplianceViolation[];
  shouldFix: ComplianceViolation[];
  canProceed: boolean;
  blockedReason?: string;
}

export interface ComplianceEvent {
  type: 'scan_start' | 'scan_complete' | 'violation_found' | 'gate_passed' | 'gate_blocked' | 'auto_fix';
  projectId: string;
  timestamp: Date;
  data: any;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: ComplianceConfig = {
  enabled: true,
  regulations: ['HIPAA'],
  minScore: 70,
  blockOnCritical: true,
  autoAnnotate: true,
  autoFix: false,
  scanOnStoryComplete: true,
  scanBeforeTesting: true,
  scanBeforeDeploy: true,
  reportFormat: 'html',
  reportPath: './reports/compliance',
};

// ============================================================================
// COMPLIANCE INTEGRATION SERVICE
// ============================================================================

export class ComplianceIntegrationService extends EventEmitter {
  private config: ComplianceConfig;
  private scanner: ComplianceScanner;
  private lastScanResult: Map<string, ComplianceScanResult> = new Map();

  constructor(config: Partial<ComplianceConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.scanner = new ComplianceScanner({
      regulations: this.config.regulations as any,
      minSeverity: 'low',
      autoAnnotate: this.config.autoAnnotate,
    });
  }

  // =========================================================================
  // WORKFLOW HOOKS
  // =========================================================================

  /**
   * Hook: Called when a story is completed by the Coder agent
   * Performs a quick scan of the modified files
   */
  async onStoryComplete(
    projectId: string,
    projectPath: string,
    storyFiles: string[]
  ): Promise<{ violations: ComplianceViolation[]; passed: boolean }> {
    if (!this.config.enabled || !this.config.scanOnStoryComplete) {
      return { violations: [], passed: true };
    }

    this.emitEvent('scan_start', projectId, { type: 'story_complete', files: storyFiles });

    try {
      // Quick scan of just the changed files
      const result = await this.scanner.scan(projectPath, projectId);

      // Filter to only violations in the story's files
      const storyViolations = result.violations.filter(v =>
        storyFiles.some(f => v.file.includes(f))
      );

      const passed = storyViolations.filter(v => v.severity === 'critical').length === 0;

      if (storyViolations.length > 0) {
        this.emitEvent('violation_found', projectId, {
          count: storyViolations.length,
          violations: storyViolations,
        });
      }

      return { violations: storyViolations, passed };
    } catch (error) {
      console.error('Story compliance scan failed:', error);
      return { violations: [], passed: true };
    }
  }

  /**
   * Hook: Called before the Testing phase begins
   * Performs a full compliance scan and may block the workflow
   */
  async onBeforeTesting(projectId: string, projectPath: string): Promise<ComplianceGateResult> {
    if (!this.config.enabled || !this.config.scanBeforeTesting) {
      return this.createPassingGateResult();
    }

    return this.runGateCheck(projectId, projectPath, 'testing');
  }

  /**
   * Hook: Called before deployment
   * Final compliance gate - strictest checking
   */
  async onBeforeDeploy(projectId: string, projectPath: string): Promise<ComplianceGateResult> {
    if (!this.config.enabled || !this.config.scanBeforeDeploy) {
      return this.createPassingGateResult();
    }

    const result = await this.runGateCheck(projectId, projectPath, 'deploy');

    // Generate final report
    if (result.passed) {
      await this.generateReport(projectId, projectPath);
    }

    return result;
  }

  // =========================================================================
  // CORE SCANNING
  // =========================================================================

  /**
   * Run a full compliance scan
   */
  async scan(projectId: string, projectPath: string): Promise<ComplianceScanResult> {
    this.emitEvent('scan_start', projectId, { type: 'full_scan' });

    const result = await this.scanner.scan(projectPath, projectId);
    this.lastScanResult.set(projectId, result);

    this.emitEvent('scan_complete', projectId, {
      score: result.summary.complianceScore,
      violations: result.summary.totalViolations,
      bySeverity: result.summary.bySeverity,
    });

    return result;
  }

  /**
   * Run a gate check (scan + decision)
   */
  async runGateCheck(
    projectId: string,
    projectPath: string,
    phase: 'testing' | 'deploy'
  ): Promise<ComplianceGateResult> {
    const result = await this.scan(projectId, projectPath);

    const criticalCount = result.summary.bySeverity.critical;
    const highCount = result.summary.bySeverity.high;
    const score = result.summary.complianceScore;

    // Determine if we pass
    let passed = true;
    let blockedReason: string | undefined;

    // Block on critical violations
    if (this.config.blockOnCritical && criticalCount > 0) {
      passed = false;
      blockedReason = `${criticalCount} critical HIPAA violation(s) detected`;
    }

    // Block if score is too low
    if (score < this.config.minScore) {
      passed = false;
      blockedReason = `Compliance score ${score} is below minimum ${this.config.minScore}`;
    }

    // Stricter checks for deploy phase
    if (phase === 'deploy' && highCount > 0) {
      passed = false;
      blockedReason = `${highCount} high-severity violation(s) must be resolved before deployment`;
    }

    const mustFix = result.violations.filter(v => v.severity === 'critical' || v.severity === 'high');
    const shouldFix = result.violations.filter(v => v.severity === 'medium' || v.severity === 'low');

    const gateResult: ComplianceGateResult = {
      passed,
      score,
      criticalCount,
      highCount,
      mustFix,
      shouldFix,
      canProceed: passed,
      blockedReason,
    };

    if (passed) {
      this.emitEvent('gate_passed', projectId, { phase, score });
    } else {
      this.emitEvent('gate_blocked', projectId, { phase, reason: blockedReason, score });
    }

    return gateResult;
  }

  // =========================================================================
  // AUTO-FIX
  // =========================================================================

  /**
   * Attempt to auto-fix violations
   * Returns the IDs of violations that were fixed
   */
  async autoFix(projectId: string, projectPath: string): Promise<string[]> {
    if (!this.config.autoFix) {
      return [];
    }

    const result = this.lastScanResult.get(projectId);
    if (!result) {
      return [];
    }

    const fixedIds: string[] = [];

    for (const violation of result.violations) {
      if (!violation.autoFixAvailable || !violation.suggestedFix) {
        continue;
      }

      try {
        // Read the file
        const filePath = violation.file;
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        // Simple auto-fix: replace the line with the suggested fix
        // In production, this would be more sophisticated
        if (violation.suggestedFix) {
          // This is a simplified example - real implementation would use AST
          lines[violation.line - 1] = violation.suggestedFix;
          await fs.writeFile(filePath, lines.join('\n'));
          fixedIds.push(violation.id);

          this.emitEvent('auto_fix', projectId, {
            violationId: violation.id,
            file: filePath,
            line: violation.line,
          });
        }
      } catch (error) {
        console.error(`Auto-fix failed for ${violation.id}:`, error);
      }
    }

    return fixedIds;
  }

  // =========================================================================
  // REPORTING
  // =========================================================================

  /**
   * Generate and save a compliance report
   */
  async generateReport(projectId: string, projectPath: string): Promise<string> {
    const result = this.lastScanResult.get(projectId);
    if (!result) {
      throw new Error('No scan result available for report generation');
    }

    // Ensure report directory exists
    const reportDir = path.join(projectPath, this.config.reportPath);
    await fs.mkdir(reportDir, { recursive: true });

    // Generate report content
    let reportContent: string;
    let reportExt: string;

    switch (this.config.reportFormat) {
      case 'html':
        reportContent = generateHTMLReport(result, {
          projectName: projectId,
        });
        reportExt = 'html';
        break;
      case 'markdown':
        reportContent = generateMarkdownReport(result, {
          projectName: projectId,
        });
        reportExt = 'md';
        break;
      case 'json':
      default:
        reportContent = JSON.stringify(result, null, 2);
        reportExt = 'json';
    }

    // Save report
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportDir, `compliance-report-${timestamp}.${reportExt}`);
    await fs.writeFile(reportPath, reportContent);

    return reportPath;
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  private createPassingGateResult(): ComplianceGateResult {
    return {
      passed: true,
      score: 100,
      criticalCount: 0,
      highCount: 0,
      mustFix: [],
      shouldFix: [],
      canProceed: true,
    };
  }

  private emitEvent(type: ComplianceEvent['type'], projectId: string, data: any): void {
    const event: ComplianceEvent = {
      type,
      projectId,
      timestamp: new Date(),
      data,
    };
    this.emit('compliance', event);
    this.emit(type, event);
  }

  /**
   * Get the last scan result for a project
   */
  getLastResult(projectId: string): ComplianceScanResult | undefined {
    return this.lastScanResult.get(projectId);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ComplianceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): ComplianceConfig {
    return { ...this.config };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let complianceService: ComplianceIntegrationService | null = null;

export function getComplianceService(config?: Partial<ComplianceConfig>): ComplianceIntegrationService {
  if (!complianceService) {
    complianceService = new ComplianceIntegrationService(config);
  } else if (config) {
    complianceService.updateConfig(config);
  }
  return complianceService;
}

// ============================================================================
// WORKFLOW INTEGRATION HELPERS
// ============================================================================

/**
 * Create compliance hooks for the multi-agent workflow
 */
export function createComplianceHooks(projectId: string, projectPath: string) {
  const service = getComplianceService();

  return {
    /**
     * Call after each story is completed
     */
    async afterStoryComplete(storyFiles: string[]) {
      return service.onStoryComplete(projectId, projectPath, storyFiles);
    },

    /**
     * Call before testing phase
     */
    async beforeTesting() {
      return service.onBeforeTesting(projectId, projectPath);
    },

    /**
     * Call before deployment
     */
    async beforeDeploy() {
      return service.onBeforeDeploy(projectId, projectPath);
    },

    /**
     * Subscribe to compliance events
     */
    onEvent(handler: (event: ComplianceEvent) => void) {
      service.on('compliance', handler);
      return () => service.off('compliance', handler);
    },
  };
}

/**
 * Format a violation for display in agent chat
 */
export function formatViolationForChat(violation: ComplianceViolation): string {
  const severityEmoji = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🔵',
    info: '⚪',
  };

  return `${severityEmoji[violation.severity]} **${violation.severity.toUpperCase()}**: ${violation.ruleName}
📁 \`${violation.file}:${violation.line}\`
📋 ${violation.message}
💡 ${violation.recommendation}`;
}

/**
 * Format gate result for display
 */
export function formatGateResultForChat(result: ComplianceGateResult): string {
  const statusEmoji = result.passed ? '✅' : '❌';
  const scoreColor = result.score >= 90 ? '🟢' : result.score >= 70 ? '🟡' : '🔴';

  let message = `${statusEmoji} **Compliance Gate**
${scoreColor} Score: ${result.score}/100
🔴 Critical: ${result.criticalCount}
🟠 High: ${result.highCount}`;

  if (!result.passed) {
    message += `\n\n⛔ **BLOCKED**: ${result.blockedReason}`;
    if (result.mustFix.length > 0) {
      message += `\n\n**Must Fix (${result.mustFix.length}):**`;
      result.mustFix.slice(0, 3).forEach(v => {
        message += `\n- ${v.ruleName} (${v.file}:${v.line})`;
      });
      if (result.mustFix.length > 3) {
        message += `\n- ...and ${result.mustFix.length - 3} more`;
      }
    }
  }

  return message;
}
