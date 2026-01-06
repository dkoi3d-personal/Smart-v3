/**
 * Security Module - Main Export
 * Provides comprehensive security scanning for DevSecOps
 */

import { SASTScanner, sastScanner, type SASTScanResult, type SASTFinding } from './sast-scanner';
import { SecretScanner, secretScanner, type SecretScanResult, type SecretFinding } from './secret-scanner';
import { DependencyScanner, dependencyScanner, type DependencyScanResult, type DependencyVulnerability } from './dependency-scanner';
import { SecurityScoringEngine, scoringEngine, type SecurityMetrics, type SecurityScore, type OWASPCompliance } from './scoring';

export interface ComprehensiveSecurityReport {
  projectDirectory: string;
  scanTimestamp: Date;
  scanDuration: number;
  metrics: SecurityMetrics;
  sast: SASTScanResult;
  secrets: SecretScanResult;
  dependencies: DependencyScanResult;
}

export class SecurityService {
  private sastScanner: SASTScanner;
  private secretScanner: SecretScanner;
  private depScanner: DependencyScanner;
  private scoringEngine: SecurityScoringEngine;

  constructor() {
    this.sastScanner = sastScanner;
    this.secretScanner = secretScanner;
    this.depScanner = dependencyScanner;
    this.scoringEngine = scoringEngine;
  }

  /**
   * Run comprehensive security scan
   */
  async scan(projectDirectory: string): Promise<ComprehensiveSecurityReport> {
    const startTime = Date.now();

    // Run all scans in parallel
    const [sastResult, secretResult, depResult] = await Promise.all([
      this.sastScanner.scan(projectDirectory),
      this.secretScanner.scan(projectDirectory),
      this.depScanner.scan(projectDirectory),
    ]);

    // Calculate metrics
    const metrics = this.scoringEngine.calculateMetrics(sastResult, secretResult, depResult);

    return {
      projectDirectory,
      scanTimestamp: new Date(),
      scanDuration: Date.now() - startTime,
      metrics,
      sast: sastResult,
      secrets: secretResult,
      dependencies: depResult,
    };
  }

  /**
   * Run only SAST scan
   */
  async scanSAST(projectDirectory: string): Promise<SASTScanResult> {
    return this.sastScanner.scan(projectDirectory);
  }

  /**
   * Run only secret detection
   */
  async scanSecrets(projectDirectory: string): Promise<SecretScanResult> {
    return this.secretScanner.scan(projectDirectory);
  }

  /**
   * Run only dependency scan
   */
  async scanDependencies(projectDirectory: string): Promise<DependencyScanResult> {
    return this.depScanner.scan(projectDirectory);
  }

  /**
   * Get security metrics from existing scan results
   */
  calculateMetrics(
    sastResult?: SASTScanResult,
    secretResult?: SecretScanResult,
    depResult?: DependencyScanResult
  ): SecurityMetrics {
    return this.scoringEngine.calculateMetrics(sastResult, secretResult, depResult);
  }

  /**
   * Format report for display
   */
  formatReportSummary(report: ComprehensiveSecurityReport): string {
    const { metrics, sast, secrets, dependencies } = report;
    const score = metrics.score;

    let summary = `
╔══════════════════════════════════════════════════════════════╗
║                    SECURITY SCAN REPORT                      ║
╠══════════════════════════════════════════════════════════════╣
║  Overall Score: ${score.overall.toString().padStart(3)} / 100    Grade: ${score.grade}    Risk: ${score.riskLevel.toUpperCase().padEnd(8)} ║
╠══════════════════════════════════════════════════════════════╣
║  FINDINGS SUMMARY                                            ║
║  ├─ Critical: ${metrics.summary.criticalFindings.toString().padStart(3)}                                           ║
║  ├─ High:     ${metrics.summary.highFindings.toString().padStart(3)}                                           ║
║  ├─ Medium:   ${metrics.summary.mediumFindings.toString().padStart(3)}                                           ║
║  └─ Low:      ${metrics.summary.lowFindings.toString().padStart(3)}                                           ║
╠══════════════════════════════════════════════════════════════╣
║  SCAN BREAKDOWN                                              ║
║  ├─ SAST Score:         ${score.breakdown.sast.toString().padStart(3)} (${sast.findings.length} findings)${' '.repeat(17)}║
║  ├─ Secrets Score:      ${score.breakdown.secrets.toString().padStart(3)} (${secrets.findings.length} secrets found)${' '.repeat(12)}║
║  └─ Dependencies Score: ${score.breakdown.dependencies.toString().padStart(3)} (${dependencies.vulnerabilities.length} vulnerable)${' '.repeat(12)}║
╠══════════════════════════════════════════════════════════════╣
║  OWASP TOP 10 COMPLIANCE                                     ║`;

    for (const [id, data] of Object.entries(metrics.owasp)) {
      const status = data.status === 'pass' ? '✓' : data.status === 'fail' ? '✗' : '⚠';
      const statusPad = data.name.padEnd(25);
      summary += `\n║  ${status} ${id}: ${statusPad}${data.findings > 0 ? `(${data.findings})` : '    '} ║`;
    }

    summary += `
╠══════════════════════════════════════════════════════════════╣
║  TOP RECOMMENDATIONS                                         ║`;

    for (const rec of metrics.recommendations.slice(0, 3)) {
      const icon = rec.priority === 'critical' ? '🔴' : rec.priority === 'high' ? '🟠' : '🟡';
      summary += `\n║  ${icon} ${rec.title.substring(0, 50).padEnd(50)}   ║`;
    }

    summary += `
╚══════════════════════════════════════════════════════════════╝
`;

    return summary;
  }
}

export const securityService = new SecurityService();

// Re-export types
export type {
  SASTScanResult,
  SASTFinding,
  SecretScanResult,
  SecretFinding,
  DependencyScanResult,
  DependencyVulnerability,
  SecurityMetrics,
  SecurityScore,
  OWASPCompliance,
};
