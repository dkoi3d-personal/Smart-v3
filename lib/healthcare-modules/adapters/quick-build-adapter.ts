/**
 * Quick Build Adapter
 *
 * Integrates healthcare modules with the /quick-build system.
 * Provides instant file generation without AI involvement.
 */

import { getHealthcareModuleRegistry } from '../registry';
import { QuickBuildAdapterResult, ModuleMatchOptions } from '../types';

// =============================================================================
// QUICK BUILD ADAPTER
// =============================================================================

/**
 * Match healthcare modules for quick-build requirements
 */
export function matchModulesForQuickBuild(
  requirements: string,
  options?: ModuleMatchOptions
): QuickBuildAdapterResult {
  const registry = getHealthcareModuleRegistry();
  const matches = registry.matchForQuickBuild(requirements, {
    minScore: 35, // Lower threshold for quick-build
    maxMatches: 3,
    ...options,
  });

  if (matches.length === 0) {
    return {
      files: [],
      dependencies: {},
      devDependencies: {},
      matchedModules: [],
    };
  }

  // Collect all files and dependencies from matched modules
  const allFiles: Array<{ path: string; content: string }> = [];
  const matchedModuleIds: string[] = [];

  for (const match of matches) {
    const moduleFiles = registry.getQuickBuildFiles(match.moduleId);
    allFiles.push(...moduleFiles);
    matchedModuleIds.push(match.moduleId);
  }

  // Get combined dependencies
  const { dependencies, devDependencies } = registry.getCombinedDependencies(matchedModuleIds);

  return {
    files: allFiles,
    dependencies,
    devDependencies,
    matchedModules: matchedModuleIds,
  };
}

/**
 * Check if requirements should use healthcare modules
 */
export function shouldUseHealthcareModules(requirements: string): boolean {
  const registry = getHealthcareModuleRegistry();

  // First check if it's a healthcare project
  if (!registry.isHealthcareProject(requirements)) {
    return false;
  }

  // Then check if we have matching modules
  const matches = registry.matchForQuickBuild(requirements, { minScore: 35 });
  return matches.length > 0;
}

/**
 * Get healthcare-specific package.json additions
 */
export function getHealthcarePackageJsonAdditions(moduleIds: string[]): {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
} {
  const registry = getHealthcareModuleRegistry();
  return registry.getCombinedDependencies(moduleIds);
}

/**
 * Generate a summary of what modules will be used
 */
export function getModuleUsageSummary(requirements: string): string {
  const registry = getHealthcareModuleRegistry();
  const matches = registry.matchForQuickBuild(requirements, { minScore: 35 });

  if (matches.length === 0) {
    return '';
  }

  const lines = ['Healthcare modules detected:'];
  for (const match of matches) {
    const module = registry.get(match.moduleId);
    if (module) {
      lines.push(`- ${module.name}: ${match.reason} (score: ${match.score})`);
    }
  }

  return lines.join('\n');
}

// =============================================================================
// INTEGRATION HELPERS
// =============================================================================

/**
 * Merge healthcare module files with base template files
 * Healthcare module files take precedence over conflicting base files
 */
export function mergeWithBaseFiles(
  baseFiles: Array<{ path: string; content: string }>,
  healthcareFiles: Array<{ path: string; content: string }>
): Array<{ path: string; content: string }> {
  const fileMap = new Map<string, { path: string; content: string }>();

  // Add base files first
  for (const file of baseFiles) {
    fileMap.set(file.path, file);
  }

  // Override with healthcare files
  for (const file of healthcareFiles) {
    fileMap.set(file.path, file);
  }

  return Array.from(fileMap.values());
}

/**
 * Merge dependencies from multiple sources
 */
export function mergeDependencies(
  baseDeps: Record<string, string>,
  healthcareDeps: Record<string, string>
): Record<string, string> {
  return { ...baseDeps, ...healthcareDeps };
}
