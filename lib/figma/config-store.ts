/**
 * Figma Configuration Store
 *
 * Manages Figma API token and settings persistence.
 */

import * as fs from 'fs/promises';
import path from 'path';

export interface FigmaConfig {
  token: string | null;
  enabled: boolean;
  lastValidated: string | null;
  accountEmail?: string;
}

const DEFAULT_FIGMA_CONFIG: FigmaConfig = {
  token: null,
  enabled: false,
  lastValidated: null,
};

const CONFIG_FILE = path.join(process.cwd(), 'data', 'figma-config.json');

/**
 * Load Figma configuration from disk
 */
export async function loadFigmaConfig(): Promise<FigmaConfig> {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    return { ...DEFAULT_FIGMA_CONFIG, ...JSON.parse(data) };
  } catch {
    return { ...DEFAULT_FIGMA_CONFIG };
  }
}

/**
 * Save Figma configuration to disk
 */
export async function saveFigmaConfig(config: Partial<FigmaConfig>): Promise<FigmaConfig> {
  const current = await loadFigmaConfig();
  const updated = { ...current, ...config };

  // Ensure data directory exists
  const dataDir = path.dirname(CONFIG_FILE);
  await fs.mkdir(dataDir, { recursive: true });

  await fs.writeFile(CONFIG_FILE, JSON.stringify(updated, null, 2));
  return updated;
}

/**
 * Get the Figma API token
 * Returns from config file first, then falls back to environment variable
 */
export async function getFigmaToken(): Promise<string | null> {
  const config = await loadFigmaConfig();

  // First try the stored token
  if (config.token && config.enabled) {
    return config.token;
  }

  // Fall back to environment variable
  return process.env.FIGMA_PERSONAL_ACCESS_TOKEN || null;
}

/**
 * Validate a Figma token by making a test API call
 */
export async function validateFigmaToken(token: string): Promise<{
  valid: boolean;
  email?: string;
  error?: string;
}> {
  try {
    const response = await fetch('https://api.figma.com/v1/me', {
      headers: {
        'X-Figma-Token': token,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return {
        valid: true,
        email: data.email,
      };
    }

    if (response.status === 403) {
      return { valid: false, error: 'Invalid token or insufficient permissions' };
    }

    return { valid: false, error: `API error: ${response.status}` };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Failed to validate token',
    };
  }
}

/**
 * Check if Figma is configured and ready to use
 */
export async function isFigmaConfigured(): Promise<boolean> {
  const token = await getFigmaToken();
  return token !== null;
}
