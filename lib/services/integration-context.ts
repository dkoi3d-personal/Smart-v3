/**
 * Integration Context for Agents
 *
 * Provides context about enabled integrations that agents can use
 * when generating code. This helps agents know what external services
 * are available and how to use them.
 */

import {
  getEnabledIntegrations,
  ExternalIntegration,
} from './service-catalog';

// ============================================================================
// TYPES
// ============================================================================

export interface IntegrationContext {
  hasIntegrations: boolean;
  count: number;
  integrations: IntegrationSummary[];
  promptContext: string;
}

export interface IntegrationSummary {
  id: string;
  name: string;
  category: string;
  description: string;
  envVars: string[];
  usageHint: string;
}

// ============================================================================
// CONTEXT GENERATION
// ============================================================================

/**
 * Generate a summary of an integration for agent context
 */
function summarizeIntegration(integration: ExternalIntegration): IntegrationSummary {
  const envVars = integration.envVars.map(e => e.name);

  // Generate a usage hint based on category
  let usageHint = '';
  switch (integration.category) {
    case 'analytics':
      usageHint = `Use ${integration.name} for tracking user events and page views. The tracking is auto-initialized.`;
      if (integration.id === 'google-analytics') {
        usageHint += ' Import trackEvent from lib/analytics.ts for custom events.';
      }
      break;
    case 'auth':
      usageHint = `Use ${integration.name} for authentication. Check the providers folder for auth components.`;
      break;
    case 'payments':
      usageHint = `Use ${integration.name} for payment processing. See lib folder for payment utilities.`;
      break;
    case 'mock':
      usageHint = `${integration.name} is a test service. Use it to verify integration patterns work.`;
      break;
    default:
      usageHint = `${integration.name} is configured and ready to use.`;
  }

  return {
    id: integration.id,
    name: integration.name,
    category: integration.category,
    description: integration.description,
    envVars,
    usageHint,
  };
}

/**
 * Generate prompt context for agents about enabled integrations
 */
function generatePromptContext(integrations: ExternalIntegration[]): string {
  if (integrations.length === 0) {
    return '';
  }

  const lines: string[] = [
    '',
    '## Enabled External Integrations',
    '',
    'The following external services are enabled and will be automatically injected into the build:',
    '',
  ];

  for (const integration of integrations) {
    lines.push(`### ${integration.name} (${integration.category})`);
    lines.push(integration.description);
    lines.push('');

    if (integration.envVars.length > 0) {
      lines.push('**Environment Variables:**');
      for (const env of integration.envVars) {
        const required = env.required ? '(required)' : '(optional)';
        lines.push(`- \`${env.name}\` ${required}: ${env.description}`);
      }
      lines.push('');
    }

    // Add code usage examples
    const layoutInjection = integration.injections.find(i => i.target === 'layout');
    const libInjection = integration.injections.find(i => i.target === 'lib');

    if (layoutInjection) {
      lines.push('**Auto-injected in layout:**');
      lines.push('```tsx');
      if (layoutInjection.importStatement) {
        lines.push(layoutInjection.importStatement);
      }
      lines.push(layoutInjection.code);
      lines.push('```');
      lines.push('');
    }

    if (libInjection && libInjection.filename) {
      lines.push(`**Utility file created:** \`${libInjection.filename}\``);
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  lines.push('**Note:** Integration files are automatically created during build. Reference them as needed in your components.');
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get integration context for agents
 *
 * This should be included in agent prompts to help them understand
 * what external services are available.
 */
export function getIntegrationContext(): IntegrationContext {
  const integrations = getEnabledIntegrations();

  return {
    hasIntegrations: integrations.length > 0,
    count: integrations.length,
    integrations: integrations.map(summarizeIntegration),
    promptContext: generatePromptContext(integrations),
  };
}

/**
 * Get a simple list of enabled integration names
 */
export function getEnabledIntegrationNames(): string[] {
  return getEnabledIntegrations().map(i => i.name);
}

/**
 * Check if a specific integration is enabled
 */
export function isIntegrationEnabled(id: string): boolean {
  const integrations = getEnabledIntegrations();
  return integrations.some(i => i.id === id);
}

/**
 * Get integration-specific prompt additions for different agent types
 */
export function getIntegrationPromptForAgent(agentType: 'frontend' | 'backend' | 'fullstack'): string {
  const integrations = getEnabledIntegrations();
  if (integrations.length === 0) return '';

  const lines: string[] = [
    '',
    '## Available Integrations',
    '',
  ];

  for (const integration of integrations) {
    switch (agentType) {
      case 'frontend':
        // Frontend agents care about analytics, auth UI
        if (['analytics', 'auth', 'monitoring'].includes(integration.category)) {
          lines.push(`- **${integration.name}**: ${integration.description}`);
          const providerInjection = integration.injections.find(i => i.target === 'providers');
          if (providerInjection) {
            lines.push(`  - Provider available: \`${providerInjection.filename}\``);
          }
        }
        break;

      case 'backend':
        // Backend agents care about payments, email, database
        if (['payments', 'email', 'database', 'storage'].includes(integration.category)) {
          lines.push(`- **${integration.name}**: ${integration.description}`);
          const apiInjection = integration.injections.find(i => i.target === 'api-route');
          if (apiInjection) {
            lines.push(`  - API route: \`${apiInjection.filename}\``);
          }
        }
        break;

      case 'fullstack':
        // Fullstack agents get everything
        lines.push(`- **${integration.name}** (${integration.category}): ${integration.description}`);
        break;
    }
  }

  if (lines.length === 3) {
    // No relevant integrations for this agent type
    return '';
  }

  lines.push('');
  return lines.join('\n');
}
