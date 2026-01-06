/**
 * Code-to-Compliance Scan API Endpoint
 *
 * POST /api/compliance/scan
 *
 * Scans a project or code snippet for healthcare compliance violations.
 * Returns detailed violations, annotations, and recommendations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ComplianceScanner, formatViolation } from '@/lib/compliance/compliance-scanner';
import {
  ComplianceScanConfig,
  ComplianceScanResult,
  ComplianceSeverity,
  RegulationType,
} from '@/lib/compliance/types';
import { getProjectDir, projectDirExists } from '@/lib/project-paths';

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

interface ScanRequestBody {
  // Option 1: Scan a project directory
  projectPath?: string;
  projectId?: string;

  // Option 2: Scan code snippets directly
  codeSnippets?: {
    filename: string;
    content: string;
    language?: string;
  }[];

  // Configuration
  config?: Partial<ComplianceScanConfig>;

  // Output options
  outputFormat?: 'full' | 'summary' | 'violations-only';
  includeAnnotations?: boolean;
  includeRecommendations?: boolean;
}

interface ScanResponse {
  success: boolean;
  scanId: string;
  timestamp: string;
  duration: number;
  complianceScore: number;
  summary: {
    totalFiles: number;
    totalViolations: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  violations?: FormattedViolation[];
  annotations?: FormattedAnnotation[];
  recommendations?: FormattedRecommendation[];
  regulatoryCoverage?: RegulatoryCoverageItem[];
  error?: string;
}

interface FormattedViolation {
  id: string;
  severity: ComplianceSeverity;
  rule: string;
  ruleId: string;
  category: string;
  file: string;
  line: number;
  column: number;
  message: string;
  codeSnippet: string;
  regulations: string[];
  recommendation: string;
  autoFixAvailable: boolean;
}

interface FormattedAnnotation {
  file: string;
  line: number;
  comment: string;
  regulations: string[];
  dataClassification?: string;
  auditType?: string;
}

interface FormattedRecommendation {
  priority: number;
  title: string;
  description: string;
  effort: string;
  affectedFiles: number;
  steps: string[];
}

interface RegulatoryCoverageItem {
  regulation: string;
  coveragePercentage: number;
  status: 'compliant' | 'partial' | 'non-compliant';
  details: {
    section: string;
    status: string;
    issues: number;
  }[];
}

// ============================================================================
// API HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<ScanResponse>> {
  const startTime = Date.now();

  try {
    const body: ScanRequestBody = await request.json();

    // Resolve project path from projectId if not provided
    let resolvedProjectPath = body.projectPath;
    if (!resolvedProjectPath && body.projectId) {
      resolvedProjectPath = getProjectDir(body.projectId);
      // Verify the project directory exists
      const exists = await projectDirExists(body.projectId);
      if (!exists) {
        return NextResponse.json(
          {
            success: false,
            scanId: '',
            timestamp: new Date().toISOString(),
            duration: 0,
            complianceScore: 0,
            summary: { totalFiles: 0, totalViolations: 0, critical: 0, high: 0, medium: 0, low: 0 },
            error: `Project directory not found for projectId: ${body.projectId}`,
          },
          { status: 404 }
        );
      }
      console.log(`[Compliance] Resolved projectId ${body.projectId} to path: ${resolvedProjectPath}`);
    }

    // Validate request
    if (!resolvedProjectPath && !body.codeSnippets) {
      return NextResponse.json(
        {
          success: false,
          scanId: '',
          timestamp: new Date().toISOString(),
          duration: 0,
          complianceScore: 0,
          summary: { totalFiles: 0, totalViolations: 0, critical: 0, high: 0, medium: 0, low: 0 },
          error: 'Either projectPath, projectId, or codeSnippets must be provided',
        },
        { status: 400 }
      );
    }

    // Build scan configuration
    const scanConfig: Partial<ComplianceScanConfig> = {
      regulations: body.config?.regulations || ['HIPAA'],
      minSeverity: body.config?.minSeverity || 'low',
      include: body.config?.include || ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      exclude: body.config?.exclude || [
        '**/node_modules/**',
        '**/.next/**',
        '**/dist/**',
        '**/__tests__/**',
      ],
      autoAnnotate: body.includeAnnotations ?? true,
      generateReport: true,
      reportFormat: 'json',
    };

    // Create scanner
    const scanner = new ComplianceScanner(scanConfig);

    let result: ComplianceScanResult;

    if (resolvedProjectPath) {
      // Scan project directory
      result = await scanner.scan(resolvedProjectPath, body.projectId);
    } else if (body.codeSnippets) {
      // Scan code snippets - create temp files and scan
      result = await scanCodeSnippets(scanner, body.codeSnippets);
    } else {
      throw new Error('No scan target provided');
    }

    // Format response
    const response = formatScanResponse(result, body, startTime);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Compliance scan error:', error);

    return NextResponse.json(
      {
        success: false,
        scanId: '',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        complianceScore: 0,
        summary: { totalFiles: 0, totalViolations: 0, critical: 0, high: 0, medium: 0, low: 0 },
        error: error instanceof Error ? error.message : 'Scan failed',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - SCAN STATUS / INFO
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');

  if (action === 'rules') {
    // Return available rules
    const { HIPAA_RULES } = await import('@/lib/compliance/hipaa-rules');

    const rules = HIPAA_RULES.map(rule => ({
      id: rule.id,
      name: rule.name,
      description: rule.description,
      category: rule.category,
      severity: rule.severity,
      regulations: rule.regulations.map(r => `${r.regulation} ${r.section}`),
      autoFixable: rule.autoFixable,
    }));

    return NextResponse.json({
      success: true,
      totalRules: rules.length,
      rules,
    });
  }

  if (action === 'regulations') {
    // Return supported regulations
    return NextResponse.json({
      success: true,
      regulations: [
        {
          id: 'HIPAA',
          name: 'HIPAA Security Rule',
          description: 'Health Insurance Portability and Accountability Act - Technical Safeguards',
          sections: [
            { id: '164.312(a)(1)', name: 'Access Control', requirement: 'required' },
            { id: '164.312(b)', name: 'Audit Controls', requirement: 'required' },
            { id: '164.312(c)(1)', name: 'Integrity', requirement: 'required' },
            { id: '164.312(d)', name: 'Authentication', requirement: 'required' },
            { id: '164.312(e)(1)', name: 'Transmission Security', requirement: 'required' },
          ],
        },
        {
          id: 'HITECH',
          name: 'HITECH Act',
          description: 'Health Information Technology for Economic and Clinical Health Act',
          sections: [
            { id: 'Breach Notification', name: 'Breach Notification Rule', requirement: 'required' },
          ],
        },
        {
          id: 'HITRUST',
          name: 'HITRUST CSF',
          description: 'Common Security Framework for healthcare',
          sections: [],
        },
      ],
    });
  }

  if (action === 'categories') {
    // Return violation categories
    return NextResponse.json({
      success: true,
      categories: [
        { id: 'phi_exposure', name: 'PHI Exposure', description: 'Protected Health Information exposed in logs, URLs, etc.' },
        { id: 'encryption', name: 'Encryption', description: 'Missing or weak encryption' },
        { id: 'access_control', name: 'Access Control', description: 'Missing authentication/authorization' },
        { id: 'audit_logging', name: 'Audit Logging', description: 'Missing or incomplete audit trails' },
        { id: 'data_integrity', name: 'Data Integrity', description: 'Missing validation/checksums' },
        { id: 'transmission_security', name: 'Transmission Security', description: 'Insecure data transmission' },
        { id: 'authentication', name: 'Authentication', description: 'Weak or missing authentication' },
        { id: 'session_management', name: 'Session Management', description: 'Session security issues' },
        { id: 'error_handling', name: 'Error Handling', description: 'PHI in error messages' },
        { id: 'input_validation', name: 'Input Validation', description: 'SQL injection, XSS with PHI' },
        { id: 'key_management', name: 'Key Management', description: 'Hardcoded keys, weak key storage' },
        { id: 'minimum_necessary', name: 'Minimum Necessary', description: 'Excess data access' },
      ],
    });
  }

  // Default: return API info
  return NextResponse.json({
    success: true,
    name: 'Code-to-Compliance Scanner API',
    version: '1.0.0',
    description: 'Healthcare compliance scanning for HIPAA, HITECH, and HITRUST',
    endpoints: {
      'POST /api/compliance/scan': 'Scan project or code for compliance violations',
      'GET /api/compliance/scan?action=rules': 'List available compliance rules',
      'GET /api/compliance/scan?action=regulations': 'List supported regulations',
      'GET /api/compliance/scan?action=categories': 'List violation categories',
    },
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function scanCodeSnippets(
  scanner: ComplianceScanner,
  snippets: ScanRequestBody['codeSnippets']
): Promise<ComplianceScanResult> {
  // For code snippets, we create a virtual file system scan
  // In production, you'd write to temp files or use in-memory scanning

  const fs = await import('fs');
  const path = await import('path');
  const os = await import('os');

  // Create temp directory
  const tempDir = path.join(os.tmpdir(), `compliance-scan-${Date.now()}`);
  await fs.promises.mkdir(tempDir, { recursive: true });

  try {
    // Write snippets to temp files
    for (const snippet of snippets || []) {
      const filePath = path.join(tempDir, snippet.filename);
      const dir = path.dirname(filePath);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(filePath, snippet.content);
    }

    // Scan temp directory
    return await scanner.scan(tempDir);
  } finally {
    // Cleanup temp directory
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
}

function formatScanResponse(
  result: ComplianceScanResult,
  request: ScanRequestBody,
  startTime: number
): ScanResponse {
  const response: ScanResponse = {
    success: true,
    scanId: result.scanId,
    timestamp: result.timestamp.toISOString(),
    duration: Date.now() - startTime,
    complianceScore: result.summary.complianceScore,
    summary: {
      totalFiles: result.summary.totalFiles,
      totalViolations: result.summary.totalViolations,
      critical: result.summary.bySeverity.critical,
      high: result.summary.bySeverity.high,
      medium: result.summary.bySeverity.medium,
      low: result.summary.bySeverity.low,
    },
  };

  // Include violations unless summary-only
  if (request.outputFormat !== 'summary') {
    response.violations = result.violations.map(v => ({
      id: v.id,
      severity: v.severity,
      rule: v.ruleName,
      ruleId: v.ruleId,
      category: v.category,
      file: v.file,
      line: v.line,
      column: v.column,
      message: v.message,
      codeSnippet: v.codeSnippet,
      regulations: v.regulations.map(r => `${r.regulation} §${r.section}`),
      recommendation: v.recommendation,
      autoFixAvailable: v.autoFixAvailable,
    }));
  }

  // Include annotations if requested
  if (request.includeAnnotations !== false && request.outputFormat === 'full') {
    response.annotations = result.annotations.map(a => ({
      file: a.file,
      line: a.line,
      comment: `// @compliance: ${a.regulations.map(r => `${r.regulation} ${r.section}`).join(', ')}`,
      regulations: a.regulations.map(r => `${r.regulation} §${r.section}`),
      dataClassification: a.dataClassification,
      auditType: a.auditType,
    }));
  }

  // Include recommendations if requested
  if (request.includeRecommendations !== false && request.outputFormat !== 'violations-only') {
    response.recommendations = result.recommendations.map(r => ({
      priority: r.priority,
      title: r.title,
      description: r.description,
      effort: r.estimatedEffort,
      affectedFiles: r.affectedFiles.length,
      steps: r.steps,
    }));
  }

  // Include regulatory coverage
  if (request.outputFormat === 'full') {
    response.regulatoryCoverage = result.regulatoryCoverage.map(rc => ({
      regulation: rc.regulation,
      coveragePercentage: rc.coveragePercentage,
      status:
        rc.coveragePercentage >= 90
          ? 'compliant'
          : rc.coveragePercentage >= 50
            ? 'partial'
            : 'non-compliant',
      details: rc.details.map(d => ({
        section: d.section,
        status: d.status,
        issues: d.findings.length,
      })),
    }));
  }

  return response;
}
