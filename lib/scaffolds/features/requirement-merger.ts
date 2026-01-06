/**
 * Requirements Merger
 * Merges template requirements with user requirements
 */

import { MergeResult, TemplateTests, TemplateTestFile } from './types';
import { getTemplateRegistry } from './registry';

/**
 * Count tests from either format
 */
function countTests(tests: TemplateTestFile[] | TemplateTests | undefined): number {
  if (!tests) return 0;

  if (Array.isArray(tests)) {
    return tests.length;
  }

  // TemplateTests object
  return (tests.unit?.length || 0) + (tests.integration?.length || 0) + (tests.e2e?.length || 0);
}

/**
 * Merge template requirements with user requirements
 * Template requirements are prepended with a section header
 */
export function mergeRequirements(
  userRequirements: string,
  templateIds: string[]
): MergeResult {
  const registry = getTemplateRegistry();
  const templatesIncluded: string[] = [];
  const addedSections: string[] = [];

  // Collect template requirements sorted by priority
  const templateReqs: Array<{ name: string; text: string; priority: number }> = [];

  for (const templateId of templateIds) {
    const template = registry.get(templateId);
    if (template) {
      templateReqs.push({
        name: template.name,
        text: template.requirements.text,
        priority: template.requirements.priority,
      });
      templatesIncluded.push(template.name);
    }
  }

  // Sort by priority (highest first)
  templateReqs.sort((a, b) => b.priority - a.priority);

  // If no templates, return original requirements
  if (templateReqs.length === 0) {
    return {
      mergedRequirements: userRequirements,
      templatesIncluded: [],
      addedSections: [],
    };
  }

  // Build the merged requirements
  const parts: string[] = [];

  // Add pre-built features section
  parts.push('## Pre-Built Features (from templates)\n');
  parts.push('The following features have been pre-scaffolded with working components, API routes, and tests:\n');

  for (const { name } of templateReqs) {
    parts.push(`- **${name}**`);
  }
  parts.push('');

  // Add each template's requirements
  for (const { name, text } of templateReqs) {
    parts.push(`---\n`);
    parts.push(text.trim());
    parts.push('');
    addedSections.push(name);
  }

  parts.push('---\n');
  parts.push('## Additional Requirements\n');
  parts.push(userRequirements);

  return {
    mergedRequirements: parts.join('\n'),
    templatesIncluded,
    addedSections,
  };
}

/**
 * Get just the template requirements section (for preview)
 */
export function getTemplateRequirementsSection(templateIds: string[]): string {
  const registry = getTemplateRegistry();
  const parts: string[] = [];

  for (const templateId of templateIds) {
    const template = registry.get(templateId);
    if (template) {
      parts.push(`### ${template.name}`);
      parts.push(template.requirements.text.trim());
      parts.push('');
    }
  }

  return parts.join('\n');
}

/**
 * Get agent instructions from templates
 * These are injected into agent prompts for context
 */
export function getTemplateAgentInstructions(templateIds: string[]): string {
  const registry = getTemplateRegistry();
  const parts: string[] = [];

  for (const templateId of templateIds) {
    const template = registry.get(templateId);
    if (template?.agentInstructions) {
      parts.push(`## ${template.name} - Template Guidance\n`);
      parts.push(template.agentInstructions.trim());
      parts.push('');
    }
  }

  return parts.join('\n');
}

/**
 * Get a summary of applied templates for logging
 */
export function getTemplateSummary(templateIds: string[]): string {
  const registry = getTemplateRegistry();
  const summaries: string[] = [];

  for (const templateId of templateIds) {
    const template = registry.get(templateId);
    if (template) {
      summaries.push(`${template.name} (${template.files.length} files, ${countTests(template.tests)} tests)`);
    }
  }

  return summaries.join(', ');
}
