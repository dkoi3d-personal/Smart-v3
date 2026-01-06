/**
 * Parallel Agent Coordinator - Optimized for Speed
 *
 * Key optimizations:
 * 1. Event-driven architecture (no polling) - 15-24% latency reduction
 * 2. Real file locking with proper-lockfile
 * 3. Atomic JSON writes with write-file-atomic
 * 4. Story dependency graph for proper ordering
 * 5. Parallel tester support
 * 6. Worker pool pattern for coder agents (limit 4-6 concurrent)
 *
 * Research sources:
 * - https://collabnix.com/multi-agent-orchestration-patterns-and-best-practices-for-2024/
 * - https://blog.logrocket.com/understanding-node-js-file-locking/
 * - https://www.npmjs.com/package/proper-lockfile
 * - https://www.npmjs.com/package/write-file-atomic
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import lockfile from 'proper-lockfile';
import writeFileAtomic from 'write-file-atomic';

// Types
export interface Story {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'backlog' | 'in_progress' | 'testing' | 'done' | 'completed' | 'failed';
  assignedTo?: string;
  dependencies?: string[]; // Story IDs this story depends on
  blockedBy?: string[]; // Stories blocking this one (computed)
  priority?: 'high' | 'medium' | 'low';
  files?: string[]; // Files this story will modify (for lock prediction)
  retryCount?: number;
}

export interface AgentConfig {
  id: string;
  role: 'coder' | 'tester' | 'product_owner' | 'security' | 'fixer';
  port?: number; // Unique port for each coder
}

export interface FileLock {
  file: string;
  owner: string; // Agent ID
  acquiredAt: number;
  storyId?: string;
}

export interface CoordinatorConfig {
  maxCoders: number; // 1-5, default 3
  maxTesters: number; // 1-3, default 2
  enableDependencyGraph: boolean;
  enableFileLocking: boolean;
  staleTimeout: number; // Lock timeout in ms, default 30000
}

const DEFAULT_CONFIG: CoordinatorConfig = {
  maxCoders: 3,
  maxTesters: 2,
  enableDependencyGraph: true,
  enableFileLocking: true,
  staleTimeout: 30000,
};

/**
 * Event-driven parallel agent coordinator
 * Uses EventEmitter instead of polling for near-instant response
 */
export class ParallelAgentCoordinator extends EventEmitter {
  private config: CoordinatorConfig;
  private workingDirectory: string;
  private stories: Map<string, Story> = new Map();
  private fileLocks: Map<string, FileLock> = new Map();
  private activeAgents: Map<string, AgentConfig> = new Map();
  private storyAssignments: Map<string, string> = new Map(); // storyId -> agentId
  private dependencyGraph: Map<string, Set<string>> = new Map(); // storyId -> dependent storyIds
  private storiesFilePath: string;
  private lockFilePath: string;

  constructor(workingDirectory: string, config: Partial<CoordinatorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.workingDirectory = workingDirectory;
    this.storiesFilePath = path.join(workingDirectory, '.agile-stories.json');
    this.lockFilePath = path.join(workingDirectory, '.file-locks.json');

    // Set up event listeners for coordination
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // When a story is created, check if any agents can pick it up
    this.on('story:created', (story: Story) => {
      this.stories.set(story.id, story);
      this.updateDependencyGraph(story);
      this.tryAssignStories();
    });

    // When a story status changes, react accordingly
    this.on('story:updated', (story: Story) => {
      this.stories.set(story.id, story);

      if (story.status === 'testing') {
        // Story ready for testing - assign to available tester
        this.tryAssignToTester(story);
      } else if (story.status === 'done' || story.status === 'completed') {
        // Story complete - release locks and unblock dependents
        this.releaseStoryLocks(story.id);
        this.unblockDependentStories(story.id);
        this.tryAssignStories();
      } else if (story.status === 'failed') {
        // Story failed - route back for retry
        this.handleFailedStory(story);
      }
    });

    // When a file is about to be written, check locks
    this.on('file:beforeWrite', async ({ file, agentId, storyId }) => {
      const canWrite = await this.acquireFileLock(file, agentId, storyId);
      if (!canWrite) {
        this.emit('file:blocked', { file, agentId, blockedBy: this.fileLocks.get(file) });
      }
    });

    // When a file write completes, update lock info
    this.on('file:written', ({ file, agentId }) => {
      // Lock remains until story is complete
    });

    // When an agent becomes available
    this.on('agent:idle', (agentId: string) => {
      this.tryAssignStories();
    });

    // When an agent completes a story
    this.on('agent:storyComplete', ({ agentId, storyId }) => {
      this.storyAssignments.delete(storyId);
      this.emit('agent:idle', agentId);
    });
  }

  /**
   * Build/update the dependency graph for a story
   */
  private updateDependencyGraph(story: Story): void {
    if (!this.config.enableDependencyGraph || !story.dependencies) return;

    // Add edges: dependency -> this story
    for (const depId of story.dependencies) {
      if (!this.dependencyGraph.has(depId)) {
        this.dependencyGraph.set(depId, new Set());
      }
      this.dependencyGraph.get(depId)!.add(story.id);
    }

    // Compute blocked-by list
    story.blockedBy = story.dependencies.filter(depId => {
      const depStory = this.stories.get(depId);
      return depStory && depStory.status !== 'done' && depStory.status !== 'completed';
    });
  }

  /**
   * Get stories ready to be worked on (no unresolved dependencies)
   */
  getReadyStories(role: 'coder' | 'tester'): Story[] {
    const ready: Story[] = [];

    for (const story of this.stories.values()) {
      // Skip already assigned or completed stories
      if (this.storyAssignments.has(story.id)) continue;

      // Check status based on role
      if (role === 'coder') {
        if (story.status !== 'backlog' && story.status !== 'pending' && story.status !== 'failed') continue;
      } else if (role === 'tester') {
        if (story.status !== 'testing') continue;
      }

      // Check dependencies are resolved
      if (this.config.enableDependencyGraph && story.blockedBy && story.blockedBy.length > 0) {
        continue; // Still blocked
      }

      // Check retry limit for failed stories
      if (story.status === 'failed' && (story.retryCount || 0) >= 3) {
        continue; // Max retries exceeded
      }

      ready.push(story);
    }

    // Sort by priority (high > medium > low) then by creation order
    return ready.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const aPriority = priorityOrder[a.priority || 'medium'];
      const bPriority = priorityOrder[b.priority || 'medium'];
      return aPriority - bPriority;
    });
  }

  /**
   * Try to assign ready stories to available agents
   */
  private tryAssignStories(): void {
    // Get available coders
    const availableCoders = this.getAvailableAgents('coder');
    const readyStories = this.getReadyStories('coder');

    for (const agent of availableCoders) {
      if (readyStories.length === 0) break;

      const story = readyStories.shift()!;
      this.assignStoryToAgent(story, agent);
    }
  }

  /**
   * Try to assign a story to an available tester
   */
  private tryAssignToTester(story: Story): void {
    const availableTesters = this.getAvailableAgents('tester');
    if (availableTesters.length > 0) {
      this.assignStoryToAgent(story, availableTesters[0]);
    }
  }

  /**
   * Get agents of a role that are not currently working on a story
   */
  private getAvailableAgents(role: 'coder' | 'tester'): AgentConfig[] {
    const available: AgentConfig[] = [];
    const busyAgents = new Set(this.storyAssignments.values());

    for (const agent of this.activeAgents.values()) {
      if (agent.role === role && !busyAgents.has(agent.id)) {
        available.push(agent);
      }
    }

    return available;
  }

  /**
   * Assign a story to an agent
   */
  private assignStoryToAgent(story: Story, agent: AgentConfig): void {
    // Increment retry count for failed stories BEFORE changing status
    const wasFailedStory = story.status === 'failed';
    if (wasFailedStory) {
      story.retryCount = (story.retryCount || 0) + 1;
    }

    story.status = 'in_progress';
    story.assignedTo = agent.id;
    this.storyAssignments.set(story.id, agent.id);

    this.emit('story:assigned', { story, agent });
    this.emit('story:updated', story);
  }

  /**
   * Handle a failed story - route back for retry
   */
  private handleFailedStory(story: Story): void {
    // Release any locks held by this story
    this.releaseStoryLocks(story.id);

    // Clear assignment
    this.storyAssignments.delete(story.id);

    // Check retry limit
    if ((story.retryCount || 0) >= 3) {
      this.emit('story:maxRetries', story);
      return;
    }

    // Try to reassign
    this.tryAssignStories();
  }

  /**
   * Unblock stories that depended on a completed story
   */
  private unblockDependentStories(completedStoryId: string): void {
    const dependents = this.dependencyGraph.get(completedStoryId);
    if (!dependents) return;

    for (const depId of dependents) {
      const story = this.stories.get(depId);
      if (!story || !story.blockedBy) continue;

      // Remove completed story from blockedBy list
      story.blockedBy = story.blockedBy.filter(id => id !== completedStoryId);

      // If no longer blocked, emit event
      if (story.blockedBy.length === 0) {
        this.emit('story:unblocked', story);
      }
    }
  }

  // ============================================
  // FILE LOCKING (Real locking with proper-lockfile)
  // ============================================

  /**
   * Acquire a file lock using proper-lockfile
   */
  async acquireFileLock(file: string, agentId: string, storyId?: string): Promise<boolean> {
    if (!this.config.enableFileLocking) return true;

    const absolutePath = path.isAbsolute(file) ? file : path.join(this.workingDirectory, file);

    // Check if we already own the lock
    const existingLock = this.fileLocks.get(file);
    if (existingLock && existingLock.owner === agentId) {
      return true; // Already own it
    }

    // Check if another agent has it
    if (existingLock && existingLock.owner !== agentId) {
      // Check if lock is stale
      if (Date.now() - existingLock.acquiredAt > this.config.staleTimeout) {
        // Lock is stale, release it
        await this.releaseFileLock(file, existingLock.owner);
      } else {
        return false; // Lock held by another agent
      }
    }

    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });

      // Create empty file if it doesn't exist (lockfile needs the file to exist)
      try {
        await fs.access(absolutePath);
      } catch {
        await fs.writeFile(absolutePath, '');
      }

      // Acquire proper-lockfile lock
      await lockfile.lock(absolutePath, {
        stale: this.config.staleTimeout,
        retries: 3,
        realpath: false,
      });

      // Track our lock
      this.fileLocks.set(file, {
        file,
        owner: agentId,
        acquiredAt: Date.now(),
        storyId,
      });

      await this.persistFileLocks();
      return true;
    } catch (err: any) {
      if (err.code === 'ELOCKED') {
        return false; // Already locked by another process
      }
      console.error(`[FileLock] Error acquiring lock for ${file}:`, err.message);
      return false;
    }
  }

  /**
   * Release a file lock
   */
  async releaseFileLock(file: string, agentId: string): Promise<void> {
    if (!this.config.enableFileLocking) return;

    const lock = this.fileLocks.get(file);
    if (!lock || lock.owner !== agentId) return;

    const absolutePath = path.isAbsolute(file) ? file : path.join(this.workingDirectory, file);

    try {
      // Check if lock still exists before releasing
      if (await lockfile.check(absolutePath, { realpath: false })) {
        await lockfile.unlock(absolutePath, { realpath: false });
      }
    } catch (err: any) {
      // Ignore errors - lock may already be released
    }

    this.fileLocks.delete(file);
    await this.persistFileLocks();
  }

  /**
   * Release all locks held by a story
   */
  private async releaseStoryLocks(storyId: string): Promise<void> {
    const locksToRelease: string[] = [];

    for (const [file, lock] of this.fileLocks.entries()) {
      if (lock.storyId === storyId) {
        locksToRelease.push(file);
      }
    }

    for (const file of locksToRelease) {
      const lock = this.fileLocks.get(file)!;
      await this.releaseFileLock(file, lock.owner);
    }
  }

  /**
   * Get list of files locked by other agents (for context)
   */
  getLockedFilesExcluding(agentId: string): string[] {
    const locked: string[] = [];
    for (const [file, lock] of this.fileLocks.entries()) {
      if (lock.owner !== agentId) {
        locked.push(file);
      }
    }
    return locked;
  }

  /**
   * Persist file locks to disk (for recovery)
   */
  private async persistFileLocks(): Promise<void> {
    const locks = Array.from(this.fileLocks.values());
    try {
      await writeFileAtomic(this.lockFilePath, JSON.stringify(locks, null, 2));
    } catch (err) {
      // Non-critical, ignore
    }
  }

  /**
   * Load file locks from disk (for recovery)
   */
  async loadFileLocks(): Promise<void> {
    try {
      const data = await fs.readFile(this.lockFilePath, 'utf-8');
      const locks: FileLock[] = JSON.parse(data);

      // Filter out stale locks
      const now = Date.now();
      for (const lock of locks) {
        if (now - lock.acquiredAt < this.config.staleTimeout) {
          this.fileLocks.set(lock.file, lock);
        }
      }
    } catch {
      // File doesn't exist or invalid, start fresh
    }
  }

  // ============================================
  // ATOMIC STORY FILE OPERATIONS
  // ============================================

  /**
   * Load stories from disk with proper locking
   */
  async loadStories(): Promise<void> {
    try {
      // Try to acquire lock on stories file
      let release: (() => Promise<void>) | null = null;

      try {
        await fs.access(this.storiesFilePath);
        release = await lockfile.lock(this.storiesFilePath, {
          stale: 5000,
          retries: 5,
          realpath: false,
        });
      } catch {
        // File doesn't exist yet, that's fine
        return;
      }

      try {
        const data = await fs.readFile(this.storiesFilePath, 'utf-8');
        const parsed = JSON.parse(data);

        // Load stories
        for (const story of parsed.stories || []) {
          this.stories.set(story.id, story);
          this.updateDependencyGraph(story);
        }
      } finally {
        if (release) await release();
      }
    } catch (err: any) {
      console.error('[Coordinator] Error loading stories:', err.message);
    }
  }

  /**
   * Save stories to disk atomically
   */
  async saveStories(): Promise<void> {
    const data = {
      stories: Array.from(this.stories.values()),
      epics: [], // Can be extended
      lastUpdated: new Date().toISOString(),
    };

    try {
      await writeFileAtomic(this.storiesFilePath, JSON.stringify(data, null, 2));
    } catch (err: any) {
      console.error('[Coordinator] Error saving stories:', err.message);
    }
  }

  /**
   * Update a single story atomically
   */
  async updateStory(story: Story): Promise<void> {
    this.stories.set(story.id, story);
    this.emit('story:updated', story);
    await this.saveStories();
  }

  // ============================================
  // AGENT MANAGEMENT
  // ============================================

  /**
   * Register an agent with the coordinator
   */
  registerAgent(agent: AgentConfig): void {
    this.activeAgents.set(agent.id, agent);
    this.emit('agent:registered', agent);

    // Try to assign work immediately
    this.tryAssignStories();
  }

  /**
   * Unregister an agent
   */
  async unregisterAgent(agentId: string): Promise<void> {
    // Release any locks held by this agent
    for (const [file, lock] of this.fileLocks.entries()) {
      if (lock.owner === agentId) {
        await this.releaseFileLock(file, agentId);
      }
    }

    // Release any story assignments
    for (const [storyId, assignee] of this.storyAssignments.entries()) {
      if (assignee === agentId) {
        this.storyAssignments.delete(storyId);
        const story = this.stories.get(storyId);
        if (story) {
          story.status = 'backlog'; // Put back in queue
          story.assignedTo = undefined;
          this.emit('story:updated', story);
        }
      }
    }

    this.activeAgents.delete(agentId);
    this.emit('agent:unregistered', agentId);
  }

  /**
   * Create coder agents with unique ports
   */
  createCoderAgents(count: number): AgentConfig[] {
    const agents: AgentConfig[] = [];
    const actualCount = Math.min(count, this.config.maxCoders);

    for (let i = 0; i < actualCount; i++) {
      const agent: AgentConfig = {
        id: `coder-${i + 1}`,
        role: 'coder',
        port: 4567 + i, // Each coder gets unique port
      };
      agents.push(agent);
      this.registerAgent(agent);
    }

    return agents;
  }

  /**
   * Create tester agents
   */
  createTesterAgents(count: number): AgentConfig[] {
    const agents: AgentConfig[] = [];
    const actualCount = Math.min(count, this.config.maxTesters);

    for (let i = 0; i < actualCount; i++) {
      const agent: AgentConfig = {
        id: `tester-${i + 1}`,
        role: 'tester',
      };
      agents.push(agent);
      this.registerAgent(agent);
    }

    return agents;
  }

  // ============================================
  // CONTEXT GENERATION FOR AGENTS
  // ============================================

  /**
   * Generate context for an agent about to work on a story
   */
  generateAgentContext(agent: AgentConfig, story: Story): string {
    const lockedFiles = this.getLockedFilesExcluding(agent.id);

    let context = `
=== STORY ASSIGNMENT ===
Story: "${story.title}" (ID: ${story.id})
Status: ${story.status}
${story.description}
`;

    if (story.status === 'failed' && story.retryCount) {
      context += `
⚠️ RETRY ATTEMPT ${story.retryCount}/3
Previous failure reason: ${(story as any).result || 'Tests failed'}
`;
    }

    if (lockedFiles.length > 0) {
      context += `
⚠️ LOCKED FILES (DO NOT EDIT - being modified by other agents):
${lockedFiles.map(f => `- ${f}`).join('\n')}
`;
    }

    if (agent.role === 'coder' && agent.port) {
      context += `
Your designated port: ${agent.port}
Use this port when running npm run dev.
`;
    }

    return context;
  }

  // ============================================
  // STATUS & METRICS
  // ============================================

  /**
   * Get current coordinator status
   */
  getStatus(): {
    totalStories: number;
    byStatus: Record<string, number>;
    activeAgents: number;
    lockedFiles: number;
    pendingAssignments: number;
  } {
    const byStatus: Record<string, number> = {};
    for (const story of this.stories.values()) {
      byStatus[story.status] = (byStatus[story.status] || 0) + 1;
    }

    return {
      totalStories: this.stories.size,
      byStatus,
      activeAgents: this.activeAgents.size,
      lockedFiles: this.fileLocks.size,
      pendingAssignments: this.storyAssignments.size,
    };
  }
}

export default ParallelAgentCoordinator;
