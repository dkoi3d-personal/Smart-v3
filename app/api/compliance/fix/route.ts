/**
 * Compliance Auto-Fix API Endpoint
 *
 * POST /api/compliance/fix
 *   - Generate fix previews for violations
 *   - Apply fixes to files
 *
 * GET /api/compliance/fix
 *   - Get available fix strategies
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  ComplianceAutoFixer,
  generateAndPreviewFixes,
  applyComplianceFixes,
} from '@/lib/compliance';
import { ComplianceViolation, ComplianceFix, AutoFixResult } from '@/lib/compliance/types';

// ============================================================================
// TYPES
// ============================================================================

interface FixRequestBody {
  // Action to perform
  action: 'preview' | 'apply';

  // Violations to fix
  violations: ComplianceViolation[];

  // Project path for file operations
  projectPath: string;

  // Options
  options?: {
    dryRun?: boolean;
    backup?: boolean;
    includeReviewRequired?: boolean;
  };
}

interface FixPreviewResponse {
  success: boolean;
  fixes: Array<{
    violationId: string;
    file: string;
    originalCode: string;
    fixedCode: string;
    explanation: string;
    requiresReview: boolean;
    reviewNotes?: string;
  }>;
  preview: string;  // Markdown preview
  totalFixes: number;
  autoFixable: number;
  requiresReview: number;
}

interface FixApplyResponse {
  success: boolean;
  fixesApplied: number;
  fixesFailed: number;
  errors: string[];
  appliedFixes: Array<{
    violationId: string;
    file: string;
    status: 'applied' | 'failed' | 'skipped';
    error?: string;
  }>;
}

// ============================================================================
// POST - Generate/Apply Fixes
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: FixRequestBody = await request.json();

    if (!body.violations || body.violations.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No violations provided' },
        { status: 400 }
      );
    }

    if (body.action === 'preview') {
      // Generate fix previews
      const { fixes, preview } = await generateAndPreviewFixes(
        body.violations,
        body.projectPath
      );

      const response: FixPreviewResponse = {
        success: true,
        fixes: fixes.map(f => ({
          violationId: f.violationId,
          file: f.file,
          originalCode: f.originalCode,
          fixedCode: f.fixedCode,
          explanation: f.explanation,
          requiresReview: f.requiresReview,
          reviewNotes: f.reviewNotes,
        })),
        preview,
        totalFixes: fixes.length,
        autoFixable: fixes.filter(f => !f.requiresReview).length,
        requiresReview: fixes.filter(f => f.requiresReview).length,
      };

      return NextResponse.json(response);
    }

    if (body.action === 'apply') {
      // Apply fixes
      const result = await applyComplianceFixes(body.violations, {
        dryRun: body.options?.dryRun ?? false,
        backup: body.options?.backup ?? true,
        validateAfter: body.options?.includeReviewRequired ?? false,
      });

      const response: FixApplyResponse = {
        success: result.success,
        fixesApplied: result.fixesApplied,
        fixesFailed: result.fixesFailed,
        errors: result.errors,
        appliedFixes: result.fixes.map(f => ({
          violationId: f.violationId,
          file: f.file,
          status: 'applied' as const,
        })),
      };

      return NextResponse.json(response);
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use "preview" or "apply"' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Compliance fix error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Fix operation failed',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Get Available Strategies
// ============================================================================

export async function GET(): Promise<NextResponse> {
  const fixer = new ComplianceAutoFixer();
  const strategies = fixer.getAvailableStrategies();

  return NextResponse.json({
    success: true,
    totalStrategies: strategies.length,
    strategies: strategies.map(s => ({
      ruleId: s.ruleId,
      name: s.name,
      description: s.description,
      canAutoFix: s.canAutoFix,
      requiresReview: s.requiresReview,
    })),
  });
}
