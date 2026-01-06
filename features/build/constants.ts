import {
  Code2,
  Users,
  Kanban,
  TestTube,
  Shield,
  Wrench,
  Target,
  Bot,
  FileCode,
  Terminal,
  AlertCircle,
  FolderTree,
} from 'lucide-react';
import type { AgentRole, KanbanColumn, TaskStatus, QuickSettings } from './types';

/**
 * Agent role text colors
 */
export const AGENT_COLORS: Record<AgentRole, string> = {
  coordinator: 'text-purple-500',
  product_owner: 'text-orange-500',
  coder: 'text-blue-500',
  tester: 'text-green-500',
  security: 'text-red-500',
  fixer: 'text-amber-500',
  researcher: 'text-cyan-500',
};

/**
 * Agent role background colors
 */
export const AGENT_BG_COLORS: Record<AgentRole, string> = {
  coordinator: 'bg-purple-500/10',
  product_owner: 'bg-orange-500/10',
  coder: 'bg-blue-500/10',
  tester: 'bg-green-500/10',
  security: 'bg-red-500/10',
  fixer: 'bg-amber-500/10',
  researcher: 'bg-cyan-500/10',
};

/**
 * Agent role icons
 */
export const AGENT_ICONS: Record<AgentRole, typeof Code2> = {
  coordinator: Users,
  product_owner: Kanban,
  coder: Code2,
  tester: TestTube,
  security: Shield,
  fixer: Wrench,
  researcher: Target,
};

/**
 * Kanban board columns
 */
export const KANBAN_COLUMNS: KanbanColumn[] = [
  { id: 'backlog', title: 'BACKLOG', color: 'bg-slate-700 text-white' },
  { id: 'in_progress', title: 'IN PROGRESS', color: 'bg-blue-600 text-white' },
  { id: 'testing', title: 'TESTING', color: 'bg-amber-500 text-black font-bold' },
  { id: 'done', title: 'DONE', color: 'bg-green-600 text-white' },
];

/**
 * Map task status to Kanban column
 */
export const STATUS_TO_COLUMN: Record<TaskStatus, TaskStatus> = {
  backlog: 'backlog',
  pending: 'backlog',
  in_progress: 'in_progress',
  testing: 'testing',
  completed: 'done',
  done: 'done',
  failed: 'backlog',
};

/**
 * Default build metrics
 */
export const DEFAULT_BUILD_METRICS = {
  startTime: 0,
  elapsedTime: 0,
  filesCreated: 0,
  filesModified: 0,
  commandsRun: 0,
  toolCalls: 0,
  tokensUsed: 0,
  linesOfCode: 0,
  iterations: 0,
};

/**
 * Default testing metrics
 */
export const DEFAULT_TESTING_METRICS = {
  totalTests: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  passRate: 0,
  coverage: undefined,
  duration: 0,
  storiesTested: 0,
  storiesPassed: 0,
  testFiles: [],
  seenTaskIds: [],
  // Rich metrics
  coverageBreakdown: undefined,
  individualTests: [],
  fileResults: [],
  performance: undefined,
  failedTestDetails: [],
  lastRunTimestamp: undefined,
};

/**
 * Agent display names
 */
export const AGENT_NAMES: Record<AgentRole, string> = {
  coordinator: 'Coordinator',
  product_owner: 'Product Owner',
  coder: 'Coder',
  tester: 'Tester',
  security: 'Security',
  fixer: 'Fixer',
  researcher: 'Researcher',
};

/**
 * Agent icons for terminal/log views
 */
export const AGENT_TERMINAL_ICONS: Record<AgentRole, typeof Code2> = {
  coordinator: Bot,
  product_owner: FileCode,
  coder: Code2,
  tester: Terminal,
  security: AlertCircle,
  fixer: Wrench,
  researcher: FolderTree,
};

/**
 * Agent colors for terminal/log views
 */
export const AGENT_TERMINAL_COLORS: Record<AgentRole, string> = {
  coordinator: 'text-purple-400',
  product_owner: 'text-emerald-400',
  coder: 'text-blue-400',
  tester: 'text-yellow-400',
  security: 'text-red-400',
  fixer: 'text-orange-400',
  researcher: 'text-cyan-400',
};

/**
 * Kanban column visual styles
 */
export const KANBAN_COLUMN_COLORS: Record<string, { header: string; border: string; bg: string }> = {
  backlog: { header: 'from-slate-500/20 to-slate-600/10', border: 'border-slate-500/30', bg: 'bg-slate-500/5' },
  in_progress: { header: 'from-blue-500/20 to-blue-600/10', border: 'border-blue-500/30', bg: 'bg-blue-500/5' },
  testing: { header: 'from-amber-500/20 to-amber-600/10', border: 'border-amber-500/30', bg: 'bg-amber-500/5' },
  done: { header: 'from-emerald-500/20 to-emerald-600/10', border: 'border-emerald-500/30', bg: 'bg-emerald-500/5' },
};

/**
 * Default quick settings
 */
export const DEFAULT_QUICK_SETTINGS: QuickSettings = {
  minStories: 2,
  maxStories: 6,
  minEpics: 4,
  maxEpics: 12,
  maxRetries: 2,
  requireTests: true,
  minCoverage: 0,
  parallelCoders: 3,
  parallelTesters: 6,
  securityScanEnabled: true,
  blockOnCritical: false,
  defaultModel: 'sonnet',
  maxTurnsPerAgent: 50,
  verboseLogging: false,
};

/**
 * Default security metrics
 */
export const DEFAULT_SECURITY_METRICS = {
  score: 100,
  grade: 'A' as const,
  riskLevel: 'low' as const,
  findings: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
  owasp: {} as Record<string, { name: string; status: 'pass' | 'fail' | 'warn'; findings: number }>,
  breakdown: { sast: 100, secrets: 100, dependencies: 100 },
  vulnerabilities: [],
};

/**
 * Default DORA metrics
 */
export const DEFAULT_DORA_METRICS = {
  deploymentFrequency: 0,
  leadTimeForChanges: 0,
  changeFailureRate: 0,
  meanTimeToRecovery: 0,
  dfRating: 'low' as const,
  ltRating: 'low' as const,
  cfrRating: 'low' as const,
  mttrRating: 'low' as const,
};

/**
 * Connection configuration
 */
export const MAX_RECONNECT_ATTEMPTS = 5;
export const HEARTBEAT_INTERVAL = 30000; // 30 seconds
export const RECONNECT_DELAY = 2000; // 2 seconds

/**
 * Preview server configuration
 */
export const PREVIEW_POLL_INTERVAL = 1000; // 1 second
export const PREVIEW_MAX_RETRIES = 30;
