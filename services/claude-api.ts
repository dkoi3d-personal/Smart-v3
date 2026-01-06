/**
 * Claude Agent SDK Integration Service
 * Handles all interactions with Claude agents via the Agent SDK
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { AgentInvocationOptions, AgentResponse } from '@/lib/agents/types';

export class ClaudeAgentService {
  private activeSessions: Map<string, any> = new Map();

  /**
   * Invoke a Claude agent with the given prompt and options
   */
  async invokeAgent(options: AgentInvocationOptions): Promise<AgentResponse> {
    const {
      prompt,
      sessionId,
      allowedTools = ['Read', 'Write', 'Bash', 'Grep', 'Glob'],
      permissionMode = 'acceptEdits',
      maxTurns = 50,
      timeout = 300000, // 5 minutes
      workingDirectory,
    } = options;

    const startTime = Date.now();
    const messages: any[] = [];
    let totalCost = 0;
    let currentSessionId = sessionId;

    console.log('    → Claude API call starting...');
    console.log('    → Prompt length:', prompt.length);
    console.log('    → Resume session:', sessionId || 'new session');
    console.log('    → Working directory:', workingDirectory || 'default');

    try {
      const queryOptions: any = {
        model: 'opus',
        allowedTools,
        permissionMode,
        maxTurns,
        outputFormat: 'stream-json',
        // Let SDK auto-detect - it worked in the test!
        // Only override if explicitly set in environment
        ...(process.env.CLAUDE_CODE_PATH && { pathToClaudeCodeExecutable: process.env.CLAUDE_CODE_PATH }),
        // Set working directory if provided
        ...(workingDirectory && { workingDirectory }),
      };

      if (sessionId) {
        queryOptions.resume = sessionId;
      }

      console.log('    → Query options:', {
        model: queryOptions.model,
        allowedTools: queryOptions.allowedTools?.slice(0, 3),
        toolCount: queryOptions.allowedTools?.length,
      });

      console.log('    → Calling query() function...');

      const result = query({
        prompt,
        options: queryOptions,
      });

      console.log('    → Query returned, starting stream...');
      let messageCount = 0;

      // Process streaming responses
      for await (const message of result) {
        messages.push(message);
        messageCount++;

        if (messageCount <= 3 || message.type === 'result' || (message as any).type === 'error') {
          console.log('    → Message', messageCount, ':', message.type);
        }

        switch (message.type) {
          case 'system':
            if ((message as any).session_id) {
              currentSessionId = (message as any).session_id as string;
              this.activeSessions.set(currentSessionId!, result);
              console.log('    → Session ID:', currentSessionId);
            }
            break;

          case 'assistant':
            // Handle assistant messages
            if ((message as any).content) {
              const content = (message as any).content;
              console.log('    → Assistant content received (length:',
                typeof content === 'string' ? content.length :
                Array.isArray(content) ? content.length : 0, ')');
            }
            break;

          case 'result':
            // Final result with cost information
            totalCost = message.total_cost_usd || 0;
            console.log('    → Final result. Cost: $' + totalCost.toFixed(4));
            break;

          default:
            // Handle other message types (tool_use, error, etc.)
            if ((message as any).tool) {
              console.log('    → Tool use:', (message as any).tool);
            }
            if ((message as any).type === 'error') {
              console.error('    → Error:', (message as any).message);
              throw new Error((message as any).message || 'Agent invocation failed');
            }
            break;
        }

        // Check for timeout
        if (Date.now() - startTime > timeout) {
          await this.interruptAgent(currentSessionId!);
          throw new Error('Agent invocation timed out');
        }
      }

      console.log('    → Stream complete. Total messages:', messageCount);

      // Clean up completed session from active sessions
      if (currentSessionId && this.activeSessions.has(currentSessionId)) {
        this.activeSessions.delete(currentSessionId);
        console.log('    → Session cleaned up:', currentSessionId);
      }

      return {
        sessionId: currentSessionId!,
        messages,
        cost: totalCost,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.error('    → Agent invocation error:', error);

      // Clean up session on error
      if (currentSessionId && this.activeSessions.has(currentSessionId)) {
        try {
          await this.interruptAgent(currentSessionId);
        } catch (interruptError) {
          console.error('    → Failed to interrupt session on error:', interruptError);
        }
      }

      return {
        sessionId: currentSessionId || '',
        messages,
        cost: totalCost,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Interrupt a running agent session
   */
  async interruptAgent(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      try {
        console.log('    → Interrupting session:', sessionId);
        await session.interrupt();
        this.activeSessions.delete(sessionId);
        console.log('    → Session interrupted and removed:', sessionId);
      } catch (error) {
        console.error('    → Error interrupting session:', error);
        // Still remove from map even if interrupt fails
        this.activeSessions.delete(sessionId);
        throw error;
      }
    }
  }

  /**
   * Continue an existing session with a new prompt
   */
  async continueSession(
    sessionId: string,
    prompt: string,
    options?: Partial<AgentInvocationOptions>
  ): Promise<AgentResponse> {
    return this.invokeAgent({
      ...options,
      prompt,
      sessionId,
    } as AgentInvocationOptions);
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.activeSessions.size;
  }

  /**
   * Clear all active sessions
   */
  async clearAllSessions(): Promise<void> {
    console.log(`Clearing ${this.activeSessions.size} active sessions...`);
    const sessionIds = Array.from(this.activeSessions.keys());

    for (const sessionId of sessionIds) {
      try {
        await this.interruptAgent(sessionId);
      } catch (error) {
        console.error(`Failed to interrupt session ${sessionId}:`, error);
      }
    }

    this.activeSessions.clear();
    console.log('All sessions cleared');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ClaudeAgentService {
    return claudeAgentService;
  }
}

// Singleton instance
export const claudeAgentService = new ClaudeAgentService();
