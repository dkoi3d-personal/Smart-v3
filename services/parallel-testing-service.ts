/**
 * Parallel Testing Service
 *
 * Runs multiple test agents in parallel when configured.
 * Uses Claude Code CLI with subscription (NOT API credits).
 * Spawns multiple CLI processes for true parallel execution.
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { loadAgentConfig, getEffectivePrompt } from '@/lib/agent-config-store';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface TestTask {
  id: string;
  storyId: string;
  storyTitle: string;
  testFiles: string[];
  status: 'pending' | 'running' | 'passed' | 'failed';
  assignedAgent?: number;
  result?: TestResult;
}

export interface TestResult {
  taskId: string;
  storyId: string;
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests?: number;
  coverage?: number;
  coverageBreakdown?: {
    lines: number;
    statements: number;
    functions: number;
    branches: number;
  };
  summary: string;
  errorOutput?: string;
  duration: number;
  individualTests?: Array<{
    name: string;
    status: 'passed' | 'failed' | 'skipped';
    duration: number;
    file: string;
    error?: string;
    stackTrace?: string;
  }>;
  failedTestDetails?: Array<{
    name: string;
    file: string;
    error: string;
    stackTrace?: string;
  }>;
}

export interface ParallelTestingConfig {
  parallelTesters: number;
  minCoverage: number;
  requireTests: boolean;
  projectDir: string;
}

/**
 * Parallel Testing Service - Runs multiple test agents concurrently
 */
export class ParallelTestingService extends EventEmitter {
  private config: ParallelTestingConfig;
  private testQueue: TestTask[] = [];
  private runningTasks: Map<string, TestTask> = new Map();
  private completedTasks: Map<string, TestResult> = new Map();
  private isRunning = false;

  constructor(config: ParallelTestingConfig) {
    super();
    this.config = config;
  }

  /**
   * Add a test task to the queue
   */
  addTask(task: TestTask): void {
    this.testQueue.push(task);
    this.emit('task:queued', task);
  }

  /**
   * Add multiple test tasks
   */
  addTasks(tasks: TestTask[]): void {
    for (const task of tasks) {
      this.addTask(task);
    }
  }

  /**
   * Run all queued tests in parallel (up to parallelTesters limit)
   */
  async runAll(): Promise<TestResult[]> {
    if (this.isRunning) {
      throw new Error('Test runner is already running');
    }

    this.isRunning = true;
    this.emit('testing:started', { totalTasks: this.testQueue.length });

    const results: TestResult[] = [];

    try {
      // Process tasks in batches of parallelTesters
      while (this.testQueue.length > 0) {
        // Get batch of tasks (up to parallelTesters)
        const batch = this.testQueue.splice(0, this.config.parallelTesters);

        this.emit('batch:started', {
          batchSize: batch.length,
          remaining: this.testQueue.length
        });

        // Run batch in parallel
        const batchResults = await this.runBatch(batch);
        results.push(...batchResults);

        // Store results
        for (const result of batchResults) {
          this.completedTasks.set(result.taskId, result);
        }

        this.emit('batch:completed', {
          results: batchResults,
          remaining: this.testQueue.length
        });
      }

      this.emit('testing:completed', {
        totalResults: results.length,
        passed: results.filter(r => r.passed).length,
        failed: results.filter(r => !r.passed).length
      });

      return results;

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Run a batch of test tasks in parallel
   */
  private async runBatch(tasks: TestTask[]): Promise<TestResult[]> {
    // Assign agent numbers to tasks
    tasks.forEach((task, index) => {
      task.assignedAgent = index + 1;
      task.status = 'running';
      this.runningTasks.set(task.id, task);
    });

    // Run all tasks in parallel using Promise.all
    const promises = tasks.map((task, index) =>
      this.runSingleTest(task, index + 1)
    );

    const results = await Promise.all(promises);

    // Clean up running tasks
    for (const task of tasks) {
      this.runningTasks.delete(task.id);
    }

    return results;
  }

  /**
   * Run a single test task using Claude Code CLI (subscription, not API)
   * Spawns a separate CLI process for each test agent
   */
  private async runSingleTest(task: TestTask, agentNumber: number): Promise<TestResult> {
    const startTime = Date.now();

    this.emit('test:started', {
      taskId: task.id,
      storyId: task.storyId,
      agentNumber
    });

    try {
      // Load agent configuration
      const agentConfig = await loadAgentConfig();
      const testerConfig = agentConfig.agents.tester;

      // Build prompt for this specific test task
      const testPrompt = this.buildTestPrompt(task);

      // Run Claude CLI directly (uses subscription, NOT API credits)
      const output = await this.runClaudeCLI(testPrompt, {
        model: testerConfig.model,
        maxTurns: testerConfig.maxTurns,
        workingDirectory: this.config.projectDir,
        agentNumber,
        taskId: task.id,
      });

      // Parse results from output or test-results.json
      const result = await this.parseTestResults(task, output, startTime);

      task.status = result.passed ? 'passed' : 'failed';
      task.result = result;

      this.emit('test:completed', {
        taskId: task.id,
        agentNumber,
        result
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const duration = Date.now() - startTime;

      const result: TestResult = {
        taskId: task.id,
        storyId: task.storyId,
        passed: false,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        summary: `Test agent failed: ${errorMessage}`,
        errorOutput: errorMessage,
        duration,
      };

      task.status = 'failed';
      task.result = result;

      this.emit('test:failed', {
        taskId: task.id,
        agentNumber,
        error: errorMessage
      });

      return result;
    }
  }

  /**
   * Run Claude Code CLI directly - uses subscription NOT API credits
   */
  private runClaudeCLI(prompt: string, options: {
    model: string;
    maxTurns: number;
    workingDirectory: string;
    agentNumber: number;
    taskId: string;
  }): Promise<string> {
    return new Promise((resolve, reject) => {
      const { model, workingDirectory, agentNumber, taskId } = options;

      // Build CLI arguments
      const args = [
        '-p',  // Print mode (non-interactive), reads from stdin
        '--model', model,
        '--output-format', 'text',  // Simple text output
        '--dangerously-skip-permissions',  // Auto-approve for testing
      ];

      console.log(`[ParallelTester #${agentNumber}] Starting CLI for task ${taskId}`);
      console.log(`[ParallelTester #${agentNumber}] Model: ${model}, CWD: ${workingDirectory}`);

      // Create clean environment - CRITICAL: Remove API key to use subscription
      const cleanEnv = { ...process.env };
      delete cleanEnv.ANTHROPIC_API_KEY;  // Force subscription usage
      delete cleanEnv.TURBOPACK;
      delete cleanEnv.NEXT_CLI_TURBO;
      cleanEnv.NODE_ENV = 'development';

      // Spawn Claude CLI process
      const proc = spawn('claude', args, {
        cwd: workingDirectory,
        env: cleanEnv,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;

        // Emit progress
        this.emit('test:progress', {
          taskId,
          agentNumber,
          message: chunk.substring(0, 100)
        });
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('error', (error) => {
        console.error(`[ParallelTester #${agentNumber}] Process error:`, error);
        reject(error);
      });

      proc.on('close', (code) => {
        console.log(`[ParallelTester #${agentNumber}] Process exited with code ${code}`);

        if (code === 0 || stdout.length > 0) {
          resolve(stdout);
        } else {
          reject(new Error(`CLI exited with code ${code}: ${stderr}`));
        }
      });

      // Send prompt via stdin
      if (proc.stdin) {
        proc.stdin.write(prompt);
        proc.stdin.end();
      }
    });
  }

  /**
   * Build a test prompt for a specific task
   */
  private buildTestPrompt(task: TestTask): string {
    // Use per-story result file to prevent parallel test overwrites
    const resultFileName = `.test-results-${task.storyId}.json`;
    return `You are testing story "${task.storyTitle}" (ID: ${task.storyId}).

Your task is to:
1. Write comprehensive tests for this story's functionality
2. Run the tests with coverage
3. Write results to ${resultFileName} in the EXACT format:
{
  "task_id": "${task.storyId}",
  "task_title": "${task.storyTitle}",
  "passed": true/false,
  "total_tests": N,
  "passed_tests": N,
  "failed_tests": N,
  "skipped_tests": N,
  "summary": "Description of results",
  "error_output": "",
  "coverage": N,
  "coverage_breakdown": { "lines": N, "statements": N, "functions": N, "branches": N },
  "duration": N,
  "individual_tests": [
    { "name": "test name", "status": "passed|failed|skipped", "duration": N, "file": "path/to/test.tsx" }
  ],
  "failed_test_details": [
    { "name": "failing test", "file": "path/to/test.tsx", "error": "error message", "stackTrace": "..." }
  ]
}

Test files to focus on: ${task.testFiles.length > 0 ? task.testFiles.join(', ') : 'Determine based on story requirements'}

IMPORTANT:
- Write the test file(s) for this story
- Run: npm test -- --coverage --json --passWithNoTests
- Parse the JSON output for detailed test results and coverage breakdown
- Write ${resultFileName} (per-story file to prevent overwrites)
- Include individual test details and any failure information
- Be thorough but efficient

Begin testing now.`;
  }

  /**
   * Parse test results from agent output or results file
   */
  private async parseTestResults(task: TestTask, output: string, startTime: number): Promise<TestResult> {
    const duration = Date.now() - startTime;

    // Try to read per-story result file first (prevents parallel test overwrites)
    const perStoryPath = path.join(this.config.projectDir, `.test-results-${task.storyId}.json`);
    const legacyPath = path.join(this.config.projectDir, '.test-results.json');

    for (const resultsPath of [perStoryPath, legacyPath]) {
      try {
        const resultsData = await fs.readFile(resultsPath, 'utf-8');
        const results = JSON.parse(resultsData);

        // Verify this result is for the correct story
        if (results.task_id === task.storyId || resultsPath === legacyPath) {
          return {
            taskId: task.id,
            storyId: task.storyId,
            passed: results.passed === true,
            totalTests: results.total_tests || 0,
            passedTests: results.passed_tests || 0,
            failedTests: results.failed_tests || 0,
            skippedTests: results.skipped_tests || 0,
            coverage: results.coverage,
            coverageBreakdown: results.coverage_breakdown,
            summary: results.summary || 'Test completed',
            errorOutput: results.error_output,
            duration: results.duration || duration,
            individualTests: results.individual_tests,
            failedTestDetails: results.failed_test_details,
          };
        }
      } catch {
        // Continue to next file or fallback
      }
    }

    // Parse from output if no result files exist
    return this.parseFromOutput(task, output, duration);
  }

  /**
   * Parse test results from agent output text
   */
  private parseFromOutput(task: TestTask, output: string, duration: number): TestResult {
    // Look for test result patterns in output
    const passMatch = output.match(/Tests?:\s*(\d+)\s*passed/i);
    const failMatch = output.match(/(\d+)\s*failed/i);
    const totalMatch = output.match(/(\d+)\s*total/i);
    const coverageMatch = output.match(/coverage[:\s]+(\d+(?:\.\d+)?)\s*%/i);

    const passedTests = passMatch ? parseInt(passMatch[1]) : 0;
    const failedTests = failMatch ? parseInt(failMatch[1]) : 0;
    const totalTests = totalMatch ? parseInt(totalMatch[1]) : passedTests + failedTests;
    const coverage = coverageMatch ? parseFloat(coverageMatch[1]) : undefined;

    const passed = failedTests === 0 && (passedTests > 0 || output.includes('PASS'));

    return {
      taskId: task.id,
      storyId: task.storyId,
      passed,
      totalTests,
      passedTests,
      failedTests,
      coverage,
      summary: passed
        ? `All ${passedTests} tests passed`
        : `${failedTests} of ${totalTests} tests failed`,
      errorOutput: passed ? undefined : output.substring(output.lastIndexOf('FAIL'), output.lastIndexOf('FAIL') + 500),
      duration,
    };
  }

  /**
   * Get current status
   */
  getStatus(): {
    isRunning: boolean;
    queued: number;
    running: number;
    completed: number;
    passed: number;
    failed: number;
  } {
    const completedResults = Array.from(this.completedTasks.values());

    return {
      isRunning: this.isRunning,
      queued: this.testQueue.length,
      running: this.runningTasks.size,
      completed: this.completedTasks.size,
      passed: completedResults.filter(r => r.passed).length,
      failed: completedResults.filter(r => !r.passed).length,
    };
  }

  /**
   * Clear all tasks and results
   */
  reset(): void {
    this.testQueue = [];
    this.runningTasks.clear();
    this.completedTasks.clear();
    this.isRunning = false;
  }
}

/**
 * Create a parallel testing service from project configuration
 */
export async function createParallelTestingService(projectDir: string): Promise<ParallelTestingService> {
  const agentConfig = await loadAgentConfig();

  return new ParallelTestingService({
    parallelTesters: agentConfig.quickSettings.parallelTesters || 3,
    minCoverage: agentConfig.quickSettings.minCoverage || 0,
    requireTests: agentConfig.quickSettings.requireTests,
    projectDir,
  });
}

/**
 * Run tests for multiple stories in parallel
 */
export async function runParallelTests(
  projectDir: string,
  stories: Array<{ id: string; title: string; testFiles?: string[] }>
): Promise<TestResult[]> {
  const service = await createParallelTestingService(projectDir);

  // Convert stories to test tasks
  const tasks: TestTask[] = stories.map(story => ({
    id: `test-${story.id}`,
    storyId: story.id,
    storyTitle: story.title,
    testFiles: story.testFiles || [],
    status: 'pending' as const,
  }));

  service.addTasks(tasks);

  return service.runAll();
}

export default ParallelTestingService;
