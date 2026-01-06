import { NextRequest, NextResponse } from 'next/server';
import { loadAIConfig, saveAIConfig } from '@/lib/ai-config';
import type { AIConfig } from '@/lib/ai-config';

export async function GET() {
  try {
    const config = await loadAIConfig();

    // Mask API keys for security (only show last 4 chars)
    const maskedConfig = {
      ...config,
      providers: Object.fromEntries(
        Object.entries(config.providers).map(([key, provider]) => [
          key,
          {
            ...provider,
            apiKey: provider.apiKey
              ? `...${provider.apiKey.slice(-4)}`
              : '',
            hasKey: !!provider.apiKey,
          },
        ])
      ),
    };

    return NextResponse.json(maskedConfig);
  } catch (error) {
    console.error('Failed to load AI config:', error);
    return NextResponse.json(
      { error: 'Failed to load AI configuration' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const updates = await request.json();
    const currentConfig = await loadAIConfig();

    // Merge updates - preserve existing API keys if not explicitly updated
    const newConfig: AIConfig = {
      ...currentConfig,
      ...updates,
      providers: {
        ...currentConfig.providers,
        ...Object.fromEntries(
          Object.entries(updates.providers || {}).map(([key, provider]: [string, any]) => {
            const existing = currentConfig.providers[key as keyof typeof currentConfig.providers];
            return [
              key,
              {
                ...existing,
                ...provider,
                // Only update apiKey if explicitly provided (not masked)
                apiKey: provider.apiKey && !provider.apiKey.startsWith('...')
                  ? provider.apiKey
                  : existing?.apiKey || '',
              },
            ];
          })
        ),
      },
      localLLM: {
        ...currentConfig.localLLM,
        ...updates.localLLM,
        ollama: {
          ...currentConfig.localLLM.ollama,
          ...updates.localLLM?.ollama,
        },
        mlx: {
          ...currentConfig.localLLM.mlx,
          ...updates.localLLM?.mlx,
        },
      },
      builtAppSettings: {
        ...currentConfig.builtAppSettings,
        ...updates.builtAppSettings,
      },
    };

    await saveAIConfig(newConfig);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save AI config:', error);
    return NextResponse.json(
      { error: 'Failed to save AI configuration' },
      { status: 500 }
    );
  }
}
