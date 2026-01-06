/**
 * Integration Injector Service
 *
 * Injects enabled external integrations into build outputs.
 * This service is used by the build process to automatically add
 * analytics, auth, payments, and other external services.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  getEnabledIntegrations,
  getRequiredPackages,
  getRequiredEnvVars,
  ExternalIntegration,
  IntegrationInjection,
  IntegrationEnvVar,
} from './service-catalog';

// ============================================================================
// TYPES
// ============================================================================

export interface InjectionResult {
  success: boolean;
  integration: string;
  target: string;
  filename?: string;
  error?: string;
}

export interface InjectionSummary {
  totalIntegrations: number;
  successfulInjections: number;
  failedInjections: number;
  results: InjectionResult[];
  packagesInstalled: string[];
  envVarsRequired: IntegrationEnvVar[];
}

export interface InjectionOptions {
  projectDir: string;
  dryRun?: boolean;
  includeCategories?: string[];
  excludeCategories?: string[];
}

// ============================================================================
// INJECTION HELPERS
// ============================================================================

/**
 * Ensure directory exists for a file path
 */
function ensureDirectoryExists(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Write a new file with injection code
 */
function writeInjectionFile(
  projectDir: string,
  injection: IntegrationInjection,
  dryRun: boolean
): InjectionResult {
  if (!injection.filename) {
    return {
      success: false,
      integration: '',
      target: injection.target,
      error: 'No filename specified for injection',
    };
  }

  const filePath = path.join(projectDir, injection.filename);

  if (dryRun) {
    console.log(`[DRY RUN] Would write file: ${filePath}`);
    return {
      success: true,
      integration: '',
      target: injection.target,
      filename: injection.filename,
    };
  }

  try {
    ensureDirectoryExists(filePath);
    fs.writeFileSync(filePath, injection.code, 'utf-8');
    console.log(`[Injector] Created file: ${filePath}`);
    return {
      success: true,
      integration: '',
      target: injection.target,
      filename: injection.filename,
    };
  } catch (error) {
    return {
      success: false,
      integration: '',
      target: injection.target,
      filename: injection.filename,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Inject code into an existing file (layout, providers, etc.)
 */
function injectIntoExistingFile(
  projectDir: string,
  injection: IntegrationInjection,
  dryRun: boolean
): InjectionResult {
  if (!injection.filename) {
    return {
      success: false,
      integration: '',
      target: injection.target,
      error: 'No filename specified for injection',
    };
  }

  const filePath = path.join(projectDir, injection.filename);

  if (!fs.existsSync(filePath)) {
    // File doesn't exist, create it
    return writeInjectionFile(projectDir, injection, dryRun);
  }

  if (dryRun) {
    console.log(`[DRY RUN] Would inject into: ${filePath}`);
    if (injection.importStatement) {
      console.log(`  Import: ${injection.importStatement}`);
    }
    console.log(`  Code: ${injection.code.substring(0, 100)}...`);
    return {
      success: true,
      integration: '',
      target: injection.target,
      filename: injection.filename,
    };
  }

  try {
    let content = fs.readFileSync(filePath, 'utf-8');

    // Check if already injected
    if (content.includes(injection.code.trim().substring(0, 50))) {
      console.log(`[Injector] Already injected in: ${filePath}`);
      return {
        success: true,
        integration: '',
        target: injection.target,
        filename: injection.filename,
      };
    }

    // Add import statement if provided
    if (injection.importStatement) {
      // Find the last import statement and add after it
      const importRegex = /^import .+$/gm;
      const matches = [...content.matchAll(importRegex)];
      if (matches.length > 0) {
        const lastImport = matches[matches.length - 1];
        const insertPosition = lastImport.index! + lastImport[0].length;
        content =
          content.slice(0, insertPosition) +
          '\n' +
          injection.importStatement +
          content.slice(insertPosition);
      } else {
        // No imports found, add at the beginning
        content = injection.importStatement + '\n' + content;
      }
    }

    // For layout injections, add before closing body tag
    if (injection.target === 'layout' && content.includes('</body>')) {
      content = content.replace('</body>', `        ${injection.code}\n      </body>`);
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`[Injector] Injected into: ${filePath}`);

    return {
      success: true,
      integration: '',
      target: injection.target,
      filename: injection.filename,
    };
  } catch (error) {
    return {
      success: false,
      integration: '',
      target: injection.target,
      filename: injection.filename,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process a single injection
 */
function processInjection(
  projectDir: string,
  integration: ExternalIntegration,
  injection: IntegrationInjection,
  dryRun: boolean
): InjectionResult {
  let result: InjectionResult;

  switch (injection.target) {
    case 'layout':
      result = injectIntoExistingFile(projectDir, injection, dryRun);
      break;

    case 'providers':
    case 'lib':
    case 'api-route':
    case 'config':
      result = writeInjectionFile(projectDir, injection, dryRun);
      break;

    case 'env':
      // For env files, we just log what needs to be added
      console.log(`[Injector] Env vars needed for ${integration.name}:`);
      integration.envVars.forEach((env) => {
        console.log(`  ${env.name}=${env.example || '<your-value>'}`);
      });
      result = {
        success: true,
        integration: integration.name,
        target: 'env',
      };
      break;

    default:
      result = writeInjectionFile(projectDir, injection, dryRun);
  }

  result.integration = integration.name;
  return result;
}

// ============================================================================
// MAIN INJECTION FUNCTION
// ============================================================================

/**
 * Inject all enabled integrations into a project
 */
export async function injectIntegrations(
  options: InjectionOptions
): Promise<InjectionSummary> {
  const { projectDir, dryRun = false, includeCategories, excludeCategories } = options;

  console.log(`[Injector] Starting integration injection for: ${projectDir}`);
  console.log(`[Injector] Dry run: ${dryRun}`);

  // Get enabled integrations
  let integrations = getEnabledIntegrations();

  // Filter by categories if specified
  if (includeCategories?.length) {
    integrations = integrations.filter((i) =>
      includeCategories.includes(i.category)
    );
  }
  if (excludeCategories?.length) {
    integrations = integrations.filter(
      (i) => !excludeCategories.includes(i.category)
    );
  }

  console.log(`[Injector] Found ${integrations.length} enabled integrations`);

  const results: InjectionResult[] = [];
  const packages = getRequiredPackages();
  const envVars = getRequiredEnvVars();

  // Process each integration
  for (const integration of integrations) {
    console.log(`[Injector] Processing: ${integration.name}`);

    for (const injection of integration.injections) {
      const result = processInjection(projectDir, integration, injection, dryRun);
      results.push(result);
    }
  }

  const successfulInjections = results.filter((r) => r.success).length;
  const failedInjections = results.filter((r) => !r.success).length;

  const summary: InjectionSummary = {
    totalIntegrations: integrations.length,
    successfulInjections,
    failedInjections,
    results,
    packagesInstalled: packages,
    envVarsRequired: envVars,
  };

  console.log(`[Injector] Complete:`);
  console.log(`  Integrations: ${summary.totalIntegrations}`);
  console.log(`  Successful: ${successfulInjections}`);
  console.log(`  Failed: ${failedInjections}`);
  console.log(`  Packages to install: ${packages.join(', ') || 'none'}`);

  return summary;
}

/**
 * Generate package.json dependencies for enabled integrations
 */
export function getIntegrationDependencies(): Record<string, string> {
  const packages = getRequiredPackages();
  const deps: Record<string, string> = {};

  // Map known packages to versions
  const packageVersions: Record<string, string> = {
    '@next/third-parties': '^14.0.0',
    'react-ga4': '^2.1.0',
    '@google-analytics/data': '^4.0.0',
  };

  for (const pkg of packages) {
    deps[pkg] = packageVersions[pkg] || 'latest';
  }

  return deps;
}

/**
 * Generate .env.example content for enabled integrations
 */
export function generateEnvExample(): string {
  const envVars = getRequiredEnvVars();
  const lines: string[] = ['# External Integration Environment Variables', ''];

  for (const env of envVars) {
    lines.push(`# ${env.description}`);
    if (env.required) {
      lines.push(`# Required`);
    }
    lines.push(`${env.name}=${env.example || ''}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get integration setup instructions
 */
export function getSetupInstructions(): {
  integration: string;
  steps: string[];
  docsUrl?: string;
}[] {
  const integrations = getEnabledIntegrations();

  return integrations.map((i) => ({
    integration: i.name,
    steps: i.setupSteps,
    docsUrl: i.docsUrl,
  }));
}
