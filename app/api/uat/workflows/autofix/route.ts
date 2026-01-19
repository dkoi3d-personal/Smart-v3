/**
 * Auto-Fix API for UAT Workflow Failures
 *
 * POST - Analyze a failure and apply fix using Coder agent
 */

import { NextRequest } from 'next/server';
import { getProjectDir } from '@/lib/project-paths';
import { claudeSubscriptionService } from '@/services/claude-subscription-service';
import { computerUseService } from '@/services/uat/computer-use-service';
import { AutoFixRequest } from '@/services/uat/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * POST - Analyze failure and apply fix
 *
 * Body: {
 *   projectId: string,
 *   failedStep: StepResult,
 *   screenshot: string (base64),
 *   domSnapshot?: string,
 *   applyFix?: boolean  // Actually apply the fix vs just suggest
 * }
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;

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
        const { projectId, workflowId, failedStep, screenshot, domSnapshot, applyFix = true } = body;

        if (!projectId || !failedStep || !screenshot) {
          send('error', { error: 'Missing required fields' });
          close();
          return;
        }

        const projectDir = getProjectDir(projectId);

        send('status', { status: 'analyzing' });

        // Use Computer Use service to analyze the failure
        const fixRequest: AutoFixRequest = {
          workflowId: workflowId || 'unknown',
          executionId: `fix-${Date.now()}`,
          failedStep,
          screenshot,
          domSnapshot,
        };

        const analysis = await computerUseService.analyzeFailure(fixRequest);

        send('analysis', {
          cause: analysis.fix?.description || 'Unknown cause',
          suggestedFix: analysis.fix,
          retryRecommended: analysis.retryRecommended,
        });

        if (!analysis.success || !analysis.fix) {
          send('error', { error: 'Could not determine fix' });
          close();
          return;
        }

        // Apply the fix using Coder agent if requested
        if (applyFix && analysis.fix) {
          send('status', { status: 'applying_fix' });

          const fixPrompt = `
You are fixing a UI bug found during automated testing.

FAILED TEST STEP:
- Action: ${failedStep.action}
- Error: ${failedStep.error}

ANALYSIS:
${analysis.fix.description}

SUGGESTED FILE: ${analysis.fix.file}

INSTRUCTIONS:
1. Find the file: ${analysis.fix.file}
2. Apply the fix described above
3. Verify the fix doesn't break other functionality
4. Report what you changed

Be surgical - only change what's necessary to fix this specific issue.
`;

          let fixApplied = false;
          let changedFiles: string[] = [];

          try {
            for await (const message of claudeSubscriptionService.runAgent(fixPrompt, {
              model: 'sonnet',
              maxTurns: 20,
              permissionMode: 'bypassPermissions',
              workingDirectory: projectDir,
            })) {
              if (message.type === 'text') {
                send('coder_output', { text: message.content });
              } else if (message.type === 'tool_use') {
                if (message.toolName === 'Edit' || message.toolName === 'Write') {
                  const filePath = message.toolInput?.file_path;
                  if (filePath) {
                    changedFiles.push(filePath);
                  }
                }
                send('tool_use', {
                  tool: message.toolName,
                  input: message.toolInput,
                });
              } else if (message.type === 'complete') {
                fixApplied = true;
              }
            }
          } catch (error) {
            send('error', {
              error: `Fix failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            });
          }

          send('fix_result', {
            applied: fixApplied,
            changedFiles,
            retryRecommended: analysis.retryRecommended,
          });
        }

        send('complete', {
          success: true,
          analysis: {
            cause: analysis.fix?.description,
            file: analysis.fix?.file,
          },
        });

      } catch (error) {
        send('error', {
          error: error instanceof Error ? error.message : 'Auto-fix failed',
        });
      } finally {
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
