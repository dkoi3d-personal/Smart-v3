/**
 * Design System Prompt Generator
 *
 * Generates prompt sections that are injected into coder agent prompts
 * to guide UI code generation according to the selected design system.
 *
 * Two modes:
 * 1. Legacy: Full design system docs (generateDesignSystemPrompt)
 * 2. Component Library: Unified Fleet component API + minimal tokens (generateComponentLibraryPromptForProject)
 */

import type { DesignSystem, ComponentSpec, CodeExample } from './types';
import { getDesignSystemForProject, getDefaultDesignSystem } from './design-system-store';
import { generateComponentLibraryPrompt, generateMinimalComponentPrompt } from '../components';

// =============================================================================
// Main Prompt Generator
// =============================================================================

/**
 * Generate the design system section for agent prompts
 * This is injected into coder agent prompts to guide UI generation
 */
export function generateDesignSystemPrompt(designSystem: DesignSystem): string {
  const sections: string[] = [];

  // Header
  sections.push(`# Design System: ${designSystem.name}`);
  sections.push(`Version: ${designSystem.version}`);
  sections.push(`Description: ${designSystem.description}`);
  sections.push('');
  sections.push('**IMPORTANT**: Follow this design system strictly when generating UI code.');
  sections.push('');

  // Color tokens
  sections.push('## Color Tokens');
  sections.push('Use these semantic color variables (available as Tailwind classes or CSS variables):');
  sections.push('');
  sections.push('| Token | Value | Usage |');
  sections.push('|-------|-------|-------|');
  sections.push(`| background | \`${designSystem.tokens.colors.background}\` | Main app background |`);
  sections.push(`| foreground | \`${designSystem.tokens.colors.foreground}\` | Primary text |`);
  sections.push(`| card | \`${designSystem.tokens.colors.card}\` | Card backgrounds |`);
  sections.push(`| primary | \`${designSystem.tokens.colors.primary}\` | Primary actions, CTAs |`);
  sections.push(`| secondary | \`${designSystem.tokens.colors.secondary}\` | Secondary elements |`);
  sections.push(`| muted | \`${designSystem.tokens.colors.muted}\` | Muted backgrounds |`);
  sections.push(`| muted-foreground | \`${designSystem.tokens.colors.mutedForeground}\` | Secondary text |`);
  sections.push(`| destructive | \`${designSystem.tokens.colors.destructive}\` | Dangerous actions |`);
  sections.push(`| border | \`${designSystem.tokens.colors.border}\` | Borders |`);
  sections.push('');

  // Status colors if defined
  if (designSystem.tokens.colors.success || designSystem.tokens.colors.warning) {
    sections.push('### Status Colors');
    if (designSystem.tokens.colors.success) {
      sections.push(`- **Success**: \`${designSystem.tokens.colors.success}\` - Completed, passed states`);
    }
    if (designSystem.tokens.colors.warning) {
      sections.push(`- **Warning**: \`${designSystem.tokens.colors.warning}\` - Attention needed`);
    }
    if (designSystem.tokens.colors.error) {
      sections.push(`- **Error**: \`${designSystem.tokens.colors.error}\` - Failed states`);
    }
    if (designSystem.tokens.colors.info) {
      sections.push(`- **Info**: \`${designSystem.tokens.colors.info}\` - Informational`);
    }
    sections.push('');
  }

  // Spacing
  sections.push('## Spacing');
  sections.push(`Base unit: ${designSystem.tokens.spacing.unit}px`);
  sections.push('');
  sections.push('Common spacing values (use Tailwind classes):');
  const spacingExamples = [
    { tw: 'gap-1, p-1', px: designSystem.tokens.spacing.unit },
    { tw: 'gap-2, p-2', px: designSystem.tokens.spacing.unit * 2 },
    { tw: 'gap-3, p-3', px: designSystem.tokens.spacing.unit * 3 },
    { tw: 'gap-4, p-4', px: designSystem.tokens.spacing.unit * 4 },
    { tw: 'gap-6, p-6', px: designSystem.tokens.spacing.unit * 6 },
    { tw: 'gap-8, p-8', px: designSystem.tokens.spacing.unit * 8 },
  ];
  for (const { tw, px } of spacingExamples) {
    sections.push(`- \`${tw}\` = ${px}px`);
  }
  sections.push('');

  // Typography
  sections.push('## Typography');
  sections.push(`Font family (sans): \`${designSystem.tokens.typography.fontFamily.sans}\``);
  sections.push(`Font family (mono): \`${designSystem.tokens.typography.fontFamily.mono}\``);
  sections.push('');
  sections.push('Font sizes (use Tailwind classes):');
  for (const [name, spec] of Object.entries(designSystem.tokens.typography.fontSize)) {
    sections.push(`- \`text-${name}\`: ${spec.size} / ${spec.lineHeight}`);
  }
  sections.push('');

  // Border radius
  sections.push('## Border Radius');
  for (const [name, value] of Object.entries(designSystem.tokens.radii)) {
    if (name !== 'none' && name !== 'full') {
      sections.push(`- \`rounded-${name}\`: ${value}`);
    }
  }
  sections.push(`- \`rounded-full\`: ${designSystem.tokens.radii.full}`);
  sections.push('');

  // Component guidelines (top 5 most important)
  const componentKeys = Object.keys(designSystem.components).slice(0, 6);
  if (componentKeys.length > 0) {
    sections.push('## Component Guidelines');
    sections.push('');

    for (const key of componentKeys) {
      const spec = designSystem.components[key];
      sections.push(generateComponentSection(key, spec));
    }
  }

  // Guidelines
  if (designSystem.guidelines) {
    sections.push('## Design Guidelines');
    sections.push('');
    // Limit guidelines to first 2000 chars for prompt size
    const truncatedGuidelines = designSystem.guidelines.length > 2000
      ? designSystem.guidelines.slice(0, 2000) + '\n\n...(truncated for brevity)'
      : designSystem.guidelines;
    sections.push(truncatedGuidelines);
    sections.push('');
  }

  // Code examples (top 3)
  if (designSystem.examples.length > 0) {
    sections.push('## Code Examples');
    sections.push('Use these patterns as reference:');
    sections.push('');

    const examples = designSystem.examples.slice(0, 3);
    for (const example of examples) {
      sections.push(generateExampleSection(example));
    }
  }

  return sections.join('\n');
}

/**
 * Generate a shorter summary prompt for context-limited situations
 */
export function generateDesignSystemSummary(designSystem: DesignSystem): string {
  const sections: string[] = [];

  sections.push(`# Design System: ${designSystem.name}`);
  sections.push('');
  sections.push('## Key Colors');
  sections.push(`- Primary: \`${designSystem.tokens.colors.primary}\` (CTAs, active states)`);
  sections.push(`- Background: \`${designSystem.tokens.colors.background}\` (dark)`);
  sections.push(`- Card: \`${designSystem.tokens.colors.card}\` (elevated surfaces)`);
  sections.push(`- Destructive: \`${designSystem.tokens.colors.destructive}\` (dangerous actions)`);
  sections.push('');
  sections.push('## Quick Rules');
  sections.push('- Use rounded-lg for cards, rounded-md for buttons');
  sections.push('- Use gap-4 for card padding, gap-2 for tight spacing');
  sections.push('- Use text-sm for labels, text-xs for captions');
  sections.push('- Add hover:border-primary/50 transition-colors for interactive cards');
  sections.push('');

  // Just one example
  if (designSystem.examples.length > 0) {
    const example = designSystem.examples[0];
    sections.push('## Example Pattern');
    sections.push('```' + example.language);
    sections.push(example.code.slice(0, 500));
    sections.push('```');
  }

  return sections.join('\n');
}

/**
 * Get the design system prompt for a specific project
 * Falls back to default if no project-specific override
 */
export async function getDesignSystemPromptForProject(
  projectId: string
): Promise<string | null> {
  const designSystem = await getDesignSystemForProject(projectId);

  if (!designSystem) {
    // Try default
    const defaultDs = await getDefaultDesignSystem();
    if (defaultDs) {
      return generateDesignSystemPrompt(defaultDs);
    }
    return null;
  }

  return generateDesignSystemPrompt(designSystem);
}

/**
 * Get a summary prompt for a project (for context-limited situations)
 */
export async function getDesignSystemSummaryForProject(
  projectId: string
): Promise<string | null> {
  const designSystem = await getDesignSystemForProject(projectId);

  if (!designSystem) {
    const defaultDs = await getDefaultDesignSystem();
    if (defaultDs) {
      return generateDesignSystemSummary(defaultDs);
    }
    return null;
  }

  return generateDesignSystemSummary(designSystem);
}

// =============================================================================
// Helper Functions
// =============================================================================

function generateComponentSection(key: string, spec: ComponentSpec): string {
  const lines: string[] = [];

  lines.push(`### ${spec.name}`);
  lines.push(spec.description);
  lines.push('');

  if (spec.variants.length > 1) {
    lines.push(`**Variants**: ${spec.variants.join(', ')}`);
  }
  if (spec.sizes && spec.sizes.length > 1) {
    lines.push(`**Sizes**: ${spec.sizes.join(', ')}`);
  }

  // Do's and Don'ts (abbreviated)
  if (spec.doAndDont) {
    if (spec.doAndDont.do.length > 0) {
      lines.push(`**Do**: ${spec.doAndDont.do[0]}`);
    }
    if (spec.doAndDont.dont.length > 0) {
      lines.push(`**Don't**: ${spec.doAndDont.dont[0]}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

function generateExampleSection(example: CodeExample): string {
  const lines: string[] = [];

  lines.push(`### ${example.title}`);
  lines.push(example.description);
  lines.push('');
  lines.push('```' + example.language);
  // Limit code example size
  const code = example.code.length > 800
    ? example.code.slice(0, 800) + '\n// ...(truncated)'
    : example.code;
  lines.push(code);
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

// =============================================================================
// Component Library Mode (New - Recommended)
// =============================================================================

/**
 * Generate minimal design tokens section for component library mode.
 * Only includes colors and essential values - component API handles the rest.
 */
function generateMinimalTokens(designSystem: DesignSystem): string {
  const lines: string[] = [];

  lines.push('### Color Variables (use with Tailwind)');
  lines.push('```');
  lines.push(`--primary: ${designSystem.tokens.colors.primary}`);
  lines.push(`--secondary: ${designSystem.tokens.colors.secondary}`);
  lines.push(`--background: ${designSystem.tokens.colors.background}`);
  lines.push(`--foreground: ${designSystem.tokens.colors.foreground}`);
  lines.push(`--card: ${designSystem.tokens.colors.card}`);
  lines.push(`--muted: ${designSystem.tokens.colors.muted}`);
  lines.push(`--destructive: ${designSystem.tokens.colors.destructive}`);
  lines.push(`--border: ${designSystem.tokens.colors.border}`);
  if (designSystem.tokens.colors.success) {
    lines.push(`--success: ${designSystem.tokens.colors.success}`);
  }
  if (designSystem.tokens.colors.warning) {
    lines.push(`--warning: ${designSystem.tokens.colors.warning}`);
  }
  lines.push('```');
  lines.push('');
  lines.push(`Font: ${designSystem.tokens.typography.fontFamily.sans}`);
  lines.push(`Mono: ${designSystem.tokens.typography.fontFamily.mono}`);

  return lines.join('\n');
}

/**
 * Design system prompt result with metadata for tracing
 */
export interface DesignSystemPromptResult {
  prompt: string;
  designSystemId: string | null;
  designSystemName: string | null;
  isDefault: boolean;
}

/**
 * Get the component library prompt for a project WITH metadata.
 * Returns both the prompt and info about which design system was used.
 */
export async function getComponentLibraryPromptWithInfo(
  projectId: string
): Promise<DesignSystemPromptResult> {
  console.log(`[PromptGenerator] 🎨 Generating component library prompt for project: ${projectId}`);

  const componentLibraryDocs = generateComponentLibraryPrompt();

  // Get design system for tokens
  const designSystem = await getDesignSystemForProject(projectId);
  const ds = designSystem || await getDefaultDesignSystem();

  if (ds) {
    const tokenSection = generateMinimalTokens(ds);
    const prompt = `${componentLibraryDocs}

---

## Design System: ${ds.name}

${tokenSection}
`;

    const result = {
      prompt,
      designSystemId: ds.id,
      designSystemName: ds.name,
      isDefault: !designSystem // true if we fell back to default
    };

    // TRACING: Log the result
    console.log(`[PromptGenerator] ✅ Design system prompt generated:`);
    console.log(`  - Design System: "${result.designSystemName}" (ID: ${result.designSystemId})`);
    console.log(`  - Is Default: ${result.isDefault}`);
    console.log(`  - Prompt Length: ${result.prompt.length} chars`);

    return result;
  }

  console.log(`[PromptGenerator] ⚠️ No design system found, returning component library only`);

  return {
    prompt: componentLibraryDocs,
    designSystemId: null,
    designSystemName: null,
    isDefault: false
  };
}

/**
 * Get the component library prompt for a project.
 * This is the NEW recommended mode - uses unified Fleet component API.
 *
 * Benefits:
 * - Much smaller prompt size (~3KB vs ~10KB)
 * - Consistent component API regardless of design system
 * - Agents learn one API instead of multiple design systems
 * - Design system tokens appended for color/styling guidance
 */
export async function getComponentLibraryPromptForProject(
  projectId: string
): Promise<string> {
  const result = await getComponentLibraryPromptWithInfo(projectId);
  return result.prompt;
}

/**
 * Get minimal component reference for very constrained contexts.
 */
export async function getMinimalComponentPromptForProject(
  projectId: string
): Promise<string> {
  const minimalDocs = generateMinimalComponentPrompt();

  const designSystem = await getDesignSystemForProject(projectId);
  const ds = designSystem || await getDefaultDesignSystem();

  if (ds) {
    return `${minimalDocs}

Theme: ${ds.name}
Primary: ${ds.tokens.colors.primary}
Background: ${ds.tokens.colors.background}
`;
  }

  return minimalDocs;
}
