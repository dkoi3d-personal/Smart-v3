/**
 * Learning Memory Integration
 *
 * Extracted from multi-agent-service.ts for maintainability.
 * Provides functions for capturing and retrieving learnings from agent operations.
 */

import { getLearningStore } from '@/services/memory/learning-store';
import { getErrorExtractor } from '@/services/memory/error-extractor';
import { getPendingLearningsService } from '@/services/memory/pending-learnings';
import { getLearningAgent } from '@/services/memory/learning-agent';

/**
 * Get learning context for agent prompts based on task and tech stack
 */
export function getLearningsContext(taskDescription: string, techStack?: string[]): string {
  try {
    const store = getLearningStore();
    const learnings = store.getContextForTask(taskDescription, techStack, 8);

    if (learnings.length === 0) {
      return '';
    }

    return store.formatForPrompt(learnings);
  } catch (error) {
    console.warn('[Learning Memory] Failed to get learnings:', error);
    return '';
  }
}

/**
 * Extract and add learnings to pending queue for review (instead of auto-saving)
 */
export function captureErrorLearning(errorMessage: string, projectName?: string, agentId?: string): void {
  try {
    const extractor = getErrorExtractor();
    const pendingService = getPendingLearningsService();

    const learning = extractor.extract(errorMessage);
    if (learning) {
      learning.projectName = projectName;

      // Add to pending queue for user review instead of auto-saving
      const pending = pendingService.add(
        learning,
        'error_extraction',
        0.7, // Medium-high confidence for error-extracted learnings
        {
          agentId,
          projectId: projectName,
          outputSnippet: errorMessage.substring(0, 500),
        }
      );
      console.log(`[Learning Memory] Added pending learning: ${learning.title} (ID: ${pending.pendingId})`);
    }
  } catch (error) {
    console.warn('[Learning Memory] Failed to capture error learning:', error);
  }
}

/**
 * Capture pattern-based learnings (successful patterns, best practices)
 */
export function capturePatternLearning(
  title: string,
  description: string,
  type: 'pattern' | 'best-practice' | 'workaround',
  category: string,
  projectName?: string,
  agentId?: string,
  confidence: number = 0.5
): void {
  try {
    const pendingService = getPendingLearningsService();

    pendingService.add(
      {
        type,
        category,
        title,
        description,
        severity: 'info',
        tags: [category],
        projectName,
      },
      'pattern_detection',
      confidence,
      {
        agentId,
        projectId: projectName,
      }
    );
    console.log(`[Learning Memory] Added pending pattern: ${title}`);
  } catch (error) {
    console.warn('[Learning Memory] Failed to capture pattern learning:', error);
  }
}

/**
 * Capture learnings from completed agent output using LearningAgent
 * Returns extracted learnings for event emission
 */
export function captureAgentOutputLearnings(
  agentRole: string,
  output: string,
  wasSuccessful: boolean,
  projectId?: string,
  techStack?: string[]
): { count: number; pendingIds: string[]; learnings: any[] } {
  try {
    const learningAgent = getLearningAgent({
      autoExtractFromErrors: true,
      maxLearningsToShow: 10,
      showLearningsInPrompt: true,
    });

    // Extract learnings but don't save to permanent store - use pending queue for review
    const { extractedLearnings } = learningAgent.processOutput(
      output,
      {
        taskDescription: `Agent ${agentRole} execution`,
        projectName: projectId,
        techStack: techStack || [],
        agentId: agentRole,
      },
      wasSuccessful,
      { saveToStore: false } // Extract only - add to pending queue for user review
    );

    const pendingIds: string[] = [];

    // Add to pending queue for user review
    if (extractedLearnings.length > 0) {
      const pendingService = getPendingLearningsService();

      for (const learning of extractedLearnings) {
        const pending = pendingService.add(
          learning,
          wasSuccessful ? 'pattern_detection' : 'error_extraction',
          wasSuccessful ? 0.6 : 0.75,
          {
            agentId: agentRole,
            projectId,
            outputSnippet: output.substring(0, 500),
          }
        );
        pendingIds.push(pending.pendingId);
      }

      console.log(`[Learning Memory] 📚 Captured ${extractedLearnings.length} learning(s) from ${agentRole} output:`);
      for (const learning of extractedLearnings) {
        console.log(`  - [${learning.severity}] ${learning.title}`);
      }
    }

    return { count: extractedLearnings.length, pendingIds, learnings: extractedLearnings };
  } catch (error) {
    console.warn(`[Learning Memory] Failed to capture learnings from ${agentRole} output:`, error);
    return { count: 0, pendingIds: [], learnings: [] };
  }
}

/**
 * Detect tech stack from requirements/context
 */
export function detectTechStack(requirements: string): string[] {
  const techKeywords: Record<string, string[]> = {
    'next': ['next', 'nextjs', 'next.js'],
    'react': ['react', 'reactjs'],
    'prisma': ['prisma'],
    'typescript': ['typescript', 'ts'],
    'tailwind': ['tailwind', 'tailwindcss'],
    'postgres': ['postgres', 'postgresql', 'pg'],
    'mongodb': ['mongodb', 'mongo'],
    'redis': ['redis'],
    'graphql': ['graphql', 'apollo'],
    'express': ['express'],
    'node': ['node', 'nodejs'],
    'auth': ['auth', 'authentication', 'nextauth', 'clerk'],
    'stripe': ['stripe', 'payment'],
    'aws': ['aws', 's3', 'lambda', 'dynamodb'],
    'docker': ['docker', 'container'],
  };

  const lowerReqs = requirements.toLowerCase();
  const detected: string[] = [];

  for (const [tech, keywords] of Object.entries(techKeywords)) {
    if (keywords.some(kw => lowerReqs.includes(kw))) {
      detected.push(tech);
    }
  }

  return detected;
}
