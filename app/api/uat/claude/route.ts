/**
 * Claude Terminal API - Persistent Context Mode
 * Provides a Claude Code interface for developers that maintains conversation context
 * Uses ClaudeSubscriptionService - subscription based, not API credits
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProjectDir } from '@/lib/project-paths';
import { claudeSubscriptionService } from '@/services/claude-subscription-service';
import {
  createSession,
  addSessionMessage,
  destroySession,
} from '@/services/session-service';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';
export const maxDuration = 120;

// Maximum number of messages to include in context (to avoid token limits)
const MAX_CONTEXT_MESSAGES = 20;

interface ConversationMessage {
  role: string;
  content: string;
}

/**
 * Build conversation context from session history
 */
function buildContextPrompt(messages: ConversationMessage[]): string {
  if (messages.length === 0) return '';

  const contextLines = [
    '--- CONVERSATION HISTORY ---',
    'The following is our previous conversation. Use this context to understand what we have discussed and maintain continuity:',
    '',
  ];

  for (const msg of messages) {
    if (msg.role === 'user') {
      contextLines.push('User: ' + msg.content);
    } else {
      contextLines.push('Assistant: ' + msg.content);
    }
    contextLines.push('');
  }

  contextLines.push('--- END HISTORY ---');
  contextLines.push('');
  contextLines.push('Now respond to the following new message:');
  contextLines.push('');

  return contextLines.join('\n');
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;

      const sendOutput = (text: string) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ output: text })}\n\n`));
        } catch { isClosed = true; }
      };

      const sendStatus = (status: string, data?: any) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status, ...data })}\n\n`));
        } catch { isClosed = true; }
      };

      const safeClose = () => {
        isClosed = true;
        controller.close();
      };

      try {
        const { projectId, command } = await request.json();

        if (!projectId || !command) {
          sendOutput('Error: Missing project ID or command\n');
          sendStatus('error', { error: 'Missing required fields' });
          safeClose();
          return;
        }

        const projectDir = getProjectDir(projectId).replace(/\\/g, '/');
        let fullResponse = '';

        // Load or create session for persistent context
        const session = await createSession({
          projectId,
          projectDir,
          resumeIfExists: true,
        });

        // Build context from previous conversation
        const conversationHistory = session.messages
          .filter(m => m.metadata?.isTerminalMessage)
          .slice(-MAX_CONTEXT_MESSAGES)
          .map(m => ({
            role: (m.metadata?.role as string) || 'user',
            content: m.content,
          }));

        const contextPrompt = buildContextPrompt(conversationHistory);
        const fullPrompt = contextPrompt + command;

        // Save user message to session
        await addSessionMessage(projectId, projectDir, {
          id: uuidv4(),
          agentId: 'uat-terminal',
          agentType: 'coder',
          type: 'info',
          content: command,
          timestamp: new Date(),
          metadata: {
            isTerminalMessage: true,
            role: 'user',
          },
        });

        sendOutput('$ ' + command + '\n');
        sendOutput('[Session: ' + session.sessionId.slice(0, 8) + ' | History: ' + conversationHistory.length + ' messages]\n');
        sendOutput('Working directory: ' + projectDir + '\n');
        sendOutput('─'.repeat(50) + '\n');

        try {
          // Use ClaudeSubscriptionService with context
          for await (const message of claudeSubscriptionService.runAgent(fullPrompt, {
            model: 'sonnet',
            maxTurns: 100,
            permissionMode: 'bypassPermissions',
            workingDirectory: projectDir,
          })) {
            if (message.type === 'text') {
              // Stream text content line by line for better readability
              const lines = message.content.split('\n');
              for (const line of lines) {
                sendOutput(line + '\n');
              }
              fullResponse += message.content + '\n';
            } else if (message.type === 'tool_use') {
              // Format tool use like CLI does
              const toolName = message.toolName || 'unknown';
              const toolInput = message.toolInput ? JSON.stringify(message.toolInput).slice(0, 100) : '';
              sendOutput('\n');
              sendOutput('╭─ ' + toolName + ' ─╮\n');
              if (toolName === 'Read') {
                sendOutput('│ Reading: ' + (message.toolInput?.file_path || toolInput) + '\n');
              } else if (toolName === 'Edit') {
                sendOutput('│ Editing: ' + (message.toolInput?.file_path || toolInput) + '\n');
              } else if (toolName === 'Write') {
                sendOutput('│ Writing: ' + (message.toolInput?.file_path || toolInput) + '\n');
              } else if (toolName === 'Bash') {
                sendOutput('│ Running: ' + (message.toolInput?.command?.slice(0, 80) || toolInput) + '\n');
              } else if (toolName === 'Glob') {
                sendOutput('│ Searching: ' + (message.toolInput?.pattern || toolInput) + '\n');
              } else if (toolName === 'Grep') {
                sendOutput('│ Grep: ' + (message.toolInput?.pattern || toolInput) + '\n');
              } else {
                sendOutput('│ Input: ' + toolInput + '\n');
              }
              fullResponse += '[Tool: ' + toolName + ']\n';
            } else if (message.type === 'tool_result') {
              // Show truncated tool result
              const content = message.content || '';
              const lines = content.split('\n').slice(0, 10);
              for (const line of lines) {
                if (line.trim()) {
                  sendOutput('│ ' + line.slice(0, 100) + '\n');
                }
              }
              if (content.split('\n').length > 10) {
                sendOutput('│ ... (' + (content.split('\n').length - 10) + ' more lines)\n');
              }
              sendOutput('╰─────────────────╯\n');
              fullResponse += content.slice(0, 500) + '\n';
            } else if (message.type === 'complete') {
              sendOutput('\n');
              sendOutput('✓ ' + (message.content || 'Task completed').slice(0, 200) + '\n');
              fullResponse += message.content + '\n';
            } else if (message.type === 'error') {
              sendOutput('\n');
              sendOutput('✗ Error: ' + message.content + '\n');
              fullResponse += '[Error]: ' + message.content + '\n';
            }
          }

          // Save assistant response to session
          await addSessionMessage(projectId, projectDir, {
            id: uuidv4(),
            agentId: 'uat-terminal',
            agentType: 'coder',
            type: 'success',
            content: fullResponse.trim(),
            timestamp: new Date(),
            metadata: {
              isTerminalMessage: true,
              role: 'assistant',
            },
          });

          sendOutput('\n[Done] ─────────────────────────────────────────\n');
          sendStatus('complete', { success: true, sessionId: session.sessionId });
        } catch (err: any) {
          sendOutput('\nError: ' + err.message + '\n');
          sendStatus('error', { error: err.message });
        }

        safeClose();

      } catch (error) {
        sendOutput('Error: ' + (error instanceof Error ? error.message : 'Unknown error') + '\n');
        sendStatus('error', { error: error instanceof Error ? error.message : 'Unknown error' });
        safeClose();
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
 * GET - Retrieve session history for the terminal
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
  }

  try {
    const projectDir = getProjectDir(projectId).replace(/\\/g, '/');

    // Load session (create if doesn't exist)
    const session = await createSession({
      projectId,
      projectDir,
      resumeIfExists: true,
    });

    // Get terminal messages
    const terminalMessages = session.messages
      .filter(m => m.metadata?.isTerminalMessage)
      .map(m => ({
        id: m.id,
        role: (m.metadata?.role as string) || 'user',
        content: m.content,
        timestamp: m.timestamp,
      }));

    return NextResponse.json({
      sessionId: session.sessionId,
      messages: terminalMessages,
      messageCount: terminalMessages.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load session' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Clear session history
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
  }

  try {
    const projectDir = getProjectDir(projectId).replace(/\\/g, '/');

    // Destroy the session to clear history
    await destroySession(projectId, projectDir);

    // Create a fresh session
    const newSession = await createSession({
      projectId,
      projectDir,
      resumeIfExists: false,
    });

    return NextResponse.json({
      success: true,
      message: 'Session cleared',
      newSessionId: newSession.sessionId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to clear session' },
      { status: 500 }
    );
  }
}
