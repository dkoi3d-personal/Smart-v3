import { NextRequest } from 'next/server';
import { buildApp, attemptQuickFix, BuildProgress } from '@/services/simple-builder';

export const maxDuration = 300; // 5 minutes max for Vercel

interface DatabaseConfig {
  provider: 'sqlite' | 'neon' | 'supabase' | 'aws-rds';
  schemaTemplate: 'auto' | 'authentication' | 'blog' | 'ecommerce' | 'saas' | 'todoApp';
}

interface TemplateConfig {
  templateId: string;
  appName: string;
  epicApis: Array<{
    apiId: string;
    resourceType: string;
    displayName: string;
    isFromTemplate: boolean;
    isRequired: boolean;
    generateComponents: string[];
    generateHooks: string[];
  }>;
  enabledFeatures: string[];
  designSystemId?: string;
  databaseConfig?: DatabaseConfig;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;

      const safeEnqueue = (data: string) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(data));
        } catch (err) {
          isClosed = true;
        }
      };

      const safeClose = () => {
        isClosed = true;
        controller.close();
      };

      try {
        const body = await request.json();
        const {
          requirements,
          action,
          error: fixError,
          databaseConfig,
          templateConfig,
        } = body;

        // Generate project ID if not provided
        const projectId = body.projectId || `proj-${Date.now()}`;

        // Send project ID back immediately
        safeEnqueue(`data: ${JSON.stringify({ type: 'projectId', projectId })}\n\n`);

        // Progress callback to stream updates
        const onProgress = (progress: BuildProgress) => {
          safeEnqueue(`data: ${JSON.stringify({ type: 'progress', progress })}\n\n`);
        };

        if (action === 'fix' && fixError) {
          // Attempt to fix an error
          const { getProjectDir } = await import('@/lib/project-paths');
          const projectDir = getProjectDir(projectId);

          const result = await attemptQuickFix(projectDir, fixError, onProgress);

          if (!result.success) {
            safeEnqueue(`data: ${JSON.stringify({
              type: 'error',
              error: result.error || 'Fix attempt failed',
            })}\n\n`);
          }
        } else {
          // Build new app
          // Use templateConfig requirements if provided, otherwise use direct requirements
          const buildRequirements = templateConfig
            ? generateRequirementsFromTemplateConfig(templateConfig)
            : requirements;

          if (!buildRequirements) {
            safeEnqueue(`data: ${JSON.stringify({
              type: 'error',
              error: 'Requirements or template config required',
            })}\n\n`);
            safeClose();
            return;
          }

          // Use database config from templateConfig if available
          const dbConfig = templateConfig?.databaseConfig || databaseConfig;

          console.log('[simple-build] templateConfig:', JSON.stringify(templateConfig, null, 2));

          // Pass full templateConfig to builder for proper component generation
          const result = await buildApp(projectId, buildRequirements, onProgress, dbConfig, templateConfig);

          if (result.success) {
            safeEnqueue(`data: ${JSON.stringify({
              type: 'complete',
              projectId,
              projectDir: result.projectDir,
            })}\n\n`);
          }
        }

        safeEnqueue(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        safeClose();

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        safeEnqueue(`data: ${JSON.stringify({
          type: 'error',
          error: errorMessage,
        })}\n\n`);
        safeClose();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * Generate a natural language requirements string from template config
 */
function generateRequirementsFromTemplateConfig(config: TemplateConfig): string {
  const parts: string[] = [];

  parts.push(`Create a healthcare application called "${config.appName}".`);

  if (config.epicApis.length > 0) {
    const apiNames = config.epicApis.map(api => api.displayName).join(', ');
    parts.push(`Use Epic FHIR APIs: ${apiNames}.`);

    // List components to generate
    const components = config.epicApis.flatMap(api => api.generateComponents);
    if (components.length > 0) {
      parts.push(`Generate these components: ${components.join(', ')}.`);
    }

    // List hooks to generate
    const hooks = config.epicApis.flatMap(api => api.generateHooks);
    if (hooks.length > 0) {
      parts.push(`Generate these hooks: ${hooks.join(', ')}.`);
    }
  }

  if (config.enabledFeatures.length > 0) {
    parts.push(`Include features: ${config.enabledFeatures.join(', ')}.`);
  }

  if (config.databaseConfig) {
    parts.push(`Set up ${config.databaseConfig.provider} database.`);
  }

  return parts.join(' ');
}
