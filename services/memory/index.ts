/**
 * Learning Memory System
 *
 * Cross-project learning storage and retrieval.
 *
 * Usage:
 *
 *   // Get the store
 *   import { getLearningStore } from '@/services/memory';
 *   const store = getLearningStore();
 *
 *   // Record a learning
 *   store.add({
 *     type: 'library-issue',
 *     category: 'database',
 *     title: 'Prisma 7 URL validation is strict',
 *     description: 'Rejects many valid URLs',
 *     solution: 'Use String type instead of Url',
 *     severity: 'warning',
 *     library: 'prisma',
 *     tags: ['prisma', 'validation']
 *   });
 *
 *   // Search learnings
 *   const results = store.search('prisma url');
 *
 *   // Get context for an agent
 *   const learnings = store.getContextForTask(
 *     'Set up database with Prisma',
 *     ['prisma', 'postgresql']
 *   );
 *   const promptAddition = store.formatForPrompt(learnings);
 *
 *   // Use the agent wrapper
 *   import { getLearningAgent } from '@/services/memory';
 *   const agent = getLearningAgent();
 *
 *   const { enhancedPrompt } = agent.enhancePrompt(originalPrompt, {
 *     taskDescription: 'Build user authentication',
 *     techStack: ['nextjs', 'prisma', 'nextauth']
 *   });
 */

// Core store
export {
  LearningStore,
  getLearningStore,
  type Learning,
  type LearningType,
  type Severity,
  type LearningSearchOptions,
} from './learning-store';

// Error extraction
export {
  ErrorExtractor,
  getErrorExtractor,
} from './error-extractor';

// Agent wrapper
export {
  LearningAgent,
  getLearningAgent,
  createLearningAgent,
  type AgentContext,
  type AgentResult,
  type LearningAgentOptions,
} from './learning-agent';

// Pending learnings (for review workflow)
export {
  PendingLearningsService,
  getPendingLearningsService,
  createPendingLearningsService,
  type PendingLearning,
  type PendingLearningsStats,
} from './pending-learnings';

// Smart learning extractor (LLM-powered)
export {
  SmartLearningExtractor,
  getSmartLearningExtractor,
  type ExtractionContext,
  type ExtractedInsight,
} from './smart-learning-extractor';
