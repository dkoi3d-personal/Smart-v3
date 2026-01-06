/**
 * Agent SDK Service
 *
 * This service wraps the new TaskOrchestrator and provides a clean interface
 * for the API routes and frontend to use.
 *
 * Uses Claude Agent SDK under the hood for faster execution.
 */

import { TaskOrchestrator, OrchestratorResult, Task, ProjectComplexity } from '../lib/agents/task-orchestrator';
import { EventEmitter } from 'events';

// ============================================================================
// TYPES
// ============================================================================

export interface BuildRequest {
  requirements: string;
  projectId: string;
  projectDirectory: string;
  options?: {
    skipDeploy?: boolean;
    skipTests?: boolean;
    maxParallelTasks?: number;
  };
}

export interface BuildProgress {
  projectId: string;
  phase: 'analyzing' | 'planning' | 'building' | 'testing' | 'reviewing' | 'completed' | 'failed';
  progress: number; // 0-100
  currentTask?: string;
  tasks: Task[];
  messages: BuildMessage[];
}

export interface BuildMessage {
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

class AgentSDKService extends EventEmitter {
  private activeBuilds: Map<string, {
    orchestrator: TaskOrchestrator;
    progress: BuildProgress;
  }> = new Map();

  /**
   * Start a new build
   */
  async startBuild(request: BuildRequest): Promise<string> {
    const { requirements, projectId, projectDirectory, options } = request;

    // Check if build already running for this project
    if (this.activeBuilds.has(projectId)) {
      throw new Error(`Build already in progress for project ${projectId}`);
    }

    // Initialize progress
    const progress: BuildProgress = {
      projectId,
      phase: 'analyzing',
      progress: 0,
      tasks: [],
      messages: [],
    };

    // Create orchestrator
    const orchestrator = new TaskOrchestrator({
      requirements,
      projectDirectory,
      skipDeploy: options?.skipDeploy ?? true,
      maxParallelTasks: options?.maxParallelTasks ?? 3,
      onProgress: (task, allTasks) => {
        this.handleTaskProgress(projectId, task, allTasks);
      },
      onMessage: (message, type) => {
        this.handleMessage(projectId, message, type);
      },
    });

    // Store active build
    this.activeBuilds.set(projectId, { orchestrator, progress });

    // Start build (don't await - let it run async)
    this.runBuild(projectId, orchestrator).catch(error => {
      this.handleMessage(projectId, `Build failed: ${error.message}`, 'error');
      this.updatePhase(projectId, 'failed');
    });

    return projectId;
  }

  /**
   * Run the build process
   */
  private async runBuild(projectId: string, orchestrator: TaskOrchestrator): Promise<OrchestratorResult> {
    try {
      const result = await orchestrator.run();

      if (result.success) {
        this.updatePhase(projectId, 'completed');
        this.handleMessage(projectId, `Build completed successfully in ${(result.totalTime / 1000).toFixed(1)}s`, 'success');
      } else {
        this.updatePhase(projectId, 'failed');
        this.handleMessage(projectId, `Build failed with ${result.errors.length} error(s)`, 'error');
      }

      // Keep build info for a while, then clean up
      setTimeout(() => {
        this.activeBuilds.delete(projectId);
      }, 60000); // Keep for 1 minute after completion

      return result;

    } catch (error: any) {
      this.updatePhase(projectId, 'failed');
      throw error;
    }
  }

  /**
   * Get current build progress
   */
  getProgress(projectId: string): BuildProgress | null {
    const build = this.activeBuilds.get(projectId);
    return build?.progress ?? null;
  }

  /**
   * Stop a running build
   */
  stopBuild(projectId: string): boolean {
    const build = this.activeBuilds.get(projectId);
    if (!build) return false;

    // Mark as failed and clean up
    this.updatePhase(projectId, 'failed');
    this.handleMessage(projectId, 'Build cancelled by user', 'warning');
    this.activeBuilds.delete(projectId);

    return true;
  }

  /**
   * Get all active builds
   */
  getActiveBuilds(): string[] {
    return Array.from(this.activeBuilds.keys());
  }

  // --------------------------------------------------------------------------
  // INTERNAL HANDLERS
  // --------------------------------------------------------------------------

  private handleTaskProgress(projectId: string, task: Task, allTasks: Task[]): void {
    const build = this.activeBuilds.get(projectId);
    if (!build) return;

    // Update tasks
    build.progress.tasks = allTasks;
    build.progress.currentTask = task.status === 'running' ? task.description : undefined;

    // Calculate overall progress
    const completed = allTasks.filter(t => t.status === 'completed').length;
    const total = allTasks.length;
    build.progress.progress = Math.round((completed / total) * 100);

    // Update phase based on task types
    const runningTask = allTasks.find(t => t.status === 'running');
    if (runningTask) {
      switch (runningTask.type) {
        case 'analyze':
          build.progress.phase = 'analyzing';
          break;
        case 'setup':
        case 'implement':
          build.progress.phase = 'building';
          break;
        case 'test':
          build.progress.phase = 'testing';
          break;
        case 'review':
          build.progress.phase = 'reviewing';
          break;
      }
    }

    // Emit progress event
    this.emit('progress', projectId, build.progress);
  }

  private handleMessage(projectId: string, message: string, type: 'info' | 'success' | 'warning' | 'error'): void {
    const build = this.activeBuilds.get(projectId);
    if (!build) return;

    const buildMessage: BuildMessage = {
      timestamp: new Date(),
      type,
      message,
    };

    build.progress.messages.push(buildMessage);

    // Emit message event
    this.emit('message', projectId, buildMessage);
  }

  private updatePhase(projectId: string, phase: BuildProgress['phase']): void {
    const build = this.activeBuilds.get(projectId);
    if (!build) return;

    build.progress.phase = phase;

    if (phase === 'completed') {
      build.progress.progress = 100;
    }

    this.emit('progress', projectId, build.progress);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const agentSDKService = new AgentSDKService();

// ============================================================================
// QUICK BUILD FUNCTION
// ============================================================================

/**
 * Quick function to build a project with minimal configuration.
 *
 * Example:
 *   await quickBuild("Create a hello world Next.js app", "/path/to/project");
 */
export async function quickBuild(
  requirements: string,
  projectDirectory: string,
  onProgress?: (progress: BuildProgress) => void
): Promise<OrchestratorResult> {
  const projectId = `quick-${Date.now()}`;

  if (onProgress) {
    agentSDKService.on('progress', (id, progress) => {
      if (id === projectId) {
        onProgress(progress);
      }
    });
  }

  await agentSDKService.startBuild({
    requirements,
    projectId,
    projectDirectory,
    options: {
      skipDeploy: true,
    },
  });

  // Wait for completion
  return new Promise((resolve, reject) => {
    const checkComplete = setInterval(() => {
      const progress = agentSDKService.getProgress(projectId);

      if (!progress) {
        clearInterval(checkComplete);
        reject(new Error('Build lost'));
        return;
      }

      if (progress.phase === 'completed') {
        clearInterval(checkComplete);
        resolve({
          success: true,
          tasks: progress.tasks,
          totalTime: 0, // Not tracked in quick build
          totalTokens: 0,
          filesCreated: [],
          errors: [],
        });
      } else if (progress.phase === 'failed') {
        clearInterval(checkComplete);
        const errors = progress.messages
          .filter(m => m.type === 'error')
          .map(m => m.message);
        resolve({
          success: false,
          tasks: progress.tasks,
          totalTime: 0,
          totalTokens: 0,
          filesCreated: [],
          errors,
        });
      }
    }, 500);
  });
}
