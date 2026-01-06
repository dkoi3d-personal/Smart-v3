/**
 * Checkpoint Manager
 *
 * Handles checkpoint save/load functionality for pause/resume:
 * - Save checkpoint with session state
 * - Load checkpoint from file
 * - Pause session (save + stop)
 * - Resume from checkpoint
 *
 * Extracted from multi-agent-service.ts for better maintainability.
 */

import * as fs from 'fs/promises';
import path from 'path';
import writeFileAtomic from 'write-file-atomic';
import { EventEmitter } from 'events';
import type {
  AgentRole,
  MultiAgentSession,
  SessionCheckpoint,
} from '../agents/types';
import type { OptimizedAgentRunner } from '../optimized-agent-runner';

export interface CheckpointManagerOptions {
  emitter: EventEmitter;
  getRunner: (sessionId: string) => OptimizedAgentRunner | undefined;
}

export class CheckpointManager {
  private emitter: EventEmitter;
  private getRunner: (sessionId: string) => OptimizedAgentRunner | undefined;

  constructor(options: CheckpointManagerOptions) {
    this.emitter = options.emitter;
    this.getRunner = options.getRunner;
  }

  /**
   * Save a checkpoint for pause/resume functionality
   */
  async saveCheckpoint(
    session: MultiAgentSession,
    phase: SessionCheckpoint['phase'],
    completedAgents: AgentRole[],
    requirements: string,
    agentsToRun: AgentRole[]
  ): Promise<string> {
    const checkpointDir = path.join(session.workingDirectory, '.checkpoints');
    await fs.mkdir(checkpointDir, { recursive: true });

    // Get runner state if available
    const runner = this.getRunner(session.id);
    const runnerState = runner?.getState();

    const checkpoint: SessionCheckpoint = {
      version: 1,
      sessionId: session.id,
      projectId: session.projectId,
      timestamp: new Date().toISOString(),
      phase,
      completedAgents,
      tasks: session.tasks.map(t => ({ ...t })), // Deep copy
      epics: session.epics.map(e => ({ ...e, createdAt: e.createdAt })),
      lastMessageId: session.messages.length > 0
        ? session.messages[session.messages.length - 1].id
        : undefined,
      requirements,
      agentsToRun,
      metrics: {
        filesCreated: 0,
        filesModified: 0,
        testsRun: session.tasks.filter(t => t.status === 'done' || t.status === 'completed').length,
        testsPassed: session.tasks.filter(t => t.status === 'done' || t.status === 'completed').length,
      },
      // Save runner state for resume (coder checkpointing)
      runnerState: runnerState ?? {
        completedStoryIds: session.tasks
          .filter(t => t.status === 'done' || t.status === 'completed')
          .map(t => t.id),
        foundationStoryId: null,
        foundationComplete: session.tasks.some(t =>
          (t.status === 'done' || t.status === 'completed') &&
          (t.title.toLowerCase().includes('setup') ||
           t.title.toLowerCase().includes('foundation') ||
           t.title.toLowerCase().includes('scaffold'))
        ),
      },
    };

    const checkpointPath = path.join(checkpointDir, `checkpoint-${Date.now()}.json`);
    const latestPath = path.join(checkpointDir, 'latest.json');

    // Write checkpoint file
    await writeFileAtomic(checkpointPath, JSON.stringify(checkpoint, null, 2));
    // Also write as latest for easy access
    await writeFileAtomic(latestPath, JSON.stringify(checkpoint, null, 2));

    console.log(`[CheckpointManager] ✅ Checkpoint saved: ${checkpointPath}`);
    this.emitter.emit('checkpoint:saved', {
      projectId: session.projectId,
      phase,
      path: checkpointPath
    });

    return checkpointPath;
  }

  /**
   * Load the latest checkpoint for a project
   */
  async loadCheckpoint(workingDirectory: string): Promise<SessionCheckpoint | null> {
    const latestPath = path.join(workingDirectory, '.checkpoints', 'latest.json');
    try {
      const content = await fs.readFile(latestPath, 'utf-8');
      const checkpoint: SessionCheckpoint = JSON.parse(content);
      console.log(`[CheckpointManager] ✅ Checkpoint loaded: phase=${checkpoint.phase}, tasks=${checkpoint.tasks.length}`);
      return checkpoint;
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        console.error('[CheckpointManager] Error loading checkpoint:', err.message);
      }
      return null;
    }
  }

  /**
   * Determine current phase based on session state
   */
  determinePhase(session: MultiAgentSession): {
    phase: SessionCheckpoint['phase'];
    completedAgents: AgentRole[];
  } {
    let phase: SessionCheckpoint['phase'] = 'product_owner';
    const completedAgents: AgentRole[] = [];

    const hasStories = session.tasks.length > 0;
    const allStoriesCoded = session.tasks.every(t =>
      t.status !== 'backlog' && t.status !== 'pending'
    );
    const allStoriesTested = session.tasks.every(t =>
      t.status === 'done' || t.status === 'completed'
    );

    if (hasStories) {
      completedAgents.push('product_owner');
      phase = 'coder';
    }
    if (allStoriesCoded) {
      completedAgents.push('coder');
      phase = 'tester';
    }
    if (allStoriesTested) {
      completedAgents.push('tester');
      phase = 'security';
    }

    return { phase, completedAgents };
  }

  /**
   * Restore session state from checkpoint
   * Returns the number of tasks reset to backlog
   */
  restoreFromCheckpoint(
    session: MultiAgentSession,
    checkpoint: SessionCheckpoint
  ): number {
    // Restore epics
    session.epics = checkpoint.epics.map(e => ({
      ...e,
      createdAt: new Date(e.createdAt)
    }));

    // Restore tasks BUT reset incomplete work to backlog for fresh start
    // - done/completed: keep as-is (preserve completed work)
    // - in_progress/testing/failed: reset to backlog (agents will redo)
    let resetCount = 0;
    session.tasks = checkpoint.tasks.map(t => {
      if (t.status === 'done' || t.status === 'completed') {
        return t; // Keep completed work
      } else if (t.status === 'in_progress' || t.status === 'testing' || t.status === 'failed') {
        resetCount++;
        return {
          ...t,
          status: 'backlog' as const,
          assignedTo: undefined,
          workingAgent: undefined,
        };
      }
      return t; // backlog/pending stay as-is
    });

    // Clear session-level assignment tracking for fresh start
    session.agentToStory.clear();
    (session as any).testerStoryAssignments = new Map<string, string>();
    (session as any).testerToStoryMap = new Map<string, string>();
    (session as any).testedStoryIds = new Set<string>();

    return resetCount;
  }

  /**
   * List all checkpoints for a project
   */
  async listCheckpoints(workingDirectory: string): Promise<Array<{
    path: string;
    timestamp: string;
    phase: string;
    taskCount: number;
  }>> {
    const checkpointDir = path.join(workingDirectory, '.checkpoints');

    try {
      const files = await fs.readdir(checkpointDir);
      const checkpoints = [];

      for (const file of files) {
        if (file.startsWith('checkpoint-') && file.endsWith('.json')) {
          const filePath = path.join(checkpointDir, file);
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const checkpoint: SessionCheckpoint = JSON.parse(content);
            checkpoints.push({
              path: filePath,
              timestamp: checkpoint.timestamp,
              phase: checkpoint.phase,
              taskCount: checkpoint.tasks.length,
            });
          } catch {
            // Skip invalid checkpoint files
          }
        }
      }

      // Sort by timestamp descending
      return checkpoints.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  }

  /**
   * Delete old checkpoints, keeping only the most recent N
   */
  async pruneCheckpoints(workingDirectory: string, keepCount: number = 5): Promise<number> {
    const checkpoints = await this.listCheckpoints(workingDirectory);

    if (checkpoints.length <= keepCount) {
      return 0;
    }

    let deletedCount = 0;
    for (const checkpoint of checkpoints.slice(keepCount)) {
      try {
        await fs.unlink(checkpoint.path);
        deletedCount++;
      } catch {
        // Ignore deletion errors
      }
    }

    console.log(`[CheckpointManager] Pruned ${deletedCount} old checkpoints`);
    return deletedCount;
  }
}
