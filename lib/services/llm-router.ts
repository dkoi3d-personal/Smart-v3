/**
 * LLM Router - Routes tasks to the optimal LLM provider
 *
 * Selects the best LLM based on task type, capabilities needed,
 * and provider availability.
 */

import { LlmProvider, LlmModel, loadServiceCatalog, getEnabledLlmProviders, getDefaultLlmProvider } from './service-catalog';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Get API key from ai-config.json or environment variable
 */
function getApiKey(providerType: string, envVar?: string): string | undefined {
  // First try ai-config.json
  try {
    const configPath = path.join(process.cwd(), 'data', 'ai-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const key = config.providers?.[providerType]?.apiKey;
      if (key) return key;
    }
  } catch {
    // Ignore errors reading config
  }

  // Fall back to environment variable
  if (envVar) {
    return process.env[envVar];
  }

  return undefined;
}

// ============================================================================
// TYPES
// ============================================================================

export type TaskType =
  | 'code-generation'
  | 'code-review'
  | 'vision-ocr'
  | 'vision-analysis'
  | 'chat'
  | 'embedding'
  | 'reasoning'
  | 'fast-completion'
  | 'local-only';

export interface RoutingOptions {
  taskType: TaskType;
  requireVision?: boolean;
  requireTools?: boolean;
  preferLocal?: boolean;
  preferFast?: boolean;
  maxContextLength?: number;
  modelOverride?: string;
}

export interface RoutedLlm {
  provider: LlmProvider;
  model: LlmModel;
  reason: string;
}

export interface LlmRequest {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  images?: string[]; // Base64 images for vision
}

export interface LlmResponse {
  content: string;
  model: string;
  provider: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ============================================================================
// LLM ROUTER CLASS
// ============================================================================

class LlmRouter {
  /**
   * Select the best LLM for a given task
   */
  selectLlm(options: RoutingOptions): RoutedLlm | null {
    const providers = getEnabledLlmProviders();

    if (providers.length === 0) {
      console.warn('[LLM Router] No enabled providers found');
      return null;
    }

    // If model override specified, find it
    if (options.modelOverride) {
      for (const provider of providers) {
        const model = provider.models.find(m => m.id === options.modelOverride);
        if (model) {
          return { provider, model, reason: 'Model override specified' };
        }
      }
    }

    // Filter by requirements
    let candidates = providers;

    // Vision requirement
    if (options.requireVision) {
      candidates = candidates.filter(p =>
        p.capabilities.includes('vision') &&
        p.models.some(m => m.supportsVision)
      );
    }

    // Tools requirement
    if (options.requireTools) {
      candidates = candidates.filter(p =>
        p.capabilities.includes('function-calling') &&
        p.models.some(m => m.supportsTools)
      );
    }

    // Local preference
    if (options.preferLocal) {
      const localProviders = candidates.filter(p => p.type === 'mlx' || p.type === 'local');
      if (localProviders.length > 0) {
        candidates = localProviders;
      }
    }

    // Fast preference (Groq, then Haiku)
    if (options.preferFast) {
      const groq = candidates.find(p => p.type === 'groq');
      if (groq) {
        const model = groq.models[0];
        return { provider: groq, model, reason: 'Fast inference preferred (Groq)' };
      }
      // Fall back to Haiku
      const anthropic = candidates.find(p => p.type === 'anthropic');
      if (anthropic) {
        const haiku = anthropic.models.find(m => m.name.toLowerCase().includes('haiku'));
        if (haiku) {
          return { provider: anthropic, model: haiku, reason: 'Fast inference preferred (Haiku)' };
        }
      }
    }

    // Task-specific routing
    switch (options.taskType) {
      case 'vision-ocr':
      case 'vision-analysis':
        return this.selectVisionLlm(candidates);

      case 'code-generation':
      case 'code-review':
        return this.selectCodeLlm(candidates);

      case 'reasoning':
        return this.selectReasoningLlm(candidates);

      case 'fast-completion':
        return this.selectFastLlm(candidates);

      case 'local-only':
        return this.selectLocalLlm(candidates);

      case 'chat':
      default:
        return this.selectDefaultLlm(candidates);
    }
  }

  /**
   * Select best LLM for vision tasks
   */
  private selectVisionLlm(providers: LlmProvider[]): RoutedLlm | null {
    // Prefer MLX with DeepSeek-VL for vision on Apple Silicon
    const mlx = providers.find(p => p.type === 'mlx');
    if (mlx) {
      const visionModel = mlx.models.find(m => m.supportsVision);
      if (visionModel) {
        return { provider: mlx, model: visionModel, reason: 'Local MLX vision model (Apple Silicon)' };
      }
    }

    // Fall back to Claude/GPT-4o
    const anthropic = providers.find(p => p.type === 'anthropic');
    if (anthropic) {
      const model = anthropic.models.find(m => m.supportsVision) || anthropic.models[0];
      return { provider: anthropic, model, reason: 'Claude vision capabilities' };
    }

    const openai = providers.find(p => p.type === 'openai');
    if (openai) {
      const model = openai.models.find(m => m.supportsVision) || openai.models[0];
      return { provider: openai, model, reason: 'GPT-4o vision capabilities' };
    }

    return null;
  }

  /**
   * Select best LLM for code tasks
   */
  private selectCodeLlm(providers: LlmProvider[]): RoutedLlm | null {
    // Prefer Claude for code
    const anthropic = providers.find(p => p.type === 'anthropic');
    if (anthropic) {
      const sonnet = anthropic.models.find(m => m.name.toLowerCase().includes('sonnet'));
      if (sonnet) {
        return { provider: anthropic, model: sonnet, reason: 'Claude Sonnet excels at code' };
      }
      return { provider: anthropic, model: anthropic.models[0], reason: 'Claude code capabilities' };
    }

    // Try local MLX code models
    const mlx = providers.find(p => p.type === 'mlx');
    if (mlx) {
      const codeModel = mlx.models.find(m =>
        m.id.includes('Qwen') || m.id.includes('code') || m.id.includes('Mistral')
      );
      if (codeModel) {
        return { provider: mlx, model: codeModel, reason: 'Local MLX code model' };
      }
    }

    return this.selectDefaultLlm(providers);
  }

  /**
   * Select best LLM for complex reasoning
   */
  private selectReasoningLlm(providers: LlmProvider[]): RoutedLlm | null {
    // Prefer Opus or o1 for reasoning
    const anthropic = providers.find(p => p.type === 'anthropic');
    if (anthropic) {
      const opus = anthropic.models.find(m => m.name.toLowerCase().includes('opus'));
      if (opus) {
        return { provider: anthropic, model: opus, reason: 'Opus for complex reasoning' };
      }
    }

    const openai = providers.find(p => p.type === 'openai');
    if (openai) {
      const o1 = openai.models.find(m => m.id === 'o1');
      if (o1) {
        return { provider: openai, model: o1, reason: 'o1 for complex reasoning' };
      }
    }

    return this.selectDefaultLlm(providers);
  }

  /**
   * Select fastest LLM
   */
  private selectFastLlm(providers: LlmProvider[]): RoutedLlm | null {
    // Groq is fastest
    const groq = providers.find(p => p.type === 'groq');
    if (groq) {
      return { provider: groq, model: groq.models[0], reason: 'Groq for fastest inference' };
    }

    // Haiku is fast
    const anthropic = providers.find(p => p.type === 'anthropic');
    if (anthropic) {
      const haiku = anthropic.models.find(m => m.name.toLowerCase().includes('haiku'));
      if (haiku) {
        return { provider: anthropic, model: haiku, reason: 'Haiku for fast inference' };
      }
    }

    // GPT-4o-mini
    const openai = providers.find(p => p.type === 'openai');
    if (openai) {
      const mini = openai.models.find(m => m.id.includes('mini'));
      if (mini) {
        return { provider: openai, model: mini, reason: 'GPT-4o-mini for fast inference' };
      }
    }

    return this.selectDefaultLlm(providers);
  }

  /**
   * Select local-only LLM
   */
  private selectLocalLlm(providers: LlmProvider[]): RoutedLlm | null {
    // Prefer MLX on Apple Silicon for speed
    const mlx = providers.find(p => p.type === 'mlx');
    if (mlx) {
      return { provider: mlx, model: mlx.models[0], reason: 'Local MLX model (Apple Silicon)' };
    }

    const local = providers.find(p => p.type === 'local');
    if (local) {
      return { provider: local, model: local.models[0], reason: 'Local model' };
    }

    return null;
  }

  /**
   * Select default LLM
   */
  private selectDefaultLlm(providers: LlmProvider[]): RoutedLlm | null {
    const defaultProvider = providers.find(p => p.isDefault) || providers[0];
    if (!defaultProvider) return null;

    return {
      provider: defaultProvider,
      model: defaultProvider.models[0],
      reason: 'Default provider',
    };
  }

  /**
   * Make a request to the selected LLM
   */
  async chat(request: LlmRequest, options: RoutingOptions): Promise<LlmResponse> {
    const routed = this.selectLlm(options);

    if (!routed) {
      throw new Error('No suitable LLM provider found');
    }

    console.log(`[LLM Router] Using ${routed.provider.name} / ${routed.model.name} - ${routed.reason}`);

    switch (routed.provider.type) {
      case 'mlx':
        return this.chatMlx(request, routed);
      case 'anthropic':
        return this.chatAnthropic(request, routed);
      case 'openai':
      case 'groq':
        return this.chatOpenAI(request, routed);
      default:
        throw new Error(`Unsupported provider type: ${routed.provider.type}`);
    }
  }

  /**
   * Chat with MLX (mlx-lm server)
   * MLX uses OpenAI-compatible API format when running via mlx_lm.server
   */
  private async chatMlx(request: LlmRequest, routed: RoutedLlm): Promise<LlmResponse> {
    const baseUrl = routed.provider.baseUrl || 'http://localhost:8080';

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model || routed.model.id,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2048,
        stream: false,
      }),
    });

    const data = await response.json();

    return {
      content: data.choices?.[0]?.message?.content || '',
      model: routed.model.id,
      provider: routed.provider.id,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    };
  }

  /**
   * Chat with Anthropic
   */
  private async chatAnthropic(request: LlmRequest, routed: RoutedLlm): Promise<LlmResponse> {
    const apiKey = getApiKey(routed.provider.type, routed.provider.apiKeyEnvVar || 'ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    // Extract system message
    const systemMessage = request.messages.find(m => m.role === 'system');
    const otherMessages = request.messages.filter(m => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: request.model || routed.model.id,
        max_tokens: request.maxTokens || 4096,
        system: systemMessage?.content,
        messages: otherMessages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    const data = await response.json();

    return {
      content: data.content?.[0]?.text || '',
      model: routed.model.id,
      provider: routed.provider.id,
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      } : undefined,
    };
  }

  /**
   * Chat with OpenAI-compatible API (OpenAI, Groq)
   */
  private async chatOpenAI(request: LlmRequest, routed: RoutedLlm): Promise<LlmResponse> {
    const apiKey = getApiKey(routed.provider.type, routed.provider.apiKeyEnvVar || 'OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error(`${routed.provider.name} API key not configured`);
    }

    const baseUrl = routed.provider.baseUrl || 'https://api.openai.com/v1';

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: request.model || routed.model.id,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
      }),
    });

    const data = await response.json();

    return {
      content: data.choices?.[0]?.message?.content || '',
      model: routed.model.id,
      provider: routed.provider.id,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    };
  }

  /**
   * Get routing recommendations for a task
   */
  getRoutingRecommendation(taskType: TaskType): string {
    const recommendations: Record<TaskType, string> = {
      'code-generation': 'Claude Sonnet or Opus recommended for best code quality',
      'code-review': 'Claude for thorough analysis, Groq for quick checks',
      'vision-ocr': 'MLX OCR API with DeepSeek-VL for Apple Silicon',
      'vision-analysis': 'MLX DeepSeek-VL for local, Claude or GPT-4o for cloud',
      'chat': 'Any provider works, Claude recommended for complex conversations',
      'embedding': 'OpenAI ada-002 or local sentence-transformers',
      'reasoning': 'Claude Opus or OpenAI o1 for complex reasoning tasks',
      'fast-completion': 'Groq for fastest response, Haiku for balance',
      'local-only': 'MLX with Qwen 2.5 or Llama 3.2 on Apple Silicon',
    };

    return recommendations[taskType] || 'Use default provider';
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const llmRouter = new LlmRouter();
export default llmRouter;
