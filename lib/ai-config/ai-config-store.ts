import * as fs from 'fs/promises';
import * as path from 'path';
import { AIConfig, AIProviderStatus, DEFAULT_AI_CONFIG, AIProvider } from './types';

// Type for model responses from various APIs
interface ModelInfo {
  id: string;
  name?: string;
}

const CONFIG_PATH = path.join(process.cwd(), 'data', 'ai-config.json');

/**
 * Load AI configuration from disk
 */
export async function loadAIConfig(): Promise<AIConfig> {
  try {
    const content = await fs.readFile(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(content) as AIConfig;
    // Merge with defaults to ensure new fields are present
    return {
      ...DEFAULT_AI_CONFIG,
      ...config,
      providers: {
        ...DEFAULT_AI_CONFIG.providers,
        ...config.providers,
      },
      localLLM: {
        ...DEFAULT_AI_CONFIG.localLLM,
        ...config.localLLM,
        ollama: {
          ...DEFAULT_AI_CONFIG.localLLM.ollama,
          ...config.localLLM?.ollama,
        },
        mlx: {
          ...DEFAULT_AI_CONFIG.localLLM.mlx,
          ...config.localLLM?.mlx,
        },
      },
      builtAppSettings: {
        ...DEFAULT_AI_CONFIG.builtAppSettings,
        ...config.builtAppSettings,
      },
    };
  } catch {
    // Return defaults if file doesn't exist
    return DEFAULT_AI_CONFIG;
  }
}

/**
 * Save AI configuration to disk
 */
export async function saveAIConfig(config: AIConfig): Promise<void> {
  // Ensure data directory exists
  const dataDir = path.dirname(CONFIG_PATH);
  await fs.mkdir(dataDir, { recursive: true });

  config.updatedAt = new Date().toISOString();
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

/**
 * Update specific provider config
 */
export async function updateProviderConfig(
  provider: keyof AIConfig['providers'],
  updates: Partial<AIConfig['providers'][typeof provider]>
): Promise<AIConfig> {
  const config = await loadAIConfig();
  config.providers[provider] = {
    ...config.providers[provider],
    ...updates,
  };
  await saveAIConfig(config);
  return config;
}

/**
 * Check if OpenAI API key is valid
 */
export async function checkOpenAI(apiKey: string): Promise<AIProviderStatus> {
  try {
    // Trim whitespace that might have been copied with the key
    const cleanKey = apiKey.trim();

    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${cleanKey}` },
    });

    if (!response.ok) {
      // Get the actual error from OpenAI
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `Error ${response.status}`;
      return { provider: 'openai', available: false, models: [], error: errorMessage };
    }

    const data = await response.json();
    const models = (data.data as ModelInfo[])
      .filter((m) => m.id.startsWith('gpt-'))
      .map((m) => m.id)
      .slice(0, 10);

    return { provider: 'openai', available: true, models };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Connection failed';
    return { provider: 'openai', available: false, models: [], error: message };
  }
}

/**
 * Check if Anthropic API key is valid
 */
export async function checkAnthropic(apiKey: string): Promise<AIProviderStatus> {
  try {
    // Anthropic doesn't have a models endpoint, so we do a minimal completion
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return {
        provider: 'anthropic',
        available: false,
        models: [],
        error: error.error?.message || 'Invalid API key',
      };
    }

    return {
      provider: 'anthropic',
      available: true,
      models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307', 'claude-3-5-sonnet-20241022'],
    };
  } catch {
    return { provider: 'anthropic', available: false, models: [], error: 'Connection failed' };
  }
}

/**
 * Check Ollama availability and models
 */
export async function checkOllama(baseUrl: string = 'http://localhost:11434'): Promise<AIProviderStatus> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return { provider: 'ollama', available: false, models: [], error: 'Ollama not responding' };
    }

    const data = await response.json();
    const models = (data.models || []).map((m: ModelInfo) => m.name || m.id);

    return { provider: 'ollama', available: true, models };
  } catch {
    return { provider: 'ollama', available: false, models: [], error: 'Ollama not running' };
  }
}

/**
 * Check MLX availability
 */
export async function checkMLX(baseUrl: string = 'http://localhost:8080'): Promise<AIProviderStatus> {
  try {
    const response = await fetch(`${baseUrl}/v1/models`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return { provider: 'mlx', available: false, models: [], error: 'MLX not responding' };
    }

    const data = await response.json();
    const models = (data.data || []).map((m: ModelInfo) => m.id);

    return { provider: 'mlx', available: true, models };
  } catch {
    return { provider: 'mlx', available: false, models: [], error: 'MLX not running' };
  }
}

/**
 * Check Groq API key
 */
export async function checkGroq(apiKey: string): Promise<AIProviderStatus> {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      return { provider: 'groq', available: false, models: [], error: 'Invalid API key' };
    }

    const data = await response.json();
    const models = (data.data as ModelInfo[] || []).map((m) => m.id);

    return { provider: 'groq', available: true, models };
  } catch {
    return { provider: 'groq', available: false, models: [], error: 'Connection failed' };
  }
}

/**
 * Check OpenRouter API key
 */
export async function checkOpenRouter(apiKey: string): Promise<AIProviderStatus> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
      },
    });

    if (!response.ok) {
      return { provider: 'openrouter', available: false, models: [], error: 'Invalid API key' };
    }

    const data = await response.json();
    // Get top 15 popular models
    const models = (data.data as ModelInfo[] || [])
      .slice(0, 15)
      .map((m) => m.id);

    return { provider: 'openrouter', available: true, models };
  } catch {
    return { provider: 'openrouter', available: false, models: [], error: 'Connection failed' };
  }
}

/**
 * Get the best available provider based on config
 */
export async function getBestProvider(config: AIConfig): Promise<{
  provider: AIProvider;
  model: string;
  baseUrl?: string;
  apiKey?: string;
} | null> {
  // Check local first if preferred
  if (config.localLLM.enabled && config.localLLM.preferLocal) {
    if (config.localLLM.ollama.enabled) {
      const status = await checkOllama(config.localLLM.ollama.baseUrl);
      if (status.available && status.models.length > 0) {
        return {
          provider: 'ollama',
          model: config.localLLM.ollama.defaultModel || status.models[0],
          baseUrl: config.localLLM.ollama.baseUrl,
        };
      }
    }
    if (config.localLLM.mlx.enabled) {
      const status = await checkMLX(config.localLLM.mlx.baseUrl);
      if (status.available && status.models.length > 0) {
        return {
          provider: 'mlx',
          model: config.localLLM.mlx.defaultModel || status.models[0],
          baseUrl: config.localLLM.mlx.baseUrl,
        };
      }
    }
  }

  // Check cloud providers
  const defaultProvider = config.defaultProvider;
  const providerConfig = config.providers[defaultProvider as keyof typeof config.providers];

  if (providerConfig?.enabled && providerConfig.apiKey) {
    return {
      provider: defaultProvider,
      model: providerConfig.defaultModel || '',
      apiKey: providerConfig.apiKey,
      baseUrl: providerConfig.baseUrl,
    };
  }

  // Fallback: find any enabled provider
  for (const [name, pConfig] of Object.entries(config.providers)) {
    if (pConfig.enabled && pConfig.apiKey) {
      return {
        provider: name as AIProvider,
        model: pConfig.defaultModel || '',
        apiKey: pConfig.apiKey,
        baseUrl: pConfig.baseUrl,
      };
    }
  }

  return null;
}

/**
 * Generate environment variables for built apps
 */
export function generateEnvVars(config: AIConfig): Record<string, string> {
  const env: Record<string, string> = {};

  if (config.providers.openai.enabled && config.providers.openai.apiKey) {
    env.OPENAI_API_KEY = config.providers.openai.apiKey;
    env.OPENAI_MODEL = config.providers.openai.defaultModel || 'gpt-4o-mini';
  }

  if (config.providers.anthropic.enabled && config.providers.anthropic.apiKey) {
    env.ANTHROPIC_API_KEY = config.providers.anthropic.apiKey;
    env.ANTHROPIC_MODEL = config.providers.anthropic.defaultModel || 'claude-3-haiku-20240307';
  }

  if (config.providers.groq.enabled && config.providers.groq.apiKey) {
    env.GROQ_API_KEY = config.providers.groq.apiKey;
  }

  if (config.localLLM.ollama.enabled) {
    env.OLLAMA_BASE_URL = config.localLLM.ollama.baseUrl;
    env.OLLAMA_MODEL = config.localLLM.ollama.defaultModel;
  }

  env.AI_PROVIDER = config.defaultProvider;

  return env;
}

/**
 * Generate .env.example content for built apps
 */
export function generateEnvExample(config: AIConfig): string {
  const lines: string[] = [
    '# AI Configuration',
    '# Choose your AI provider and add the appropriate API key',
    '',
    '# Default AI provider (openai | anthropic | ollama | groq)',
    `AI_PROVIDER=${config.defaultProvider}`,
    '',
    '# OpenAI (https://platform.openai.com/api-keys)',
    `OPENAI_API_KEY=${config.providers.openai.apiKey ? '[CONFIGURED]' : 'sk-...'}`,
    `OPENAI_MODEL=${config.providers.openai.defaultModel || 'gpt-4o-mini'}`,
    '',
    '# Anthropic (https://console.anthropic.com/)',
    `ANTHROPIC_API_KEY=${config.providers.anthropic.apiKey ? '[CONFIGURED]' : 'sk-ant-...'}`,
    `ANTHROPIC_MODEL=${config.providers.anthropic.defaultModel || 'claude-3-haiku-20240307'}`,
    '',
    '# Groq (https://console.groq.com/)',
    `GROQ_API_KEY=${config.providers.groq.apiKey ? '[CONFIGURED]' : 'gsk_...'}`,
    '',
    '# Local LLM (Ollama - https://ollama.ai)',
    `OLLAMA_BASE_URL=${config.localLLM.ollama.baseUrl}`,
    `OLLAMA_MODEL=${config.localLLM.ollama.defaultModel}`,
    '',
  ];

  return lines.join('\n');
}
