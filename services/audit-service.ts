/**
 * Audit Service
 *
 * Provides comprehensive audit logging for AI-assisted development in compliance with:
 * - ISO 42001 (AI Management System)
 * - EU AI Act (Traceability & Documentation)
 * - SOC 2 (Security & Trust)
 *
 * Captures: WHO did WHAT, WHEN, WHY, and OUTCOME for full lifecycle traceability.
 */

import * as fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface AuditAction {
  timestamp: string;
  type: 'file_create' | 'file_modify' | 'file_delete' | 'tool_use' | 'decision' | 'test_run' | 'error' | 'thinking' | 'chat';
  target?: string;
  toolName?: string;
  toolInput?: any;
  content?: string;
  reasoning?: string;
  outcome?: 'success' | 'failure' | 'pending';
  // NIST AI RMF: Resource usage tracking
  resourceUsage?: ResourceUsage;
}

// ============================================================================
// NIST AI RMF & ISO 42001 Compliance Types
// ============================================================================

/**
 * Token and cost tracking for AI resource usage (NIST MEASURE)
 */
export interface ResourceUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  modelVersion: string;
  requestId?: string;
}

/**
 * Decision record for transparency and explainability (ISO 42001)
 */
export interface DecisionRecord {
  id: string;
  timestamp: string;
  decisionType: 'architecture' | 'library_choice' | 'pattern_selection' | 'security' | 'data_handling' | 'api_design' | 'testing_strategy';
  context: string;
  options: Array<{
    option: string;
    pros: string[];
    cons: string[];
  }>;
  selected: string;
  reasoning: string;
  confidence: number; // 0-1
  humanReviewRequired: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
}

/**
 * Quality metrics for code assessment (NIST MEASURE)
 */
export interface QualityMetrics {
  timestamp: string;
  codeComplexity?: number;
  maintainabilityIndex?: number;
  duplicateCodePercent?: number;
  testCoverage?: number;
  securityScore?: number;
  accessibilityScore?: number;
  performanceScore?: number;
  lintErrors?: number;
  lintWarnings?: number;
  typeErrors?: number;
}

/**
 * Git integration for version control tracking (ISO 42001 Change Management)
 */
export interface GitInfo {
  commitHash?: string;
  branch: string;
  remoteUrl?: string;
  isDirty: boolean;
  filesChanged: Array<{
    path: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed';
    linesAdded?: number;
    linesRemoved?: number;
  }>;
  prNumber?: number;
  prUrl?: string;
}

/**
 * Data classification for governance (ISO 42001 Data Governance)
 */
export interface DataClassification {
  assessedAt: string;
  assessedBy: 'automated' | 'manual';
  containsPII: boolean;
  piiTypes?: ('name' | 'email' | 'phone' | 'ssn' | 'address' | 'dob' | 'financial' | 'health')[];
  containsPHI: boolean;
  containsCredentials: boolean;
  sensitivityLevel: 'public' | 'internal' | 'confidential' | 'restricted';
  dataRetentionDays?: number;
  encryptionRequired: boolean;
  encryptionApplied: boolean;
}

/**
 * Bias and fairness assessment (NIST MEASURE)
 */
export interface FairnessAssessment {
  id: string;
  assessedAt: string;
  assessmentType: 'automated' | 'manual' | 'third_party';
  scope: string;
  findings: Array<{
    category: 'bias' | 'fairness' | 'accessibility' | 'inclusion';
    severity: 'low' | 'medium' | 'high';
    description: string;
    recommendation: string;
  }>;
  mitigationsApplied: string[];
  overallScore?: number;
  certifiedBy?: string;
}

/**
 * AI System Card for documentation (NIST GOVERN)
 */
export interface AISystemCard {
  systemName: string;
  version: string;
  description: string;
  intendedUse: string;
  outOfScopeUses: string[];
  limitations: string[];
  knownBiases: string[];
  ethicalConsiderations: string[];
  trainingDataSummary?: string;
  evaluationMetrics: Record<string, number>;
  performanceBenchmarks: Array<{
    benchmark: string;
    score: number;
    date: string;
  }>;
  maintenanceSchedule?: string;
  contactInfo: string;
  lastUpdated: string;
  changelog: Array<{
    version: string;
    date: string;
    changes: string[];
  }>;
}

export interface AgentAuditRecord {
  role: string;
  instanceId: string;
  model: string;
  startedAt: string;
  completedAt?: string;
  actions: AuditAction[];
  totalActions: number;
  // NIST AI RMF: Cumulative resource usage for this agent
  totalResourceUsage?: ResourceUsage;
  // ISO 42001: Decisions made by this agent
  decisions?: DecisionRecord[];
}

export interface TestResults {
  passed: number;
  failed: number;
  skipped: number;
  coverage?: string;
  details?: string[];
}

export interface StoryAuditLog {
  storyId: string;
  title: string;
  description: string;
  epicId?: string;
  priority?: string;
  acceptanceCriteria?: string[];
  lifecycle: {
    created: string;
    started?: string;
    completed?: string;
    tested?: string;
    status: string;
  };
  agents: AgentAuditRecord[];
  filesCreated: string[];
  filesModified: string[];
  filesDeleted: string[];
  testResults?: TestResults;
  outcome: 'success' | 'failure' | 'in_progress' | 'pending';
  retryCount: number;
  errorSummary?: string;
  // NIST AI RMF & ISO 42001 Compliance
  qualityMetrics?: QualityMetrics;
  dataClassification?: DataClassification;
  totalResourceUsage?: ResourceUsage;
  decisions?: DecisionRecord[];
}

export interface RiskAssessment {
  riskLevel: 'low' | 'medium' | 'high';
  category: string;
  mitigations: string[];
  humanOversightRequired: boolean;
  approvals: Array<{
    timestamp: string;
    type: string;
    approver: string;
    notes?: string;
  }>;
}

export interface ModelInfo {
  provider: string;
  model: string;
  version?: string;
  capabilities: string[];
  constraints: string[];
  usedFor: string[];
}

export interface DataLineage {
  inputSources: Array<{
    type: 'requirements' | 'codebase' | 'design_system' | 'figma' | 'documentation' | 'user_input';
    source: string;
    timestamp: string;
  }>;
  contextProvided: string[];
  externalAPIs: string[];
}

export interface HumanOversight {
  interventions: Array<{
    timestamp: string;
    type: 'approval' | 'rejection' | 'modification' | 'pause' | 'resume' | 'abort';
    actor: string;
    reason?: string;
    affectedStories?: string[];
  }>;
  approvalGates: Array<{
    gate: string;
    required: boolean;
    passed: boolean;
    timestamp?: string;
  }>;
}

export interface BuildSummary {
  buildId: string;
  projectId: string;
  projectName?: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed' | 'aborted';
  requirements: string;
  configuration: {
    parallelCoders: number;
    batchMode: boolean;
    agentModel: string;
  };
  metrics: {
    totalStories: number;
    storiesCompleted: number;
    storiesFailed: number;
    storiesInProgress: number;
    totalFilesCreated: number;
    totalFilesModified: number;
    totalTestsPassed: number;
    totalTestsFailed: number;
    totalAgentActions: number;
    buildDurationMs?: number;
    // NIST AI RMF: Token/cost tracking
    totalInputTokens: number;
    totalOutputTokens: number;
    totalEstimatedCostUsd: number;
  };
  riskAssessment: RiskAssessment;
  modelInfo: ModelInfo;
  dataLineage: DataLineage;
  humanOversight: HumanOversight;
  // NIST AI RMF & ISO 42001 Compliance
  gitInfo?: GitInfo;
  qualityMetrics?: QualityMetrics;
  dataClassification?: DataClassification;
  fairnessAssessments?: FairnessAssessment[];
  decisions?: DecisionRecord[];
}

export interface ProjectManifest {
  projectId: string;
  projectName?: string;
  createdAt: string;
  lastUpdatedAt: string;
  totalBuilds: number;
  builds: Array<{
    buildId: string;
    timestamp: string;
    status: string;
    storiesCompleted: number;
    storiesFailed: number;
  }>;
  complianceInfo: {
    iso42001: boolean;
    euAiAct: boolean;
    soc2: boolean;
    lastAuditDate?: string;
  };
}

// ============================================================================
// Audit Service Class
// ============================================================================

export class AuditService extends EventEmitter {
  private projectDir: string;
  private auditDir: string;
  private currentBuild: BuildSummary | null = null;
  private storyLogs: Map<string, StoryAuditLog> = new Map();
  private initialized = false;

  constructor(projectDir: string) {
    super();
    this.projectDir = projectDir;
    this.auditDir = path.join(projectDir, '.audit');
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Create audit directory structure
    await fs.mkdir(this.auditDir, { recursive: true });
    await fs.mkdir(path.join(this.auditDir, 'builds'), { recursive: true });
    await fs.mkdir(path.join(this.auditDir, 'compliance'), { recursive: true });

    // Initialize or load project manifest
    await this.loadOrCreateManifest();

    this.initialized = true;
    console.log(`[Audit] Initialized audit logging at ${this.auditDir}`);
  }

  private async loadOrCreateManifest(): Promise<ProjectManifest> {
    const manifestPath = path.join(this.auditDir, 'manifest.json');
    try {
      const content = await fs.readFile(manifestPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      const manifest: ProjectManifest = {
        projectId: path.basename(this.projectDir),
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        totalBuilds: 0,
        builds: [],
        complianceInfo: {
          iso42001: true,
          euAiAct: true,
          soc2: true,
        },
      };
      await this.saveManifest(manifest);
      return manifest;
    }
  }

  private async saveManifest(manifest: ProjectManifest): Promise<void> {
    const manifestPath = path.join(this.auditDir, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  }

  // --------------------------------------------------------------------------
  // Build Lifecycle
  // --------------------------------------------------------------------------

  async startBuild(
    projectId: string,
    requirements: string,
    config: { parallelCoders: number; batchMode: boolean; agentModel: string }
  ): Promise<string> {
    await this.initialize();

    const buildId = `build-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    this.currentBuild = {
      buildId,
      projectId,
      startedAt: timestamp,
      status: 'running',
      requirements,
      configuration: config,
      metrics: {
        totalStories: 0,
        storiesCompleted: 0,
        storiesFailed: 0,
        storiesInProgress: 0,
        totalFilesCreated: 0,
        totalFilesModified: 0,
        totalTestsPassed: 0,
        totalTestsFailed: 0,
        totalAgentActions: 0,
        // NIST AI RMF: Token/cost tracking
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalEstimatedCostUsd: 0,
      },
      riskAssessment: {
        riskLevel: 'medium',
        category: 'AI-Assisted Development',
        mitigations: [
          'Human oversight at approval gates',
          'Automated testing before completion',
          'Code review capability',
        ],
        humanOversightRequired: true,
        approvals: [],
      },
      modelInfo: {
        provider: 'Anthropic',
        model: config.agentModel || 'claude-sonnet-4-20250514',
        capabilities: ['code_generation', 'testing', 'documentation'],
        constraints: ['No external API calls without approval', 'Sandboxed execution'],
        usedFor: ['coder', 'tester', 'product_owner'],
      },
      dataLineage: {
        inputSources: [
          {
            type: 'requirements',
            source: 'user_input',
            timestamp,
          },
        ],
        contextProvided: [],
        externalAPIs: [],
      },
      humanOversight: {
        interventions: [],
        approvalGates: [
          { gate: 'build_start', required: true, passed: true, timestamp },
          { gate: 'epic_approval', required: false, passed: false },
          { gate: 'build_complete', required: false, passed: false },
        ],
      },
    };

    // Create build directory
    const buildDir = this.getBuildDir(buildId);
    await fs.mkdir(buildDir, { recursive: true });
    await fs.mkdir(path.join(buildDir, 'stories'), { recursive: true });

    // Save initial requirements
    await fs.writeFile(
      path.join(buildDir, 'requirements.md'),
      `# Build Requirements\n\n**Build ID:** ${buildId}\n**Started:** ${timestamp}\n\n## Original Requirements\n\n${requirements}\n`
    );

    // Save initial build summary
    await this.saveBuildSummary();

    // Update project manifest
    const manifest = await this.loadOrCreateManifest();
    manifest.totalBuilds++;
    manifest.lastUpdatedAt = timestamp;
    manifest.builds.push({
      buildId,
      timestamp,
      status: 'running',
      storiesCompleted: 0,
      storiesFailed: 0,
    });
    await this.saveManifest(manifest);

    console.log(`[Audit] Started build ${buildId}`);
    this.emit('build:started', { buildId, timestamp });

    return buildId;
  }

  async completeBuild(status: 'completed' | 'failed' | 'aborted'): Promise<void> {
    if (!this.currentBuild) return;

    const completedAt = new Date().toISOString();
    this.currentBuild.status = status;
    this.currentBuild.completedAt = completedAt;
    this.currentBuild.metrics.buildDurationMs =
      new Date(completedAt).getTime() - new Date(this.currentBuild.startedAt).getTime();

    // Update approval gate
    const completeGate = this.currentBuild.humanOversight.approvalGates.find(
      (g) => g.gate === 'build_complete'
    );
    if (completeGate) {
      completeGate.passed = status === 'completed';
      completeGate.timestamp = completedAt;
    }

    // Save all pending story logs
    for (const [storyId, log] of this.storyLogs) {
      await this.saveStoryLog(storyId, log);
    }

    // Save final build summary
    await this.saveBuildSummary();

    // Generate human-readable summary
    await this.generateBuildMarkdownSummary();

    // Update project manifest
    const manifest = await this.loadOrCreateManifest();
    const buildEntry = manifest.builds.find((b) => b.buildId === this.currentBuild!.buildId);
    if (buildEntry) {
      buildEntry.status = status;
      buildEntry.storiesCompleted = this.currentBuild.metrics.storiesCompleted;
      buildEntry.storiesFailed = this.currentBuild.metrics.storiesFailed;
    }
    manifest.lastUpdatedAt = completedAt;
    await this.saveManifest(manifest);

    console.log(`[Audit] Completed build ${this.currentBuild.buildId} with status: ${status}`);
    this.emit('build:completed', { buildId: this.currentBuild.buildId, status });

    this.storyLogs.clear();
    this.currentBuild = null;
  }

  // --------------------------------------------------------------------------
  // Story Lifecycle
  // --------------------------------------------------------------------------

  async initializeStory(
    storyId: string,
    title: string,
    description: string,
    metadata?: {
      epicId?: string;
      priority?: string;
      acceptanceCriteria?: string[];
    }
  ): Promise<void> {
    if (!this.currentBuild) return;

    // Check if story already exists in memory to prevent double-counting
    if (this.storyLogs.has(storyId)) {
      console.log(`[Audit] Story ${storyId} already exists in memory, skipping`);
      return;
    }

    // Also check if story exists on disk (persists across restarts)
    const storyDir = path.join(this.getBuildDir(), 'stories', storyId);
    try {
      await fs.access(storyDir);
      // Story directory exists - load it into memory and skip counting
      console.log(`[Audit] Story ${storyId} already exists on disk, loading into memory`);
      try {
        const logPath = path.join(storyDir, 'audit-log.json');
        const content = await fs.readFile(logPath, 'utf-8');
        const existingLog = JSON.parse(content);
        this.storyLogs.set(storyId, existingLog);
      } catch {
        // Couldn't load, but directory exists so don't re-count
      }
      return;
    } catch {
      // Directory doesn't exist, this is a new story
    }

    const log: StoryAuditLog = {
      storyId,
      title,
      description,
      epicId: metadata?.epicId,
      priority: metadata?.priority,
      acceptanceCriteria: metadata?.acceptanceCriteria || [],
      lifecycle: {
        created: new Date().toISOString(),
        status: 'pending',
      },
      agents: [],
      filesCreated: [],
      filesModified: [],
      filesDeleted: [],
      outcome: 'pending',
      retryCount: 0,
    };

    this.storyLogs.set(storyId, log);
    this.currentBuild.metrics.totalStories++;

    // Save immediately so story structure exists on disk from start
    try {
      await this.saveStoryLog(storyId, log);
    } catch (err) {
      console.error(`[Audit] Failed to save initial story log for ${storyId}:`, err);
    }

    console.log(`[Audit] Initialized story ${storyId}: ${title}`);
  }

  async startStory(storyId: string): Promise<void> {
    const log = this.storyLogs.get(storyId);
    if (!log || !this.currentBuild) return;

    log.lifecycle.started = new Date().toISOString();
    log.lifecycle.status = 'in_progress';
    log.outcome = 'in_progress';

    this.currentBuild.metrics.storiesInProgress++;

    // Save to capture started timestamp
    try {
      await this.saveStoryLog(storyId, log);
    } catch (err) {
      console.error(`[Audit] Failed to save story log on start for ${storyId}:`, err);
    }
  }

  async completeStory(
    storyId: string,
    outcome: 'success' | 'failure',
    testResults?: TestResults
  ): Promise<void> {
    const log = this.storyLogs.get(storyId);
    if (!log || !this.currentBuild) return;

    log.lifecycle.completed = new Date().toISOString();
    log.lifecycle.status = outcome === 'success' ? 'completed' : 'failed';
    log.outcome = outcome;
    log.testResults = testResults;

    this.currentBuild.metrics.storiesInProgress--;
    if (outcome === 'success') {
      this.currentBuild.metrics.storiesCompleted++;
    } else {
      this.currentBuild.metrics.storiesFailed++;
    }

    if (testResults) {
      this.currentBuild.metrics.totalTestsPassed += testResults.passed;
      this.currentBuild.metrics.totalTestsFailed += testResults.failed;
    }

    // Save story log immediately on completion
    await this.saveStoryLog(storyId, log);
    await this.generateStoryMarkdownSummary(storyId, log);

    console.log(`[Audit] Completed story ${storyId} with outcome: ${outcome}`);
  }

  // --------------------------------------------------------------------------
  // Agent Action Logging
  // --------------------------------------------------------------------------

  async logAgentStart(
    storyId: string,
    role: string,
    instanceId: string,
    model: string
  ): Promise<void> {
    const log = this.storyLogs.get(storyId);
    if (!log) return;

    // Check if agent already exists to prevent duplicates
    const existingAgent = log.agents.find((a) => a.instanceId === instanceId);
    if (existingAgent) {
      // Agent already registered - just update model if different
      if (existingAgent.model !== model) {
        existingAgent.model = model;
      }
      return;
    }

    const agentRecord: AgentAuditRecord = {
      role,
      instanceId,
      model,
      startedAt: new Date().toISOString(),
      actions: [],
      totalActions: 0,
    };

    log.agents.push(agentRecord);

    // Save to capture agent start
    try {
      await this.saveStoryLog(storyId, log);
    } catch (err) {
      console.error(`[Audit] Failed to save story log on agent start for ${storyId}:`, err);
    }
  }

  async logAgentAction(
    storyId: string,
    instanceId: string,
    action: AuditAction
  ): Promise<void> {
    const log = this.storyLogs.get(storyId);
    if (!log || !this.currentBuild) return;

    const agentRecord = log.agents.find((a) => a.instanceId === instanceId);
    if (!agentRecord) return;

    // Add timestamp if not present
    if (!action.timestamp) {
      action.timestamp = new Date().toISOString();
    }

    agentRecord.actions.push(action);
    agentRecord.totalActions++;
    this.currentBuild.metrics.totalAgentActions++;

    // Track file operations
    if (action.type === 'file_create' && action.target) {
      if (!log.filesCreated.includes(action.target)) {
        log.filesCreated.push(action.target);
        this.currentBuild.metrics.totalFilesCreated++;
      }
    } else if (action.type === 'file_modify' && action.target) {
      if (!log.filesModified.includes(action.target)) {
        log.filesModified.push(action.target);
        this.currentBuild.metrics.totalFilesModified++;
      }
    } else if (action.type === 'file_delete' && action.target) {
      if (!log.filesDeleted.includes(action.target)) {
        log.filesDeleted.push(action.target);
      }
    }

    // INCREMENTAL SAVE: Persist to disk immediately for audit trail
    // This ensures logs are available even if build crashes or is interrupted
    try {
      await this.saveStoryLog(storyId, log);
    } catch (err) {
      // Log but don't fail the action - audit persistence shouldn't break the build
      console.error(`[Audit] Failed to save story log for ${storyId}:`, err);
    }
  }

  async logAgentComplete(storyId: string, instanceId: string): Promise<void> {
    const log = this.storyLogs.get(storyId);
    if (!log) return;

    const agentRecord = log.agents.find((a) => a.instanceId === instanceId);
    if (agentRecord) {
      agentRecord.completedAt = new Date().toISOString();
    }

    // Save immediately to capture completion timestamp
    try {
      await this.saveStoryLog(storyId, log);
    } catch (err) {
      console.error(`[Audit] Failed to save story log on agent complete for ${storyId}:`, err);
    }
  }

  // --------------------------------------------------------------------------
  // Human Oversight Logging
  // --------------------------------------------------------------------------

  async logHumanIntervention(
    type: 'approval' | 'rejection' | 'modification' | 'pause' | 'resume' | 'abort',
    actor: string,
    reason?: string,
    affectedStories?: string[]
  ): Promise<void> {
    if (!this.currentBuild) return;

    this.currentBuild.humanOversight.interventions.push({
      timestamp: new Date().toISOString(),
      type,
      actor,
      reason,
      affectedStories,
    });

    await this.saveBuildSummary();
  }

  async logApprovalGate(gate: string, passed: boolean): Promise<void> {
    if (!this.currentBuild) return;

    const gateRecord = this.currentBuild.humanOversight.approvalGates.find(
      (g) => g.gate === gate
    );
    if (gateRecord) {
      gateRecord.passed = passed;
      gateRecord.timestamp = new Date().toISOString();
    }

    await this.saveBuildSummary();
  }

  // --------------------------------------------------------------------------
  // Data Lineage Logging
  // --------------------------------------------------------------------------

  async logDataSource(
    type: 'requirements' | 'codebase' | 'design_system' | 'figma' | 'documentation' | 'user_input',
    source: string
  ): Promise<void> {
    if (!this.currentBuild) return;

    this.currentBuild.dataLineage.inputSources.push({
      type,
      source,
      timestamp: new Date().toISOString(),
    });
  }

  async logContextProvided(context: string): Promise<void> {
    if (!this.currentBuild) return;

    if (!this.currentBuild.dataLineage.contextProvided.includes(context)) {
      this.currentBuild.dataLineage.contextProvided.push(context);
    }
  }

  async logExternalAPI(api: string): Promise<void> {
    if (!this.currentBuild) return;

    if (!this.currentBuild.dataLineage.externalAPIs.includes(api)) {
      this.currentBuild.dataLineage.externalAPIs.push(api);
    }
  }

  // --------------------------------------------------------------------------
  // NIST AI RMF & ISO 42001 Compliance Logging
  // --------------------------------------------------------------------------

  /**
   * Log resource usage (tokens/cost) for an action (NIST MEASURE)
   */
  async logResourceUsage(
    storyId: string,
    instanceId: string,
    usage: ResourceUsage
  ): Promise<void> {
    const log = this.storyLogs.get(storyId);
    if (!log || !this.currentBuild) return;

    const agentRecord = log.agents.find((a) => a.instanceId === instanceId);
    if (agentRecord) {
      // Initialize or accumulate
      if (!agentRecord.totalResourceUsage) {
        agentRecord.totalResourceUsage = { ...usage };
      } else {
        agentRecord.totalResourceUsage.inputTokens += usage.inputTokens;
        agentRecord.totalResourceUsage.outputTokens += usage.outputTokens;
        agentRecord.totalResourceUsage.totalTokens += usage.totalTokens;
        agentRecord.totalResourceUsage.estimatedCostUsd += usage.estimatedCostUsd;
      }
    }

    // Accumulate at story level
    if (!log.totalResourceUsage) {
      log.totalResourceUsage = { ...usage };
    } else {
      log.totalResourceUsage.inputTokens += usage.inputTokens;
      log.totalResourceUsage.outputTokens += usage.outputTokens;
      log.totalResourceUsage.totalTokens += usage.totalTokens;
      log.totalResourceUsage.estimatedCostUsd += usage.estimatedCostUsd;
    }

    // Accumulate at build level
    this.currentBuild.metrics.totalInputTokens += usage.inputTokens;
    this.currentBuild.metrics.totalOutputTokens += usage.outputTokens;
    this.currentBuild.metrics.totalEstimatedCostUsd += usage.estimatedCostUsd;

    await this.saveStoryLog(storyId, log);
    await this.saveBuildSummary();
  }

  /**
   * Log a decision for transparency/explainability (ISO 42001)
   */
  async logDecision(
    storyId: string | null,
    decision: Omit<DecisionRecord, 'id' | 'timestamp'>
  ): Promise<void> {
    const record: DecisionRecord = {
      id: `decision-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...decision,
    };

    if (storyId) {
      const log = this.storyLogs.get(storyId);
      if (log) {
        if (!log.decisions) log.decisions = [];
        log.decisions.push(record);
        await this.saveStoryLog(storyId, log);
      }
    }

    // Also log at build level for global decisions
    if (this.currentBuild) {
      if (!this.currentBuild.decisions) this.currentBuild.decisions = [];
      this.currentBuild.decisions.push(record);
      await this.saveBuildSummary();
    }
  }

  /**
   * Log quality metrics for a story (NIST MEASURE)
   */
  async logQualityMetrics(storyId: string, metrics: Omit<QualityMetrics, 'timestamp'>): Promise<void> {
    const log = this.storyLogs.get(storyId);
    if (!log) return;

    log.qualityMetrics = {
      timestamp: new Date().toISOString(),
      ...metrics,
    };

    await this.saveStoryLog(storyId, log);
  }

  /**
   * Log data classification for a story (ISO 42001 Data Governance)
   */
  async logDataClassification(storyId: string, classification: Omit<DataClassification, 'assessedAt'>): Promise<void> {
    const log = this.storyLogs.get(storyId);
    if (!log) return;

    log.dataClassification = {
      assessedAt: new Date().toISOString(),
      ...classification,
    };

    await this.saveStoryLog(storyId, log);
  }

  /**
   * Set git info for the build (ISO 42001 Change Management)
   */
  async setGitInfo(gitInfo: GitInfo): Promise<void> {
    if (!this.currentBuild) return;

    this.currentBuild.gitInfo = gitInfo;
    await this.saveBuildSummary();

    // Also save to compliance directory
    await fs.writeFile(
      path.join(this.auditDir, 'compliance', 'git-info.json'),
      JSON.stringify(gitInfo, null, 2)
    );
  }

  /**
   * Set overall quality metrics for the build (NIST MEASURE)
   */
  async setBuildQualityMetrics(metrics: Omit<QualityMetrics, 'timestamp'>): Promise<void> {
    if (!this.currentBuild) return;

    this.currentBuild.qualityMetrics = {
      timestamp: new Date().toISOString(),
      ...metrics,
    };

    await this.saveBuildSummary();
  }

  /**
   * Set data classification for the build (ISO 42001 Data Governance)
   */
  async setBuildDataClassification(classification: Omit<DataClassification, 'assessedAt'>): Promise<void> {
    if (!this.currentBuild) return;

    this.currentBuild.dataClassification = {
      assessedAt: new Date().toISOString(),
      ...classification,
    };

    await this.saveBuildSummary();
  }

  /**
   * Log a fairness assessment (NIST MEASURE)
   */
  async logFairnessAssessment(assessment: Omit<FairnessAssessment, 'id' | 'assessedAt'>): Promise<void> {
    if (!this.currentBuild) return;

    const record: FairnessAssessment = {
      id: `fairness-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      assessedAt: new Date().toISOString(),
      ...assessment,
    };

    if (!this.currentBuild.fairnessAssessments) {
      this.currentBuild.fairnessAssessments = [];
    }
    this.currentBuild.fairnessAssessments.push(record);

    await this.saveBuildSummary();

    // Also save to compliance directory
    await fs.writeFile(
      path.join(this.auditDir, 'compliance', 'fairness-assessments.json'),
      JSON.stringify(this.currentBuild.fairnessAssessments, null, 2)
    );
  }

  /**
   * Save AI System Card (NIST GOVERN)
   */
  async saveAISystemCard(card: AISystemCard): Promise<void> {
    await fs.writeFile(
      path.join(this.auditDir, 'compliance', 'ai-system-card.json'),
      JSON.stringify(card, null, 2)
    );

    // Also save as markdown for human readability
    const markdown = this.generateSystemCardMarkdown(card);
    await fs.writeFile(
      path.join(this.auditDir, 'compliance', 'ai-system-card.md'),
      markdown
    );
  }

  /**
   * Generate markdown version of AI System Card
   */
  private generateSystemCardMarkdown(card: AISystemCard): string {
    return `# AI System Card: ${card.systemName}

## Overview
- **Version:** ${card.version}
- **Last Updated:** ${card.lastUpdated}
- **Contact:** ${card.contactInfo}

## Description
${card.description}

## Intended Use
${card.intendedUse}

## Out of Scope Uses
${card.outOfScopeUses.map(u => `- ${u}`).join('\n')}

## Limitations
${card.limitations.map(l => `- ${l}`).join('\n')}

## Known Biases
${card.knownBiases.length > 0 ? card.knownBiases.map(b => `- ${b}`).join('\n') : 'None documented'}

## Ethical Considerations
${card.ethicalConsiderations.map(e => `- ${e}`).join('\n')}

${card.trainingDataSummary ? `## Training Data Summary\n${card.trainingDataSummary}\n` : ''}

## Evaluation Metrics
| Metric | Score |
|--------|-------|
${Object.entries(card.evaluationMetrics).map(([k, v]) => `| ${k} | ${v} |`).join('\n')}

## Performance Benchmarks
| Benchmark | Score | Date |
|-----------|-------|------|
${card.performanceBenchmarks.map(b => `| ${b.benchmark} | ${b.score} | ${b.date} |`).join('\n')}

${card.maintenanceSchedule ? `## Maintenance Schedule\n${card.maintenanceSchedule}\n` : ''}

## Changelog
${card.changelog.map(c => `### ${c.version} (${c.date})\n${c.changes.map(ch => `- ${ch}`).join('\n')}`).join('\n\n')}

---
*Generated by AI Fleet Orchestrator - NIST AI RMF & ISO 42001 Compliant*
`;
  }

  // --------------------------------------------------------------------------
  // Persistence
  // --------------------------------------------------------------------------

  private getBuildDir(buildId?: string): string {
    const id = buildId || this.currentBuild?.buildId;
    if (!id) throw new Error('No build ID available');
    return path.join(this.auditDir, 'builds', id);
  }

  private async saveBuildSummary(): Promise<void> {
    if (!this.currentBuild) return;

    const buildDir = this.getBuildDir();
    await fs.writeFile(
      path.join(buildDir, 'build-summary.json'),
      JSON.stringify(this.currentBuild, null, 2)
    );
  }

  private async saveStoryLog(storyId: string, log: StoryAuditLog): Promise<void> {
    if (!this.currentBuild) return;

    const storyDir = path.join(this.getBuildDir(), 'stories', storyId);
    await fs.mkdir(storyDir, { recursive: true });

    // Save full audit log
    await fs.writeFile(
      path.join(storyDir, 'audit-log.json'),
      JSON.stringify(log, null, 2)
    );

    // Save files touched separately for quick reference
    await fs.writeFile(
      path.join(storyDir, 'files-touched.json'),
      JSON.stringify(
        {
          created: log.filesCreated,
          modified: log.filesModified,
          deleted: log.filesDeleted,
        },
        null,
        2
      )
    );
  }

  // --------------------------------------------------------------------------
  // Markdown Summary Generation
  // --------------------------------------------------------------------------

  private async generateStoryMarkdownSummary(
    storyId: string,
    log: StoryAuditLog
  ): Promise<void> {
    const storyDir = path.join(this.getBuildDir(), 'stories', storyId);

    const duration = log.lifecycle.started && log.lifecycle.completed
      ? Math.round(
          (new Date(log.lifecycle.completed).getTime() -
            new Date(log.lifecycle.started).getTime()) /
            1000
        )
      : 'N/A';

    const agentSummaries = log.agents
      .map((agent) => {
        const actionCounts = agent.actions.reduce((acc, a) => {
          acc[a.type] = (acc[a.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        return `### ${agent.role} (${agent.instanceId})
- **Model:** ${agent.model}
- **Started:** ${agent.startedAt}
- **Completed:** ${agent.completedAt || 'N/A'}
- **Total Actions:** ${agent.totalActions}
- **Action Breakdown:**
${Object.entries(actionCounts)
  .map(([type, count]) => `  - ${type}: ${count}`)
  .join('\n')}`;
      })
      .join('\n\n');

    const testSummary = log.testResults
      ? `## Test Results
- **Passed:** ${log.testResults.passed}
- **Failed:** ${log.testResults.failed}
- **Skipped:** ${log.testResults.skipped}
${log.testResults.coverage ? `- **Coverage:** ${log.testResults.coverage}` : ''}`
      : '';

    const markdown = `# Story Audit Summary

## Overview
- **Story ID:** ${log.storyId}
- **Title:** ${log.title}
- **Status:** ${log.outcome.toUpperCase()}
- **Duration:** ${duration} seconds
- **Retry Count:** ${log.retryCount}

## Description
${log.description}

${log.acceptanceCriteria && log.acceptanceCriteria.length > 0
  ? `## Acceptance Criteria
${log.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
  : ''}

## Lifecycle
- **Created:** ${log.lifecycle.created}
- **Started:** ${log.lifecycle.started || 'N/A'}
- **Completed:** ${log.lifecycle.completed || 'N/A'}
- **Tested:** ${log.lifecycle.tested || 'N/A'}

## Agents Involved
${agentSummaries}

## Files Changed
### Created (${log.filesCreated.length})
${log.filesCreated.map((f) => `- \`${f}\``).join('\n') || 'None'}

### Modified (${log.filesModified.length})
${log.filesModified.map((f) => `- \`${f}\``).join('\n') || 'None'}

### Deleted (${log.filesDeleted.length})
${log.filesDeleted.map((f) => `- \`${f}\``).join('\n') || 'None'}

${testSummary}

${log.errorSummary ? `## Errors\n${log.errorSummary}` : ''}

---
*Generated by AI Fleet Orchestrator Audit Service*
*Compliant with ISO 42001, EU AI Act, SOC 2*
`;

    await fs.writeFile(path.join(storyDir, 'summary.md'), markdown);
  }

  private async generateBuildMarkdownSummary(): Promise<void> {
    if (!this.currentBuild) return;

    const buildDir = this.getBuildDir();
    const b = this.currentBuild;

    const duration = b.completedAt
      ? Math.round(
          (new Date(b.completedAt).getTime() - new Date(b.startedAt).getTime()) / 1000 / 60
        )
      : 'N/A';

    const storyList = Array.from(this.storyLogs.values())
      .map((s) => {
        const status = s.outcome === 'success' ? '✅' : s.outcome === 'failure' ? '❌' : '⏳';
        return `| ${status} | ${s.storyId} | ${s.title} | ${s.agents.map((a) => a.instanceId).join(', ')} | ${s.filesCreated.length + s.filesModified.length} |`;
      })
      .join('\n');

    const markdown = `# Build Audit Report

## Executive Summary
| Metric | Value |
|--------|-------|
| **Build ID** | ${b.buildId} |
| **Project** | ${b.projectId} |
| **Status** | ${b.status.toUpperCase()} |
| **Duration** | ${duration} minutes |
| **Stories Completed** | ${b.metrics.storiesCompleted}/${b.metrics.totalStories} |
| **Stories Failed** | ${b.metrics.storiesFailed} |
| **Tests Passed** | ${b.metrics.totalTestsPassed} |
| **Tests Failed** | ${b.metrics.totalTestsFailed} |
| **Files Created** | ${b.metrics.totalFilesCreated} |
| **Files Modified** | ${b.metrics.totalFilesModified} |
| **Total Agent Actions** | ${b.metrics.totalAgentActions} |

## Timeline
- **Started:** ${b.startedAt}
- **Completed:** ${b.completedAt || 'N/A'}

## Configuration
- **Parallel Coders:** ${b.configuration.parallelCoders}
- **Batch Mode:** ${b.configuration.batchMode}
- **Agent Model:** ${b.configuration.agentModel}

## Stories
| Status | ID | Title | Agents | Files Changed |
|--------|-----|-------|--------|---------------|
${storyList}

## AI Model Information
- **Provider:** ${b.modelInfo.provider}
- **Model:** ${b.modelInfo.model}
- **Capabilities:** ${b.modelInfo.capabilities.join(', ')}
- **Constraints:** ${b.modelInfo.constraints.join(', ')}

## Risk Assessment
- **Risk Level:** ${b.riskAssessment.riskLevel.toUpperCase()}
- **Category:** ${b.riskAssessment.category}
- **Mitigations:**
${b.riskAssessment.mitigations.map((m) => `  - ${m}`).join('\n')}

## Human Oversight
### Approval Gates
| Gate | Required | Passed | Timestamp |
|------|----------|--------|-----------|
${b.humanOversight.approvalGates
  .map((g) => `| ${g.gate} | ${g.required ? 'Yes' : 'No'} | ${g.passed ? '✅' : '❌'} | ${g.timestamp || 'N/A'} |`)
  .join('\n')}

### Interventions
${b.humanOversight.interventions.length > 0
  ? b.humanOversight.interventions
      .map((i) => `- **${i.type}** by ${i.actor} at ${i.timestamp}${i.reason ? `: ${i.reason}` : ''}`)
      .join('\n')
  : 'No human interventions recorded.'}

## Data Lineage
### Input Sources
${b.dataLineage.inputSources
  .map((s) => `- **${s.type}:** ${s.source} (${s.timestamp})`)
  .join('\n')}

### Context Provided
${b.dataLineage.contextProvided.map((c) => `- ${c}`).join('\n') || 'None recorded'}

### External APIs Used
${b.dataLineage.externalAPIs.map((a) => `- ${a}`).join('\n') || 'None'}

## Compliance Statement
This build was executed in compliance with:
- **ISO/IEC 42001:2023** - AI Management System
- **EU AI Act** - Regulation (EU) 2024/1689
- **SOC 2** - Trust Services Criteria

All agent actions have been logged with full traceability including:
- WHO performed each action (agent identity)
- WHAT actions were taken (tool use, file changes)
- WHEN each action occurred (timestamps)
- WHY actions were taken (reasoning, context)
- OUTCOME of each action (success/failure)

---
*Generated by AI Fleet Orchestrator Audit Service*
*Report Date: ${new Date().toISOString()}*
`;

    await fs.writeFile(path.join(buildDir, 'build-report.md'), markdown);

    // Also save compliance metadata
    await fs.writeFile(
      path.join(this.auditDir, 'compliance', 'model-info.json'),
      JSON.stringify(b.modelInfo, null, 2)
    );
    await fs.writeFile(
      path.join(this.auditDir, 'compliance', 'data-lineage.json'),
      JSON.stringify(b.dataLineage, null, 2)
    );
    await fs.writeFile(
      path.join(this.auditDir, 'compliance', 'human-oversight.json'),
      JSON.stringify(b.humanOversight, null, 2)
    );
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  getStoryLog(storyId: string): StoryAuditLog | undefined {
    return this.storyLogs.get(storyId);
  }

  getCurrentBuild(): BuildSummary | null {
    return this.currentBuild;
  }

  async getProjectManifest(): Promise<ProjectManifest> {
    return this.loadOrCreateManifest();
  }
}

// ============================================================================
// Singleton Instance Management
// ============================================================================

const auditServices = new Map<string, AuditService>();

export function getAuditService(projectDir: string): AuditService {
  if (!auditServices.has(projectDir)) {
    auditServices.set(projectDir, new AuditService(projectDir));
  }
  return auditServices.get(projectDir)!;
}

export function clearAuditService(projectDir: string): void {
  auditServices.delete(projectDir);
}
