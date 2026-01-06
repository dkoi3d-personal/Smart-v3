/**
 * Design Systems Library
 *
 * Provides design system management for AI code generation:
 * - Store and manage design systems
 * - Generate prompts for agents
 * - Parse uploaded design system files
 */

// Types
export type {
  DesignSystem,
  DesignTokens,
  ColorTokens,
  SpacingTokens,
  TypographyTokens,
  RadiusTokens,
  TransitionTokens,
  ComponentSpec,
  PropSpec,
  CodeExample,
  DesignSystemConfig,
  CreateDesignSystemInput,
  UpdateDesignSystemInput,
  DesignSystemListItem,
  UploadedDesignSystemFile,
  ParsedDesignSystem,
} from './types';

// Store operations
export {
  ensureDesignSystemsDir,
  getAllDesignSystems,
  getDesignSystemsList,
  getDesignSystemById,
  createDesignSystem,
  updateDesignSystem,
  deleteDesignSystem,
  getConfig,
  setDefaultDesignSystemId,
  getDefaultDesignSystem,
  setProjectDesignSystem,
  getDesignSystemForProject,
} from './design-system-store';

// Prompt generation
export {
  generateDesignSystemPrompt,
  getDesignSystemPromptForProject,
  // NEW: Component library mode (recommended)
  getComponentLibraryPromptForProject,
  getMinimalComponentPromptForProject,
} from './prompt-generator';

// Default design systems
export { getModernDarkDesignSystem } from './defaults/modern-dark';
export { getOchsnerHealthDesignSystem } from './defaults/ochsner-health';

// Parsers
export {
  parseDesignSystemFile,
  validateParsedDesignSystem,
} from './parsers';
