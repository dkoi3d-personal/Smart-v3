/**
 * Multi-Agent Service v2
 * Runs multiple specialized agents in parallel:
 * - Product Owner Agent: Creates epics and user stories
 * - Coder Agent: Writes the application code
 * - Tester Agent: Writes tests and validates functionality
 * - Security Agent: Reviews code for security issues
 *
 * Uses @anthropic-ai/claude-agent-sdk to leverage your Claude Code subscription (no API costs).
 * Each agent runs with Sonnet 4.5 for optimal speed and quality.
 */

import { claudeSubscriptionService } from './claude-subscription-service';
import * as fs from 'fs/promises';
import { execSync } from 'child_process';
import path from 'path';
import { glob } from 'glob';
import { EventEmitter } from 'events';
import lockfile from 'proper-lockfile';
import writeFileAtomic from 'write-file-atomic';
import { OptimizedAgentRunner } from './optimized-agent-runner';
import {
  loadAgentConfig,
  getEffectivePrompt,
  FullAgentConfiguration,
  AgentQuickSettings,
  DEFAULT_QUICK_SETTINGS,
} from '@/lib/agent-config-store';
import { createLogger, Logger } from '@/lib/logger';
import {
  normalizePathForGlob,
  getNpmCommand,
  execCommandSafe,
} from '@/lib/cross-platform';
import {
  getHealthcareProductOwnerPrompt,
  getHealthcareCoderPrompt,
  getHealthcareTesterPrompt,
  getHealthcareSecurityPrompt,
  getHealthcareFixerPrompt,
  HealthcareSettings,
} from '@/lib/healthcare-agent-prompts';
import { promptGenerator } from '@/lib/services/prompt-generator';
import { getComponentLibraryPromptForProject } from '@/lib/design-systems/prompt-generator';
import { loadAIConfig, generateEnvVars } from '@/lib/ai-config/ai-config-store';
import { scaffoldProject, needsScaffolding } from '@/services/project-scaffold-service';
import { getAuditService, AuditService, GitInfo } from './audit-service';

// Import from extracted learning memory module
import {
  getLearningsContext,
  captureErrorLearning,
  capturePatternLearning,
  captureAgentOutputLearnings,
  detectTechStack,
} from './agents/learning-memory';

// Import from extracted figma context module
import {
  getProjectSourceInfo,
  loadFigmaContext,
  getFigmaProductOwnerInstructions,
  getFigmaCoderInstructions,
  getDesignTokenInstructions,
  type ProjectSourceInfo,
} from './agents/figma-context';

// Import from extracted architecture context module
import {
  loadProjectArchitecture,
  preloadArchitecture,
  formatArchitectureForPrompt,
  getArchitectureContext,
  type ArchitectureContext,
} from './agents/architecture-context';

// Import context templates
import {
  TESTER_WORKFLOW,
  formatStoryForContext,
  formatStorySummary,
  formatLockedFilesWarning,
} from './agents/context';

// Import from extracted agent modules
import {
  AgentRole,
  AgentMessage,
  Task,
  AgentState,
  CoderConfig,
  CommandLog,
  Epic,
  MultiAgentSession,
  SessionCheckpoint,
  Tool,
  AgentConfig,
} from './agents/types';
import { AGENT_CONFIGS } from './agents/configs/prompts';

// Import from extracted orchestration modules
import { StoryFileManager } from './orchestration/story-file-manager';
import { CheckpointManager } from './orchestration/checkpoint-manager';
import {
  buildProductOwnerContext,
  buildCoderContext,
  buildTesterContext,
  buildSecurityContext,
  type QuickSettings,
} from './orchestration/context-builders';
import { getTools } from './agents/configs/tools';
import {
  executeToolFromRegistry,
  hasToolHandler,
  type ToolContext,
} from './agents/tool-handlers';

// Agent mode configuration types
interface AgentModeConfig {
  mode: 'default' | 'healthcare';
  healthcareSettings?: HealthcareSettings;
  configuredAt: string | null;
}

// Cache for agent mode config to avoid reading file on every agent run
let cachedAgentModeConfig: AgentModeConfig | null = null;
let agentModeConfigLastLoaded = 0;
const AGENT_MODE_CACHE_TTL = 5000; // 5 seconds

async function loadAgentModeConfig(): Promise<AgentModeConfig> {
  const now = Date.now();
  if (cachedAgentModeConfig && (now - agentModeConfigLastLoaded) < AGENT_MODE_CACHE_TTL) {
    return cachedAgentModeConfig;
  }

  const configFile = path.join(process.cwd(), 'data', 'agent-mode-config.json');
  const defaultConfig: AgentModeConfig = {
    mode: 'default',
    healthcareSettings: {
      includeEpicAPIs: true,
      includeTestPatients: true,
      includeFHIRExamples: true,
      ehrPlatform: 'generic',
      complianceLevel: 'hipaa',
    },
    configuredAt: null,
  };

  try {
    const data = await fs.readFile(configFile, 'utf-8');
    const loadedConfig: AgentModeConfig = { ...defaultConfig, ...JSON.parse(data) };
    cachedAgentModeConfig = loadedConfig;
    agentModeConfigLastLoaded = now;
    return loadedConfig;
  } catch {
    cachedAgentModeConfig = defaultConfig;
    agentModeConfigLastLoaded = now;
    return defaultConfig;
  }
}

// Re-export types for backwards compatibility (types now in ./agents/types.ts)
export type {
  AgentRole,
  AgentMessage,
  Task,
  AgentState,
  CoderConfig,
  CommandLog,
  Epic,
  MultiAgentSession,
  SessionCheckpoint,
  Tool,
} from './agents/types';

// =============================================================================
// Git Info Capture for ISO 42001 Change Management
// =============================================================================

/**
 * Capture git repository info for audit trail (ISO 42001 Change Management)
 */
async function captureGitInfo(projectDir: string): Promise<GitInfo | null> {
  try {
    // Check if it's a git repo
    try {
      execSync('git rev-parse --is-inside-work-tree', { cwd: projectDir, stdio: 'pipe' });
    } catch {
      return null; // Not a git repo
    }

    // Get current branch
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: projectDir, encoding: 'utf-8' }).trim();

    // Get current commit hash (if any commits exist)
    let commitHash: string | undefined;
    try {
      commitHash = execSync('git rev-parse HEAD', { cwd: projectDir, encoding: 'utf-8' }).trim();
    } catch {
      // No commits yet
    }

    // Get remote URL
    let remoteUrl: string | undefined;
    try {
      remoteUrl = execSync('git remote get-url origin', { cwd: projectDir, encoding: 'utf-8' }).trim();
    } catch {
      // No remote configured
    }

    // Check if working directory is dirty
    const statusOutput = execSync('git status --porcelain', { cwd: projectDir, encoding: 'utf-8' });
    const isDirty = statusOutput.trim().length > 0;

    // Get changed files with stats
    const filesChanged: GitInfo['filesChanged'] = [];
    if (isDirty) {
      const lines = statusOutput.trim().split('\n').filter(Boolean);
      for (const line of lines) {
        const status = line.substring(0, 2).trim();
        const filePath = line.substring(3);

        let fileStatus: 'added' | 'modified' | 'deleted' | 'renamed' = 'modified';
        if (status === 'A' || status === '??') fileStatus = 'added';
        else if (status === 'D') fileStatus = 'deleted';
        else if (status.includes('R')) fileStatus = 'renamed';

        filesChanged.push({ path: filePath, status: fileStatus });
      }
    }

    return {
      commitHash,
      branch,
      remoteUrl,
      isDirty,
      filesChanged,
    };
  } catch (error) {
    console.warn('[Git] Failed to capture git info:', error);
    return null;
  }
}

// =============================================================================

// =============================================================================
// AGENT_CONFIGS and getTools moved to:
//   - services/agents/configs/prompts.ts (AGENT_CONFIGS)
//   - services/agents/configs/tools.ts (getTools)
// Imported at top of this file for cleaner code organization
// =============================================================================

export class MultiAgentService extends EventEmitter {
  private sessions: Map<string, MultiAgentSession> = new Map();
  private activeAgentSessions: Map<string, string> = new Map(); // role -> sessionId
  private optimizedRunners: Map<string, OptimizedAgentRunner> = new Map(); // sessionId -> runner
  private sessionAbortControllers: Map<string, AbortController> = new Map(); // sessionId -> AbortController
  private projectToSession: Map<string, string> = new Map(); // projectId -> sessionId
  private sessionLoggers: Map<string, Logger> = new Map(); // sessionId -> Logger
  public readonly instanceId: string;
  private serviceLogger: Logger;

  // Extracted orchestration managers
  private storyFileManager: StoryFileManager;
  private checkpointManager: CheckpointManager;

  constructor() {
    super();
    this.instanceId = Math.random().toString(36).substring(2, 8);
    this.serviceLogger = createLogger('MultiAgentService');

    // Initialize orchestration managers
    this.storyFileManager = new StoryFileManager({ emitter: this });
    this.checkpointManager = new CheckpointManager({
      emitter: this,
      getRunner: (sessionId) => this.optimizedRunners.get(sessionId),
    });

    this.serviceLogger.log(`Created instance: ${this.instanceId}`);
    this.serviceLogger.log('Using optimized parallel agent system with:');
    this.serviceLogger.log('  - Event-driven coordination (no polling)');
    this.serviceLogger.log('  - Real file locking (proper-lockfile)');
    this.serviceLogger.log('  - Atomic JSON updates (write-file-atomic)');
    this.serviceLogger.log('  - Story dependency graph');

    // Forward events from the subscription service
    claudeSubscriptionService.on('file:write', (data) => {
      this.emit('file:changed', { ...data, action: 'write' });
    });
    claudeSubscriptionService.on('file:edit', (data) => {
      this.emit('file:changed', { ...data, action: 'edit' });
    });
    claudeSubscriptionService.on('command:run', (data) => {
      this.emit('command:start', data);
    });
    // Forward epic/task events from stories file parsing
    claudeSubscriptionService.on('epic:created', (data) => {
      this.serviceLogger.log(`Forwarding epic:created: ${data.id}`);
      this.emit('epic:created', data);
    });
    claudeSubscriptionService.on('task:created', (data) => {
      this.serviceLogger.log(`Forwarding task:created: ${data.id}`);
      this.emit('task:created', data);
    });
  }

  /**
   * Get or create a logger for a session with correlation context
   */
  getSessionLogger(session: MultiAgentSession, prefix = 'Multi-Agent'): Logger {
    const existing = this.sessionLoggers.get(session.id);
    if (existing && prefix === 'Multi-Agent') {
      return existing;
    }
    return createLogger(prefix, session.logContext || { sessionId: session.id, projectId: session.projectId });
  }

  private idCounter = 0;

  private generateId(): string {
    this.idCounter++;
    return `${Date.now()}-${this.idCounter}-${Math.random().toString(36).substring(2, 8)}`;
  }

  private emitAgentMessage(session: MultiAgentSession, message: Omit<AgentMessage, 'id' | 'timestamp'>): void {
    const fullMessage: AgentMessage = {
      ...message,
      id: `msg-${this.generateId()}`,
      timestamp: new Date(),
    };
    session.messages.push(fullMessage);
    this.emit('agent:message', fullMessage);
  }

  /**
   * Execute a tool for a specific agent
   */
  private async executeTool(
    role: AgentRole,
    toolName: string,
    toolInput: Record<string, any>,
    session: MultiAgentSession
  ): Promise<string> {
    const config = AGENT_CONFIGS[role];

    // PRIMARY: Use tool handler registry (O(1) lookup)
    // NOTE: This method is currently unused - Claude CLI uses its own built-in tools.
    // Agents update .agile-stories.json directly via Claude's Write tool.
    if (hasToolHandler(toolName)) {
      const ctx: ToolContext = {
        role,
        toolInput,
        session,
        config,
        emit: (event: string, data: any) => this.emit(event, data),
        emitAgentMessage: (msg: { agentRole: AgentRole; agentName: string; type: 'thinking' | 'action' | 'result' | 'chat' | 'error'; content: string }) =>
          this.emitAgentMessage(session, msg),
        generateId: () => this.generateId(),
        persistStoriesToFile: () => this.storyFileManager.persistStoriesToFile(session),
      };
      return await executeToolFromRegistry(toolName, ctx);
    }


    // FALLBACK: Tool not in registry
    return `Unknown tool: ${toolName}`;
  }

  /**
   * Run a single agent using Claude Agent SDK (uses your Claude Code subscription - no API costs)
   * @param role - The agent role (coder, tester, etc.)
   * @param session - The multi-agent session
   * @param context - The context/prompt for the agent
   * @param agentId - Optional specific agent ID (e.g., 'coder-1', 'coder-2') for parallel workers
   * @param loadedConfig - Pre-loaded agent configuration (if available)
   * @param storyId - Optional story ID that this agent is working on (for log filtering)
   */
  async *runAgent(
    role: AgentRole,
    session: MultiAgentSession,
    context: string,
    agentId?: string,
    loadedConfig?: FullAgentConfiguration | null,
    storyId?: string
  ): AsyncGenerator<AgentMessage> {
    const effectiveAgentId = agentId || role;

    // Get session logger with agent context
    const logger = this.getSessionLogger(session, 'Multi-Agent').child('Agent', {
      agentRole: role,
      storyId,
    });

    logger.log(`runAgent GENERATOR CREATED for ${effectiveAgentId}`);
    logger.debug('First .next() call will trigger execution');

    // Get settings from loaded config or use defaults
    const loadedAgentConfig = loadedConfig?.agents?.[role as keyof typeof loadedConfig.agents];
    const quickSettings = loadedConfig?.quickSettings || DEFAULT_QUICK_SETTINGS;
    const config = AGENT_CONFIGS[role]; // For name lookup and fallback prompts
    const agentState = session.agents.get(role)!;
    agentState.status = 'working';

    logger.log(`runAgent EXECUTING (${effectiveAgentId}) using Claude Subscription Service`);

    this.emit('agent:status', { role, status: 'working', agentId: effectiveAgentId });

    const startMsg: AgentMessage = {
      id: `msg-${this.generateId()}`,
      agentRole: role,
      agentName: config.name,
      type: 'thinking',
      content: `${config.name} is starting work with Employers AI Studio...`,
      timestamp: new Date(),
      storyId, // Include storyId for filtering in UI
    };
    logger.log(`yielding start message: ${startMsg.content}`);
    yield startMsg;

    // Create stories file for coordination - uses .agile-stories.json to match all prompts
    const storiesFile = path.join(session.workingDirectory, '.agile-stories.json');
    try {
      await fs.access(storiesFile);
    } catch {
      await writeFileAtomic(storiesFile, JSON.stringify({
        tasks: session.tasks,
        epics: session.epics || [],
        lastUpdated: new Date().toISOString(),
      }, null, 2));
    }

    // Build role-specific prompts
    let fullPrompt = '';

    // Load agent mode configuration (healthcare vs default)
    const agentModeConfig = await loadAgentModeConfig();
    const isHealthcareMode = agentModeConfig.mode === 'healthcare';
    const healthcareSettings = agentModeConfig.healthcareSettings || {
      includeEpicAPIs: true,
      includeTestPatients: true,
      includeFHIRExamples: true,
      ehrPlatform: 'generic' as const,
      complianceLevel: 'hipaa' as const,
    };

    if (isHealthcareMode) {
      logger.log('Healthcare mode ENABLED');
    }

    if (role === 'product_owner') {
      // Use healthcare prompt if in healthcare mode, otherwise use configured or default prompt
      let basePrompt: string;
      if (isHealthcareMode) {
        basePrompt = getHealthcareProductOwnerPrompt(healthcareSettings);
      } else if (loadedAgentConfig) {
        basePrompt = getEffectivePrompt(loadedAgentConfig, quickSettings);
      } else {
        basePrompt = config.systemPrompt;
      }

      // Load Figma context if this is a Figma project
      let figmaInstructions = '';
      try {
        const figmaContext = await loadFigmaContext(session.workingDirectory);
        if (figmaContext) {
          figmaInstructions = getFigmaProductOwnerInstructions(figmaContext);
          console.log(`[Multi-Agent] Injecting Figma instructions into Product Owner prompt (${figmaContext.components?.length || 0} components)`);
        }
      } catch (figmaError) {
        console.warn(`[Multi-Agent] Could not load Figma context for PO:`, figmaError);
      }

      fullPrompt = `${basePrompt}
${figmaInstructions}

${context}

STORIES FILE: ${storiesFile}
Working Directory: ${session.workingDirectory}

START NOW: Read the stories file first (if it exists), then write your epics and stories to it.`;

      console.log(`[Multi-Agent] Product Owner using ${isHealthcareMode ? 'healthcare' : 'configured'} prompt (${basePrompt.length} chars)`);
    } else if (role === 'coder') {
      // Use healthcare prompt if in healthcare mode, otherwise use configured or default prompt
      let coderBasePrompt: string;
      if (isHealthcareMode) {
        coderBasePrompt = getHealthcareCoderPrompt(healthcareSettings);
      } else {
        coderBasePrompt = loadedAgentConfig?.systemPrompt || config.systemPrompt;
      }
      const coderCustomInstructions = loadedAgentConfig?.customInstructions || '';

      // Get learnings from past projects
      const techStack = detectTechStack(context);
      const learningsContext = getLearningsContext(context, techStack);
      if (learningsContext) {
        console.log(`[Learning Memory] Injecting ${techStack.length > 0 ? `learnings for [${techStack.join(', ')}]` : 'general learnings'} into Coder prompt`);
      }

      // Get architecture context for this project
      const architectureContext = getArchitectureContext(session.workingDirectory);
      if (architectureContext) {
        console.log(`[Architecture] Injecting architecture guidelines into Coder prompt`);
      }

      // Generate dynamic platform services documentation
      const servicesPrompt = promptGenerator.generateServicesPrompt({
        projectType: isHealthcareMode ? 'healthcare' : 'general',
        includeApis: true,
        includeMcp: true,
        includeLlms: false, // Coder doesn't need to know about LLM routing
        verbosity: 'standard',
        includeExamples: true,
      });

      // Load component library prompt (unified API + design tokens) for this project
      let designSystemContext = '';
      try {
        const componentLibraryPrompt = await getComponentLibraryPromptForProject(session.projectId);
        if (componentLibraryPrompt) {
          designSystemContext = `\n${componentLibraryPrompt}\n`;
          console.log(`[Multi-Agent] Injecting component library API into Coder prompt`);
        }
      } catch (dsError) {
        console.warn(`[Multi-Agent] Could not load component library for project ${session.projectId}:`, dsError);
      }

      // Get project source info to determine design token source (Figma vs Design System)
      let designTokenInstructions = '';
      let figmaCoderInstructions = '';
      try {
        const sourceInfo = await getProjectSourceInfo(session.projectId);
        designTokenInstructions = getDesignTokenInstructions(sourceInfo);
        console.log(`[Multi-Agent] Design tokens source: ${sourceInfo.hasFigmaDesign ? 'Figma' : 'Design System'}`);

        // If Figma project, load full context and generate detailed instructions
        if (sourceInfo.hasFigmaDesign) {
          const figmaContext = await loadFigmaContext(session.workingDirectory);
          if (figmaContext) {
            figmaCoderInstructions = getFigmaCoderInstructions(figmaContext, sourceInfo.figmaUrl);
            console.log(`[Multi-Agent] Injecting Figma implementation instructions into Coder prompt`);
          }
        }
      } catch (sourceError) {
        console.warn(`[Multi-Agent] Could not get design token instructions:`, sourceError);
      }

      fullPrompt = `${coderBasePrompt}
${coderCustomInstructions ? `\n=== CUSTOM INSTRUCTIONS ===\n${coderCustomInstructions}\n` : ''}
${architectureContext}
${learningsContext}
${servicesPrompt}
${designSystemContext}
${figmaCoderInstructions}
${designTokenInstructions}
=== CURRENT TASK ===
${context}

=== STORY COORDINATION ===
STORIES FILE: ${storiesFile}
- Read this file to see available tasks
- Update task status to "in_progress" when you start (include your agent ID)
- Update task status to "testing" when done

Working Directory: ${session.workingDirectory}

WORKFLOW:
1. Read ${storiesFile} to find "pending" tasks assigned to "coder"
2. Pick the highest priority task
3. Update its status to "in_progress" and set "workingAgent": "coder" in the file
4. Implement the feature (create files, install deps, etc.)
5. Update status to "testing" when done
6. Repeat for next task

Begin by reading the stories file.`;

      console.log(`[Multi-Agent] Coder using ${isHealthcareMode ? 'healthcare' : loadedAgentConfig ? 'configured' : 'default'} prompt`);
    } else if (role === 'tester') {
      // Use healthcare prompt if in healthcare mode, otherwise use configured or default prompt
      let testerBasePrompt: string;
      if (isHealthcareMode) {
        testerBasePrompt = getHealthcareTesterPrompt(healthcareSettings);
      } else {
        testerBasePrompt = loadedAgentConfig?.systemPrompt || config.systemPrompt;
      }
      const testerCustomInstructions = loadedAgentConfig?.customInstructions || '';

      // Get testing-specific learnings from past projects
      const testerTechStack = detectTechStack(context);
      testerTechStack.push('testing', 'jest', 'vitest'); // Add testing-specific keywords
      const testerLearningsContext = getLearningsContext(context, testerTechStack);
      if (testerLearningsContext) {
        console.log(`[Learning Memory] Injecting testing learnings into Tester prompt`);
      }

      // Get architecture context for this project
      const testerArchitectureContext = getArchitectureContext(session.workingDirectory);
      if (testerArchitectureContext) {
        console.log(`[Architecture] Injecting architecture guidelines into Tester prompt`);
      }

      fullPrompt = `${testerBasePrompt}
${testerCustomInstructions ? `\n=== CUSTOM INSTRUCTIONS ===\n${testerCustomInstructions}\n` : ''}
${testerArchitectureContext}
${testerLearningsContext}
=== CURRENT TASK ===
${context}

=== STORY COORDINATION ===
Working Directory: ${session.workingDirectory}
STORIES FILE: ${storiesFile}

WORKFLOW:
1. Read ${storiesFile} to find stories with status "testing"
2. Update the story's "workingAgent" field to "tester" when you start
3. Write test files for the story
4. Run tests: npm test -- --coverage --passWithNoTests
5. Parse test output to extract: total tests, passed, failed, coverage %
6. ⚠️ MANDATORY: Write results to .test-results.json in this EXACT format:

{
  "task_id": "story-1",
  "task_title": "Story title",
  "passed": true,
  "total_tests": 25,
  "passed_tests": 25,
  "failed_tests": 0,
  "summary": "All 25 tests passed with 60% coverage",
  "error_output": "",
  "coverage": 60,
  "testedBy": "tester"
}

7. Update ${storiesFile}: Change story status to "done" if tests passed, or "failed" if tests failed

⚠️ YOU MUST create .test-results.json after EVERY test run! The UI dashboard monitors this file!

Begin by reading ${storiesFile} to find the next story in "testing" status.`;

      console.log(`[Multi-Agent] Tester using ${isHealthcareMode ? 'healthcare' : loadedAgentConfig ? 'configured' : 'default'} prompt`);
    } else if (role === 'security') {
      // Use healthcare prompt if in healthcare mode, otherwise use configured or default prompt
      let securityBasePrompt: string;
      if (isHealthcareMode) {
        securityBasePrompt = getHealthcareSecurityPrompt(healthcareSettings);
      } else {
        securityBasePrompt = loadedAgentConfig?.systemPrompt || config.systemPrompt;
      }
      const securityCustomInstructions = loadedAgentConfig?.customInstructions || '';

      // Get security-specific learnings from past projects
      const securityTechStack = detectTechStack(context);
      securityTechStack.push('security', 'auth', 'xss', 'sql-injection', 'csrf'); // Add security-specific keywords
      const securityLearningsContext = getLearningsContext(context, securityTechStack);
      if (securityLearningsContext) {
        console.log(`[Learning Memory] Injecting security learnings into Security prompt`);
      }

      // Get architecture context for this project
      const securityArchitectureContext = getArchitectureContext(session.workingDirectory);
      if (securityArchitectureContext) {
        console.log(`[Architecture] Injecting architecture guidelines into Security prompt`);
      }

      fullPrompt = `${securityBasePrompt}
${securityCustomInstructions ? `\n=== CUSTOM INSTRUCTIONS ===\n${securityCustomInstructions}\n` : ''}
${securityArchitectureContext}
${securityLearningsContext}
=== CURRENT TASK ===
${context}

Working Directory: ${session.workingDirectory}

Scan all source files for security issues. Use Read tool to examine files and report any vulnerabilities found.`;

      console.log(`[Multi-Agent] Security using ${isHealthcareMode ? 'healthcare' : loadedAgentConfig ? 'configured' : 'default'} prompt`);
    } else if (role === 'fixer') {
      // Use healthcare prompt if in healthcare mode, otherwise use default prompt
      let fixerBasePrompt: string;
      if (isHealthcareMode) {
        fixerBasePrompt = getHealthcareFixerPrompt(healthcareSettings);
      } else {
        fixerBasePrompt = config.systemPrompt;
      }

      // Get error/fix-specific learnings from past projects - this is critical for the Fixer
      const fixerTechStack = detectTechStack(context);
      const fixerLearningsContext = getLearningsContext(context, fixerTechStack);
      if (fixerLearningsContext) {
        console.log(`[Learning Memory] Injecting error-solution learnings into Fixer prompt`);
      }

      // Get architecture context for this project
      const fixerArchitectureContext = getArchitectureContext(session.workingDirectory);
      if (fixerArchitectureContext) {
        console.log(`[Architecture] Injecting architecture guidelines into Fixer prompt`);
      }

      // Also try to capture any errors from the context itself to learn from
      captureErrorLearning(context, session.projectId);

      fullPrompt = `${fixerBasePrompt}
${fixerArchitectureContext}
${fixerLearningsContext}
=== CURRENT TASK ===
${context}

Working Directory: ${session.workingDirectory}`;

      console.log(`[Multi-Agent] Fixer using ${isHealthcareMode ? 'healthcare' : 'default'} prompt`);
    } else {
      fullPrompt = `${config.systemPrompt}

TASK: ${context}

Working Directory: ${session.workingDirectory}`;
    }

    try {
      console.log(`[Multi-Agent] ${role}: Starting Claude subscription service...`);
      console.log(`[Multi-Agent] ${role}: Prompt length: ${fullPrompt.length}`);
      console.log(`[Multi-Agent] ${role}: Working dir: ${session.workingDirectory}`);

      // Use the Claude Subscription Service to run the agent with configured settings
      const agentModel = loadedAgentConfig?.model || 'sonnet';
      const agentMaxTurns = loadedAgentConfig?.maxTurns || 30;
      console.log(`[Multi-Agent] ${role}: Using model=${agentModel}, maxTurns=${agentMaxTurns}`);

      // Collect agent output for learning capture
      const agentOutputParts: string[] = [];

      // Register agent start with audit service for compliance tracking
      const effectiveAgentIdForAudit = agentId || (role === 'coder' ? 'coder-main' : role);
      if (session.auditService && storyId) {
        try {
          await session.auditService.logAgentStart(storyId, role, effectiveAgentIdForAudit, agentModel);
          console.log(`[Audit] Registered agent start: ${role} (${effectiveAgentIdForAudit}) for story ${storyId}`);
        } catch (err) {
          console.error(`[Audit] Failed to log agent start:`, err);
        }
      }

      for await (const message of claudeSubscriptionService.runAgent(fullPrompt, {
        model: agentModel,
        maxTurns: agentMaxTurns,
        permissionMode: 'bypassPermissions',
        workingDirectory: session.workingDirectory,
      })) {
        console.log(`[Multi-Agent] ${role}: Got message type: ${message.type}`);

        // Collect output for learning extraction
        if (message.content) {
          agentOutputParts.push(message.content);
        }

        // Dynamic storyId lookup from session.agentToStory map
        // This map is maintained by getNextStoryForRole/getFreshContext to track current assignments
        let effectiveStoryId = storyId;
        if (role === 'coder' || role === 'tester') {
          const effectiveAgentId = agentId || (role === 'coder' ? 'coder-main' : 'tester');
          const trackedStoryId = session.agentToStory.get(effectiveAgentId);
          if (trackedStoryId) {
            effectiveStoryId = trackedStoryId;
          }
        }

        // Convert SDK messages to AgentMessages
        const agentMsg: AgentMessage = {
          id: `msg-${this.generateId()}`,
          agentRole: role,
          agentName: config.name,
          type: this.mapMessageType(message.type),
          content: message.content,
          toolName: message.toolName,
          toolInput: message.toolInput,
          timestamp: new Date(),
          storyId: effectiveStoryId, // Dynamic storyId based on current work
        };

        session.messages.push(agentMsg);
        yield agentMsg;

        // Log to audit service for compliance tracking
        if (session.auditService && effectiveStoryId) {
          try {
            const effectiveAgentId = agentId || (role === 'coder' ? 'coder-main' : role);

            // Map message type to audit action type
            let actionType: 'tool_use' | 'thinking' | 'chat' | 'error' | 'file_create' | 'file_modify' = 'chat';
            const msgType = message.type as string; // Cast to string for flexible comparison
            if (msgType === 'tool_use') {
              // Determine if it's a file operation based on tool name
              if (message.toolName === 'Write' || message.toolName === 'Edit') {
                actionType = message.toolName === 'Write' ? 'file_create' : 'file_modify';
              } else {
                actionType = 'tool_use';
              }
            } else if (msgType === 'thinking' || msgType === 'text') {
              actionType = 'thinking';
            } else if (msgType === 'error') {
              actionType = 'error';
            }

            await session.auditService.logAgentAction(effectiveStoryId, effectiveAgentId, {
              timestamp: new Date().toISOString(),
              type: actionType,
              toolName: message.toolName,
              toolInput: message.toolInput,
              content: message.content?.substring(0, 500), // Truncate for storage
              target: message.toolInput?.file_path || message.toolInput?.path,
              outcome: message.type === 'error' ? 'failure' : 'success',
            });
          } catch (err) {
            // Silent fail for audit logging to not break main flow
          }
        }

        // Emit events for tracking
        if (message.type === 'tool_use') {
          this.emit('tool:use', {
            tool: message.toolName,
            input: message.toolInput,
            agent: role,
          });
        }

        // Check for test results file (tester writes this instead of calling a tool)
        if (role === 'tester' && (message.type === 'tool_use' || message.type === 'complete')) {
          await this.checkTestResultsFile(session);
        }

        // Check for story file updates periodically (skip for researcher - it doesn't modify stories)
        if (role !== 'researcher' && (message.type === 'tool_use' || message.type === 'complete')) {
          await this.storyFileManager.syncStoriesFromFile(session, storiesFile, role, config.name, agentId);
        }
      }

      // CRITICAL: Final sync after agent completes to catch any last-moment file changes
      // This ensures the story status change is detected even if it was the agent's last action
      // Skip for researcher - it only analyzes, doesn't modify stories
      if (role !== 'researcher') {
        await this.storyFileManager.syncStoriesFromFile(session, storiesFile, role, config.name, agentId);
        console.log(`[Multi-Agent] ${role}: Final sync complete for agent ${agentId || role}`);
      }

      // Register agent completion with audit service
      if (session.auditService && storyId) {
        try {
          await session.auditService.logAgentComplete(storyId, effectiveAgentIdForAudit);
          console.log(`[Audit] Registered agent complete: ${role} (${effectiveAgentIdForAudit}) for story ${storyId}`);
        } catch (err) {
          console.error(`[Audit] Failed to log agent complete:`, err);
        }
      }

      // Capture learnings from successful agent output
      const agentOutput = agentOutputParts.join('\n');
      const detectedTech = detectTechStack(context);
      const learningResult = captureAgentOutputLearnings(role, agentOutput, true, session.projectId, detectedTech);

      // Emit event for UI to track learnings
      if (learningResult.count > 0) {
        this.emit('learnings:captured', {
          agentRole: role,
          count: learningResult.count,
          pendingIds: learningResult.pendingIds,
          learnings: learningResult.learnings,
          wasSuccessful: true,
        });
      }

    } catch (error) {
      const errorContent = error instanceof Error ? error.message : String(error);

      // Capture error as a learning for future agents
      captureErrorLearning(errorContent, session.projectId);

      // Also capture via the full learning agent for more comprehensive extraction
      const detectedTech = detectTechStack(context);
      const errorLearningResult = captureAgentOutputLearnings(role, errorContent, false, session.projectId, detectedTech);

      // Emit event for UI to track error learnings
      if (errorLearningResult.count > 0) {
        this.emit('learnings:captured', {
          agentRole: role,
          count: errorLearningResult.count,
          pendingIds: errorLearningResult.pendingIds,
          learnings: errorLearningResult.learnings,
          wasSuccessful: false,
        });
      }

      const errorMsg: AgentMessage = {
        id: `msg-${this.generateId()}`,
        agentRole: role,
        agentName: config.name,
        type: 'error',
        content: `Error: ${errorContent}`,
        timestamp: new Date(),
        storyId, // Include storyId for filtering in UI
      };
      session.messages.push(errorMsg);
      yield errorMsg;
    }

    agentState.status = 'completed';
    this.emit('agent:status', { role, status: 'completed' });

    yield {
      id: `msg-${this.generateId()}`,
      agentRole: role,
      agentName: config.name,
      type: 'chat',
      content: `${config.name} has finished working.`,
      timestamp: new Date(),
    };
  }

  /**
   * Map SDK message types to AgentMessage types
   */
  private mapMessageType(sdkType: string): AgentMessage['type'] {
    switch (sdkType) {
      case 'text': return 'chat';
      case 'tool_use': return 'action';
      case 'tool_result': return 'result';
      case 'error': return 'error';
      case 'system': return 'thinking';
      case 'complete': return 'chat';
      default: return 'chat';
    }
  }

  /**
   * Sync task updates from the stories file back to the session
   */
  /**
   * Check for test results file and emit test:results event
   */
  private async checkTestResultsFile(session: MultiAgentSession): Promise<void> {
    const testResultsFile = `${session.workingDirectory}/.test-results.json`;
    try {
      const content = await fs.readFile(testResultsFile, 'utf-8');
      const results = JSON.parse(content);

      console.log('[Multi-Agent] 🧪🧪🧪 Found test results file:', results);

      const storyId = results.task_id;
      const timestamp = new Date().toISOString();

      // Emit test:results event
      this.emit('test:results', {
        task_id: storyId,
        task_title: results.task_title,
        passed: results.passed,
        total_tests: results.total_tests || 0,
        passed_tests: results.passed_tests || 0,
        failed_tests: results.failed_tests || 0,
        summary: results.summary,
        error_output: results.error_output || '',
        coverage: results.coverage || 0,
        timestamp,
      });

      // Log test_run action to audit service for story's agent logs
      if (session.auditService && storyId) {
        try {
          const testSummary = results.passed
            ? `Tests passed: ${results.passed_tests || 0}/${results.total_tests || 0}`
            : `Tests failed: ${results.failed_tests || 0}/${results.total_tests || 0}`;

          await session.auditService.logAgentAction(storyId, 'tester', {
            timestamp,
            type: 'test_run',
            content: `${testSummary}\n${results.summary || ''}${results.error_output ? '\n\nErrors:\n' + results.error_output : ''}`,
            outcome: results.passed ? 'success' : 'failure',
            target: 'npm test',
          });
          console.log(`[Multi-Agent] Logged test_run action for story ${storyId}`);
        } catch (err) {
          console.error('[Multi-Agent] Failed to log test_run action:', err);
        }
      }

      // Delete file after reading so we don't emit duplicates
      await fs.unlink(testResultsFile);
      console.log('[Multi-Agent] 🧪 Test results emitted and file deleted');
    } catch {
      // File doesn't exist yet or invalid JSON - this is fine
    }
  }

  /**
   * Ensure .env.local exists with proper local development configuration
   * This is CRITICAL for local development to work (Prisma, API URLs, etc.)
   * Called automatically at the start of every build (new or iteration)
   */
  private async ensureLocalEnvSetup(session: MultiAgentSession): Promise<{ created: boolean; updated: boolean; message: string }> {
    const workDir = session.workingDirectory;
    const envLocalPath = path.join(workDir, '.env.local');
    const envPath = path.join(workDir, '.env');
    const envExamplePath = path.join(workDir, '.env.example');

    // Default local dev environment values
    const localDefaults: Record<string, string> = {
      'DATABASE_URL': 'file:./dev.db',
      'NEXT_PUBLIC_API_URL': 'http://localhost:3000',
      'NODE_ENV': 'development',
    };

    // Load AI provider keys from platform settings
    let aiEnvVars: Record<string, string> = {};
    try {
      const aiConfig = await loadAIConfig();
      aiEnvVars = generateEnvVars(aiConfig);
      if (Object.keys(aiEnvVars).length > 0) {
        console.log('[Multi-Agent] 🔑 Loaded AI provider keys from platform settings');
      }
    } catch (aiConfigError) {
      console.warn('[Multi-Agent] Could not load AI config:', aiConfigError);
    }

    try {
      // Check if .env.local already exists
      let existingContent = '';
      let envLocalExists = false;
      try {
        existingContent = await fs.readFile(envLocalPath, 'utf-8');
        envLocalExists = true;
      } catch {
        // File doesn't exist
      }

      // Parse existing content into key-value pairs
      const existingVars: Record<string, string> = {};
      if (existingContent) {
        for (const line of existingContent.split('\n')) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex > 0) {
              const key = trimmed.substring(0, eqIndex).trim();
              const value = trimmed.substring(eqIndex + 1).trim().replace(/^["']|["']$/g, '');
              existingVars[key] = value;
            }
          }
        }
      }

      // Check if DATABASE_URL exists and points to local (not a deployed URL)
      const hasLocalDb = existingVars['DATABASE_URL'] &&
        (existingVars['DATABASE_URL'].includes('file:') ||
         existingVars['DATABASE_URL'].includes('localhost') ||
         existingVars['DATABASE_URL'].includes('127.0.0.1'));

      if (envLocalExists && hasLocalDb) {
        console.log('[Multi-Agent] ✅ .env.local exists with local DATABASE_URL - no changes needed');
        return { created: false, updated: false, message: '.env.local already configured for local development' };
      }

      // Try to read .env or .env.example for additional vars to preserve
      let templateVars: Record<string, string> = {};
      for (const templatePath of [envPath, envExamplePath]) {
        try {
          const templateContent = await fs.readFile(templatePath, 'utf-8');
          for (const line of templateContent.split('\n')) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
              const eqIndex = trimmed.indexOf('=');
              if (eqIndex > 0) {
                const key = trimmed.substring(0, eqIndex).trim();
                const value = trimmed.substring(eqIndex + 1).trim().replace(/^["']|["']$/g, '');
                // Don't override with deployed URLs
                if (!templateVars[key] && !value.includes('azure') && !value.includes('prod')) {
                  templateVars[key] = value;
                }
              }
            }
          }
          break; // Use first template found
        } catch {
          // Template doesn't exist, continue
        }
      }

      // Merge: existing vars > template vars > AI keys > local defaults
      // AI keys from platform settings are included but can be overridden
      const finalVars: Record<string, string> = { ...localDefaults, ...aiEnvVars, ...templateVars, ...existingVars };

      // ALWAYS ensure DATABASE_URL is local for development
      if (!hasLocalDb) {
        finalVars['DATABASE_URL'] = localDefaults['DATABASE_URL'];
      }

      // Build the new .env.local content
      const lines: string[] = [
        '# Local Development Environment',
        '# Auto-generated by AI Build System - safe to customize',
        '# This file is git-ignored and overrides .env for local development',
        '',
        '# Database - Local SQLite for development',
        `DATABASE_URL="${finalVars['DATABASE_URL']}"`,
        '',
        '# API URL - Local development server',
        `NEXT_PUBLIC_API_URL="${finalVars['NEXT_PUBLIC_API_URL'] || 'http://localhost:3000'}"`,
        '',
      ];

      // Add AI provider keys from platform settings
      const aiKeys = ['OPENAI_API_KEY', 'OPENAI_MODEL', 'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'GROQ_API_KEY', 'AI_PROVIDER'];
      const presentAiKeys = aiKeys.filter(k => finalVars[k]);
      if (presentAiKeys.length > 0) {
        lines.push('# AI Provider Configuration (from platform settings)');
        for (const key of presentAiKeys) {
          lines.push(`${key}="${finalVars[key]}"`);
        }
        lines.push('');
      }

      // Add any other vars from the merged set
      const coreVars = ['DATABASE_URL', 'NEXT_PUBLIC_API_URL', 'NODE_ENV', ...aiKeys];
      const otherVars = Object.entries(finalVars).filter(([k]) => !coreVars.includes(k));
      if (otherVars.length > 0) {
        lines.push('# Additional environment variables');
        for (const [key, value] of otherVars) {
          lines.push(`${key}="${value}"`);
        }
        lines.push('');
      }

      await fs.writeFile(envLocalPath, lines.join('\n'), 'utf-8');

      const action = envLocalExists ? 'updated' : 'created';
      console.log(`[Multi-Agent] ✅ .env.local ${action} with local development settings`);
      console.log(`[Multi-Agent]    DATABASE_URL = ${finalVars['DATABASE_URL']}`);

      return {
        created: !envLocalExists,
        updated: envLocalExists,
        message: `.env.local ${action} - DATABASE_URL set to local SQLite for development`,
      };
    } catch (err: any) {
      console.error('[Multi-Agent] ⚠️ Failed to setup .env.local:', err.message);
      return { created: false, updated: false, message: `Failed to setup .env.local: ${err.message}` };
    }
  }

  /**
   * Run multiple agents in parallel
   */
  async *runParallel(
    session: MultiAgentSession,
    requirements: string,
    agentsToRun: AgentRole[] = ['product_owner', 'coder', 'tester', 'security']
  ): AsyncGenerator<AgentMessage> {
    const logger = this.getSessionLogger(session);

    logger.log('runParallel STARTED');
    logger.log(`  - Project: ${session.projectId}`);
    logger.log(`  - Agents to run: ${agentsToRun.join(', ')}`);
    logger.log(`  - Existing project: ${session.coderConfig?.isExistingProject ? 'yes' : 'no (fresh build)'}`);
    logger.log(`  - Working dir: ${session.workingDirectory}`);

    // Load existing stories from file (important for iterations!)
    await this.storyFileManager.loadExistingStories(session);

    // Ensure .env.local exists with local development settings
    // This is CRITICAL for Prisma and local testing to work
    const envResult = await this.ensureLocalEnvSetup(session);
    if (envResult.created || envResult.updated) {
      yield {
        id: `msg-${this.generateId()}`,
        agentRole: 'coordinator',
        agentName: 'Coordinator',
        type: 'chat',
        content: `🔧 ${envResult.message}`,
        timestamp: new Date(),
      };
    }

    // Auto-create foundation story so coder can start immediately while PO creates other stories
    // Only do this if: 1) no existing tasks, 2) not an existing project, 3) PO is included
    const isExistingProject = session.coderConfig?.isExistingProject ?? false;
    const hasFoundationStory = session.tasks.some(t => t.id === 'story-foundation');
    if (!isExistingProject && !hasFoundationStory && session.tasks.length === 0 && agentsToRun.includes('product_owner')) {
      const foundationStory = {
        id: 'story-foundation',
        epicId: 'epic-foundation',
        title: 'Project Foundation: Verify Scaffold & Implement Design System',
        description: 'Verify the project scaffold is correctly set up and implement the design system with brand colors, typography, and reusable UI components',
        acceptance_criteria: [
          'Verify package.json exists with Next.js 14+, TypeScript, Tailwind CSS, and Prisma',
          'Run npm install to ensure all dependencies are installed',
          'Apply design system colors to tailwind.config.js (primary, secondary, accent, etc.)',
          'Apply design system typography (font family, sizes, weights) to tailwind.config.js',
          'Create reusable UI components in components/ui/: Button, Card, Input, Modal',
          'Style UI components using the design system tokens',
          'Update app/layout.tsx with proper fonts and global styles',
          'npm run build passes with no errors'
        ],
        status: 'backlog',
        priority: 'critical',
        storyPoints: 5,
        domain: 'infra',
        dependsOn: []
      } as any;
      const foundationEpic = {
        id: 'epic-foundation',
        title: 'Project Foundation',
        description: 'Core project setup including scaffold verification and design system implementation',
        priority: 'critical'
      };

      session.tasks.push(foundationStory);
      session.epics = [foundationEpic] as any;

      // Persist to file so it appears in kanban immediately
      const storiesFile = path.join(session.workingDirectory, '.agile-stories.json');
      await writeFileAtomic(storiesFile, JSON.stringify({
        tasks: session.tasks,
        epics: session.epics,
        lastUpdated: new Date().toISOString(),
      }, null, 2));

      console.log('[Multi-Agent] 🏗️ Auto-created story-foundation for immediate coder start');
      this.emit('task:created', foundationStory);

      yield {
        id: `msg-${this.generateId()}`,
        agentRole: 'coordinator',
        agentName: 'Coordinator',
        type: 'chat',
        content: '🏗️ Foundation story created - coder can start immediately while PO creates remaining stories',
        timestamp: new Date(),
      };
    }

    // Initialize audit service for compliance logging (ISO 42001, EU AI Act, SOC 2)
    const auditService = getAuditService(session.workingDirectory);
    session.auditService = auditService;
    const buildId = await auditService.startBuild(
      session.projectId,
      requirements,
      {
        parallelCoders: session.coderConfig.parallelCoders,
        batchMode: session.coderConfig.batchMode,
        agentModel: 'claude-sonnet-4-20250514',
      }
    );
    session.currentBuildId = buildId;

    // Log data lineage - requirements input
    await auditService.logDataSource('requirements', 'user_input');
    await auditService.logContextProvided(`Working directory: ${session.workingDirectory}`);

    // Capture git info for ISO 42001 Change Management compliance
    const gitInfo = await captureGitInfo(session.workingDirectory);
    if (gitInfo) {
      await auditService.setGitInfo(gitInfo);
      console.log(`[Audit] Captured git info: branch=${gitInfo.branch}, commit=${gitInfo.commitHash?.substring(0, 7) || 'none'}`);
    }

    // Set up audit event listeners for task lifecycle
    const auditTaskCreatedHandler = async (task: any) => {
      try {
        await auditService.initializeStory(
          task.id,
          task.title || 'Untitled',
          task.description || '',
          {
            epicId: task.epicId,
            priority: task.priority,
            acceptanceCriteria: task.acceptanceCriteria || task.acceptance_criteria,
          }
        );
      } catch (err) {
        console.error('[Audit] Failed to initialize story:', err);
      }
    };

    // Track test results by story ID for later use when completing stories
    const testResultsByStory = new Map<string, { passed: number; failed: number; skipped: number }>();

    const auditTestResultsHandler = async (results: any) => {
      try {
        const storyId = results.task_id;
        if (!storyId) return;

        const testResults = {
          passed: results.passed_tests || 0,
          failed: results.failed_tests || 0,
          skipped: 0,
        };

        // Store for later use when story completes
        testResultsByStory.set(storyId, testResults);

        // Also update the build metrics immediately
        if (auditService.getCurrentBuild()) {
          const currentBuild = auditService.getCurrentBuild()!;
          currentBuild.metrics.totalTestsPassed += testResults.passed;
          currentBuild.metrics.totalTestsFailed += testResults.failed;
          console.log(`[Audit] Updated test metrics for ${storyId}: ${testResults.passed} passed, ${testResults.failed} failed`);
        }
      } catch (err) {
        console.error('[Audit] Failed to process test results:', err);
      }
    };

    // Modified task updated handler to use stored test results
    const auditTaskUpdatedWithTestsHandler = async (task: any) => {
      try {
        if (task.status === 'in_progress') {
          await auditService.startStory(task.id);
        } else if (task.status === 'done' || task.status === 'completed') {
          // Check for stored test results
          const testResults = testResultsByStory.get(task.id);
          await auditService.completeStory(task.id, 'success', testResults);
          testResultsByStory.delete(task.id);
        } else if (task.status === 'failed') {
          const testResults = testResultsByStory.get(task.id);
          await auditService.completeStory(task.id, 'failure', testResults);
          testResultsByStory.delete(task.id);
        }
      } catch (err) {
        console.error('[Audit] Failed to update story:', err);
      }
    };

    this.on('task:created', auditTaskCreatedHandler);
    this.on('task:updated', auditTaskUpdatedWithTestsHandler);
    this.on('test:results', auditTestResultsHandler);

    // Cleanup function for audit listeners
    const cleanupAuditListeners = () => {
      this.off('task:created', auditTaskCreatedHandler);
      this.off('task:updated', auditTaskUpdatedWithTestsHandler);
      this.off('test:results', auditTestResultsHandler);
      testResultsByStory.clear();
    };

    // Load agent configuration
    let agentConfig: FullAgentConfiguration | null = null;
    try {
      agentConfig = await loadAgentConfig();
      console.log('[Multi-Agent] Loaded agent configuration:', {
        minStories: agentConfig.quickSettings.minStories,
        maxStories: agentConfig.quickSettings.maxStories,
        minEpics: agentConfig.quickSettings.minEpics,
        maxEpics: agentConfig.quickSettings.maxEpics,
      });
    } catch (err) {
      console.log('[Multi-Agent] Using default agent configuration');
    }

    const quickSettings = agentConfig?.quickSettings || {
      minStories: 10,
      maxStories: 40,
      minEpics: 3,
      maxEpics: 10,
    };

    // Get existing files for context
    let existingFiles = '';
    let hasPackageJson = false;
    try {
      // Normalize path for glob (use forward slashes on Windows)
      const normalizedDir = session.workingDirectory.replace(/\\/g, '/');
      const files = await glob('**/*.{ts,tsx,js,jsx,json}', {
        cwd: normalizedDir,
        ignore: ['**/node_modules/**', '.agile-stories.json', '.agent-stories.json', '.test-results.json', 'project-state.json'],
      });
      // Check if package.json exists (real indicator of project being set up)
      hasPackageJson = files.some(f => f === 'package.json');
      if (files.length > 0) {
        existingFiles = `\n\nExisting files in project:\n${files.slice(0, 20).join('\n')}`;
      }
    } catch {}

    // Determine if this is a new project - based on package.json or isExistingProject flag
    // isExistingProject is already defined above
    const isNewProject = !hasPackageJson && !isExistingProject;
    console.log(`[Multi-Agent] Project detection: hasPackageJson=${hasPackageJson}, isExistingProject=${isExistingProject}, isNewProject=${isNewProject}`);

    // Build agent contexts using extracted context builders
    // Note: skipFoundation is deprecated, using isExistingProject instead
    const contextOptions = { requirements, existingFiles, skipFoundation: isExistingProject, isNewProject, quickSettings };
    const productOwnerContext = buildProductOwnerContext(contextOptions);
    const coderContext = buildCoderContext(contextOptions);
    const testerContext = buildTesterContext(requirements, existingFiles);
    const securityContext = buildSecurityContext(requirements, existingFiles);

    // Create generators for each agent - start product owner and coder together
    const generators: Map<AgentRole, AsyncGenerator<AgentMessage>> = new Map();
    const completed = new Set<AgentRole>();
    const started = new Set<AgentRole>();
    const startTime = Date.now();

    // Relaunch limiting - prevent infinite loops when stories get stuck
    let coderRelaunchCount = 0;
    const MAX_CODER_RELAUNCHES = 3; // Limit relaunch attempts to prevent infinite loops

    // Start Product Owner immediately
    if (agentsToRun.includes('product_owner')) {
      console.log(`[Multi-Agent] 👔 Starting Product Owner agent`);
      yield {
        id: `msg-${this.generateId()}`,
        agentRole: 'product_owner',
        agentName: 'Product Owner',
        type: 'thinking',
        content: 'Creating epics and user stories...',
        timestamp: new Date(),
      };
      generators.set('product_owner', this.runAgent('product_owner', session, productOwnerContext, undefined, agentConfig));
      started.add('product_owner');
      console.log(`[Multi-Agent] 👔 Product Owner generator created and added to started set`);
    } else {
      console.log(`[Multi-Agent] ⚠️ Product Owner NOT in agentsToRun: ${agentsToRun.join(', ')}`);
    }

    // Start Coder shortly after (give PO a head start to create first story)
    if (agentsToRun.includes('coder')) {
      yield {
        id: `msg-${this.generateId()}`,
        agentRole: 'coordinator',
        agentName: 'Coordinator',
        type: 'chat',
        content: 'Coder agent starting - will pick up stories as they are created...',
        timestamp: new Date(),
      };
    }

    // Track when delayed agents should start
    const delayedAgentTimers: { role: AgentRole; context: string; startTime: number; coderId?: string }[] = [];

    // Track parallel coder generators separately
    const parallelCoderGenerators = new Map<string, AsyncGenerator<AgentMessage>>();
    const completedCoders = new Set<string>();
    const waitingCoders = new Set<string>(); // Coders waiting for more work (don't relaunch immediately)

    // Track parallel tester generators separately (like coders)
    const parallelTesterGenerators = new Map<string, AsyncGenerator<AgentMessage>>();
    const completedTesters = new Set<string>();
    const waitingTesters = new Set<string>(); // Testers waiting for more work (don't relaunch)
    const parallelTestersCount = agentConfig?.quickSettings?.parallelTesters || 1;

    // FOUNDATION-FIRST PATTERN:
    // - Only 1 coder starts initially (works on foundation/setup story)
    // - Additional coders start after foundation story completes
    // - This prevents conflicts from multiple agents trying to set up the project
    // - If isExistingProject is true, foundation is already complete
    // - ALSO check if foundation story already exists and is done
    const existingFoundation = session.tasks.find(t =>
      t.id === 'story-foundation' ||
      t.title.toLowerCase().includes('foundation') ||
      t.title.toLowerCase().includes('scaffold')
    );
    const foundationAlreadyDone = existingFoundation &&
      ['testing', 'done', 'completed'].includes(existingFoundation.status);

    let foundationComplete = isExistingProject || foundationAlreadyDone;
    let foundationStoryId: string | null = existingFoundation?.id || null;

    // If existing project or foundation already done, emit foundation:complete immediately
    if (isExistingProject) {
      console.log('[Multi-Agent] ✅ Existing project - foundation already complete');
      this.emit('foundation:complete', {
        storyId: 'existing-project',
        storyTitle: 'Existing Project',
        status: 'done',
        isExistingProject: true,
      });
    } else if (foundationAlreadyDone && existingFoundation) {
      console.log(`[Multi-Agent] ✅ Foundation already complete: "${existingFoundation.title}" (${existingFoundation.status})`);
      this.emit('foundation:complete', {
        storyId: existingFoundation.id,
        storyTitle: existingFoundation.title,
        status: existingFoundation.status,
      });
    }

    // PRE-BUILD: Run npm install once before coders start
    // This ensures any new dependencies added to package.json are installed
    // Prevents coders from running npm install in parallel (which corrupts node_modules)
    if (hasPackageJson) {
      console.log('[Multi-Agent] 📦 Running npm install before coders start...');
      this.emit('agent:message', {
        role: 'system',
        type: 'system',
        content: '📦 Installing dependencies (npm install)...',
        timestamp: new Date(),
      });
      try {
        execSync('npm install', {
          cwd: session.workingDirectory,
          stdio: 'pipe',
          timeout: 300000, // 5 min timeout
        });
        console.log('[Multi-Agent] ✅ npm install completed');
        this.emit('agent:message', {
          role: 'system',
          type: 'system',
          content: '✅ Dependencies installed successfully',
          timestamp: new Date(),
        });
      } catch (err: any) {
        console.warn('[Multi-Agent] ⚠️ npm install failed:', err.message);
        this.emit('agent:message', {
          role: 'system',
          type: 'system',
          content: `⚠️ npm install warning: ${err.message?.substring(0, 200) || 'unknown error'}`,
          timestamp: new Date(),
        });
        // Continue anyway - coders can handle missing deps
      }
    }

    // Keywords that identify a foundation/setup story
    const FOUNDATION_KEYWORDS = [
      'setup', 'foundation', 'initial', 'scaffold', 'bootstrap',
      'project setup', 'configuration', 'initialize', 'create-next-app',
      'package.json', 'tsconfig', 'config'
    ];

    const isFoundationStory = (task: Task): boolean => {
      const title = task.title.toLowerCase();
      const desc = task.description?.toLowerCase() || '';
      const combined = `${title} ${desc}`;
      if (FOUNDATION_KEYWORDS.some(kw => combined.includes(kw))) return true;
      if (task.priority === 'high' && task.id.includes('story-1')) return true;
      return false;
    };

    // Coder starts 3 seconds after PO (to let first story be created)
    // FOUNDATION-FIRST: Only first coder starts immediately, others wait for foundation
    // EXCEPTION: If foundation already complete (isExistingProject OR already done), start ALL coders
    if (agentsToRun.includes('coder')) {
      const { parallelCoders } = session.coderConfig;

      if (foundationComplete && parallelCoders > 1) {
        // Foundation already complete (existing project OR done): Start ALL coders immediately
        const reason = isExistingProject ? 'EXISTING PROJECT' : 'FOUNDATION ALREADY DONE';
        console.log(`[Multi-Agent] 🚀 ${reason}: Starting ALL ${parallelCoders} coders immediately!`);
        for (let i = 0; i < parallelCoders; i++) {
          const coderId = `coder-${i + 1}`;
          const staggerTime = startTime + 3000 + (i * 1000); // Stagger by 1 second each
          delayedAgentTimers.push({ role: 'coder', context: coderContext, startTime: staggerTime, coderId });
          console.log(`[Multi-Agent] Queued ${coderId} to start at +${3 + i}s`);
        }
      } else {
        // Normal mode: Only first coder starts, others wait for foundation
        const coderId = parallelCoders > 1 ? 'coder-1' : 'coder';
        delayedAgentTimers.push({ role: 'coder', context: coderContext, startTime: startTime + 3000, coderId });

        if (parallelCoders > 1) {
          console.log(`[Multi-Agent] 🏗️ FOUNDATION-FIRST MODE: Only coder-1 starts initially`);
          console.log(`[Multi-Agent] Additional ${parallelCoders - 1} coders will start after foundation story completes`);
        }
      }
    }
    // NOTE: Tester is NOT added to delayedAgentTimers - it will be started dynamically
    // when stories move to 'testing' status. See the tester launch logic below.
    // NOTE: Security is also NOT added to delayedAgentTimers - it will be started dynamically
    // when the majority of stories are done. See the security launch logic below.

    // Track whether tester and security should be launched
    const shouldRunTester = agentsToRun.includes('tester');
    const shouldRunSecurity = agentsToRun.includes('security');
    let testerWaitingLogged = false;
    let securityWaitingLogged = false;
    const pollInterval = 500; // Poll every 500ms
    let lastStatusUpdate = Date.now();
    let iterationCount = 0;
    const maxIterations = 50000; // Safety limit

    // Track failed task retry counts to prevent infinite loops
    const failedTaskRetries = new Map<string, number>();
    const MAX_RETRIES = 3;

    // Track tested stories to prevent duplicate testing on tester restart
    // Store on session so tool handlers can also mark stories as tested
    if (!(session as any).testedStoryIds) {
      (session as any).testedStoryIds = new Set<string>();
    }
    const testedStories = (session as any).testedStoryIds as Set<string>;

    // Track tester story assignments for atomic claiming (like coderStoryAssignments)
    // Maps storyId -> testerId (not just boolean!) so we know WHO claimed it
    if (!(session as any).testerStoryAssignments) {
      (session as any).testerStoryAssignments = new Map<string, string>();
    }
    const testerStoryAssignments = (session as any).testerStoryAssignments as Map<string, string>;

    // Helper to check if all stories are done
    // Must have stories AND product owner must be done AND all stories must be done/completed
    // Check if all stories in this build are done
    const allStoriesDone = () => {
      // All stories belong to current build now (no iteration filtering)
      const relevantStories = session.tasks;
      // Need at least one story
      if (relevantStories.length === 0) return false;
      // Product owner must be finished creating stories
      if (!completed.has('product_owner') && agentsToRun.includes('product_owner')) return false;
      // All stories must be done/completed, OR failed with max retries exceeded
      return relevantStories.every(t => {
        if (t.status === 'done' || t.status === 'completed') return true;
        // Failed tasks that have exceeded max retries are considered "done" (can't fix them)
        if (t.status === 'failed') {
          const retries = failedTaskRetries.get(t.id) || 0;
          return retries >= MAX_RETRIES;
        }
        return false;
      });
    };

    // Helper to check if workflow is truly complete
    // Security scan is now manual-only, so we just check if all stories are done
    const workflowComplete = () => {
      return allStoriesDone();
    };

    // Track parallel coder story assignments: storyId -> coderId
    const coderStoryAssignments = new Map<string, string>();

    // CRITICAL: Restore assignments from session.tasks on resume
    // This prevents multiple coders from picking up the same in_progress story after resume
    for (const task of session.tasks) {
      if (task.status === 'in_progress' && task.assignedTo) {
        const assignedTo = String(task.assignedTo);
        if (assignedTo.startsWith('coder')) {
          coderStoryAssignments.set(task.id, assignedTo);
          session.agentToStory.set(assignedTo, task.id);
          console.log(`[Multi-Agent] Restored coder assignment on resume: ${assignedTo} -> ${task.id}`);
        }
      }
    }

    // Track parallel tester story assignments: testerId -> storyId (for UI log filtering)
    // PERSISTED on session to survive across iterations (unlike local variable)
    if (!(session as any).testerToStoryMap) {
      (session as any).testerToStoryMap = new Map<string, string>();
    }
    const testerToStoryMap = (session as any).testerToStoryMap as Map<string, string>;

    // CRITICAL: Restore tester assignments from session.tasks on resume
    // This prevents multiple testers from picking up the same testing story after resume
    for (const task of session.tasks) {
      if (task.status === 'testing' && task.assignedTo) {
        const assignedTo = String(task.assignedTo);
        if (assignedTo.startsWith('tester') && !testerStoryAssignments.has(task.id)) {
          testerStoryAssignments.set(task.id, assignedTo); // Store testerId, not just true!
          testerToStoryMap.set(assignedTo, task.id);
          session.agentToStory.set(assignedTo, task.id);
          console.log(`[Multi-Agent] Restored tester assignment on resume: ${assignedTo} -> ${task.id}`);
        }
      }
    }

    // Helper to get the current storyId for a coder (for message filtering in UI)
    const getStoryIdForCoder = (coderId: string): string | undefined => {
      for (const [storyId, owner] of coderStoryAssignments.entries()) {
        if (owner === coderId) return storyId;
      }
      return undefined;
    };

    // Helper to get the current storyId for a tester (for message filtering in UI)
    const getStoryIdForTester = (testerId: string): string | undefined => {
      return testerToStoryMap.get(testerId);
    };

    // File locking info for parallel coders
    const getLockedFilesInfo = (): string => {
      if (session.fileLocks.size === 0) return '';
      return `\n\n⚠️ FILES LOCKED BY OTHER CODERS:\n${Array.from(session.fileLocks.keys()).map(f => `- ${f}`).join('\n')}\nDO NOT edit these files!`;
    };

    const releaseFileLocks = (coderId: string): void => {
      for (const [file, owner] of session.fileLocks.entries()) {
        if (owner === coderId) session.fileLocks.delete(file);
      }
    };

    // Helper to release a coder's story assignments when they stop working
    // This allows other coders to pick up orphaned in_progress stories
    const releaseCoderStoryAssignments = (coderId: string): void => {
      for (const [storyId, owner] of coderStoryAssignments.entries()) {
        if (owner === coderId) {
          coderStoryAssignments.delete(storyId);
          console.log(`[Multi-Agent] Released story assignment: ${storyId} was assigned to ${coderId}`);
        }
      }
    };

    // Helper to check if a coder is actively working (not completed or waiting)
    // CRITICAL FIX: Also check coderStoryAssignments to prevent race condition
    // A coder with an assigned story is considered active even if not yet in parallelCoderGenerators
    // This prevents multiple coders from picking up the same "orphaned" story during launch
    const isCoderActive = (coderId: string): boolean => {
      if (completedCoders.has(coderId) || waitingCoders.has(coderId)) {
        return false;
      }
      // Check if coder is in generator map OR has an active story assignment
      if (parallelCoderGenerators.has(coderId)) {
        return true;
      }
      // Check if this coder has any story assigned (handles race condition during launch)
      for (const [, owner] of coderStoryAssignments.entries()) {
        if (owner === coderId) return true;
      }
      return false;
    };

    // Helper to check if a story's dependencies are complete enough to start coding
    // We allow "testing" status because that means coding is done - tests run in parallel
    const areDependenciesComplete = (story: typeof session.tasks[0]): boolean => {
      const deps = (story as any).dependsOn || (story as any).depends_on || [];
      if (!deps || deps.length === 0) return true; // No dependencies = ready to go

      for (const depId of deps) {
        const depStory = session.tasks.find(t => t.id === depId);
        if (!depStory) {
          // Dependency doesn't exist - might be an error, but allow it
          console.warn(`[Multi-Agent] Dependency ${depId} not found for story ${story.id}`);
          continue;
        }
        // "testing", "done", or "completed" means coding is finished - allow next stories to start
        // This enables parallel work: testers test while coders move to next stories
        const codingComplete = ['testing', 'done', 'completed'].includes(depStory.status);
        if (!codingComplete) {
          return false;
        }
      }
      return true;
    };

    // Helper to check if a task belongs to current build
    // With clean-slate architecture, all tasks belong to current build
    const isInCurrentBuild = (_task: typeof session.tasks[0]): boolean => {
      return true; // All tasks in .agile-stories.json are for current build
    };

    // NON-MUTATING helper to check if there's work available for a role
    // CRITICAL: Use this for "has work?" checks instead of getNextStoryForRole which MUTATES state
    const hasWorkForRole = (role: AgentRole, agentId?: string): boolean => {
      if (role === 'coder') {
        const inProgressIds = new Set(coderStoryAssignments.keys());
        // Check for failed tasks (only from current iteration)
        const hasFailedWork = session.tasks.some(t =>
          t.status === 'failed' &&
          !inProgressIds.has(t.id) &&
          (failedTaskRetries.get(t.id) || 0) < MAX_RETRIES &&
          areDependenciesComplete(t) &&
          isInCurrentBuild(t)
        );
        if (hasFailedWork) return true;
        // Check for orphaned in_progress (assigned coder inactive, only from current iteration)
        const hasOrphanedWork = session.tasks.some(t => {
          if (t.status !== 'in_progress') return false;
          if (!isInCurrentBuild(t)) return false;
          const assignedCoder = coderStoryAssignments.get(t.id);
          if (!assignedCoder) return true; // Untracked = claimable
          return !isCoderActive(assignedCoder);
        });
        if (hasOrphanedWork) return true;
        // Check for backlog work (only from current iteration)
        return session.tasks.some(t =>
          (t.status === 'backlog' || t.status === 'pending') &&
          !inProgressIds.has(t.id) &&
          areDependenciesComplete(t) &&
          isInCurrentBuild(t)
        );
      } else if (role === 'tester') {
        return session.tasks.some(t =>
          t.status === 'testing' &&
          !testedStories.has(t.id) &&
          !testerStoryAssignments.has(t.id) &&
          isInCurrentBuild(t)
        );
      }
      return false;
    };

    // Helper to get next unassigned story for a role (with atomic assignment to prevent race conditions)
    const getNextStoryForRole = (role: AgentRole, agentId?: string): typeof session.tasks[0] | null => {
      if (role === 'coder') {
        const inProgressIds = new Set(coderStoryAssignments.keys());
        const effectiveCoderId = agentId || 'coder-main';

        // PRIORITY 1: Failed tasks that need fixing (up to MAX_RETRIES, only from current iteration)
        const failedTask = session.tasks.find(t => {
          if (t.status !== 'failed') return false;
          if (inProgressIds.has(t.id)) return false;
          if (!isInCurrentBuild(t)) return false;
          const retries = failedTaskRetries.get(t.id) || 0;
          if (retries >= MAX_RETRIES) return false;
          // Also check dependencies for failed tasks
          return areDependenciesComplete(t);
        });
        if (failedTask) {
          // Atomically mark as assigned to prevent race condition
          coderStoryAssignments.set(failedTask.id, effectiveCoderId);
          session.agentToStory.set(effectiveCoderId, failedTask.id); // Track for log filtering
          const retries = failedTaskRetries.get(failedTask.id) || 0;
          console.log(`\n🔄 RETRY: Coder ${effectiveCoderId} picking up failed story`);
          console.log(`   Story: "${failedTask.title}" (${failedTask.id})`);
          console.log(`   Retry attempt: ${retries + 1}/${MAX_RETRIES}`);
          console.log(`   Previous error: ${failedTask.result?.slice(0, 200) || 'N/A'}\n`);
          return failedTask;
        }

        // PRIORITY 2: Orphaned in_progress tasks (assigned coder is no longer active, only from current iteration)
        // CRITICAL: Only pick up stories that are TRULY orphaned
        // Stories NOT in coderStoryAssignments might be from file - first to claim gets them
        const orphanedTask = session.tasks.find(t => {
          if (t.status !== 'in_progress') return false;
          if (!isInCurrentBuild(t)) return false;
          const assignedCoder = coderStoryAssignments.get(t.id);
          if (!assignedCoder) {
            // Not tracked - check if assignedTo in file matches a specific coder
            const fileAssignment = t.assignedTo?.toString() || '';
            if (fileAssignment && fileAssignment.startsWith('coder-')) {
              // Only the assigned coder should claim it
              if (fileAssignment === effectiveCoderId) {
                console.log(`[Multi-Agent] ${effectiveCoderId} claiming file-assigned story: ${t.id}`);
                return true; // This coder claims it
              }
              return false; // Different coder - skip
            }
            // No specific coder assignment - first one claims it atomically
            return true;
          }
          // Check if assigned coder is still active
          return !isCoderActive(assignedCoder);
        });
        if (orphanedTask) {
          // Double-check: another coder might have claimed it between find() and here
          const currentAssignment = coderStoryAssignments.get(orphanedTask.id);
          if (currentAssignment && currentAssignment !== effectiveCoderId) {
            console.log(`[Multi-Agent] ${effectiveCoderId} lost race for ${orphanedTask.id} to ${currentAssignment}`);
            // Don't return - fall through to look for backlog stories
          } else {
            console.log(`[Multi-Agent] ${effectiveCoderId} picking up orphaned in_progress story: ${orphanedTask.id} (${orphanedTask.title})`);
            // Clear old assignment and reassign
            coderStoryAssignments.delete(orphanedTask.id);
            coderStoryAssignments.set(orphanedTask.id, effectiveCoderId);
            session.agentToStory.set(effectiveCoderId, orphanedTask.id);
            return orphanedTask;
          }
        }

        // PRIORITY 3: New tasks from backlog - ONLY if dependencies are COMPLETE
        const backlogStories = session.tasks.filter(t =>
          t.status === 'backlog' || t.status === 'pending'
        );
        // Debug: Log all story statuses to diagnose why stories aren't being found
        const statusCounts = session.tasks.reduce((acc, t) => {
          acc[t.status] = (acc[t.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        const assignedStoryIds = Array.from(inProgressIds).join(', ') || 'none';
        console.log(`[Multi-Agent] ${effectiveCoderId} looking for work: ${backlogStories.length} backlog, ${inProgressIds.size} assigned (${assignedStoryIds}), total ${session.tasks.length} stories`);
        console.log(`[Multi-Agent] Status breakdown: ${JSON.stringify(statusCounts)}`);

        const nextTask = session.tasks.find(t => {
          if (t.status !== 'backlog' && t.status !== 'pending') return false;
          if (!isInCurrentBuild(t)) return false; // Only process stories from current iteration
          if (inProgressIds.has(t.id)) {
            console.log(`[Multi-Agent] Story ${t.id} skipped: already assigned`);
            return false;
          }
          if (!areDependenciesComplete(t)) {
            const deps = (t as any).dependsOn || (t as any).depends_on || [];
            const depStatuses = deps.map((depId: string) => {
              const dep = session.tasks.find(d => d.id === depId);
              return dep ? `${depId}:${dep.status}` : `${depId}:missing`;
            });
            console.log(`[Multi-Agent] Story ${t.id} blocked by deps: ${depStatuses.join(', ')}`);
            return false;
          }
          return true;
        }) || null;

        if (nextTask) {
          console.log(`[Multi-Agent] ${effectiveCoderId} picking up story: ${nextTask.id} (${nextTask.title})`);
          // Atomically mark as assigned to prevent race condition
          coderStoryAssignments.set(nextTask.id, effectiveCoderId);
          session.agentToStory.set(effectiveCoderId, nextTask.id); // Track for log filtering

          // CRITICAL FIX: Also mark as in_progress immediately so dependencies unblock!
          // Previously, status stayed 'backlog' until coder called start_story(), blocking other stories
          nextTask.status = 'in_progress';
          nextTask.assignedTo = effectiveCoderId as AgentRole;
          (nextTask as any).workingAgent = effectiveCoderId;
          this.emit('task:updated', nextTask);
          console.log(`[Multi-Agent] Story ${nextTask.id} auto-marked as in_progress`);
        } else {
          // Log if stories are blocked by dependencies
          const blockedStories = session.tasks.filter(t =>
            (t.status === 'backlog' || t.status === 'pending') &&
            !inProgressIds.has(t.id) &&
            !areDependenciesComplete(t)
          );
          if (blockedStories.length > 0) {
            console.log(`[Multi-Agent] ${blockedStories.length} stories blocked by incomplete dependencies`);
          }
        }
        return nextTask;
      } else if (role === 'tester') {
        const effectiveTesterId = agentId || 'tester-main';
        // Tester should ONLY test stories that are explicitly in 'testing' status
        // Do NOT pick up 'in_progress' stories - those are still being worked on by coder
        // Filter out already-tested stories to prevent duplicates on tester restart
        // Only test stories from current iteration
        const untestedStory = session.tasks.find(t =>
          t.status === 'testing' &&
          !testedStories.has(t.id) &&
          !testerStoryAssignments.has(t.id) &&
          isInCurrentBuild(t)
        );
        if (untestedStory) {
          console.log(`[Multi-Agent] ${effectiveTesterId} claiming story: ${untestedStory.id} (${untestedStory.title})`);
          // Atomically claim story to prevent race conditions - store WHICH tester claimed it
          testerStoryAssignments.set(untestedStory.id, effectiveTesterId);
          // Track which tester is testing this story (for UI log filtering)
          testerToStoryMap.set(effectiveTesterId, untestedStory.id);
          session.agentToStory.set(effectiveTesterId, untestedStory.id); // Session-level tracking

          // CRITICAL FIX: Update story's assignedTo to specific tester so others know WHO is testing
          // Previously stayed as generic 'tester', allowing multiple testers to claim same story
          untestedStory.assignedTo = effectiveTesterId as AgentRole;
          (untestedStory as any).workingAgent = effectiveTesterId;
          this.emit('task:updated', untestedStory);
          console.log(`[Multi-Agent] Story ${untestedStory.id} assigned to ${effectiveTesterId}`);
        }
        return untestedStory || null;
      }
      return null;
    };

    // Get multiple stories for batch mode (with atomic assignment to prevent race conditions)
    const getStoriesForBatch = (batchSize: number, coderId?: string): typeof session.tasks => {
      const inProgressIds = new Set(coderStoryAssignments.keys());
      const effectiveCoderId = coderId || 'coder-main';
      const stories = session.tasks
        .filter(t =>
          (t.status === 'backlog' || t.status === 'pending') &&
          !inProgressIds.has(t.id) &&
          areDependenciesComplete(t) && // Check dependencies are done/completed
          isInCurrentBuild(t) // Only process stories from current iteration
        )
        .slice(0, batchSize);

      // Atomically mark all as assigned AND in_progress to prevent race conditions
      stories.forEach(story => {
        coderStoryAssignments.set(story.id, effectiveCoderId);
        // CRITICAL FIX: Also mark as in_progress so dependencies unblock
        story.status = 'in_progress';
        story.assignedTo = effectiveCoderId as AgentRole;
        (story as any).workingAgent = effectiveCoderId;
        this.emit('task:updated', story);
      });
      // Track first story for log filtering (batch mode handles multiple stories)
      if (stories.length > 0) {
        session.agentToStory.set(effectiveCoderId, stories[0].id);
        console.log(`[Multi-Agent] Batch: ${stories.length} stories auto-marked as in_progress for ${effectiveCoderId}`);
      }

      return stories;
    };

    // Helper to generate fresh context for an agent to continue working
    const getFreshContext = (role: AgentRole, coderId?: string): string => {
      const remainingStories = session.tasks.filter(t => t.status !== 'done' && t.status !== 'completed');
      const storySummary = `\n\nRemaining stories:\n${remainingStories.map((t, i) => `${i + 1}. [${t.id}] ${t.title} (status: ${t.status})`).join('\n')}`;

      if (role === 'coder') {
        const { batchMode, batchSize, parallelCoders } = session.coderConfig;
        const effectiveCoderId = coderId || 'coder-main';
        const lockedFilesInfo = parallelCoders > 1 ? getLockedFilesInfo() : '';

        // Batch mode: single coder handles multiple stories at once
        if (batchMode && parallelCoders === 1) {
          const stories = getStoriesForBatch(batchSize, effectiveCoderId);
          if (stories.length === 0) return '';

          stories.forEach((story, idx) => {
            story.status = 'in_progress';
            story.assignedTo = effectiveCoderId as AgentRole; // Use specific coder ID (coder-1, coder-2, etc.)
            coderStoryAssignments.set(story.id, effectiveCoderId);
            // Track story for log filtering BEFORE any output can be generated
            session.agentToStory.set(effectiveCoderId, story.id);
            this.emit('task:updated', { ...story, status: 'in_progress', assignedTo: effectiveCoderId });
            // Emit story:started for UI to move card and track agent
            this.emit('story:started', {
              storyId: story.id,
              storyTitle: story.title,
              agentId: effectiveCoderId,
              status: 'in_progress',
            });
          });

          const storyList = stories.map((s, i) => `
STORY ${i + 1}: "${s.title}" (ID: ${s.id})
Description: ${s.description}
${(s as any).acceptanceCriteria ? `Acceptance Criteria:\n${(s as any).acceptanceCriteria.map((c: string) => `  - ${c}`).join('\n')}` : ''}`).join('\n');

          return `Requirements:\n${requirements}${existingFiles}${storySummary}

=== BATCH MODE: IMPLEMENT ${stories.length} STORIES ===
${storyList}

INSTRUCTIONS:
1. Implement ALL ${stories.length} stories in this batch
2. For EACH story when complete: mark_ready_for_testing(task_id="STORY_ID")
3. Work efficiently - related stories may share code

START NOW with the first story.`;
        }

        // Single story mode (for both single coder and parallel coders)
        const nextStory = getNextStoryForRole('coder', coderId);
        if (!nextStory) return '';

        // Check if this is a failed story that needs fixing
        const isFailedStory = nextStory.status === 'failed';
        const retryCount = failedTaskRetries.get(nextStory.id) || 0;

        if (isFailedStory) {
          // Increment retry count for failed task
          failedTaskRetries.set(nextStory.id, retryCount + 1);

          // Emit a message about the retry
          this.emitAgentMessage(session, {
            agentRole: 'coordinator',
            agentName: 'Coordinator',
            type: 'chat',
            content: `🔄 ROUTING FAILED STORY BACK TO CODER

Story: "${nextStory.title}" (${nextStory.id})
Attempt: ${retryCount + 1} of ${MAX_RETRIES}

Previous failure: ${nextStory.result || 'Test failures detected'}`,
          });
        }

        nextStory.status = 'in_progress';
        nextStory.assignedTo = effectiveCoderId as AgentRole; // Use specific coder ID (coder-1, coder-2, etc.)
        (nextStory as any).workingAgent = effectiveCoderId; // CRITICAL: Set workingAgent early to prevent race conditions in start_story
        coderStoryAssignments.set(nextStory.id, effectiveCoderId);
        session.agentToStory.set(effectiveCoderId, nextStory.id); // Track for log filtering
        this.emit('task:updated', { ...nextStory, status: 'in_progress', assignedTo: effectiveCoderId });
        // Persist to file (fire-and-forget - in-memory coderStoryAssignments already prevents race conditions)
        this.storyFileManager.persistStoriesToFile(session).catch(err => console.error('[Multi-Agent] Failed to persist stories:', err));
        // Emit story:started for UI to move card and track agent
        this.emit('story:started', {
          storyId: nextStory.id,
          storyTitle: nextStory.title,
          agentId: effectiveCoderId,
          status: 'in_progress',
        });

        // Build context - add error details if this is a retry
        if (isFailedStory) {
          return `${storySummary}

⚠️ FIX REQUIRED - Story Previously Failed Tests ⚠️

Story: "${nextStory.title}" (ID: ${nextStory.id})
${nextStory.description}

PREVIOUS FAILURE (Attempt ${retryCount + 1}/${MAX_RETRIES}):
${nextStory.result || 'Tests failed - see error details above'}

INSTRUCTIONS:
1. Read the relevant files and understand what went wrong
2. Fix the issue causing the test failure
3. Make sure to run the tests yourself to verify (use run_command)
4. When fixed, call mark_ready_for_testing("${nextStory.id}")

Focus on fixing the specific issue - don't rewrite everything!`;
        }

        // Calculate unique port for this coder instance (4567-4571)
        const coderIndex = effectiveCoderId === 'coder-main' ? 0 : parseInt(effectiveCoderId.split('-')[1]) - 1;
        const coderPort = 4567 + coderIndex;

        // Get backlog stories for multi-story implementation
        // CRITICAL FIX: In parallel coder mode, only give ONE story to each coder
        // Previously, all coders got ALL remaining stories, causing overlapping work
        let backlogStories: typeof session.tasks;

        if (parallelCoders > 1) {
          // Parallel mode: each coder only gets their assigned story
          backlogStories = [nextStory];
          console.log(`[Multi-Agent] ${effectiveCoderId} assigned single story in parallel mode: ${nextStory.id}`);
        } else {
          // Single coder mode: give all remaining backlog stories for efficiency
          // CRITICAL: Filter by current iteration in iteration mode!
          const remainingBacklog = session.tasks.filter(t =>
            (t.status === 'backlog' || t.status === 'pending') &&
            !coderStoryAssignments.has(t.id) &&
            t.id !== nextStory.id &&
            isInCurrentBuild(t)
          );
          backlogStories = [nextStory, ...remainingBacklog];
        }

        // If there are multiple backlog stories (only in single-coder mode now), give all of them
        if (backlogStories.length > 1) {
          // Mark the first story as in_progress (nextStory was already assigned by getNextStoryForRole)
          nextStory.status = 'in_progress';
          nextStory.assignedTo = effectiveCoderId as AgentRole;
          (nextStory as any).workingAgent = effectiveCoderId; // Set workingAgent for consistency
          this.emit('task:updated', { ...nextStory, status: 'in_progress', assignedTo: effectiveCoderId });

          const storyList = backlogStories.map((s, i) => {
            const acList = (s as any).acceptanceCriteria?.length > 0
              ? `\n   Acceptance Criteria:\n${(s as any).acceptanceCriteria.map((ac: string, j: number) => `   ${j + 1}. ${ac}`).join('\n')}`
              : '';
            return `
STORY ${i + 1}: "${s.title}" (ID: ${s.id})${s.id === nextStory.id ? ' ← START HERE' : ''}
   ${s.description}${acList}`;
          }).join('\n');

          return `${storySummary}
${lockedFilesInfo}

${parallelCoders > 1 ? `You are ${effectiveCoderId}. Use port ${coderPort} when running npm run dev.\n` : ''}
=== IMPLEMENT ${backlogStories.length} STORIES IN BACKLOG ===
${storyList}

WORKFLOW FOR EACH STORY:
1. Call start_story("STORY_ID") - marks as in_progress
2. Implement the story
3. Call mark_ready_for_testing("STORY_ID") when done
4. Move to the next story immediately

⚠️ IMPORTANT: After completing all ${backlogStories.length} stories, re-read .agile-stories.json to check if new stories arrived in "backlog" status while you were working. Keep implementing until no more stories need coding!

START NOW with "${nextStory.title}" (${nextStory.id}).`;
        }

        // Single story fallback (when only one story in backlog)
        // CRITICAL: Different instructions for parallel vs single coder mode
        const afterCompletionInstructions = parallelCoders > 1
          ? `After completing this story, STOP and wait. The system will automatically assign you the next available story.`
          : `After completing this story, call list_tasks() to find more stories. For each new story: start_story("ID") → implement → mark_ready_for_testing("ID").`;

        return `${storySummary}

Story: "${nextStory.title}" (ID: ${nextStory.id})
${nextStory.description}
${lockedFilesInfo}

${parallelCoders > 1 ? `You are ${effectiveCoderId}. Use port ${coderPort} when running npm run dev.\n` : ''}
Implement this story, then call mark_ready_for_testing("${nextStory.id}").

${afterCompletionInstructions}`;
      } else if (role === 'tester') {
        const effectiveTesterId = coderId || 'tester-main'; // coderId param doubles as testerId

        // Check if this tester already has a claimed story (from getNextStoryForRole)
        const alreadyClaimedStoryId = testerToStoryMap.get(effectiveTesterId);
        if (alreadyClaimedStoryId) {
          const claimedStory = session.tasks.find(t => t.id === alreadyClaimedStoryId && t.status === 'testing');
          if (claimedStory) {
            // Use the already-claimed story
            const acceptanceCriteria = (claimedStory as any).acceptanceCriteria || [];
            const acList = acceptanceCriteria.length > 0
              ? `\n   Acceptance Criteria:\n${acceptanceCriteria.map((ac: string, j: number) => `   ${j + 1}. ${ac}`).join('\n')}`
              : '';
            return `${storySummary}

=== TEST 1 STORY IN TESTING STATUS ===

STORY 1: "${claimedStory.title}" (ID: ${claimedStory.id})
   ${claimedStory.description}${acList}

WORKFLOW FOR EACH STORY:
1. Write tests that verify the acceptance criteria
2. Run tests: npm test -- --coverage --passWithNoTests
3. Parse output for: total tests, passed count, failed count, coverage %
4. ⚠️ MANDATORY: Write results to .test-results-{story-id}.json in project root (per-story file):

{
  "task_id": "story-id-here",
  "task_title": "Story title here",
  "passed": true,
  "total_tests": 16,
  "passed_tests": 16,
  "failed_tests": 0,
  "summary": "All 16 tests passed with 25% coverage",
  "error_output": "",
  "coverage": 25
}

5. Update the story status in ${session.workingDirectory}/.agile-stories.json to "done"

After testing this story, STOP and wait. The system will automatically assign you the next available story.

⚠️ YOU MUST create .test-results-{story-id}.json after EVERY story - the UI dashboard monitors these files!`;
          }
        }

        // Get stories in testing status, EXCLUDING already-tested stories to prevent duplicates
        // CRITICAL: Filter by current iteration in iteration mode!
        const testingStories = session.tasks.filter(t =>
          t.status === 'testing' &&
          !testedStories.has(t.id) &&
          !testerStoryAssignments.has(t.id) &&
          isInCurrentBuild(t)
        );
        if (testingStories.length === 0) return '';

        // For parallel testers, assign ONE story per tester (like coders do)
        const parallelTestersCount = agentConfig?.quickSettings?.parallelTesters || 1;
        const storiesToAssign = parallelTestersCount > 1
          ? testingStories.slice(0, 1)  // One story per parallel tester
          : testingStories;              // All stories for single tester

        // Mark these stories as being tested AND assign to specific tester
        storiesToAssign.forEach(story => {
          testerStoryAssignments.set(story.id, effectiveTesterId); // Store WHICH tester, not just true
          // CRITICAL FIX: Update story's assignedTo to specific tester
          story.assignedTo = effectiveTesterId as AgentRole;
          (story as any).workingAgent = effectiveTesterId;
          this.emit('task:updated', story);
        });
        // Track which tester is testing the first story (for UI log filtering)
        if (storiesToAssign.length > 0) {
          testerToStoryMap.set(effectiveTesterId, storiesToAssign[0].id);
          session.agentToStory.set(effectiveTesterId, storiesToAssign[0].id); // Session-level tracking
          console.log(`[Multi-Agent] Batch: ${storiesToAssign.length} stories assigned to ${effectiveTesterId}`);
        }

        // Build a comprehensive story list for batch testing
        const storyList = storiesToAssign.map((story, i) => {
          const acceptanceCriteria = (story as any).acceptanceCriteria || [];
          const acList = acceptanceCriteria.length > 0
            ? `\n   Acceptance Criteria:\n${acceptanceCriteria.map((ac: string, j: number) => `   ${j + 1}. ${ac}`).join('\n')}`
            : '';
          return `
STORY ${i + 1}: "${story.title}" (ID: ${story.id})
   ${story.description}${acList}`;
        }).join('\n');

        return `${storySummary}

=== TEST ${storiesToAssign.length} STOR${storiesToAssign.length === 1 ? "Y" : "IES"} IN TESTING STATUS ===
${storyList}

WORKFLOW FOR EACH STORY:
1. Write tests that verify the acceptance criteria
2. Run tests: npm test -- --coverage --passWithNoTests
3. Parse output for: total tests, passed count, failed count, coverage %
4. ⚠️ MANDATORY: Write results to .test-results-{story-id}.json in project root (per-story file):

{
  "task_id": "story-id-here",
  "task_title": "Story title here",
  "passed": true,
  "total_tests": 16,
  "passed_tests": 16,
  "failed_tests": 0,
  "summary": "All 16 tests passed with 25% coverage",
  "error_output": "",
  "coverage": 25
}

5. Update the story status in ${session.workingDirectory}/.agile-stories.json to "done"

${parallelTestersCount > 1 ? 'After testing this story, STOP and wait. The system will automatically assign you the next available story.' : 'Test ALL ' + storiesToAssign.length + ' stories listed above. When complete, the coordinator will check for new stories automatically.'}

⚠️ YOU MUST create .test-results-{story-id}.json after EVERY story - the UI dashboard monitors these files!`;
      }
      return '';
    };

    // Track pending .next() calls for each generator
    const pendingNextCalls = new Map<AgentRole | string, Promise<IteratorResult<AgentMessage, any>> | null>();

    // Phase tracking for automatic checkpointing
    let lastCheckpointPhase: SessionCheckpoint['phase'] = 'product_owner';
    let lastCheckpointTime = 0;
    const CHECKPOINT_COOLDOWN = 30000; // Don't save checkpoints more than every 30 seconds

    // Determine current phase based on session state
    const getCurrentPhase = (): SessionCheckpoint['phase'] => {
      const hasStories = session.tasks.length > 0;
      const allStoriesCoded = session.tasks.length > 0 && session.tasks.every(t =>
        t.status !== 'backlog' && t.status !== 'pending'
      );
      const allStoriesTested = session.tasks.length > 0 && session.tasks.every(t =>
        t.status === 'done' || t.status === 'completed' || t.status === 'failed'
      );

      if (!hasStories) return 'product_owner';
      if (!allStoriesCoded) return 'coder';
      if (!allStoriesTested) return 'tester';
      return 'security';
    };

    // Get list of completed agents for checkpoint
    const getCompletedAgents = (phase: SessionCheckpoint['phase']): AgentRole[] => {
      const completedList: AgentRole[] = [];
      if (phase !== 'product_owner') completedList.push('product_owner');
      if (phase === 'tester' || phase === 'security' || phase === 'complete') completedList.push('coder');
      if (phase === 'security' || phase === 'complete') completedList.push('tester');
      if (phase === 'complete') completedList.push('security');
      return completedList;
    };

    // Continue until workflow is complete (stories done AND security finished)
    while (!workflowComplete() && iterationCount < maxIterations) {
      iterationCount++;
      const now = Date.now();

      // Sync stories from file FREQUENTLY during startup phase (first 30 seconds)
      // This ensures coders see stories as soon as PO creates them
      const isStartupPhase = (now - startTime) < 30000;
      if (isStartupPhase || iterationCount % 20 === 0) { // Every ~10 seconds normally, every poll during startup
        const storiesFile = path.join(session.workingDirectory, '.agile-stories.json');
        await this.storyFileManager.syncStoriesFromFile(session, storiesFile, 'coordinator', 'Coordinator');
      }

      // Check if any delayed agents should start
      for (const delayed of delayedAgentTimers) {
        const timerKey = delayed.coderId || delayed.role;
        const isCoderTimer = delayed.role === 'coder' && delayed.coderId;

        // Skip if already started (check both general started set and parallel coder set)
        if (isCoderTimer) {
          if (parallelCoderGenerators.has(delayed.coderId!) || completedCoders.has(delayed.coderId!)) continue;
        } else {
          if (started.has(delayed.role)) continue;
        }

        if (now >= delayed.startTime) {
          if (isCoderTimer) {
            // Start parallel coder instance
            const coderId = delayed.coderId!;
            const freshContext = getFreshContext('coder', coderId);
            if (freshContext) {
              pendingNextCalls.delete(coderId); // Clear any pending call
              const currentStoryId = getStoryIdForCoder(coderId);
              parallelCoderGenerators.set(coderId, this.runAgent('coder', session, freshContext, coderId, agentConfig, currentStoryId));
              yield {
                id: `msg-${this.generateId()}`,
                agentRole: 'coordinator',
                agentName: 'Coordinator',
                type: 'chat',
                content: `Coder ${coderId} starting...`,
                timestamp: new Date(),
              };
            }
          } else {
            // Start regular agent
            started.add(delayed.role);
            pendingNextCalls.delete(delayed.role); // Clear any pending call
            generators.set(delayed.role, this.runAgent(delayed.role, session, delayed.context, undefined, agentConfig));
            yield {
              id: `msg-${this.generateId()}`,
              agentRole: 'coordinator',
              agentName: 'Coordinator',
              type: 'chat',
              content: `${delayed.role === 'tester' ? 'Tester' : delayed.role === 'security' ? 'Security' : delayed.role} agent starting...`,
              timestamp: new Date(),
            };
          }
        }
      }

      // Dynamic tester launch: Start testers EARLY to set up test infrastructure
      // Testers start as soon as foundation is complete (or first story starts) so they can:
      // 1. Install testing dependencies
      // 2. Create jest.config.js, jest.setup.js
      // 3. Create test utilities
      // Then when stories arrive for testing, they can write tests FAST!
      // PARALLEL TESTERS: Like coders, we spawn multiple tester instances (tester-1, tester-2, etc.)
      if (shouldRunTester && !completed.has('tester')) {
        // STALE ASSIGNMENT CLEANUP: Clear assignments for testers that are no longer active
        // This happens when a tester crashes or exits unexpectedly without cleaning up
        for (const [storyId, testerId] of testerStoryAssignments.entries()) {
          const isActive = parallelTesterGenerators.has(testerId);
          const isWaiting = waitingTesters.has(testerId);
          const isCompleted = completedTesters.has(testerId);

          // If tester is not active, not waiting, and not completed - it's gone/crashed
          if (!isActive && !isWaiting && !isCompleted) {
            console.log(`[Multi-Agent] STALE TESTER ASSIGNMENT: ${testerId} -> ${storyId} - tester no longer exists, clearing assignment`);
            testerStoryAssignments.delete(storyId);
            testerToStoryMap.delete(testerId);
            session.agentToStory.delete(testerId);

            // Also reset the story's assignedTo so it can be picked up
            const story = session.tasks.find(t => t.id === storyId);
            if (story && story.assignedTo === testerId) {
              story.assignedTo = 'tester' as AgentRole; // Reset to generic tester
              this.emit('task:updated', story);
            }
          }
        }

        // Count all testing stories (including assigned) for tester scaling
        const allTestingStories = session.tasks.filter(t =>
          t.status === 'testing' &&
          !testedStories.has(t.id)
        );
        // Also track unassigned for debug purposes
        const unassignedTestingStories = allTestingStories.filter(t => !testerStoryAssignments.has(t.id));
        const hasInProgressStories = session.tasks.some(t => t.status === 'in_progress');
        // Start tester early if foundation is complete or stories are in progress
        const shouldStartEarly = foundationComplete || (session.tasks.length > 0 && hasInProgressStories);

        if (allTestingStories.length > 0 || shouldStartEarly) {
          // Determine how many testers to launch based on UNASSIGNED testing stories (not total)
          // This prevents launching testers that won't get any work
          const testersNeeded = Math.min(parallelTestersCount, Math.max(1, unassignedTestingStories.length));
          const activeTesters = Array.from(parallelTesterGenerators.keys()).filter(id => !completedTesters.has(id) && !waitingTesters.has(id));
          console.log(`[Multi-Agent] TESTER CHECK: allTestingStories=${allTestingStories.length}, unassigned=${unassignedTestingStories.length}, testersNeeded=${testersNeeded}, activeTesters=${activeTesters.length} [${activeTesters.join(',')}], waitingTesters=${waitingTesters.size}, completedTesters=${completedTesters.size}, parallelTestersCount=${parallelTestersCount}`);

          // Reactivate waiting testers if there are unassigned stories to test
          // Don't limit by testersNeeded - if there's work and waiting testers, reactivate them
          if (unassignedTestingStories.length > 0 && waitingTesters.size > 0) {
            let reactivatedCount = 0;
            for (const waitingTesterId of waitingTesters) {
              // Stop if we've reactivated enough testers for the unassigned work
              if (reactivatedCount >= unassignedTestingStories.length) break;

              const freshContext = getFreshContext('tester', waitingTesterId);
              if (freshContext) {
                console.log(`[Multi-Agent] TESTER REACTIVATE: ${waitingTesterId} resuming - ${unassignedTestingStories.length} unassigned stories ready`);
                waitingTesters.delete(waitingTesterId);
                pendingNextCalls.delete(waitingTesterId);
                const currentStoryId = getStoryIdForTester(waitingTesterId);
                parallelTesterGenerators.set(waitingTesterId, this.runAgent('tester', session, freshContext, waitingTesterId, agentConfig, currentStoryId));
                reactivatedCount++;
                yield {
                  id: `msg-${this.generateId()}`,
                  agentRole: 'coordinator',
                  agentName: 'Coordinator',
                  type: 'chat',
                  content: `🧪 ${waitingTesterId} resuming - ${unassignedTestingStories.length} story/stories ready for testing`,
                  timestamp: new Date(),
                };
              }
            }
          }

          // Launch additional testers if needed
          console.log(`[Multi-Agent] TESTER LAUNCH LOOP: testersNeeded=${testersNeeded}, testerStoryAssignments=${JSON.stringify(Array.from(testerStoryAssignments.entries()))}`);
          for (let i = 1; i <= testersNeeded; i++) {
            const testerId = parallelTestersCount > 1 ? `tester-${i}` : 'tester';

            // Skip if this tester is already running, completed, or waiting for work
            const inGenerators = parallelTesterGenerators.has(testerId);
            const isCompleted = completedTesters.has(testerId);
            const isWaiting = waitingTesters.has(testerId);
            if (inGenerators || isCompleted || isWaiting) {
              console.log(`[Multi-Agent] TESTER SKIP: ${testerId} - inGenerators=${inGenerators}, isCompleted=${isCompleted}, isWaiting=${isWaiting}`);
              continue;
            }

            const reason = allTestingStories.length > 0
              ? `${allTestingStories.length} story/stories ready for testing (${unassignedTestingStories.length} unassigned)`
              : 'Setting up test infrastructure early while coders work';

            console.log(`[Multi-Agent] TESTER LAUNCH: Starting ${testerId} - ${reason}`);

            // First tester sets up infrastructure, others just test
            const testerSetupContext = i === 1 ? `
PHASE 1: SET UP TEST INFRASTRUCTURE NOW!
The coders are working on stories. Set up testing dependencies and configs so you can write tests FAST when stories arrive.

After setup is complete, wait for stories to reach "testing" status, then test them.` : `
You are ${testerId}. Focus on testing stories in "testing" status.
Another tester is handling infrastructure setup. Pick a story and start testing.`;

            const freshContext = allTestingStories.length > 0 ? getFreshContext('tester', testerId) : testerSetupContext;
            if (freshContext) {
              console.log(`[Multi-Agent] TESTER LAUNCH: Adding ${testerId} to parallel tester generators`);
              started.add('tester'); // Mark tester role as started
              pendingNextCalls.delete(testerId); // Clear any pending call
              const currentStoryId = getStoryIdForTester(testerId);
              parallelTesterGenerators.set(testerId, this.runAgent('tester', session, freshContext, testerId, agentConfig, currentStoryId));
              yield {
                id: `msg-${this.generateId()}`,
                agentRole: 'coordinator',
                agentName: 'Coordinator',
                type: 'chat',
                content: `🧪 ${testerId} starting - ${reason}${parallelTestersCount > 1 ? ` (${activeTesters.length + 1}/${parallelTestersCount} testers)` : ''}`,
                timestamp: new Date(),
              };
            }
          }
        } else if (!testerWaitingLogged && session.tasks.length > 0) {
          // Log that we're waiting for stories to be ready
          testerWaitingLogged = true;
          yield {
            id: `msg-${this.generateId()}`,
            agentRole: 'coordinator',
            agentName: 'Coordinator',
            type: 'thinking',
            content: 'Tester waiting for foundation to complete before setting up test infrastructure...',
            timestamp: new Date(),
          };
        }
      }

      // Dynamic coder relaunch: Restart coder if it stopped but new backlog stories exist
      // This handles the case where PO creates stories AFTER coder has finished looking for work
      // CRITICAL: In parallel coder mode, parallel coders are tracked in parallelCoderGenerators, NOT in started set
      // So we must also check parallelCoderGenerators to avoid launching base 'coder' alongside 'coder-1', 'coder-2', etc.
      const shouldRunCoder = agentsToRun.includes('coder');
      const hasAnyActiveCoders = started.has('coder') || parallelCoderGenerators.size > 0 || completedCoders.size > 0;
      if (shouldRunCoder && !hasAnyActiveCoders && !completed.has('coder')) {
        // CRITICAL: Filter by current iteration in iteration mode!
        const backlogStories = session.tasks.filter(t =>
          (t.status === 'backlog' || t.status === 'pending') && isInCurrentBuild(t)
        );
        if (backlogStories.length > 0) {
          // Prevent infinite relaunch loops
          if (coderRelaunchCount >= MAX_CODER_RELAUNCHES) {
            console.log(`[Multi-Agent] ⚠️ CODER RELAUNCH LIMIT REACHED (${MAX_CODER_RELAUNCHES}) - ${backlogStories.length} stories still in backlog`);
            // Mark coder as completed to stop further attempts
            completed.add('coder');
            yield {
              id: `msg-${this.generateId()}`,
              agentRole: 'coordinator',
              agentName: 'Coordinator',
              type: 'chat',
              content: `⚠️ Coder relaunch limit reached. ${backlogStories.length} stories remain in backlog: ${backlogStories.map(s => s.title).join(', ')}`,
              timestamp: new Date(),
            };
          } else {
            coderRelaunchCount++;
            console.log(`[Multi-Agent] CODER RELAUNCH ${coderRelaunchCount}/${MAX_CODER_RELAUNCHES}: ${backlogStories.length} backlog stories found`);
            const freshContext = getFreshContext('coder');
            if (freshContext) {
              started.add('coder');
              pendingNextCalls.delete('coder');
              const currentStoryId = getStoryIdForCoder('coder-main');
              generators.set('coder', this.runAgent('coder', session, freshContext, undefined, agentConfig, currentStoryId));
              yield {
                id: `msg-${this.generateId()}`,
                agentRole: 'coordinator',
                agentName: 'Coordinator',
                type: 'chat',
                content: `💻 Coder agent restarting (attempt ${coderRelaunchCount}/${MAX_CODER_RELAUNCHES}) - ${backlogStories.length} backlog stories to implement`,
                timestamp: new Date(),
              };
            }
          }
        }
      }

      // Reactivate waiting parallel coders when backlog or orphaned in_progress stories exist
      if (shouldRunCoder && waitingCoders.size > 0) {
        // CRITICAL: Filter by current iteration in iteration mode!
        const backlogStories = session.tasks.filter(t =>
          (t.status === 'backlog' || t.status === 'pending') && isInCurrentBuild(t)
        );
        // Also check for orphaned in_progress stories (no active coder assigned)
        const orphanedStories = session.tasks.filter(t => {
          if (t.status !== 'in_progress') return false;
          if (!isInCurrentBuild(t)) return false; // Only current iteration
          const assignedCoder = coderStoryAssignments.get(t.id);
          if (!assignedCoder) return true;
          return !isCoderActive(assignedCoder);
        });
        const availableWork = backlogStories.length + orphanedStories.length;
        if (availableWork > 0) {
          const activeCoders = Array.from(parallelCoderGenerators.keys()).filter(id => !completedCoders.has(id) && !waitingCoders.has(id));
          const { parallelCoders } = session.coderConfig;
          const codersNeeded = Math.min(parallelCoders, availableWork);

          for (const waitingCoderId of waitingCoders) {
            if (activeCoders.length >= codersNeeded) break;

            const freshContext = getFreshContext('coder', waitingCoderId);
            if (freshContext) {
              const reason = orphanedStories.length > 0
                ? `${orphanedStories.length} orphaned + ${backlogStories.length} backlog stories`
                : `${backlogStories.length} backlog stories`;
              console.log(`[Multi-Agent] CODER REACTIVATE: ${waitingCoderId} resuming - ${reason}`);
              waitingCoders.delete(waitingCoderId);
              pendingNextCalls.delete(waitingCoderId);
              const currentStoryId = getStoryIdForCoder(waitingCoderId);
              parallelCoderGenerators.set(waitingCoderId, this.runAgent('coder', session, freshContext, waitingCoderId, agentConfig, currentStoryId));
              activeCoders.push(waitingCoderId);
              yield {
                id: `msg-${this.generateId()}`,
                agentRole: 'coordinator',
                agentName: 'Coordinator',
                type: 'chat',
                content: `💻 ${waitingCoderId} resuming - ${reason}`,
                timestamp: new Date(),
              };
            }
          }
        }
      }

      // FOUNDATION-FIRST: Detect when foundation story completes
      // Works for both single-coder and parallel modes - enables early preview
      if (!foundationComplete) {
        // Find foundation story if not already identified
        if (!foundationStoryId) {
          const foundationStory = session.tasks.find(t => isFoundationStory(t));
          if (foundationStory) {
            foundationStoryId = foundationStory.id;
            console.log(`[Multi-Agent] 🏗️ Foundation story identified: "${foundationStory.title}" (${foundationStory.id})`);
          }
        }

        // Check if foundation story has moved to testing or done
        if (foundationStoryId) {
          const foundationStory = session.tasks.find(t => t.id === foundationStoryId);
          if (foundationStory && (foundationStory.status === 'testing' || foundationStory.status === 'done' || foundationStory.status === 'completed')) {
            foundationComplete = true;
            console.log(`[Multi-Agent] ✅ FOUNDATION COMPLETE! "${foundationStory.title}" moved to ${foundationStory.status}`);

            // Emit foundation:complete event for UI to enable early preview
            this.emit('foundation:complete', {
              storyId: foundationStory.id,
              storyTitle: foundationStory.title,
              status: foundationStory.status,
            });

            // For parallel coders mode, spawn additional coders now!
            const { parallelCoders } = session.coderConfig;
            if (parallelCoders > 1) {
              yield {
                id: `msg-${this.generateId()}`,
                agentRole: 'coordinator',
                agentName: 'Coordinator',
                type: 'chat',
                content: `🚀 Foundation complete! Spawning ${parallelCoders - 1} additional coder(s) for parallel work...`,
                timestamp: new Date(),
              };

              // Add delayed timers for additional coders (staggered by 1 second each)
              for (let i = 1; i < parallelCoders; i++) {
                const coderId = `coder-${i + 1}`;
                if (!parallelCoderGenerators.has(coderId) && !completedCoders.has(coderId)) {
                  const staggerTime = now + (i * 1000); // Stagger by 1 second each
                  delayedAgentTimers.push({ role: 'coder', context: coderContext, startTime: staggerTime, coderId });
                  console.log(`[Multi-Agent] Queued ${coderId} to start in ${i} second(s)`);
                }
              }
            } else {
              // Single coder mode - just announce foundation complete
              yield {
                id: `msg-${this.generateId()}`,
                agentRole: 'coordinator',
                agentName: 'Coordinator',
                type: 'chat',
                content: `🏗️ Foundation complete! Preview is now available.`,
                timestamp: new Date(),
              };
            }
          }
        }
      }

      // DISABLED: Automatic security launch
      // Security scan is now manual-only - triggered via "Run Security Scan" button in Security tab
      // This prevents security agent from running during active development and gives user control

      // Emit periodic status updates (every 10 seconds)
      if (now - lastStatusUpdate > 10000) {
        const activeAgents = Array.from(started).filter(r => !completed.has(r));
        const activeCoders = Array.from(parallelCoderGenerators.keys()).filter(id => !completedCoders.has(id));
        const activeTesters = Array.from(parallelTesterGenerators.keys()).filter(id => !completedTesters.has(id));
        const storyStatus = session.tasks.map(t => `${t.id}: ${t.status}`).join(', ');
        const coderInfo = activeCoders.length > 0 ? ` | Coders: ${activeCoders.join(', ')}` : '';
        const testerInfo = activeTesters.length > 0 ? ` | Testers: ${activeTesters.join(', ')}` : '';

        // Show special message when security is running after stories are done
        const storiesAllDone = allStoriesDone();
        const securityRunning = started.has('security') && !completed.has('security');

        if (storiesAllDone && securityRunning) {
          yield {
            id: `msg-${this.generateId()}`,
            agentRole: 'coordinator',
            agentName: 'Coordinator',
            type: 'thinking',
            content: `🔒 All stories complete - Security scan in progress... (waiting for SOC 2/NIST compliance report)`,
            timestamp: new Date(),
          };
        } else {
          yield {
            id: `msg-${this.generateId()}`,
            agentRole: 'coordinator',
            agentName: 'Coordinator',
            type: 'thinking',
            content: `Active: ${activeAgents.join(', ')}${coderInfo}${testerInfo} | Stories: ${storyStatus}`,
            timestamp: new Date(),
          };
        }
        lastStatusUpdate = now;

        // Periodically sync stories from file (in case PO wrote new stories)
        const storiesFile = path.join(session.workingDirectory, '.agile-stories.json');
        await this.storyFileManager.syncStoriesFromFile(session, storiesFile, 'coordinator', 'Coordinator');

        // Automatic checkpointing on phase transitions
        const currentPhase = getCurrentPhase();
        if (currentPhase !== lastCheckpointPhase && (now - lastCheckpointTime) > CHECKPOINT_COOLDOWN) {
          try {
            await this.checkpointManager.saveCheckpoint(
              session,
              currentPhase,
              getCompletedAgents(currentPhase),
              requirements,
              agentsToRun
            );
            lastCheckpointPhase = currentPhase;
            lastCheckpointTime = now;
            yield {
              id: `msg-${this.generateId()}`,
              agentRole: 'coordinator',
              agentName: 'Coordinator',
              type: 'thinking',
              content: `💾 Checkpoint saved (phase: ${currentPhase})`,
              timestamp: new Date(),
            };
          } catch (err) {
            console.error('[MultiAgentService] Checkpoint save failed:', err);
          }
        }

        // Check for orphaned stories: assigned to agents that no longer have active generators
        // CRITICAL: Include ALL agent types - coders, testers, and waiting agents
        const allActiveGenerators = new Set<string>([
          ...Array.from(generators.keys()).map(k => String(k)).filter(r => !completed.has(r as AgentRole)),
          ...Array.from(parallelCoderGenerators.keys()).filter(id => !completedCoders.has(id)),
          ...Array.from(parallelTesterGenerators.keys()).filter(id => !completedTesters.has(id)),
          // Also include waiting agents - they're not abandoned, just waiting for work
          ...Array.from(waitingCoders),
          ...Array.from(waitingTesters),
        ]);

        for (const story of session.tasks) {
          // Only check in_progress stories for orphaned coders
          // Testing stories should NOT be returned to backlog - they need testing, not coding
          if (story.status === 'in_progress' && story.assignedTo) {
            const agentExists = allActiveGenerators.has(story.assignedTo) ||
                               allActiveGenerators.has(story.assignedTo.replace(/-\d+$/, '')); // coder-1 -> coder

            if (!agentExists) {
              // This story is orphaned - return to backlog for another coder
              const oldStatus = story.status;
              story.status = 'backlog';
              story.assignedTo = undefined;
              this.emit('task:updated', { ...story, status: 'backlog', assignedTo: undefined });
              yield {
                id: `msg-${this.generateId()}`,
                agentRole: 'coordinator',
                agentName: 'Coordinator',
                type: 'chat',
                content: `🔄 Returning orphaned "${story.title}" to backlog (was ${oldStatus}, agent gone)`,
                timestamp: new Date(),
              };
            }
          }
          // Note: testing stories with orphaned testers will be picked up by tester reactivation logic
        }
      }

      // Poll each generator
      for (const [role, gen] of generators) {
        if (completed.has(role)) continue;

        try {
          // Start a new .next() call if we don't have one pending
          if (!pendingNextCalls.has(role)) {
            console.log(`[Multi-Agent] Starting .next() call for ${role}...`);
            pendingNextCalls.set(role, gen.next());
          }

          const pendingPromise = pendingNextCalls.get(role)!;
          const result = await Promise.race([
            pendingPromise,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), pollInterval)),
          ]);

          if (result === null) {
            // Timeout - continue polling without clearing the pending call
            console.log(`[Multi-Agent] Poll timeout for ${role} (still waiting for .next() to resolve)`);
            continue;
          }

          // Got a result - clear the pending call so we can start a new one next iteration
          pendingNextCalls.delete(role);
          console.log(`[Multi-Agent] Poll result for ${role}:`, result.done ? 'done' : 'has value');

          if (result && typeof result === 'object' && 'done' in result) {
            if (result.done) {
              // If coder finished, auto-move in_progress stories to testing
              // IMPORTANT: Only do this for the base "coder" role when parallel coders are NOT active
              // Parallel coders (coder-1, coder-2, etc.) have their own handler below that correctly
              // only moves stories owned by that specific coder
              if (role === 'coder' && parallelCoderGenerators.size === 0) {
                for (const task of session.tasks) {
                  // Only move stories assigned to base "coder" role, not parallel coders
                  if (task.status === 'in_progress' && task.assignedTo === 'coder') {
                    task.status = 'testing';
                    task.assignedTo = 'tester';
                    this.emit('task:updated', { ...task, status: 'testing', assignedTo: 'tester' });
                    yield {
                      id: `msg-${this.generateId()}`,
                      agentRole: 'coordinator',
                      agentName: 'Coordinator',
                      type: 'chat',
                      content: `📤 Auto-moving "${task.title}" to testing (coder finished)`,
                      timestamp: new Date(),
                    };
                  }
                }
              }

              // Agent finished - check if there's more work for them
              // CRITICAL: Use hasWorkForRole (non-mutating) instead of getNextStoryForRole
              const hasMoreWork = hasWorkForRole(role);

              if (hasMoreWork && !allStoriesDone()) {
                // Restart agent with fresh context for next story
                const freshContext = getFreshContext(role);
                if (freshContext) {
                  yield {
                    id: `msg-${this.generateId()}`,
                    agentRole: 'coordinator',
                    agentName: 'Coordinator',
                    type: 'chat',
                    content: `${role.charAt(0).toUpperCase() + role.slice(1)} has more stories - continuing...`,
                    timestamp: new Date(),
                  };
                  pendingNextCalls.delete(role); // Clear pending call for fresh generator
                  generators.set(role, this.runAgent(role, session, freshContext, undefined, agentConfig));
                } else {
                  completed.add(role);
                }
              } else if ((role === 'tester' || role === 'coder') && !allStoriesDone()) {
                // Special case: Tester and Coder might not have work NOW but could get work later
                // when PO creates more stories or coder finishes more stories.
                // Don't mark as completed - just remove from generators and let the dynamic launch logic handle it.
                generators.delete(role);
                pendingNextCalls.delete(role); // Clear pending call
                started.delete(role); // Allow re-launch
                yield {
                  id: `msg-${this.generateId()}`,
                  agentRole: 'coordinator',
                  agentName: 'Coordinator',
                  type: 'thinking',
                  content: `${role.charAt(0).toUpperCase() + role.slice(1)} finished current work, waiting for more stories...`,
                  timestamp: new Date(),
                };
              } else {
                completed.add(role);
                yield {
                  id: `msg-${this.generateId()}`,
                  agentRole: 'coordinator',
                  agentName: 'Coordinator',
                  type: 'chat',
                  content: `${role.charAt(0).toUpperCase() + role.slice(1)} agent completed all tasks.`,
                  timestamp: new Date(),
                };
              }
            } else if (result.value) {
              if (role === 'tester') {
                console.log(`[Multi-Agent] TESTER yielding message:`, result.value.type, result.value.content?.substring(0, 50));
              }
              yield result.value;
            }
          }
        } catch (error) {
          console.error(`[Multi-Agent] Agent ${role} crashed:`, error);

          // CRITICAL: Reset any story this agent was working on back to backlog
          const stuckStory = session.tasks.find(t =>
            t.status === 'in_progress' &&
            (t.workingAgent === role || t.assignedTo === role)
          );
          if (stuckStory) {
            console.log(`[Multi-Agent] 🔄 Resetting stuck story "${stuckStory.title}" from crashed agent ${role}`);
            stuckStory.status = 'backlog';
            stuckStory.workingAgent = null;
            this.emit('task:updated', stuckStory);
            this.persistStoriesToFile(session).catch(err => {
              console.error('[Multi-Agent] Failed to persist reset story:', err);
            });
          }

          // On error, check if agent should restart
          // CRITICAL: Use hasWorkForRole (non-mutating) instead of getNextStoryForRole
          const hasMoreWork = hasWorkForRole(role);
          if (hasMoreWork && !allStoriesDone()) {
            const freshContext = getFreshContext(role);
            if (freshContext) {
              pendingNextCalls.delete(role); // Clear pending call
              generators.set(role, this.runAgent(role, session, freshContext, undefined, agentConfig));
            } else {
              completed.add(role);
            }
          } else if (role === 'tester' && !allStoriesDone()) {
            // Don't complete tester on error if there's still work pending
            generators.delete(role);
            pendingNextCalls.delete(role); // Clear pending call
            started.delete(role);
          } else {
            completed.add(role);
          }
        }
      }

      // Poll parallel coder generators
      for (const [coderId, gen] of parallelCoderGenerators) {
        if (completedCoders.has(coderId)) continue;

        try {
          // Start a new .next() call if we don't have one pending
          if (!pendingNextCalls.has(coderId)) {
            console.log(`[Multi-Agent] Starting .next() call for ${coderId}...`);
            pendingNextCalls.set(coderId, gen.next());
          }

          const pendingPromise = pendingNextCalls.get(coderId)!;
          const result = await Promise.race([
            pendingPromise,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), pollInterval)),
          ]);

          if (result === null) {
            // Timeout - continue polling without clearing the pending call
            continue;
          }

          // Got a result - clear the pending call
          pendingNextCalls.delete(coderId);

          if (result && typeof result === 'object' && 'done' in result) {
            if (result.done) {
              // This coder finished - release its story assignment and file locks
              releaseFileLocks(coderId);

              // Auto-move any in_progress stories to testing if coder forgot to call mark_ready_for_testing
              let storiesAutoMoved = false;
              for (const [storyId, owner] of coderStoryAssignments.entries()) {
                if (owner === coderId) {
                  const story = session.tasks.find(t => t.id === storyId);
                  if (story && story.status === 'in_progress') {
                    story.status = 'testing';
                    story.assignedTo = 'tester';
                    storiesAutoMoved = true;
                    console.log(`[Multi-Agent] Auto-moving story ${storyId} to testing (coder ${coderId} finished)`);
                    this.emit('task:updated', { ...story, status: 'testing', assignedTo: 'tester' });
                    yield {
                      id: `msg-${this.generateId()}`,
                      agentRole: 'coordinator',
                      agentName: 'Coordinator',
                      type: 'chat',
                      content: `📤 Auto-moving "${story.title}" to testing (coder ${coderId} finished)`,
                      timestamp: new Date(),
                    };
                  }
                  coderStoryAssignments.delete(storyId);
                }
              }
              // CRITICAL: Persist status changes to file immediately to prevent sync from reverting
              if (storiesAutoMoved) {
                await this.storyFileManager.persistStoriesToFile(session).catch(err =>
                  console.error('[Multi-Agent] Failed to persist auto-moved stories:', err)
                );
              }

              // Check if there's more work WITHOUT assigning (getNextStoryForRole would assign and then getFreshContext would get nothing)
              // CRITICAL: Must filter by current iteration in iteration mode!
              const inProgressIds = new Set(coderStoryAssignments.keys());
              const hasMoreWork = session.tasks.some(t =>
                (t.status === 'backlog' || t.status === 'pending' || t.status === 'failed') &&
                !inProgressIds.has(t.id) &&
                areDependenciesComplete(t) &&
                isInCurrentBuild(t)
              );

              if (hasMoreWork && !allStoriesDone()) {
                const freshContext = getFreshContext('coder', coderId);
                if (freshContext) {
                  yield {
                    id: `msg-${this.generateId()}`,
                    agentRole: 'coordinator',
                    agentName: 'Coordinator',
                    type: 'chat',
                    content: `Coder ${coderId} picking up next story...`,
                    timestamp: new Date(),
                  };
                  pendingNextCalls.delete(coderId); // Clear pending call
                  const currentStoryId = getStoryIdForCoder(coderId);
                  parallelCoderGenerators.set(coderId, this.runAgent('coder', session, freshContext, coderId, agentConfig, currentStoryId));
                } else {
                  releaseCoderStoryAssignments(coderId); // Release assignments
                  completedCoders.add(coderId);
                }
              } else if (!allStoriesDone()) {
                // No immediate work but stories not done - coder might get work later from PO
                parallelCoderGenerators.delete(coderId);
                pendingNextCalls.delete(coderId);
                releaseCoderStoryAssignments(coderId); // Release assignments so stories can be picked up
                waitingCoders.add(coderId); // Mark as waiting to prevent immediate relaunch
                console.log(`[Multi-Agent] ${coderId} waiting - released story assignments`);
                yield {
                  id: `msg-${this.generateId()}`,
                  agentRole: 'coordinator',
                  agentName: 'Coordinator',
                  type: 'thinking',
                  content: `${coderId} finished current work, waiting for more stories...`,
                  timestamp: new Date(),
                };
              } else {
                releaseCoderStoryAssignments(coderId); // Release assignments
                completedCoders.add(coderId);
                yield {
                  id: `msg-${this.generateId()}`,
                  agentRole: 'coordinator',
                  agentName: 'Coordinator',
                  type: 'chat',
                  content: `Coder ${coderId} completed all tasks.`,
                  timestamp: new Date(),
                };
              }
            } else if (result.value) {
              // Modify message to include coder ID for parallel coders
              const msg = result.value;
              if (session.coderConfig.parallelCoders > 1 && msg.agentRole === 'coder') {
                msg.agentName = `Coder ${coderId}`;
                msg.instanceNumber = parseInt(coderId, 10); // Set instance number for UI display
              }
              yield msg;
            }
          }
        } catch (error) {
          console.error(`[Multi-Agent] Parallel coder ${coderId} crashed:`, error);

          // CRITICAL: Reset any story this coder was working on back to backlog
          const stuckStory = session.tasks.find(t =>
            t.status === 'in_progress' &&
            (t.workingAgent === coderId || t.assignedTo === coderId)
          );
          if (stuckStory) {
            console.log(`[Multi-Agent] 🔄 Resetting stuck story "${stuckStory.title}" from crashed coder ${coderId}`);
            stuckStory.status = 'backlog';
            stuckStory.workingAgent = null;
            this.emit('task:updated', stuckStory);
            this.persistStoriesToFile(session).catch(err => {
              console.error('[Multi-Agent] Failed to persist reset story:', err);
            });
          }

          releaseFileLocks(coderId);
          pendingNextCalls.delete(coderId); // Clear pending call on error
          // CRITICAL: Use hasWorkForRole (non-mutating) instead of getNextStoryForRole
          // Previously this was picking up a story just to check, then getFreshContext picked up ANOTHER
          const hasMoreWork = hasWorkForRole('coder', coderId);
          if (hasMoreWork && !allStoriesDone()) {
            const freshContext = getFreshContext('coder', coderId);
            if (freshContext) {
              const currentStoryId = getStoryIdForCoder(coderId);
              parallelCoderGenerators.set(coderId, this.runAgent('coder', session, freshContext, coderId, agentConfig, currentStoryId));
            } else {
              releaseCoderStoryAssignments(coderId); // Release assignments
              completedCoders.add(coderId);
            }
          } else if (!allStoriesDone()) {
            // No immediate work but stories not done - wait for more work
            parallelCoderGenerators.delete(coderId);
            releaseCoderStoryAssignments(coderId); // Release story assignments so other coders can pick them up
            waitingCoders.add(coderId);
            console.log(`[Multi-Agent] ${coderId} waiting - released story assignments`);
          } else {
            releaseCoderStoryAssignments(coderId); // Release story assignments
            completedCoders.add(coderId);
          }
        }
      }

      // Poll parallel tester generators (like coders)
      for (const [testerId, gen] of parallelTesterGenerators) {
        if (completedTesters.has(testerId)) continue;

        try {
          // Start a new .next() call if we don't have one pending
          if (!pendingNextCalls.has(testerId)) {
            console.log(`[Multi-Agent] Starting .next() call for ${testerId}...`);
            pendingNextCalls.set(testerId, gen.next());
          }

          const pendingPromise = pendingNextCalls.get(testerId)!;
          const result = await Promise.race([
            pendingPromise,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), pollInterval)),
          ]);

          if (result === null) {
            // Timeout - continue polling without clearing the pending call
            continue;
          }

          // Got a result - clear the pending call
          pendingNextCalls.delete(testerId);

          if (result && typeof result === 'object' && 'done' in result) {
            if (result.done) {
              // Auto-move any testing stories to done if tester finished successfully
              // Tester generator completing (not erroring) = tester finished its work
              let testerStoryId = testerToStoryMap.get(testerId);

              // FALLBACK: If testerToStoryMap doesn't have the mapping, search by assignedTo
              if (!testerStoryId) {
                const assignedStory = session.tasks.find(t =>
                  t.status === 'testing' &&
                  String(t.assignedTo) === testerId
                );
                if (assignedStory) {
                  testerStoryId = assignedStory.id;
                  console.log(`[Multi-Agent] Found story ${testerStoryId} via assignedTo fallback for ${testerId}`);
                }
              }

              if (testerStoryId) {
                // First, sync from file in case tester already updated status
                const storiesFile = path.join(session.workingDirectory, '.agile-stories.json');
                await this.storyFileManager.syncStoriesFromFile(session, storiesFile, 'tester', 'Tester', testerId);

                const story = session.tasks.find(t => t.id === testerStoryId);
                if (story && story.status === 'testing') {
                  // Story still in testing after sync - tester finished but didn't update status
                  // Since generator completed without error, testing is done - mark as complete
                  // Check for test results file first (optional metadata)
                  const testResultsFile = path.join(session.workingDirectory, `.test-results-${testerStoryId}.json`);
                  let hasResultsFile = false;
                  try {
                    await fs.access(testResultsFile);
                    hasResultsFile = true;
                  } catch {
                    // No results file - that's OK, tester still completed
                  }

                  // CRITICAL FIX: Tester generator completing = testing done
                  // Previously we'd release the story and loop forever if no results file
                  story.status = 'done';
                  story.assignedTo = undefined;
                  const reason = hasResultsFile ? 'test results exist' : 'tester completed successfully';
                  console.log(`[Multi-Agent] Auto-moving story ${testerStoryId} to done (${testerId} finished, ${reason})`);
                  this.emit('task:updated', { ...story, status: 'done', assignedTo: undefined });
                  // Add to testedStories and clean up assignments
                  testedStories.add(testerStoryId);
                  testerStoryAssignments.delete(testerStoryId);
                  testerToStoryMap.delete(testerId);
                  await this.storyFileManager.persistStoriesToFile(session).catch(err =>
                    console.error('[Multi-Agent] Failed to persist auto-moved story:', err)
                  );
                  yield {
                    id: `msg-${this.generateId()}`,
                    agentRole: 'coordinator',
                    agentName: 'Coordinator',
                    type: 'chat',
                    content: `✅ Auto-moving "${story.title}" to done (${testerId} finished, ${reason})`,
                    timestamp: new Date(),
                  };
                } else if (story && (story.status === 'done' || story.status === 'completed')) {
                  // Story already marked done (tester updated file) - just clean up
                  console.log(`[Multi-Agent] Story ${testerStoryId} already done (tester updated file)`);
                  testedStories.add(testerStoryId);
                  testerStoryAssignments.delete(testerStoryId);
                  testerToStoryMap.delete(testerId);
                }
              }

              // This tester finished - check if there's more work
              // CRITICAL: Use hasWorkForRole (non-mutating) instead of getNextStoryForRole
              const hasMoreWork = hasWorkForRole('tester', testerId);

              if (hasMoreWork && !allStoriesDone()) {
                const freshContext = getFreshContext('tester', testerId);
                if (freshContext) {
                  yield {
                    id: `msg-${this.generateId()}`,
                    agentRole: 'coordinator',
                    agentName: 'Coordinator',
                    type: 'chat',
                    content: `Tester ${testerId} picking up next story...`,
                    timestamp: new Date(),
                  };
                  pendingNextCalls.delete(testerId); // Clear pending call
                  const currentStoryId = getStoryIdForTester(testerId);
                  parallelTesterGenerators.set(testerId, this.runAgent('tester', session, freshContext, testerId, agentConfig, currentStoryId));
                } else {
                  completedTesters.add(testerId);
                }
              } else if (!allStoriesDone()) {
                // No immediate work but stories not done - tester might get work later
                parallelTesterGenerators.delete(testerId);
                pendingNextCalls.delete(testerId);
                waitingTesters.add(testerId); // Mark as waiting to prevent immediate relaunch
                yield {
                  id: `msg-${this.generateId()}`,
                  agentRole: 'coordinator',
                  agentName: 'Coordinator',
                  type: 'thinking',
                  content: `${testerId} finished current work, waiting for more stories...`,
                  timestamp: new Date(),
                };
              } else {
                completedTesters.add(testerId);
                yield {
                  id: `msg-${this.generateId()}`,
                  agentRole: 'coordinator',
                  agentName: 'Coordinator',
                  type: 'chat',
                  content: `${testerId} completed all tasks.`,
                  timestamp: new Date(),
                };
              }
            } else if (result.value) {
              // Modify message to include tester ID for parallel testers
              const msg = result.value;
              if (parallelTestersCount > 1 && msg.agentRole === 'tester') {
                msg.agentName = `Tester ${testerId}`;
              }
              yield msg;
            }
          }
        } catch (error) {
          console.error(`[Multi-Agent] Parallel tester ${testerId} crashed:`, error);

          // CRITICAL: Reset any story this tester was working on back to testing (so another tester can pick it up)
          const stuckStory = session.tasks.find(t =>
            t.status === 'testing' &&
            (t.workingAgent === testerId || t.assignedTo === testerId)
          );
          if (stuckStory) {
            console.log(`[Multi-Agent] 🔄 Resetting stuck story "${stuckStory.title}" from crashed tester ${testerId}`);
            stuckStory.workingAgent = null;
            stuckStory.assignedTo = null;
            this.emit('task:updated', stuckStory);
            this.persistStoriesToFile(session).catch(err => {
              console.error('[Multi-Agent] Failed to persist reset story:', err);
            });
          }

          pendingNextCalls.delete(testerId); // Clear pending call on error
          // CRITICAL: Use hasWorkForRole (non-mutating) instead of getNextStoryForRole
          const hasMoreWork = hasWorkForRole('tester', testerId);
          if (hasMoreWork && !allStoriesDone()) {
            const freshContext = getFreshContext('tester', testerId);
            if (freshContext) {
              const currentStoryId = getStoryIdForTester(testerId);
              parallelTesterGenerators.set(testerId, this.runAgent('tester', session, freshContext, testerId, agentConfig, currentStoryId));
            } else {
              completedTesters.add(testerId);
            }
          } else {
            completedTesters.add(testerId);
          }
        }
      }

      // Mark 'tester' role as complete when all parallel testers are done
      if (parallelTesterGenerators.size > 0 &&
          completedTesters.size >= parallelTesterGenerators.size &&
          !completed.has('tester') &&
          allStoriesDone()) {
        completed.add('tester');
        yield {
          id: `msg-${this.generateId()}`,
          agentRole: 'coordinator',
          agentName: 'Coordinator',
          type: 'chat',
          content: `All ${completedTesters.size} tester agent(s) completed.`,
          timestamp: new Date(),
        };
      }

      // Small delay to prevent tight loop
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Save final checkpoint on completion
    try {
      await this.checkpointManager.saveCheckpoint(
        session,
        'complete',
        ['product_owner', 'coder', 'tester', 'security'],
        requirements,
        agentsToRun
      );
      yield {
        id: `msg-${this.generateId()}`,
        agentRole: 'coordinator',
        agentName: 'Coordinator',
        type: 'thinking',
        content: `💾 Final checkpoint saved`,
        timestamp: new Date(),
      };
    } catch (err) {
      console.error('[MultiAgentService] Final checkpoint save failed:', err);
    }

    const doneCount = session.tasks.filter(t => t.status === 'done' || t.status === 'completed').length;
    const failedCount = session.tasks.filter(t => t.status === 'failed').length;
    const failedTasks = session.tasks.filter(t => t.status === 'failed');

    // Complete audit logging
    if (session.auditService) {
      try {
        const buildStatus = failedCount > 0 ? 'failed' : 'completed';
        await session.auditService.completeBuild(buildStatus);
        console.log(`[Audit] Build ${session.currentBuildId} completed with status: ${buildStatus}`);
      } catch (err) {
        console.error('[Audit] Failed to complete build audit:', err);
      }
    }

    // Cleanup audit event listeners
    cleanupAuditListeners();

    // Reset any stuck in_progress stories to backlog (cleanup on build completion)
    let stuckCount = 0;
    session.tasks.forEach(task => {
      if (task.status === 'in_progress') {
        task.status = 'backlog';
        task.workingAgent = null;
        stuckCount++;
      }
    });
    if (stuckCount > 0) {
      console.log(`[MultiAgentService] 🔄 Reset ${stuckCount} stuck in_progress stories to backlog on build completion`);
      await this.persistStoriesToFile(session);
    }

    let completionMessage = `Build complete! ${doneCount}/${session.tasks.length} stories done.`;

    if (failedCount > 0) {
      completionMessage += `\n\n⚠️ ${failedCount} story/stories FAILED after ${MAX_RETRIES} attempts:`;
      failedTasks.forEach(t => {
        completionMessage += `\n  • ${t.title}: ${t.result || 'Unknown error'}`;
      });
      completionMessage += `\n\nYou may need to manually review and fix these issues.`;
    }

    yield {
      id: `msg-${this.generateId()}`,
      agentRole: 'coordinator',
      agentName: 'Coordinator',
      type: 'chat',
      content: completionMessage,
      timestamp: new Date(),
    };
  }

  /**
   * Create a new multi-agent session
   */
  createSession(projectId: string, workingDirectory: string, coderConfig?: Partial<CoderConfig>, projectName?: string, buildNumber?: number): MultiAgentSession {
    // Reset subscription service tracking for new build
    claudeSubscriptionService.clearAll();

    const sessionId = `session-${this.generateId()}`;

    // Initialize log context for correlation
    const logContext = {
      sessionId,
      projectId,
      buildNumber,
    };

    const session: MultiAgentSession = {
      id: sessionId,
      projectId,
      projectName: projectName || path.basename(workingDirectory), // Use provided name or derive from directory
      agents: new Map([
        ['coordinator', { role: 'coordinator', name: 'Coordinator', status: 'idle', completedTasks: [] }],
        ['product_owner', { role: 'product_owner', name: 'Product Owner', status: 'idle', completedTasks: [] }],
        ['data_architect', { role: 'data_architect', name: 'Data Architect', status: 'idle', completedTasks: [] }],
        ['coder', { role: 'coder', name: 'Coder', status: 'idle', completedTasks: [] }],
        ['tester', { role: 'tester', name: 'Tester', status: 'idle', completedTasks: [] }],
        ['security', { role: 'security', name: 'Security', status: 'idle', completedTasks: [] }],
        ['fixer', { role: 'fixer', name: 'Fixer', status: 'idle', completedTasks: [] }],
        ['researcher', { role: 'researcher', name: 'Researcher', status: 'idle', completedTasks: [] }],
      ]),
      tasks: [],
      epics: [],
      messages: [],
      commandLogs: [],
      workingDirectory,
      createdAt: new Date(),
      updatedAt: new Date(),
      coderConfig: {
        parallelCoders: coderConfig?.parallelCoders ?? 1,
        batchMode: coderConfig?.batchMode ?? false,
        batchSize: coderConfig?.batchSize ?? 3,
        // isExistingProject replaces old skipFoundation + currentIterationId
        isExistingProject: coderConfig?.isExistingProject ?? coderConfig?.skipFoundation ?? false,
      },
      fileLocks: new Map(),
      agentToStory: new Map(), // Track which agent is working on which story for log filtering
      logContext, // Correlation context for structured logging
    };

    this.sessions.set(session.id, session);

    // Create and store session logger
    const logger = createLogger('Multi-Agent', logContext);
    this.sessionLoggers.set(session.id, logger);

    // Log existing project mode
    if (session.coderConfig.isExistingProject) {
      logger.log('EXISTING PROJECT MODE - will skip setup stories');
    }

    // Track project to session mapping for stop functionality
    this.projectToSession.set(projectId, session.id);

    // Preload architecture for this project (non-blocking)
    preloadArchitecture(workingDirectory).catch((err) => {
      logger.warn(`Failed to preload architecture: ${err}`);
    });

    // Create abort controller for this session
    this.sessionAbortControllers.set(session.id, new AbortController());

    // Create optimized runner for parallel agents
    const runner = new OptimizedAgentRunner(workingDirectory, {
      maxCoders: coderConfig?.parallelCoders ?? 3,
      maxTesters: 2, // Support parallel testers now
      enableFileLocking: true,
      enableDependencies: true,
      storyLockTimeout: 30000,
    });

    // Wire up runner events
    runner.on('story:assigned', ({ story, worker }) => {
      logger.log(`Story "${story.title}" assigned to ${worker.id}`);
      this.emit('task:updated', { ...story, status: 'in_progress', assignedTo: worker.role });
      // Emit story:started for UI to move card and track agent
      this.emit('story:started', {
        storyId: story.id,
        storyTitle: story.title,
        agentId: worker.id,
        status: 'in_progress',
      });
    });

    runner.on('story:completed', ({ storyId, success }) => {
      const story = session.tasks.find(t => t.id === storyId);
      if (story) {
        story.status = success ? 'done' : 'failed';
        this.emit('task:updated', story);
        // Emit story:completed or story:failed for UI to move card
        if (success) {
          this.emit('story:completed', {
            storyId: story.id,
            storyTitle: story.title,
            success: true,
            status: 'done',
          });
        } else {
          this.emit('story:failed', {
            storyId: story.id,
            storyTitle: story.title,
            error: story.result || 'Story failed',
            status: 'failed',
          });
        }
      }
    });

    runner.on('lock:conflict', ({ file, requestedBy, heldBy }) => {
      logger.warn(`Lock conflict: ${file} requested by ${requestedBy}, held by ${heldBy}`);
    });

    this.optimizedRunners.set(session.id, runner);
    logger.log(`Created optimized runner for session`);

    return session;
  }

  /**
   * Update coder configuration for a session
   */
  updateCoderConfig(sessionId: string, config: Partial<CoderConfig>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.coderConfig = { ...session.coderConfig, ...config };
      session.updatedAt = new Date();
    }
  }

  /**
   * Run the Fixer agent to debug and fix errors
   * Can be triggered manually or when errors are detected
   */
  async *runFixer(
    session: MultiAgentSession,
    errorContext?: string
  ): AsyncGenerator<AgentMessage> {
    // Load agent configuration
    let agentConfig: FullAgentConfiguration | null = null;
    try {
      agentConfig = await loadAgentConfig();
    } catch {
      console.log('[Fixer] Using default agent configuration');
    }

    const existingFiles = await this.listProjectFiles(session.workingDirectory);
    const fileList = existingFiles.length > 0
      ? `\n\nProject files:\n${existingFiles.slice(0, 30).map(f => `- ${f}`).join('\n')}${existingFiles.length > 30 ? `\n... and ${existingFiles.length - 30} more` : ''}`
      : '';

    // Get recent failed commands for context
    const recentFailures = session.commandLogs
      .filter(log => log.exitCode !== 0 || log.error)
      .slice(-5)
      .map(log => `$ ${log.command}\n  Exit: ${log.exitCode}\n  Error: ${(log.error || 'none').slice(0, 200)}`)
      .join('\n\n');

    // Get failed tasks
    const failedTasks = session.tasks.filter(t => t.status === 'failed');
    const failedTasksInfo = failedTasks.length > 0
      ? `\n\nFailed stories:\n${failedTasks.map(t => `- [${t.id}] ${t.title}: ${t.result?.slice(0, 100) || 'Unknown error'}`).join('\n')}`
      : '';

    // Build context for fixer
    let context = `🔧 FIXER AGENT - ERROR RESOLUTION MODE

⚠️ CRITICAL: You MUST keep looping until the app is FULLY WORKING!
Do NOT stop after fixing one error - keep checking logs and fixing until done.

PROJECT DIRECTORY: ${session.workingDirectory}
${fileList}
${failedTasksInfo}

${recentFailures ? `═══════════════════════════════════════════════════════════════
RECENT COMMAND FAILURES (check these!)
═══════════════════════════════════════════════════════════════
${recentFailures}
` : ''}`;

    if (errorContext) {
      context += `
═══════════════════════════════════════════════════════════════
SPECIFIC ERROR TO FIX (but also check for other errors!)
═══════════════════════════════════════════════════════════════
${errorContext}
`;
    }

    context += `
═══════════════════════════════════════════════════════════════
YOUR MISSION - LOOP UNTIL APP WORKS!
═══════════════════════════════════════════════════════════════

🔄 REPEAT THIS LOOP until "npm run build" succeeds AND "npm run dev" works:

1️⃣ CHECK ALL ERROR SOURCES:
   → get_error_logs() - See command history
   → run_command("npm run build 2>&1") - Fresh build output
   → run_command("cat package.json") - Check dependencies
   → Look in .next/ folder for build artifacts/errors

2️⃣ FOR EACH ERROR FOUND:
   → read_file(path) - Read the problematic file
   → analyze_error(error_message) - Get fix suggestions
   → edit_file() - Apply the fix
   → report_fix() - Document the fix

3️⃣ VERIFY FIX WORKED:
   → run_command("npm run build 2>&1") - Did it pass?
   → If errors remain → GO BACK TO STEP 1
   → If build passes → Continue to final verification

4️⃣ FINAL VERIFICATION:
   → run_command("npm run build") - Must succeed (exit code 0)
   → run_command("timeout 10 npm run dev 2>&1 || true") - Check dev server starts
   → If ANY errors → GO BACK TO STEP 1

5️⃣ COMPLEX FIXES:
   → If fix requires major refactoring, use request_coder_help()

🎯 SUCCESS CRITERIA:
   ✅ "npm run build" exits with code 0
   ✅ "npm run dev" starts without errors
   ✅ No TypeScript/syntax errors in output
   ✅ All report_fix() calls made for fixes applied

🚀 START NOW: Run get_error_logs() AND run_command("npm run build 2>&1") to see what needs fixing!`;

    // Run the fixer agent
    for await (const message of this.runAgent('fixer', session, context, undefined, agentConfig)) {
      yield message;
    }
  }

  /**
   * Run the Researcher agent to analyze the project and suggest enhancements
   */
  async *runResearcher(
    session: MultiAgentSession,
    requirements?: string
  ): AsyncGenerator<AgentMessage> {
    // Load agent configuration
    let agentConfig: FullAgentConfiguration | null = null;
    try {
      agentConfig = await loadAgentConfig();
    } catch {
      console.log('[Researcher] Using default agent configuration');
    }

    const existingFiles = await this.listProjectFiles(session.workingDirectory);
    const fileList = existingFiles.length > 0
      ? `\n\nProject files:\n${existingFiles.map(f => `- ${f}`).join('\n')}`
      : '';

    // Build context for researcher
    let context = `You are analyzing this project to suggest valuable enhancements.${fileList}

${requirements ? `Original project requirements:\n${requirements}\n` : ''}

=== YOUR MISSION ===
1. Use list_files() to see all project files
2. Use read_file() to examine key files:
   - package.json (dependencies, scripts)
   - Main entry points and components
   - Configuration files
3. Use analyze_dependencies() to check for missing packages
4. For EACH suggestion, use suggest_enhancement() with:
   - category, title, description, priority, effort, impact
5. When done, call complete_research() with a summary

IMPORTANT:
- Aim for 8-15 quality suggestions across different categories
- Focus on practical, actionable improvements
- Consider quick wins (low effort, high impact)
- Don't suggest things that already exist in the project

START NOW: Use list_files("**/*") to see the project structure.`;

    // Run the researcher agent
    for await (const message of this.runAgent('researcher', session, context, undefined, agentConfig)) {
      yield message;
    }
  }

  /**
   * Helper method to list project files
   */
  private async listProjectFiles(dir: string): Promise<string[]> {
    try {
      // Normalize path for glob (cross-platform compatible)
      const normalizedDir = normalizePathForGlob(dir);
      const files = await glob('**/*', {
        cwd: normalizedDir,
        ignore: ['**/node_modules/**', '**/.git/**', '**/.next/**', '**/dist/**'],
        nodir: true,
      });
      return files.slice(0, 50);
    } catch {
      return [];
    }
  }

  getSession(sessionId: string): MultiAgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAgentConfig(role: AgentRole) {
    return AGENT_CONFIGS[role];
  }

  /**
   * Stop a session by project ID
   */
  stopByProjectId(projectId: string): boolean {
    const sessionId = this.projectToSession.get(projectId);
    if (sessionId) {
      return this.stopSession(sessionId);
    }
    console.log(`[MultiAgentService] No active session found for project: ${projectId}`);
    return false;
  }

  /**
   * Stop a session by session ID
   */
  stopSession(sessionId: string): boolean {
    console.log(`[MultiAgentService] 🛑 Stopping session: ${sessionId}`);

    // Get abort controller and abort
    const abortController = this.sessionAbortControllers.get(sessionId);
    if (abortController) {
      abortController.abort();
      this.sessionAbortControllers.delete(sessionId);
      console.log(`[MultiAgentService] ✅ Aborted session: ${sessionId}`);
    }

    // Stop optimized runner if exists
    const runner = this.optimizedRunners.get(sessionId);
    if (runner) {
      runner.stop();
      this.optimizedRunners.delete(sessionId);
      console.log(`[MultiAgentService] ✅ Stopped optimized runner for session: ${sessionId}`);
    }

    // Get session and emit stop message
    const session = this.sessions.get(sessionId);
    if (session) {
      // Mark all agents as idle
      session.agents.forEach((agent, role) => {
        if (agent.status === 'working' || agent.status === 'waiting') {
          agent.status = 'idle';
          this.emit('agent:status', { role, status: 'idle', projectId: session.projectId });
        }
      });

      // Reset stuck stories: in_progress or testing without active agent → backlog
      let resetCount = 0;
      session.tasks.forEach(task => {
        if (task.status === 'in_progress' || (task.status === 'testing' && task.workingAgent)) {
          task.status = 'backlog';
          task.workingAgent = null;
          resetCount++;
        }
      });
      if (resetCount > 0) {
        console.log(`[MultiAgentService] 🔄 Reset ${resetCount} stuck stories to backlog`);
        // Persist the reset stories to file
        if (session.workingDirectory) {
          this.persistStoriesToFile(session).catch(err => {
            console.error('[MultiAgentService] Failed to persist reset stories:', err);
          });
        }
      }

      // Emit stop message
      this.emitAgentMessage(session, {
        agentRole: 'coordinator',
        agentName: 'System',
        type: 'result',
        content: '⏹️ Workflow stopped by user. All agents have been terminated.',
      });

      // Remove project mapping
      this.projectToSession.delete(session.projectId);

      // Emit workflow stopped event
      this.emit('workflow:stopped', { projectId: session.projectId, sessionId });

      // Clean up session
      this.sessions.delete(sessionId);

      console.log(`[MultiAgentService] ✅ Session ${sessionId} fully stopped`);
      return true;
    }

    return false;
  }

  /**
   * Check if a project has an active session
   */
  hasActiveSession(projectId: string): boolean {
    return this.projectToSession.has(projectId);
  }

  /**
   * Get session ID for a project
   */
  getSessionIdForProject(projectId: string): string | undefined {
    return this.projectToSession.get(projectId);
  }

  /**
   * Load the latest checkpoint for a project (public wrapper for external callers)
   */
  async loadCheckpoint(workingDirectory: string): Promise<SessionCheckpoint | null> {
    return this.checkpointManager.loadCheckpoint(workingDirectory);
  }

  /**
   * Pause a session - saves checkpoint and stops agents gracefully
   */
  async pauseSession(projectId: string, requirements: string, agentsToRun: AgentRole[]): Promise<{ success: boolean; checkpointPath?: string }> {
    const sessionId = this.projectToSession.get(projectId);
    if (!sessionId) {
      console.log(`[MultiAgentService] No active session to pause for project: ${projectId}`);
      return { success: false };
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false };
    }

    // Determine current phase based on completed work
    let phase: SessionCheckpoint['phase'] = 'product_owner';
    const completedAgents: AgentRole[] = [];

    const hasStories = session.tasks.length > 0;
    const allStoriesCoded = session.tasks.every(t => t.status !== 'backlog' && t.status !== 'pending');
    const allStoriesTested = session.tasks.every(t => t.status === 'done' || t.status === 'completed');

    if (hasStories) {
      completedAgents.push('product_owner');
      phase = 'coder';
    }
    if (allStoriesCoded) {
      completedAgents.push('coder');
      phase = 'tester';
    }
    if (allStoriesTested) {
      completedAgents.push('tester');
      phase = 'security';
    }

    // Save checkpoint
    const checkpointPath = await this.checkpointManager.saveCheckpoint(session, phase, completedAgents, requirements, agentsToRun);

    // Stop the session
    this.stopSession(sessionId);

    this.emit('session:paused', { projectId, checkpointPath, phase });
    console.log(`[MultiAgentService] ⏸️ Session paused at phase: ${phase}`);

    return { success: true, checkpointPath };
  }

  /**
   * Resume a session from checkpoint
   */
  async *resumeFromCheckpoint(
    projectId: string,
    workingDirectory: string
  ): AsyncGenerator<AgentMessage> {
    const checkpoint = await this.checkpointManager.loadCheckpoint(workingDirectory);
    if (!checkpoint) {
      yield {
        id: `msg-${this.generateId()}`,
        agentRole: 'coordinator',
        agentName: 'System',
        type: 'error',
        content: 'No checkpoint found to resume from.',
        timestamp: new Date(),
      };
      return;
    }

    yield {
      id: `msg-${this.generateId()}`,
      agentRole: 'coordinator',
      agentName: 'System',
      type: 'chat',
      content: `🔄 Resuming from checkpoint: phase=${checkpoint.phase}, ${checkpoint.tasks.length} tasks`,
      timestamp: new Date(),
    };

    // Create a new session with restored state
    const session = await this.createSession(projectId, workingDirectory);

    // Restore epics
    session.epics = checkpoint.epics.map(e => ({ ...e, createdAt: new Date(e.createdAt) }));

    // Restore tasks BUT reset incomplete work to backlog for fresh start
    // - done/completed: keep as-is (preserve completed work)
    // - in_progress/testing/failed: reset to backlog (agents will redo)
    let resetCount = 0;
    session.tasks = checkpoint.tasks.map(t => {
      if (t.status === 'done' || t.status === 'completed') {
        return t; // Keep completed work
      } else if (t.status === 'in_progress' || t.status === 'testing' || t.status === 'failed') {
        resetCount++;
        return {
          ...t,
          status: 'backlog',
          assignedTo: undefined,
          workingAgent: undefined,
        };
      }
      return t; // backlog/pending stay as-is
    });

    // Clear session-level assignment tracking for fresh start
    session.agentToStory.clear();
    (session as any).testerStoryAssignments = new Map<string, string>(); // storyId -> testerId
    (session as any).testerToStoryMap = new Map<string, string>(); // testerId -> storyId
    (session as any).testedStoryIds = new Set<string>();

    yield {
      id: `msg-${this.generateId()}`,
      agentRole: 'coordinator',
      agentName: 'System',
      type: 'chat',
      content: `🔄 Reset ${resetCount} incomplete stories to backlog for fresh start`,
      timestamp: new Date(),
    };

    // Persist the reset state to file so agents see correct status
    await this.storyFileManager.persistStoriesToFile(session);

    // Calculate done count for runner state
    const completedStoryIds = session.tasks
      .filter(t => t.status === 'done' || t.status === 'completed')
      .map(t => t.id);
    const foundationComplete = session.tasks.some(t =>
      (t.status === 'done' || t.status === 'completed') &&
      (t.title.toLowerCase().includes('setup') ||
       t.title.toLowerCase().includes('foundation') ||
       t.title.toLowerCase().includes('scaffold'))
    );

    // Restore runner state for coder checkpointing
    const runner = this.optimizedRunners.get(session.id);
    if (runner) {
      runner.restoreState({
        completedStoryIds,
        foundationStoryId: null,
        foundationComplete,
      });
    }

    yield {
      id: `msg-${this.generateId()}`,
      agentRole: 'coordinator',
      agentName: 'System',
      type: 'chat',
      content: `✅ Restored state: ${completedStoryIds.length} completed, ${session.tasks.length - completedStoryIds.length} to do, foundation=${foundationComplete ? 'complete' : 'pending'}`,
      timestamp: new Date(),
    };

    // Emit state:restored with ALL tasks at once for UI to populate kanban
    this.emit('state:restored', {
      tasks: session.tasks,
      epics: session.epics,
      completedCount: completedStoryIds.length,
      totalCount: session.tasks.length,
    });

    // Also emit individual events for compatibility
    for (const epic of session.epics) {
      this.emit('epic:created', epic);
    }
    for (const task of session.tasks) {
      this.emit('task:created', task);
    }

    // On resume, always run all agents fresh (except PO if stories exist)
    const hasStories = session.tasks.length > 0;
    const remainingAgents = hasStories
      ? checkpoint.agentsToRun.filter(a => a !== 'product_owner') // Skip PO if we have stories
      : checkpoint.agentsToRun;

    yield {
      id: `msg-${this.generateId()}`,
      agentRole: 'coordinator',
      agentName: 'System',
      type: 'chat',
      content: `Starting agents fresh: ${remainingAgents.join(', ') || 'none'}`,
      timestamp: new Date(),
    };

    // Continue with work
    if (remainingAgents.length > 0) {
      for await (const message of this.runParallel(session, checkpoint.requirements, remainingAgents)) {
        yield message;
      }
    }

    yield {
      id: `msg-${this.generateId()}`,
      agentRole: 'coordinator',
      agentName: 'System',
      type: 'result',
      content: '✅ Resumed workflow completed.',
      timestamp: new Date(),
    };
  }

  /**
   * Get session status for a project (for UI display)
   */
  getSessionStatus(projectId: string): {
    active: boolean;
    sessionId?: string;
    phase?: string;
    taskCount?: number;
    completedCount?: number;
  } {
    const sessionId = this.projectToSession.get(projectId);
    if (!sessionId) {
      return { active: false };
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return { active: false };
    }

    const completedCount = session.tasks.filter(t => t.status === 'done' || t.status === 'completed').length;

    // Determine phase
    let phase = 'product_owner';
    if (session.tasks.length > 0) phase = 'coder';
    if (session.tasks.every(t => t.status !== 'backlog' && t.status !== 'pending')) phase = 'tester';
    if (session.tasks.every(t => t.status === 'done' || t.status === 'completed')) phase = 'security';

    return {
      active: true,
      sessionId,
      phase,
      taskCount: session.tasks.length,
      completedCount,
    };
  }
}

// Global singleton to survive Next.js hot-reload
// This is necessary because Next.js dev mode reloads modules, creating new instances
const globalForMultiAgent = globalThis as unknown as {
  multiAgentService: MultiAgentService | undefined;
};

export const multiAgentService = globalForMultiAgent.multiAgentService ?? new MultiAgentService();

if (process.env.NODE_ENV !== 'production') {
  globalForMultiAgent.multiAgentService = multiAgentService;
}

// Log singleton status
console.log('[MultiAgentService] Using instance:', multiAgentService.instanceId);
