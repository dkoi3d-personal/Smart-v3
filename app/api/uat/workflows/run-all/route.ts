/**
 * Run All Workflows API - Regression Testing
 *
 * POST - Execute all (or filtered) workflows for a project
 * Streams progress via SSE
 */

import { NextRequest, NextResponse } from 'next/server';
import { browserService } from '@/services/uat/browser-service';
import { computerUseService } from '@/services/uat/computer-use-service';
import { getProjectDir } from '@/lib/project-paths';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  UIWorkflow,
  WorkflowExecution,
  BatchExecution,
  BatchWorkflowResult,
} from '@/services/uat/types';

export const runtime = 'nodejs';
export const maxDuration = 600; // 10 minutes max for full regression

/**
 * POST - Run all workflows
 *
 * Body: {
 *   projectId: string,
 *   previewUrl: string,
 *   mode: 'all' | 'failed' | 'critical',  // Which workflows to run
 *   autoFix?: boolean,                     // Auto-fix failures
 *   stopOnFailure?: boolean                // Stop batch on first failure
 * }
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;
      const batchId = `batch-${Date.now()}`;
      const sessionId = `batch-session-${Date.now()}`;

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
        const {
          projectId,
          previewUrl,
          mode = 'all',
          autoFix = true,
          stopOnFailure = false,
        } = body;

        if (!projectId || !previewUrl) {
          send('error', { error: 'Missing required fields' });
          close();
          return;
        }

        const projectDir = getProjectDir(projectId);
        const workflowsPath = path.join(projectDir, '.uat/workflows.json');

        // Load workflows
        let workflows: UIWorkflow[];
        try {
          const content = await fs.readFile(workflowsPath, 'utf-8');
          workflows = JSON.parse(content);
        } catch {
          send('error', { error: 'No workflows found for project' });
          close();
          return;
        }

        // Filter workflows based on mode
        let workflowsToRun = workflows;
        if (mode === 'failed') {
          workflowsToRun = workflows.filter(
            w => w.stats?.lastRun?.status === 'failed'
          );
        } else if (mode === 'critical') {
          workflowsToRun = workflows.filter(
            w => w.priority === 'critical' || w.priority === 'high'
          );
        }

        // Sort by priority
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        workflowsToRun.sort(
          (a, b) =>
            (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3)
        );

        if (workflowsToRun.length === 0) {
          send('error', { error: `No ${mode} workflows to run` });
          close();
          return;
        }

        // Initialize batch execution
        const batch: BatchExecution = {
          id: batchId,
          projectId,
          status: 'running',
          startedAt: new Date().toISOString(),
          mode,
          results: [],
          summary: {
            total: workflowsToRun.length,
            passed: 0,
            failed: 0,
            skipped: 0,
            duration: 0,
          },
        };

        send('batch_start', {
          batchId,
          mode,
          totalWorkflows: workflowsToRun.length,
          workflows: workflowsToRun.map(w => ({
            id: w.id,
            name: w.name,
            priority: w.priority,
          })),
        });

        // Create browser page
        await browserService.createPage(sessionId, { width: 1920, height: 1080 });
        send('status', { status: 'browser_ready' });

        const batchStartTime = Date.now();

        // Execute each workflow
        for (let i = 0; i < workflowsToRun.length; i++) {
          const workflow = workflowsToRun[i];
          const workflowStartTime = Date.now();

          send('workflow_start', {
            index: i + 1,
            total: workflowsToRun.length,
            workflowId: workflow.id,
            workflowName: workflow.name,
            priority: workflow.priority,
          });

          try {
            // Navigate to preview URL
            await browserService.navigate(sessionId, previewUrl);

            // Execute workflow
            const execution = await browserService.executeWorkflow(
              sessionId,
              workflow,
              {
                stopOnFailure: true,
                screenshotEachStep: false,
              }
            );

            const duration = Date.now() - workflowStartTime;
            const passed = execution.status === 'passed';

            const result: BatchWorkflowResult = {
              workflowId: workflow.id,
              workflowName: workflow.name,
              priority: workflow.priority,
              status: passed ? 'passed' : 'failed',
              duration,
              executionId: execution.id,
            };

            if (!passed && execution.summary?.failedSteps?.[0]) {
              result.failedStep = execution.summary.failedSteps[0];
              result.error = execution.summary.failedSteps[0].error;
            }

            batch.results.push(result);

            if (passed) {
              batch.summary.passed++;
            } else {
              batch.summary.failed++;
            }

            // Update workflow stats
            await updateWorkflowStats(workflowsPath, workflow.id, {
              passed,
              duration,
              executionId: execution.id,
            });

            send('workflow_complete', {
              index: i + 1,
              ...result,
            });

            // Auto-fix if enabled and failed
            if (!passed && autoFix) {
              send('autofix_start', { workflowId: workflow.id });

              const failedStep = execution.results.find(r => r.status === 'failed');
              if (failedStep?.screenshot) {
                const fixResult = await computerUseService.analyzeFailure({
                  workflowId: workflow.id,
                  executionId: execution.id,
                  failedStep,
                  screenshot: failedStep.screenshot,
                });

                send('autofix_result', {
                  workflowId: workflow.id,
                  success: fixResult.success,
                  fix: fixResult.fix,
                  retryRecommended: fixResult.retryRecommended,
                });
              }
            }

            // Stop batch if requested and failed
            if (!passed && stopOnFailure) {
              // Mark remaining as skipped
              for (let j = i + 1; j < workflowsToRun.length; j++) {
                batch.results.push({
                  workflowId: workflowsToRun[j].id,
                  workflowName: workflowsToRun[j].name,
                  priority: workflowsToRun[j].priority,
                  status: 'skipped',
                  duration: 0,
                });
                batch.summary.skipped++;
              }
              break;
            }
          } catch (error) {
            const duration = Date.now() - workflowStartTime;

            batch.results.push({
              workflowId: workflow.id,
              workflowName: workflow.name,
              priority: workflow.priority,
              status: 'failed',
              duration,
              error: error instanceof Error ? error.message : 'Unknown error',
            });

            batch.summary.failed++;

            send('workflow_error', {
              index: i + 1,
              workflowId: workflow.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });

            if (stopOnFailure) {
              for (let j = i + 1; j < workflowsToRun.length; j++) {
                batch.results.push({
                  workflowId: workflowsToRun[j].id,
                  workflowName: workflowsToRun[j].name,
                  priority: workflowsToRun[j].priority,
                  status: 'skipped',
                  duration: 0,
                });
                batch.summary.skipped++;
              }
              break;
            }
          }
        }

        // Finalize batch
        batch.status = 'completed';
        batch.completedAt = new Date().toISOString();
        batch.summary.duration = Date.now() - batchStartTime;

        // Save batch execution history
        await saveBatchExecution(projectDir, batch);

        send('batch_complete', {
          batchId,
          summary: batch.summary,
          passRate: Math.round(
            (batch.summary.passed / batch.summary.total) * 100
          ),
        });

        send('status', { status: 'done' });
      } catch (error) {
        send('error', {
          error: error instanceof Error ? error.message : 'Batch execution failed',
        });
      } finally {
        // Cleanup
        try {
          await browserService.closePage(sessionId);
        } catch {}
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

/**
 * Save batch execution to history
 */
async function saveBatchExecution(
  projectDir: string,
  batch: BatchExecution
): Promise<void> {
  const historyPath = path.join(projectDir, '.uat/batch-history.json');

  let history: BatchExecution[] = [];
  try {
    const content = await fs.readFile(historyPath, 'utf-8');
    history = JSON.parse(content);
  } catch {}

  history.push(batch);

  // Keep only last 20 batch runs
  if (history.length > 20) {
    history = history.slice(-20);
  }

  await fs.writeFile(historyPath, JSON.stringify(history, null, 2));
}

/**
 * GET - Get batch execution history
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }

    const projectDir = getProjectDir(projectId);
    const historyPath = path.join(projectDir, '.uat/batch-history.json');

    try {
      const content = await fs.readFile(historyPath, 'utf-8');
      const history: BatchExecution[] = JSON.parse(content);

      return NextResponse.json({
        success: true,
        history,
        count: history.length,
      });
    } catch {
      return NextResponse.json({
        success: true,
        history: [],
        count: 0,
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get history' },
      { status: 500 }
    );
  }
}
