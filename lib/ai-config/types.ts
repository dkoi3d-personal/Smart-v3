// AI Provider Configuration Types

export type AIProvider = 'openai' | 'anthropic' | 'ollama' | 'mlx' | 'groq' | 'openrouter';

export interface ProviderConfig {
  enabled: boolean;
  apiKey?: string;  // For cloud providers
  baseUrl?: string; // For custom endpoints or local
  defaultModel?: string;
  models?: string[]; // Available models
}

export interface LocalLLMConfig {
  provider: 'ollama' | 'mlx';
  enabled: boolean;
  baseUrl: string;
  defaultModel: string;
  availableModels: string[];
  lastChecked?: string;
  status: 'connected' | 'disconnected' | 'error';
}

export interface AIConfig {
  // Default provider for built apps
  defaultProvider: AIProvider;

  // Cloud providers
  providers: {
    openai: ProviderConfig;
    anthropic: ProviderConfig;
    groq: ProviderConfig;
    openrouter: ProviderConfig;
  };

  // Local LLM configuration
  localLLM: {
    enabled: boolean;
    preferLocal: boolean; // Use local when available
    ollama: LocalLLMConfig;
    mlx: LocalLLMConfig;
  };

  // Settings for built apps
  builtAppSettings: {
    // What to inject into built apps
    injectProvider: 'configured' | 'placeholder' | 'none';
    // Include .env.example with API key placeholders
    includeEnvExample: boolean;
    // Include AI service wrapper with error handling
    includeServiceWrapper: boolean;
    // Include local LLM fallback
    includeLocalFallback: boolean;
  };

  updatedAt: string;
}

export interface AIProviderStatus {
  provider: AIProvider;
  available: boolean;
  models: string[];
  error?: string;
  latency?: number;
}

// Default configuration
export const DEFAULT_AI_CONFIG: AIConfig = {
  defaultProvider: 'openai',
  providers: {
    openai: {
      enabled: false,
      apiKey: '',
      defaultModel: 'gpt-4o-mini',
      models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    },
    anthropic: {
      enabled: false,
      apiKey: '',
      defaultModel: 'claude-3-haiku-20240307',
      models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    },
    groq: {
      enabled: false,
      apiKey: '',
      defaultModel: 'llama-3.1-70b-versatile',
      models: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    },
    openrouter: {
      enabled: false,
      apiKey: '',
      baseUrl: 'https://openrouter.ai/api/v1',
      defaultModel: 'openai/gpt-4o-mini',
    },
  },
  localLLM: {
    enabled: false,
    preferLocal: false,
    ollama: {
      provider: 'ollama',
      enabled: false,
      baseUrl: 'http://localhost:11434',
      defaultModel: 'llama3.2',
      availableModels: [],
      status: 'disconnected',
    },
    mlx: {
      provider: 'mlx',
      enabled: false,
      baseUrl: 'http://localhost:8080',
      defaultModel: 'mlx-community/Llama-3.2-3B-Instruct-4bit',
      availableModels: [],
      status: 'disconnected',
    },
  },
  builtAppSettings: {
    injectProvider: 'placeholder',
    includeEnvExample: true,
    includeServiceWrapper: true,
    includeLocalFallback: true,
  },
  updatedAt: new Date().toISOString(),
};
