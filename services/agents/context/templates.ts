/**
 * Context Templates
 *
 * Static workflow templates and context strings extracted from multi-agent-service.ts
 * These are template strings with placeholders that get filled in at runtime.
 */

/**
 * Coder workflow template for multiple stories
 */
export const CODER_MULTI_STORY_WORKFLOW = `
WORKFLOW FOR EACH STORY:
1. Call start_story("STORY_ID") - marks as in_progress
2. Implement the story
3. Run: ./node_modules/.bin/tsc --noEmit (type check only - DO NOT run npm run build!)
4. Fix any TypeScript errors
5. Call mark_ready_for_testing("STORY_ID") when done
6. Move to the next story immediately

⚠️ CRITICAL: Do NOT run "npm run build" - testers handle builds!
⚠️ CRITICAL: Do NOT run "npx tsc" or "npx prisma" - use ./node_modules/.bin/ instead!
⚠️ CRITICAL: Do NOT run "npm install" - already done before you started!
⚠️ IMPORTANT: After completing all stories, re-read .agile-stories.json to check if new stories arrived in "backlog" status while you were working. Keep implementing until no more stories need coding!`;

/**
 * Coder workflow template for single story
 */
export const CODER_SINGLE_STORY_WORKFLOW = `
Implement this story, run "./node_modules/.bin/tsc --noEmit" to verify types, then call mark_ready_for_testing("STORY_ID").

⚠️ Do NOT run "npm run build" - testers handle builds!
⚠️ Do NOT run "npx tsc" or "npx prisma" - use ./node_modules/.bin/ instead!
⚠️ Do NOT run "npm install" - already done before you started!

After completing this story, call list_tasks() to find more stories. For each new story: start_story("ID") → implement → ./node_modules/.bin/tsc --noEmit → mark_ready_for_testing("ID").`;

/**
 * Coder workflow for failed story retry
 */
export const CODER_FAILED_STORY_WORKFLOW = `
INSTRUCTIONS:
1. Read the relevant files and understand what went wrong
2. Fix the issue causing the test failure
3. Run "./node_modules/.bin/tsc --noEmit" to verify types (do NOT run npm run build!)
4. When fixed, call mark_ready_for_testing("STORY_ID")

⚠️ Do NOT run "npx tsc" or "npx prisma" - use ./node_modules/.bin/ instead!
Focus on fixing the specific issue - don't rewrite everything!`;

/**
 * Tester workflow template
 */
export const TESTER_WORKFLOW = `
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

5. Update the story status in .agile-stories.json to "done"

⚠️ YOU MUST create .test-results-{story-id}.json after EVERY story - the UI dashboard monitors these files!`;

/**
 * Security context template
 */
export const SECURITY_CONTEXT_TEMPLATE = `
YOUR TASK: Security scan of the codebase

1. First, use list_files to see all source files
2. Read each file and check for security issues
3. Look for: XSS, injection, hardcoded secrets, insecure dependencies
4. Report any findings using report_vulnerability tool

Announce what file you're scanning as you go.`;

/**
 * File hygiene instructions (shared between coder and tester)
 */
export const FILE_HYGIENE_INSTRUCTIONS = `
=== FILE HYGIENE ===
- Only create files that are necessary for the feature
- Do NOT create empty files, placeholder files, or .nul files
- Do NOT create README.md, CHANGELOG.md, or documentation files unless explicitly requested
- If a file is not needed, don't create it`;

/**
 * Tester file hygiene instructions
 */
export const TESTER_FILE_HYGIENE = `
=== FILE HYGIENE ===
- Only create test files that are necessary
- Do NOT create empty files, placeholder files, or .nul files
- Put tests in __tests__ folders or .test.ts/.spec.ts files
- Do NOT create unnecessary documentation files`;

/**
 * Build test results JSON template
 */
export const TEST_RESULTS_JSON_TEMPLATE = {
  task_id: 'story-id-here',
  task_title: 'Story title here',
  passed: true,
  total_tests: 0,
  passed_tests: 0,
  failed_tests: 0,
  summary: '',
  error_output: '',
  coverage: 0,
};

/**
 * Helper to format a story for display in context
 */
export function formatStoryForContext(
  story: { id: string; title: string; description: string; acceptanceCriteria?: string[] },
  index: number,
  isStartStory = false
): string {
  const acList = story.acceptanceCriteria?.length
    ? `\n   Acceptance Criteria:\n${story.acceptanceCriteria.map((ac, j) => `   ${j + 1}. ${ac}`).join('\n')}`
    : '';
  const startMarker = isStartStory ? ' ← START HERE' : '';
  return `
STORY ${index + 1}: "${story.title}" (ID: ${story.id})${startMarker}
   ${story.description}${acList}`;
}

/**
 * Helper to format remaining stories summary
 */
export function formatStorySummary(
  stories: Array<{ id: string; title: string; status: string }>
): string {
  const remaining = stories.filter(t => t.status !== 'done' && t.status !== 'completed');
  if (remaining.length === 0) return '';
  return `\n\nRemaining stories:\n${remaining.map((t, i) => `${i + 1}. [${t.id}] ${t.title} (status: ${t.status})`).join('\n')}`;
}

/**
 * Helper to format locked files warning
 */
export function formatLockedFilesWarning(lockedFiles: string[]): string {
  if (lockedFiles.length === 0) return '';
  return `\n\n⚠️ FILES LOCKED BY OTHER CODERS:\n${lockedFiles.map(f => `- ${f}`).join('\n')}\nDO NOT edit these files!`;
}
