/**
 * Build Adapter
 *
 * Integrates healthcare modules with the /build (complex build) system.
 * Provides prompt injection and file pre-population for AI agents.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { getHealthcareModuleRegistry } from '../registry';
import { AgentBuildAdapterResult, ModuleMatchOptions, ModuleMatch } from '../types';

// =============================================================================
// BUILD ADAPTER
// =============================================================================

/**
 * Match healthcare modules for a story
 */
export function matchModulesForStory(
  storyTitle: string,
  storyDescription: string,
  storyTags?: string[],
  domainId?: string,
  options?: ModuleMatchOptions
): ModuleMatch[] {
  const registry = getHealthcareModuleRegistry();
  return registry.matchForStory(
    storyTitle,
    storyDescription,
    storyTags,
    domainId,
    {
      minScore: 40,
      maxMatches: 2, // Limit to 2 for agent context
      ...options,
    }
  );
}

/**
 * Get agent build context for matched modules
 */
export function getAgentBuildContext(
  storyTitle: string,
  storyDescription: string,
  storyTags?: string[],
  domainId?: string
): AgentBuildAdapterResult {
  const registry = getHealthcareModuleRegistry();
  const matches = matchModulesForStory(storyTitle, storyDescription, storyTags, domainId);

  if (matches.length === 0) {
    return {
      promptContext: '',
      files: [],
      acceptanceCriteria: [],
      matchedModules: [],
    };
  }

  // Build prompt context
  const contextParts: string[] = [];
  const allFiles: Array<{ path: string; content: string }> = [];
  const allCriteria: string[] = [];
  const matchedModuleIds: string[] = [];

  for (const match of matches) {
    const module = registry.get(match.moduleId);
    if (!module) continue;

    // Add module context
    contextParts.push(registry.getAgentContext(match.moduleId));

    // Collect files
    const moduleFiles = registry.getAgentBuildFiles(match.moduleId);
    allFiles.push(...moduleFiles);

    // Collect acceptance criteria
    allCriteria.push(...module.agentBuild.acceptanceCriteria);

    matchedModuleIds.push(match.moduleId);
  }

  return {
    promptContext: contextParts.join('\n\n'),
    files: allFiles,
    acceptanceCriteria: allCriteria,
    matchedModules: matchedModuleIds,
  };
}

/**
 * Copy module files to a project directory
 */
export async function copyModulesToProject(
  projectDir: string,
  moduleIds: string[]
): Promise<string[]> {
  const registry = getHealthcareModuleRegistry();
  const copiedFiles: string[] = [];

  for (const moduleId of moduleIds) {
    const files = registry.getAgentBuildFiles(moduleId);

    for (const file of files) {
      const targetPath = path.join(projectDir, file.path);

      // Ensure directory exists
      await fs.mkdir(path.dirname(targetPath), { recursive: true });

      // Write file
      await fs.writeFile(targetPath, file.content, 'utf-8');
      copiedFiles.push(file.path);
    }
  }

  return copiedFiles;
}

/**
 * Get Product Owner context about available modules
 */
export function getProductOwnerModuleContext(requirements: string): string {
  const registry = getHealthcareModuleRegistry();

  if (!registry.isHealthcareProject(requirements)) {
    return '';
  }

  return `
=== HEALTHCARE MODULE LIBRARY ===
The following pre-built healthcare modules are available. When creating stories,
you can tag them with "module:<module-id>" to use pre-built implementations:

${registry.getModuleSummaryForPO()}

When a story can benefit from a module, add the tag. Example:
{ "tags": ["module:patient-fhir-display", "epic", "fhir"] }

This helps coders work faster with pre-tested, HIPAA-compliant code.
===
`;
}

/**
 * Enhance a story prompt with module context
 */
export function enhanceStoryPrompt(
  basePrompt: string,
  storyTitle: string,
  storyDescription: string,
  storyTags?: string[]
): string {
  // Check for explicit module tag first
  const moduleTag = storyTags?.find(t => t.startsWith('module:'));

  if (moduleTag) {
    const moduleId = moduleTag.replace('module:', '');
    const registry = getHealthcareModuleRegistry();
    const context = registry.getAgentContext(moduleId);

    if (context) {
      return `${basePrompt}\n\n${context}`;
    }
  }

  // Otherwise, try to match modules automatically
  const { promptContext, matchedModules } = getAgentBuildContext(
    storyTitle,
    storyDescription,
    storyTags
  );

  if (promptContext && matchedModules.length > 0) {
    return `${basePrompt}\n\n${promptContext}`;
  }

  return basePrompt;
}

// =============================================================================
// STORY ANALYSIS
// =============================================================================

/**
 * Analyze stories for module opportunities
 */
export function analyzeStoriesForModules(
  stories: Array<{
    id: string;
    title: string;
    description: string;
    tags?: string[];
    domainId?: string;
  }>
) {
  const registry = getHealthcareModuleRegistry();
  return registry.analyzeStories(stories);
}

/**
 * Add module tags to stories based on analysis
 */
export function autoTagStoriesWithModules(
  stories: Array<{
    id: string;
    title: string;
    description: string;
    tags?: string[];
    domainId?: string;
  }>
): Array<{
  id: string;
  title: string;
  description: string;
  tags: string[];
  domainId?: string;
  moduleMatch?: ModuleMatch;
}> {
  const registry = getHealthcareModuleRegistry();

  return stories.map(story => {
    const matches = registry.matchForStory(
      story.title,
      story.description,
      story.tags,
      story.domainId,
      { minScore: 50, maxMatches: 1 } // Only add tag if high confidence
    );

    const tags = [...(story.tags || [])];

    if (matches.length > 0 && !tags.some(t => t.startsWith('module:'))) {
      tags.push(`module:${matches[0].moduleId}`);
    }

    return {
      ...story,
      tags,
      moduleMatch: matches[0],
    };
  });
}
