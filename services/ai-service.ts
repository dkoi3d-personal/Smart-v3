/**
 * Unified AI Service
 *
 * Simple wrapper around llmRouter for common AI tasks.
 * Supports: Anthropic, OpenAI, Groq, MLX (local)
 *
 * Uses the existing llmRouter and service catalog for provider selection.
 */

import { llmRouter, type TaskType } from '@/lib/services/llm-router';
import { getEnabledLlmProviders } from '@/lib/services/service-catalog';

export type AIProvider = 'anthropic' | 'openai' | 'groq' | 'mlx' | 'auto';

export interface AIServiceConfig {
  /** Which provider to use. 'auto' uses llmRouter selection */
  provider?: AIProvider;
  /** Model to use (provider-specific) */
  model?: string;
  /** Max tokens for response */
  maxTokens?: number;
  /** Temperature for generation */
  temperature?: number;
  /** Task type for routing */
  taskType?: TaskType;
}

export interface AIResponse {
  content: string;
  provider: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Get available providers based on service catalog
 */
export function getAvailableProviders(): string[] {
  const providers = getEnabledLlmProviders();
  return providers.map(p => p.type);
}

/**
 * Check if any AI provider is available
 */
export function isAIAvailable(): boolean {
  return getAvailableProviders().length > 0;
}

/**
 * Main AI completion function using llmRouter
 */
export async function complete(
  systemPrompt: string,
  userMessage: string,
  config: AIServiceConfig = {}
): Promise<AIResponse> {
  const { maxTokens = 2048, temperature = 0.7, taskType = 'chat', model } = config;

  const response = await llmRouter.chat(
    {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      maxTokens,
      temperature,
      model,
    },
    {
      taskType,
      modelOverride: model,
    }
  );

  return {
    content: response.content,
    provider: response.provider,
    model: response.model,
    usage: response.usage ? {
      inputTokens: response.usage.promptTokens,
      outputTokens: response.usage.completionTokens,
    } : undefined,
  };
}

/**
 * Simple text completion (convenience wrapper)
 */
export async function ask(
  prompt: string,
  systemPrompt: string = 'You are a helpful assistant.',
  config: AIServiceConfig = {}
): Promise<string> {
  const response = await complete(systemPrompt, prompt, config);
  return response.content;
}

/**
 * Enhance a prompt using AI
 */
export async function enhancePrompt(
  prompt: string,
  context?: string,
  config: AIServiceConfig = {}
): Promise<string> {
  const systemPrompt = `You are an expert software architect and requirements analyst. Your job is to take a brief, rough idea for a software feature and expand it into a clear, detailed, actionable prompt for an AI coding assistant.

Guidelines:
- Keep the same intent and scope as the original
- Add specific implementation details that would be helpful
- Include UI/UX considerations where relevant
- Mention error handling and edge cases
- Suggest best practices and patterns to use
- Keep it concise but comprehensive (aim for 3-6 bullet points or short paragraphs)
- Use clear, technical language
- Don't add features the user didn't ask for - just clarify and expand what they want
- Format with line breaks for readability

Example Input: "add dark mode"

Example Output:
Add dark mode toggle with system preference detection:
- Create a theme context/provider that persists preference to localStorage
- Add a toggle button in the header/navbar with sun/moon icons
- Implement CSS variables for colors (--bg-primary, --text-primary, etc.)
- Support three modes: light, dark, and system (auto-detect)
- Add smooth transition animation when switching themes
- Ensure all components respect the theme variables`;

  let userMessage = prompt;
  if (context) {
    userMessage = `Project context: ${context}\n\nUser's prompt to enhance:\n${prompt}`;
  }

  return ask(userMessage, systemPrompt, { ...config, maxTokens: 1024, taskType: 'code-generation' });
}

// Export default service object for convenience
export const AIService = {
  complete,
  ask,
  enhancePrompt,
  isAvailable: isAIAvailable,
  getProviders: getAvailableProviders,
};

export default AIService;
