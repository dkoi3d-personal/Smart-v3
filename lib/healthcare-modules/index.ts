/**
 * Healthcare Modules - Main Entry Point
 *
 * Provides pre-built healthcare components and modules for:
 * - /quick-build (instant templates)
 * - /build (AI agent customization)
 */

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export * from './types';

// =============================================================================
// REGISTRY EXPORTS
// =============================================================================

export {
  HealthcareModuleRegistry,
  getHealthcareModuleRegistry,
  initializeHealthcareModules,
} from './registry';

// =============================================================================
// ADAPTER EXPORTS
// =============================================================================

export {
  matchModulesForQuickBuild,
  shouldUseHealthcareModules,
  getHealthcarePackageJsonAdditions,
  getModuleUsageSummary,
  mergeWithBaseFiles,
  mergeDependencies,
} from './adapters/quick-build-adapter';

export {
  matchModulesForStory,
  getAgentBuildContext,
  copyModulesToProject,
  getProductOwnerModuleContext,
  enhanceStoryPrompt,
  analyzeStoriesForModules,
  autoTagStoriesWithModules,
} from './adapters/build-adapter';

// =============================================================================
// MODULE IMPORTS
// =============================================================================

import { patientFhirDisplayModule } from './modules/patient-fhir-display';
import { medicationTrackingModule } from './modules/medication-tracking';

// =============================================================================
// ALL MODULES
// =============================================================================

/**
 * All available healthcare modules
 */
export const HEALTHCARE_MODULES = [
  patientFhirDisplayModule,
  medicationTrackingModule,
  // Add more modules here as they are created:
  // clinicalDisplayModule,
  // appointmentSchedulingModule,
  // billingClaimsModule,
  // smartAuthModule,
];

// =============================================================================
// AUTO-INITIALIZATION
// =============================================================================

import { getHealthcareModuleRegistry } from './registry';

/**
 * Initialize the registry with all healthcare modules
 * Call this once at application startup
 */
export function initializeAllHealthcareModules(): void {
  const registry = getHealthcareModuleRegistry();
  registry.registerAll(HEALTHCARE_MODULES);
  console.log(`[Healthcare Modules] Registered ${HEALTHCARE_MODULES.length} modules`);
}

// Auto-initialize on import (lazy)
let initialized = false;
export function ensureHealthcareModulesInitialized(): void {
  if (!initialized) {
    initializeAllHealthcareModules();
    initialized = true;
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Get a module by ID
 */
export function getHealthcareModule(moduleId: string) {
  ensureHealthcareModulesInitialized();
  return getHealthcareModuleRegistry().get(moduleId);
}

/**
 * Get all module IDs
 */
export function getHealthcareModuleIds(): string[] {
  return HEALTHCARE_MODULES.map(m => m.id);
}

/**
 * Check if a module exists
 */
export function hasHealthcareModule(moduleId: string): boolean {
  return HEALTHCARE_MODULES.some(m => m.id === moduleId);
}

/**
 * Get modules by category
 */
export function getModulesByCategory(category: string) {
  ensureHealthcareModulesInitialized();
  return getHealthcareModuleRegistry().getByCategory(category as any);
}

// =============================================================================
// QUICK ACCESS - Most Common Operations
// =============================================================================

/**
 * Quick Build: Get files for matched modules
 */
export function getQuickBuildHealthcareFiles(requirements: string) {
  ensureHealthcareModulesInitialized();
  const { matchModulesForQuickBuild } = require('./adapters/quick-build-adapter');
  return matchModulesForQuickBuild(requirements);
}

/**
 * Build: Get agent context for a story
 */
export function getStoryModuleContext(
  storyTitle: string,
  storyDescription: string,
  storyTags?: string[],
  domainId?: string
) {
  ensureHealthcareModulesInitialized();
  const { getAgentBuildContext } = require('./adapters/build-adapter');
  return getAgentBuildContext(storyTitle, storyDescription, storyTags, domainId);
}

/**
 * Check if requirements are healthcare-related
 */
export function isHealthcareRequirements(requirements: string): boolean {
  ensureHealthcareModulesInitialized();
  return getHealthcareModuleRegistry().isHealthcareProject(requirements);
}
