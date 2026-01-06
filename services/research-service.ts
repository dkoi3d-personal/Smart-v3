/**
 * Research Service
 * Uses Claude CLI (via subscription) to analyze codebases and answer questions
 */

import {
  getProjectStructure,
  findFilesByPatterns,
  readFiles,
  isCodeFile,
  type FileInfo,
} from './project-scanner';
import { ClaudeSubscriptionService } from './claude-subscription-service';

export interface ResearchMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ResearchResult {
  answer: string;
  referencedFiles: string[];
  notes: string[];
  suggestedBuild?: {
    title: string;
    description: string;
    estimatedStories: number;
  };
}

// Keywords to file patterns mapping for smart file selection
const KEYWORD_PATTERNS: Record<string, string[]> = {
  'api': ['api/', 'route.ts', 'route.js', 'routes/'],
  'route': ['api/', 'route.ts', 'route.js', 'page.tsx', 'page.ts', 'routes/'],
  'endpoint': ['api/', 'route.ts', 'route.js', 'routes/'],
  'component': ['components/', '.tsx', '.jsx'],
  'hook': ['hooks/', 'use'],
  'service': ['services/', 'service.ts', 'service.js'],
  'type': ['types.ts', 'types/', '.d.ts', 'interfaces'],
  'config': ['config', '.config.', 'settings'],
  'test': ['test', 'spec', '__tests__'],
  'style': ['.css', '.scss', 'tailwind', 'styles/'],
  'database': ['prisma', 'db', 'database', 'schema', 'models/'],
  'auth': ['auth', 'login', 'session', 'middleware'],
  'state': ['store', 'context', 'redux', 'zustand', 'atom'],
  'util': ['utils/', 'helpers/', 'lib/'],
  'page': ['page.tsx', 'page.ts', 'pages/'],
  'layout': ['layout.tsx', 'layout.ts', '_app'],
};

// Singleton instance
let claudeService: ClaudeSubscriptionService | null = null;

function getClaudeService(): ClaudeSubscriptionService {
  if (!claudeService) {
    claudeService = new ClaudeSubscriptionService();
  }
  return claudeService;
}

/**
 * Extract patterns from question based on keywords
 */
function extractPatterns(question: string): string[] {
  const questionLower = question.toLowerCase();
  const patterns: string[] = [];

  for (const [keyword, keywordPatterns] of Object.entries(KEYWORD_PATTERNS)) {
    if (questionLower.includes(keyword)) {
      patterns.push(...keywordPatterns);
    }
  }

  // Default patterns if no keywords matched
  if (patterns.length === 0) {
    patterns.push('page.tsx', 'route.ts', 'index.ts', 'index.tsx', 'README');
  }

  return Array.from(new Set(patterns)); // Remove duplicates
}

/**
 * Build file context string from file contents
 */
function buildFileContext(files: { path: string; content: string }[]): string {
  if (files.length === 0) return '';

  let context = '';
  for (const file of files) {
    // Truncate very long files
    const content = file.content.length > 10000
      ? file.content.slice(0, 10000) + '\n... (truncated)'
      : file.content;
    context += `\n--- ${file.path} ---\n${content}\n`;
  }

  return context;
}

/**
 * Extract notes from answer (bullet points or key sentences)
 */
function extractNotes(answer: string): string[] {
  const notes: string[] = [];
  const lines = answer.split('\n').filter(l => l.trim());

  for (const line of lines) {
    // Look for bullet points
    if (line.match(/^[-•*]\s+/) || line.match(/^\d+\.\s+/)) {
      const note = line.replace(/^[-•*\d.]+\s*/, '').trim();
      if (note.length > 10 && note.length < 200) {
        notes.push(note);
      }
    }
    if (notes.length >= 5) break;
  }

  return notes;
}

/**
 * Check if answer suggests a build action
 */
function checkForBuildSuggestion(
  answer: string,
  question: string
): ResearchResult['suggestedBuild'] | undefined {
  const answerLower = answer.toLowerCase();

  const suggestsBuild =
    answerLower.includes('you could implement') ||
    answerLower.includes('you could add') ||
    answerLower.includes('to add this feature') ||
    answerLower.includes('you might want to create') ||
    answerLower.includes('consider adding');

  if (suggestsBuild) {
    return {
      title: 'Implement suggested changes',
      description: question,
      estimatedStories: 2,
    };
  }

  return undefined;
}

/**
 * Main research function - analyzes codebase and answers questions
 * Uses Claude CLI (subscription) - no API key needed
 */
export async function researchCodebase(
  projectDir: string,
  question: string,
  previousMessages: ResearchMessage[] = []
): Promise<ResearchResult> {
  console.log('[ResearchService] Starting research for:', projectDir);
  console.log('[ResearchService] Question:', question.slice(0, 100));

  try {
    // 1. Scan project structure
    console.log('[ResearchService] Scanning project structure...');
    const projectStructure = await getProjectStructure(projectDir, { maxDepth: 4 });
    console.log('[ResearchService] Found', projectStructure.totalFiles, 'files');

    // 2. Find relevant files based on question
    const patterns = extractPatterns(question);
    console.log('[ResearchService] Search patterns:', patterns.slice(0, 5));
    const relevantFileInfos = findFilesByPatterns(projectStructure.files, patterns)
      .filter(f => isCodeFile(f.path))
      .slice(0, 15); // Limit to 15 files
    console.log('[ResearchService] Found', relevantFileInfos.length, 'relevant files');

    // 3. Read the relevant files
    const relevantFiles = await readFiles(
      projectDir,
      relevantFileInfos.map(f => f.path),
      { maxFileSize: 50000 }
    );
    console.log('[ResearchService] Read', relevantFiles.length, 'files');

    // 4. Build context
    const fileContext = buildFileContext(relevantFiles);

    // 5. Build the prompt with conversation history
    let conversationContext = '';
    if (previousMessages.length > 0) {
      conversationContext = '\nPrevious conversation:\n' +
        previousMessages.map(m => `${m.role}: ${m.content}`).join('\n') + '\n';
    }

    const prompt = `You are a helpful code research assistant. You analyze codebases and answer questions about them.

Your task is to help the user understand their codebase by answering questions about:
- Project structure and organization
- How features are implemented
- Where specific code is located
- Patterns and conventions used
- Dependencies and relationships between files

Guidelines:
- Be specific and reference actual file paths when answering
- Quote relevant code directly when helpful
- Keep answers concise but thorough
- Use markdown formatting for code blocks
- If you can't find something, say so clearly

Project Directory: ${projectDir}

${projectStructure.summary}

${fileContext ? `Relevant Files:\n${fileContext}` : 'No specific files matched the query patterns.'}
${conversationContext}
Question: ${question}

Please analyze the codebase and answer the question. Reference specific files and code when relevant.`;

    // 6. Call Claude via CLI
    console.log('[ResearchService] Calling Claude via CLI...');
    const service = getClaudeService();

    let answer = '';
    for await (const message of service.runAgent(prompt, {
      model: 'sonnet', // Use Sonnet for faster research responses
      maxTurns: 1, // Research is single-turn
      workingDirectory: projectDir,
      permissionMode: 'default', // No file modifications needed
    })) {
      if (message.type === 'text') {
        answer += message.content;
      } else if (message.type === 'error') {
        console.error('[ResearchService] Claude error:', message.content);
        throw new Error(message.content);
      }
    }

    console.log('[ResearchService] Got response, length:', answer.length);

    // 7. Build result
    return {
      answer,
      referencedFiles: relevantFiles.map(f => f.path),
      notes: extractNotes(answer),
      suggestedBuild: checkForBuildSuggestion(answer, question),
    };
  } catch (error) {
    console.error('[ResearchService] Error:', error);
    throw error;
  }
}

/**
 * Quick file search - find files matching a pattern
 */
export async function searchFiles(
  projectDir: string,
  searchPatterns: string[]
): Promise<FileInfo[]> {
  const projectStructure = await getProjectStructure(projectDir);
  return findFilesByPatterns(projectStructure.files, searchPatterns);
}
