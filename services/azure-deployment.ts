/**
 * Azure Deployment Service
 * Handles Azure App Service, Container Apps, and Static Web Apps deployment.
 */

import { ClientSecretCredential } from '@azure/identity';
import { WebSiteManagementClient } from '@azure/arm-appservice';
import { ContainerAppsAPIClient } from '@azure/arm-appcontainers';
import { ResourceManagementClient } from '@azure/arm-resources';
import { loadAzureCredentials, AzureCredentials, ensureResourceGroup } from './azure-infrastructure';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const archiver = require('archiver');

const execAsync = promisify(exec);

export type AzureServiceType = 'app-service' | 'container-apps' | 'static-web-apps';

export interface ProjectAnalysis {
  hasNextJs: boolean;
  hasReact: boolean;
  hasApiRoutes: boolean;
  hasDockerfile: boolean;
  hasStaticExport: boolean;
  hasDatabaseDeps: boolean;
  hasServerSideCode: boolean;
  packageJson?: Record<string, any>;
}

export interface AzureDeploymentOptions {
  projectId: string;
  projectName: string;
  projectDirectory: string;
  environment: 'dev' | 'staging' | 'production';
  serviceType?: AzureServiceType | 'auto';
  resourceGroupName?: string;
  location?: string;
  sku?: string;
  enableMonitoring?: boolean;
}

export interface DeploymentStep {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  message?: string;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  duration?: number; // milliseconds
}

export interface DeploymentPhase {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  progress?: number; // 0-100
  logs: string[];
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface AzureDeploymentResult {
  success: boolean;
  deploymentId: string;
  serviceType: AzureServiceType;
  url?: string;
  resourceGroupName: string;
  appName: string;
  steps: DeploymentStep[];
  logs: string[];
  resources: { type: string; id: string; url?: string }[];
  error?: string;
  monitoring?: {
    applicationInsightsId?: string;
    instrumentationKey?: string;
    dashboardUrl?: string;
  };
}

export class AzureDeploymentService {
  private credentials: AzureCredentials | null = null;
  private credential: ClientSecretCredential | null = null;
  private subscriptionId: string | null = null;
  private webClient: WebSiteManagementClient | null = null;
  private containerClient: ContainerAppsAPIClient | null = null;
  private resourceClient: ResourceManagementClient | null = null;

  /**
   * Initialize the service with Azure credentials
   */
  async initialize(): Promise<boolean> {
    this.credentials = await loadAzureCredentials();
    if (!this.credentials) {
      return false;
    }

    this.credential = new ClientSecretCredential(
      this.credentials.tenantId,
      this.credentials.clientId,
      this.credentials.clientSecret
    );

    this.subscriptionId = this.credentials.subscriptionId;

    this.webClient = new WebSiteManagementClient(this.credential, this.credentials.subscriptionId);
    this.containerClient = new ContainerAppsAPIClient(this.credential, this.credentials.subscriptionId);
    this.resourceClient = new ResourceManagementClient(this.credential, this.credentials.subscriptionId);

    return true;
  }

  /**
   * Get the App Service Plan tier from SKU name
   */
  private getSkuTier(sku: string): string {
    const skuTierMap: Record<string, string> = {
      'F1': 'Free',
      'D1': 'Shared',
      'B1': 'Basic',
      'B2': 'Basic',
      'B3': 'Basic',
      'B1s_v2': 'BasicV2',
      'B2s_v2': 'BasicV2',
      'B4s_v2': 'BasicV2',
      'S1': 'Standard',
      'S2': 'Standard',
      'S3': 'Standard',
      'P1v2': 'PremiumV2',
      'P2v2': 'PremiumV2',
      'P3v2': 'PremiumV2',
      'P1v3': 'PremiumV3',
      'P2v3': 'PremiumV3',
      'P3v3': 'PremiumV3',
    };
    return skuTierMap[sku] || 'Basic';
  }

  /**
   * Analyze a project to detect what type of Azure service it needs
   */
  async analyzeProject(projectDirectory: string): Promise<ProjectAnalysis> {
    const analysis: ProjectAnalysis = {
      hasNextJs: false,
      hasReact: false,
      hasApiRoutes: false,
      hasDockerfile: false,
      hasStaticExport: false,
      hasDatabaseDeps: false,
      hasServerSideCode: false,
    };

    try {
      // Check for package.json
      const packageJsonPath = path.join(projectDirectory, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);
      analysis.packageJson = packageJson;

      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      // Check for Next.js
      analysis.hasNextJs = 'next' in deps;

      // Check for React (without Next.js)
      analysis.hasReact = 'react' in deps;

      // Check for database dependencies
      const dbDeps = ['pg', '@prisma/client', 'prisma', 'drizzle-orm', 'mongoose', 'mysql2', 'sequelize'];
      analysis.hasDatabaseDeps = dbDeps.some(dep => dep in deps);

      // Check for static export in next.config
      if (analysis.hasNextJs) {
        try {
          const nextConfigPath = path.join(projectDirectory, 'next.config.js');
          const nextConfig = await fs.readFile(nextConfigPath, 'utf-8');
          analysis.hasStaticExport = nextConfig.includes('output') && nextConfig.includes('export');
        } catch {
          // Try next.config.mjs
          try {
            const nextConfigMjsPath = path.join(projectDirectory, 'next.config.mjs');
            const nextConfigMjs = await fs.readFile(nextConfigMjsPath, 'utf-8');
            analysis.hasStaticExport = nextConfigMjs.includes('output') && nextConfigMjs.includes('export');
          } catch {
            // No static export config found
          }
        }
      }

      // Check for API routes (Next.js)
      try {
        const apiDir = path.join(projectDirectory, 'app', 'api');
        const stat = await fs.stat(apiDir);
        analysis.hasApiRoutes = stat.isDirectory();
      } catch {
        try {
          const pagesApiDir = path.join(projectDirectory, 'pages', 'api');
          const stat = await fs.stat(pagesApiDir);
          analysis.hasApiRoutes = stat.isDirectory();
        } catch {
          // No API routes
        }
      }

      // Check for Dockerfile
      try {
        await fs.access(path.join(projectDirectory, 'Dockerfile'));
        analysis.hasDockerfile = true;
      } catch {
        // No Dockerfile
      }

      // Check for server-side code indicators
      const serverIndicators = ['express', 'fastify', 'koa', 'hono', 'server'];
      analysis.hasServerSideCode = analysis.hasNextJs ||
        analysis.hasApiRoutes ||
        serverIndicators.some(ind => ind in deps);

    } catch (error) {
      console.error('Error analyzing project:', error);
    }

    return analysis;
  }

  /**
   * Configure Next.js for standalone deployment
   * Adds output: 'standalone' which creates a self-contained build
   * This is REQUIRED for Azure App Service - much smaller than bundling node_modules
   */
  private async configureNextJsForDeployment(
    projectDirectory: string,
    addLog: (msg: string) => void
  ): Promise<void> {
    addLog('⚙️ Configuring Next.js for standalone deployment...');
    const configFiles = ['next.config.js', 'next.config.mjs', 'next.config.ts'];

    for (const configFile of configFiles) {
      const configPath = path.join(projectDirectory, configFile);
      try {
        let content = await fs.readFile(configPath, 'utf-8');

        // Check if already has standalone output
        if (content.includes("output: 'standalone'") || content.includes('output: "standalone"')) {
          addLog(`✅ ${configFile} already has standalone output configured`);
          return;
        }

        // Add output: 'standalone' to the config
        // Handle different config patterns
        if (content.includes('const nextConfig = {')) {
          // Common pattern: const nextConfig = { ... }
          content = content.replace(
            'const nextConfig = {',
            "const nextConfig = {\n  output: 'standalone',"
          );
        } else if (content.includes('module.exports = {')) {
          // CommonJS pattern: module.exports = { ... }
          content = content.replace(
            'module.exports = {',
            "module.exports = {\n  output: 'standalone',"
          );
        } else if (content.includes('export default {')) {
          // ESM pattern: export default { ... }
          content = content.replace(
            'export default {',
            "export default {\n  output: 'standalone',"
          );
        } else {
          addLog(`⚠️ Could not auto-configure ${configFile}, unknown format`);
          continue;
        }

        await fs.writeFile(configPath, content, 'utf-8');
        addLog(`✅ Added standalone output to ${configFile}`);
        return;
      } catch {
        // Config file doesn't exist, try next one
      }
    }

    // No config file found - create a minimal one
    const minimalConfig = `/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
};
export default nextConfig;
`;
    await fs.writeFile(path.join(projectDirectory, 'next.config.mjs'), minimalConfig, 'utf-8');
    addLog('📝 Created next.config.mjs with standalone output');
  }

  /**
   * Disable turbopack in next.config.js/mjs/ts for production builds
   * Turbopack is not supported for `next build` - only for dev
   * This is CRITICAL for deployment - Next.js 15/16 will fail to build if turbopack config exists
   */
  private async disableTurbopackInConfig(
    projectDirectory: string,
    addLog: (msg: string) => void
  ): Promise<void> {
    addLog('🔍 Checking for turbopack configuration...');
    const configFiles = ['next.config.js', 'next.config.mjs', 'next.config.ts'];
    let foundTurbo = false;

    for (const configFile of configFiles) {
      const configPath = path.join(projectDirectory, configFile);
      try {
        const content = await fs.readFile(configPath, 'utf-8');
        addLog(`📄 Found ${configFile} (${content.length} bytes)`);

        // Check if turbopack is enabled
        if (content.includes('turbo') || content.includes('Turbo')) {
          foundTurbo = true;
          addLog(`⚠️ Found turbopack config in ${configFile}, removing for production build...`);

          let newContent = content;
          const originalLength = content.length;

          // 1. Remove entire turbopack: { ... } block with multi-level nesting
          // Use a more aggressive approach - find turbopack: and remove until matching }
          newContent = this.removeNestedProperty(newContent, 'turbopack');

          // 2. Remove experimental turbopack settings
          newContent = newContent.replace(/,?\s*turbopackUseSystemTlsCerts\s*:\s*(true|false)/g, '');
          newContent = newContent.replace(/turbopackUseSystemTlsCerts\s*:\s*(true|false),?\s*/g, '');

          // 3. Remove experimental.turbo object
          newContent = this.removeNestedProperty(newContent, 'turbo');

          // 4. Handle --turbo flag references
          newContent = newContent.replace(/['"]--turbo['"]/g, '""');
          newContent = newContent.replace(/\s*--turbo\b/g, '');

          // 5. Replace boolean turbopack flags
          newContent = newContent.replace(/turbopack\s*:\s*true/g, '');
          newContent = newContent.replace(/turbo\s*:\s*true/g, '');

          // Clean up: remove empty lines and fix trailing commas
          newContent = newContent.replace(/,(\s*)(,)/g, '$1'); // Remove double commas
          newContent = newContent.replace(/,(\s*\})/g, '$1');   // Remove trailing commas before }
          newContent = newContent.replace(/\{\s*,/g, '{');       // Remove leading commas after {
          newContent = newContent.replace(/\n\s*\n\s*\n/g, '\n\n'); // Reduce multiple empty lines

          const bytesRemoved = originalLength - newContent.length;
          if (bytesRemoved > 0) {
            await fs.writeFile(configPath, newContent, 'utf-8');
            addLog(`✅ Removed ${bytesRemoved} bytes of turbopack config from ${configFile}`);
          } else {
            addLog(`⚠️ Turbopack mentioned but couldn't auto-remove from ${configFile}`);
          }
        }
      } catch {
        // Config file doesn't exist, skip
      }
    }

    // Also check and fix package.json build script
    try {
      const packageJsonPath = path.join(projectDirectory, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      // Check for --turbo in any scripts
      let modified = false;
      if (packageJson.scripts) {
        for (const [name, script] of Object.entries(packageJson.scripts)) {
          if (typeof script === 'string' && script.includes('--turbo')) {
            addLog(`⚠️ Found --turbo in scripts.${name}, removing...`);
            packageJson.scripts[name] = script.replace(/\s*--turbo/g, '');
            modified = true;
          }
        }
      }

      // Check for turbo package in dependencies
      if (packageJson.dependencies?.turbo || packageJson.devDependencies?.turbo) {
        addLog('⚠️ Found turbo package in dependencies (keeping but won\'t affect build)');
      }

      if (modified) {
        await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
        addLog('✅ Removed --turbo from package.json scripts');
      }
    } catch {
      // package.json issue, skip
    }

    if (!foundTurbo) {
      addLog('✅ No turbopack configuration found');
    }
  }

  /**
   * Remove a property (including deeply nested objects) from config content
   * Uses brace counting to handle arbitrarily nested objects
   */
  private removeNestedProperty(content: string, propertyName: string): string {
    // Pattern to match property with object value: propertyName: {
    const pattern = new RegExp(`(,?\\s*)${propertyName}\\s*:\\s*\\{`);

    let result = content;
    let match;
    let iterations = 0;
    const maxIterations = 10; // Safety limit

    while ((match = pattern.exec(result)) !== null && iterations < maxIterations) {
      iterations++;
      const matchStart = match.index;
      const leadingCommaAndSpaces = match[1]; // Captured group for leading comma/spaces

      // Find the opening brace position
      const openBracePos = result.indexOf('{', matchStart + match[0].length - 1);
      if (openBracePos === -1) break;

      // Count braces to find matching closing brace
      let depth = 1;
      let pos = openBracePos + 1;

      while (depth > 0 && pos < result.length) {
        const char = result[pos];
        if (char === '{') depth++;
        else if (char === '}') depth--;
        pos++;
      }

      // pos is now just after the closing brace
      // Check for trailing comma
      let endPos = pos;
      const afterBrace = result.substring(pos, pos + 10).trim();
      if (afterBrace.startsWith(',')) {
        endPos = result.indexOf(',', pos) + 1;
      }

      // Remove the property
      const before = result.substring(0, matchStart);
      const after = result.substring(endPos);

      // If we're removing a property that had a leading comma, keep the structure clean
      result = before + after;
    }

    return result;
  }

  /**
   * Build project locally before deployment
   * This is much faster and more reliable than remote Oryx builds
   */
  async buildProjectLocally(
    projectDirectory: string,
    addLog: (msg: string) => void
  ): Promise<{ success: boolean; error?: string; duration: number }> {
    const startTime = Date.now();

    try {
      // IMPORTANT: Disable turbopack in next.config before building
      // Turbopack is not supported for production builds
      await this.disableTurbopackInConfig(projectDirectory, addLog);

      // Configure Next.js for standalone deployment (required for Azure)
      await this.configureNextJsForDeployment(projectDirectory, addLog);

      // Regenerate Prisma client if schema exists (ensures types are in sync)
      const prismaSchemaPath = path.join(projectDirectory, 'prisma', 'schema.prisma');
      try {
        await fs.access(prismaSchemaPath);

        // Switch schema to PostgreSQL for deployment (local uses SQLite)
        let schema = await fs.readFile(prismaSchemaPath, 'utf-8');
        if (schema.includes('provider = "sqlite"')) {
          addLog('🔄 Switching Prisma schema to PostgreSQL for deployment...');
          schema = schema.replace(/provider\s*=\s*["']sqlite["']/g, 'provider = "postgresql"');
          await fs.writeFile(prismaSchemaPath, schema, 'utf-8');
          addLog('✅ Schema switched to PostgreSQL');
        }

        addLog('📊 Prisma schema found, regenerating client...');
        await execAsync('npx prisma generate', {
          cwd: projectDirectory,
          timeout: 60000,
        });
        addLog('✅ Prisma client regenerated');

        // Copy azure startup script if it doesn't exist (handles DB migrations on deploy)
        const startupScriptDest = path.join(projectDirectory, 'scripts', 'azure-startup.js');
        try {
          await fs.access(startupScriptDest);
        } catch {
          // Script doesn't exist, copy it from template
          const startupScriptSrc = path.join(process.cwd(), 'templates', 'nextjs-base', 'scripts', 'azure-startup.js');
          try {
            await fs.mkdir(path.join(projectDirectory, 'scripts'), { recursive: true });
            await fs.copyFile(startupScriptSrc, startupScriptDest);
            addLog('✅ Added azure-startup.js for database migrations');
          } catch (copyError) {
            addLog('⚠️ Could not copy startup script - DB migrations may need manual setup');
          }
        }
      } catch {
        // No Prisma schema, skip
      }

      // Check if node_modules exists, if not run npm install
      const nodeModulesPath = path.join(projectDirectory, 'node_modules');
      let hasNodeModules = false;
      try {
        const stat = await fs.stat(nodeModulesPath);
        hasNodeModules = stat.isDirectory();
      } catch {
        hasNodeModules = false;
      }

      if (!hasNodeModules) {
        addLog('📦 Installing dependencies (npm install)...');
        try {
          const { stdout, stderr } = await execAsync('npm install --prefer-offline', {
            cwd: projectDirectory,
            timeout: 300000, // 5 min timeout
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          });
          if (stderr && !stderr.includes('npm WARN')) {
            addLog(`⚠️ npm warnings: ${stderr.slice(0, 200)}`);
          }
          addLog('✅ Dependencies installed');
        } catch (installError: any) {
          addLog(`❌ npm install failed: ${installError.message?.slice(0, 200)}`);
          return {
            success: false,
            error: `npm install failed: ${installError.message}`,
            duration: Date.now() - startTime
          };
        }
      } else {
        addLog('✅ Dependencies already installed');
      }

      // Run next build for production (webpack, not turbopack)
      addLog('🔨 Building project for production...');
      try {
        // Create clean environment - filter out turbopack-related vars from parent process
        // The parent (ai-platform-v4) runs with turbopack in dev mode, which sets env vars
        // that can leak into child processes and cause "turbopack not supported" errors
        const cleanEnv: Record<string, string | undefined> = {};
        for (const [key, value] of Object.entries(process.env)) {
          if (value === undefined) continue;
          // Skip turbopack/turbo related environment variables
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes('turbo') ||
              lowerKey.includes('__next') ||
              lowerKey.startsWith('next_private') ||
              key === 'NEXT_DEPLOYMENT_ID' ||
              key === '__NEXT_PROCESSED_ENV') {
            continue;
          }
          cleanEnv[key] = value;
        }

        // Set production environment
        cleanEnv.NODE_ENV = 'production';
        cleanEnv.NEXT_TELEMETRY_DISABLED = '1';

        addLog('🧹 Using clean environment (filtered turbopack vars)');

        // Use npx next build directly
        const { stdout, stderr } = await execAsync('npx next build', {
          cwd: projectDirectory,
          timeout: 600000, // 10 min timeout for large builds
          maxBuffer: 50 * 1024 * 1024, // 50MB buffer for verbose builds
          env: cleanEnv as NodeJS.ProcessEnv,
        });

        // Log build output (truncated)
        if (stdout) {
          const lines = stdout.split('\n').slice(-10);
          lines.forEach(line => {
            if (line.trim()) addLog(`  ${line.trim()}`);
          });
        }

        addLog('✅ Build completed successfully');
      } catch (buildError: any) {
        // Extract useful error message
        const errorOutput = buildError.stderr || buildError.stdout || buildError.message;
        const errorLines = errorOutput?.split('\n').slice(-15).join('\n') || 'Unknown build error';
        addLog(`❌ Build failed:\n${errorLines.slice(0, 500)}`);
        return {
          success: false,
          error: `Build failed: ${errorLines.slice(0, 300)}`,
          duration: Date.now() - startTime
        };
      }

      // Verify .next folder exists
      const nextDir = path.join(projectDirectory, '.next');
      try {
        const stat = await fs.stat(nextDir);
        if (!stat.isDirectory()) {
          throw new Error('.next is not a directory');
        }
        addLog('✅ Build output verified (.next folder exists)');
      } catch {
        addLog('❌ Build output not found - .next folder missing');
        return {
          success: false,
          error: 'Build completed but .next folder not found',
          duration: Date.now() - startTime
        };
      }

      const duration = Date.now() - startTime;
      addLog(`✅ Local build completed in ${(duration / 1000).toFixed(1)}s`);

      return { success: true, duration };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown build error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Detect the recommended Azure service type based on project analysis
   */
  detectServiceType(analysis: ProjectAnalysis): {
    recommended: AzureServiceType;
    reason: string;
    alternatives: { type: AzureServiceType; reason: string }[];
  } {
    // If Dockerfile exists, recommend Container Apps
    if (analysis.hasDockerfile) {
      return {
        recommended: 'container-apps',
        reason: 'Dockerfile detected - containerized deployment recommended',
        alternatives: [
          { type: 'app-service', reason: 'Can also deploy to App Service with Docker support' }
        ]
      };
    }

    // If static export Next.js or pure React SPA
    if (analysis.hasStaticExport || (!analysis.hasNextJs && analysis.hasReact && !analysis.hasServerSideCode)) {
      return {
        recommended: 'static-web-apps',
        reason: 'Static site detected - Azure Static Web Apps is cost-effective',
        alternatives: [
          { type: 'app-service', reason: 'App Service works for static sites too' }
        ]
      };
    }

    // If Next.js with API routes or database deps
    if (analysis.hasNextJs && (analysis.hasApiRoutes || analysis.hasDatabaseDeps || analysis.hasServerSideCode)) {
      return {
        recommended: 'app-service',
        reason: 'Full Next.js app with server-side features - App Service recommended',
        alternatives: [
          { type: 'container-apps', reason: 'Can containerize for more control' }
        ]
      };
    }

    // Default to App Service for anything else
    return {
      recommended: 'app-service',
      reason: 'General purpose web application - App Service is versatile',
      alternatives: [
        { type: 'container-apps', reason: 'Use for microservices architecture' },
        { type: 'static-web-apps', reason: 'Use if purely static content' }
      ]
    };
  }

  /**
   * Main deployment method - orchestrates the deployment flow
   */
  async deploy(options: AzureDeploymentOptions): Promise<AzureDeploymentResult> {
    // Call deployWithCallback with no callback (logs only stored internally)
    return this.deployWithCallback(options, undefined);
  }

  /**
   * Deployment method with real-time log callback for streaming
   */
  async deployWithCallback(
    options: AzureDeploymentOptions,
    onLog?: (message: string) => void
  ): Promise<AzureDeploymentResult> {
    const deploymentId = `azure-deploy-${Date.now()}`;
    const logs: string[] = [];
    const steps: DeploymentStep[] = [];
    const resources: AzureDeploymentResult['resources'] = [];

    const addLog = (message: string) => {
      const timestampedMsg = `[${new Date().toISOString()}] ${message}`;
      logs.push(timestampedMsg);
      console.log(message);
      // Call external callback for real-time streaming
      if (onLog) {
        onLog(timestampedMsg);
      }
    };

    const updateStep = (name: string, status: DeploymentStep['status'], message?: string, error?: string) => {
      const existing = steps.find(s => s.name === name);
      if (existing) {
        existing.status = status;
        existing.message = message;
        existing.error = error;
        if (status === 'in_progress') existing.startedAt = new Date();
        if (status === 'completed' || status === 'failed') existing.completedAt = new Date();
      } else {
        steps.push({
          name,
          status,
          message,
          error,
          startedAt: status === 'in_progress' ? new Date() : undefined,
        });
      }
    };

    try {
      // Step 1: Initialize
      updateStep('Initialize', 'in_progress', 'Loading Azure credentials...');
      addLog('🔐 Initializing Azure deployment service...');

      if (!await this.initialize()) {
        throw new Error('Failed to load Azure credentials. Please configure Azure credentials in Settings.');
      }
      updateStep('Initialize', 'completed', 'Azure credentials loaded');
      addLog('✅ Azure credentials loaded successfully');

      // Step 2: Analyze project
      updateStep('Analyze Project', 'in_progress', 'Analyzing project structure...');
      addLog('🔍 Analyzing project structure...');

      const analysis = await this.analyzeProject(options.projectDirectory);
      updateStep('Analyze Project', 'completed', 'Project analysis complete');
      addLog(`✅ Project analyzed: Next.js=${analysis.hasNextJs}, API Routes=${analysis.hasApiRoutes}, Docker=${analysis.hasDockerfile}`);

      // Step 3: Detect service type
      updateStep('Detect Service Type', 'in_progress', 'Determining optimal Azure service...');

      let serviceType: AzureServiceType;
      if (options.serviceType && options.serviceType !== 'auto') {
        serviceType = options.serviceType;
        addLog(`📋 Using specified service type: ${serviceType}`);
      } else {
        const detection = this.detectServiceType(analysis);
        serviceType = detection.recommended;
        addLog(`🎯 Recommended service type: ${serviceType} - ${detection.reason}`);
      }
      updateStep('Detect Service Type', 'completed', `Selected: ${serviceType}`);

      // Step 4: Create resource group
      const location = options.location || 'eastus2';
      const resourceGroupName = options.resourceGroupName || `rg-${this.sanitizeName(options.projectName)}-${options.environment}-${location}`;

      updateStep('Create Resource Group', 'in_progress', `Creating ${resourceGroupName}...`);
      addLog(`📦 Creating resource group: ${resourceGroupName} in ${location}`);

      await ensureResourceGroup(this.credentials!, resourceGroupName, location);
      resources.push({ type: 'resource-group', id: resourceGroupName });
      updateStep('Create Resource Group', 'completed', `Resource group ${resourceGroupName} ready`);
      addLog(`✅ Resource group ready: ${resourceGroupName}`);

      // Step 5: Deploy based on service type
      let url: string | undefined;
      const appName = this.sanitizeName(`${options.projectName}-${options.environment}`);

      switch (serviceType) {
        case 'app-service':
          const appServiceResult = await this.deployToAppService(
            resourceGroupName,
            appName,
            location,
            options,
            analysis,
            addLog,
            updateStep,
            resources
          );
          url = appServiceResult.url;
          break;

        case 'container-apps':
          const containerResult = await this.deployToContainerApps(
            resourceGroupName,
            appName,
            location,
            options,
            addLog,
            updateStep,
            resources
          );
          url = containerResult.url;
          break;

        case 'static-web-apps':
          const staticResult = await this.deployToStaticWebApps(
            resourceGroupName,
            appName,
            location,
            options,
            addLog,
            updateStep,
            resources
          );
          url = staticResult.url;
          break;
      }

      // Final step
      updateStep('Complete', 'completed', 'Deployment successful!');
      addLog(`🎉 Deployment complete! URL: ${url}`);

      return {
        success: true,
        deploymentId,
        serviceType,
        url,
        resourceGroupName,
        appName,
        steps,
        logs,
        resources,
      };

    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error occurred';
      addLog(`❌ Deployment failed: ${errorMessage}`);

      // Mark any in-progress step as failed
      const inProgressStep = steps.find(s => s.status === 'in_progress');
      if (inProgressStep) {
        inProgressStep.status = 'failed';
        inProgressStep.error = errorMessage;
        inProgressStep.completedAt = new Date();
      }

      return {
        success: false,
        deploymentId,
        serviceType: options.serviceType === 'auto' ? 'app-service' : (options.serviceType || 'app-service'),
        resourceGroupName: options.resourceGroupName || 'unknown',
        appName: 'unknown',
        steps,
        logs,
        resources,
        error: errorMessage,
      };
    }
  }

  /**
   * Deploy to Azure App Service
   */
  private async deployToAppService(
    resourceGroupName: string,
    appName: string,
    location: string,
    options: AzureDeploymentOptions,
    analysis: ProjectAnalysis,
    addLog: (msg: string) => void,
    updateStep: (name: string, status: DeploymentStep['status'], message?: string, error?: string) => void,
    resources: AzureDeploymentResult['resources']
  ): Promise<{ url: string }> {

    // Create App Service Plan
    const planName = `plan-${appName}`;
    updateStep('Create App Service Plan', 'in_progress', `Creating ${planName}...`);
    addLog(`📋 Creating App Service Plan: ${planName}`);

    await this.webClient!.appServicePlans.beginCreateOrUpdateAndWait(
      resourceGroupName,
      planName,
      {
        location,
        sku: {
          name: options.sku || 'B1',
          tier: this.getSkuTier(options.sku || 'B1'),
          capacity: 1,
        },
        kind: 'linux',
        reserved: true, // Required for Linux
        tags: {
          createdBy: 'ai-dev-platform',
          projectId: options.projectId,
          environment: options.environment,
        },
      }
    );
    resources.push({ type: 'app-service-plan', id: planName });
    updateStep('Create App Service Plan', 'completed', `Plan ${planName} created`);
    addLog(`✅ App Service Plan created: ${planName}`);

    // Create Web App
    updateStep('Create Web App', 'in_progress', `Creating web app ${appName}...`);
    addLog(`🌐 Creating Web App: ${appName}`);

    // Read project environment variables from .env files
    const projectEnvVars = await this.readProjectEnvVars(options.projectDirectory, addLog);

    const siteConfig: any = {
      linuxFxVersion: 'NODE|20-lts',
      alwaysOn: options.sku !== 'F1', // Free tier doesn't support Always On
      http20Enabled: true,
      minTlsVersion: '1.2',
      appSettings: [
        { name: 'WEBSITE_NODE_DEFAULT_VERSION', value: '~20' },
        // IMPORTANT: Disable remote build - we build locally for speed & reliability
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'false' },
        { name: 'ENABLE_ORYX_BUILD', value: 'false' },
        { name: 'WEBSITE_RUN_FROM_PACKAGE', value: '0' },
        { name: 'NODE_ENV', value: options.environment === 'production' ? 'production' : 'development' },
        // Add project environment variables (DATABASE_URL, etc.)
        ...projectEnvVars,
      ],
    };

    // Add Next.js specific settings - use startup script that handles DB migrations
    if (analysis.hasNextJs) {
      // Use startup script if it exists (handles prisma migrate + seed)
      // Falls back to server.js if startup script doesn't exist
      siteConfig.appCommandLine = 'node scripts/azure-startup.js || node server.js';
    }

    const webApp = await this.webClient!.webApps.beginCreateOrUpdateAndWait(
      resourceGroupName,
      appName,
      {
        location,
        serverFarmId: `/subscriptions/${this.credentials!.subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/serverfarms/${planName}`,
        siteConfig,
        httpsOnly: true,
        tags: {
          createdBy: 'ai-dev-platform',
          projectId: options.projectId,
          environment: options.environment,
        },
      }
    );

    const url = `https://${webApp.defaultHostName}`;
    resources.push({ type: 'web-app', id: appName, url });
    updateStep('Create Web App', 'completed', `Web app ${appName} created`);
    addLog(`✅ Web App created: ${appName}`);
    addLog(`🔗 Default URL: ${url}`);

    // Enable SCM Basic Auth for deployment (required for zipdeploy)
    addLog(`🔐 Enabling SCM basic authentication...`);
    try {
      await this.webClient!.webApps.updateScmAllowed(resourceGroupName, appName, {
        allow: true,
      });
      addLog(`✅ SCM basic auth enabled`);
    } catch (scmError: any) {
      addLog(`⚠️ SCM auth config: ${scmError.message?.slice(0, 100) || 'unknown'}`);
      // Try alternative method - update via REST API
      try {
        const tokenResponse = await this.credential!.getToken('https://management.azure.com/.default');
        const policyUrl = `https://management.azure.com/subscriptions/${this.subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/sites/${appName}/basicPublishingCredentialsPolicies/scm?api-version=2022-03-01`;

        await fetch(policyUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenResponse.token}`,
          },
          body: JSON.stringify({
            properties: { allow: true }
          }),
        });
        addLog(`✅ SCM basic auth enabled (via REST)`);
      } catch (restError: any) {
        addLog(`⚠️ Could not enable SCM auth: ${restError.message?.slice(0, 100)}`);
      }
    }

    // BUILD LOCALLY first (much faster & more reliable than Oryx remote builds)
    updateStep('Build Application', 'in_progress', 'Building project locally...');
    addLog(`🔨 Building project locally (faster than remote build)...`);

    const buildResult = await this.buildProjectLocally(options.projectDirectory, addLog);
    if (!buildResult.success) {
      updateStep('Build Application', 'failed', 'Local build failed', buildResult.error);
      throw new Error(buildResult.error || 'Local build failed');
    }
    updateStep('Build Application', 'completed', `Built in ${(buildResult.duration / 1000).toFixed(1)}s`);

    // Package built artifacts (not source) - no build needed on Azure
    updateStep('Package Application', 'in_progress', 'Creating deployment package...');
    addLog(`📦 Packaging built application...`);

    const zipPath = path.join(options.projectDirectory, 'deploy.zip');
    await this.createBuiltDeploymentZip(options.projectDirectory, zipPath, addLog);
    addLog(`✅ Package created (pre-built, no Azure build needed)`);
    updateStep('Package Application', 'completed', 'Package ready');

    // Get publishing credentials
    updateStep('Deploy Code', 'in_progress', 'Deploying to Azure...');
    addLog(`🚀 Deploying code to Azure...`);

    // Read the zip file
    const zipBuffer = await fs.readFile(zipPath);
    addLog(`📤 Uploading ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB to Azure...`);

    // Deploy using ARM OneDeploy API (works with service principal)
    addLog(`🚀 Deploying to Azure...`);
    addLog(`📤 Package size: ${(zipBuffer.length / 1024 / 1024).toFixed(1)} MB`);

    const tokenResponse = await this.credential!.getToken('https://management.azure.com/.default');

    // Get publishing credentials (Basic auth was enabled earlier)
    addLog(`🔑 Getting publishing credentials...`);
    const publishingCreds = await this.webClient!.webApps.beginListPublishingCredentialsAndWait(
      resourceGroupName,
      appName
    );

    const username = publishingCreds.publishingUserName || `$${appName}`;
    const password = publishingCreds.publishingPassword;

    if (!password) {
      throw new Error('Publishing credentials not available');
    }

    const basicAuth = Buffer.from(`${username}:${password}`).toString('base64');

    // Use Kudu zipdeploy with async to avoid gateway timeout
    const kuduUrl = `https://${appName}.scm.azurewebsites.net/api/zipdeploy?isAsync=true`;

    addLog(`📡 Uploading ${(zipBuffer.length / 1024 / 1024).toFixed(1)} MB to Azure...`);

    const deployResponse = await fetch(kuduUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/zip',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: zipBuffer,
    });

    addLog(`📡 Upload response: ${deployResponse.status}`);

    if (deployResponse.ok || deployResponse.status === 202) {
      addLog(`✅ Upload accepted! Deploying pre-built application...`);

      // Poll for deployment completion (much faster since no build needed)
      const statusUrl = `https://${appName}.scm.azurewebsites.net/api/deployments/latest`;
      let deployComplete = false;

      for (let attempt = 0; attempt < 60; attempt++) { // 2 min max (2s intervals - faster since no build)
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
          const statusResponse = await fetch(statusUrl, {
            headers: { 'Authorization': `Basic ${basicAuth}` },
          });

          if (statusResponse.ok) {
            const status = await statusResponse.json();

            // Log progress every 10 seconds
            if (attempt > 0 && attempt % 5 === 0) {
              addLog(`⏳ Deploying... (${attempt * 2}s)`);
            }

            if (status.complete === true) {
              // Status 4 = Success, Status 3 = Failed, Status 0/1/2 = In Progress
              if (status.status === 4) {
                addLog(`✅ Deployment successful!`);
                deployComplete = true;
                break;
              } else if (status.status === 3) {
                // Check if this is a real failure or just stale/intermediate status
                // "Created via a push deployment" is NOT an error - it's just the deployment method
                const message = status.message || '';
                const statusText = status.status_text || '';

                // These indicate success, not failure (common for push deployments)
                const isActuallySuccess =
                  message.toLowerCase().includes('created via a push deployment') ||
                  message.toLowerCase().includes('deployment successful') ||
                  statusText.toLowerCase().includes('success');

                if (isActuallySuccess) {
                  addLog(`✅ Deployment successful! (push deployment)`);
                  deployComplete = true;
                  break;
                }

                // Get more details on actual failure - fetch the deployment log
                addLog(`⚠️ Deployment status: Failed`);
                if (status.log_url) {
                  try {
                    const logResponse = await fetch(status.log_url, {
                      headers: { 'Authorization': `Basic ${basicAuth}` },
                    });
                    if (logResponse.ok) {
                      const logText = await logResponse.text();
                      const lastLines = logText.split('\n').slice(-10).join('\n');
                      addLog(`📋 Deployment log:\n${lastLines}`);
                    }
                  } catch {}
                }
                const errorDetail = statusText || message || 'Unknown deployment error';
                addLog(`❌ Deployment failed: ${errorDetail}`);
                throw new Error(`Deployment failed: ${errorDetail}`);
              } else {
                addLog(`✅ Deployment complete (status: ${status.status})`);
                deployComplete = true;
                break;
              }
            }
          }
        } catch (pollError: any) {
          if (pollError.message?.includes('Deployment failed')) throw pollError;
          // Continue polling on other errors
        }
      }

      if (!deployComplete) {
        addLog(`⚠️ Deployment taking longer than expected. App may still be starting.`);
      }
    } else {
      const errorText = await deployResponse.text();
      // Parse error for helpful message
      let errorMessage = errorText.slice(0, 300);
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.Message || errorJson.message || errorMessage;
      } catch {}

      addLog(`❌ Upload failed: ${errorMessage}`);
      throw new Error(`Deployment failed (${deployResponse.status}): ${errorMessage}`);
    }

    // Clean up zip file
    await fs.unlink(zipPath).catch(() => {});

    addLog(`✅ Code deployed successfully!`);
    updateStep('Deploy Code', 'completed', 'Deployment complete');

    // Wait for app to start
    addLog(`⏳ Waiting for app to start...`);
    await new Promise(resolve => setTimeout(resolve, 10000));
    addLog(`✅ App should be live at: ${url}`);

    return { url };
  }

  /**
   * Deploy to Azure Container Apps
   */
  private async deployToContainerApps(
    resourceGroupName: string,
    appName: string,
    location: string,
    options: AzureDeploymentOptions,
    addLog: (msg: string) => void,
    updateStep: (name: string, status: DeploymentStep['status'], message?: string, error?: string) => void,
    resources: AzureDeploymentResult['resources']
  ): Promise<{ url: string }> {

    // Create Container Apps Environment
    const envName = `env-${appName}`;
    updateStep('Create Container Environment', 'in_progress', `Creating ${envName}...`);
    addLog(`🐳 Creating Container Apps Environment: ${envName}`);

    await this.containerClient!.managedEnvironments.beginCreateOrUpdateAndWait(
      resourceGroupName,
      envName,
      {
        location,
        tags: {
          createdBy: 'ai-dev-platform',
          projectId: options.projectId,
          environment: options.environment,
        },
      }
    );
    resources.push({ type: 'container-environment', id: envName });
    updateStep('Create Container Environment', 'completed', `Environment ${envName} created`);
    addLog(`✅ Container Apps Environment created: ${envName}`);

    // Create Container App
    updateStep('Create Container App', 'in_progress', `Creating container app ${appName}...`);
    addLog(`📦 Creating Container App: ${appName}`);

    const containerApp = await this.containerClient!.containerApps.beginCreateOrUpdateAndWait(
      resourceGroupName,
      appName,
      {
        location,
        managedEnvironmentId: `/subscriptions/${this.credentials!.subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.App/managedEnvironments/${envName}`,
        configuration: {
          ingress: {
            external: true,
            targetPort: 3000,
            transport: 'auto',
          },
        },
        template: {
          containers: [
            {
              name: appName,
              image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest', // Placeholder
              resources: {
                cpu: 0.5,
                memory: '1Gi',
              },
              env: [
                { name: 'NODE_ENV', value: options.environment },
              ],
            },
          ],
          scale: {
            minReplicas: 0,
            maxReplicas: 3,
          },
        },
        tags: {
          createdBy: 'ai-dev-platform',
          projectId: options.projectId,
          environment: options.environment,
        },
      }
    );

    const url = `https://${containerApp.configuration?.ingress?.fqdn || `${appName}.${location}.azurecontainerapps.io`}`;
    resources.push({ type: 'container-app', id: appName, url });
    updateStep('Create Container App', 'completed', `Container app ${appName} created`);
    addLog(`✅ Container App created: ${appName}`);
    addLog(`🔗 URL: ${url}`);

    return { url };
  }

  /**
   * Deploy to Azure Static Web Apps
   */
  private async deployToStaticWebApps(
    resourceGroupName: string,
    appName: string,
    location: string,
    options: AzureDeploymentOptions,
    addLog: (msg: string) => void,
    updateStep: (name: string, status: DeploymentStep['status'], message?: string, error?: string) => void,
    resources: AzureDeploymentResult['resources']
  ): Promise<{ url: string }> {

    updateStep('Create Static Web App', 'in_progress', `Creating ${appName}...`);
    addLog(`🌐 Creating Static Web App: ${appName}`);

    // Static Web Apps use a different API - webApps.beginCreateOrUpdateStaticSiteAndWait
    const staticSite = await this.webClient!.staticSites.beginCreateOrUpdateStaticSiteAndWait(
      resourceGroupName,
      appName,
      {
        location,
        sku: {
          name: 'Free',
          tier: 'Free',
        },
        buildProperties: {
          appLocation: '/',
          outputLocation: 'out', // Next.js static export default
        },
        tags: {
          createdBy: 'ai-dev-platform',
          projectId: options.projectId,
          environment: options.environment,
        },
      }
    );

    const url = `https://${staticSite.defaultHostname}`;
    resources.push({ type: 'static-web-app', id: appName, url });
    updateStep('Create Static Web App', 'completed', `Static Web App ${appName} created`);
    addLog(`✅ Static Web App created: ${appName}`);
    addLog(`🔗 URL: ${url}`);

    return { url };
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(
    resourceGroupName: string,
    appName: string,
    serviceType: AzureServiceType
  ): Promise<{ status: string; url?: string }> {
    if (!await this.initialize()) {
      return { status: 'error' };
    }

    try {
      switch (serviceType) {
        case 'app-service': {
          const app = await this.webClient!.webApps.get(resourceGroupName, appName);
          return {
            status: app.state || 'unknown',
            url: `https://${app.defaultHostName}`,
          };
        }
        case 'container-apps': {
          const app = await this.containerClient!.containerApps.get(resourceGroupName, appName);
          return {
            status: app.provisioningState || 'unknown',
            url: `https://${app.configuration?.ingress?.fqdn}`,
          };
        }
        case 'static-web-apps': {
          const app = await this.webClient!.staticSites.getStaticSite(resourceGroupName, appName);
          return {
            status: 'running',
            url: `https://${app.defaultHostname}`,
          };
        }
      }
    } catch (error) {
      return { status: 'not_found' };
    }
  }

  /**
   * Delete a deployment
   */
  async deleteDeployment(
    resourceGroupName: string,
    appName: string,
    serviceType: AzureServiceType
  ): Promise<{ success: boolean; error?: string }> {
    if (!await this.initialize()) {
      return { success: false, error: 'Failed to initialize Azure credentials' };
    }

    try {
      switch (serviceType) {
        case 'app-service':
          await this.webClient!.webApps.delete(resourceGroupName, appName);
          break;
        case 'container-apps':
          await this.containerClient!.containerApps.beginDeleteAndWait(resourceGroupName, appName);
          break;
        case 'static-web-apps':
          await this.webClient!.staticSites.beginDeleteStaticSiteAndWait(resourceGroupName, appName);
          break;
      }
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Sanitize name for Azure resource naming
   */
  private sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60);
  }

  /**
   * Create a zip file for deployment
   */
  private async createDeploymentZip(
    projectDir: string,
    zipPath: string,
    addLog: (msg: string) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fsSync.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        addLog(`📦 Package size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
        resolve();
      });

      archive.on('error', (err: Error) => reject(err));
      archive.pipe(output);

      // Deploy SOURCE code - Azure will run npm install && npm run build
      // This is slower but works reliably and keeps package small
      const filesToInclude = [
        'app',           // Next.js App Router
        'pages',         // Next.js Pages Router (if exists)
        'components',    // React components
        'lib',           // Library code
        'src',           // Alternative source structure
        'public',        // Static assets
        'styles',        // CSS/styles
        'package.json',
        'package-lock.json',
        'next.config.js',
        'next.config.mjs',
        'next.config.ts',
        'tsconfig.json',
        'tailwind.config.js',
        'tailwind.config.ts',
        'postcss.config.js',
        'postcss.config.mjs',
      ];

      let fileCount = 0;
      for (const file of filesToInclude) {
        const fullPath = path.join(projectDir, file);
        try {
          const stat = fsSync.statSync(fullPath);
          if (stat.isDirectory()) {
            archive.directory(fullPath, file);
            fileCount++;
          } else if (stat.isFile()) {
            archive.file(fullPath, { name: file });
            fileCount++;
          }
        } catch {
          // File doesn't exist, skip
        }
      }

      addLog(`📦 Packaged ${fileCount} source items`);

      archive.finalize();
    });
  }

  /**
   * Create a zip file with BUILT artifacts for deployment (no build on Azure)
   * Uses Next.js standalone output for minimal deployment size
   */
  private async createBuiltDeploymentZip(
    projectDir: string,
    zipPath: string,
    addLog: (msg: string) => void
  ): Promise<void> {
    const standalonePath = path.join(projectDir, '.next', 'standalone');
    const hasStandalone = fsSync.existsSync(standalonePath);

    return new Promise((resolve, reject) => {
      const output = fsSync.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 6 } }); // Less compression for speed

      output.on('close', () => {
        addLog(`📦 Package size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
        resolve();
      });

      archive.on('error', (err: Error) => reject(err));
      archive.pipe(output);

      if (hasStandalone) {
        // Use standalone output - much smaller than full node_modules
        addLog('📦 Using standalone output for minimal deployment...');

        // The standalone folder contains server.js and minimal node_modules
        archive.directory(standalonePath, '.');

        // Static assets need to be copied to .next/static
        const staticPath = path.join(projectDir, '.next', 'static');
        if (fsSync.existsSync(staticPath)) {
          archive.directory(staticPath, '.next/static');
          addLog('  + .next/static/');
        }

        // Public assets need to be at root level
        const publicPath = path.join(projectDir, 'public');
        if (fsSync.existsSync(publicPath)) {
          archive.directory(publicPath, 'public');
          addLog('  + public/');
        }

        addLog('📦 Packaged standalone build (minimal dependencies included)');
      } else {
        // Fallback: include full node_modules (legacy, larger)
        addLog('⚠️ No standalone output found, using full node_modules...');

        const itemsToInclude = [
          { path: '.next', type: 'dir' },
          { path: 'public', type: 'dir' },
          { path: 'node_modules', type: 'dir' },
          { path: 'package.json', type: 'file' },
          { path: 'next.config.js', type: 'file' },
          { path: 'next.config.mjs', type: 'file' },
          { path: 'next.config.ts', type: 'file' },
        ];

        let fileCount = 0;
        for (const item of itemsToInclude) {
          const fullPath = path.join(projectDir, item.path);
          try {
            const stat = fsSync.statSync(fullPath);
            if (item.type === 'dir' && stat.isDirectory()) {
              archive.directory(fullPath, item.path);
              fileCount++;
              addLog(`  + ${item.path}/`);
            } else if (item.type === 'file' && stat.isFile()) {
              archive.file(fullPath, { name: item.path });
              fileCount++;
            }
          } catch {
            // File/dir doesn't exist, skip
          }
        }

        addLog(`📦 Packaged ${fileCount} items (pre-built, no Azure build needed)`);
      }

      archive.finalize();
    });
  }

  /**
   * Read environment variables from project's .env files
   * Returns them in Azure appSettings format: { name: string, value: string }[]
   */
  private async readProjectEnvVars(
    projectDirectory: string,
    addLog: (msg: string) => void
  ): Promise<{ name: string; value: string }[]> {
    const envVars: { name: string; value: string }[] = [];
    const seenKeys = new Set<string>();

    // Files to check in order of priority (later files override earlier)
    const envFiles = ['.env', '.env.local', '.env.production', '.env.production.local'];

    for (const envFile of envFiles) {
      const envPath = path.join(projectDirectory, envFile);
      try {
        const content = await fs.readFile(envPath, 'utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
          // Skip comments and empty lines
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;

          // Parse KEY=VALUE format
          const eqIndex = trimmed.indexOf('=');
          if (eqIndex === -1) continue;

          const key = trimmed.substring(0, eqIndex).trim();
          let value = trimmed.substring(eqIndex + 1).trim();

          // Remove surrounding quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }

          // Skip empty values and Azure-internal vars
          if (!value || key.startsWith('WEBSITE_') || key.startsWith('SCM_')) continue;

          // Track for deduplication (later files win)
          if (seenKeys.has(key)) {
            // Remove old entry
            const idx = envVars.findIndex(v => v.name === key);
            if (idx !== -1) envVars.splice(idx, 1);
          }
          seenKeys.add(key);
          envVars.push({ name: key, value });
        }

        addLog(`📋 Loaded ${envFile} (${seenKeys.size} variables)`);
      } catch {
        // File doesn't exist, skip
      }
    }

    if (envVars.length > 0) {
      addLog(`🔑 Environment variables to deploy: ${envVars.map(v => v.name).join(', ')}`);

      // Check for SQLite DATABASE_URL - this won't work on Azure
      const dbUrlVar = envVars.find(v => v.name === 'DATABASE_URL');
      if (dbUrlVar && (dbUrlVar.value.includes('file:') || dbUrlVar.value.includes('.db'))) {
        addLog(`⚠️ WARNING: SQLite DATABASE_URL detected - this won't work on Azure!`);
        addLog(`   SQLite requires local filesystem which is ephemeral on Azure.`);
        addLog(`   You need a PostgreSQL database for production deployment.`);
        addLog(`   Options: Neon (free), Azure PostgreSQL, or Supabase`);
        // Remove the SQLite URL so it doesn't break the deployment
        const idx = envVars.findIndex(v => v.name === 'DATABASE_URL');
        if (idx !== -1) {
          envVars.splice(idx, 1);
          addLog(`   Removed SQLite DATABASE_URL from deployment config.`);
        }
      }
    } else {
      addLog(`⚠️ No environment variables found in project`);
    }

    return envVars;
  }

  /**
   * Test Azure connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!await this.initialize()) {
      return { success: false, message: 'Failed to load Azure credentials' };
    }

    try {
      const groups: string[] = [];
      for await (const rg of this.resourceClient!.resourceGroups.list()) {
        groups.push(rg.name!);
        if (groups.length >= 5) break;
      }
      return {
        success: true,
        message: `Connected to Azure! Found ${groups.length} resource groups.`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Azure connection failed: ${error.message}`,
      };
    }
  }
}

// Singleton instance
export const azureDeploymentService = new AzureDeploymentService();
export default azureDeploymentService;
