/**
 * Architecture Context Integration
 *
 * Extracted from multi-agent-service.ts for maintainability.
 * Handles loading and formatting architecture documentation for agent prompts.
 */

import * as fs from 'fs/promises';
import path from 'path';

// =============================================================================
// Types
// =============================================================================

export interface ArchitectureContext {
  overview: string;
  folderStructure: string;
  patterns: string[];
  techStack: string;
  conventions: string;
  apiContracts?: string;
}

// =============================================================================
// Caching
// =============================================================================

// Cache for loaded architecture per project
const architectureCache: Map<string, { data: ArchitectureContext | null; loadedAt: number }> = new Map();
const ARCHITECTURE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache for formatted architecture prompts
const cachedArchitecturePrompt: Map<string, string> = new Map();

// =============================================================================
// Architecture Loading
// =============================================================================

/**
 * Load architecture from project's .architecture directory
 */
export async function loadProjectArchitecture(projectDir: string): Promise<ArchitectureContext | null> {
  // Check cache
  const cached = architectureCache.get(projectDir);
  if (cached && Date.now() - cached.loadedAt < ARCHITECTURE_CACHE_TTL) {
    return cached.data;
  }

  try {
    const archDir = path.join(projectDir, '.architecture');
    const contextPath = path.join(archDir, 'context.json');

    const contextData = await fs.readFile(contextPath, 'utf-8');
    const context = JSON.parse(contextData) as ArchitectureContext;

    // Cache the result
    architectureCache.set(projectDir, { data: context, loadedAt: Date.now() });

    console.log('[Architecture] Loaded architecture from', contextPath);
    return context;
  } catch {
    // No architecture file exists
    architectureCache.set(projectDir, { data: null, loadedAt: Date.now() });
    return null;
  }
}

/**
 * Format architecture for prompt injection
 */
export function formatArchitectureForPrompt(arch: ArchitectureContext): string {
  const sections: string[] = [
    '\n=== ARCHITECTURE GUIDELINES (Follow These!) ===\n'
  ];

  if (arch.overview) {
    sections.push(`### Overview\n${arch.overview}\n`);
  }

  if (arch.folderStructure) {
    sections.push(`### Folder Structure\n${arch.folderStructure}\n`);
  }

  if (arch.patterns && arch.patterns.length > 0) {
    sections.push(`### Design Patterns\n${arch.patterns.map(p => `- ${p}`).join('\n')}\n`);
  }

  if (arch.techStack) {
    sections.push(`### Tech Stack\n${arch.techStack}\n`);
  }

  if (arch.conventions) {
    sections.push(`### Coding Conventions\n${arch.conventions}\n`);
  }

  if (arch.apiContracts) {
    sections.push(`### API Contracts\n${arch.apiContracts.slice(0, 500)}\n`);
  }

  sections.push('=== END ARCHITECTURE GUIDELINES ===\n');

  return sections.join('\n');
}

/**
 * Get architecture context for a project (sync wrapper for use in prompts)
 */
export function getArchitectureContext(projectDir: string): string {
  // Return cached if available
  const cached = cachedArchitecturePrompt.get(projectDir);
  if (cached !== undefined) {
    return cached;
  }

  // For sync access, check if we have loaded it previously
  const archCache = architectureCache.get(projectDir);
  if (archCache && archCache.data) {
    const formatted = formatArchitectureForPrompt(archCache.data);
    cachedArchitecturePrompt.set(projectDir, formatted);
    return formatted;
  }

  // If not cached, return empty and trigger async load
  loadProjectArchitecture(projectDir).then(arch => {
    if (arch) {
      const formatted = formatArchitectureForPrompt(arch);
      cachedArchitecturePrompt.set(projectDir, formatted);
      console.log('[Architecture] Async loaded architecture for', projectDir);
    }
  }).catch(() => {
    // Ignore errors, just don't have architecture
  });

  return '';
}

/**
 * Preload architecture for a project (call this before running agents)
 */
export async function preloadArchitecture(projectDir: string): Promise<void> {
  const arch = await loadProjectArchitecture(projectDir);
  if (arch) {
    const formatted = formatArchitectureForPrompt(arch);
    cachedArchitecturePrompt.set(projectDir, formatted);
    console.log('[Architecture] Preloaded architecture for', projectDir);
  }
}

/**
 * Clear architecture cache for a project
 */
export function clearArchitectureCache(projectDir?: string): void {
  if (projectDir) {
    architectureCache.delete(projectDir);
    cachedArchitecturePrompt.delete(projectDir);
  } else {
    architectureCache.clear();
    cachedArchitecturePrompt.clear();
  }
}
