/**
 * Research Agent API
 * Analyzes a project and suggests enhancements
 */

import { NextRequest } from 'next/server';
import { multiAgentService } from '@/services/multi-agent-service';
import * as fs from 'fs/promises';
import { getProjectDir, projectDirExists } from '@/lib/project-paths';

export const dynamic = 'force-dynamic';

/**
 * Parse suggestions from text output using ===SUGGESTION_START=== markers
 */
function parseSuggestionsFromText(text: string): any[] {
  const suggestions: any[] = [];
  const regex = /===SUGGESTION_START===\s*([\s\S]*?)\s*===SUGGESTION_END===/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    try {
      const jsonStr = match[1].trim();
      const suggestion = JSON.parse(jsonStr);
      suggestions.push({
        id: `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...suggestion,
      });
    } catch (e) {
      console.log('[Research] Failed to parse suggestion:', match[1]);
    }
  }

  return suggestions;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { projectId, sessionId, requirements } = body;

  if (!projectId) {
    return new Response(
      JSON.stringify({ error: 'Project ID is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Setup project directory OUTSIDE of ai-dev-platform-v2
  const projectDir = getProjectDir(projectId);
  if (!await projectDirExists(projectId)) {
    return new Response(
      JSON.stringify({ error: 'Project not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Get or create session
  let session = sessionId ? multiAgentService.getSession(sessionId) : null;
  if (!session) {
    session = multiAgentService.createSession(projectId, projectDir);
  }

  // Setup SSE stream
  const encoder = new TextEncoder();

  // Track suggestions and accumulated text
  const suggestions: any[] = [];
  let accumulatedText = '';

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;

      const sendEvent = (event: string, data: any) => {
        if (isClosed) return;
        try {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (err) {
          isClosed = true;
        }
      };

      // Send initial connection
      sendEvent('connected', {
        sessionId: session!.id,
        projectId,
        agent: 'researcher',
      });

      try {
        // Run the researcher agent and parse suggestions from output
        for await (const message of multiAgentService.runResearcher(session!, requirements)) {
          // Send the agent message to the UI
          sendEvent('agent:message', {
            id: message.id,
            agentRole: message.agentRole,
            agentName: message.agentName,
            type: message.type,
            content: message.content,
            toolName: message.toolName,
            toolInput: message.toolInput,
            timestamp: message.timestamp.toISOString(),
          });

          // Accumulate text content to parse for suggestions
          if (message.type === 'result' || message.type === 'chat') {
            accumulatedText += message.content + '\n';

            // Try to parse suggestions from the accumulated text
            const newSuggestions = parseSuggestionsFromText(accumulatedText);
            for (const suggestion of newSuggestions) {
              // Only emit new suggestions (not already in array)
              if (!suggestions.some(s => s.title === suggestion.title)) {
                suggestions.push(suggestion);
                sendEvent('suggestion', suggestion);
                console.log('[Research] Found suggestion:', suggestion.title);
              }
            }
          }
        }

        sendEvent('complete', {
          sessionId: session!.id,
          status: 'success',
          totalSuggestions: suggestions.length,
          suggestions,
        });

      } catch (error) {
        sendEvent('error', {
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        isClosed = true;
        controller.close();
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
