/**
 * UAT Workflows API
 *
 * GET  - List workflows for a project
 * POST - Create/save a workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProjectDir } from '@/lib/project-paths';
import * as fs from 'fs/promises';
import * as path from 'path';
import { UIWorkflow } from '@/services/uat/types';

const WORKFLOWS_FILE = '.uat/workflows.json';

/**
 * GET - List all workflows for a project
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }

    const projectDir = getProjectDir(projectId);
    const workflowsPath = path.join(projectDir, WORKFLOWS_FILE);

    try {
      const content = await fs.readFile(workflowsPath, 'utf-8');
      const workflows: UIWorkflow[] = JSON.parse(content);

      return NextResponse.json({
        success: true,
        workflows,
        count: workflows.length,
      });
    } catch {
      // No workflows file yet
      return NextResponse.json({
        success: true,
        workflows: [],
        count: 0,
      });
    }
  } catch (error) {
    console.error('[Workflows API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list workflows' },
      { status: 500 }
    );
  }
}

/**
 * POST - Save a workflow
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId, workflow } = await request.json();

    if (!projectId || !workflow) {
      return NextResponse.json(
        { error: 'Project ID and workflow required' },
        { status: 400 }
      );
    }

    const projectDir = getProjectDir(projectId);
    const uatDir = path.join(projectDir, '.uat');
    const workflowsPath = path.join(uatDir, 'workflows.json');

    // Ensure .uat directory exists
    await fs.mkdir(uatDir, { recursive: true });

    // Load existing workflows
    let workflows: UIWorkflow[] = [];
    try {
      const content = await fs.readFile(workflowsPath, 'utf-8');
      workflows = JSON.parse(content);
    } catch {
      // No existing file
    }

    // Check if updating existing or adding new
    const existingIndex = workflows.findIndex(w => w.id === workflow.id);
    if (existingIndex >= 0) {
      workflows[existingIndex] = {
        ...workflows[existingIndex],
        ...workflow,
        updatedAt: new Date().toISOString(),
      };
    } else {
      // New workflow - initialize with default stats
      workflows.push({
        ...workflow,
        id: workflow.id || `workflow-${Date.now()}`,
        priority: workflow.priority || 'medium',
        createdAt: workflow.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stats: workflow.stats || {
          runCount: 0,
          passCount: 0,
          failCount: 0,
          passRate: 0,
          avgDuration: 0,
        },
      });
    }

    // Save workflows
    await fs.writeFile(workflowsPath, JSON.stringify(workflows, null, 2));

    return NextResponse.json({
      success: true,
      workflow: workflows[existingIndex >= 0 ? existingIndex : workflows.length - 1],
      message: existingIndex >= 0 ? 'Workflow updated' : 'Workflow created',
    });
  } catch (error) {
    console.error('[Workflows API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save workflow' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete a workflow
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const workflowId = searchParams.get('workflowId');

    if (!projectId || !workflowId) {
      return NextResponse.json(
        { error: 'Project ID and workflow ID required' },
        { status: 400 }
      );
    }

    const projectDir = getProjectDir(projectId);
    const workflowsPath = path.join(projectDir, WORKFLOWS_FILE);

    try {
      const content = await fs.readFile(workflowsPath, 'utf-8');
      let workflows: UIWorkflow[] = JSON.parse(content);

      const originalCount = workflows.length;
      workflows = workflows.filter(w => w.id !== workflowId);

      if (workflows.length === originalCount) {
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
      }

      await fs.writeFile(workflowsPath, JSON.stringify(workflows, null, 2));

      return NextResponse.json({
        success: true,
        message: 'Workflow deleted',
      });
    } catch {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('[Workflows API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete workflow' },
      { status: 500 }
    );
  }
}
