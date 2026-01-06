/**
 * Security Scoring Engine
 * Calculates comprehensive security scores and grades for projects
 */

import type { SASTScanResult, SASTFinding } from './sast-scanner';
import type { SecretScanResult, SecretFinding } from './secret-scanner';
import type { DependencyScanResult, DependencyVulnerability } from './dependency-scanner';

export interface SecurityScore {
  overall: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: {
    sast: number; // Static analysis score
    secrets: number; // Secret detection score
    dependencies: number; // Dependency vulnerability score
    codeQuality: number; // General code quality
  };
  trend?: 'improving' | 'stable' | 'declining';
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'minimal';
}

export interface OWASPCompliance {
  'A01:2021': { name: string; status: 'pass' | 'fail' | 'warning' | 'unknown'; findings: number };
  'A02:2021': { name: string; status: 'pass' | 'fail' | 'warning' | 'unknown'; findings: number };
  'A03:2021': { name: string; status: 'pass' | 'fail' | 'warning' | 'unknown'; findings: number };
  'A04:2021': { name: string; status: 'pass' | 'fail' | 'warning' | 'unknown'; findings: number };
  'A05:2021': { name: string; status: 'pass' | 'fail' | 'warning' | 'unknown'; findings: number };
  'A06:2021': { name: string; status: 'pass' | 'fail' | 'warning' | 'unknown'; findings: number };
  'A07:2021': { name: string; status: 'pass' | 'fail' | 'warning' | 'unknown'; findings: number };
  'A08:2021': { name: string; status: 'pass' | 'fail' | 'warning' | 'unknown'; findings: number };
  'A09:2021': { name: string; status: 'pass' | 'fail' | 'warning' | 'unknown'; findings: number };
  'A10:2021': { name: string; status: 'pass' | 'fail' | 'warning' | 'unknown'; findings: number };
}

export interface SecurityMetrics {
  score: SecurityScore;
  owasp: OWASPCompliance;
  summary: {
    totalFindings: number;
    criticalFindings: number;
    highFindings: number;
    mediumFindings: number;
    lowFindings: number;
    fixableFindings: number;
  };
  categories: {
    name: string;
    count: number;
    severity: 'critical' | 'high' | 'medium' | 'low';
  }[];
  recommendations: {
    priority: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    effort: 'low' | 'medium' | 'high';
  }[];
  scanTimestamp: Date;
}

// Severity weights for scoring
const SEVERITY_WEIGHTS = {
  critical: 25,
  high: 15,
  medium: 5,
  moderate: 5,
  low: 1,
};

// OWASP Top 10 2021 mapping
const OWASP_CATEGORIES: Record<string, { id: keyof OWASPCompliance; name: string }> = {
  'A01:2021': { id: 'A01:2021', name: 'Broken Access Control' },
  'A02:2021': { id: 'A02:2021', name: 'Cryptographic Failures' },
  'A03:2021': { id: 'A03:2021', name: 'Injection' },
  'A04:2021': { id: 'A04:2021', name: 'Insecure Design' },
  'A05:2021': { id: 'A05:2021', name: 'Security Misconfiguration' },
  'A06:2021': { id: 'A06:2021', name: 'Vulnerable Components' },
  'A07:2021': { id: 'A07:2021', name: 'Auth Failures' },
  'A08:2021': { id: 'A08:2021', name: 'Data Integrity Failures' },
  'A09:2021': { id: 'A09:2021', name: 'Logging Failures' },
  'A10:2021': { id: 'A10:2021', name: 'SSRF' },
};

export class SecurityScoringEngine {
  calculateMetrics(
    sastResult?: SASTScanResult,
    secretResult?: SecretScanResult,
    depResult?: DependencyScanResult
  ): SecurityMetrics {
    // Collect all findings
    const allFindings: Array<{
      severity: 'critical' | 'high' | 'medium' | 'low';
      category: string;
      owasp?: string;
      autoFixable?: boolean;
    }> = [];

    // Add SAST findings
    if (sastResult) {
      for (const finding of sastResult.findings) {
        allFindings.push({
          severity: finding.severity,
          category: finding.category,
          owasp: finding.owasp,
          autoFixable: finding.autoFixable,
        });
      }
    }

    // Add secret findings
    if (secretResult) {
      for (const finding of secretResult.findings) {
        allFindings.push({
          severity: finding.severity,
          category: 'HARDCODED_SECRET',
          owasp: 'A02:2021', // Cryptographic Failures
          autoFixable: false,
        });
      }
    }

    // Add dependency vulnerabilities
    if (depResult) {
      for (const vuln of depResult.vulnerabilities) {
        const severity = vuln.severity === 'moderate' ? 'medium' : vuln.severity;
        allFindings.push({
          severity: severity as 'critical' | 'high' | 'medium' | 'low',
          category: 'VULNERABLE_DEPENDENCY',
          owasp: 'A06:2021', // Vulnerable Components
          autoFixable: true,
        });
      }
    }

    // Calculate scores
    const score = this.calculateScore(sastResult, secretResult, depResult, allFindings);

    // Calculate OWASP compliance
    const owasp = this.calculateOWASPCompliance(allFindings);

    // Calculate summary
    const summary = {
      totalFindings: allFindings.length,
      criticalFindings: allFindings.filter(f => f.severity === 'critical').length,
      highFindings: allFindings.filter(f => f.severity === 'high').length,
      mediumFindings: allFindings.filter(f => f.severity === 'medium').length,
      lowFindings: allFindings.filter(f => f.severity === 'low').length,
      fixableFindings: allFindings.filter(f => f.autoFixable).length,
    };

    // Build category breakdown
    const categoryMap = new Map<string, { count: number; maxSeverity: string }>();
    for (const finding of allFindings) {
      const existing = categoryMap.get(finding.category);
      if (existing) {
        existing.count++;
        if (this.compareSeverity(finding.severity, existing.maxSeverity as 'critical' | 'high' | 'medium' | 'low') > 0) {
          existing.maxSeverity = finding.severity;
        }
      } else {
        categoryMap.set(finding.category, { count: 1, maxSeverity: finding.severity });
      }
    }

    const categories = Array.from(categoryMap.entries()).map(([name, data]) => ({
      name: this.formatCategoryName(name),
      count: data.count,
      severity: data.maxSeverity as 'critical' | 'high' | 'medium' | 'low',
    }));

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      sastResult,
      secretResult,
      depResult,
      allFindings
    );

    return {
      score,
      owasp,
      summary,
      categories,
      recommendations,
      scanTimestamp: new Date(),
    };
  }

  private calculateScore(
    sastResult?: SASTScanResult,
    secretResult?: SecretScanResult,
    depResult?: DependencyScanResult,
    allFindings?: Array<{ severity: 'critical' | 'high' | 'medium' | 'low' }>
  ): SecurityScore {
    // Calculate individual scores
    const sastScore = this.calculateSASTScore(sastResult);
    const secretsScore = this.calculateSecretsScore(secretResult);
    const depsScore = this.calculateDependencyScore(depResult);

    // Calculate deductions from all findings
    let totalDeductions = 0;
    if (allFindings) {
      for (const finding of allFindings) {
        totalDeductions += SEVERITY_WEIGHTS[finding.severity] || 0;
      }
    }

    // Cap deductions at 100
    totalDeductions = Math.min(totalDeductions, 100);

    // Overall score is weighted average minus deductions
    const baseScore = (sastScore * 0.35 + secretsScore * 0.35 + depsScore * 0.3);
    const overall = Math.max(0, Math.round(baseScore - (totalDeductions * 0.5)));

    return {
      overall,
      grade: this.getGrade(overall),
      breakdown: {
        sast: sastScore,
        secrets: secretsScore,
        dependencies: depsScore,
        codeQuality: Math.round((sastScore + secretsScore) / 2),
      },
      riskLevel: this.getRiskLevel(overall, allFindings || []),
    };
  }

  private calculateSASTScore(result?: SASTScanResult): number {
    if (!result) return 100;

    let deductions = 0;
    deductions += result.summary.critical * SEVERITY_WEIGHTS.critical;
    deductions += result.summary.high * SEVERITY_WEIGHTS.high;
    deductions += result.summary.medium * SEVERITY_WEIGHTS.medium;
    deductions += result.summary.low * SEVERITY_WEIGHTS.low;

    return Math.max(0, 100 - Math.min(deductions, 100));
  }

  private calculateSecretsScore(result?: SecretScanResult): number {
    if (!result) return 100;

    let deductions = 0;
    deductions += result.summary.critical * SEVERITY_WEIGHTS.critical;
    deductions += result.summary.high * SEVERITY_WEIGHTS.high;
    deductions += result.summary.medium * SEVERITY_WEIGHTS.medium;

    return Math.max(0, 100 - Math.min(deductions, 100));
  }

  private calculateDependencyScore(result?: DependencyScanResult): number {
    if (!result) return 100;

    let deductions = 0;
    deductions += result.summary.critical * SEVERITY_WEIGHTS.critical;
    deductions += result.summary.high * SEVERITY_WEIGHTS.high;
    deductions += result.summary.moderate * SEVERITY_WEIGHTS.medium;
    deductions += result.summary.low * SEVERITY_WEIGHTS.low;

    // Add small deduction for outdated packages
    deductions += result.summary.outdated * 0.5;

    return Math.max(0, 100 - Math.min(deductions, 100));
  }

  private calculateOWASPCompliance(
    findings: Array<{ severity: string; owasp?: string }>
  ): OWASPCompliance {
    const compliance = {} as OWASPCompliance;

    // Initialize all categories
    for (const [id, info] of Object.entries(OWASP_CATEGORIES)) {
      const owaspId = id as keyof OWASPCompliance;
      compliance[owaspId] = {
        name: info.name,
        status: 'pass',
        findings: 0,
      };
    }

    // Count findings per category
    for (const finding of findings) {
      if (finding.owasp && compliance[finding.owasp as keyof OWASPCompliance]) {
        const category = compliance[finding.owasp as keyof OWASPCompliance];
        category.findings++;

        // Update status based on severity
        if (finding.severity === 'critical' || finding.severity === 'high') {
          category.status = 'fail';
        } else if (category.status !== 'fail' && finding.severity === 'medium') {
          category.status = 'warning';
        }
      }
    }

    return compliance;
  }

  private getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private getRiskLevel(
    score: number,
    findings: Array<{ severity: 'critical' | 'high' | 'medium' | 'low' }>
  ): 'critical' | 'high' | 'medium' | 'low' | 'minimal' {
    const criticalCount = findings.filter(f => f.severity === 'critical').length;
    const highCount = findings.filter(f => f.severity === 'high').length;

    if (criticalCount > 0 || score < 40) return 'critical';
    if (highCount > 2 || score < 60) return 'high';
    if (highCount > 0 || score < 75) return 'medium';
    if (score < 90) return 'low';
    return 'minimal';
  }

  private compareSeverity(a: string, b: string): number {
    const order = { critical: 4, high: 3, medium: 2, low: 1 };
    return (order[a as keyof typeof order] || 0) - (order[b as keyof typeof order] || 0);
  }

  private formatCategoryName(category: string): string {
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private generateRecommendations(
    sastResult?: SASTScanResult,
    secretResult?: SecretScanResult,
    depResult?: DependencyScanResult,
    allFindings?: Array<{ severity: string; category: string }>
  ): SecurityMetrics['recommendations'] {
    const recommendations: SecurityMetrics['recommendations'] = [];

    // Critical: Secrets found
    if (secretResult && secretResult.summary.total > 0) {
      recommendations.push({
        priority: 'critical',
        title: 'Remove Hardcoded Secrets',
        description: `Found ${secretResult.summary.total} hardcoded secrets. Move all secrets to environment variables or a secrets manager immediately.`,
        effort: 'low',
      });
    }

    // Critical: Vulnerable dependencies
    if (depResult && depResult.summary.critical > 0) {
      recommendations.push({
        priority: 'critical',
        title: 'Update Critical Dependencies',
        description: `${depResult.summary.critical} critical vulnerabilities in dependencies. Run 'npm audit fix' or manually update affected packages.`,
        effort: 'medium',
      });
    }

    // High: Injection vulnerabilities
    if (sastResult) {
      const injectionFindings = sastResult.findings.filter(
        f => f.category === 'SQL_INJECTION' || f.category === 'COMMAND_INJECTION' || f.category === 'XSS'
      );
      if (injectionFindings.length > 0) {
        recommendations.push({
          priority: 'high',
          title: 'Fix Injection Vulnerabilities',
          description: `Found ${injectionFindings.length} potential injection vulnerabilities. Use parameterized queries, input validation, and output encoding.`,
          effort: 'medium',
        });
      }
    }

    // Medium: Outdated packages
    if (depResult && depResult.summary.outdated > 5) {
      recommendations.push({
        priority: 'medium',
        title: 'Update Outdated Dependencies',
        description: `${depResult.summary.outdated} packages are outdated. Consider running 'npm update' to get security patches.`,
        effort: 'low',
      });
    }

    // Medium: Weak cryptography
    if (sastResult) {
      const cryptoFindings = sastResult.findings.filter(f => f.category === 'INSECURE_CRYPTO');
      if (cryptoFindings.length > 0) {
        recommendations.push({
          priority: 'medium',
          title: 'Upgrade Cryptographic Functions',
          description: `Found ${cryptoFindings.length} uses of weak cryptography (MD5, SHA1). Upgrade to SHA-256 or stronger.`,
          effort: 'low',
        });
      }
    }

    // Low: Security headers
    if (sastResult) {
      const configFindings = sastResult.findings.filter(f => f.category === 'SECURITY_MISCONFIGURATION');
      if (configFindings.length > 0) {
        recommendations.push({
          priority: 'low',
          title: 'Improve Security Configuration',
          description: 'Add security headers using helmet middleware. Configure proper CORS, cookies, and CSP.',
          effort: 'low',
        });
      }
    }

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return recommendations;
  }
}

export const scoringEngine = new SecurityScoringEngine();
