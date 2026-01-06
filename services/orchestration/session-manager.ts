/**
 * Session Manager
 *
 * Handles multi-agent session lifecycle:
 * - Session creation and initialization
 * - Session retrieval and tracking
 * - Session termination and cleanup
 *
 * Extracted from multi-agent-service.ts for better maintainability.
 */

import { EventEmitter } from 'events';
import path from 'path';
import { OptimizedAgentRunner } from '../optimized-agent-runner';
import { claudeSubscriptionService } from '../claude-subscription-service';
import { preloadArchitecture } from '../agents/architecture-context';
import type {
  AgentRole,
  MultiAgentSession,
  CoderConfig,
  AgentState,
} from '../agents/types';

// Default agent states for new sessions
const DEFAULT_AGENT_STATES: Array<[AgentRole, Omit<AgentState, 'role'>]> = [
  ['coordinator', { name: 'Coordinator', status: 'idle', completedTasks: [] }],
  ['product_owner', { name: 'Product Owner', status: 'idle', completedTasks: [] }],
  ['data_architect', { name: 'Data Architect', status: 'idle', completedTasks: [] }],
  ['coder', { name: 'Coder', status: 'idle', completedTasks: [] }],
  ['tester', { name: 'Tester', status: 'idle', completedTasks: [] }],
  ['security', { name: 'Security', status: 'idle', completedTasks: [] }],
  ['fixer', { name: 'Fixer', status: 'idle', completedTasks: [] }],
  ['researcher', { name: 'Researcher', status: 'idle', completedTasks: [] }],
];

export interface SessionManagerOptions {
  emitter: EventEmitter;
  generateId: () => string;
  emitAgentMessage: (session: MultiAgentSession, message: any) => void;
}

export class SessionManager {
  private sessions: Map<string, MultiAgentSession> = new Map();
  private projectToSession: Map<string, string> = new Map();
  private optimizedRunners: Map<string, OptimizedAgentRunner> = new Map();
  private sessionAbortControllers: Map<string, AbortController> = new Map();

  private emitter: EventEmitter;
  private generateId: () => string;
  private emitAgentMessage: (session: MultiAgentSession, message: any) => void;

  constructor(options: SessionManagerOptions) {
    this.emitter = options.emitter;
    this.generateId = options.generateId;
    this.emitAgentMessage = options.emitAgentMessage;
  }

  /**
   * Create a new multi-agent session
   */
  createSession(
    projectId: string,
    workingDirectory: string,
    coderConfig?: Partial<CoderConfig>
  ): MultiAgentSession {
    // Reset subscription service tracking for new build
    claudeSubscriptionService.clearAll();

    // Build agent states map
    const agents = new Map<AgentRole, AgentState>();
    for (const [role, state] of DEFAULT_AGENT_STATES) {
      agents.set(role, { role, ...state });
    }

    const session: MultiAgentSession = {
      id: `session-${this.generateId()}`,
      projectId,
      agents,
      tasks: [],
      epics: [],
      messages: [],
      commandLogs: [],
      workingDirectory,
      createdAt: new Date(),
      updatedAt: new Date(),
      coderConfig: {
        parallelCoders: coderConfig?.parallelCoders ?? 1,
        batchMode: coderConfig?.batchMode ?? false,
        batchSize: coderConfig?.batchSize ?? 3,
        skipFoundation: coderConfig?.skipFoundation ?? false,
      },
      fileLocks: new Map(),
      agentToStory: new Map(),
    };

    this.sessions.set(session.id, session);
    this.projectToSession.set(projectId, session.id);

    // Preload architecture for this project (non-blocking)
    preloadArchitecture(workingDirectory).catch((err) => {
      console.warn('[SessionManager] Failed to preload architecture:', err);
    });

    // Create abort controller for this session
    this.sessionAbortControllers.set(session.id, new AbortController());

    // Create optimized runner for parallel agents
    const runner = new OptimizedAgentRunner(workingDirectory, {
      maxCoders: coderConfig?.parallelCoders ?? 3,
      maxTesters: 2,
      enableFileLocking: true,
      enableDependencies: true,
      storyLockTimeout: 30000,
    });

    // Wire up runner events
    this.wireRunnerEvents(runner, session);
    this.optimizedRunners.set(session.id, runner);

    console.log(`[SessionManager] Created session ${session.id} for project ${projectId}`);
    return session;
  }

  /**
   * Wire up events from the optimized runner
   */
  private wireRunnerEvents(runner: OptimizedAgentRunner, session: MultiAgentSession): void {
    runner.on('story:assigned', ({ story, worker }) => {
      console.log(`[SessionManager] Story "${story.title}" assigned to ${worker.id}`);
      this.emitter.emit('task:updated', { ...story, status: 'in_progress', assignedTo: worker.role });
      this.emitter.emit('story:started', {
        storyId: story.id,
        storyTitle: story.title,
        agentId: worker.id,
        status: 'in_progress',
      });
    });

    runner.on('story:completed', ({ storyId, success }) => {
      const story = session.tasks.find(t => t.id === storyId);
      if (story) {
        story.status = success ? 'done' : 'failed';
        this.emitter.emit('task:updated', story);
        if (success) {
          this.emitter.emit('story:completed', {
            storyId: story.id,
            storyTitle: story.title,
            success: true,
            status: 'done',
          });
        } else {
          this.emitter.emit('story:failed', {
            storyId: story.id,
            storyTitle: story.title,
            error: story.result || 'Story failed',
            status: 'failed',
          });
        }
      }
    });

    runner.on('lock:conflict', ({ file, requestedBy, heldBy }) => {
      console.log(`[SessionManager] Lock conflict: ${file} requested by ${requestedBy}, held by ${heldBy}`);
    });
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): MultiAgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get session by project ID
   */
  getSessionByProject(projectId: string): MultiAgentSession | undefined {
    const sessionId = this.projectToSession.get(projectId);
    return sessionId ? this.sessions.get(sessionId) : undefined;
  }

  /**
   * Get session ID for a project
   */
  getSessionIdForProject(projectId: string): string | undefined {
    return this.projectToSession.get(projectId);
  }

  /**
   * Check if a project has an active session
   */
  hasActiveSession(projectId: string): boolean {
    return this.projectToSession.has(projectId);
  }

  /**
   * Get the optimized runner for a session
   */
  getRunner(sessionId: string): OptimizedAgentRunner | undefined {
    return this.optimizedRunners.get(sessionId);
  }

  /**
   * Get abort controller for a session
   */
  getAbortController(sessionId: string): AbortController | undefined {
    return this.sessionAbortControllers.get(sessionId);
  }

  /**
   * Update coder configuration for a session
   */
  updateCoderConfig(sessionId: string, config: Partial<CoderConfig>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.coderConfig = { ...session.coderConfig, ...config };
      session.updatedAt = new Date();
    }
  }

  /**
   * Stop and clean up a session
   */
  stopSession(sessionId: string): boolean {
    // Signal abort to any running agents
    const abortController = this.sessionAbortControllers.get(sessionId);
    if (abortController) {
      abortController.abort();
      this.sessionAbortControllers.delete(sessionId);
      console.log(`[SessionManager] Signaled abort for session: ${sessionId}`);
    }

    // Stop optimized runner
    const runner = this.optimizedRunners.get(sessionId);
    if (runner) {
      runner.stop();
      this.optimizedRunners.delete(sessionId);
      console.log(`[SessionManager] Stopped optimized runner for session: ${sessionId}`);
    }

    // Get session and emit stop message
    const session = this.sessions.get(sessionId);
    if (session) {
      // Mark all agents as idle
      session.agents.forEach((agent, role) => {
        if (agent.status === 'working' || agent.status === 'waiting') {
          agent.status = 'idle';
          this.emitter.emit('agent:status', { role, status: 'idle', projectId: session.projectId });
        }
      });

      // Emit stop message
      this.emitAgentMessage(session, {
        agentRole: 'coordinator',
        agentName: 'System',
        type: 'result',
        content: '⏹️ Workflow stopped by user. All agents have been terminated.',
      });

      // Remove project mapping
      this.projectToSession.delete(session.projectId);

      // Emit workflow stopped event
      this.emitter.emit('workflow:stopped', { projectId: session.projectId, sessionId });

      // Clean up session
      this.sessions.delete(sessionId);

      console.log(`[SessionManager] Session ${sessionId} fully stopped`);
      return true;
    }

    return false;
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): MultiAgentSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }
}
