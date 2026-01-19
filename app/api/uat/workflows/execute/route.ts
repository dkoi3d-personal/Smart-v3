/**
 * Workflow Execution API
 *
 * POST - Execute a saved workflow and return results
 * Streams progress via SSE
 */

import { NextRequest, NextResponse } from 'next/server';
import { browserService } from '@/services/uat/browser-service';
import { computerUseService } from '@/services/uat/computer-use-service';
import { getProjectDir } from '@/lib/project-paths';
import * as fs from 'fs/promises';
import * as path from 'path';
import { UIWorkflow, WorkflowExecution, AutoFixRequest } from '@/services/uat/types';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max

/**
 * POST - Execute a workflow
 *
 * Body: {
 *   projectId: string,
 *   workflowId: string,
 *   previewUrl: string,
 *   options?: {
 *     stopOnFailure?: boolean,
 *     screenshotEachStep?: boolean,
 *     autoFix?: boolean  // Attempt to auto-fix failures
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;
      const sessionId = `exec-${Date.now()}`;

      const send = (event: string, data: any) => {
        if (isClosed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          isClosed = true;
        }
      };

      const close = () => {
        if (!isClosed) {
          isClosed = true;
          controller.close();
        }
      };

      try {
        const body = await request.json();
        const { projectId, workflowId, previewUrl, options = {} } = body;

        if (!projectId || !workflowId || !previewUrl) {
          send('error', { error: 'Missing required fields' });
          close();
          return;
        }

        send('status', { status: 'starting', sessionId });

        // Load workflow
        const projectDir = getProjectDir(projectId);
        const workflowsPath = path.join(projectDir, '.uat/workflows.json');

        let workflows: UIWorkflow[];
        try {
          const content = await fs.readFile(workflowsPath, 'utf-8');
          workflows = JSON.parse(content);
        } catch {
          send('error', { error: 'No workflows found for project' });
          close();
          return;
        }

        const workflow = workflows.find(w => w.id === workflowId);
        if (!workflow) {
          send('error', { error: `Workflow ${workflowId} not found` });
          close();
          return;
        }

        send('workflow', {
          id: workflow.id,
          name: workflow.name,
          stepCount: workflow.steps.length,
        });

        // Create browser page
        await browserService.createPage(sessionId, { width: 1920, height: 1080 });
        send('status', { status: 'browser_ready' });

        // Navigate to preview URL first (override workflow start URL)
        await browserService.navigate(sessionId, previewUrl);
        send('status', { status: 'navigated', url: previewUrl });

        // Execute workflow
        const execution = await browserService.executeWorkflow(sessionId, workflow, {
          stopOnFailure: options.stopOnFailure ?? false,
          screenshotEachStep: options.screenshotEachStep ?? true,
        });

        // Send step-by-step results
        for (const result of execution.results) {
          send('step_result', result);
        }

        // Handle auto-fix if enabled and there are failures
        if (options.autoFix && execution.status === 'failed') {
          send('status', { status: 'analyzing_failures' });

          for (const result of execution.results.filter(r => r.status === 'failed')) {
            send('autofix_start', { stepId: result.stepId });

            const fixRequest: AutoFixRequest = {
              workflowId: workflow.id,
              executionId: execution.id,
              failedStep: result,
              screenshot: result.screenshot || '',
            };

            const fixResult = await computerUseService.analyzeFailure(fixRequest);

            send('autofix_result', {
              stepId: result.stepId,
              ...fixResult,
            });
          }
        }

        // Send final execution summary
        send('complete', {
          execution: {
            id: execution.id,
            status: execution.status,
            summary: execution.summary,
          },
        });

        // Update workflow stats
        await updateWorkflowStats(workflowsPath, workflow.id, {
          passed: execution.status === 'passed',
          duration: execution.summary?.duration || 0,
          executionId: execution.id,
        });

        // Save execution to history
        await saveExecution(projectDir, execution);

        send('status', { status: 'done' });

      } catch (error) {
        send('error', {
          error: error instanceof Error ? error.message : 'Execution failed',
        });
      } finally {
        // Cleanup
        try {
          await browserService.closePage(sessionId);
        } catch { }
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * Save execution to history
 */
async function saveExecution(projectDir: string, execution: WorkflowExecution): Promise<void> {
  const historyPath = path.join(projectDir, '.uat/executions.json');

  let executions: WorkflowExecution[] = [];
  try {
    const content = await fs.readFile(historyPath, 'utf-8');
    executions = JSON.parse(content);
  } catch { }

  executions.push(execution);

  // Keep only last 50 executions
  if (executions.length > 50) {
    executions = executions.slice(-50);
  }

  await fs.writeFile(historyPath, JSON.stringify(executions, null, 2));
}

/**
 * GET - Get execution history
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const workflowId = searchParams.get('workflowId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }

    const projectDir = getProjectDir(projectId);
    const historyPath = path.join(projectDir, '.uat/executions.json');

    try {
      const content = await fs.readFile(historyPath, 'utf-8');
      let executions: WorkflowExecution[] = JSON.parse(content);

      if (workflowId) {
        executions = executions.filter(e => e.workflowId === workflowId);
      }

      return NextResponse.json({
        success: true,
        executions,
        count: executions.length,
      });
    } catch {
      return NextResponse.json({
        success: true,
        executions: [],
        count: 0,
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get executions' },
      { status: 500 }
    );
  }
}

/**
 * Update workflow stats after execution
 */
async function updateWorkflowStats(
  workflowsPath: string,
  workflowId: string,
  result: { passed: boolean; duration: number; executionId: string }
): Promise<void> {
  try {
    const content = await fs.readFile(workflowsPath, 'utf-8');
    const workflows: UIWorkflow[] = JSON.parse(content);

    const index = workflows.findIndex(w => w.id === workflowId);
    if (index === -1) return;

    const workflow = workflows[index];

    // Initialize stats if missing
    if (!workflow.stats) {
      workflow.stats = {
        runCount: 0,
        passCount: 0,
        failCount: 0,
        passRate: 0,
        avgDuration: 0,
      };
    }

    // Update stats
    workflow.stats.runCount++;
    if (result.passed) {
      workflow.stats.passCount++;
    } else {
      workflow.stats.failCount++;
    }
    workflow.stats.passRate = Math.round(
      (workflow.stats.passCount / workflow.stats.runCount) * 100
    );
    workflow.stats.avgDuration = Math.round(
      (workflow.stats.avgDuration * (workflow.stats.runCount - 1) +
        result.duration) /
        workflow.stats.runCount
    );
    workflow.stats.lastRun = {
      date: new Date().toISOString(),
      status: result.passed ? 'passed' : 'failed',
      duration: result.duration,
      executionId: result.executionId,
    };

    workflows[index] = workflow;
    await fs.writeFile(workflowsPath, JSON.stringify(workflows, null, 2));
  } catch (error) {
    console.error('Failed to update workflow stats:', error);
  }
}
