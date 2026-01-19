/**
 * Context Builders
 *
 * Functions to build agent context strings for runParallel.
 * Extracted from multi-agent-service.ts for maintainability.
 */

import type { Task } from '../agents/types';
import {
  FILE_HYGIENE_INSTRUCTIONS,
  TESTER_FILE_HYGIENE,
  SECURITY_CONTEXT_TEMPLATE,
} from '../agents/context/templates';

export interface QuickSettings {
  minStories: number;
  maxStories: number;
  minEpics: number;
  maxEpics: number;
}

export interface ContextBuilderOptions {
  requirements: string;
  existingFiles: string;
  skipFoundation: boolean;
  isNewProject: boolean;
  quickSettings: QuickSettings;
  // NEW fields for PO context continuity and cycling
  completedFeatures?: string;      // Summary from build history
  previousStories?: Task[];        // Current build's stories (for pass 2)
  refinementCycle?: number;        // Which pass (1 or 2)
}

/**
 * Build context for Product Owner agent
 */
export function buildProductOwnerContext(options: ContextBuilderOptions): string {
  const { requirements, existingFiles, skipFoundation, isNewProject, quickSettings, completedFeatures, previousStories, refinementCycle } = options;

  // Section for completed features from previous builds
  const completedFeaturesSection = completedFeatures || '';

  // For refinement pass 2, include previous stories for review
  const refinementInstructions = refinementCycle === 2 && previousStories ? `
=== REFINEMENT PASS (Cycle ${refinementCycle}) ===
Review and refine these stories from pass 1:

${previousStories.map((s, i) => `${i + 1}. [${s.id}] ${s.title} (${s.priority || 'medium'})
   ${s.description}
   Criteria: ${(s.acceptanceCriteria || []).join('; ')}`).join('\n\n')}

REFINEMENT TASKS:
1. Check for missing edge cases
2. Verify acceptance criteria are testable
3. Ensure dependencies are correct
4. Add integration/polish stories if needed
5. Verify story points (1-8 scale)

Update .agile-stories.json with refinements.
` : '';

  // For iteration builds on existing projects
  const iterationBuildInstructions = skipFoundation || !isNewProject ? `
🚨🚨🚨 ITERATION BUILD - EXISTING PROJECT 🚨🚨🚨

THIS IS AN ITERATION ON AN EXISTING CODEBASE. YOU MUST:

1️⃣ ANALYZE THE CODEBASE FIRST:
   - List the contents of app/ and components/ directories
   - Read key files to understand existing features
   - Note what pages, components, and APIs already exist

2️⃣ NEVER CREATE STORIES FOR EXISTING FEATURES:
   - If a feature already exists (components, pages, APIs), do NOT create stories for it
   - Example: If app/dashboard already has meal tracking, do NOT create "Implement meal tracking"
   - Example: If components/ActivityTracker.tsx exists, do NOT create "Create activity tracker"

3️⃣ FOCUS ONLY ON NEW REQUIREMENTS:
   - Only create stories for features that DON'T exist yet
   - Only create stories for changes/enhancements to existing features
   - Create stories for new screens, new components, new APIs requested

4️⃣ FORBIDDEN STORY TYPES:
   ❌ NO "Project Setup" or "Foundation" stories
   ❌ NO stories about installing dependencies or configuration
   ❌ NO stories recreating features that already exist in the codebase
   ❌ NO stories with "setup", "scaffold", "bootstrap", "initialize" in the title

EXISTING FILES:
${existingFiles}

⚠️ Read the existing code BEFORE writing stories! Use Bash to explore:
   - ls -la app/ (see existing pages/routes)
   - ls -la components/ (see existing components)
   - Read key files to understand what's built

If the requirements ask for something that ALREADY EXISTS, do NOT create a story for it!
` : '';

  const preScaffoldedWarning = '';  // Merged into iterationBuildInstructions

  const existingProjectWarning = '';  // Merged into iterationBuildInstructions

  // Generate base timestamp for story IDs - PO will increment from this
  const baseTimestamp = Date.now();

  return `
=== CURRENT TIMESTAMP FOR STORY IDs ===
Use this base timestamp for generating story and epic IDs: ${baseTimestamp}
- For stories: story-${baseTimestamp}01, story-${baseTimestamp}02, story-${baseTimestamp}03, etc.
- For epics: epic-${baseTimestamp}01, epic-${baseTimestamp}02, etc.
⚠️ DO NOT make up timestamps! Use the number above as the base.

=== PROJECT REQUIREMENTS ===
${requirements}

${completedFeaturesSection}
${iterationBuildInstructions}
${refinementInstructions}

=== YOUR TASK ===
Create a COMPREHENSIVE set of epics and stories that fully cover ALL requirements above.

TARGET: ${quickSettings.minEpics}-${quickSettings.maxEpics} epics with ${quickSettings.minStories}-${quickSettings.maxStories} total stories

=== DECOMPOSITION CHECKLIST ===
Before writing, mentally identify:
□ What data/models are needed? (database stories)
□ What pages/screens are needed? (UI stories)
□ What API endpoints are needed? (backend stories)
□ What authentication/permissions? (auth stories)
□ What integrations? (API/service stories)
${isNewProject ? '□ Project setup and configuration (foundation stories)' : ''}

=== EPIC EXAMPLES ===
${skipFoundation ? '' : '- "Foundation & Setup" (project init, database, config) - priority: critical\n'}- "User Authentication" (login, signup, sessions) - priority: critical
- "Core Data Models" (main entities, CRUD) - priority: high
- "User Dashboard" (main UI, navigation) - priority: high
- "Feature: [Name]" (specific feature) - priority: medium
- "Integration & Polish" (connecting pieces, error handling) - priority: low

=== STORY EXAMPLES ===
Good: "Create user registration form with email validation"
Bad: "User stuff" (too vague)

Good: "Implement REST API for patient records with CRUD operations"
Bad: "API" (not specific)

=== TASK FORMAT ===
{
  "id": "story-{timestamp}",
  "epicId": "epic-xxx",
  "title": "Verb + specific feature",
  "description": "As a [user type], I want [feature] so that [benefit]",
  "acceptance_criteria": ["Specific criterion 1", "Criterion 2", "Criterion 3"],
  "status": "backlog",
  "priority": "critical|high|medium|low",
  "storyPoints": 1-8,
  "domain": "auth|data|ui|api|infra"
}

=== FILE FORMAT ===
{
  "epics": [{"id": "epic-xxx", "title": "...", "description": "...", "priority": "critical|high|medium|low"}],
  "tasks": [{task objects as shown above}]
}

=== EXECUTION ===
1. READ .agile-stories.json first (preserve existing content)
2. ANALYZE requirements thoroughly - don't miss any features!
3. CREATE epics organized by domain/feature area
4. CREATE stories for EVERY feature mentioned (${quickSettings.minStories}-${quickSettings.maxStories} stories)
5. WRITE complete .agile-stories.json with all epics and stories

${isNewProject ? '✅ NEW PROJECT: Include "Project Setup" epic with foundation stories' : '🚫 EXISTING PROJECT: Skip all setup/config stories'}

START NOW: Read .agile-stories.json then write comprehensive epics and stories`;
}

/**
 * Build context for Coder agent
 */
export function buildCoderContext(options: ContextBuilderOptions): string {
  const { requirements, existingFiles, skipFoundation, isNewProject } = options;

  const preScaffoldedWarning = skipFoundation ? `
🚀 PROJECT IS PRE-SCAFFOLDED - SKIP ALL SETUP! 🚀

CRITICAL - DO NOT DO ANY OF THESE:
❌ DO NOT run npm install - already done
❌ DO NOT run create-next-app - already done
❌ DO NOT run scaffold_project - already done
❌ DO NOT check if node_modules exists - it does
❌ DO NOT verify the build works - it works
❌ DO NOT create package.json - exists
❌ DO NOT create tsconfig.json - exists
❌ DO NOT create tailwind.config - exists
❌ DO NOT pick any story with "setup", "scaffold", "foundation", "initialize" in the title

The project has Next.js 14 + TypeScript + Tailwind ready. Jump straight to FEATURE stories!
` : '';

  const existingProjectWarning = !isNewProject && !skipFoundation ? `
⚠️ THIS IS AN EXISTING PROJECT - DO NOT RUN create-next-app OR npm init!
- Read existing files BEFORE making changes
- Preserve existing code and patterns
- Make minimal, targeted changes
` : '';

  const storySelection = skipFoundation ? `
⚠️ SKIP these story types (mark as "done" immediately without implementing):
- Any story with "setup", "scaffold", "foundation", "bootstrap", "initialize" in title
- Any story with domain="infra" that involves project setup
- Any story about installing dependencies or configuring build tools

START WITH: First non-setup story (usually UI or feature stories)
` : `
1. Stories with priority="critical" first (foundation/blocking)
2. Stories with priority="high" next (core functionality)
`;

  return `Requirements:\n${requirements}${existingFiles}
${preScaffoldedWarning}${existingProjectWarning}
Implement user stories from .agile-stories.json.

=== STORY SELECTION ===
${storySelection}
3. Check "dependsOn" field - skip stories whose dependencies aren't done yet
4. Pick stories with status="backlog"

=== WORKFLOW ===
1. Read .agile-stories.json to find stories
2. Pick the next eligible backlog story${skipFoundation ? ' (SKIP all setup stories!)' : ''}
3. Update status to "in_progress"
4. Implement the feature completely
5. Run "./node_modules/.bin/tsc --noEmit" to verify types (do NOT run npm run build or npx!)
6. Update status to "testing" when done
7. Repeat for next story

${FILE_HYGIENE_INSTRUCTIONS}`;
}

/**
 * Build context for Tester agent
 */
export function buildTesterContext(requirements: string, existingFiles: string): string {
  return `Requirements:\n${requirements}${existingFiles}

Test stories that are ready for testing and report results.

WORKFLOW: Test assigned story → write tests → run_tests → report_test_results → STOP and wait for next assignment

Test stories assigned to you in "testing" status. Do NOT call list_tasks() - the coordinator assigns stories to you.
Call report_test_results() after running tests - this automatically:
- Marks stories as DONE if tests pass
- Routes stories back to Coder if tests fail

${TESTER_FILE_HYGIENE}`;
}

/**
 * Build context for Security agent
 */
export function buildSecurityContext(requirements: string, existingFiles: string): string {
  return `Requirements:\n${requirements}${existingFiles}\n${SECURITY_CONTEXT_TEMPLATE}`;
}
