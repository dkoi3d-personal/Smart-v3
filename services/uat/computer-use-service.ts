/**
 * Computer Use Service - Claude API Integration
 *
 * Uses Claude's Computer Use capability to:
 * - Explore and record UI workflows
 * - Identify bugs and issues
 * - Generate test assertions
 */

import Anthropic from '@anthropic-ai/sdk';
import { browserService } from './browser-service';
import {
  UIWorkflow,
  WorkflowStep,
  BrandConfig,
  EMPLOYERS_BRAND,
  AutoFixRequest,
  AutoFixResult,
} from './types';

// =============================================================================
// Types
// =============================================================================

interface ComputerToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: Array<{
    type: 'image';
    source: {
      type: 'base64';
      media_type: 'image/png';
      data: string;
    };
  }>;
}

interface RecordingState {
  sessionId: string;
  projectId: string;
  steps: WorkflowStep[];
  stepCounter: number;
  startUrl: string;
  brand: BrandConfig;
}

// =============================================================================
// Computer Use Service
// =============================================================================

class ComputerUseService {
  private anthropic: Anthropic;
  private recordingStates: Map<string, RecordingState> = new Map();

  constructor() {
    this.anthropic = new Anthropic();
  }

  /**
   * Record a workflow using Computer Use
   * Claude will explore the app and generate a workflow
   */
  async *recordWorkflow(options: {
    sessionId: string;
    projectId: string;
    startUrl: string;
    task: string;
    brand?: BrandConfig;
    maxSteps?: number;
    priority?: 'critical' | 'high' | 'medium' | 'low';
  }): AsyncGenerator<{
    type: 'step' | 'screenshot' | 'thinking' | 'complete' | 'error';
    data: any;
  }> {
    const { sessionId, projectId, startUrl, task, brand = EMPLOYERS_BRAND, maxSteps = 50, priority = 'medium' } = options;

    // Initialize recording state
    const state: RecordingState = {
      sessionId,
      projectId,
      steps: [],
      stepCounter: 0,
      startUrl,
      brand,
    };
    this.recordingStates.set(sessionId, state);

    try {
      // Navigate to start URL
      await browserService.navigate(sessionId, startUrl);
      yield { type: 'step', data: { action: 'navigate', url: startUrl } };

      // Take initial screenshot
      const initialScreenshot = await browserService.screenshot(sessionId);
      yield { type: 'screenshot', data: { screenshot: initialScreenshot } };

      // Build the Computer Use prompt
      const systemPrompt = this.buildRecordingPrompt(task, brand);

      // Start the Computer Use loop
      let messages: any[] = [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: initialScreenshot,
              },
            },
            {
              type: 'text',
              text: `You are looking at a web application. Your task is: ${task}\n\nExplore the application and perform the task. I'll record each action you take as a workflow step. Start by analyzing what you see and then take your first action.`,
            },
          ],
        },
      ];

      let stepCount = 0;

      while (stepCount < maxSteps) {
        // Call Claude with Computer Use
        // Note: Computer Use tool schema differs from standard tools
        const response = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemPrompt,
          tools: [
            {
              type: 'computer_20241022',
              name: 'computer',
              display_width_px: 1920,
              display_height_px: 1080,
              display_number: 1,
            } as any,
          ],
          messages,
        });

        // Process response
        let hasToolUse = false;
        let toolUseId = '';
        let actionTaken: any = null;

        for (const block of response.content) {
          if (block.type === 'text') {
            yield { type: 'thinking', data: { text: block.text } };
          } else if (block.type === 'tool_use' && block.name === 'computer') {
            hasToolUse = true;
            toolUseId = block.id;
            const input = block.input as any;
            actionTaken = input;

            // Execute the action
            const result = await this.executeComputerAction(sessionId, input);

            // Record the step
            if (input.action !== 'screenshot') {
              const step = this.actionToWorkflowStep(input, state.stepCounter++);
              state.steps.push(step);
              yield { type: 'step', data: step };
            }

            // Send screenshot result
            if (result.screenshot) {
              yield { type: 'screenshot', data: { screenshot: result.screenshot } };

              // Add tool result to messages
              messages.push({
                role: 'assistant',
                content: response.content,
              });
              messages.push({
                role: 'user',
                content: [
                  {
                    type: 'tool_result',
                    tool_use_id: toolUseId,
                    content: [
                      {
                        type: 'image',
                        source: {
                          type: 'base64',
                          media_type: 'image/png',
                          data: result.screenshot,
                        },
                      },
                    ],
                  },
                ],
              });
            }

            stepCount++;
          }
        }

        // Check if task is complete
        if (response.stop_reason === 'end_turn' && !hasToolUse) {
          break;
        }

        // Check for explicit completion
        const lastText = response.content.find(b => b.type === 'text');
        if (lastText && 'text' in lastText) {
          const text = lastText.text.toLowerCase();
          if (
            text.includes('task complete') ||
            text.includes('workflow complete') ||
            text.includes('finished recording')
          ) {
            break;
          }
        }
      }

      // Build final workflow
      const workflow: UIWorkflow = {
        id: `workflow-${Date.now()}`,
        name: task.slice(0, 50),
        description: task,
        projectId,
        steps: state.steps,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        priority,
        stats: {
          runCount: 0,
          passCount: 0,
          failCount: 0,
          passRate: 0,
          avgDuration: 0,
        },
        brandConfig: brand,
        recordedFrom: {
          url: startUrl,
          viewport: { width: 1920, height: 1080 },
        },
      };

      yield { type: 'complete', data: { workflow } };

    } catch (error) {
      yield {
        type: 'error',
        data: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    } finally {
      this.recordingStates.delete(sessionId);
    }
  }

  /**
   * Analyze a failed step and suggest fixes
   */
  async analyzeFailure(request: AutoFixRequest): Promise<AutoFixResult> {
    try {
      const prompt = `You are analyzing a failed UI test step. Here's the context:

FAILED STEP:
- Action: ${request.failedStep.action}
- Sequence: ${request.failedStep.sequence}
- Error: ${request.failedStep.error}
- Duration: ${request.failedStep.duration}ms

SCREENSHOT OF FAILURE:
[See attached image]

${request.domSnapshot ? `DOM SNAPSHOT:\n${request.domSnapshot.slice(0, 5000)}` : ''}

${request.relevantFiles ? `RELEVANT CODE FILES:\n${request.relevantFiles.join('\n')}` : ''}

Analyze the failure and determine:
1. What caused the failure (selector changed? element missing? timing issue?)
2. What file and code change would fix it
3. Whether the test should be retried after the fix

Respond in JSON format:
{
  "cause": "description of what caused the failure",
  "fix": {
    "file": "path/to/file.tsx",
    "description": "what change to make",
    "suggestedCode": "the code to add/change"
  },
  "retryRecommended": true/false
}`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: request.screenshot,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      });

      // Parse response
      const textBlock = response.content.find(b => b.type === 'text');
      if (textBlock && 'text' in textBlock) {
        const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            success: true,
            fix: parsed.fix,
            retryRecommended: parsed.retryRecommended,
          };
        }
      }

      return {
        success: false,
        error: 'Could not parse fix suggestion',
        retryRecommended: false,
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryRecommended: false,
      };
    }
  }

  /**
   * Build the system prompt for recording
   */
  private buildRecordingPrompt(task: string, brand: BrandConfig): string {
    return `You are a QA engineer recording a UI test workflow for an ${brand.name}-branded web application.

BRAND GUIDELINES:
- Primary color: ${brand.colors.primary}
- Secondary color: ${brand.colors.secondary || 'N/A'}
${brand.logo?.selector ? `- Logo should be visible: ${brand.logo.selector}` : ''}

YOUR TASK: ${task}

INSTRUCTIONS:
1. Analyze the current screen carefully
2. Take deliberate actions to complete the task
3. After each action, I'll show you the result
4. Note any brand compliance issues (colors, logo, fonts)
5. When the task is complete, say "Task complete" and summarize what was done

BEST PRACTICES:
- Wait for elements to load before clicking
- Use clear, specific interactions
- Verify each step succeeded before continuing
- Report any bugs or issues you encounter

When you've completed the task, summarize the workflow and any issues found.`;
  }

  /**
   * Execute a Computer Use action
   */
  private async executeComputerAction(
    sessionId: string,
    input: any
  ): Promise<{ success: boolean; screenshot?: string; error?: string }> {
    try {
      switch (input.action) {
        case 'screenshot':
          const screenshot = await browserService.screenshot(sessionId);
          return { success: true, screenshot };

        case 'click':
        case 'left_click':
          if (input.coordinate) {
            await browserService.executeAction(sessionId, {
              type: 'click',
              coordinate: input.coordinate,
            });
          }
          break;

        case 'type':
          if (input.text) {
            await browserService.executeAction(sessionId, {
              type: 'type',
              text: input.text,
            });
          }
          break;

        case 'key':
          if (input.key) {
            await browserService.executeAction(sessionId, {
              type: 'key',
              key: input.key,
            });
          }
          break;

        case 'scroll':
          await browserService.executeAction(sessionId, {
            type: 'scroll',
            scrollDirection: input.direction || 'down',
            scrollAmount: input.amount || 300,
          });
          break;

        case 'mouse_move':
          if (input.coordinate) {
            await browserService.executeAction(sessionId, {
              type: 'move',
              coordinate: input.coordinate,
            });
          }
          break;
      }

      // Always take screenshot after action
      const afterScreenshot = await browserService.screenshot(sessionId);
      return { success: true, screenshot: afterScreenshot };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Convert a Computer Use action to a WorkflowStep
   */
  private actionToWorkflowStep(input: any, sequence: number): WorkflowStep {
    const step: WorkflowStep = {
      id: `step-${Date.now()}-${sequence}`,
      sequence,
      action: 'click',
      timestamp: Date.now(),
    };

    switch (input.action) {
      case 'click':
      case 'left_click':
        step.action = 'click';
        if (input.coordinate) {
          step.coordinates = { x: input.coordinate[0], y: input.coordinate[1] };
        }
        break;

      case 'type':
        step.action = 'type';
        step.value = input.text;
        break;

      case 'key':
        step.action = 'type';
        step.value = input.key;
        break;

      case 'scroll':
        step.action = 'scroll';
        step.coordinates = { x: 0, y: input.amount || 300 };
        break;
    }

    return step;
  }
}

// Export singleton
export const computerUseService = new ComputerUseService();
