/**
 * Core type definitions for the AI Development Platform
 */

export type AgentType =
  | 'supervisor'
  | 'research'
  | 'product_owner'
  | 'coder'
  | 'tester'
  | 'security'
  | 'infrastructure'
  | 'architecture';

export type AgentStatus = 'idle' | 'thinking' | 'working' | 'waiting' | 'error' | 'completed';

export type StoryStatus = 'backlog' | 'in_progress' | 'testing' | 'done';

export type Priority = 'low' | 'medium' | 'high' | 'critical';

export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type DeploymentEnvironment = 'dev' | 'staging' | 'prod' | 'production';

export type TestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export interface Agent {
  id: string;
  type: AgentType;
  name: string;
  status: AgentStatus;
  currentTask?: string;
  progress?: number;
  lastMessage?: string;
  sessionId?: string;
}

export interface Epic {
  id: string;
  projectId: string;  // Project this epic belongs to - required for cross-project isolation
  title: string;
  description: string;
  stories: string[]; // Story IDs
  status?: StoryStatus;
  priority: Priority;
  progress?: number; // Calculated from completed stories, not set upfront
  createdAt: Date;
  updatedAt?: Date;
}

export interface StoryTestMetrics {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  coverage?: number;
  lastRunAt?: Date;
  isRunning?: boolean;
}

export interface Story {
  id: string;
  projectId: string;  // Project this story belongs to - required for cross-project isolation
  epicId: string;
  title: string;
  description: string;
  acceptanceCriteria?: string[];  // Optional - legacy data may not have it
  status: StoryStatus;
  assignedAgent?: AgentType;
  workingAgent?: string | null;  // Which agent instance is currently working (e.g., "coder-1", "tester")
  storyPoints: number;
  priority: Priority;
  progress: number;
  files?: string[];
  dependencies?: string[];
  testMetrics?: StoryTestMetrics;  // Real-time test results for this story
  createdAt: Date;
  updatedAt: Date;
}

export interface CodeFile {
  path: string;
  content: string;
  language: string;
  modified: boolean;
  size: number;
  lastModified: Date;
}

export interface TestResult {
  id: string;
  name: string;
  status: TestStatus;
  duration: number;
  error?: string;
  stackTrace?: string;
  file: string;
  line?: number;
}

export interface TestSuite {
  name: string;
  tests: TestResult[];
  coverage: {
    lines: number;
    statements: number;
    functions: number;
    branches: number;
  };
  totalDuration: number;
  passed: number;
  failed: number;
  skipped: number;
}

export interface SecurityVulnerability {
  id: string;
  severity: SecuritySeverity;
  title: string;
  description: string;
  file?: string;
  line?: number;
  cve?: string;
  cwe?: string;
  owasp?: string;
  category?: string;
  recommendation: string;
  autoFixAvailable: boolean;
}

export interface OWASPComplianceItem {
  name: string;
  status: 'pass' | 'fail' | 'warning' | 'unknown';
  findings: number;
}

export interface SecurityRecommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  effort: 'low' | 'medium' | 'high';
}

export interface SecurityReport {
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'minimal';
  vulnerabilities: SecurityVulnerability[];
  owaspCompliance: {
    [key: string]: OWASPComplianceItem;
  };
  breakdown: {
    sast: number;
    secrets: number;
    dependencies: number;
    codeQuality: number;
  };
  summary: {
    totalFindings: number;
    criticalFindings: number;
    highFindings: number;
    mediumFindings: number;
    lowFindings: number;
    fixableFindings: number;
  };
  categories: {
    name: string;
    count: number;
    severity: 'critical' | 'high' | 'medium' | 'low';
  }[];
  recommendations: SecurityRecommendation[];
  scanDate: Date;
  scanDuration?: number;
}

export interface DeploymentStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  logs: string[];
  error?: string;
}

export interface DeploymentStatus {
  id: string;
  environment: DeploymentEnvironment;
  status: 'pending' | 'deploying' | 'deployed' | 'failed' | 'rolling_back';
  steps: DeploymentStep[];
  url?: string;
  cost: {
    estimated: number;
    actual?: number;
  };
  resources: {
    [key: string]: string;
  };
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: {
      [key: string]: boolean;
    };
  };
  createdAt: Date;
  updatedAt?: Date;
  completedAt?: Date;
}

export interface ClarificationRequest {
  id: string;
  agentId: string;
  question: string;
  context: string;
  options?: string[];
  priority: 'blocking' | 'high' | 'normal';
  createdAt: Date;
  response?: string;
  respondedAt?: Date;
}

export interface AgentMessage {
  id: string;
  agentId: string;
  agentType?: AgentType;
  type: 'info' | 'question' | 'error' | 'success';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  /** Instance number for parallel agents (e.g., 1 for "Coder 1", 2 for "Coder 2") */
  instanceNumber?: number;
}

export interface ResearchFindings {
  id: string;
  summary: string;
  domainAnalysis: {
    industry: string;
    commonPatterns: string[];
    bestPractices: string[];
    potentialChallenges: string[];
    criticalFeatures?: string[];
  };
  technicalRecommendations: {
    frameworks: string[];
    libraries: string[];
    architecturePatterns: string[];
    scalabilityConsiderations: string[];
  };
  userExperienceInsights: {
    targetAudience: string;
    keyUserFlows: string[];
    accessibilityRequirements: string[];
    performanceTargets: string[];
  };
  securityConsiderations: {
    dataProtection: string[];
    authentication: string[];
    compliance: string[];
  };
  commonPitfalls?: string[];
  estimatedComplexity: 'low' | 'medium' | 'high' | 'very-high';
  confidence: number; // 0-100
  researchSources: string[];
  createdAt: Date;
}

export interface GitConfig {
  repoUrl: string;
  branch?: string;
  remoteName?: string;
  lastPulledAt?: Date;
  lastCommitHash?: string;
}

export interface ProjectSession {
  sessionId: string;
  projectId: string;
  startedAt: Date;
  lastActiveAt: Date;
  status: 'active' | 'paused' | 'idle';
  currentAgentId?: string;
  currentTaskId?: string;
  messages: AgentMessage[];
  terminalOutput: string[];
}

export interface ProjectConfig {
  name: string;
  description: string;
  techStack: string[];
  requirements: string;
  targetPlatform: 'web' | 'mobile' | 'desktop' | 'api';
  deployment: {
    provider: 'aws' | 'databricks' | 'vercel' | 'netlify';
    region?: string;
    environment: DeploymentEnvironment;
  };
  // Git configuration for projects cloned from repositories
  git?: GitConfig;
}

export interface DevelopmentState {
  projectId: string;
  config: ProjectConfig;
  requirements: string;
  researchFindings?: ResearchFindings;
  epics: Epic[];
  stories: Story[];
  currentStory?: Story;
  agents: Agent[];
  codeFiles: Map<string, CodeFile>;
  testResults?: TestSuite;
  securityReport?: SecurityReport;
  deployment?: DeploymentStatus;
  clarifications: ClarificationRequest[];
  messages: AgentMessage[];
  errors: string[];
  status: 'idle' | 'planning' | 'developing' | 'testing' | 'deploying' | 'completed' | 'error' | 'paused';
  progress: number;
  createdAt: Date;
  updatedAt: Date;
  projectDirectory?: string; // Directory path where project files are created
  // Session tracking for independent project execution
  session?: ProjectSession;
  // Git state for repository-based projects
  gitStatus?: {
    isGitRepo: boolean;
    currentBranch?: string;
    hasUncommittedChanges?: boolean;
    ahead?: number;
    behind?: number;
  };
}

export interface WebSocketEvent {
  type: 'story:update' | 'code:change' | 'test:result' | 'security:alert' |
        'deployment:progress' | 'clarification:request' | 'agent:status' |
        'message' | 'error';
  payload: any;
  timestamp: Date;
}

export interface AgentInvocationOptions {
  prompt: string;
  sessionId?: string;
  allowedTools?: string[];
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
  maxTurns?: number;
  timeout?: number;
  workingDirectory?: string; // Working directory for file operations
}

export interface AgentResponse {
  sessionId: string;
  messages: any[];
  cost: number;
  duration: number;
  error?: string;
  finalResponse?: string;
}
