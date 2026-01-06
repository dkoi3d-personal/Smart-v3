/**
 * Task-Based Agent Orchestrator using Claude Agent SDK
 *
 * This replaces the slow epic/story-based system with a fast, task-based approach.
 *
 * Key improvements:
 * - Uses Claude Agent SDK instead of raw API calls (2-3x faster)
 * - Task-based instead of epic/story (no overhead for simple projects)
 * - Parallel execution of independent tasks
 * - Smart complexity detection (simple apps skip unnecessary steps)
 * - Right-sized models (haiku for simple, sonnet for code, opus for complex)
 */

// @ts-ignore - SDK types are in sdk.d.ts but the module resolution is complex
import { query } from '@anthropic-ai/claude-agent-sdk';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type ProjectComplexity = 'trivial' | 'simple' | 'moderate' | 'complex';
export type ModelChoice = 'haiku' | 'sonnet' | 'opus';

export interface Task {
  id: string;
  type: 'analyze' | 'setup' | 'implement' | 'test' | 'review' | 'deploy';
  description: string;
  status: TaskStatus;
  dependencies: string[]; // Task IDs this depends on
  result?: string;
  error?: string;
  startTime?: number;
  endTime?: number;
  tokensUsed?: number;
}

export interface ProjectAnalysis {
  complexity: ProjectComplexity;
  estimatedTasks: number;
  features: string[];
  techStack: {
    frontend: string[];
    backend: string[];
    database?: string;
    deployment?: string;
  };
  suggestedApproach: 'direct' | 'planned';
}

export interface OrchestratorConfig {
  projectDirectory: string;
  requirements: string;
  skipDeploy?: boolean;
  maxParallelTasks?: number;
  onProgress?: (task: Task, allTasks: Task[]) => void;
  onMessage?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export interface OrchestratorResult {
  success: boolean;
  tasks: Task[];
  totalTime: number;
  totalTokens: number;
  filesCreated: string[];
  errors: string[];
}

// ============================================================================
// SUBAGENT DEFINITIONS
// ============================================================================

const SUBAGENTS = {
  analyzer: {
    description: 'Analyzes requirements and determines project complexity',
    prompt: `You are a project analyzer. Your job is to:
1. Understand what the user wants to build
2. Determine complexity: trivial (hello world), simple (1-2 features), moderate (3-5 features), complex (6+ features)
3. List the specific features needed
4. Recommend tech stack (always Next.js 14+ with App Router)

Be CONCISE. For trivial/simple projects, don't over-engineer.
Output JSON: { complexity, features: [], techStack: {}, suggestedApproach }`,
    model: 'haiku' as ModelChoice,
    tools: [] as string[],
  },

  planner: {
    description: 'Creates task breakdown for complex projects',
    prompt: `You are a task planner. Given requirements and analysis, create a minimal task list.
Each task should be:
- Atomic (one clear action)
- Independent where possible (for parallel execution)
- Ordered by dependencies

For simple projects: 2-4 tasks max
For moderate projects: 5-8 tasks
For complex projects: 8-15 tasks

Output JSON array of tasks with: { id, type, description, dependencies: [] }`,
    model: 'haiku' as ModelChoice,
    tools: [] as string[],
  },

  coder: {
    description: 'Implements code for a specific task',
    prompt: `You are a senior developer. Implement the given task using:
- Next.js 14+ with App Router (use app/ directory, NOT pages/)
- React 19+ with Server Components by default
- TypeScript with strict mode
- Tailwind CSS for styling

Rules:
- Write clean, production-ready code
- Create only necessary files
- Use 'use client' only when needed (interactivity, hooks)
- Prefer Server Components and Server Actions

=== OCR CAPABILITY ===
You have access to local OCR via the 'ocr' tool (MLX DeepSeek-OCR):
- ocr(imagePath, mode): Extract text from images
- Modes: 'document' (forms/docs), 'general' (any image), 'figure' (charts), 'free' (custom prompt)
- Returns extracted text and bounding boxes
- Use for: document scanning, form data extraction, image-to-text features
- The OCR runs locally at ~550 tokens/sec on Apple Silicon

After implementation, verify the code compiles (no syntax errors).`,
    model: 'sonnet' as ModelChoice,
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'OCR'],
  },

  tester: {
    description: 'Writes and runs tests for implemented code',
    prompt: `You are a test engineer. For the given implementation:
1. Create test file(s) using Jest and React Testing Library
2. Write tests for: happy path, edge cases, error conditions
3. Run the tests with: npm test
4. Report results

Keep tests focused and minimal. Don't over-test simple components.
If tests fail, report what failed so coder can fix.`,
    model: 'sonnet' as ModelChoice,
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
  },

  reviewer: {
    description: 'Reviews code for quality and security',
    prompt: `You are a code reviewer. Check for:
1. Security issues (XSS, injection, secrets in code)
2. Performance problems (unnecessary re-renders, missing memoization)
3. Best practice violations
4. Missing error handling

Be concise. Only flag real issues, not style preferences.
Output: { issues: [], severity: 'none' | 'low' | 'medium' | 'high' }`,
    model: 'sonnet' as ModelChoice,
    tools: ['Read', 'Grep', 'Glob'],
  },

  fixer: {
    description: 'Fixes issues found by reviewer or failed tests',
    prompt: `You are a bug fixer. Given specific issues:
1. Read the problematic code
2. Fix ONLY the reported issues
3. Don't refactor unrelated code
4. Verify the fix works

Be surgical - minimal changes to fix the problem.`,
    model: 'sonnet' as ModelChoice,
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob'],
  },
};

// ============================================================================
// TASK ORCHESTRATOR
// ============================================================================

export class TaskOrchestrator extends EventEmitter {
  private config: OrchestratorConfig;
  private tasks: Task[] = [];
  private analysis: ProjectAnalysis | null = null;
  private totalTokens = 0;
  private startTime = 0;
  private filesCreated: string[] = [];
  private errors: string[] = [];

  constructor(config: OrchestratorConfig) {
    super();
    this.config = {
      maxParallelTasks: 3,
      skipDeploy: false,
      ...config,
    };
  }

  // --------------------------------------------------------------------------
  // MAIN ENTRY POINT
  // --------------------------------------------------------------------------

  async run(): Promise<OrchestratorResult> {
    this.startTime = Date.now();
    this.log('Starting task orchestrator...', 'info');

    try {
      // Step 1: Analyze requirements (fast - uses haiku)
      this.log('Analyzing requirements...', 'info');
      this.analysis = await this.analyzeRequirements();
      this.log(`Complexity: ${this.analysis.complexity}`, 'info');
      this.log(`Features: ${this.analysis.features.join(', ')}`, 'info');

      // Step 2: Generate tasks based on complexity
      if (this.analysis.suggestedApproach === 'direct') {
        // Trivial/simple projects: direct implementation
        this.log('Using direct implementation (simple project)', 'info');
        this.tasks = this.generateDirectTasks();
      } else {
        // Moderate/complex projects: planned approach
        this.log('Using planned approach (complex project)', 'info');
        this.tasks = await this.generatePlannedTasks();
      }

      this.log(`Generated ${this.tasks.length} tasks`, 'info');

      // Step 3: Execute tasks (with parallelization where possible)
      await this.executeTasks();

      // Step 4: Final review (only for moderate+ complexity)
      if (this.analysis.complexity !== 'trivial' && this.analysis.complexity !== 'simple') {
        await this.runFinalReview();
      }

      const totalTime = Date.now() - this.startTime;
      this.log(`Completed in ${(totalTime / 1000).toFixed(1)}s`, 'success');

      return {
        success: this.errors.length === 0,
        tasks: this.tasks,
        totalTime,
        totalTokens: this.totalTokens,
        filesCreated: this.filesCreated,
        errors: this.errors,
      };

    } catch (error: any) {
      this.errors.push(error.message);
      this.log(`Fatal error: ${error.message}`, 'error');

      return {
        success: false,
        tasks: this.tasks,
        totalTime: Date.now() - this.startTime,
        totalTokens: this.totalTokens,
        filesCreated: this.filesCreated,
        errors: this.errors,
      };
    }
  }

  // --------------------------------------------------------------------------
  // STEP 1: ANALYZE REQUIREMENTS
  // --------------------------------------------------------------------------

  private async analyzeRequirements(): Promise<ProjectAnalysis> {
    const prompt = `Analyze these requirements and determine project complexity:

REQUIREMENTS:
${this.config.requirements}

Respond with JSON only:
{
  "complexity": "trivial" | "simple" | "moderate" | "complex",
  "estimatedTasks": <number>,
  "features": ["feature1", "feature2", ...],
  "techStack": {
    "frontend": ["Next.js 14", "React 19", "Tailwind CSS"],
    "backend": ["API Routes", "Server Actions"],
    "database": null | "PostgreSQL" | "MongoDB",
    "deployment": "Vercel" | "AWS"
  },
  "suggestedApproach": "direct" | "planned"
}

COMPLEXITY GUIDE:
- trivial: Hello world, static page, single component (1-2 tasks)
- simple: Landing page, basic form, 1-2 features (2-4 tasks)
- moderate: Auth, CRUD, multiple pages (5-8 tasks)
- complex: Full app with many features (8-15 tasks)

Use "direct" approach for trivial/simple, "planned" for moderate/complex.`;

    const result = await this.runAgent('analyzer', prompt);

    try {
      // Extract JSON from response
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      this.log('Failed to parse analysis, using defaults', 'warning');
    }

    // Default fallback
    return {
      complexity: 'simple',
      estimatedTasks: 3,
      features: ['basic app'],
      techStack: {
        frontend: ['Next.js 14', 'React 19', 'Tailwind CSS'],
        backend: ['API Routes'],
      },
      suggestedApproach: 'direct',
    };
  }

  // --------------------------------------------------------------------------
  // STEP 2: GENERATE TASKS
  // --------------------------------------------------------------------------

  private generateDirectTasks(): Task[] {
    // For trivial/simple projects: minimal task list
    const tasks: Task[] = [
      {
        id: 'setup',
        type: 'setup',
        description: 'Initialize project structure and install dependencies',
        status: 'pending',
        dependencies: [],
      },
      {
        id: 'implement',
        type: 'implement',
        description: `Implement: ${this.analysis!.features.join(', ')}`,
        status: 'pending',
        dependencies: ['setup'],
      },
    ];

    // Add test task only if not trivial
    if (this.analysis!.complexity !== 'trivial') {
      tasks.push({
        id: 'test',
        type: 'test',
        description: 'Write and run basic tests',
        status: 'pending',
        dependencies: ['implement'],
      });
    }

    return tasks;
  }

  private async generatePlannedTasks(): Promise<Task[]> {
    const prompt = `Create a task breakdown for this project:

REQUIREMENTS:
${this.config.requirements}

ANALYSIS:
${JSON.stringify(this.analysis, null, 2)}

Create ${this.analysis!.estimatedTasks} tasks. Output JSON array:
[
  { "id": "task-1", "type": "setup", "description": "...", "dependencies": [] },
  { "id": "task-2", "type": "implement", "description": "...", "dependencies": ["task-1"] },
  ...
]

Task types: setup, implement, test, review
Keep dependencies minimal for parallel execution.`;

    const result = await this.runAgent('planner', prompt);

    try {
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.map((t: any) => ({
          ...t,
          status: 'pending' as TaskStatus,
        }));
      }
    } catch (e) {
      this.log('Failed to parse tasks, using direct approach', 'warning');
    }

    return this.generateDirectTasks();
  }

  // --------------------------------------------------------------------------
  // STEP 3: EXECUTE TASKS
  // --------------------------------------------------------------------------

  private async executeTasks(): Promise<void> {
    const maxParallel = this.config.maxParallelTasks!;

    while (this.hasPendingTasks()) {
      // Find tasks that can run (dependencies satisfied)
      const runnableTasks = this.getRunnableTasks();

      if (runnableTasks.length === 0) {
        // Check for deadlock
        if (this.hasPendingTasks()) {
          this.log('Deadlock detected - circular dependencies', 'error');
          break;
        }
        break;
      }

      // Run tasks in parallel (up to maxParallel)
      const batch = runnableTasks.slice(0, maxParallel);
      this.log(`Running ${batch.length} task(s) in parallel...`, 'info');

      await Promise.all(batch.map(task => this.executeTask(task)));
    }
  }

  private hasPendingTasks(): boolean {
    return this.tasks.some(t => t.status === 'pending');
  }

  private getRunnableTasks(): Task[] {
    return this.tasks.filter(task => {
      if (task.status !== 'pending') return false;

      // Check all dependencies are completed
      return task.dependencies.every(depId => {
        const dep = this.tasks.find(t => t.id === depId);
        return dep && dep.status === 'completed';
      });
    });
  }

  private async executeTask(task: Task): Promise<void> {
    task.status = 'running';
    task.startTime = Date.now();
    this.notifyProgress(task);
    this.log(`Starting task: ${task.description}`, 'info');

    try {
      let result: string;

      switch (task.type) {
        case 'setup':
          result = await this.executeSetupTask(task);
          break;
        case 'implement':
          result = await this.executeImplementTask(task);
          break;
        case 'test':
          result = await this.executeTestTask(task);
          break;
        case 'review':
          result = await this.executeReviewTask(task);
          break;
        default:
          result = await this.executeImplementTask(task);
      }

      task.result = result;
      task.status = 'completed';
      task.endTime = Date.now();

      const duration = ((task.endTime - task.startTime!) / 1000).toFixed(1);
      this.log(`Completed task "${task.id}" in ${duration}s`, 'success');

    } catch (error: any) {
      task.status = 'failed';
      task.error = error.message;
      task.endTime = Date.now();
      this.errors.push(`Task ${task.id} failed: ${error.message}`);
      this.log(`Task "${task.id}" failed: ${error.message}`, 'error');
    }

    this.notifyProgress(task);
  }

  // --------------------------------------------------------------------------
  // TASK EXECUTORS
  // --------------------------------------------------------------------------

  private async executeSetupTask(task: Task): Promise<string> {
    const prompt = `Set up a Next.js 14+ project in: ${this.config.projectDirectory}

Requirements: ${this.config.requirements}

Steps:
1. Check if package.json exists, if not create basic Next.js structure
2. Ensure app/ directory exists (App Router)
3. Create basic layout.tsx and page.tsx if missing
4. Install any needed dependencies

Keep it minimal - only set up what's needed.`;

    return await this.runAgent('coder', prompt);
  }

  private async executeImplementTask(task: Task): Promise<string> {
    const prompt = `Implement this feature in: ${this.config.projectDirectory}

TASK: ${task.description}

REQUIREMENTS: ${this.config.requirements}

TECH STACK: ${JSON.stringify(this.analysis?.techStack)}

Instructions:
1. Read existing code structure first
2. Create/modify only necessary files
3. Use Next.js 14 App Router patterns
4. Keep code clean and minimal
5. Test that the code compiles (no syntax errors)

Report what files you created/modified.`;

    return await this.runAgent('coder', prompt);
  }

  private async executeTestTask(task: Task): Promise<string> {
    const prompt = `Write and run tests for the implementation in: ${this.config.projectDirectory}

Previous implementation: ${this.getCompletedTasksContext()}

Steps:
1. Check if Jest is configured, if not set it up
2. Create test file(s) for the implemented features
3. Write focused tests (happy path + 1-2 edge cases)
4. Run: npm test -- --coverage
5. Report results

If tests fail, explain what failed so we can fix it.`;

    const result = await this.runAgent('tester', prompt);

    // Check if tests passed
    if (result.includes('FAIL') || result.includes('failed')) {
      // Try to fix
      this.log('Tests failed, attempting fix...', 'warning');
      await this.runAgent('fixer', `Fix these test failures:\n${result}`);

      // Re-run tests
      return await this.runAgent('tester', 'Run npm test again and report results');
    }

    return result;
  }

  private async executeReviewTask(task: Task): Promise<string> {
    const prompt = `Review the code in: ${this.config.projectDirectory}

Check for:
1. Security vulnerabilities
2. Performance issues
3. Best practice violations
4. Missing error handling

Only flag real issues. Be concise.`;

    return await this.runAgent('reviewer', prompt);
  }

  // --------------------------------------------------------------------------
  // STEP 4: FINAL REVIEW
  // --------------------------------------------------------------------------

  private async runFinalReview(): Promise<void> {
    this.log('Running final review...', 'info');

    const reviewResult = await this.runAgent('reviewer', `
      Do a final review of the project in: ${this.config.projectDirectory}

      Check:
      1. All features implemented correctly
      2. No security issues
      3. Code quality is acceptable

      Output: { "passed": true/false, "issues": [] }
    `);

    try {
      const jsonMatch = reviewResult.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const review = JSON.parse(jsonMatch[0]);
        if (!review.passed && review.issues?.length > 0) {
          this.log(`Review found ${review.issues.length} issue(s), fixing...`, 'warning');
          await this.runAgent('fixer', `Fix these issues:\n${JSON.stringify(review.issues)}`);
        }
      }
    } catch (e) {
      // Review parsing failed, continue anyway
    }
  }

  // --------------------------------------------------------------------------
  // AGENT RUNNER (uses Claude Agent SDK)
  // --------------------------------------------------------------------------

  private async runAgent(agentName: keyof typeof SUBAGENTS, prompt: string): Promise<string> {
    const agent = SUBAGENTS[agentName];
    let result = '';
    let tokens = 0;

    try {
      // Map our simple model names to actual Claude model names
      const modelMap: Record<string, string> = {
        haiku: 'claude-3-5-haiku-latest',
        sonnet: 'claude-sonnet-4-20250514',
        opus: 'claude-opus-4-20250514',
      };

      const queryInstance = query({
        prompt: prompt,
        options: {
          model: modelMap[agent.model] || 'claude-sonnet-4-20250514',
          maxTurns: this.getMaxTurns(agentName),
          allowedTools: agent.tools.length > 0 ? agent.tools : undefined,
          cwd: this.config.projectDirectory,
          permissionMode: 'bypassPermissions', // Allow automated execution
        },
      });

      for await (const message of queryInstance) {
        if (message.type === 'assistant') {
          // Collect text content from assistant message
          const assistantMsg = message as any;
          if (assistantMsg.message?.content) {
            for (const block of assistantMsg.message.content) {
              if (block.type === 'text') {
                result += block.text;
              }
            }
          }
        } else if (message.type === 'result') {
          // Final result with token usage
          const resultMsg = message as any;
          if (resultMsg.subtype === 'success' && resultMsg.result) {
            result = typeof resultMsg.result === 'string' ? resultMsg.result : JSON.stringify(resultMsg.result);
          }
          // Track tokens from usage
          if (resultMsg.usage) {
            tokens = (resultMsg.usage.input_tokens || 0) + (resultMsg.usage.output_tokens || 0);
          }
        }
      }
    } catch (error: any) {
      this.log(`Agent ${agentName} error: ${error.message}`, 'error');
      throw error;
    }

    this.totalTokens += tokens;
    return result;
  }

  private getMaxTurns(agentName: string): number {
    // Right-sized turn limits based on task complexity
    const turnLimits: Record<string, number> = {
      analyzer: 3,    // Quick analysis
      planner: 5,     // Task planning
      coder: 15,      // Implementation (needs more turns)
      tester: 10,     // Testing
      reviewer: 5,    // Code review
      fixer: 10,      // Bug fixing
    };
    return turnLimits[agentName] || 10;
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------

  private getCompletedTasksContext(): string {
    return this.tasks
      .filter(t => t.status === 'completed')
      .map(t => `- ${t.description}: ${t.result?.slice(0, 200)}...`)
      .join('\n');
  }

  private notifyProgress(task: Task): void {
    this.emit('task:progress', task, this.tasks);
    if (this.config.onProgress) {
      this.config.onProgress(task, this.tasks);
    }
  }

  private log(message: string, type: 'info' | 'success' | 'warning' | 'error'): void {
    const prefix = {
      info: '→',
      success: '✓',
      warning: '⚠',
      error: '✗',
    }[type];

    console.log(`${prefix} ${message}`);
    this.emit('log', message, type);

    if (this.config.onMessage) {
      this.config.onMessage(message, type);
    }
  }
}

// ============================================================================
// CONVENIENCE FUNCTION
// ============================================================================

export async function buildProject(
  requirements: string,
  projectDirectory: string,
  options?: Partial<OrchestratorConfig>
): Promise<OrchestratorResult> {
  const orchestrator = new TaskOrchestrator({
    requirements,
    projectDirectory,
    ...options,
  });

  return orchestrator.run();
}
