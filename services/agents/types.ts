/**
 * Multi-Agent Service Types
 *
 * Extracted from multi-agent-service.ts for better maintainability.
 * Contains all type definitions used across the agent system.
 */

// Agent role types
export type AgentRole =
  | 'coder'
  | 'tester'
  | 'security'
  | 'coordinator'
  | 'product_owner'
  | 'fixer'
  | 'researcher'
  | 'architecture'
  | 'data_architect';

// Message types for agent communication
export interface AgentMessage {
  id: string;
  agentRole: AgentRole;
  agentName: string;
  type: 'thinking' | 'action' | 'result' | 'chat' | 'error';
  content: string;
  timestamp: Date;
  toolName?: string;
  toolInput?: any;
  /** Instance number for parallel agents (e.g., 1 for "Coder 1", 2 for "Coder 2") */
  instanceNumber?: number;
  /** Story ID this message relates to (for filtering logs per story) */
  storyId?: string;
}

// Task/Story types
export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'backlog' | 'in_progress' | 'testing' | 'done' | 'completed' | 'failed';
  assignedTo?: AgentRole;
  /** Which agent instance is currently working on this (e.g., "coder-1", "tester") */
  workingAgent?: string | null;
  files?: string[];
  result?: string;
  acceptanceCriteria?: string[];
  storyPoints?: number;
  priority?: 'high' | 'medium' | 'low' | 'critical';
  epicId?: string;
  /** Story IDs that must be completed before this story can start */
  dependsOn?: string[];
  /** Domain of the story (for routing to correct agent) */
  domain?: 'auth' | 'data' | 'ui' | 'api' | 'infra';
  /** When the story was created */
  createdAt?: Date;
}

// Agent state tracking
export interface AgentState {
  role: AgentRole;
  name: string;
  status: 'idle' | 'working' | 'waiting' | 'completed' | 'error';
  currentTask?: string;
  completedTasks: string[];
}

// Parallel coder configuration
export interface CoderConfig {
  parallelCoders: number; // 1-5 coders working in parallel
  batchMode: boolean; // Single coder handles multiple stories at once
  batchSize: number; // How many stories per batch (when batchMode is true)
  /** @deprecated Use isExistingProject instead */
  skipFoundation?: boolean;
  /** @deprecated No longer used - each build is clean slate */
  currentIterationId?: string;
  /** When true, project already exists - don't run create-next-app, don't create setup stories */
  isExistingProject?: boolean;
}

// Command execution logging
export interface CommandLog {
  command: string;
  output: string;
  error?: string;
  exitCode: number;
  timestamp: Date;
  agent: AgentRole;
}

// Epic structure
export interface Epic {
  id: string;
  projectId: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'done';
  stories: string[]; // Story IDs
  createdAt: Date;
}

// Correlation context for structured logging
export interface LogContext {
  sessionId?: string;
  buildNumber?: number;
  projectId?: string;
  agentRole?: string;
  storyId?: string;
  instanceNumber?: number;
}

// Session management
export interface MultiAgentSession {
  id: string;
  projectId: string;
  projectName?: string; // Human-readable project name for generating env configs
  agents: Map<AgentRole, AgentState>;
  tasks: Task[];
  epics: Epic[]; // Store epics for persistence
  messages: AgentMessage[];
  commandLogs: CommandLog[]; // Store command outputs for fixer to analyze
  workingDirectory: string;
  createdAt: Date;
  updatedAt: Date;
  coderConfig: CoderConfig;
  fileLocks: Map<string, string>; // file path -> coder instance id
  agentToStory: Map<string, string>; // agentId (e.g., "coder-1", "tester") -> current storyId for log filtering
  auditService?: any; // Audit logging service for compliance (typed as any to avoid circular deps)
  currentBuildId?: string; // Current build ID for audit tracking
  logContext?: LogContext; // Correlation context for structured logging
}

// Checkpoint for pause/resume functionality
export interface SessionCheckpoint {
  version: number; // Schema version for future migrations
  sessionId: string;
  projectId: string;
  timestamp: string;
  phase: 'product_owner' | 'coder' | 'tester' | 'security' | 'complete';
  completedAgents: AgentRole[];
  tasks: Task[];
  epics: Epic[];
  lastMessageId?: string;
  requirements: string;
  agentsToRun: AgentRole[];
  // Metrics at checkpoint time
  metrics?: {
    filesCreated: number;
    filesModified: number;
    testsRun: number;
    testsPassed: number;
  };
  // Runner state for resume (added for coder checkpointing)
  runnerState?: {
    completedStoryIds: string[];
    foundationStoryId: string | null;
    foundationComplete: boolean;
  };
}

// Tool definition
export interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// Agent mode configuration
export interface AgentModeConfig {
  mode: 'default' | 'healthcare';
  healthcareSettings?: {
    includeEpicAPIs: boolean;
    includeTestPatients: boolean;
    includeFHIRExamples: boolean;
    ehrPlatform: 'epic' | 'cerner' | 'generic';
    complianceLevel: 'hipaa' | 'hitech' | 'basic';
  };
  configuredAt: string | null;
}

// Architecture context for agent prompts
export interface ArchitectureContext {
  projectDir: string;
  structure: string;
  techStack: string[];
  patterns: string[];
  conventions: string[];
  keyFiles: string[];
  lastUpdated: number;
}

// Agent configuration
export interface AgentConfig {
  name: string;
  color: string;
  systemPrompt: string;
}

// Progress callback for streaming updates
export type ProgressCallback = (message: AgentMessage) => void;

// Build result
export interface BuildResult {
  success: boolean;
  error?: string;
  projectDir: string;
  filesCreated?: string[];
  commandsRun?: CommandLog[];
}
