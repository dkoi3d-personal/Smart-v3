/**
 * Template Applier
 * Applies feature templates to project directories
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { FeatureTemplate, TemplateApplyResult, TemplateTests, TemplateTestFile } from './types';
import { getTemplateRegistry } from './registry';

/**
 * Generate a cryptographically secure secret for NextAuth
 * Equivalent to: openssl rand -base64 32
 */
function generateSecret(): string {
  return crypto.randomBytes(32).toString('base64');
}

/**
 * Process .env file content to replace placeholder values with working defaults
 */
function processEnvContent(content: string): string {
  let processed = content;

  // Replace placeholder NEXTAUTH_SECRET values with real secrets
  const secretPlaceholders = [
    /NEXTAUTH_SECRET=["']?your-secret-key-here["']?/gi,
    /NEXTAUTH_SECRET=["']?your-secret["']?/gi,
    /NEXTAUTH_SECRET=["']?your-secret-key-here-use-openssl-rand-base64-32["']?/gi,
    /NEXTAUTH_SECRET=["']?[^"'\n]*secret[^"'\n]*["']?/gi, // Catch-all for any "secret" placeholder
  ];

  const generatedSecret = generateSecret();

  for (const placeholder of secretPlaceholders) {
    if (placeholder.test(processed)) {
      processed = processed.replace(placeholder, `NEXTAUTH_SECRET="${generatedSecret}"`);
      break; // Only replace once
    }
  }

  // Replace PostgreSQL placeholder URLs with SQLite for local development
  // This ensures the app works out of the box without needing PostgreSQL
  const postgresPlaceholders = [
    /DATABASE_URL=["']?postgresql:\/\/user:password@localhost:\d+\/\w+\?schema=public["']?/gi,
    /DATABASE_URL=["']?postgresql:\/\/\.\.\.["']?/gi,
  ];

  for (const placeholder of postgresPlaceholders) {
    if (placeholder.test(processed)) {
      processed = processed.replace(placeholder, 'DATABASE_URL="file:./dev.db"');
      break;
    }
  }

  return processed;
}

/**
 * Process Prisma schema to use SQLite instead of PostgreSQL for local development
 */
function processPrismaSchema(content: string): string {
  // Replace postgresql provider with sqlite
  return content.replace(
    /provider\s*=\s*["']postgresql["']/gi,
    'provider = "sqlite"'
  );
}

/**
 * Normalize tests to a flat array
 * Handles both TemplateTestFile[] and TemplateTests formats
 */
function normalizeTests(tests: TemplateTestFile[] | TemplateTests | undefined): Array<{ path: string; content: string }> {
  if (!tests) {
    return [];
  }

  // Check if it's already an array
  if (Array.isArray(tests)) {
    return tests;
  }

  // It's a TemplateTests object - flatten unit, integration, and e2e arrays
  const result: Array<{ path: string; content: string }> = [];

  if (tests.unit) {
    result.push(...tests.unit);
  }
  if (tests.integration) {
    result.push(...tests.integration);
  }
  if (tests.e2e) {
    result.push(...tests.e2e);
  }

  return result;
}

export interface ApplyTemplateOptions {
  projectDir: string;
  templateId: string;
  overwriteExisting?: boolean;
}

/**
 * Ensure a directory exists
 */
async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // Directory already exists
  }
}

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Add dependencies to package.json
 */
async function addDependencies(
  projectDir: string,
  packages: Record<string, string>,
  devPackages?: Record<string, string>
): Promise<Record<string, string>> {
  const packageJsonPath = path.join(projectDir, 'package.json');
  const added: Record<string, string> = {};

  try {
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);

    // Add regular dependencies
    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }
    for (const [name, version] of Object.entries(packages)) {
      if (!packageJson.dependencies[name]) {
        packageJson.dependencies[name] = version;
        added[name] = version;
      }
    }

    // Add dev dependencies
    if (devPackages && Object.keys(devPackages).length > 0) {
      if (!packageJson.devDependencies) {
        packageJson.devDependencies = {};
      }
      for (const [name, version] of Object.entries(devPackages)) {
        if (!packageJson.devDependencies[name]) {
          packageJson.devDependencies[name] = version;
          added[name] = version;
        }
      }
    }

    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
  } catch (error) {
    // package.json doesn't exist or is invalid, skip dependency addition
    console.warn(`[TemplateApplier] Could not update package.json: ${error}`);
  }

  return added;
}

/**
 * Apply a single template to a project directory
 */
export async function applyTemplate(
  options: ApplyTemplateOptions
): Promise<TemplateApplyResult> {
  const { projectDir, templateId, overwriteExisting = false } = options;
  const registry = getTemplateRegistry();
  const template = registry.get(templateId);

  if (!template) {
    return {
      success: false,
      templateId,
      templateName: 'Unknown',
      filesCreated: [],
      testsCreated: [],
      dependenciesAdded: {},
      errors: [`Template not found: ${templateId}`],
    };
  }

  const result: TemplateApplyResult = {
    success: true,
    templateId: template.id,
    templateName: template.name,
    filesCreated: [],
    testsCreated: [],
    dependenciesAdded: {},
    errors: [],
  };

  // Apply template files
  let hasEnvExample = false;
  let envExampleContent = '';

  for (const file of template.files) {
    const filePath = path.join(projectDir, file.path);
    const dirPath = path.dirname(filePath);

    try {
      // Check if file already exists
      if (!overwriteExisting && await fileExists(filePath)) {
        console.log(`[TemplateApplier] Skipping existing file: ${file.path}`);
        continue;
      }

      // Ensure directory exists
      await ensureDir(dirPath);

      // Process content - generate real secrets for .env files, use SQLite for Prisma
      let content = file.content;
      const isEnvFile = file.path === '.env' || file.path === '.env.example' || file.path === '.env.local';
      const isPrismaSchema = file.path === 'prisma/schema.prisma' || file.path.endsWith('/schema.prisma');

      if (isEnvFile) {
        content = processEnvContent(content);
        if (file.path === '.env.example') {
          hasEnvExample = true;
          envExampleContent = content;
        }
      } else if (isPrismaSchema) {
        content = processPrismaSchema(content);
      }

      // Write file
      await fs.writeFile(filePath, content, 'utf-8');
      result.filesCreated.push(file.path);
      console.log(`[TemplateApplier] Created: ${file.path}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to create ${file.path}: ${errorMsg}`);
    }
  }

  // If template only has .env.example, also create .env with real secrets
  if (hasEnvExample) {
    const envPath = path.join(projectDir, '.env');
    const hasEnvFile = template.files.some(f => f.path === '.env');

    if (!hasEnvFile && !(await fileExists(envPath))) {
      try {
        // Generate fresh secrets for .env (different from .env.example)
        const envContent = processEnvContent(envExampleContent);
        await fs.writeFile(envPath, envContent, 'utf-8');
        result.filesCreated.push('.env');
        console.log(`[TemplateApplier] Created .env from .env.example with generated secrets`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`Failed to create .env: ${errorMsg}`);
      }
    }
  }

  // Apply test files (normalize from TemplateTests or TemplateTestFile[] format)
  const normalizedTests = normalizeTests(template.tests);
  for (const test of normalizedTests) {
    const filePath = path.join(projectDir, test.path);
    const dirPath = path.dirname(filePath);

    try {
      // Check if file already exists
      if (!overwriteExisting && await fileExists(filePath)) {
        console.log(`[TemplateApplier] Skipping existing test: ${test.path}`);
        continue;
      }

      // Ensure directory exists
      await ensureDir(dirPath);

      // Write test file
      await fs.writeFile(filePath, test.content, 'utf-8');
      result.testsCreated.push(test.path);
      console.log(`[TemplateApplier] Created test: ${test.path}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Failed to create test ${test.path}: ${errorMsg}`);
    }
  }

  // Add dependencies
  try {
    const added = await addDependencies(
      projectDir,
      template.dependencies.packages,
      template.dependencies.devPackages
    );
    result.dependenciesAdded = added;
    if (Object.keys(added).length > 0) {
      console.log(`[TemplateApplier] Added dependencies: ${Object.keys(added).join(', ')}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Failed to add dependencies: ${errorMsg}`);
  }

  // Mark as failed if there were critical errors
  if (result.filesCreated.length === 0 && template.files.length > 0) {
    result.success = false;
  }

  return result;
}

/**
 * Apply multiple templates in order
 * Respects template dependencies
 */
export async function applyTemplates(
  projectDir: string,
  templateIds: string[],
  options?: { overwriteExisting?: boolean }
): Promise<TemplateApplyResult[]> {
  const registry = getTemplateRegistry();
  const results: TemplateApplyResult[] = [];
  const applied = new Set<string>();

  // Sort templates by dependencies
  const sortedIds = sortByDependencies(templateIds, registry);

  for (const templateId of sortedIds) {
    if (applied.has(templateId)) {
      continue;
    }

    const result = await applyTemplate({
      projectDir,
      templateId,
      overwriteExisting: options?.overwriteExisting,
    });

    results.push(result);
    applied.add(templateId);

    if (result.success) {
      console.log(`[TemplateApplier] Applied template: ${result.templateName}`);
    } else {
      console.error(`[TemplateApplier] Failed to apply template: ${templateId}`);
    }
  }

  return results;
}

/**
 * Sort template IDs by dependencies (topological sort)
 */
function sortByDependencies(
  templateIds: string[],
  registry: ReturnType<typeof getTemplateRegistry>
): string[] {
  const result: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(templateId: string): void {
    if (visited.has(templateId)) return;
    if (visiting.has(templateId)) {
      console.warn(`[TemplateApplier] Circular dependency detected for: ${templateId}`);
      return;
    }

    visiting.add(templateId);

    const template = registry.get(templateId);
    if (template?.dependencies.templateDependencies) {
      for (const depId of template.dependencies.templateDependencies) {
        if (templateIds.includes(depId) || registry.get(depId)) {
          visit(depId);
        }
      }
    }

    visiting.delete(templateId);
    visited.add(templateId);
    result.push(templateId);
  }

  for (const id of templateIds) {
    visit(id);
  }

  return result;
}

/**
 * Auto-detect and apply matching templates
 */
export async function autoApplyTemplates(
  projectDir: string,
  requirements: string,
  options?: {
    minScore?: number;
    maxTemplates?: number;
    overwriteExisting?: boolean;
  }
): Promise<TemplateApplyResult[]> {
  const registry = getTemplateRegistry();
  const matches = registry.matchTemplates(requirements, { minScore: options?.minScore ?? 2 });

  // Limit to max templates if specified
  const maxTemplates = options?.maxTemplates ?? 5;
  const selectedMatches = matches.slice(0, maxTemplates);

  const templateIds = selectedMatches.map(m => m.templateId);

  console.log(`[TemplateApplier] Auto-detected templates: ${templateIds.join(', ')}`);

  return applyTemplates(projectDir, templateIds, {
    overwriteExisting: options?.overwriteExisting,
  });
}
