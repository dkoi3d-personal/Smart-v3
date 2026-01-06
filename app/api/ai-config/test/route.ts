import { NextRequest, NextResponse } from 'next/server';
import { loadAIConfig } from '@/lib/ai-config';
import type { AIProvider } from '@/lib/ai-config';

/**
 * Test AI generation with a simple prompt
 * This actually calls the AI provider to verify it works end-to-end
 */
export async function POST(request: NextRequest) {
  try {
    const { provider: requestedProvider } = await request.json();
    const config = await loadAIConfig();

    // Determine which provider to use
    const provider: AIProvider = requestedProvider || config.defaultProvider;

    let response: string | null = null;
    let model: string = '';
    let error: string | null = null;

    const testPrompt = 'Say "Hello! AI is working." and nothing else.';

    switch (provider) {
      case 'openai': {
        const apiKey = config.providers.openai?.apiKey;
        if (!apiKey) {
          return NextResponse.json({
            success: false,
            error: 'OpenAI API key not configured',
            provider,
          });
        }

        try {
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: config.providers.openai.defaultModel || 'gpt-4o-mini',
              messages: [{ role: 'user', content: testPrompt }],
              max_tokens: 50,
            }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error?.message || 'OpenAI request failed');
          }

          const data = await res.json();
          response = data.choices?.[0]?.message?.content || 'No response';
          model = data.model;
        } catch (e) {
          error = e instanceof Error ? e.message : 'OpenAI test failed';
        }
        break;
      }

      case 'anthropic': {
        const apiKey = config.providers.anthropic?.apiKey;
        if (!apiKey) {
          return NextResponse.json({
            success: false,
            error: 'Anthropic API key not configured',
            provider,
          });
        }

        try {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: config.providers.anthropic.defaultModel || 'claude-3-haiku-20240307',
              max_tokens: 50,
              messages: [{ role: 'user', content: testPrompt }],
            }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error?.message || 'Anthropic request failed');
          }

          const data = await res.json();
          response = data.content?.[0]?.text || 'No response';
          model = data.model;
        } catch (e) {
          error = e instanceof Error ? e.message : 'Anthropic test failed';
        }
        break;
      }

      case 'groq': {
        const apiKey = config.providers.groq?.apiKey;
        if (!apiKey) {
          return NextResponse.json({
            success: false,
            error: 'Groq API key not configured',
            provider,
          });
        }

        try {
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: config.providers.groq.defaultModel || 'llama-3.1-8b-instant',
              messages: [{ role: 'user', content: testPrompt }],
              max_tokens: 50,
            }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error?.message || 'Groq request failed');
          }

          const data = await res.json();
          response = data.choices?.[0]?.message?.content || 'No response';
          model = data.model;
        } catch (e) {
          error = e instanceof Error ? e.message : 'Groq test failed';
        }
        break;
      }

      case 'openrouter': {
        const apiKey = config.providers.openrouter?.apiKey;
        if (!apiKey) {
          return NextResponse.json({
            success: false,
            error: 'OpenRouter API key not configured',
            provider,
          });
        }

        try {
          const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'http://localhost:3000',
              'X-Title': 'AI Platform Test',
            },
            body: JSON.stringify({
              model: config.providers.openrouter.defaultModel || 'openai/gpt-4o-mini',
              messages: [{ role: 'user', content: testPrompt }],
              max_tokens: 50,
            }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error?.message || 'OpenRouter request failed');
          }

          const data = await res.json();
          response = data.choices?.[0]?.message?.content || 'No response';
          model = data.model;
        } catch (e) {
          error = e instanceof Error ? e.message : 'OpenRouter test failed';
        }
        break;
      }

      case 'ollama': {
        const baseUrl = config.localLLM.ollama.baseUrl || 'http://localhost:11434';
        const ollamaModel = config.localLLM.ollama.defaultModel || 'llama3.2';

        try {
          const res = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: ollamaModel,
              prompt: testPrompt,
              stream: false,
            }),
            signal: AbortSignal.timeout(30000), // 30s timeout for local
          });

          if (!res.ok) {
            throw new Error('Ollama request failed');
          }

          const data = await res.json();
          response = data.response || 'No response';
          model = ollamaModel;
        } catch (e) {
          error = e instanceof Error ? e.message : 'Ollama test failed';
        }
        break;
      }

      case 'mlx': {
        const baseUrl = config.localLLM.mlx.baseUrl || 'http://localhost:8080';
        const mlxModel = config.localLLM.mlx.defaultModel || 'mlx-community/Llama-3.2-3B-Instruct-4bit';

        try {
          // MLX uses OpenAI-compatible API
          const res = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: mlxModel,
              messages: [{ role: 'user', content: testPrompt }],
              max_tokens: 50,
            }),
            signal: AbortSignal.timeout(30000), // 30s timeout for local
          });

          if (!res.ok) {
            throw new Error('MLX request failed');
          }

          const data = await res.json();
          response = data.choices?.[0]?.message?.content || 'No response';
          model = mlxModel;
        } catch (e) {
          error = e instanceof Error ? e.message : 'MLX test failed';
        }
        break;
      }

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown provider: ${provider}`,
          provider,
        });
    }

    if (error) {
      return NextResponse.json({
        success: false,
        error,
        provider,
        model,
      });
    }

    return NextResponse.json({
      success: true,
      provider,
      model,
      response,
    });
  } catch (e) {
    console.error('AI test failed:', e);
    return NextResponse.json(
      { success: false, error: 'Test failed unexpectedly' },
      { status: 500 }
    );
  }
}
