/**
 * Local AI Configuration Store
 *
 * Persists local AI service configuration
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { LocalAIConfig, DEFAULT_LOCAL_AI_CONFIG, ModelCapability } from './types';

const CONFIG_FILE = path.join(process.cwd(), 'data', 'local-ai-config.json');

/**
 * Load local AI configuration
 */
export async function loadLocalAIConfig(): Promise<LocalAIConfig> {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(data) as Partial<LocalAIConfig>;
    return { ...DEFAULT_LOCAL_AI_CONFIG, ...config };
  } catch {
    return DEFAULT_LOCAL_AI_CONFIG;
  }
}

/**
 * Save local AI configuration
 */
export async function saveLocalAIConfig(config: LocalAIConfig): Promise<void> {
  const dataDir = path.dirname(CONFIG_FILE);
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Update specific settings
 */
export async function updateLocalAIConfig(
  updates: Partial<LocalAIConfig>
): Promise<LocalAIConfig> {
  const config = await loadLocalAIConfig();
  const updated = { ...config, ...updates };
  await saveLocalAIConfig(updated);
  return updated;
}

/**
 * Toggle a capability
 */
export async function toggleCapability(
  capability: ModelCapability,
  enabled: boolean
): Promise<LocalAIConfig> {
  const config = await loadLocalAIConfig();

  if (enabled && !config.enabledCapabilities.includes(capability)) {
    config.enabledCapabilities.push(capability);
  } else if (!enabled) {
    config.enabledCapabilities = config.enabledCapabilities.filter((c) => c !== capability);
  }

  await saveLocalAIConfig(config);
  return config;
}

/**
 * Set preferred model for a capability
 */
export async function setPreferredModel(
  capability: ModelCapability,
  modelName: string
): Promise<LocalAIConfig> {
  const config = await loadLocalAIConfig();
  config.preferredModels[capability] = modelName;
  await saveLocalAIConfig(config);
  return config;
}

export const localAIConfigStore = {
  loadLocalAIConfig,
  saveLocalAIConfig,
  updateLocalAIConfig,
  toggleCapability,
  setPreferredModel,
};

export default localAIConfigStore;
