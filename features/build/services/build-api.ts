/**
 * Build API Service
 *
 * Handles all calls to /api/v2/multi-agent for builds.
 * With clean-slate architecture, every build starts fresh with empty stories.
 * Previous builds are archived to .build-history/ folder.
 */

export interface CoderConfig {
  parallelCoders: number;
  batchMode: boolean;
  batchSize: number;
}

export interface BuildConfig {
  projectId: string;
  requirements: string;
  mode: 'build' | 'plan';
  agents: string[];
  coderConfig: CoderConfig;
}

/**
 * Start a multi-agent build
 * Returns the response for SSE streaming
 */
export async function startMultiAgentBuild(
  config: BuildConfig,
  signal?: AbortSignal
): Promise<Response> {
  const response = await fetch('/api/v2/multi-agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: config.projectId,
      requirements: config.requirements,
      mode: config.mode,
      agents: config.agents,
      coderConfig: config.coderConfig,
    }),
    signal,
  });

  if (!response.body) {
    throw new Error('No response body from multi-agent API');
  }

  return response;
}

/**
 * Archive current build and start a new one
 * Call this to start a subsequent build on an existing project
 */
export async function startNewBuildOnExistingProject(
  projectId: string,
  projectDirectory: string,
  requirements: string,
  coderConfig: CoderConfig,
  signal?: AbortSignal
): Promise<{ response: Response; buildNumber: number }> {
  // First, archive current build and start new one via build-history API
  const archiveResponse = await fetch('/api/build-history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'start',
      projectId,
      projectDirectory,
      prompt: requirements,
    }),
  });

  if (!archiveResponse.ok) {
    const error = await archiveResponse.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to archive and start new build');
  }

  const archiveData = await archiveResponse.json();
  const buildNumber = archiveData.buildNumber;

  // Now start the actual build
  const buildConfig: BuildConfig = {
    projectId,
    requirements: buildExistingProjectRequirements(requirements),
    mode: 'build',
    agents: ['product_owner', 'coder', 'tester', 'security'],
    coderConfig,
  };

  const response = await startMultiAgentBuild(buildConfig, signal);
  return { response, buildNumber };
}

/**
 * Build requirements prompt for existing project
 * Adds instructions for PO, Coder, Tester to work on existing codebase
 */
export function buildExistingProjectRequirements(userPrompt: string): string {
  return `
BUILD REQUEST: ${userPrompt}

=== PRODUCT OWNER INSTRUCTIONS ===
Create stories for this build by writing to .agile-stories.json

FORBIDDEN: Do NOT create "Project Setup", "Configuration", or "Initialize" stories - project already exists!
Only create stories for the SPECIFIC changes requested: "${userPrompt}"

Write stories with this format:
{
  "id": "story-${Date.now()}-X",
  "epicId": "epic-xxx",
  "title": "Feature name based on request",
  "description": "As a user, I want...",
  "acceptance_criteria": ["User can do X", "System shows Y", "Feature works when Z"],
  "status": "backlog",
  "priority": "high",
  "storyPoints": 3
}

DO NOT read source code, write code, or ask questions. Just update .agile-stories.json.

=== CODER INSTRUCTIONS ===
EXISTING PROJECT - Do NOT run create-next-app or npm init!
1. READ existing files before modifying
2. Make minimal, targeted changes
3. Preserve existing functionality
4. Use SAME patterns/styles as existing code

=== TESTER INSTRUCTIONS ===
1. Focus tests on NEW changes only
2. Run existing tests to ensure nothing broke

=== SECURITY INSTRUCTIONS ===
1. Quick scan of changed files only
`;
}

/**
 * Build Figma requirements for existing project
 */
export function buildFigmaExistingProjectRequirements(
  designName: string,
  designRequirements: string,
  userContext?: string
): string {
  return `
FIGMA BUILD: ${designName}

${userContext ? `User Context: ${userContext}\n` : ''}
Design Requirements: ${designRequirements || 'Implement the design as shown in the Figma file.'}

=== PRODUCT OWNER INSTRUCTIONS ===
Create stories for this Figma build by writing to .agile-stories.json
Read figma-context.json for the full design context including screens and components.

FORBIDDEN: Do NOT create "Project Setup" or "Initialize" stories - project already exists!

Write stories with this format:
{
  "id": "story-figma-${Date.now()}-X",
  "epicId": "epic-figma-xxx",
  "title": "Implement [component/screen] from Figma",
  "description": "As a user, I want...",
  "acceptance_criteria": ["Matches Figma design exactly", "Responsive", "Accessible"],
  "status": "backlog",
  "priority": "high",
  "storyPoints": 3
}

=== CODER INSTRUCTIONS ===
EXISTING PROJECT - Read files before modifying. Use patterns from existing code.
Reference images in figma-frames/ directory. Use icons from figma-icons/ directory.

=== TESTER INSTRUCTIONS ===
Focus on NEW changes. Run existing tests to ensure nothing broke.
  `.trim();
}
