/**
 * Story File Manager
 *
 * Handles .agile-stories.json file operations:
 * - Sync stories from file to session
 * - Persist session stories to file
 * - Load existing stories
 * - Handle status transitions and agent mappings
 *
 * Extracted from multi-agent-service.ts for better maintainability.
 */

import * as fs from 'fs/promises';
import path from 'path';
import lockfile from 'proper-lockfile';
import writeFileAtomic from 'write-file-atomic';
import { EventEmitter } from 'events';
import type {
  AgentRole,
  MultiAgentSession,
  Task,
} from '../agents/types';
import { createLogger, type Logger } from '@/lib/logger';

export interface StoryFileManagerOptions {
  emitter: EventEmitter;
}

// Cache for parsed stories files (10-15% speedup by avoiding re-parsing unchanged files)
const storiesCache = new Map<string, { mtime: number; stories: any }>();

export class StoryFileManager {
  private emitter: EventEmitter;
  private defaultLogger = createLogger('StoryFileManager');

  constructor(options: StoryFileManagerOptions) {
    this.emitter = options.emitter;
  }

  /**
   * Extract timestamp from a task ID
   * Task IDs typically have format: "story-{timestamp}-{index}" or "task-{timestamp}-{index}"
   * Returns null if no valid timestamp found
   */
  private extractTimestampFromId(taskId: string): number | null {
    // Look for a long number (epoch milliseconds - 13 digits starting with 1)
    const match = taskId.match(/\b(1\d{12})\b/);
    if (match) {
      const timestamp = parseInt(match[1], 10);
      // Sanity check: timestamp should be between 2020 and 2030
      const minDate = new Date('2020-01-01').getTime();
      const maxDate = new Date('2030-01-01').getTime();
      if (timestamp >= minDate && timestamp <= maxDate) {
        return timestamp;
      }
    }
    return null;
  }

  /**
   * Check if a task appears to be from an old build (before session started)
   * Returns true if the task should be rejected, false if it's valid
   */
  private isStaleTask(task: any, sessionCreatedAt: Date, logger: Logger): boolean {
    const taskTimestamp = this.extractTimestampFromId(task.id);
    if (!taskTimestamp) {
      // Can't determine timestamp, allow the task (could be foundation or custom ID)
      return false;
    }

    const sessionStartTime = sessionCreatedAt.getTime();
    // Allow 1 hour buffer for clock skew, but reject anything older
    const maxAgeMs = 60 * 60 * 1000; // 1 hour

    if (taskTimestamp < sessionStartTime - maxAgeMs) {
      const taskAge = Math.round((sessionStartTime - taskTimestamp) / (1000 * 60 * 60));
      logger.warn(
        `REJECTING stale task "${task.id}" - timestamp is ${taskAge} hours before session start. ` +
        `This may indicate old stories were restored from git. Task will NOT be added to session.`
      );
      return true;
    }

    return false;
  }

  /**
   * Get a logger with session context if available
   */
  private getLogger(session?: MultiAgentSession): Logger {
    if (session?.logContext) {
      return createLogger('StoryFileManager', session.logContext);
    }
    return this.defaultLogger;
  }

  /**
   * Get the stories file path for a working directory
   */
  getStoriesFilePath(workingDirectory: string): string {
    return path.join(workingDirectory, '.agile-stories.json');
  }

  /**
   * Ensure stories file exists, create if not
   */
  async ensureStoriesFile(session: MultiAgentSession): Promise<string> {
    const storiesFile = this.getStoriesFilePath(session.workingDirectory);
    try {
      await fs.access(storiesFile);
    } catch {
      await writeFileAtomic(storiesFile, JSON.stringify({
        tasks: session.tasks,
        epics: session.epics || [],
        lastUpdated: new Date().toISOString(),
      }, null, 2));
    }
    return storiesFile;
  }

  /**
   * Check if a status transition is allowed
   * Blocks: in_progress/testing/done -> backlog (stale file race condition)
   */
  private isTransitionAllowed(fromStatus: string, toStatus: string): boolean {
    // Allow transitions TO done/completed (but validate test results separately)
    if (toStatus === 'done' || toStatus === 'completed') return true;
    // Always allow transitions TO testing (story ready for test)
    if (toStatus === 'testing' || toStatus === 'ready_for_testing') return true;
    // Always allow transitions TO failed (test failure)
    if (toStatus === 'failed') return true;
    // Allow transitions TO in_progress from backlog/pending/failed (start/retry)
    if (toStatus === 'in_progress') {
      return ['backlog', 'pending', 'failed'].includes(fromStatus);
    }
    // Block going back to backlog from progressed states (but allow in_progress for stuck recovery)
    if (toStatus === 'backlog' || toStatus === 'pending') {
      return ['backlog', 'pending', 'in_progress'].includes(fromStatus);
    }
    return true; // Default allow
  }

  /**
   * Sync stories from file to session
   * Handles status transitions and agent mappings
   */
  async syncStoriesFromFile(
    session: MultiAgentSession,
    storiesFile: string,
    role: AgentRole,
    agentName: string,
    callerAgentId?: string
  ): Promise<void> {
    const logger = this.getLogger(session);

    try {
      // Check file mtime first to avoid unnecessary parsing (10-15% speedup)
      const stat = await fs.stat(storiesFile);
      const mtime = stat.mtimeMs;
      const cached = storiesCache.get(storiesFile);

      let stories: any;
      if (cached && cached.mtime === mtime) {
        // File unchanged, use cached parsed content
        stories = cached.stories;
      } else {
        // File changed or not cached, parse and cache
        const storiesContent = await fs.readFile(storiesFile, 'utf-8');
        stories = JSON.parse(storiesContent);

        // Normalize status values - coders sometimes write "ready_for_testing" instead of "testing"
        for (const task of stories.tasks || []) {
          if (task.status === 'ready_for_testing') {
            logger.debug(`Normalizing status: ${task.id} "ready_for_testing" -> "testing"`);
            task.status = 'testing';
          }
        }

        storiesCache.set(storiesFile, { mtime, stories });
      }

      // Sync task updates
      for (const fileTask of stories.tasks || []) {
        const sessionTask = session.tasks.find(t => t.id === fileTask.id);
        if (sessionTask && sessionTask.status !== fileTask.status) {
          if (this.isTransitionAllowed(sessionTask.status, fileTask.status)) {
            const oldStatus = sessionTask.status;
            let newStatus = fileTask.status;

            sessionTask.status = newStatus;
            // Also sync result field for test output visibility
            if (fileTask.result) {
              sessionTask.result = fileTask.result;
            }
            logger.log(`Task ${fileTask.id} status: ${oldStatus} -> ${newStatus}`);

            // Use session's assignedTo (which has specific coder ID) over file's generic "coder"
            const effectiveAssignedTo = sessionTask.assignedTo || fileTask.assignedTo;

            // Handle status-specific logic
            this.handleStatusChange(
              session,
              fileTask,
              sessionTask,
              effectiveAssignedTo,
              callerAgentId,
              logger
            );
          } else {
            logger.warn(`Task ${fileTask.id} transition BLOCKED: ${sessionTask.status} -> ${fileTask.status}`);
          }
        }
      }

      // Sync new tasks from file (e.g., tasks created by agents)
      for (const fileTask of stories.tasks || []) {
        const existingTask = session.tasks.find(t => t.id === fileTask.id);
        if (!existingTask) {
          // CRITICAL: Validate task timestamp to prevent old stories from being added
          // This protects against git restore, race conditions, or agent errors
          if (this.isStaleTask(fileTask, session.createdAt, logger)) {
            // Task is from an old build - skip it
            continue;
          }

          logger.log(`New task from file: ${fileTask.id} - ${fileTask.title}`);
          // Normalize the task to ensure camelCase fields
          const normalizedTask = this.normalizeTask(fileTask);
          session.tasks.push(normalizedTask);
          this.emitter.emit('task:created', normalizedTask);
        }
      }

      // Sync epics
      for (const fileEpic of stories.epics || []) {
        const existsInSession = session.epics.some(e => e.id === fileEpic.id);
        if (!existsInSession) {
          // CRITICAL: Validate epic timestamp to prevent old epics from being added
          if (this.isStaleTask(fileEpic, session.createdAt, logger)) {
            // Epic is from an old build - skip it
            continue;
          }

          logger.log(`New epic from file: ${fileEpic.id} - ${fileEpic.title}`);
          session.epics.push({
            ...fileEpic,
            createdAt: fileEpic.createdAt ? new Date(fileEpic.createdAt) : new Date(),
          });
          this.emitter.emit('epic:created', fileEpic);
        }
      }
    } catch (err: any) {
      // File doesn't exist yet or invalid JSON - this is fine during initial setup
      if (err.code !== 'ENOENT') {
        logger.warn(`Error syncing stories: ${err.message}`);
      }
    }
  }

  /**
   * Handle status change events and agent mappings
   */
  private handleStatusChange(
    session: MultiAgentSession,
    fileTask: any,
    sessionTask: Task,
    effectiveAssignedTo: any,
    callerAgentId?: string,
    logger?: Logger
  ): void {
    const log = logger || this.defaultLogger;
    if (fileTask.status === 'in_progress') {
      const assignedAgent = typeof effectiveAssignedTo === 'string' && effectiveAssignedTo.startsWith('coder-')
        ? effectiveAssignedTo
        : 'coder-main';

      const effectiveAgentId = callerAgentId || assignedAgent;
      if (!callerAgentId || callerAgentId === assignedAgent) {
        session.agentToStory.set(effectiveAgentId, fileTask.id);
        sessionTask.assignedTo = effectiveAgentId as AgentRole;
        log.debug(`Updated agentToStory: ${effectiveAgentId} -> ${fileTask.id}`);
      }

      this.emitter.emit('story:started', {
        storyId: fileTask.id,
        storyTitle: fileTask.title,
        agentId: effectiveAgentId,
        status: 'in_progress',
        acceptanceCriteria: sessionTask.acceptanceCriteria || fileTask.acceptanceCriteria || fileTask.acceptance_criteria || [],
      });
    } else if (fileTask.status === 'testing') {
      // Clear coder mappings
      for (const [mappedAgentId, mappedStoryId] of session.agentToStory) {
        if (mappedStoryId === fileTask.id && mappedAgentId.startsWith('coder')) {
          session.agentToStory.delete(mappedAgentId);
        }
      }

      const assignedTester = typeof effectiveAssignedTo === 'string' && effectiveAssignedTo.startsWith('tester')
        ? effectiveAssignedTo
        : null;

      const shouldMapTester = !callerAgentId ||
        (assignedTester && callerAgentId === assignedTester) ||
        (!assignedTester && callerAgentId?.startsWith('tester'));

      const effectiveTesterId = callerAgentId || assignedTester || 'tester';
      if (shouldMapTester) {
        session.agentToStory.set(effectiveTesterId, fileTask.id);
      }

      this.emitter.emit('story:testing', {
        storyId: fileTask.id,
        storyTitle: fileTask.title,
        agentId: effectiveTesterId,
        status: 'testing',
        acceptanceCriteria: sessionTask.acceptanceCriteria || fileTask.acceptanceCriteria || fileTask.acceptance_criteria || [],
      });

      this.emitter.emit('task:updated', {
        ...sessionTask,
        status: 'testing',
        assignedTo: 'tester',
        acceptanceCriteria: sessionTask.acceptanceCriteria || fileTask.acceptanceCriteria || fileTask.acceptance_criteria || [],
      });
    } else if (fileTask.status === 'done' || fileTask.status === 'completed') {
      // Clear all agent mappings
      for (const [mappedAgentId, mappedStoryId] of session.agentToStory) {
        if (mappedStoryId === fileTask.id) {
          session.agentToStory.delete(mappedAgentId);
        }
      }

      // Clean up tester assignments
      const testerAssignments = (session as any).testerStoryAssignments as Map<string, string> | undefined;
      if (testerAssignments?.has(fileTask.id)) {
        testerAssignments.delete(fileTask.id);
      }

      const testedStories = (session as any).testedStoryIds as Set<string> | undefined;
      if (testedStories) {
        testedStories.add(fileTask.id);
      }

      this.emitter.emit('story:completed', {
        storyId: fileTask.id,
        storyTitle: fileTask.title,
        status: fileTask.status,
        acceptanceCriteria: sessionTask.acceptanceCriteria || fileTask.acceptanceCriteria || fileTask.acceptance_criteria || [],
      });
    } else if (fileTask.status === 'failed') {
      // Clear all agent mappings
      for (const [mappedAgentId, mappedStoryId] of session.agentToStory) {
        if (mappedStoryId === fileTask.id) {
          session.agentToStory.delete(mappedAgentId);
        }
      }

      this.emitter.emit('story:failed', {
        storyId: fileTask.id,
        storyTitle: fileTask.title,
        status: 'failed',
        acceptanceCriteria: sessionTask.acceptanceCriteria || fileTask.acceptanceCriteria || fileTask.acceptance_criteria || [],
      });
    }

    // Always emit task:updated for all status changes
    // Include acceptanceCriteria from file if session task doesn't have it
    const acceptanceCriteria = sessionTask.acceptanceCriteria ||
      fileTask.acceptanceCriteria ||
      fileTask.acceptance_criteria ||
      [];

    this.emitter.emit('task:updated', {
      ...sessionTask,
      status: fileTask.status,
      assignedTo: effectiveAssignedTo,
      acceptanceCriteria,
    });
  }

  /**
   * Persist session stories to file with locking
   */
  async persistStoriesToFile(session: MultiAgentSession): Promise<void> {
    const storiesFile = this.getStoriesFilePath(session.workingDirectory);
    let release: (() => Promise<void>) | null = null;

    try {
      // Acquire lock before writing
      release = await lockfile.lock(storiesFile, {
        retries: { retries: 5, minTimeout: 100, maxTimeout: 1000 },
        stale: 10000,
      });

      await writeFileAtomic(storiesFile, JSON.stringify({
        tasks: session.tasks,
        epics: session.epics,
        lastUpdated: new Date().toISOString(),
      }, null, 2));

      // Invalidate cache
      storiesCache.delete(storiesFile);
    } catch (err: any) {
      console.error(`[StoryFileManager] Error persisting stories: ${err.message}`);
    } finally {
      if (release) {
        await release();
      }
    }
  }

  /**
   * Normalize a task object (convert snake_case fields to camelCase)
   */
  private normalizeTask(task: any): Task {
    return {
      ...task,
      // Convert snake_case to camelCase for key fields
      epicId: task.epicId || task.epic_id,
      storyPoints: task.storyPoints || task.story_points || 3,
      assignedTo: task.assignedTo || task.assigned_to,
      acceptanceCriteria: task.acceptanceCriteria || task.acceptance_criteria || [],
      dependsOn: task.dependsOn || task.depends_on || [],
      createdAt: task.createdAt || task.created_at || new Date().toISOString(),
      updatedAt: task.updatedAt || task.updated_at || new Date().toISOString(),
    };
  }

  /**
   * Load existing stories from file into session
   */
  async loadExistingStories(session: MultiAgentSession): Promise<void> {
    const storiesFile = this.getStoriesFilePath(session.workingDirectory);

    try {
      const content = await fs.readFile(storiesFile, 'utf-8');
      const data = JSON.parse(content);

      if (data.tasks && Array.isArray(data.tasks)) {
        // Normalize all tasks to ensure camelCase fields
        session.tasks = data.tasks.map((t: any) => this.normalizeTask(t));
        console.log(`[StoryFileManager] Loaded ${data.tasks.length} existing stories`);
      }

      if (data.epics && Array.isArray(data.epics)) {
        session.epics = data.epics.map((e: any) => ({
          ...e,
          createdAt: e.createdAt ? new Date(e.createdAt) : new Date(),
        }));
        console.log(`[StoryFileManager] Loaded ${data.epics.length} existing epics`);
      }

      // Emit loaded tasks/epics
      for (const task of session.tasks) {
        this.emitter.emit('task:created', task);
      }
      for (const epic of session.epics) {
        this.emitter.emit('epic:created', epic);
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        console.warn(`[StoryFileManager] Error loading existing stories: ${err.message}`);
      }
    }
  }

  /**
   * Clear the stories cache
   */
  clearCache(): void {
    storiesCache.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return storiesCache.size;
  }

  /**
   * Archive completed stories to reduce main file size
   * Moves all 'done' and 'completed' stories to .agile-stories-archive.json
   */
  async archiveCompletedStories(
    session: MultiAgentSession,
    options: { keepRecentCount?: number } = {}
  ): Promise<{ archived: number; remaining: number }> {
    const storiesFile = this.getStoriesFilePath(session.workingDirectory);
    const archiveFile = path.join(session.workingDirectory, '.agile-stories-archive.json');
    let release: (() => Promise<void>) | null = null;

    try {
      // Acquire lock
      release = await lockfile.lock(storiesFile, {
        retries: { retries: 5, minTimeout: 100, maxTimeout: 1000 },
        stale: 10000,
      });

      // Read current stories
      const content = await fs.readFile(storiesFile, 'utf-8');
      const data = JSON.parse(content);
      const allTasks: Task[] = data.tasks || [];

      // Separate active from completed
      const completedStatuses = ['done', 'completed'];
      const { keepRecentCount = 0 } = options;

      const activeTasks: Task[] = [];
      const toArchive: Task[] = [];

      for (const task of allTasks) {
        const isCompleted = completedStatuses.includes(task.status);

        if (!isCompleted) {
          activeTasks.push(task);
        } else {
          toArchive.push(task);
        }
      }

      // If keepRecentCount > 0, move some back to active
      if (keepRecentCount > 0 && toArchive.length > keepRecentCount) {
        // Sort by some timestamp or ID (newer last)
        toArchive.sort((a, b) => {
          // Use ID which contains timestamp
          const aTime = parseInt(a.id.match(/\d+/)?.[0] || '0');
          const bTime = parseInt(b.id.match(/\d+/)?.[0] || '0');
          return aTime - bTime;
        });
        // Keep the newest ones
        const toKeep = toArchive.splice(-keepRecentCount);
        activeTasks.push(...toKeep);
      }

      if (toArchive.length === 0) {
        console.log('[StoryFileManager] No stories to archive');
        return { archived: 0, remaining: activeTasks.length };
      }

      // Read or create archive file
      let archiveData: { tasks: Task[]; archivedAt: string[] } = { tasks: [], archivedAt: [] };
      try {
        const archiveContent = await fs.readFile(archiveFile, 'utf-8');
        archiveData = JSON.parse(archiveContent);
      } catch {
        // Archive doesn't exist yet
      }

      // Add to archive (avoid duplicates)
      const existingIds = new Set(archiveData.tasks.map(t => t.id));
      for (const task of toArchive) {
        if (!existingIds.has(task.id)) {
          archiveData.tasks.push(task);
        }
      }
      archiveData.archivedAt.push(new Date().toISOString());

      // Write archive file
      await writeFileAtomic(archiveFile, JSON.stringify(archiveData, null, 2));

      // Write updated main file (with only active stories)
      await writeFileAtomic(storiesFile, JSON.stringify({
        tasks: activeTasks,
        epics: data.epics || [],
        lastUpdated: new Date().toISOString(),
        lastArchived: new Date().toISOString(),
      }, null, 2));

      // Update session tasks
      session.tasks = activeTasks;

      // Invalidate cache
      storiesCache.delete(storiesFile);

      console.log(`[StoryFileManager] Archived ${toArchive.length} stories, ${activeTasks.length} remaining`);
      return { archived: toArchive.length, remaining: activeTasks.length };
    } catch (err: any) {
      console.error(`[StoryFileManager] Error archiving stories: ${err.message}`);
      throw err;
    } finally {
      if (release) {
        await release();
      }
    }
  }

  /**
   * Get archive file path
   */
  getArchiveFilePath(workingDirectory: string): string {
    return path.join(workingDirectory, '.agile-stories-archive.json');
  }

  /**
   * Get story counts for a project
   */
  async getStoryCounts(workingDirectory: string): Promise<{
    active: number;
    completed: number;
    archived: number;
    total: number;
  }> {
    const storiesFile = this.getStoriesFilePath(workingDirectory);
    const archiveFile = this.getArchiveFilePath(workingDirectory);

    let activeTasks: Task[] = [];
    let archivedTasks: Task[] = [];

    try {
      const content = await fs.readFile(storiesFile, 'utf-8');
      const data = JSON.parse(content);
      activeTasks = data.tasks || [];
    } catch {}

    try {
      const content = await fs.readFile(archiveFile, 'utf-8');
      const data = JSON.parse(content);
      archivedTasks = data.tasks || [];
    } catch {}

    const completedStatuses = ['done', 'completed'];
    const active = activeTasks.filter(t => !completedStatuses.includes(t.status)).length;
    const completed = activeTasks.filter(t => completedStatuses.includes(t.status)).length;

    return {
      active,
      completed,
      archived: archivedTasks.length,
      total: activeTasks.length + archivedTasks.length,
    };
  }
}
