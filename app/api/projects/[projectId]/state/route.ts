/**
 * Project State API - Load and save full project state for resume functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  loadFullProjectState,
  saveProjectState,
  updateBuildMetrics,
  updateTestingMetrics,
  updateSecurityMetrics,
  updateDoraMetrics,
  updateTasks,
  updateEpics,
  type ProjectState,
  type BuildMetrics,
  type TestingMetrics,
  type SecurityMetrics,
  type DoraMetrics,
  aggregateTestResults,
} from '@/lib/project-persistence';
import { resolveProjectPath } from '@/lib/project-path-resolver';

/**
 * GET - Load full project state for resume
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const projectDir = await resolveProjectPath(projectId);

    const state = await loadFullProjectState(projectDir);

    if (!state) {
      return NextResponse.json(
        { error: 'Project state not found' },
        { status: 404 }
      );
    }

    // Recalculate test metrics from story files (more accurate than event-based)
    const aggregatedTests = await aggregateTestResults(projectDir);
    if (aggregatedTests.totalTests > 0) {
      const currentTotal = state.testingMetrics?.totalTests || 0;
      if (aggregatedTests.totalTests > currentTotal) {
        console.log(`[State API] Recalculating test metrics: ${currentTotal} -> ${aggregatedTests.totalTests}, coverage: ${aggregatedTests.coverage}%`);
        state.testingMetrics = {
          skipped: state.testingMetrics?.skipped ?? 0,
          duration: state.testingMetrics?.duration ?? 0,
          testFiles: state.testingMetrics?.testFiles ?? [],
          seenTaskIds: state.testingMetrics?.seenTaskIds ?? [],
          ...state.testingMetrics,
          totalTests: aggregatedTests.totalTests,
          passed: aggregatedTests.passed,
          failed: aggregatedTests.failed,
          storiesTested: aggregatedTests.storiesTested,
          storiesPassed: aggregatedTests.storiesTested,
          passRate: aggregatedTests.totalTests > 0
            ? (aggregatedTests.passed / aggregatedTests.totalTests) * 100
            : 0,
          coverage: aggregatedTests.coverage, // Average coverage from story files
        };
        // Persist the fix
        await saveProjectState(projectDir, state);
      }
    }

    return NextResponse.json({
      success: true,
      projectId,
      state,
    });
  } catch (error: any) {
    console.error('❌ Failed to load project state:', error);
    return NextResponse.json(
      { error: 'Failed to load project state', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update project state (for saving metrics during build)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const projectDir = await resolveProjectPath(projectId);
    const body = await request.json();

    const {
      buildMetrics,
      testingMetrics,
      securityMetrics,
      doraMetrics,
      tasks,
      epics,
      status,
      progress,
    } = body;

    // Update each metric type if provided
    if (buildMetrics) {
      await updateBuildMetrics(projectDir, buildMetrics);
    }

    if (testingMetrics) {
      await updateTestingMetrics(projectDir, testingMetrics);
    }

    if (securityMetrics) {
      await updateSecurityMetrics(projectDir, securityMetrics);
    }

    if (doraMetrics) {
      await updateDoraMetrics(projectDir, doraMetrics);
    }

    if (tasks) {
      await updateTasks(projectDir, tasks);
    }

    if (epics) {
      await updateEpics(projectDir, epics);
    }

    // Update status/progress if provided
    if (status !== undefined || progress !== undefined) {
      const state = await loadFullProjectState(projectDir);
      await saveProjectState(projectDir, {
        ...state,
        status: status || state?.status,
        progress: progress ?? state?.progress,
      });
    }

    return NextResponse.json({
      success: true,
      projectId,
      message: 'Project state updated',
    });
  } catch (error: any) {
    console.error('❌ Failed to update project state:', error);
    return NextResponse.json(
      { error: 'Failed to update project state', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Partial update of specific metrics
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const projectDir = await resolveProjectPath(projectId);
    const body = await request.json();

    const { type, data } = body;

    switch (type) {
      case 'buildMetrics':
        await updateBuildMetrics(projectDir, data as Partial<BuildMetrics>);
        break;
      case 'testingMetrics':
        await updateTestingMetrics(projectDir, data as TestingMetrics);
        break;
      case 'securityMetrics':
        await updateSecurityMetrics(projectDir, data as SecurityMetrics);
        break;
      case 'doraMetrics':
        await updateDoraMetrics(projectDir, data as DoraMetrics);
        break;
      case 'tasks':
        await updateTasks(projectDir, data);
        break;
      default:
        return NextResponse.json(
          { error: `Unknown metric type: ${type}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      projectId,
      type,
      message: `${type} updated`,
    });
  } catch (error: any) {
    console.error('❌ Failed to patch project state:', error);
    return NextResponse.json(
      { error: 'Failed to patch project state', details: error.message },
      { status: 500 }
    );
  }
}
