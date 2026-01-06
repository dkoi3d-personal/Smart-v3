import { NextRequest, NextResponse } from 'next/server';
import {
  checkOpenAI,
  checkAnthropic,
  checkOllama,
  checkMLX,
  checkGroq,
  checkOpenRouter,
  loadAIConfig,
} from '@/lib/ai-config';
import type { AIProvider } from '@/lib/ai-config';

export async function POST(request: NextRequest) {
  try {
    const { provider, apiKey, baseUrl } = await request.json();

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider is required' },
        { status: 400 }
      );
    }

    // Load saved config to use saved key if no new key provided
    const config = await loadAIConfig();
    let status;

    switch (provider as AIProvider) {
      case 'openai': {
        const key = apiKey || config.providers.openai?.apiKey;
        console.log('[AI Config Check] OpenAI - key provided:', !!apiKey, 'saved key exists:', !!config.providers.openai?.apiKey, 'using key length:', key?.length);
        if (!key) {
          return NextResponse.json(
            { error: 'API key is required for OpenAI. Enter a key or save one first.' },
            { status: 400 }
          );
        }
        status = await checkOpenAI(key);
        console.log('[AI Config Check] OpenAI result:', status);
        break;
      }

      case 'anthropic': {
        const key = apiKey || config.providers.anthropic?.apiKey;
        if (!key) {
          return NextResponse.json(
            { error: 'API key is required for Anthropic. Enter a key or save one first.' },
            { status: 400 }
          );
        }
        status = await checkAnthropic(key);
        break;
      }

      case 'groq': {
        const key = apiKey || config.providers.groq?.apiKey;
        if (!key) {
          return NextResponse.json(
            { error: 'API key is required for Groq. Enter a key or save one first.' },
            { status: 400 }
          );
        }
        status = await checkGroq(key);
        break;
      }

      case 'openrouter': {
        const key = apiKey || config.providers.openrouter?.apiKey;
        if (!key) {
          return NextResponse.json(
            { error: 'API key is required for OpenRouter. Enter a key or save one first.' },
            { status: 400 }
          );
        }
        status = await checkOpenRouter(key);
        break;
      }

      case 'ollama':
        status = await checkOllama(baseUrl || 'http://localhost:11434');
        break;

      case 'mlx':
        status = await checkMLX(baseUrl || 'http://localhost:8080');
        break;

      default:
        return NextResponse.json(
          { error: `Unknown provider: ${provider}` },
          { status: 400 }
        );
    }

    return NextResponse.json(status);
  } catch (error) {
    console.error('Provider check failed:', error);
    return NextResponse.json(
      { error: 'Failed to check provider' },
      { status: 500 }
    );
  }
}

// GET endpoint to check all configured providers
export async function GET() {
  try {
    const config = await loadAIConfig();
    const results: Record<string, { provider: string; available: boolean; models: string[]; error?: string }> = {};

    // Check cloud providers that have API keys
    for (const [name, provider] of Object.entries(config.providers)) {
      if (provider.enabled && provider.apiKey) {
        switch (name) {
          case 'openai':
            results.openai = await checkOpenAI(provider.apiKey);
            break;
          case 'anthropic':
            results.anthropic = await checkAnthropic(provider.apiKey);
            break;
          case 'groq':
            results.groq = await checkGroq(provider.apiKey);
            break;
          case 'openrouter':
            results.openrouter = await checkOpenRouter(provider.apiKey);
            break;
        }
      } else {
        results[name] = { provider: name, available: false, models: [], error: 'Not configured' };
      }
    }

    // Check local LLMs
    if (config.localLLM.ollama.enabled) {
      results.ollama = await checkOllama(config.localLLM.ollama.baseUrl);
    }
    if (config.localLLM.mlx.enabled) {
      results.mlx = await checkMLX(config.localLLM.mlx.baseUrl);
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Failed to check providers:', error);
    return NextResponse.json(
      { error: 'Failed to check providers' },
      { status: 500 }
    );
  }
}
