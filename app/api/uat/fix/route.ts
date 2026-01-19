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
            maxTurns: 25, // Increased for complex fixes
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
  // Build structured prompt for better AI understanding
  const categoryHints: Record<string, string> = {
    ui: 'Look in React components, CSS/Tailwind classes, or style files',
    functionality: 'Check event handlers, state management, and business logic',
    data: 'Examine API routes, data fetching, Prisma queries, or state updates',
    navigation: 'Look at routing, Link components, redirects, and navigation handlers',
    form: 'Check form validation, input handling, and submission logic',
    performance: 'Look for inefficient renders, missing memoization, or heavy computations',
    other: 'Search across the codebase for related functionality',
  };

  const categoryHint = categoryHints[bug.category] || categoryHints.other;

  let prompt = `Fix this bug in the codebase:

=== BUG REPORT ===
TITLE: ${bug.title}
CATEGORY: ${bug.category || 'other'}
SEVERITY: ${bug.severity || 'medium'}
${bug.affectedArea ? `AFFECTED AREA: ${bug.affectedArea}` : ''}
REPRODUCIBILITY: ${bug.reproducibility || 'always'}

=== PROBLEM ===
${bug.actual || bug.description}

${bug.expected ? `=== EXPECTED BEHAVIOR ===\n${bug.expected}` : ''}

${bug.steps ? `=== STEPS TO REPRODUCE ===\n${bug.steps}` : ''}

${bug.errorMessages ? `=== ERROR MESSAGES ===\n${bug.errorMessages}` : ''}

=== INSTRUCTIONS ===
1. SEARCH: ${categoryHint}
2. IDENTIFY: Find the root cause of the bug
3. FIX: Make the minimal changes needed to fix the issue
4. VERIFY: Ensure your fix doesn't break anything else

IMPORTANT:
- DO NOT run npm run build or npm run dev
- DO NOT stop until you have actually edited the file(s) to fix the bug
- If you identify the issue, you MUST edit the file to fix it
- After editing, confirm what you changed`;

  if (additionalInstructions) {
    prompt += `\n\n=== ADDITIONAL CONTEXT ===\n${additionalInstructions}`;
  }

  return prompt;
}
