/**
 * Audit API Endpoints
 *
 * Provides access to audit logs for compliance purposes (ISO 42001, EU AI Act, SOC 2)
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import path from 'path';
import { projects, ensureProjectsLoaded } from '@/app/api/projects/route';

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

/**
 * GET /api/audit/[projectId]
 *
 * Returns the project manifest and list of builds
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    console.log('[Audit API] GET /api/audit/' + projectId);

    // Load projects to find the working directory
    await ensureProjectsLoaded();
    const project = projects.get(projectId);

    if (!project) {
      console.log('[Audit API] Project not found:', projectId);
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    console.log('[Audit API] Project directory:', project.projectDirectory);
    const auditDir = path.join(project.projectDirectory, '.audit');
    console.log('[Audit API] Looking for audit dir:', auditDir);

    // Check if audit directory exists
    try {
      await fs.access(auditDir);
      console.log('[Audit API] Audit directory exists');
    } catch {
      console.log('[Audit API] Audit directory NOT found');
      return NextResponse.json({
        projectId,
        hasAuditData: false,
        message: 'No audit data available for this project',
        builds: [],
      });
    }

    // Load project manifest
    const manifestPath = path.join(auditDir, 'manifest.json');
    let manifest;
    try {
      const content = await fs.readFile(manifestPath, 'utf-8');
      manifest = JSON.parse(content);
      console.log('[Audit API] Loaded manifest with', manifest.builds?.length, 'builds');
    } catch (err) {
      console.log('[Audit API] Failed to load manifest:', err);
      return NextResponse.json({
        projectId,
        hasAuditData: false,
        message: 'Audit manifest not found',
        builds: [],
      });
    }

    console.log('[Audit API] Returning hasAuditData: true');
    return NextResponse.json({
      projectId,
      hasAuditData: true,
      manifest,
    });
  } catch (error) {
    console.error('[Audit API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit data' },
      { status: 500 }
    );
  }
}
