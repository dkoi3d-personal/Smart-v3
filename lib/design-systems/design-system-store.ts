/**
 * Design System Store
 *
 * CRUD operations for design systems stored as JSON files.
 * Follows the pattern from squad-config storage.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type {
  DesignSystem,
  DesignSystemConfig,
  CreateDesignSystemInput,
  UpdateDesignSystemInput,
  DesignSystemListItem,
  DesignTokens,
} from './types';
import { getModernDarkDesignSystem } from './defaults/modern-dark';
import { getOchsnerHealthDesignSystem } from './defaults/ochsner-health';
import { getSmartCycleAIDesignSystem } from './defaults/smartcycle-ai';

// =============================================================================
// Constants
// =============================================================================

const DATA_DIR = path.join(process.cwd(), 'data');
const DESIGN_SYSTEMS_DIR = path.join(DATA_DIR, 'design-systems');
const CONFIG_FILE = path.join(DESIGN_SYSTEMS_DIR, '_config.json');
const MODERN_DARK_FILE = path.join(DESIGN_SYSTEMS_DIR, 'modern-dark.json');
const OCHSNER_HEALTH_FILE = path.join(DESIGN_SYSTEMS_DIR, 'ochsner-health.json');
const SMARTCYCLE_AI_FILE = path.join(DESIGN_SYSTEMS_DIR, 'smartcycle-ai.json');

// =============================================================================
// Directory Management
// =============================================================================

/**
 * Ensure the design systems directory exists and has the built-in system
 */
export async function ensureDesignSystemsDir(): Promise<void> {
  try {
    await fs.access(DESIGN_SYSTEMS_DIR);
  } catch {
    // Create directory
    await fs.mkdir(DESIGN_SYSTEMS_DIR, { recursive: true });
  }

  // Ensure Modern Dark exists
  try {
    await fs.access(MODERN_DARK_FILE);
  } catch {
    const modernDark = getModernDarkDesignSystem();
    await fs.writeFile(MODERN_DARK_FILE, JSON.stringify(modernDark, null, 2));
  }

  // Ensure Ochsner Health exists
  try {
    await fs.access(OCHSNER_HEALTH_FILE);
  } catch {
    const ochsnerHealth = getOchsnerHealthDesignSystem();
    await fs.writeFile(OCHSNER_HEALTH_FILE, JSON.stringify(ochsnerHealth, null, 2));
  }

  // Ensure SmartCycle AI exists
  try {
    await fs.access(SMARTCYCLE_AI_FILE);
  } catch {
    const smartcycleAI = getSmartCycleAIDesignSystem();
    await fs.writeFile(SMARTCYCLE_AI_FILE, JSON.stringify(smartcycleAI, null, 2));
  }

  // Ensure config exists
  try {
    await fs.access(CONFIG_FILE);
  } catch {
    const defaultConfig: DesignSystemConfig = {
      defaultDesignSystemId: 'smartcycle-ai',
      projectOverrides: {},
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
  }
}

// =============================================================================
// CRUD Operations
// =============================================================================

/**
 * Get all design systems
 */
export async function getAllDesignSystems(): Promise<DesignSystem[]> {
  await ensureDesignSystemsDir();

  const files = await fs.readdir(DESIGN_SYSTEMS_DIR);
  const designSystems: DesignSystem[] = [];

  for (const file of files) {
    if (file.endsWith('.json') && !file.startsWith('_')) {
      try {
        const content = await fs.readFile(
          path.join(DESIGN_SYSTEMS_DIR, file),
          'utf-8'
        );
        designSystems.push(JSON.parse(content));
      } catch (error) {
        console.error(`[DesignSystemStore] Failed to read ${file}:`, error);
      }
    }
  }

  // Sort: built-in first, then by name
  return designSystems.sort((a, b) => {
    if (a.isBuiltIn && !b.isBuiltIn) return -1;
    if (!a.isBuiltIn && b.isBuiltIn) return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Get design systems as list items (lighter payload)
 */
export async function getDesignSystemsList(): Promise<DesignSystemListItem[]> {
  const systems = await getAllDesignSystems();
  return systems.map((ds) => ({
    id: ds.id,
    name: ds.name,
    description: ds.description,
    version: ds.version,
    isDefault: ds.isDefault,
    isBuiltIn: ds.isBuiltIn,
    updatedAt: ds.updatedAt,
    componentCount: Object.keys(ds.components).length,
    exampleCount: ds.examples.length,
    figmaSourceUrl: ds.figmaSource?.url,
    lastSyncedAt: ds.figmaSource?.lastSyncedAt,
  }));
}

/**
 * Get a single design system by ID
 */
export async function getDesignSystemById(id: string): Promise<DesignSystem | null> {
  await ensureDesignSystemsDir();

  const filePath = path.join(DESIGN_SYSTEMS_DIR, `${id}.json`);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Create a new design system
 */
export async function createDesignSystem(
  input: CreateDesignSystemInput
): Promise<DesignSystem> {
  await ensureDesignSystemsDir();

  const id = uuidv4();
  const now = new Date().toISOString();

  const designSystem: DesignSystem = {
    id,
    name: input.name,
    description: input.description || '',
    version: input.version || '1.0.0',
    isDefault: false,
    isBuiltIn: false,
    createdAt: now,
    updatedAt: now,
    tokens: mergeWithDefaultTokens(input.tokens),
    components: normalizeComponents(input.components || {}),
    guidelines: input.guidelines || '',
    examples: input.examples || [],
  };

  const filePath = path.join(DESIGN_SYSTEMS_DIR, `${id}.json`);
  await fs.writeFile(filePath, JSON.stringify(designSystem, null, 2));

  return designSystem;
}

/**
 * Update an existing design system
 */
export async function updateDesignSystem(
  id: string,
  input: UpdateDesignSystemInput
): Promise<DesignSystem | null> {
  const existing = await getDesignSystemById(id);
  if (!existing) {
    return null;
  }

  // Don't allow modifying built-in systems
  if (existing.isBuiltIn && !input.isDefault) {
    throw new Error('Cannot modify built-in design systems');
  }

  const updated: DesignSystem = {
    ...existing,
    name: input.name ?? existing.name,
    description: input.description ?? existing.description,
    version: input.version ?? existing.version,
    tokens: input.tokens
      ? mergeTokens(existing.tokens, input.tokens)
      : existing.tokens,
    components: input.components
      ? { ...existing.components, ...normalizeComponents(input.components) }
      : existing.components,
    guidelines: input.guidelines ?? existing.guidelines,
    examples: input.examples ?? existing.examples,
    updatedAt: new Date().toISOString(),
  };

  // Handle default flag change
  if (input.isDefault !== undefined) {
    updated.isDefault = input.isDefault;
    if (input.isDefault) {
      // Clear default from other systems
      await clearDefaultFlag(id);
      // Update config
      await setDefaultDesignSystemId(id);
    }
  }

  const filePath = path.join(DESIGN_SYSTEMS_DIR, `${id}.json`);
  await fs.writeFile(filePath, JSON.stringify(updated, null, 2));

  return updated;
}

/**
 * Delete a design system
 */
export async function deleteDesignSystem(id: string): Promise<boolean> {
  const existing = await getDesignSystemById(id);
  if (!existing) {
    return false;
  }

  // Don't allow deleting built-in systems
  if (existing.isBuiltIn) {
    throw new Error('Cannot delete built-in design systems');
  }

  const filePath = path.join(DESIGN_SYSTEMS_DIR, `${id}.json`);
  await fs.unlink(filePath);

  // If this was the default, reset to modern-dark
  const config = await getConfig();
  if (config.defaultDesignSystemId === id) {
    await setDefaultDesignSystemId('modern-dark');
  }

  // Remove any project overrides pointing to this system
  for (const [projectId, dsId] of Object.entries(config.projectOverrides)) {
    if (dsId === id) {
      delete config.projectOverrides[projectId];
    }
  }
  await saveConfig(config);

  return true;
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Get the design system configuration
 */
export async function getConfig(): Promise<DesignSystemConfig> {
  await ensureDesignSystemsDir();

  try {
    const content = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {
      defaultDesignSystemId: 'modern-dark',
      projectOverrides: {},
      updatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Save the design system configuration
 */
async function saveConfig(config: DesignSystemConfig): Promise<void> {
  config.updatedAt = new Date().toISOString();
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/**
 * Set the default design system
 */
export async function setDefaultDesignSystemId(id: string): Promise<void> {
  const config = await getConfig();
  config.defaultDesignSystemId = id;
  await saveConfig(config);

  // Update the isDefault flag on design systems
  await clearDefaultFlag(id);
  const ds = await getDesignSystemById(id);
  if (ds) {
    ds.isDefault = true;
    const filePath = path.join(DESIGN_SYSTEMS_DIR, `${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(ds, null, 2));
  }
}

/**
 * Get the default design system
 */
export async function getDefaultDesignSystem(): Promise<DesignSystem | null> {
  const config = await getConfig();
  if (!config.defaultDesignSystemId) {
    return getDesignSystemById('modern-dark');
  }
  return getDesignSystemById(config.defaultDesignSystemId);
}

/**
 * Set a project-specific design system override
 */
export async function setProjectDesignSystem(
  projectId: string,
  designSystemId: string | null
): Promise<void> {
  const config = await getConfig();

  if (designSystemId === null) {
    delete config.projectOverrides[projectId];
  } else {
    config.projectOverrides[projectId] = designSystemId;
  }

  await saveConfig(config);
}

/**
 * Get the design system for a specific project
 * Falls back to default if no override
 */
export async function getDesignSystemForProject(
  projectId: string
): Promise<DesignSystem | null> {
  const config = await getConfig();
  const overrideId = config.projectOverrides[projectId];
  const dsId = overrideId || config.defaultDesignSystemId;

  // TRACING: Log design system selection
  if (overrideId) {
    console.log(`[DesignSystemStore] 🎨 Project "${projectId}" has override: "${dsId}"`);
  } else if (dsId) {
    console.log(`[DesignSystemStore] 🎨 Project "${projectId}" using default: "${dsId}"`);
  } else {
    console.log(`[DesignSystemStore] ⚠️ No design system configured for project "${projectId}"`);
  }

  if (!dsId) {
    return null;
  }

  const ds = await getDesignSystemById(dsId);
  if (ds) {
    console.log(`[DesignSystemStore] ✅ Loaded design system: "${ds.name}" (v${ds.version})`);
  }
  return ds;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Clear the default flag from all design systems except the specified one
 */
async function clearDefaultFlag(exceptId: string): Promise<void> {
  const systems = await getAllDesignSystems();

  for (const ds of systems) {
    if (ds.id !== exceptId && ds.isDefault) {
      ds.isDefault = false;
      const filePath = path.join(DESIGN_SYSTEMS_DIR, `${ds.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(ds, null, 2));
    }
  }
}

/**
 * Merge partial tokens with default tokens
 */
function mergeWithDefaultTokens(partial?: Partial<DesignTokens>): DesignTokens {
  const modernDark = getModernDarkDesignSystem();
  return mergeTokens(modernDark.tokens, partial || {});
}

/**
 * Deep merge design tokens
 */
function mergeTokens(
  base: DesignTokens,
  override: Partial<DesignTokens>
): DesignTokens {
  return {
    colors: { ...base.colors, ...override.colors },
    spacing: override.spacing || base.spacing,
    typography: {
      fontFamily: {
        ...base.typography.fontFamily,
        ...override.typography?.fontFamily,
      },
      fontSize: {
        ...base.typography.fontSize,
        ...override.typography?.fontSize,
      },
      fontWeight: {
        ...base.typography.fontWeight,
        ...override.typography?.fontWeight,
      },
    },
    radii: { ...base.radii, ...override.radii },
    shadows: { ...base.shadows, ...override.shadows },
    transitions: {
      duration: {
        ...base.transitions.duration,
        ...override.transitions?.duration,
      },
      easing: {
        ...base.transitions.easing,
        ...override.transitions?.easing,
      },
    },
  };
}

/**
 * Normalize component specs to ensure required fields
 */
function normalizeComponents(
  components: Record<string, any>
): Record<string, any> {
  const normalized: Record<string, any> = {};

  for (const [key, spec] of Object.entries(components)) {
    normalized[key] = {
      name: spec.name || key,
      description: spec.description || '',
      variants: spec.variants || ['default'],
      states: spec.states || ['default'],
      props: spec.props || {},
      usage: spec.usage || '',
      ...spec,
    };
  }

  return normalized;
}
