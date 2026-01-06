/**
 * Smart Learning Extractor
 *
 * Uses Claude CLI (subscription) to analyze agent output and extract high-quality learnings.
 * Focuses on actionable insights, not generic errors.
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Learning } from './learning-store';

// ============================================================================
// Types
// ============================================================================

export interface ExtractionContext {
  storyTitle: string;
  storyDescription: string;
  projectName?: string;
  techStack?: string[];
  wasSuccessful: boolean;
}

export interface ExtractedInsight {
  type: Learning['type'];
  category: string;
  title: string;
  description: string;
  solution?: string;
  severity: 'info' | 'warning' | 'critical';
  tags: string[];
  confidence: number;
  reasoning: string;
}

// ============================================================================
// Smart Learning Extractor
// ============================================================================

export class SmartLearningExtractor {
  private model = 'haiku'; // Use haiku for fast, cheap extraction

  /**
   * Extract high-quality learnings from agent output using Claude CLI
   */
  async extract(
    output: string,
    context: ExtractionContext
  ): Promise<ExtractedInsight[]> {
    // Skip if output is too short
    if (!output || output.length < 100) {
      return [];
    }

    // Truncate very long output to focus on the most relevant parts
    const truncatedOutput = this.truncateOutput(output, 8000);
    const prompt = this.buildPrompt(truncatedOutput, context);

    try {
      const response = await this.runClaudeCLI(prompt);
      return this.parseResponse(response);
    } catch (error) {
      console.error('[SmartLearningExtractor] Error extracting learnings:', error);
      return [];
    }
  }

  /**
   * Run Claude CLI with the given prompt and return the response
   */
  private async runClaudeCLI(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const processId = `extract-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Write prompt to temp file to avoid command line length limits
      const tempDir = os.tmpdir();
      const promptFile = path.join(tempDir, `claude-extract-${processId}.txt`);
      fs.writeFileSync(promptFile, prompt, 'utf-8');

      // Build CLI arguments - simple print mode
      const args = [
        '-p',  // Print mode (non-interactive)
        '--model', this.model,
        '--max-turns', '1',  // Single turn for extraction
      ];

      // Create clean environment without API key (forces subscription)
      const cleanEnv = { ...process.env };
      delete cleanEnv.ANTHROPIC_API_KEY;

      // Spawn Claude CLI
      const child = spawn('claude', args, {
        cwd: process.cwd(),
        env: cleanEnv,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Send prompt via stdin
      child.stdin?.write(prompt);
      child.stdin?.end();

      child.on('close', (code) => {
        // Clean up temp file
        try {
          fs.unlinkSync(promptFile);
        } catch {
          // Ignore cleanup errors
        }

        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (err) => {
        // Clean up temp file
        try {
          fs.unlinkSync(promptFile);
        } catch {
          // Ignore cleanup errors
        }
        reject(err);
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        child.kill();
        reject(new Error('Claude CLI timeout'));
      }, 30000);
    });
  }

  /**
   * Build the extraction prompt - STRICT quality filter
   */
  private buildPrompt(output: string, context: ExtractionContext): string {
    return `You are a VERY STRICT filter looking for genuinely valuable learnings from AI agent output.

## Context
- **Story**: ${context.storyTitle}
- **Project**: ${context.projectName || 'Unknown'}
- **Tech Stack**: ${context.techStack?.join(', ') || 'Not specified'}
- **Outcome**: ${context.wasSuccessful ? 'SUCCESS' : 'FAILED'}

## Agent Output
\`\`\`
${output}
\`\`\`

## STRICT Extraction Rules

Extract **AT MOST 1** learning. Most outputs should return **EMPTY ARRAY []**.

### ONLY extract if ALL of these are true:
1. **Surprising** - Something a senior dev might not know
2. **Specific** - Includes exact library versions, config keys, or code patterns
3. **Reproducible** - The same issue would occur for others in similar situations
4. **Actionable** - Clear "do X instead of Y" guidance
5. **Time-saving** - Would save someone 30+ minutes of debugging

### Examples of GOOD learnings worth saving:
- "Prisma 5.x silently ignores @db.Text on SQLite - use String instead"
- "Next.js 14 App Router: cookies() in layout.tsx forces dynamic rendering for ALL child routes"
- "TanStack Query v5: suspense option was removed, use useSuspenseQuery instead"

### SKIP all of these (return []):
- Generic errors: "Module not found", "Type error", "Build failed"
- Standard fixes: "Run npm install", "Add missing import", "Fix typo"
- Documentation basics: "Add 'use client'", "Export the component"
- Temporary issues: "File was missing", "Wrong path"
- Obvious patterns: "Use async/await", "Handle errors"
- Vague advice: "Check the configuration", "Verify the setup"
- Story-specific: Things only relevant to THIS exact implementation

### When in doubt, return []
It's better to miss a learning than save a useless one.

## Response Format
Return JSON array with 0 or 1 items. Empty array is the expected common case.

\`\`\`json
[
  {
    "type": "gotcha|pattern|workaround|best-practice|error-solution|config",
    "category": "specific category",
    "title": "Exact, specific title with versions/details (max 80 chars)",
    "description": "Precise explanation including: what happens, why it happens, when it happens",
    "solution": "Exact fix: do X instead of Y",
    "severity": "warning|critical",
    "tags": ["library-name", "version"],
    "confidence": 0.9,
    "reasoning": "Why a senior dev would want to know this"
  }
]
\`\`\`

Return ONLY the JSON array.`;
  }

  /**
   * Parse the LLM response into structured insights
   */
  private parseResponse(text: string): ExtractedInsight[] {
    try {
      // Extract JSON from the response (handle markdown code blocks)
      let jsonStr = text.trim();

      // Remove markdown code blocks if present
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      // Try to find JSON array in the response
      const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        jsonStr = arrayMatch[0];
      }

      const parsed = JSON.parse(jsonStr);

      if (!Array.isArray(parsed)) {
        return [];
      }

      // Define the expected shape of parsed items
      interface ParsedInsight {
        type?: string;
        category?: string;
        title?: string;
        description?: string;
        solution?: string;
        severity?: string;
        tags?: string[];
        confidence?: number;
        reasoning?: string;
      }

      // Validate and filter - STRICT: only 85%+ confidence
      return (parsed as ParsedInsight[])
        .filter((item) => {
          return (
            item.type &&
            item.title &&
            item.description &&
            (item.confidence ?? 0) >= 0.85 // Only keep very high-confidence learnings
          );
        })
        .map((item) => ({
          type: item.type as ExtractedInsight['type'],
          category: item.category || 'general',
          title: (item.title || '').slice(0, 100),
          description: item.description || '',
          solution: item.solution,
          severity: (item.severity || 'info') as 'info' | 'warning' | 'critical',
          tags: Array.isArray(item.tags) ? item.tags : [],
          confidence: Math.min(1, Math.max(0, item.confidence ?? 0)),
          reasoning: item.reasoning || '',
        }));
    } catch (error) {
      console.error('[SmartLearningExtractor] Failed to parse response:', error);
      return [];
    }
  }

  /**
   * Truncate output intelligently, keeping the most relevant parts
   */
  private truncateOutput(output: string, maxLength: number): string {
    if (output.length <= maxLength) {
      return output;
    }

    // Keep the beginning (context) and end (results/errors)
    const halfLength = Math.floor(maxLength / 2);
    const beginning = output.slice(0, halfLength);
    const end = output.slice(-halfLength);

    return `${beginning}\n\n[... truncated ${output.length - maxLength} characters ...]\n\n${end}`;
  }

  /**
   * Convert extracted insight to Learning format
   */
  insightToLearning(insight: ExtractedInsight, context: ExtractionContext): Learning {
    return {
      type: insight.type,
      category: insight.category,
      title: insight.title,
      description: insight.description,
      solution: insight.solution,
      severity: insight.severity,
      tags: insight.tags,
      projectName: context.projectName,
    };
  }
}

// ============================================================================
// Singleton
// ============================================================================

let instance: SmartLearningExtractor | null = null;

export function getSmartLearningExtractor(): SmartLearningExtractor {
  if (!instance) {
    instance = new SmartLearningExtractor();
  }
  return instance;
}

export default SmartLearningExtractor;
