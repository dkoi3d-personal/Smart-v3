/**
 * Design System Types
 *
 * Defines the structure for design systems that can be:
 * - Selected for builds to guide agent code generation
 * - Uploaded by users in JSON, Markdown, or ZIP formats
 * - Configured in settings with tokens, components, and guidelines
 */

// =============================================================================
// Core Design System
// =============================================================================

export interface DesignSystem {
  id: string;
  name: string;
  description: string;
  version: string;
  isDefault: boolean;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;

  /** Visual design tokens (colors, spacing, typography, etc.) */
  tokens: DesignTokens;

  /** Component specifications with variants, props, and usage guidelines */
  components: Record<string, ComponentSpec>;

  /** Markdown guidelines for agents */
  guidelines: string;

  /** Code examples for agents to reference */
  examples: CodeExample[];

  /** Source information for uploaded design systems */
  source?: {
    type: 'json' | 'markdown' | 'zip' | 'builtin';
    originalFileName?: string;
  };
}

// =============================================================================
// Design Tokens
// =============================================================================

export interface DesignTokens {
  colors: ColorTokens;
  spacing: SpacingTokens;
  typography: TypographyTokens;
  radii: RadiusTokens;
  shadows: Record<string, string>;
  transitions: TransitionTokens;
}

export interface ColorTokens {
  // Core semantic colors
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground?: string;
  border: string;
  input: string;
  ring: string;

  // Chart/visualization colors
  chart1?: string;
  chart2?: string;
  chart3?: string;
  chart4?: string;
  chart5?: string;

  // Status colors
  success?: string;
  successForeground?: string;
  warning?: string;
  warningForeground?: string;
  error?: string;
  errorForeground?: string;
  info?: string;
  infoForeground?: string;

  // Custom colors
  custom?: Record<string, string>;
}

export interface SpacingTokens {
  /** Base spacing unit in pixels (typically 4) */
  unit: number;
  /** Spacing scale multipliers */
  scale: number[];
}

export interface TypographyTokens {
  fontFamily: {
    sans: string;
    mono: string;
    display?: string;
  };
  fontSize: Record<string, FontSizeSpec>;
  fontWeight: Record<string, number>;
}

export interface FontSizeSpec {
  size: string;
  lineHeight: string;
  letterSpacing?: string;
}

export interface RadiusTokens {
  none: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  full: string;
}

export interface TransitionTokens {
  duration: Record<string, string>;
  easing: Record<string, string>;
}

// =============================================================================
// Component Specifications
// =============================================================================

export interface ComponentSpec {
  name: string;
  description: string;

  /** Available visual variants (e.g., 'default', 'outline', 'ghost') */
  variants: string[];

  /** Available sizes (e.g., 'sm', 'md', 'lg') */
  sizes?: string[];

  /** Component states (e.g., 'default', 'hover', 'focus', 'disabled') */
  states: string[];

  /** Component props with types and defaults */
  props: Record<string, PropSpec>;

  /** Usage guidelines in markdown */
  usage: string;

  /** Do's and Don'ts for using this component */
  doAndDont?: {
    do: string[];
    dont: string[];
  };

  /** Related components */
  relatedComponents?: string[];
}

export interface PropSpec {
  type: string;
  default?: string;
  required?: boolean;
  description?: string;
  options?: string[];
}

// =============================================================================
// Code Examples
// =============================================================================

export interface CodeExample {
  id: string;
  title: string;
  description: string;
  language: 'tsx' | 'jsx' | 'css' | 'scss' | 'html';
  code: string;
  tags: string[];
}

// =============================================================================
// Configuration
// =============================================================================

export interface DesignSystemConfig {
  /** ID of the default design system */
  defaultDesignSystemId: string | null;

  /** Project-specific design system overrides */
  projectOverrides: Record<string, string>;

  /** Last updated timestamp */
  updatedAt: string;
}

// =============================================================================
// API Types
// =============================================================================

export interface CreateDesignSystemInput {
  name: string;
  description?: string;
  version?: string;
  tokens?: Partial<DesignTokens>;
  components?: Record<string, Partial<ComponentSpec>>;
  guidelines?: string;
  examples?: CodeExample[];
}

export interface UpdateDesignSystemInput {
  name?: string;
  description?: string;
  version?: string;
  tokens?: Partial<DesignTokens>;
  components?: Record<string, Partial<ComponentSpec>>;
  guidelines?: string;
  examples?: CodeExample[];
  isDefault?: boolean;
}

export interface DesignSystemListItem {
  id: string;
  name: string;
  description: string;
  version: string;
  isDefault: boolean;
  isBuiltIn: boolean;
  updatedAt: string;
  componentCount: number;
  exampleCount: number;
}

// =============================================================================
// Upload Types
// =============================================================================

export interface UploadedDesignSystemFile {
  type: 'json' | 'markdown' | 'zip';
  fileName: string;
  content: string | Buffer;
}

export interface ParsedDesignSystem {
  name: string;
  description: string;
  version: string;
  tokens?: Partial<DesignTokens>;
  components?: Record<string, Partial<ComponentSpec>>;
  guidelines?: string;
  examples?: CodeExample[];
  warnings?: string[];
}
