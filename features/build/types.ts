/**
 * Complex Build Feature Types
 */

// Re-export new build history types
export type {
  BuildMetadata,
  BuildHistoryEntry,
  MetricsSnapshot as BuildMetricsSnapshot,
} from '@/lib/build-history';

export interface Epic {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  stories: string[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assignedTo?: string;
  priority?: 'low' | 'medium' | 'high';
  storyPoints?: number;
  epicId?: string;
  acceptanceCriteria?: string[];
  error?: string;
  result?: string;
  /** When this task was created */
  createdAt?: string;
}

export type TaskStatus =
  | 'backlog'
  | 'pending'
  | 'in_progress'
  | 'testing'
  | 'completed'
  | 'done'
  | 'failed';

export type BuildPhase = 'loading' | 'planned' | 'building' | 'completed' | 'error' | 'paused' | 'stopped';

export interface ResearchSuggestion {
  id: string;
  category: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  effort: 'small' | 'medium' | 'large';
  impact: string;
  implementationHint?: string;
}

export type AgentRole =
  | 'coordinator'
  | 'coder'
  | 'tester'
  | 'security'
  | 'product_owner'
  | 'fixer'
  | 'researcher';

export type MessageType = 'thinking' | 'action' | 'result' | 'chat' | 'error';

export interface AgentMessage {
  id: string;
  agentRole: AgentRole;
  agentName: string;
  type: MessageType;
  content: string;
  toolName?: string;
  timestamp: string;
  /** Instance number for parallel agents (e.g., 1 for "Coder 1", 2 for "Coder 2") */
  instanceNumber?: number;
  /** Story ID this message relates to (for filtering logs per story) */
  storyId?: string;
}

export interface FileChange {
  path: string;
  action: string;
  timestamp: Date;
}

export type BuildLogType = 'info' | 'success' | 'warning' | 'error' | 'command' | 'tool' | 'file';

export interface BuildLog {
  id: string;
  type: BuildLogType;
  message: string;
  detail?: string;
  timestamp: Date;
}

export interface BuildMetrics {
  startTime: number;
  elapsedTime: number;
  filesCreated: number;
  filesModified: number;
  commandsRun: number;
  toolCalls: number;
  tokensUsed: number;
  linesOfCode: number;
  iterations: number;
}

export type DoraRating = 'elite' | 'high' | 'medium' | 'low';

export interface DoraMetrics {
  deploymentFrequency: number;
  leadTimeForChanges: number;
  changeFailureRate: number;
  meanTimeToRecovery: number;
  dfRating: DoraRating;
  ltRating: DoraRating;
  cfrRating: DoraRating;
  mttrRating: DoraRating;
}

export type SecurityGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical' | 'minimal';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type OwaspStatus = 'pass' | 'fail' | 'warn';

export interface SecurityVulnerability {
  severity: Severity;
  file: string;
  line?: number;
  type: string;
  description: string;
  remediation: string;
  owasp?: string;
  cwe?: string;
}

export interface SecurityMetrics {
  score: number;
  grade: SecurityGrade;
  riskLevel: RiskLevel;
  findings: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  owasp: Record<string, { name: string; status: OwaspStatus; findings: number }>;
  breakdown: {
    sast: number;
    secrets: number;
    dependencies: number;
  };
  vulnerabilities: SecurityVulnerability[];
  summary?: {
    totalFindings: number;
    criticalFindings: number;
    highFindings: number;
    mediumFindings: number;
    lowFindings: number;
    filesScanned: number;
    linesAnalyzed: number;
  };
  recommendations?: string[];
  categories?: Record<string, number>;
  scanDuration?: number;
}

/** Individual test result with full details */
export interface IndividualTestResult {
  id: string;
  name: string;
  fullName: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  duration: number;
  file: string;
  error?: string;
  stackTrace?: string;
  ancestorTitles?: string[];
}

/** Coverage breakdown by type */
export interface CoverageBreakdown {
  lines: number;
  statements: number;
  functions: number;
  branches: number;
}

/** Per-file test results */
export interface FileTestResult {
  path: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  status: 'passed' | 'failed' | 'mixed';
  tests: IndividualTestResult[];
}

/** Performance metrics for tests */
export interface TestPerformanceMetrics {
  averageDuration: number;
  slowestTests: Array<{ name: string; duration: number; file: string }>;
  fastestTests: Array<{ name: string; duration: number; file: string }>;
  totalDuration: number;
  testsPerSecond: number;
}

export interface TestingMetrics {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: number;
  coverage?: number;
  duration: number;
  storiesTested: number;
  storiesPassed: number;
  testFiles: string[];
  seenTaskIds?: string[];

  // Rich metrics
  coverageBreakdown?: CoverageBreakdown;
  individualTests?: IndividualTestResult[];
  fileResults?: FileTestResult[];
  performance?: TestPerformanceMetrics;
  failedTestDetails?: Array<{
    name: string;
    file: string;
    error: string;
    stackTrace?: string;
  }>;
  lastRunTimestamp?: string;
}

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
}

export interface KanbanColumn {
  id: TaskStatus;
  title: string;
  color: string;
}

export interface BuildState {
  phase: BuildPhase;
  projectId: string;
  requirements: string;
  epics: Epic[];
  tasks: Task[];
  messages: AgentMessage[];
  logs: BuildLog[];
  metrics: BuildMetrics;
  testingMetrics: TestingMetrics;
  securityMetrics: SecurityMetrics | null;
  doraMetrics: DoraMetrics | null;
  fileTree: TreeNode[];
  selectedFile: string | null;
  fileContent: string;
}

export interface ComplexBuildContext {
  projectId: string;
  quickBuildProjectId: string;
  originalRequirements: string;
  generatedPrompt: string;
  filesCreated: string[];
  databaseConfig?: {
    provider: string;
    schemaTemplate: string;
  };
}

export interface QuickSettings {
  minStories: number;
  maxStories: number;
  minEpics: number;
  maxEpics: number;
  maxRetries: number;
  requireTests: boolean;
  minCoverage: number;
  parallelCoders?: number;
  parallelTesters?: number;
  securityScanEnabled: boolean;
  blockOnCritical: boolean;
  defaultModel: 'opus' | 'sonnet' | 'haiku';
  maxTurnsPerAgent: number;
  verboseLogging: boolean;
}

export type PreviewStatus = 'idle' | 'starting' | 'ready' | 'error' | 'stopped';

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

export interface CheckpointInfo {
  phase: string;
  taskCount: number;
  timestamp: string;
}

export type MainTab = 'build' | 'plan' | 'development' | 'uat' | 'testing' | 'security' | 'compliance' | 'history' | 'architecture' | 'infrastructure' | 'deploy' | 'audit' | 'settings';

/** Mode for the Overview tab when build is completed */
export type OverviewMode = 'summary' | 'iterate';

/**
 * Snapshot of metrics at a specific point in time
 * Used to track original build metrics and iteration deltas
 */
export interface MetricsSnapshot {
  filesCreated: number;
  filesModified: number;
  linesOfCode: number;
  testsTotal: number;
  testsPassed: number;
  testsFailed: number;
  coverage: number;
  duration: number;
  tokensUsed: number;
  commandsRun: number;
  securityGrade?: SecurityGrade;
  securityScore?: number;
}

/**
 * Record of a single iteration request and its results
 * @deprecated Use BuildHistoryEntry from lib/build-history.ts instead
 */
export interface IterationRecord {
  id: string;
  iterationNumber: number;
  /** The user's iteration request prompt */
  prompt: string;
  /** Task IDs created in this iteration */
  storiesCreated: string[];
  /** Epic IDs created or modified in this iteration */
  epicsModified: string[];
  /** Delta metrics for this iteration (what was added) */
  metricsAdded: MetricsSnapshot;
  startTime: string;
  endTime?: string;
  status: 'in_progress' | 'completed' | 'failed';
  /** Git commit hash for this iteration (captured on completion) */
  commitHash?: string;
}

/**
 * Complete iteration state for a project
 * Persisted to .iteration-state.json in project directory
 * @deprecated Use loadBuildHistory() from lib/build-history.ts instead
 */
export interface IterationState {
  /** Metrics frozen at original build completion */
  originalBuildMetrics: MetricsSnapshot;
  /** When the original build was completed */
  originalBuildCompletedAt: string;
  /** Number of stories in the original build */
  originalStoryCount: number;
  /** Number of epics in the original build */
  originalEpicCount: number;
  /** Git commit hash for the original build */
  originalCommitHash?: string;
  /** All completed iterations */
  iterations: IterationRecord[];
  /** Currently running iteration (if any) */
  currentIteration: IterationRecord | null;
}
