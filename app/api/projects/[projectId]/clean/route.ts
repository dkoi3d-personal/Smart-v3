/**
 * Project Cleanup API
 *
 * POST /api/projects/[projectId]/clean
 *
 * Cleans a project directory to prepare for fresh initialization.
 * This is useful when:
 * - create-next-app fails due to non-empty directory
 * - Build artifacts cause conflicts
 * - Need to reset a project without losing git history
 *
 * Body parameters:
 * - mode: 'soft' | 'hard' | 'full'
 *   - soft: Only removes build artifacts (.next, node_modules, etc.)
 *   - hard: Removes everything except .git
 *   - full: Removes everything (complete reset)
 * - stopDevServer: boolean (default true) - Stop dev server before cleaning
 */

import { NextRequest, NextResponse } from 'next/server';
import { cleanProjectDir, resetProjectDir, getProjectDir } from '@/lib/project-paths';
import { devServerManager } from '@/services/dev-server-manager';
import * as fs from 'fs/promises';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  // Parse request body
  let mode: 'soft' | 'hard' | 'full' = 'soft';
  let stopDevServer = true;

  try {
    const body = await request.json();
    if (body.mode && ['soft', 'hard', 'full'].includes(body.mode)) {
      mode = body.mode;
    }
    if (typeof body.stopDevServer === 'boolean') {
      stopDevServer = body.stopDevServer;
    }
  } catch {
    // No body or invalid JSON, use defaults
  }

  console.log(`🧹 Clean request for project: ${projectId}, mode: ${mode}`);

  // Check if project directory exists
  const projectDir = getProjectDir(projectId);
  try {
    await fs.access(projectDir);
  } catch {
    return NextResponse.json(
      { error: 'Project directory not found' },
      { status: 404 }
    );
  }

  // Stop dev server if running (to release file handles)
  if (stopDevServer) {
    try {
      await devServerManager.stopDevServer(projectId);
      // Give Windows extra time to release handles
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log(`🛑 Stopped dev server for ${projectId}`);
    } catch (error) {
      console.warn(`⚠️ Could not stop dev server: ${error}`);
      // Continue anyway
    }
  }

  // Stop orchestrator if running
  const activeOrchestrators = (global as any).activeOrchestrators;
  if (activeOrchestrators && activeOrchestrators.has(projectId)) {
    const orchestrator = activeOrchestrators.get(projectId);
    try {
      await orchestrator.stop();
      activeOrchestrators.delete(projectId);
      orchestrator.removeAllListeners();
      console.log(`🛑 Stopped orchestrator for ${projectId}`);
    } catch (error) {
      console.warn(`⚠️ Could not stop orchestrator: ${error}`);
    }
  }

  // Perform cleanup
  const result = await cleanProjectDir(projectId, {
    mode,
    waitForHandles: 1500,
  });

  if (result.success) {
    console.log(`✅ Project ${projectId} cleaned successfully: ${result.message}`);
    return NextResponse.json({
      success: true,
      message: result.message,
      cleaned: result.cleaned,
      preserved: result.preserved,
    });
  } else {
    console.error(`❌ Project cleanup had errors: ${result.errors.join(', ')}`);
    return NextResponse.json({
      success: false,
      message: result.message,
      cleaned: result.cleaned,
      preserved: result.preserved,
      errors: result.errors,
    }, { status: 207 }); // 207 Multi-Status for partial success
  }
}
