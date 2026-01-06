/**
 * Context Builder Types
 *
 * Type definitions for context building extracted from multi-agent-service.ts
 */

import type { AgentRole, MultiAgentSession, Task } from '../types';

/**
 * Configuration for coder context building
 */
export interface CoderContextConfig {
  /** Whether batch mode is enabled (multiple stories at once) */
  batchMode: boolean;
  /** Number of stories per batch */
  batchSize: number;
  /** Number of parallel coder instances */
  parallelCoders: number;
  /** Coder instance ID (e.g., 'coder-1', 'coder-2') */
  coderId: string;
  /** Port assigned to this coder for dev server */
  coderPort: number;
}

/**
 * Configuration for tester context building
 */
export interface TesterContextConfig {
  /** Number of parallel tester instances */
  parallelTesters: number;
  /** Tester instance ID */
  testerId: string;
}

/**
 * Story with acceptance criteria (extended Task type)
 */
export interface StoryWithCriteria extends Task {
  acceptanceCriteria?: string[];
  epicId?: string;
  dependsOn?: string[];
}

/**
 * Context for a failed story retry
 */
export interface FailedStoryContext {
  story: StoryWithCriteria;
  retryCount: number;
  maxRetries: number;
  previousError: string;
}

/**
 * Parameters for building coder context
 */
export interface CoderContextParams {
  session: MultiAgentSession;
  requirements: string;
  existingFiles: string;
  config: CoderContextConfig;
  stories: StoryWithCriteria[];
  lockedFiles: string[];
  isFailedStory?: FailedStoryContext;
}

/**
 * Parameters for building tester context
 */
export interface TesterContextParams {
  session: MultiAgentSession;
  storySummary: string;
  stories: StoryWithCriteria[];
  config: TesterContextConfig;
}

/**
 * State tracking for story assignments
 * Used to prevent race conditions when multiple agents run in parallel
 */
export interface StoryAssignmentState {
  /** Maps story ID to coder ID */
  coderAssignments: Map<string, string>;
  /** Set of story IDs being tested */
  testerAssignments: Map<string, boolean>;
  /** Maps tester ID to story ID */
  testerToStory: Map<string, string>;
  /** Set of already tested story IDs */
  testedStories: Set<string>;
  /** Maps story ID to retry count */
  failedRetries: Map<string, number>;
}

/**
 * Result of getting the next story for a role
 */
export interface NextStoryResult {
  story: StoryWithCriteria | null;
  isFailedRetry: boolean;
  retryCount: number;
}
