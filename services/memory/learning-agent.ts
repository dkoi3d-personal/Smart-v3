/**
 * Learning Agent Wrapper
 *
 * Wraps agent execution to:
 * 1. Inject relevant learnings into prompts
 * 2. Capture errors and extract learnings
 * 3. Track what learnings were shown
 */

import { LearningStore, Learning, getLearningStore } from './learning-store';
import { ErrorExtractor, getErrorExtractor } from './error-extractor';
import { SmartLearningExtractor, getSmartLearningExtractor, ExtractionContext } from './smart-learning-extractor';

// ============================================================================
// Types
// ============================================================================

export interface AgentContext {
  taskDescription: string;
  projectName?: string;
  techStack?: string[];
  currentFile?: string;
  agentId?: string;
}

export interface AgentResult<T = unknown> {
  success: boolean;
  output: string;
  result?: T;
  error?: string;
  learningsShown: number[];
  learningsExtracted: number[];
}

export interface LearningAgentOptions {
  dbPath?: string;
  autoExtractFromErrors?: boolean;
  maxLearningsToShow?: number;
  showLearningsInPrompt?: boolean;
  enableAIExtraction?: boolean; // Use SmartLearningExtractor for AI-powered extraction
  minOutputLengthForAI?: number; // Minimum output length to trigger AI extraction (default: 500)
}

// ============================================================================
// Learning Agent Wrapper
// ============================================================================

export class LearningAgent {
  private store: LearningStore;
  private extractor: ErrorExtractor;
  private smartExtractor: SmartLearningExtractor | null = null;
  private options: Required<LearningAgentOptions>;

  constructor(options: LearningAgentOptions = {}) {
    this.options = {
      dbPath: options.dbPath || undefined,
      autoExtractFromErrors: options.autoExtractFromErrors ?? true,
      maxLearningsToShow: options.maxLearningsToShow ?? 10,
      showLearningsInPrompt: options.showLearningsInPrompt ?? true,
      enableAIExtraction: options.enableAIExtraction ?? true, // Enable AI by default
      minOutputLengthForAI: options.minOutputLengthForAI ?? 500,
    } as Required<LearningAgentOptions>;

    this.store = options.dbPath
      ? new LearningStore(options.dbPath)
      : getLearningStore();
    this.extractor = getErrorExtractor();

    // Initialize SmartLearningExtractor if AI extraction is enabled
    if (this.options.enableAIExtraction) {
      try {
        this.smartExtractor = getSmartLearningExtractor();
      } catch (error) {
        console.warn('[LearningAgent] Failed to initialize SmartLearningExtractor:', error);
        this.smartExtractor = null;
      }
    }
  }

  // ==========================================================================
  // Core Methods
  // ==========================================================================

  /**
   * Get learnings context to inject into a prompt
   */
  getContext(context: AgentContext): {
    learnings: Learning[];
    promptAddition: string;
    learningIds: number[];
  } {
    const learnings = this.store.getContextForTask(
      context.taskDescription,
      context.techStack,
      this.options.maxLearningsToShow
    );

    const promptAddition = this.options.showLearningsInPrompt
      ? this.store.formatForPrompt(learnings)
      : '';

    const learningIds = learnings.map(l => l.id!).filter(Boolean);

    return { learnings, promptAddition, learningIds };
  }

  /**
   * Enhance a prompt with relevant learnings
   */
  enhancePrompt(originalPrompt: string, context: AgentContext): {
    enhancedPrompt: string;
    learningIds: number[];
  } {
    const { promptAddition, learningIds } = this.getContext(context);

    if (!promptAddition) {
      return { enhancedPrompt: originalPrompt, learningIds: [] };
    }

    // Insert learnings before the main task
    const enhancedPrompt = `${promptAddition}\n\n---\n\n${originalPrompt}`;

    return { enhancedPrompt, learningIds };
  }

  /**
   * Process output and extract learnings from both errors and successes
   * @param output - The agent output to process
   * @param context - Agent context information
   * @param wasSuccessful - Whether the agent run was successful
   * @param options - Processing options
   * @param options.saveToStore - If true, saves to permanent store. If false, only extracts (for pending queue flow). Default: true
   */
  processOutput(
    output: string,
    context: AgentContext,
    wasSuccessful: boolean,
    options: { saveToStore?: boolean } = {}
  ): {
    extractedLearnings: Learning[];
    storedIds: number[];
  } {
    const { saveToStore = true } = options;
    const extractedLearnings: Learning[] = [];
    const storedIds: number[] = [];
    const processedTitles = new Set<string>(); // Track titles to prevent duplicates

    // Helper to add learning if not duplicate
    const tryAddLearning = (learning: Learning): boolean => {
      // Check if we already processed this title
      const normalizedTitle = learning.title.toLowerCase().trim();
      if (processedTitles.has(normalizedTitle)) {
        return false;
      }

      // Set project name
      learning.projectName = context.projectName;

      // Only check for duplicates in store if we're saving to store
      if (saveToStore) {
        const existing = this.findSimilarLearning(learning);
        if (existing) {
          processedTitles.add(normalizedTitle);
          return false;
        }

        // Add to permanent store
        const id = this.store.add(learning);
        storedIds.push(id);
        extractedLearnings.push({ ...learning, id });
      } else {
        // Extract only - don't save, let caller handle storage (e.g., pending queue)
        extractedLearnings.push(learning);
      }

      processedTitles.add(normalizedTitle);
      return true;
    };

    // Extract error patterns (for both successful and failed runs - warnings/errors)
    if (this.options.autoExtractFromErrors) {
      const errorPatterns = this.extractor.extractAll(output);
      for (const learning of errorPatterns) {
        tryAddLearning(learning);
      }
    }

    // Extract success patterns from successful runs (patterns, best-practices)
    if (wasSuccessful) {
      const successPatterns = this.extractSuccessPatterns(output, context);
      for (const learning of successPatterns) {
        tryAddLearning(learning);
      }
    }

    // Trigger AI extraction in background if enabled and output is substantial
    if (
      this.smartExtractor &&
      this.options.enableAIExtraction &&
      output.length >= this.options.minOutputLengthForAI
    ) {
      this.extractWithAIBackground(output, context, wasSuccessful, extractedLearnings, processedTitles, saveToStore);
    }

    return { extractedLearnings, storedIds };
  }

  /**
   * Background AI extraction (fire and forget)
   * Called automatically by processOutput when conditions are met
   */
  private async extractWithAIBackground(
    output: string,
    context: AgentContext,
    wasSuccessful: boolean,
    alreadyExtracted: Learning[],
    processedTitles: Set<string>,
    saveToStore: boolean
  ): Promise<void> {
    if (!this.smartExtractor) return;

    try {
      const extractionContext: ExtractionContext = {
        storyTitle: context.taskDescription || 'Agent Task',
        storyDescription: context.taskDescription || '',
        projectName: context.projectName,
        techStack: context.techStack,
        wasSuccessful,
      };

      const insights = await this.smartExtractor.extract(output, extractionContext);

      for (const insight of insights) {
        // Skip if already captured by regex extraction
        const normalizedTitle = insight.title.toLowerCase().trim();
        if (processedTitles.has(normalizedTitle)) {
          continue;
        }

        const learning = this.smartExtractor.insightToLearning(insight, extractionContext);
        learning.projectName = context.projectName;

        if (saveToStore) {
          // Check for duplicates
          const existing = this.findSimilarLearning(learning);
          if (!existing) {
            const id = this.store.add(learning);
            console.log(`[LearningAgent] 🧠 AI extracted learning: ${learning.title} (id: ${id})`);
          }
        } else {
          // Log that we found a learning that would go to pending queue
          console.log(`[LearningAgent] 🧠 AI detected learning (pending): ${learning.title}`);
        }
      }
    } catch (error) {
      console.warn('[LearningAgent] AI extraction failed:', error);
    }
  }

  /**
   * Async version of processOutput that includes AI extraction
   * Use this when you want to await the full extraction including AI analysis
   */
  async processOutputAsync(
    output: string,
    context: AgentContext,
    wasSuccessful: boolean,
    options: { saveToStore?: boolean } = {}
  ): Promise<{
    extractedLearnings: Learning[];
    storedIds: number[];
    aiLearnings: Learning[];
  }> {
    const { saveToStore = true } = options;
    const extractedLearnings: Learning[] = [];
    const storedIds: number[] = [];
    const aiLearnings: Learning[] = [];
    const processedTitles = new Set<string>();

    // Helper to add learning if not duplicate
    const tryAddLearning = (learning: Learning, isFromAI: boolean = false): boolean => {
      const normalizedTitle = learning.title.toLowerCase().trim();
      if (processedTitles.has(normalizedTitle)) {
        return false;
      }

      learning.projectName = context.projectName;

      if (saveToStore) {
        const existing = this.findSimilarLearning(learning);
        if (existing) {
          processedTitles.add(normalizedTitle);
          return false;
        }

        const id = this.store.add(learning);
        storedIds.push(id);
        extractedLearnings.push({ ...learning, id });
        if (isFromAI) {
          aiLearnings.push({ ...learning, id });
        }
      } else {
        extractedLearnings.push(learning);
        if (isFromAI) {
          aiLearnings.push(learning);
        }
      }

      processedTitles.add(normalizedTitle);
      return true;
    };

    // 1. Extract error patterns (regex-based, fast)
    if (this.options.autoExtractFromErrors) {
      const errorPatterns = this.extractor.extractAll(output);
      for (const learning of errorPatterns) {
        tryAddLearning(learning);
      }
    }

    // 2. Extract success patterns (regex-based, fast)
    if (wasSuccessful) {
      const successPatterns = this.extractSuccessPatterns(output, context);
      for (const learning of successPatterns) {
        tryAddLearning(learning);
      }
    }

    // 3. AI extraction (slower but catches valuable insights)
    if (
      this.smartExtractor &&
      this.options.enableAIExtraction &&
      output.length >= this.options.minOutputLengthForAI
    ) {
      try {
        const extractionContext: ExtractionContext = {
          storyTitle: context.taskDescription || 'Agent Task',
          storyDescription: context.taskDescription || '',
          projectName: context.projectName,
          techStack: context.techStack,
          wasSuccessful,
        };

        const insights = await this.smartExtractor.extract(output, extractionContext);

        for (const insight of insights) {
          const learning = this.smartExtractor.insightToLearning(insight, extractionContext);
          if (tryAddLearning(learning, true)) {
            console.log(`[LearningAgent] 🧠 AI extracted: ${learning.title}`);
          }
        }
      } catch (error) {
        console.warn('[LearningAgent] AI extraction failed:', error);
      }
    }

    return { extractedLearnings, storedIds, aiLearnings };
  }

  /**
   * Extract success patterns from agent output
   */
  private extractSuccessPatterns(output: string, context: AgentContext): Learning[] {
    const learnings: Learning[] = [];

    // Pattern: Fixed a specific issue
    const fixedPatterns = [
      /fixed (?:the )?(.+?) (?:issue|bug|error|problem)/gi,
      /resolved (?:the )?(.+?) (?:issue|by|with)/gi,
      /solution was to (.+?)(?:\.|$)/gi,
    ];

    for (const pattern of fixedPatterns) {
      const matches = output.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length > 10 && match[1].length < 200) {
          learnings.push({
            type: 'pattern',
            category: 'solution',
            title: `Fix: ${match[1].slice(0, 80)}`,
            description: match[0],
            severity: 'info',
            tags: context.techStack || [],
          });
        }
      }
    }

    // Pattern: Discovered a workaround
    const workaroundPatterns = [
      /workaround[:\s]+(.+?)(?:\.|$)/gi,
      /worked around (?:this )?by (.+?)(?:\.|$)/gi,
    ];

    for (const pattern of workaroundPatterns) {
      const matches = output.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length > 10 && match[1].length < 200) {
          learnings.push({
            type: 'workaround',
            category: 'solution',
            title: `Workaround: ${match[1].slice(0, 80)}`,
            description: match[0],
            severity: 'info',
            tags: context.techStack || [],
          });
        }
      }
    }

    // Pattern: Important configuration or setup step
    const configPatterns = [
      /(?:need to|must|should|have to) (?:add|set|configure|update) (.+?) (?:to|in|for)/gi,
      /configuration[:\s]+(.+?)(?:\.|$)/gi,
    ];

    for (const pattern of configPatterns) {
      const matches = output.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length > 10 && match[1].length < 200) {
          learnings.push({
            type: 'config',
            category: 'setup',
            title: `Config: ${match[1].slice(0, 80)}`,
            description: match[0],
            severity: 'info',
            tags: context.techStack || [],
          });
        }
      }
    }

    return learnings;
  }

  /**
   * Wrap an async agent function with learning injection and extraction
   */
  async wrap<T>(
    context: AgentContext,
    agentFn: (enhancedPrompt: string) => Promise<{ output: string; result?: T; success: boolean }>
  ): Promise<AgentResult<T>> {
    // 1. Get context and enhance prompt
    const { promptAddition, learningIds } = this.getContext(context);

    // 2. Execute the agent
    let output = '';
    let result: T | undefined;
    let success = false;
    let error: string | undefined;

    try {
      const response = await agentFn(promptAddition);
      output = response.output;
      result = response.result;
      success = response.success;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      output = error;
      success = false;
    }

    // 3. Process output for learnings
    const { storedIds } = this.processOutput(output, context, success);

    // 4. Log what happened
    if (storedIds.length > 0) {
      console.log(`📚 Extracted ${storedIds.length} new learning(s) from ${success ? 'output' : 'errors'}`);
    }

    return {
      success,
      output,
      result,
      error,
      learningsShown: learningIds,
      learningsExtracted: storedIds,
    };
  }

  // ==========================================================================
  // Feedback Methods
  // ==========================================================================

  /**
   * Mark a learning as helpful
   */
  markHelpful(learningId: number): void {
    this.store.markHelpful(learningId);
  }

  /**
   * Mark a learning as not helpful
   */
  markNotHelpful(learningId: number): void {
    this.store.markNotHelpful(learningId);
  }

  /**
   * Record feedback for multiple learnings at once
   */
  recordFeedback(feedback: { learningId: number; helpful: boolean }[]): void {
    for (const { learningId, helpful } of feedback) {
      if (helpful) {
        this.store.markHelpful(learningId);
      } else {
        this.store.markNotHelpful(learningId);
      }
    }
  }

  // ==========================================================================
  // Manual Recording
  // ==========================================================================

  /**
   * Manually record a learning
   */
  record(learning: Omit<Learning, 'id' | 'createdAt' | 'updatedAt' | 'helpfulCount' | 'notHelpfulCount'>): number {
    return this.store.add(learning);
  }

  /**
   * Quick record from an error message
   */
  recordFromError(
    errorMessage: string,
    context?: { projectName?: string; solution?: string }
  ): number | null {
    const learning = this.extractor.extract(errorMessage);
    if (learning) {
      if (context?.projectName) learning.projectName = context.projectName;
      if (context?.solution) learning.solution = context.solution;
      return this.store.add(learning);
    }
    return null;
  }

  // ==========================================================================
  // Search & Retrieval
  // ==========================================================================

  /**
   * Search learnings
   */
  search(query: string, limit = 10): Learning[] {
    return this.store.search(query, limit);
  }

  /**
   * Get learning by ID
   */
  get(id: number): Learning | null {
    return this.store.get(id);
  }

  /**
   * Get all critical learnings
   */
  getCritical(): Learning[] {
    return this.store.getCritical();
  }

  /**
   * Get learnings for a library
   */
  getByLibrary(library: string): Learning[] {
    return this.store.getByLibrary(library);
  }

  /**
   * Get stats
   */
  getStats() {
    return this.store.getStats();
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private findSimilarLearning(learning: Learning): Learning | null {
    // Check by error pattern first
    if (learning.errorPattern) {
      const existing = this.store.search(learning.errorPattern, 1);
      if (existing.length > 0 && existing[0].errorPattern === learning.errorPattern) {
        return existing[0];
      }
    }

    // Check by title similarity
    const byTitle = this.store.search(learning.title, 3);
    for (const existing of byTitle) {
      if (this.titleSimilarity(existing.title, learning.title) > 0.8) {
        return existing;
      }
    }

    return null;
  }

  private titleSimilarity(a: string, b: string): number {
    const aWords = a.toLowerCase().split(/\s+/);
    const bWords = new Set(b.toLowerCase().split(/\s+/));
    const intersection = aWords.filter(x => bWords.has(x));
    const unionSet = new Set(aWords.concat(Array.from(bWords)));
    return intersection.length / unionSet.size;
  }
}

// ============================================================================
// Singleton & Factory
// ============================================================================

let defaultInstance: LearningAgent | null = null;

export function getLearningAgent(options?: LearningAgentOptions): LearningAgent {
  if (!defaultInstance) {
    defaultInstance = new LearningAgent(options);
  }
  return defaultInstance;
}

export function createLearningAgent(options?: LearningAgentOptions): LearningAgent {
  return new LearningAgent(options);
}

export default LearningAgent;
