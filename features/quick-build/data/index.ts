/**
 * Quick Build Data Exports
 */

// Epic API Catalog
export {
  EPIC_API_CATALOG,
  API_CATEGORIES,
  getApiById,
  getApisByCategory,
  getApiDependencies,
  resolveAllDependencies,
  getTotalApiCount,
} from './epic-api-catalog';

export type {
  EpicApiDefinition,
  EpicApiCategory,
  CategoryInfo,
  GeneratedComponent,
  GeneratedHook,
} from './epic-api-catalog';

// Templates
export {
  QUICK_BUILD_TEMPLATES,
  getTemplateById,
  getTemplatesByCategory,
  getTemplateEpicApis,
  getDefaultEnabledFeatures,
} from './templates';

export type { QuickBuildTemplate, TemplateFeature } from './templates';
