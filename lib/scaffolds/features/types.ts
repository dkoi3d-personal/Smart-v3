/**
 * Feature Template Types
 * TypeScript interfaces for the feature template system
 */

export type FeatureCategory =
  | 'auth'           // Authentication/authorization
  | 'data'           // Data display/management
  | 'ui'             // UI patterns
  | 'integration'    // Third-party integrations
  | 'compliance'     // HIPAA, audit logging, security
  | 'healthcare'     // Healthcare-specific features
  | 'messaging'      // Real-time messaging, chat
  | 'scheduling'     // Appointments, calendars
  | 'foundation';    // Bootstrap templates

export type TemplateFileType =
  | 'component'
  | 'api'
  | 'lib'
  | 'hook'
  | 'type'
  | 'test'
  | 'config'
  | 'page';

export interface TemplateFile {
  /** Relative path from project root, e.g., 'components/auth/LoginForm.tsx' */
  path: string;

  /** File type for categorization */
  type: TemplateFileType;

  /** The actual file content */
  content: string;

  /** Whether this file should use design system tokens */
  usesDesignSystem?: boolean;

  /** Description of what this file does */
  description?: string;
}

export interface TemplateTestFile {
  /** Relative path, e.g., '__tests__/auth/login.test.ts' */
  path: string;

  /** Test framework: vitest or jest */
  framework: 'vitest' | 'jest';

  /** The test file content */
  content: string;

  /** What this test covers */
  description: string;
}

export interface TemplateRequirements {
  /** Requirements text to merge with user requirements */
  text: string;

  /** Priority for merging (higher = appears first) */
  priority: number;
}

/**
 * Structured test files organized by type
 */
export interface TemplateTests {
  unit?: Array<{ path: string; content: string }>;
  integration?: Array<{ path: string; content: string }>;
  e2e?: Array<{ path: string; content: string }>;
}

export interface TemplateDependencies {
  /** npm packages to add */
  packages: Record<string, string>;

  /** Dev dependencies to add */
  devPackages?: Record<string, string>;

  /** Other template IDs that should be applied first */
  templateDependencies?: string[];

  /** Prisma models this template expects (for validation) */
  expectedModels?: string[];
}

export interface FeatureTemplate {
  /** Unique ID, e.g., 'auth-flow-v1' */
  id: string;

  /** Human-readable name */
  name: string;

  /** Semantic version */
  version: string;

  /** Description */
  description: string;

  /** Category */
  category: FeatureCategory;

  /** Keywords for matching */
  keywords: string[];

  /** Regex patterns for matching (optional) */
  patterns?: string[];

  /** Template files to copy */
  files: TemplateFile[];

  /** Pre-written test files (can be flat array or structured object) */
  tests: TemplateTestFile[] | TemplateTests;

  /** Requirements to merge */
  requirements: TemplateRequirements;

  /** Dependencies */
  dependencies: TemplateDependencies;

  /** Agent instructions for customization */
  agentInstructions?: string;
}

// Matching types
export interface TemplateMatch {
  templateId: string;
  templateName: string;
  score: number;
  matchedKeywords: string[];
}

export interface TemplateApplyResult {
  success: boolean;
  templateId: string;
  templateName: string;
  filesCreated: string[];
  testsCreated: string[];
  dependenciesAdded: Record<string, string>;
  errors: string[];
}

export interface MergeResult {
  mergedRequirements: string;
  templatesIncluded: string[];
  addedSections: string[];
}
