import { NextRequest, NextResponse } from 'next/server';
import { securityService } from '@/lib/security';
import { getProjectDir } from '@/lib/project-paths';
import type { SecurityReport } from '@/lib/agents/types';

export async function POST(request: NextRequest) {
  try {
    const { projectId, scanType = 'comprehensive' } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Get project directory
    const projectDir = getProjectDir(projectId);

    console.log(`[Security Scan] Starting ${scanType} scan for ${projectId} in ${projectDir}`);

    // Run the appropriate scan
    const result = await securityService.scan(projectDir);

    // Transform to SecurityReport format for UI
    const report: SecurityReport = {
      score: result.metrics.score.overall,
      grade: result.metrics.score.grade,
      riskLevel: result.metrics.score.riskLevel,
      vulnerabilities: [
        // SAST findings
        ...result.sast.findings.map(f => ({
          id: f.id,
          severity: f.severity as 'critical' | 'high' | 'medium' | 'low' | 'info',
          title: f.title,
          description: f.description,
          file: f.file,
          line: f.line,
          cwe: f.cwe,
          owasp: f.owasp,
          category: f.category,
          recommendation: f.remediation,
          autoFixAvailable: f.autoFixable,
        })),
        // Secret findings
        ...result.secrets.findings.map(f => ({
          id: f.id,
          severity: f.severity as 'critical' | 'high' | 'medium' | 'low' | 'info',
          title: `${f.type}: ${f.name}`,
          description: f.description,
          file: f.file,
          line: f.line,
          category: 'SECRETS',
          recommendation: f.remediation,
          autoFixAvailable: false,
        })),
        // Dependency vulnerabilities
        ...result.dependencies.vulnerabilities.map(v => ({
          id: v.id,
          severity: (v.severity === 'moderate' ? 'medium' : v.severity) as 'critical' | 'high' | 'medium' | 'low' | 'info',
          title: `${v.packageName}@${v.installedVersion}: ${v.title}`,
          description: v.description,
          cve: v.cve?.join(', '),
          cwe: v.cwe?.join(', '),
          category: 'DEPENDENCIES',
          recommendation: v.recommendation,
          autoFixAvailable: !!v.patchedVersions,
        })),
      ],
      owaspCompliance: result.metrics.owasp as unknown as { [key: string]: { name: string; status: 'pass' | 'fail' | 'warning' | 'unknown'; findings: number; } },
      breakdown: result.metrics.score.breakdown,
      summary: result.metrics.summary,
      categories: result.metrics.categories,
      recommendations: result.metrics.recommendations,
      scanDate: result.scanTimestamp,
      scanDuration: result.scanDuration,
    };

    console.log(`[Security Scan] Complete. Score: ${report.score}, Grade: ${report.grade}, Findings: ${report.vulnerabilities.length}`);

    return NextResponse.json({
      success: true,
      report,
      summary: {
        score: report.score,
        grade: report.grade,
        totalFindings: report.vulnerabilities.length,
        criticalFindings: report.vulnerabilities.filter(v => v.severity === 'critical').length,
        highFindings: report.vulnerabilities.filter(v => v.severity === 'high').length,
      }
    });
  } catch (error) {
    console.error('[Security Scan] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Security scan failed' },
      { status: 500 }
    );
  }
}
