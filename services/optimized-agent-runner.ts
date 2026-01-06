/**
 * Optimized Agent Runner
 *
 * Replaces the polling-based runParallel with an event-driven approach.
 * Key improvements:
 * 1. Event-driven coordination (no 500ms polling)
 * 2. Real file locking with proper-lockfile
 * 3. Atomic story file updates
 * 4. Dependency-aware story assignment
 * 5. Parallel tester support
 * 6. Minimal context passing (12-18% lower latency)
 *
 * Based on research:
 * - https://collabnix.com/multi-agent-orchestration-patterns-and-best-practices-for-2024/
 * - 3-5 agents optimal (beyond that, merge complexity eats gains)
 * - Limit concurrency to 4-6 parallel tasks
 * - Stream partials for 15-24% latency reduction
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import writeFileAtomic from 'write-file-atomic';
import lockfile from 'proper-lockfile';
import type { AgentMessage, AgentRole, MultiAgentSession, Task } from './multi-agent-service';

export interface OptimizedConfig {
  maxCoders: number; // 1-5, recommend 3
  maxTesters: number; // 1-4, recommend 3
  enableFileLocking: boolean;
  enableDependencies: boolean;
  storyLockTimeout: number; // ms
  requireFoundationFirst: boolean; // Block parallel work until foundation complete
}

const DEFAULT_CONFIG: OptimizedConfig = {
  maxCoders: 3,
  maxTesters: 3,
  enableFileLocking: true,
  enableDependencies: true,
  storyLockTimeout: 30000,
  requireFoundationFirst: true, // IMPORTANT: Only 1 coder until foundation done
};

// Keywords that identify a foundation/setup story
const FOUNDATION_KEYWORDS = [
  'setup', 'foundation', 'initial', 'scaffold', 'bootstrap',
  'project setup', 'configuration', 'initialize', 'create-next-app',
  'package.json', 'tsconfig', 'config'
];

/**
 * Check if a story is a foundation/setup story
 */
function isFoundationStory(story: Task): boolean {
  const title = story.title.toLowerCase();
  const desc = story.description?.toLowerCase() || '';
  const combined = `${title} ${desc}`;

  // Check for foundation keywords
  if (FOUNDATION_KEYWORDS.some(kw => combined.includes(kw))) {
    return true;
  }

  // Check for high priority + first story pattern
  if (story.priority === 'high' && story.id.includes('story-1')) {
    return true;
  }

  return false;
}

interface AgentWorker {
  id: string;
  role: AgentRole;
  status: 'idle' | 'working' | 'done';
  currentStoryId?: string;
  generator?: AsyncGenerator<AgentMessage>;
  port?: number;
}

interface StoryLock {
  file: string;
  agentId: string;
  storyId: string;
  acquiredAt: number;
}

/**
 * Event-driven agent orchestrator
 * Uses EventEmitter for coordination instead of polling
 *
 * FOUNDATION-FIRST PATTERN:
 * - Only 1 coder works until the foundation/setup story is complete
 * - After foundation is done, all coders can work in parallel
 * - This prevents conflicts from multiple agents trying to set up the project
 */
export class OptimizedAgentRunner extends EventEmitter {
  private config: OptimizedConfig;
  private workingDir: string;
  private workers: Map<string, AgentWorker> = new Map();
  private storyQueue: Task[] = [];
  private fileLocks: Map<string, StoryLock> = new Map();
  private storyAssignments: Map<string, string> = new Map(); // storyId -> workerId
  private storyDependencies: Map<string, string[]> = new Map(); // storyId -> dependsOn[]
  private completedStories: Set<string> = new Set();
  private messageQueue: AgentMessage[] = [];
  private isRunning = false;

  // Foundation tracking
  private foundationStoryId: string | null = null;
  private foundationComplete = false;

  // Stats for monitoring
  private stats = {
    storiesProcessed: 0,
    retriesTotal: 0,
    avgStoryTime: 0,
    lockConflicts: 0,
  };

  constructor(workingDir: string, config: Partial<OptimizedConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.workingDir = workingDir;

    // Set high listener limit for parallel operations
    this.setMaxListeners(50);
  }

  /**
   * Restore state from a checkpoint (for resume functionality)
   * Call this after creating the runner to restore completed stories and foundation status
   */
  restoreState(options: {
    completedStoryIds: string[];
    foundationStoryId?: string | null;
    foundationComplete?: boolean;
  }): void {
    const { completedStoryIds, foundationStoryId, foundationComplete } = options;

    // Restore completed stories
    this.completedStories.clear();
    for (const storyId of completedStoryIds) {
      this.completedStories.add(storyId);
    }

    // Restore foundation tracking
    if (foundationStoryId) {
      this.foundationStoryId = foundationStoryId;
    }

    // Determine if foundation is complete
    if (foundationComplete !== undefined) {
      this.foundationComplete = foundationComplete;
    } else if (foundationStoryId && completedStoryIds.includes(foundationStoryId)) {
      this.foundationComplete = true;
    }

    console.log(`[OptimizedRunner] Restored state: ${completedStoryIds.length} completed stories, foundation=${this.foundationComplete ? 'complete' : 'pending'}`);

    if (this.foundationComplete) {
      console.log(`[OptimizedRunner] ✅ Foundation already complete - parallel work enabled`);
    }
  }

  /**
   * Get current state for checkpointing
   */
  getState(): {
    completedStoryIds: string[];
    foundationStoryId: string | null;
    foundationComplete: boolean;
  } {
    return {
      completedStoryIds: Array.from(this.completedStories),
      foundationStoryId: this.foundationStoryId,
      foundationComplete: this.foundationComplete,
    };
  }

  /**
   * Check if foundation is complete and parallel work is allowed
   */
  isParallelWorkAllowed(): boolean {
    if (!this.config.requireFoundationFirst) return true;
    return this.foundationComplete;
  }

  /**
   * Get how many coders can work right now
   */
  getActiveCoderLimit(): number {
    if (this.isParallelWorkAllowed()) {
      return this.config.maxCoders; // Full parallelism after foundation
    }
    return 1; // Only 1 coder until foundation complete
  }

  /**
   * Initialize worker pool
   */
  initializeWorkers(): void {
    // Create coder workers
    for (let i = 0; i < this.config.maxCoders; i++) {
      const worker: AgentWorker = {
        id: `coder-${i + 1}`,
        role: 'coder',
        status: 'idle',
        port: 4567 + i,
      };
      this.workers.set(worker.id, worker);
    }

    // Create tester workers
    for (let i = 0; i < this.config.maxTesters; i++) {
      const worker: AgentWorker = {
        id: `tester-${i + 1}`,
        role: 'tester',
        status: 'idle',
      };
      this.workers.set(worker.id, worker);
    }

    // Product owner
    this.workers.set('product-owner', {
      id: 'product-owner',
      role: 'product_owner',
      status: 'idle',
    });

    // Security (starts later)
    this.workers.set('security', {
      id: 'security',
      role: 'security',
      status: 'idle',
    });

    console.log(`[OptimizedRunner] Initialized ${this.workers.size} workers: ${Array.from(this.workers.keys()).join(', ')}`);
  }

  /**
   * Add a story with optional dependencies
   */
  addStory(story: Task, dependsOn?: string[]): void {
    this.storyQueue.push(story);

    // Auto-detect foundation story
    if (this.config.requireFoundationFirst && !this.foundationStoryId) {
      if (isFoundationStory(story)) {
        this.foundationStoryId = story.id;
        console.log(`[OptimizedRunner] 🏗️ Foundation story detected: "${story.title}" (${story.id})`);
        console.log(`[OptimizedRunner] Only 1 coder will work until foundation is complete`);

        // All other stories implicitly depend on foundation
        // (they'll be blocked until foundation complete)
      }
    }

    // If we have a foundation story, make all non-foundation stories depend on it
    if (this.config.requireFoundationFirst && this.foundationStoryId && story.id !== this.foundationStoryId) {
      const existingDeps = dependsOn || [];
      if (!existingDeps.includes(this.foundationStoryId)) {
        this.storyDependencies.set(story.id, [...existingDeps, this.foundationStoryId]);
      }
    } else if (this.config.enableDependencies && dependsOn && dependsOn.length > 0) {
      this.storyDependencies.set(story.id, dependsOn);
    }

    // Emit event for immediate assignment attempt
    this.emit('story:added', story);
  }

  /**
   * Check if a story's dependencies are satisfied
   */
  private areDependenciesMet(storyId: string): boolean {
    if (!this.config.enableDependencies) return true;

    const deps = this.storyDependencies.get(storyId);
    if (!deps || deps.length === 0) return true;

    return deps.every(depId => this.completedStories.has(depId));
  }

  /**
   * Get next available story for a role
   */
  private getNextStory(role: 'coder' | 'tester'): Task | null {
    const validStatuses = role === 'coder'
      ? ['backlog', 'pending', 'failed']
      : ['testing'];

    // Sort by priority
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

    const available = this.storyQueue
      .filter(s => {
        // Check status
        if (!validStatuses.includes(s.status)) return false;
        // Check not already assigned
        if (this.storyAssignments.has(s.id)) return false;
        // Check dependencies
        if (!this.areDependenciesMet(s.id)) return false;
        // Check retry limit for failed
        if (s.status === 'failed' && (s as any).retryCount >= 3) return false;
        return true;
      })
      .sort((a, b) => {
        const aPri = priorityOrder[a.priority || 'medium'];
        const bPri = priorityOrder[b.priority || 'medium'];
        return aPri - bPri;
      });

    return available[0] || null;
  }

  /**
   * Get idle worker for a role, respecting foundation-first limits
   */
  private getIdleWorker(role: 'coder' | 'tester'): AgentWorker | null {
    if (role === 'coder') {
      // Count currently working coders
      let workingCoders = 0;
      for (const worker of this.workers.values()) {
        if (worker.role === 'coder' && worker.status === 'working') {
          workingCoders++;
        }
      }

      // Check if we're at the limit
      const limit = this.getActiveCoderLimit();
      if (workingCoders >= limit) {
        return null; // At capacity
      }
    }

    for (const worker of this.workers.values()) {
      if (worker.role === role && worker.status === 'idle') {
        return worker;
      }
    }
    return null;
  }

  /**
   * Get count of working coders
   */
  private getWorkingCoderCount(): number {
    let count = 0;
    for (const worker of this.workers.values()) {
      if (worker.role === 'coder' && worker.status === 'working') {
        count++;
      }
    }
    return count;
  }

  /**
   * Try to assign stories to available workers
   */
  private async tryAssignWork(): Promise<void> {
    // Log foundation status
    if (this.config.requireFoundationFirst && !this.foundationComplete) {
      const limit = this.getActiveCoderLimit();
      const working = this.getWorkingCoderCount();
      if (working >= limit) {
        console.log(`[OptimizedRunner] ⏳ Foundation in progress - ${working}/${limit} coder(s) active, waiting...`);
      }
    }

    // Assign to coders (respects foundation-first limit)
    let story = this.getNextStory('coder');
    while (story) {
      const worker = this.getIdleWorker('coder');
      if (!worker) break;

      await this.assignStoryToWorker(story, worker);
      story = this.getNextStory('coder');
    }

    // Assign to testers
    story = this.getNextStory('tester');
    while (story) {
      const worker = this.getIdleWorker('tester');
      if (!worker) break;

      await this.assignStoryToWorker(story, worker);
      story = this.getNextStory('tester');
    }
  }

  /**
   * Assign a story to a worker
   */
  private async assignStoryToWorker(story: Task, worker: AgentWorker): Promise<void> {
    worker.status = 'working';
    worker.currentStoryId = story.id;
    this.storyAssignments.set(story.id, worker.id);

    // Update story status
    story.status = 'in_progress';
    story.assignedTo = worker.role;

    // Increment retry count for failed stories
    if ((story as any).previousStatus === 'failed') {
      (story as any).retryCount = ((story as any).retryCount || 0) + 1;
    }

    this.emit('story:assigned', { story, worker });
    console.log(`[OptimizedRunner] Assigned "${story.title}" to ${worker.id}`);
  }

  /**
   * Mark a story as complete
   */
  async completeStory(storyId: string, success: boolean): Promise<void> {
    const assignment = this.storyAssignments.get(storyId);
    if (!assignment) return;

    const worker = this.workers.get(assignment);
    const story = this.storyQueue.find(s => s.id === storyId);

    if (worker) {
      worker.status = 'idle';
      worker.currentStoryId = undefined;
    }

    if (story) {
      if (success) {
        story.status = 'done';
        this.completedStories.add(storyId);
        this.stats.storiesProcessed++;

        // Check if foundation story just completed
        if (this.config.requireFoundationFirst && storyId === this.foundationStoryId) {
          this.foundationComplete = true;
          console.log(`[OptimizedRunner] ✅ FOUNDATION COMPLETE! "${story.title}"`);
          console.log(`[OptimizedRunner] 🚀 Unlocking parallel work - ${this.config.maxCoders} coders can now work simultaneously`);
          this.emit('foundation:complete', { storyId, story });
        }
      } else {
        story.status = 'failed';
        (story as any).previousStatus = 'failed';
        this.stats.retriesTotal++;
      }
    }

    // Release file locks for this story
    await this.releaseStoryLocks(storyId);

    this.storyAssignments.delete(storyId);
    this.emit('story:completed', { storyId, success });

    // Try to assign more work (now with potentially more coders available)
    await this.tryAssignWork();
  }

  /**
   * Move story to testing
   */
  async moveToTesting(storyId: string): Promise<void> {
    const story = this.storyQueue.find(s => s.id === storyId);
    if (!story) return;

    const assignment = this.storyAssignments.get(storyId);
    if (assignment) {
      const worker = this.workers.get(assignment);
      if (worker) {
        worker.status = 'idle';
        worker.currentStoryId = undefined;
      }
      this.storyAssignments.delete(storyId);
    }

    story.status = 'testing';
    story.assignedTo = 'tester';

    // Release coder's file locks
    await this.releaseStoryLocks(storyId);

    this.emit('story:readyForTesting', story);

    // Try to assign to tester
    await this.tryAssignWork();
  }

  // ============================================
  // FILE LOCKING
  // ============================================

  /**
   * Acquire a file lock for a story
   */
  async acquireFileLock(file: string, agentId: string, storyId: string): Promise<boolean> {
    if (!this.config.enableFileLocking) return true;

    const existing = this.fileLocks.get(file);

    // Check if we already own it
    if (existing && existing.agentId === agentId) {
      return true;
    }

    // Check if another agent has it
    if (existing && existing.agentId !== agentId) {
      // Check if stale
      if (Date.now() - existing.acquiredAt > this.config.storyLockTimeout) {
        await this.releaseFileLock(file, existing.agentId);
      } else {
        this.stats.lockConflicts++;
        this.emit('lock:conflict', { file, requestedBy: agentId, heldBy: existing.agentId });
        return false;
      }
    }

    const absolutePath = path.isAbsolute(file) ? file : path.join(this.workingDir, file);

    try {
      // Ensure file exists
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      try {
        await fs.access(absolutePath);
      } catch {
        await fs.writeFile(absolutePath, '');
      }

      // Acquire proper-lockfile lock
      await lockfile.lock(absolutePath, {
        stale: this.config.storyLockTimeout,
        retries: 2,
        realpath: false,
      });

      this.fileLocks.set(file, {
        file,
        agentId,
        storyId,
        acquiredAt: Date.now(),
      });

      return true;
    } catch (err: any) {
      if (err.code === 'ELOCKED') {
        this.stats.lockConflicts++;
        return false;
      }
      console.error(`[Lock] Error acquiring lock for ${file}:`, err.message);
      return false;
    }
  }

  /**
   * Release a specific file lock
   */
  private async releaseFileLock(file: string, agentId: string): Promise<void> {
    const lock = this.fileLocks.get(file);
    if (!lock || lock.agentId !== agentId) return;

    const absolutePath = path.isAbsolute(file) ? file : path.join(this.workingDir, file);

    try {
      if (await lockfile.check(absolutePath, { realpath: false })) {
        await lockfile.unlock(absolutePath, { realpath: false });
      }
    } catch {
      // Ignore - lock may already be released
    }

    this.fileLocks.delete(file);
  }

  /**
   * Release all locks held for a story
   */
  private async releaseStoryLocks(storyId: string): Promise<void> {
    const toRelease: string[] = [];

    for (const [file, lock] of this.fileLocks.entries()) {
      if (lock.storyId === storyId) {
        toRelease.push(file);
      }
    }

    for (const file of toRelease) {
      const lock = this.fileLocks.get(file)!;
      await this.releaseFileLock(file, lock.agentId);
    }
  }

  /**
   * Get files locked by other agents (for context)
   */
  getLockedFilesExcluding(agentId: string): string[] {
    const locked: string[] = [];
    for (const [file, lock] of this.fileLocks.entries()) {
      if (lock.agentId !== agentId) {
        locked.push(file);
      }
    }
    return locked;
  }

  // ============================================
  // ATOMIC STORY FILE OPERATIONS
  // ============================================

  /**
   * Save stories atomically
   */
  async saveStories(): Promise<void> {
    const storiesPath = path.join(this.workingDir, '.agile-stories.json');
    const data = {
      stories: this.storyQueue,
      lastUpdated: new Date().toISOString(),
    };

    try {
      await writeFileAtomic(storiesPath, JSON.stringify(data, null, 2));
    } catch (err: any) {
      console.error('[Stories] Error saving:', err.message);
    }
  }

  /**
   * Load stories from disk
   */
  async loadStories(): Promise<void> {
    const storiesPath = path.join(this.workingDir, '.agile-stories.json');

    try {
      const data = await fs.readFile(storiesPath, 'utf-8');
      const parsed = JSON.parse(data);

      for (const story of parsed.stories || []) {
        this.storyQueue.push(story);
        if (story.status === 'done' || story.status === 'completed') {
          this.completedStories.add(story.id);
        }
      }
    } catch {
      // File doesn't exist
    }
  }

  // ============================================
  // CONTEXT GENERATION (Minimal for speed)
  // ============================================

  /**
   * Generate minimal context for an agent (12-18% lower latency)
   */
  generateMinimalContext(worker: AgentWorker, story: Task): string {
    const lockedFiles = this.getLockedFilesExcluding(worker.id);

    // Minimal context - only what's needed
    let ctx = `STORY: "${story.title}" [${story.id}]\n${story.description}\n`;

    if ((story as any).acceptanceCriteria?.length > 0) {
      ctx += `\nCRITERIA:\n${(story as any).acceptanceCriteria.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')}\n`;
    }

    if (story.status === 'failed') {
      ctx += `\n⚠️ RETRY ${(story as any).retryCount || 1}/3: ${story.result || 'Previous attempt failed'}\n`;
    }

    if (lockedFiles.length > 0) {
      ctx += `\n🔒 LOCKED (don't edit): ${lockedFiles.slice(0, 5).join(', ')}\n`;
    }

    if (worker.port) {
      ctx += `\nYour port: ${worker.port}\n`;
    }

    return ctx;
  }

  // ============================================
  // STATUS & MONITORING
  // ============================================

  getStatus(): {
    workers: { id: string; role: AgentRole; status: string; story?: string }[];
    stories: { total: number; done: number; inProgress: number; testing: number; failed: number };
    locks: number;
    stats: { storiesProcessed: number; retriesTotal: number; avgStoryTime: number; lockConflicts: number };
  } {
    const workerStatus = Array.from(this.workers.values()).map(w => ({
      id: w.id,
      role: w.role,
      status: w.status,
      story: w.currentStoryId,
    }));

    const stories = {
      total: this.storyQueue.length,
      done: this.storyQueue.filter(s => s.status === 'done' || s.status === 'completed').length,
      inProgress: this.storyQueue.filter(s => s.status === 'in_progress').length,
      testing: this.storyQueue.filter(s => s.status === 'testing').length,
      failed: this.storyQueue.filter(s => s.status === 'failed').length,
    };

    return {
      workers: workerStatus,
      stories,
      locks: this.fileLocks.size,
      stats: this.stats,
    };
  }

  /**
   * Check if all work is done
   */
  isComplete(): boolean {
    const pending = this.storyQueue.filter(s =>
      s.status !== 'done' && s.status !== 'completed' &&
      !(s.status === 'failed' && ((s as any).retryCount || 0) >= 3)
    );
    return pending.length === 0;
  }

  /**
   * Stop all workers
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    // Release all locks
    for (const [file, lock] of this.fileLocks.entries()) {
      await this.releaseFileLock(file, lock.agentId);
    }

    // Mark all workers as done
    for (const worker of this.workers.values()) {
      worker.status = 'done';
    }

    this.emit('stopped');
  }
}

export default OptimizedAgentRunner;
