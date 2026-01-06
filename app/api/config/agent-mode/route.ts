/**
 * API Route: Agent Mode Configuration
 *
 * Allows switching between different agent prompt modes (default, healthcare, etc.)
 */

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'data', 'agent-mode-config.json');

export type AgentMode = 'default' | 'healthcare';

interface AgentModeConfig {
  mode: AgentMode;
  healthcareSettings?: {
    includeEpicAPIs: boolean;
    includeTestPatients: boolean;
    includeFHIRExamples: boolean;
    ehrPlatform: 'epic' | 'cerner' | 'generic';
    complianceLevel: 'hipaa' | 'hipaa-hitrust' | 'basic';
  };
  configuredAt: string | null;
}

const DEFAULT_CONFIG: AgentModeConfig = {
  mode: 'default',
  healthcareSettings: {
    includeEpicAPIs: true,
    includeTestPatients: true,
    includeFHIRExamples: true,
    ehrPlatform: 'generic',
    complianceLevel: 'hipaa',
  },
  configuredAt: null,
};

async function loadConfig(): Promise<AgentModeConfig> {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

async function saveConfig(config: AgentModeConfig): Promise<void> {
  const configDir = path.dirname(CONFIG_FILE);
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export async function GET() {
  const config = await loadConfig();

  return NextResponse.json({
    mode: config.mode,
    healthcareSettings: config.healthcareSettings,
    configuredAt: config.configuredAt,
    availableModes: [
      { id: 'default', name: 'Default', description: 'General-purpose development prompts' },
      { id: 'healthcare', name: 'Healthcare', description: 'HIPAA-compliant, FHIR/EHR-aware prompts' },
    ],
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mode, healthcareSettings } = body;

    if (mode && !['default', 'healthcare'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Must be "default" or "healthcare"' },
        { status: 400 }
      );
    }

    const currentConfig = await loadConfig();

    const newConfig: AgentModeConfig = {
      mode: mode || currentConfig.mode,
      healthcareSettings: healthcareSettings || currentConfig.healthcareSettings,
      configuredAt: new Date().toISOString(),
    };

    await saveConfig(newConfig);

    return NextResponse.json({
      success: true,
      ...newConfig,
    });
  } catch (error) {
    console.error('Error saving agent mode config:', error);
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}
