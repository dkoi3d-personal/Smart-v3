/**
 * MCP Configuration Store
 *
 * Manages MCP (Model Context Protocol) settings for agent access.
 * Persists to data/mcp-config.json
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface McpConfig {
  figmaMcpEnabled: boolean;
  memoryMcpEnabled: boolean;
  filesystemMcpEnabled: boolean;
  githubMcpEnabled: boolean;
  eslintMcpEnabled: boolean;
  lastUpdated: string | null;
}

const DEFAULT_MCP_CONFIG: McpConfig = {
  figmaMcpEnabled: false,
  memoryMcpEnabled: false,
  filesystemMcpEnabled: false,
  githubMcpEnabled: false,
  eslintMcpEnabled: false,
  lastUpdated: null,
};

const CONFIG_FILE = path.join(process.cwd(), 'data', 'mcp-config.json');

export async function loadMcpConfig(): Promise<McpConfig> {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    return { ...DEFAULT_MCP_CONFIG, ...JSON.parse(data) };
  } catch {
    return { ...DEFAULT_MCP_CONFIG };
  }
}

export async function saveMcpConfig(config: Partial<McpConfig>): Promise<McpConfig> {
  const current = await loadMcpConfig();
  const updated: McpConfig = {
    ...current,
    ...config,
    lastUpdated: new Date().toISOString(),
  };

  const dataDir = path.dirname(CONFIG_FILE);
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(updated, null, 2));

  return updated;
}

/**
 * Get list of enabled MCP servers for agent use
 */
export async function getEnabledMcpServers(): Promise<string[]> {
  const config = await loadMcpConfig();
  const enabled: string[] = [];

  if (config.figmaMcpEnabled) enabled.push('figma');
  if (config.memoryMcpEnabled) enabled.push('memory');
  if (config.filesystemMcpEnabled) enabled.push('filesystem');
  if (config.githubMcpEnabled) enabled.push('github');
  if (config.eslintMcpEnabled) enabled.push('eslint');

  return enabled;
}

/**
 * Check if any MCP servers are enabled
 */
export async function hasEnabledMcpServers(): Promise<boolean> {
  const enabled = await getEnabledMcpServers();
  return enabled.length > 0;
}
