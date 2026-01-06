/**
 * UAT Bug Fix API
 * Uses ClaudeSubscriptionService to fix bugs - uses subscription, not API credits
 */

import { NextRequest } from 'next/server';
import { getProjectDir } from '@/lib/project-paths';
import { claudeSubscriptionService } from '@/services/claude-subscription-service';
import * as fs from 'fs/promises';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const body = await request.json();
    const { projectId, bugId, bug, additionalInstructions } = body;

    if (!projectId || !bug) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const projectDir = getProjectDir(projectId).replace(/\\/g, '/');

    // Check if directory exists
    try {
      await fs.access(projectDir);
    } catch {
      return new Response(JSON.stringify({ error: 'Project directory not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build prompt
    const prompt = buildFixPrompt(bug, additionalInstructions);

    const stream = new ReadableStream({
      async start(controller) {
        let isClosed = false;

        const sendLog = (message: string) => {
          if (isClosed) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ log: message })}\n\n`));
          } catch { isClosed = true; }
        };

        const sendStatus = (status: string, data?: any) => {
          if (isClosed) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status, ...data })}\n\n`));
          } catch { isClosed = true; }
        };

        sendLog(`🔧 Fixing: ${bug.title}`);
        sendLog(`📁 Working in: ${projectDir}`);
        sendLog(`⏳ Running Claude (subscription mode)...`);

        try {
          // Use the existing ClaudeSubscriptionService
          for await (const message of claudeSubscriptionService.runAgent(prompt, {
            model: 'sonnet',
            maxTurns: 10,
            permissionMode: 'bypassPermissions',
            workingDirectory: projectDir,
          })) {
            if (message.type === 'text') {
              sendLog(`🤖 ${message.content.slice(0, 500)}`);
            } else if (message.type === 'tool_use') {
              sendLog(`🔧 ${message.content}`);
            } else if (message.type === 'tool_result') {
              sendLog(`📄 ${message.content.slice(0, 200)}`);
            } else if (message.type === 'complete') {
              sendLog(`✅ ${message.content.slice(0, 500)}`);
            } else if (message.type === 'error') {
              sendLog(`❌ ${message.content}`);
            }
          }

          sendLog(`✅ Fix completed successfully`);
          sendStatus('complete', { success: true });
        } catch (err: any) {
          sendLog(`❌ Error: ${err.message}`);
          sendStatus('error', { error: err.message });
        }

        isClosed = true;
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function buildFixPrompt(bug: any, additionalInstructions?: string): string {
  let prompt = `Fix this bug in the codebase:

BUG TITLE: ${bug.title}

DESCRIPTION: ${bug.description}

STEPS TO REPRODUCE:
${bug.steps || 'Not provided'}

EXPECTED BEHAVIOR: ${bug.expected || 'Not provided'}

ACTUAL BEHAVIOR: ${bug.actual || 'Not provided'}

Please:
1. Find the relevant files
2. Identify the root cause
3. Fix the bug
4. Make sure the fix doesn't break anything else`;

  if (additionalInstructions) {
    prompt += `\n\nADDITIONAL INSTRUCTIONS:\n${additionalInstructions}`;
  }

  return prompt;
}
