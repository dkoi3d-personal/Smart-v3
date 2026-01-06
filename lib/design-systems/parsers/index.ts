/**
 * Design System File Parsers
 *
 * Parse uploaded files (JSON, Markdown, ZIP) into design system format.
 */

import type { ParsedDesignSystem, DesignTokens, ComponentSpec, CodeExample } from '../types';
import { getModernDarkDesignSystem } from '../defaults/modern-dark';

// =============================================================================
// Main Parser
// =============================================================================

/**
 * Parse an uploaded file into a design system
 */
export async function parseDesignSystemFile(
  fileName: string,
  content: string | Buffer
): Promise<ParsedDesignSystem> {
  const ext = fileName.toLowerCase().split('.').pop();

  switch (ext) {
    case 'json':
      return parseJsonDesignSystem(content.toString());
    case 'md':
    case 'markdown':
      return parseMarkdownDesignSystem(content.toString());
    case 'zip':
      return parseZipDesignSystem(content as Buffer);
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

// =============================================================================
// JSON Parser
// =============================================================================

/**
 * Parse a JSON design system file
 *
 * Expected format:
 * {
 *   "name": "My Design System",
 *   "description": "...",
 *   "version": "1.0.0",
 *   "tokens": { ... },
 *   "components": { ... },
 *   "guidelines": "...",
 *   "examples": [ ... ]
 * }
 */
function parseJsonDesignSystem(content: string): ParsedDesignSystem {
  const warnings: string[] = [];

  let data: any;
  try {
    data = JSON.parse(content);
  } catch (error) {
    throw new Error('Invalid JSON format');
  }

  // Validate required fields
  if (!data.name) {
    throw new Error('Design system must have a name');
  }

  // Parse tokens (merge with defaults for missing values)
  const defaultTokens = getModernDarkDesignSystem().tokens;
  const tokens: Partial<DesignTokens> = {};

  if (data.tokens) {
    if (data.tokens.colors) {
      tokens.colors = { ...defaultTokens.colors, ...data.tokens.colors };
    }
    if (data.tokens.spacing) {
      tokens.spacing = data.tokens.spacing;
    }
    if (data.tokens.typography) {
      tokens.typography = {
        fontFamily: { ...defaultTokens.typography.fontFamily, ...data.tokens.typography?.fontFamily },
        fontSize: { ...defaultTokens.typography.fontSize, ...data.tokens.typography?.fontSize },
        fontWeight: { ...defaultTokens.typography.fontWeight, ...data.tokens.typography?.fontWeight },
      };
    }
    if (data.tokens.radii) {
      tokens.radii = { ...defaultTokens.radii, ...data.tokens.radii };
    }
    if (data.tokens.shadows) {
      tokens.shadows = data.tokens.shadows;
    }
    if (data.tokens.transitions) {
      tokens.transitions = data.tokens.transitions;
    }
  }

  // Parse components
  const components: Record<string, Partial<ComponentSpec>> = {};
  if (data.components) {
    for (const [key, value] of Object.entries(data.components)) {
      components[key] = value as Partial<ComponentSpec>;
    }
  }

  // Parse examples
  const examples: CodeExample[] = [];
  if (Array.isArray(data.examples)) {
    for (const ex of data.examples) {
      if (ex.title && ex.code) {
        examples.push({
          id: ex.id || `example-${examples.length}`,
          title: ex.title,
          description: ex.description || '',
          language: ex.language || 'tsx',
          code: ex.code,
          tags: ex.tags || [],
        });
      }
    }
  }

  return {
    name: data.name,
    description: data.description || '',
    version: data.version || '1.0.0',
    tokens,
    components,
    guidelines: data.guidelines || '',
    examples,
    warnings,
  };
}

// =============================================================================
// Markdown Parser
// =============================================================================

/**
 * Parse a Markdown design system file
 *
 * Expected format:
 * # Design System Name
 *
 * Description text...
 *
 * ## Colors
 * - background: #000000
 * - primary: #8b5cf6
 *
 * ## Components
 * ### Button
 * Description...
 *
 * ## Guidelines
 * Usage guidelines...
 */
function parseMarkdownDesignSystem(content: string): ParsedDesignSystem {
  const warnings: string[] = [];
  const lines = content.split('\n');

  let name = 'Imported Design System';
  let description = '';
  let guidelines = '';
  const tokens: Partial<DesignTokens> = {};
  const components: Record<string, Partial<ComponentSpec>> = {};

  let currentSection = '';
  let currentComponent = '';
  let currentContent: string[] = [];

  // Parse title from first heading
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    name = titleMatch[1].replace(/design system/i, '').trim() || 'Imported Design System';
  }

  // Parse description (text before first ##)
  const descMatch = content.match(/^#\s+.+\n\n([\s\S]*?)(?=\n##\s)/);
  if (descMatch) {
    description = descMatch[1].trim();
  }

  // Parse sections
  for (const line of lines) {
    // Section header (##)
    const sectionMatch = line.match(/^##\s+(.+)$/);
    if (sectionMatch) {
      // Save previous section
      if (currentSection === 'guidelines') {
        guidelines = currentContent.join('\n');
      }

      currentSection = sectionMatch[1].toLowerCase();
      currentContent = [];
      currentComponent = '';
      continue;
    }

    // Component header (###)
    const componentMatch = line.match(/^###\s+(.+)$/);
    if (componentMatch && currentSection === 'components') {
      // Save previous component
      if (currentComponent && currentContent.length > 0) {
        components[currentComponent.toLowerCase()] = {
          name: currentComponent,
          description: currentContent.join('\n').trim(),
          variants: ['default'],
          states: ['default'],
          props: {},
          usage: '',
        };
      }

      currentComponent = componentMatch[1];
      currentContent = [];
      continue;
    }

    // Color definitions
    if (currentSection === 'colors') {
      const colorMatch = line.match(/^[-*]\s*(\w+):\s*(.+)$/);
      if (colorMatch) {
        const [, colorName, colorValue] = colorMatch;
        if (!tokens.colors) {
          tokens.colors = {} as any;
        }
        (tokens.colors as any)[colorName] = colorValue.trim();
      }
    }

    // Accumulate content
    currentContent.push(line);
  }

  // Save last section/component
  if (currentSection === 'guidelines') {
    guidelines = currentContent.join('\n');
  }
  if (currentComponent && currentContent.length > 0) {
    components[currentComponent.toLowerCase()] = {
      name: currentComponent,
      description: currentContent.join('\n').trim(),
      variants: ['default'],
      states: ['default'],
      props: {},
      usage: '',
    };
  }

  if (Object.keys(tokens).length === 0) {
    warnings.push('No color tokens found - using defaults');
  }

  return {
    name,
    description,
    version: '1.0.0',
    tokens,
    components,
    guidelines,
    examples: [],
    warnings,
  };
}

// =============================================================================
// ZIP Parser
// =============================================================================

/**
 * Parse a ZIP design system package
 *
 * Expected structure:
 * design-system.zip/
 * ├── design-system.json (or tokens.json)
 * ├── guidelines.md
 * ├── components/
 * │   ├── button.md
 * │   └── card.md
 * └── examples/
 *     └── *.tsx
 */
async function parseZipDesignSystem(content: Buffer): Promise<ParsedDesignSystem> {
  // For ZIP parsing, we'd need a library like jszip
  // For now, return a placeholder with a warning
  const warnings: string[] = [
    'ZIP parsing requires additional setup. Please upload JSON or Markdown files instead.',
  ];

  return {
    name: 'Imported Design System',
    description: 'Imported from ZIP file',
    version: '1.0.0',
    tokens: {},
    components: {},
    guidelines: '',
    examples: [],
    warnings,
  };
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate a parsed design system
 */
export function validateParsedDesignSystem(parsed: ParsedDesignSystem): string[] {
  const errors: string[] = [];

  if (!parsed.name || parsed.name.length < 2) {
    errors.push('Design system name must be at least 2 characters');
  }

  if (parsed.name && parsed.name.length > 100) {
    errors.push('Design system name must be less than 100 characters');
  }

  // Validate color format if provided
  if (parsed.tokens?.colors) {
    for (const [key, value] of Object.entries(parsed.tokens.colors)) {
      if (value && typeof value === 'string') {
        // Allow hex, rgb, rgba, hsl, hsla, oklch
        const validColorFormat = /^(#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(|oklch\()/;
        if (!validColorFormat.test(value)) {
          errors.push(`Invalid color format for ${key}: ${value}`);
        }
      }
    }
  }

  return errors;
}
