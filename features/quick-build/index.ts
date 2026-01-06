/**
 * Quick Build Feature
 *
 * Rapid prototype generation from templates with Epic FHIR API integration.
 * Creates working healthcare apps in ~2 minutes.
 *
 * @see README.md for full documentation
 */

// Legacy Components (kept for backwards compatibility)
export {
  QuickBuildForm,
  BuildProgress,
  BuildLogs,
  PreviewPanel,
  EpicExplorerSection,
  QuickBuildTips,
  QuickBuildHeader,
} from './components';

// New Template-Based Components
export {
  TemplateCard,
  TemplateGallery,
  CategoryFilter,
  EpicApiPicker,
  TemplateConfigPanel,
  BuildProgressCard,
} from './components';

// Hooks
export { useQuickBuild, usePreview, useTemplateSelection, useEpicStatus } from './hooks';
export type { EpicConnectionStatus } from './hooks';

// Utils
export { generateComplexBuildPrompt } from './utils';

// Constants
export { EXAMPLE_PROMPTS } from './constants';

// Data
export {
  EPIC_API_CATALOG,
  API_CATEGORIES,
  QUICK_BUILD_TEMPLATES,
  getApiById,
  getApisByCategory,
  getTemplateById,
  getTemplatesByCategory,
} from './data';

// Types
export type {
  BuildProgress as BuildProgressType,
  BuildPhase,
  DatabaseConfig,
  ExamplePrompt,
  QuickBuildState,
  PreviewState,
  BuildResult,
  QuickBuildConfig,
  EpicApiSelection,
  TemplateSelectionState,
  QuickBuildStep,
} from './types';

export type {
  EpicApiDefinition,
  EpicApiCategory,
  QuickBuildTemplate,
  TemplateFeature,
} from './data';
