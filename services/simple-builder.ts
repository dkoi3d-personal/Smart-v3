/**
 * Simple Builder Service
 *
 * Template-based approach - generates Next.js apps from templates
 * without requiring any API calls.
 *
 * For AI-powered generation, uses Claude CLI which runs locally.
 */

import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getProjectDir } from '@/lib/project-paths';
import { saveProjectState } from '@/lib/project-persistence';
import {
  matchModulesForQuickBuild,
  shouldUseHealthcareModules,
  mergeWithBaseFiles,
  mergeDependencies,
  ensureHealthcareModulesInitialized,
} from '@/lib/healthcare-modules';
import { getLearningAgent } from '@/services/memory/learning-agent';
import { getPendingLearningsService } from '@/services/memory/pending-learnings';
import {
  injectIntegrations,
  getIntegrationDependencies,
} from '@/lib/services/integration-injector';
import { getEnabledIntegrations } from '@/lib/services/service-catalog';
import { getDefaultDesignSystem } from '@/lib/design-systems';
import type { DesignSystem } from '@/lib/design-systems/types';
import { loadAIConfig, generateEnvVars } from '@/lib/ai-config/ai-config-store';

export interface BuildProgress {
  phase: 'planning' | 'creating' | 'integrations' | 'installing' | 'building' | 'database' | 'complete' | 'error';
  message: string;
  details?: string;
  filesCreated?: string[];
  error?: string;
}

export type ProgressCallback = (progress: BuildProgress) => void;

export interface DatabaseConfig {
  provider: 'sqlite' | 'neon' | 'supabase' | 'aws-rds';
  schemaTemplate: 'auto' | 'authentication' | 'blog' | 'ecommerce' | 'saas' | 'todoApp';
}

export interface TemplateConfig {
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

/**
 * Simple, reliable app builder using templates
 */
export async function buildApp(
  projectId: string,
  requirements: string,
  onProgress: ProgressCallback,
  databaseConfig?: DatabaseConfig,
  templateConfig?: TemplateConfig
): Promise<{ success: boolean; error?: string; projectDir: string }> {
  const projectDir = getProjectDir(projectId);
  const startTime = Date.now();

  try {
    // Ensure project directory exists
    await fs.mkdir(projectDir, { recursive: true });

    // Save project metadata immediately so it appears in projects list
    await saveProjectState(projectDir, {
      projectId,
      requirements,
      buildType: 'quick', // Quick build via simple-builder
      config: {
        name: generateProjectName(requirements),
        description: requirements.substring(0, 200),
        techStack: ['next.js', 'typescript', 'tailwind'],
        requirements,
        targetPlatform: 'web' as const,
        deployment: {
          provider: 'aws' as const,
          region: 'us-east-1',
          environment: 'dev' as const,
        },
      },
      epics: [],
      stories: [],
      messages: [],
      status: 'building',
      progress: 10,
      errors: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    onProgress({
      phase: 'planning',
      message: 'Analyzing requirements...',
    });

    // Fetch the default design system for styling
    let designSystem: DesignSystem | null = null;
    try {
      designSystem = await getDefaultDesignSystem();
      if (designSystem) {
        console.log(`[SimpleBuilder] Using design system: ${designSystem.name}`);
      }
    } catch (dsError) {
      console.warn('[SimpleBuilder] Could not load design system, using defaults:', dsError);
    }

    // Step 1: Generate files from templates based on requirements
    onProgress({
      phase: 'creating',
      message: 'Creating project files...',
    });

    console.log('[SimpleBuilder] Generating files with templateConfig:', templateConfig?.templateId);
    const files = generateAppFromTemplate(requirements, designSystem, templateConfig);
    const fileNames: string[] = [];

    for (const file of files) {
      const filePath = path.join(projectDir, file.path);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.content, 'utf-8');
      fileNames.push(file.path);
    }

    // Generate .env.local with AI provider keys from platform settings
    try {
      const aiConfig = await loadAIConfig();
      const envVars = generateEnvVars(aiConfig);

      // Build .env.local content
      const envLines: string[] = [
        '# AI Provider Configuration',
        '# Auto-generated from platform settings',
        '',
      ];

      // Add each env var
      for (const [key, value] of Object.entries(envVars)) {
        if (value) {
          envLines.push(`${key}="${value}"`);
        }
      }

      // Add database URL for local dev
      envLines.push('');
      envLines.push('# Database - Local SQLite for development');
      envLines.push('DATABASE_URL="file:./dev.db"');

      const envLocalPath = path.join(projectDir, '.env.local');
      await fs.writeFile(envLocalPath, envLines.join('\n'), 'utf-8');
      fileNames.push('.env.local');
      console.log('[SimpleBuilder] Created .env.local with AI provider keys');
    } catch (envError) {
      console.warn('[SimpleBuilder] Could not create .env.local:', envError);
      // Non-fatal, continue without env file
    }

    onProgress({
      phase: 'creating',
      message: 'Project files created',
      filesCreated: fileNames,
    });

    // Step 1.5: Inject enabled external integrations (Google Analytics, etc.)
    const enabledIntegrations = getEnabledIntegrations();
    if (enabledIntegrations.length > 0) {
      onProgress({
        phase: 'integrations',
        message: `Injecting ${enabledIntegrations.length} integration(s)...`,
        details: enabledIntegrations.map(i => i.name).join(', '),
      });

      try {
        const injectionResult = await injectIntegrations({
          projectDir,
          dryRun: false,
        });

        // Add injected files to the list
        injectionResult.results
          .filter(r => r.success && r.filename)
          .forEach(r => fileNames.push(r.filename!));

        // Merge integration dependencies into package.json
        const integrationDeps = getIntegrationDependencies();
        if (Object.keys(integrationDeps).length > 0) {
          const pkgJsonPath = path.join(projectDir, 'package.json');
          try {
            const pkgContent = await fs.readFile(pkgJsonPath, 'utf-8');
            const pkg = JSON.parse(pkgContent);
            pkg.dependencies = { ...pkg.dependencies, ...integrationDeps };
            await fs.writeFile(pkgJsonPath, JSON.stringify(pkg, null, 2));
          } catch (e) {
            console.warn('[SimpleBuilder] Could not merge integration dependencies:', e);
          }
        }

        onProgress({
          phase: 'integrations',
          message: `Injected ${injectionResult.successfulInjections} integration files`,
          details: injectionResult.packagesInstalled.length > 0
            ? `Added packages: ${injectionResult.packagesInstalled.join(', ')}`
            : undefined,
        });
      } catch (integrationError) {
        console.warn('[SimpleBuilder] Integration injection warning:', integrationError);
        // Don't fail the build for integration issues
      }
    }

    // Step 2: Install dependencies
    const installStartTime = Date.now();
    onProgress({
      phase: 'installing',
      message: 'Installing dependencies (this may take 1-2 minutes)...',
    });

    // Don't set NODE_ENV=production for install - it skips devDependencies!
    // Use NODE_ENV=development like dev-server-manager does
    // Use optimized flags: --prefer-offline (use cache), --no-audit (skip security check), --no-fund (skip messages)
    const installResult = await runCommand('npm', ['install', '--prefer-offline', '--no-audit', '--no-fund'], projectDir, 300000, { NODE_ENV: 'development' });
    const installDuration = ((Date.now() - installStartTime) / 1000).toFixed(1);

    if (!installResult.success) {
      onProgress({
        phase: 'error',
        message: `Failed to install dependencies after ${installDuration}s`,
        error: installResult.error,
      });
      return { success: false, error: `npm install failed: ${installResult.error}`, projectDir };
    }

    onProgress({
      phase: 'installing',
      message: `Dependencies installed in ${installDuration}s`,
    });

    // Step 2.5: Setup database if configured
    if (databaseConfig) {
      onProgress({
        phase: 'database',
        message: `Setting up ${databaseConfig.provider} database...`,
      });

      try {
        const dbResult = await setupDatabaseForProject(
          projectId,
          projectDir,
          databaseConfig,
          requirements
        );

        if (dbResult.success) {
          onProgress({
            phase: 'database',
            message: `Database configured: ${databaseConfig.provider}`,
            details: dbResult.message,
          });
        } else {
          // Database setup failed but we'll continue with the build
          onProgress({
            phase: 'database',
            message: `Database setup warning: ${dbResult.error}`,
          });
          console.warn('Database setup failed:', dbResult.error);
        }
      } catch (dbError) {
        const dbErrorMsg = dbError instanceof Error ? dbError.message : 'Unknown error';
        onProgress({
          phase: 'database',
          message: `Database setup skipped: ${dbErrorMsg}`,
        });
        console.warn('Database setup error:', dbErrorMsg);
      }
    }

    // Step 3: Build the project
    const buildStartTime = Date.now();
    onProgress({
      phase: 'building',
      message: 'Building the project (this may take 30-60 seconds)...',
    });

    const buildResult = await runCommand('npm', ['run', 'build'], projectDir, 180000, {
      NODE_ENV: 'production',
    });
    const buildDuration = ((Date.now() - buildStartTime) / 1000).toFixed(1);

    if (!buildResult.success) {
      const errorDetails = extractBuildError(buildResult.output || buildResult.error || '');
      onProgress({
        phase: 'error',
        message: `Build failed after ${buildDuration}s`,
        error: errorDetails,
      });
      return { success: false, error: `Build failed: ${errorDetails}`, projectDir };
    }

    // Success! Update project state
    const totalDuration = Math.round((Date.now() - startTime) / 1000);
    await saveProjectState(projectDir, {
      status: 'completed',
      progress: 100,
      buildMetrics: {
        filesCreated: fileNames.length,
        filesModified: 0,
        commandsRun: 2, // npm install + npm run build
        elapsedTime: totalDuration,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
        duration: totalDuration,
        phase: 'complete',
      },
    });

    onProgress({
      phase: 'complete',
      message: `App built successfully in ${buildDuration}s!`,
      filesCreated: fileNames,
    });

    return { success: true, projectDir };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update project state to show error
    try {
      await saveProjectState(projectDir, {
        status: 'error',
        progress: 0,
        errors: [errorMessage],
      });
    } catch {}

    onProgress({
      phase: 'error',
      message: 'Build failed',
      error: errorMessage,
    });
    return { success: false, error: errorMessage, projectDir };
  }
}

/**
 * Generate a human-readable project name from requirements
 */
function generateProjectName(requirements: string): string {
  const lowerReq = requirements.toLowerCase();

  // Detect app type and generate appropriate name
  if (lowerReq.includes('todo') || lowerReq.includes('task')) {
    return 'Todo App';
  } else if (lowerReq.includes('calculator') || lowerReq.includes('calc')) {
    return 'Calculator';
  } else if (lowerReq.includes('weather') || lowerReq.includes('forecast')) {
    return 'Weather App';
  } else if (lowerReq.includes('counter') || lowerReq.includes('count')) {
    return 'Counter App';
  } else if (lowerReq.includes('landing') || lowerReq.includes('hello')) {
    return 'Landing Page';
  }

  // Try to extract a meaningful name from the first few words
  const words = requirements.split(/\s+/).slice(0, 4);
  const name = words.join(' ');
  return name.length > 30 ? name.substring(0, 30) + '...' : name || 'Quick Build App';
}

/**
 * Generate app files from templates based on requirements
 * @param templateConfig - Optional template config for component/hook generation from Quick Build
 */
function generateAppFromTemplate(requirements: string, designSystem: DesignSystem | null = null, templateConfig?: TemplateConfig): { path: string; content: string }[] {
  const templateId = templateConfig?.templateId;
  const lowerReq = requirements.toLowerCase();

  // ==========================================================================
  // HEALTHCARE MODULES CHECK - Try healthcare modules first for faster builds
  // Skip this if we have a templateConfig - those builds use dynamic generation
  // ==========================================================================
  if (!templateConfig) {
    try {
      ensureHealthcareModulesInitialized();

      if (shouldUseHealthcareModules(requirements)) {
        const moduleResult = matchModulesForQuickBuild(requirements);

        if (moduleResult.matchedModules.length > 0) {
          console.log(`[SimpleBuilder] Using healthcare modules: ${moduleResult.matchedModules.join(', ')}`);

          // Get base Next.js files with design system
          const baseFiles = getBaseNextJsFiles(designSystem);

          // Merge base files with healthcare module files
          const mergedFiles = mergeWithBaseFiles(baseFiles, moduleResult.files);

          // Update package.json with healthcare dependencies
          const packageJsonIndex = mergedFiles.findIndex(f => f.path === 'package.json');
          if (packageJsonIndex >= 0) {
            const existingPkg = JSON.parse(mergedFiles[packageJsonIndex].content);
            existingPkg.dependencies = mergeDependencies(
              existingPkg.dependencies || {},
              moduleResult.dependencies
            );
            existingPkg.devDependencies = mergeDependencies(
              existingPkg.devDependencies || {},
              moduleResult.devDependencies
            );
            mergedFiles[packageJsonIndex].content = JSON.stringify(existingPkg, null, 2);
          }

          // Add Epic FHIR library (required for patient modules)
          mergedFiles.push(
            { path: 'lib/epic-fhir/types.ts', content: getEpicFhirTypes() },
            { path: 'lib/epic-fhir/client.ts', content: getEpicFhirClient() },
            { path: 'lib/epic-fhir/hooks.ts', content: getEpicFhirHooks() },
            { path: 'lib/epic-fhir/index.ts', content: getEpicFhirIndex() },
            { path: 'app/api/epic/route.ts', content: getEpicApiRoute() },
            { path: 'app/api/epic/fhir/[...path]/route.ts', content: getEpicFhirProxyRoute() },
          );

          // Add a simple page that uses the patient components
          mergedFiles.push({
            path: 'app/page.tsx',
            content: getHealthcareModulePage(moduleResult.matchedModules),
          });

          return mergedFiles;
        }
      }
    } catch (error) {
      console.warn('[SimpleBuilder] Healthcare modules check failed, falling back to templates:', error);
    }
  }
  // ==========================================================================

  // Detect app type from requirements
  const isTodo = lowerReq.includes('todo') || lowerReq.includes('task');
  const isCalculator = lowerReq.includes('calculator') || lowerReq.includes('calc');
  const isWeather = lowerReq.includes('weather') || lowerReq.includes('forecast');
  const isCounter = lowerReq.includes('counter') || lowerReq.includes('count');

  // Detect OCR apps
  const hasOCR = lowerReq.includes('ocr') ||
    (lowerReq.includes('scan') && (lowerReq.includes('document') || lowerReq.includes('text') || lowerReq.includes('image'))) ||
    (lowerReq.includes('extract') && lowerReq.includes('text')) ||
    (lowerReq.includes('image') && lowerReq.includes('text') && lowerReq.includes('read'));

  // Detect Epic/Healthcare apps
  const isEpicPatient = lowerReq.includes('patient') && (lowerReq.includes('epic') || lowerReq.includes('fhir') || lowerReq.includes('healthcare') || lowerReq.includes('ehr'));
  const isEpicDashboard = (lowerReq.includes('dashboard') || lowerReq.includes('clinical')) && (lowerReq.includes('patient') || lowerReq.includes('epic') || lowerReq.includes('healthcare'));
  const isEpicMedications = lowerReq.includes('medication') && (lowerReq.includes('epic') || lowerReq.includes('fhir') || lowerReq.includes('patient'));
  const isEpicAllergies = lowerReq.includes('allerg') && (lowerReq.includes('epic') || lowerReq.includes('fhir') || lowerReq.includes('patient'));
  const isHealthcareApp = isEpicPatient || isEpicDashboard || isEpicMedications || isEpicAllergies ||
    (lowerReq.includes('epic') && lowerReq.includes('api')) ||
    (lowerReq.includes('fhir') && !lowerReq.includes('fire'));

  // Detect Epic + OCR combined (medical document scanner with patient context)
  const isEpicOCR = hasOCR && (isHealthcareApp ||
    lowerReq.includes('medical') ||
    lowerReq.includes('clinical') ||
    lowerReq.includes('patient') ||
    lowerReq.includes('prescription') ||
    lowerReq.includes('lab') ||
    lowerReq.includes('referral') ||
    lowerReq.includes('chart'));

  // Standalone OCR (not healthcare related)
  const isOCR = hasOCR && !isEpicOCR;

  // Choose package.json based on app type
  const packageJson = isEpicOCR ? getEpicOCRPackageJson() : isHealthcareApp ? getEpicPackageJson() : isOCR ? getOCRPackageJson() : getPackageJson();

  // Base files every app needs - use design system for styling
  const files = [
    { path: 'package.json', content: packageJson },
    { path: 'tsconfig.json', content: getTsConfig() },
    { path: 'next.config.mjs', content: getNextConfig() },
    { path: 'tailwind.config.js', content: getTailwindConfig(designSystem) },
    { path: 'postcss.config.mjs', content: getPostcssConfig() },
    { path: 'app/globals.css', content: getGlobalsCss(designSystem) },
    { path: 'app/layout.tsx', content: (isHealthcareApp || isEpicOCR) ? getEpicLayout(designSystem) : getLayout(designSystem) },
    { path: 'app/not-found.tsx', content: getNotFoundPage(designSystem) },
    { path: 'app/error.tsx', content: getErrorPage(designSystem) },
    { path: 'app/loading.tsx', content: getLoadingPage(designSystem) },
  ];

  // Add Epic FHIR library and API routes
  files.push(
    { path: 'lib/epic-fhir/types.ts', content: getEpicFhirTypes() },
    { path: 'lib/epic-fhir/client.ts', content: getEpicFhirClient() },
    { path: 'lib/epic-fhir/hooks.ts', content: getEpicFhirHooks() },
    { path: 'lib/epic-fhir/index.ts', content: getEpicFhirIndex() },
    { path: 'lib/utils.ts', content: getUtilsFile() },
    { path: 'app/api/epic/route.ts', content: getEpicApiRoute() },
    { path: 'app/api/epic/fhir/[...path]/route.ts', content: getEpicFhirProxyRoute() },
  );

  // Generate components dynamically based on templateConfig
  if (templateConfig?.epicApis && templateConfig.epicApis.length > 0) {
    const generatedComponents = generateEpicComponents(templateConfig);
    files.push(...generatedComponents);
  }

  // ALWAYS add default Epic components - pages import from @/components/epic
  // The dynamic components above are additional category-specific components
  files.push(
    { path: 'components/epic/PatientCard.tsx', content: getPatientCardComponent() },
    { path: 'components/epic/VitalSignsCard.tsx', content: getVitalSignsComponent() },
    { path: 'components/epic/MedicationsList.tsx', content: getMedicationsListComponent() },
    { path: 'components/epic/AllergiesList.tsx', content: getAllergiesListComponent() },
    { path: 'components/epic/index.ts', content: getEpicComponentsIndex() },
  );

  // Add the appropriate page based on templateId (if from Quick Build) or detected type
  // Template ID takes precedence for accurate page generation from Quick Build
  let pageAdded = false;

  if (templateId) {
    console.log('[SimpleBuilder] Matching templateId:', templateId);
    switch (templateId) {
      case 'patient-dashboard':
        files.push({ path: 'app/page.tsx', content: getEpicDashboardPage() });
        pageAdded = true;
        break;
      case 'patient-search':
        files.push({ path: 'app/page.tsx', content: getEpicPatientLookupPage() });
        pageAdded = true;
        break;
      case 'clinical-summary':
        files.push({ path: 'app/page.tsx', content: getEpicClinicalSummaryPage() });
        pageAdded = true;
        break;
      case 'lab-results-viewer':
        files.push({ path: 'app/page.tsx', content: getEpicLabResultsPage() });
        pageAdded = true;
        break;
      case 'immunization-record':
        files.push({ path: 'app/page.tsx', content: getEpicImmunizationsPage() });
        pageAdded = true;
        break;
      case 'medication-tracker':
        files.push({ path: 'app/page.tsx', content: getEpicMedicationsPage() });
        pageAdded = true;
        break;
      case 'allergy-manager':
        files.push({ path: 'app/page.tsx', content: getEpicAllergiesPage() });
        pageAdded = true;
        break;
      case 'appointment-viewer':
        files.push({ path: 'app/page.tsx', content: getEpicAppointmentsPage() });
        pageAdded = true;
        break;
      case 'document-viewer':
        files.push({ path: 'app/page.tsx', content: getEpicDocumentsPage() });
        pageAdded = true;
        break;
      case 'care-plan-display':
        files.push({ path: 'app/page.tsx', content: getEpicCarePlanPage() });
        pageAdded = true;
        break;
      case 'custom':
        // Custom template - don't add a page, let keyword detection analyze the requirements
        console.log('[SimpleBuilder] Custom template - using keyword detection for page selection');
        break;
      default:
        // Unknown template, will fall back to keyword detection
        console.log('[SimpleBuilder] Unknown templateId, falling back to keyword detection');
        break;
    }
    console.log('[SimpleBuilder] pageAdded after templateId switch:', pageAdded);
  }

  // Fall back to keyword detection if no templateId or unrecognized template
  if (!pageAdded) {
    if (isEpicOCR) {
      files.push({ path: 'app/page.tsx', content: getEpicOCRPage() });
      files.push({ path: 'app/api/ocr/route.ts', content: getEpicOCRApiRoute() });
    } else if (isOCR) {
      files.push({ path: 'app/page.tsx', content: getOCRPage() });
      files.push({ path: 'app/api/ocr/route.ts', content: getOCRApiRoute() });
    } else if (isEpicDashboard) {
      files.push({ path: 'app/page.tsx', content: getEpicDashboardPage() });
    } else if (isEpicPatient) {
      files.push({ path: 'app/page.tsx', content: getEpicPatientLookupPage() });
    } else if (isEpicMedications) {
      files.push({ path: 'app/page.tsx', content: getEpicMedicationsPage() });
    } else if (isEpicAllergies) {
      files.push({ path: 'app/page.tsx', content: getEpicAllergiesPage() });
    } else if (isHealthcareApp) {
      // Generic Epic app
      files.push({ path: 'app/page.tsx', content: getEpicDashboardPage() });
    } else if (isTodo) {
      files.push({ path: 'app/page.tsx', content: getTodoPage() });
    } else if (isCalculator) {
      files.push({ path: 'app/page.tsx', content: getCalculatorPage() });
    } else if (isWeather) {
      files.push({ path: 'app/page.tsx', content: getWeatherPage() });
    } else if (isCounter) {
      files.push({ path: 'app/page.tsx', content: getCounterPage() });
    } else {
      // Default: Hello World with the requirements shown
      files.push({ path: 'app/page.tsx', content: getHelloWorldPage(requirements) });
    }
  }

  return files;
}

// =============================================================================
// HEALTHCARE MODULE HELPERS
// =============================================================================

/**
 * Get base Next.js files for healthcare module builds
 */
function getBaseNextJsFiles(designSystem: DesignSystem | null = null): { path: string; content: string }[] {
  return [
    { path: 'package.json', content: getEpicPackageJson() },
    { path: 'tsconfig.json', content: getTsConfig() },
    { path: 'next.config.mjs', content: getNextConfig() },
    { path: 'tailwind.config.js', content: getTailwindConfig(designSystem) },
    { path: 'postcss.config.mjs', content: getPostcssConfig() },
    { path: 'app/globals.css', content: getGlobalsCss(designSystem) },
    { path: 'app/layout.tsx', content: getEpicLayout(designSystem) },
    { path: 'app/not-found.tsx', content: getNotFoundPage(designSystem) },
    { path: 'app/error.tsx', content: getErrorPage(designSystem) },
    { path: 'app/loading.tsx', content: getLoadingPage(designSystem) },
  ];
}

/**
 * Generate a page that uses healthcare module components
 */
function getHealthcareModulePage(moduleIds: string[]): string {
  const hasPatientDisplay = moduleIds.some(id => id.includes('patient'));
  const hasMedicationTracking = moduleIds.some(id => id.includes('medication'));

  // Medication tracking page (can include patient display components)
  if (hasMedicationTracking) {
    return `'use client';

import { useState } from 'react';
import { PatientSearch, PatientBanner } from '@/components/patient';
import { MedicationList, MedicationSummaryCard } from '@/components/medications';
import { useEpicConnection } from '@/lib/epic-fhir';

export default function MedicationTrackingPage() {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const { isConnected, loading: connectionLoading } = useEpicConnection();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b border-border-light">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Medication Tracking</h1>
            <div className="flex items-center gap-2">
              <span className={\`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium \${
                isConnected ? 'bg-success-bg text-success' : 'bg-warning/10 text-warning'
              }\`}>
                {connectionLoading ? 'Connecting...' : isConnected ? 'Epic Connected' : 'Demo Mode'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Patient Search */}
        <div className="mb-6">
          <PatientSearch
            onSelect={(patientId) => setSelectedPatientId(patientId)}
            placeholder="Search patients by name..."
            className="max-w-md"
          />
        </div>

        {/* Patient Info & Medications */}
        {selectedPatientId ? (
          <div className="space-y-6">
            <PatientBanner patientId={selectedPatientId} />

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MedicationSummaryCard patientId={selectedPatientId} />
            </div>

            {/* Full Medication List */}
            <MedicationList
              patientId={selectedPatientId}
              showHighRiskAlerts={true}
              showInteractionWarnings={true}
            />
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-foreground-muted mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-foreground">Track Patient Medications</h3>
            <p className="text-foreground-muted mt-1 max-w-md mx-auto">
              Search for a patient to view their active medications, high-risk alerts,
              drug interactions, and dosage instructions.
            </p>

            {/* Demo patients hint */}
            <div className="mt-6 p-4 bg-secondary/10 rounded-lg inline-block text-left">
              <p className="text-sm text-secondary font-medium">Try these demo patients:</p>
              <ul className="mt-2 text-sm text-secondary-dark space-y-1">
                <li>• Camila Lopez</li>
                <li>• Theodore Mychart</li>
                <li>• Derrick Lin</li>
              </ul>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
`;
  }

  // Patient display only page
  if (hasPatientDisplay) {
    return `'use client';

import { useState } from 'react';
import { PatientSearch, PatientBanner, PatientDemographics } from '@/components/patient';
import { useEpicConnection } from '@/lib/epic-fhir';

export default function PatientLookupPage() {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const { isConnected, loading: connectionLoading } = useEpicConnection();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b border-border-light">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Patient Lookup</h1>
            <div className="flex items-center gap-2">
              <span className={\`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium \${
                isConnected ? 'bg-success-bg text-success' : 'bg-warning/10 text-warning'
              }\`}>
                {connectionLoading ? 'Connecting...' : isConnected ? 'Epic Connected' : 'Demo Mode'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Patient Search */}
        <div className="mb-6">
          <PatientSearch
            onSelect={(patientId) => setSelectedPatientId(patientId)}
            placeholder="Search patients by name..."
            className="max-w-md"
          />
        </div>

        {/* Patient Info */}
        {selectedPatientId ? (
          <div className="space-y-6">
            <PatientBanner patientId={selectedPatientId} />
            <PatientDemographics patientId={selectedPatientId} />
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-foreground-muted mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-foreground">No patient selected</h3>
            <p className="text-foreground-muted mt-1">Search for a patient above to view their information</p>

            {/* Demo patients hint */}
            <div className="mt-6 p-4 bg-secondary/10 rounded-lg inline-block text-left">
              <p className="text-sm text-secondary font-medium">Try these demo patients:</p>
              <ul className="mt-2 text-sm text-secondary-dark space-y-1">
                <li>• Camila Lopez</li>
                <li>• Theodore Mychart</li>
                <li>• Derrick Lin</li>
              </ul>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
`;
  }

  // Default healthcare page
  return `'use client';

export default function HealthcarePage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">Healthcare Application</h1>
        <p className="text-foreground-muted mt-2">Configure your healthcare modules to get started.</p>
      </div>
    </div>
  );
}
`;
}

// =============================================================================
// Template generators
// =============================================================================
function getPackageJson(): string {
  return JSON.stringify({
    name: "app",
    version: "0.1.0",
    private: true,
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
      lint: "next lint"
    },
    dependencies: {
      next: "14.2.5",
      react: "^18",
      "react-dom": "^18"
    },
    devDependencies: {
      "@types/node": "^20",
      "@types/react": "^18",
      "@types/react-dom": "^18",
      autoprefixer: "^10",
      postcss: "^8",
      tailwindcss: "^3",
      typescript: "^5"
    }
  }, null, 2);
}

function getTsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      lib: ["dom", "dom.iterable", "esnext"],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: "esnext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "preserve",
      incremental: true,
      plugins: [{ name: "next" }],
      paths: { "@/*": ["./*"] }
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"]
  }, null, 2);
}

function getNextConfig(): string {
  return `/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use Turbo for faster dev and builds
  experimental: {
    turbo: {
      rules: {},
    },
  },
  // Optimize for faster builds
  swcMinify: true,
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
`;
}

function getTailwindConfig(designSystem: DesignSystem | null = null): string {
  // Helper to extract color value - handles both flat strings and nested {DEFAULT: value} objects
  const getColor = (colorValue: any, fallback: string): string => {
    if (!colorValue) return fallback;
    if (typeof colorValue === 'string') return colorValue;
    if (typeof colorValue === 'object' && colorValue.DEFAULT) return colorValue.DEFAULT;
    return fallback;
  };

  // Extract colors from design system with LIGHT THEME fallbacks (healthcare default)
  const dsColors = designSystem?.tokens?.colors as Record<string, any> | undefined;
  const background = getColor(dsColors?.background, '#ffffff');
  const foreground = getColor(dsColors?.foreground, '#0e203a');
  const card = getColor(dsColors?.card, '#ffffff');
  const primary = getColor(dsColors?.primary, '#0e203a');
  const primaryLight = getColor(dsColors?.primary?.['400'], '#4d86bc');
  const primaryDark = getColor(dsColors?.primary?.['900'], '#0a1729');
  const secondary = getColor(dsColors?.secondary, '#142d50');
  const muted = getColor(dsColors?.muted, '#f5f7fa');
  const mutedForeground = getColor(dsColors?.mutedForeground, '#64748b');
  const destructive = getColor(dsColors?.destructive, '#dc2626');
  const border = getColor(dsColors?.border, '#e2e8f0');
  const success = getColor(dsColors?.success, '#10b981');
  const warning = getColor(dsColors?.warning, '#f59e0b');
  const error = getColor(dsColors?.error, '#dc2626');

  return `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "${background}",
          muted: "${muted}",
        },
        foreground: {
          DEFAULT: "${foreground}",
          muted: "${mutedForeground}",
        },
        card: {
          DEFAULT: "${card}",
          foreground: "${foreground}",
        },
        primary: {
          DEFAULT: "${primary}",
          light: "${primaryLight}",
          dark: "${primaryDark}",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "${secondary}",
          foreground: "${foreground}",
        },
        muted: {
          DEFAULT: "${muted}",
          foreground: "${mutedForeground}",
        },
        destructive: {
          DEFAULT: "${destructive}",
          foreground: "#ffffff",
        },
        border: {
          DEFAULT: "${border}",
          light: "${muted}",
        },
        success: {
          DEFAULT: "${success}",
          light: "#ecfdf5",
        },
        warning: {
          DEFAULT: "${warning}",
          light: "#fffbeb",
        },
        error: {
          DEFAULT: "${error}",
          light: "#fef2f2",
        },
      },
    },
  },
  plugins: [],
};
`;
}

function getPostcssConfig(): string {
  return `const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
`;
}

function getGlobalsCss(designSystem: DesignSystem | null = null): string {
  // Helper to extract color value - handles both flat strings and nested {DEFAULT: value} objects
  const getColor = (colorValue: any, fallback: string): string => {
    if (!colorValue) return fallback;
    if (typeof colorValue === 'string') return colorValue;
    if (typeof colorValue === 'object' && colorValue.DEFAULT) return colorValue.DEFAULT;
    return fallback;
  };

  // Get typography from design system or use defaults
  const fontFamily = designSystem?.tokens?.typography?.fontFamily?.sans ||
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  const monoFont = designSystem?.tokens?.typography?.fontFamily?.mono ||
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';

  // Get colors for CSS variables - use LIGHT THEME defaults if no design system
  const dsColors = designSystem?.tokens?.colors as Record<string, any> | undefined;
  const background = getColor(dsColors?.background, '#ffffff');
  const foreground = getColor(dsColors?.foreground, '#0e203a');
  const primary = getColor(dsColors?.primary, '#0e203a');
  const secondary = getColor(dsColors?.secondary, '#142d50');
  const muted = getColor(dsColors?.muted, '#f5f7fa');
  const border = getColor(dsColors?.border, '#e2e8f0');

  return `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --font-sans: ${fontFamily};
  --font-mono: ${monoFont};
  --background: ${background};
  --foreground: ${foreground};
  --primary: ${primary};
  --secondary: ${secondary};
  --muted: ${muted};
  --border: ${border};
}

body {
  font-family: var(--font-sans);
  background-color: var(--background);
  color: var(--foreground);
}

code, pre {
  font-family: var(--font-mono);
}
`;
}

function getLayout(designSystem: DesignSystem | null = null): string {
  // Use design system colors for body styling - always use semantic classes now
  const bgClass = 'bg-background text-foreground';

  return `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "My App",
  description: "Built with Quick Build",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen ${bgClass}">
        {children}
      </body>
    </html>
  );
}
`;
}

function getNotFoundPage(designSystem: DesignSystem | null = null): string {
  // Use design system colors for button styling
  const btnClass = designSystem
    ? 'bg-primary hover:bg-primary/90 text-white'
    : 'bg-blue-600 hover:bg-blue-700 text-white';
  const textMuted = designSystem ? 'text-muted-foreground' : 'text-gray-400';

  return `import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold ${textMuted} mb-4">404</h1>
        <h2 className="text-2xl font-semibold ${textMuted} mb-4">Page Not Found</h2>
        <p className="${textMuted} mb-8">The page you're looking for doesn't exist.</p>
        <Link
          href="/"
          className="px-6 py-3 ${btnClass} rounded-lg transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
`;
}

function getErrorPage(designSystem: DesignSystem | null = null): string {
  const btnClass = designSystem
    ? 'bg-primary hover:bg-primary/90 text-white'
    : 'bg-blue-600 hover:bg-blue-700 text-white';
  const errorClass = designSystem ? 'text-destructive' : 'text-red-400';
  const textMuted = designSystem ? 'text-muted-foreground' : 'text-gray-400';

  return `'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold ${errorClass} mb-4">Something went wrong!</h1>
        <p className="${textMuted} mb-8">{error.message || 'An unexpected error occurred'}</p>
        <button
          onClick={() => reset()}
          className="px-6 py-3 ${btnClass} rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
`;
}

function getLoadingPage(designSystem: DesignSystem | null = null): string {
  const spinnerClass = designSystem
    ? 'border-primary border-t-transparent'
    : 'border-blue-600 border-t-transparent';
  const textMuted = designSystem ? 'text-muted-foreground' : 'text-gray-400';

  return `export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 ${spinnerClass} rounded-full animate-spin"></div>
        <p className="${textMuted}">Loading...</p>
      </div>
    </div>
  );
}
`;
}

function getHelloWorldPage(requirements: string): string {
  // Sanitize requirements for safe embedding in JSX
  const safeReq = requirements
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `'use client';

export default function Home() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Hello World!
        </h1>
        <p className="text-xl text-muted-foreground mb-8">
          Your app is ready!
        </p>
        <div className="bg-card border border-border-light rounded-lg p-6 text-left shadow">
          <p className="text-foreground-muted text-sm mb-2">Your request:</p>
          <p className="text-foreground">${safeReq}</p>
        </div>
        <p className="mt-8 text-foreground-light text-sm">
          Edit app/page.tsx to customize this page
        </p>
      </div>
    </main>
  );
}
`;
}

function getTodoPage(): string {
  return `'use client';

import { useState } from 'react';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState('');

  const addTodo = () => {
    if (!input.trim()) return;
    setTodos([...todos, { id: Date.now(), text: input, completed: false }]);
    setInput('');
  };

  const toggleTodo = (id: number) => {
    setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTodo = (id: number) => {
    setTodos(todos.filter(t => t.id !== id));
  };

  return (
    <main className="min-h-screen bg-background text-foreground p-8 max-w-md mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-center">Todo List</h1>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTodo()}
          placeholder="Add a task..."
          className="flex-1 px-4 py-2 rounded-lg bg-card border border-border focus:border-primary outline-none"
        />
        <button
          onClick={addTodo}
          className="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors"
        >
          Add
        </button>
      </div>

      <div className="space-y-2">
        {todos.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No tasks yet. Add one above!</p>
        ) : (
          todos.map(todo => (
            <div
              key={todo.id}
              className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg group"
            >
              <button
                onClick={() => toggleTodo(todo.id)}
                className={\`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors \${
                  todo.completed ? 'bg-success border-success' : 'border-muted hover:border-primary'
                }\`}
              >
                {todo.completed && <span className="text-white text-sm">✓</span>}
              </button>
              <span className={\`flex-1 \${todo.completed ? 'line-through text-muted-foreground' : ''}\`}>
                {todo.text}
              </span>
              <button
                onClick={() => deleteTodo(todo.id)}
                className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {todos.length > 0 && (
        <p className="text-muted-foreground text-sm mt-4 text-center">
          {todos.filter(t => t.completed).length} of {todos.length} completed
        </p>
      )}
    </main>
  );
}
`;
}

function getCalculatorPage(): string {
  return `'use client';

import { useState } from 'react';

export default function Home() {
  const [display, setDisplay] = useState('0');
  const [firstNum, setFirstNum] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForSecond, setWaitingForSecond] = useState(false);

  const inputNumber = (num: string) => {
    if (waitingForSecond) {
      setDisplay(num);
      setWaitingForSecond(false);
    } else {
      setDisplay(display === '0' ? num : display + num);
    }
  };

  const inputOperator = (op: string) => {
    setFirstNum(parseFloat(display));
    setOperator(op);
    setWaitingForSecond(true);
  };

  const calculate = () => {
    if (firstNum === null || operator === null) return;
    const secondNum = parseFloat(display);
    let result: number;

    switch (operator) {
      case '+': result = firstNum + secondNum; break;
      case '-': result = firstNum - secondNum; break;
      case '*': result = firstNum * secondNum; break;
      case '/': result = secondNum !== 0 ? firstNum / secondNum : 0; break;
      default: return;
    }

    setDisplay(String(result));
    setFirstNum(null);
    setOperator(null);
  };

  const clear = () => {
    setDisplay('0');
    setFirstNum(null);
    setOperator(null);
    setWaitingForSecond(false);
  };

  const Button = ({ children, onClick, className = '' }: { children: React.ReactNode; onClick: () => void; className?: string }) => (
    <button
      onClick={onClick}
      className={\`p-4 text-xl font-medium rounded-lg transition-colors \${className}\`}
    >
      {children}
    </button>
  );

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="bg-card border border-border-light rounded-2xl p-4 shadow-lg w-72">
        <div className="bg-background-muted rounded-lg p-4 mb-4 text-right">
          <div className="text-foreground-muted text-sm h-6">
            {firstNum !== null ? \`\${firstNum} \${operator}\` : ''}
          </div>
          <div className="text-3xl font-mono text-foreground">{display}</div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <Button onClick={clear} className="bg-error hover:bg-error-light text-white col-span-2">AC</Button>
          <Button onClick={() => inputOperator('/')} className="bg-secondary hover:bg-secondary-light text-white">÷</Button>
          <Button onClick={() => inputOperator('*')} className="bg-secondary hover:bg-secondary-light text-white">×</Button>

          {['7', '8', '9'].map(n => (
            <Button key={n} onClick={() => inputNumber(n)} className="bg-primary hover:bg-primary-light text-white">{n}</Button>
          ))}
          <Button onClick={() => inputOperator('-')} className="bg-secondary hover:bg-secondary-light text-white">−</Button>

          {['4', '5', '6'].map(n => (
            <Button key={n} onClick={() => inputNumber(n)} className="bg-primary hover:bg-primary-light text-white">{n}</Button>
          ))}
          <Button onClick={() => inputOperator('+')} className="bg-secondary hover:bg-secondary-light text-white">+</Button>

          {['1', '2', '3'].map(n => (
            <Button key={n} onClick={() => inputNumber(n)} className="bg-primary hover:bg-primary-light text-white">{n}</Button>
          ))}
          <Button onClick={calculate} className="bg-success hover:bg-success-light text-white row-span-2">=</Button>

          <Button onClick={() => inputNumber('0')} className="bg-primary hover:bg-primary-light text-white col-span-2">0</Button>
          <Button onClick={() => inputNumber('.')} className="bg-primary hover:bg-primary-light text-white">.</Button>
        </div>
      </div>
    </main>
  );
}
`;
}

function getWeatherPage(): string {
  return `'use client';

import { useState, useEffect } from 'react';

interface WeatherData {
  city: string;
  temp: number;
  condition: string;
  humidity: number;
  wind: number;
  icon: string;
  forecast: { day: string; high: number; low: number; icon: string }[];
}

const getWeatherIcon = (code: number): string => {
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 48) return '🌫️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '🌨️';
  if (code <= 82) return '🌧️';
  if (code <= 86) return '🌨️';
  return '⛈️';
};

const getCondition = (code: number): string => {
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 67) return 'Rainy';
  if (code <= 77) return 'Snowy';
  if (code <= 82) return 'Rain showers';
  return 'Thunderstorm';
};

const getDayName = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
};

export default function Home() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [city, setCity] = useState('San Francisco');
  const [searchInput, setSearchInput] = useState('');

  const fetchWeather = async (cityName: string) => {
    setLoading(true);
    setError(null);

    try {
      // First geocode the city using Open-Meteo's geocoding API (free, no key needed)
      const geoRes = await fetch(
        \`https://geocoding-api.open-meteo.com/v1/search?name=\${encodeURIComponent(cityName)}&count=1\`
      );
      const geoData = await geoRes.json();

      if (!geoData.results || geoData.results.length === 0) {
        throw new Error('City not found');
      }

      const { latitude, longitude, name } = geoData.results[0];

      // Fetch weather from Open-Meteo (free, no API key needed!)
      const weatherRes = await fetch(
        \`https://api.open-meteo.com/v1/forecast?latitude=\${latitude}&longitude=\${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto\`
      );
      const data = await weatherRes.json();

      setWeather({
        city: name,
        temp: Math.round(data.current.temperature_2m),
        condition: getCondition(data.current.weather_code),
        humidity: data.current.relative_humidity_2m,
        wind: Math.round(data.current.wind_speed_10m),
        icon: getWeatherIcon(data.current.weather_code),
        forecast: data.daily.time.slice(1, 6).map((date: string, i: number) => ({
          day: getDayName(date),
          high: Math.round(data.daily.temperature_2m_max[i + 1]),
          low: Math.round(data.daily.temperature_2m_min[i + 1]),
          icon: getWeatherIcon(data.daily.weather_code[i + 1]),
        })),
      });
      setCity(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch weather');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather(city);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      fetchWeather(searchInput.trim());
      setSearchInput('');
    }
  };

  return (
    <main className="min-h-screen bg-background p-8 max-w-lg mx-auto">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search city..."
            className="flex-1 px-4 py-2 rounded-lg bg-card border border-border focus:border-secondary outline-none text-foreground"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-secondary hover:bg-secondary-light text-white rounded-lg font-medium transition-colors"
          >
            Search
          </button>
        </div>
      </form>

      <div className="bg-gradient-to-br from-primary to-secondary rounded-3xl p-8 shadow-lg text-white">
        {loading ? (
          <div className="text-center py-12">
            <div className="text-4xl animate-pulse">🌤️</div>
            <p className="mt-4">Loading weather...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-4xl">❌</div>
            <p className="mt-4 text-error-light">{error}</p>
            <button
              onClick={() => fetchWeather(city)}
              className="mt-4 px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30"
            >
              Retry
            </button>
          </div>
        ) : weather ? (
          <>
            {/* Current Weather */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-medium mb-2">{weather.city}</h1>
              <div className="text-7xl mb-2">{weather.icon}</div>
              <div className="text-6xl font-light mb-2">{weather.temp}°</div>
              <div className="text-xl text-blue-200">{weather.condition}</div>
            </div>

            {/* Details */}
            <div className="flex justify-center gap-8 mb-8 text-blue-200">
              <div className="text-center">
                <div className="text-2xl">💧</div>
                <div className="text-sm">Humidity</div>
                <div className="font-medium text-white">{weather.humidity}%</div>
              </div>
              <div className="text-center">
                <div className="text-2xl">💨</div>
                <div className="text-sm">Wind</div>
                <div className="font-medium text-white">{weather.wind} mph</div>
              </div>
            </div>

            {/* 5-Day Forecast */}
            <div className="bg-white/10 rounded-2xl p-4">
              <h2 className="text-sm font-medium text-blue-200 mb-3">5-DAY FORECAST</h2>
              <div className="space-y-3">
                {weather.forecast.map((day) => (
                  <div key={day.day} className="flex items-center justify-between">
                    <span className="w-12 font-medium">{day.day}</span>
                    <span className="text-2xl">{day.icon}</span>
                    <div className="flex gap-2">
                      <span className="font-medium">{day.high}°</span>
                      <span className="text-blue-300">{day.low}°</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>

      <p className="text-center text-foreground-light text-sm mt-4">
        Powered by Open-Meteo API (free, no API key needed)
      </p>
    </main>
  );
}
`;
}

function getCounterPage(): string {
  return `'use client';

import { useState } from 'react';

export default function Home() {
  const [count, setCount] = useState(0);

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-8 text-foreground">Counter</h1>

      <div className="text-8xl font-mono mb-8 tabular-nums text-foreground">
        {count}
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => setCount(c => c - 1)}
          className="px-8 py-4 text-2xl bg-error hover:bg-error-light text-white rounded-xl font-bold transition-colors"
        >
          −
        </button>
        <button
          onClick={() => setCount(0)}
          className="px-8 py-4 text-xl bg-primary hover:bg-primary-light text-white rounded-xl font-medium transition-colors"
        >
          Reset
        </button>
        <button
          onClick={() => setCount(c => c + 1)}
          className="px-8 py-4 text-2xl bg-success hover:bg-success-light text-white rounded-xl font-bold transition-colors"
        >
          +
        </button>
      </div>
    </main>
  );
}
`;
}

// ============================================
// OCR Templates
// ============================================

function getOCRPackageJson(): string {
  return JSON.stringify({
    name: "ocr-scanner-app",
    version: "0.1.0",
    private: true,
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
      lint: "next lint"
    },
    dependencies: {
      next: "14.2.5",
      react: "^18",
      "react-dom": "^18",
      "lucide-react": "^0.344.0",
      "pdf-parse": "^1.1.1",
      "sharp": "^0.33.2"
    },
    devDependencies: {
      "@types/node": "^20",
      "@types/react": "^18",
      "@types/react-dom": "^18",
      autoprefixer: "^10",
      postcss: "^8",
      tailwindcss: "^3",
      typescript: "^5"
    }
  }, null, 2);
}

function getOCRPage(): string {
  return `'use client';

import { useState, useCallback, useRef } from 'react';

interface OCRResult {
  text: string;
  model: string;
  success: boolean;
  processingTime?: number;
}

export default function OCRScanner() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/') && selectedFile.type !== 'application/pdf') {
      setError('Please select an image or PDF file');
      return;
    }

    if (selectedFile.size > 20 * 1024 * 1024) {
      setError('File too large. Max size is 20MB');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setResult(null);

    // Create preview for images
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(selectedFile);
    } else {
      setPreview(null);
    }
  }, []);

  const processOCR = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    const startTime = Date.now();

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'OCR processing failed');
      }

      setResult({
        text: data.fullText || data.text || '',
        model: data.model || 'DeepSeek-OCR',
        success: true,
        processingTime: Date.now() - startTime,
      });
    } catch (err: any) {
      setError(err.message || 'OCR processing failed');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!result?.text) return;
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const clear = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFile(droppedFile);
  };

  return (
    <main className="min-h-screen bg-background p-8 max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-3 text-foreground">
          <span className="text-4xl">📄</span>
          OCR Document Scanner
        </h1>
        <p className="text-foreground-muted">
          Extract text from images using MLX DeepSeek-OCR (Apple Silicon)
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Upload Section */}
        <div className="bg-card border border-border-light rounded-xl p-6 shadow">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
            <span>📤</span> Upload Document
          </h2>

          {!preview && !file ? (
            <div
              className={\`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors \${
                isDragging ? 'border-secondary bg-secondary/10' : 'border-border hover:border-border-dark'
              }\`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <div className="text-4xl mb-4">📷</div>
              <p className="font-medium text-foreground">Drop image here or click to browse</p>
              <p className="text-sm text-foreground-light mt-1">PNG, JPG, PDF up to 20MB</p>
            </div>
          ) : (
            <div className="space-y-4">
              {preview && (
                <div className="relative rounded-lg overflow-hidden bg-background-muted">
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full h-auto max-h-64 object-contain"
                  />
                </div>
              )}

              {file && !preview && (
                <div className="bg-background-muted rounded-lg p-4 flex items-center gap-3">
                  <span className="text-2xl">📄</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-foreground">{file.name}</p>
                    <p className="text-sm text-foreground-light">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={processOCR}
                  disabled={loading}
                  className="flex-1 py-3 bg-secondary hover:bg-secondary-light text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Processing...
                    </>
                  ) : (
                    <>
                      <span>🔍</span>
                      Extract Text
                    </>
                  )}
                </button>
                <button
                  onClick={clear}
                  className="px-4 py-3 bg-primary hover:bg-primary-light text-white rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-error/20 border border-error/50 rounded-lg text-error-light text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Result Section */}
        <div className="bg-card border border-border-light rounded-xl p-6 shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
              <span>📝</span> Extracted Text
            </h2>
            {result && (
              <div className="flex items-center gap-2 text-xs text-foreground-muted">
                {result.processingTime && (
                  <span>{(result.processingTime / 1000).toFixed(1)}s</span>
                )}
                <button
                  onClick={copyToClipboard}
                  className="p-1.5 hover:bg-background-muted rounded transition-colors"
                  title="Copy to clipboard"
                >
                  {copied ? '✓' : '📋'}
                </button>
              </div>
            )}
          </div>

          {result ? (
            <div className="bg-background-muted rounded-lg p-4 max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap font-mono text-sm text-foreground-muted">
                {result.text || 'No text extracted'}
              </pre>
            </div>
          ) : (
            <div className="bg-background-muted rounded-lg p-8 text-center text-foreground-light">
              <div className="text-4xl mb-4 opacity-50">📝</div>
              <p>Upload an image and click "Extract Text" to see results</p>
            </div>
          )}

          {result && (
            <p className="text-xs text-foreground-light mt-3">
              Processed using {result.model} (local AI)
            </p>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="mt-8 grid md:grid-cols-3 gap-4">
        <div className="bg-card/50 border border-border-light rounded-lg p-4 text-center">
          <div className="text-2xl mb-2">🔒</div>
          <h3 className="font-medium mb-1 text-foreground">100% Local</h3>
          <p className="text-sm text-foreground-muted">Your data never leaves your machine</p>
        </div>
        <div className="bg-card/50 border border-border-light rounded-lg p-4 text-center">
          <div className="text-2xl mb-2">⚡</div>
          <h3 className="font-medium mb-1 text-foreground">Apple Silicon</h3>
          <p className="text-sm text-foreground-muted">MLX optimized for M1/M2/M3 chips</p>
        </div>
        <div className="bg-card/50 border border-border-light rounded-lg p-4 text-center">
          <div className="text-2xl mb-2">📄</div>
          <h3 className="font-medium mb-1 text-foreground">PDF Support</h3>
          <p className="text-sm text-foreground-muted">Extract text from multi-page PDFs</p>
        </div>
      </div>

      <p className="text-center text-foreground-light text-sm mt-8">
        Requires MLX-VLM with DeepSeek-OCR model (pip install mlx-vlm)
      </p>
    </main>
  );
}
`;
}

function getOCRApiRoute(): string {
  return `import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

const MLX_MODEL_PATH = path.join(
  os.homedir(),
  '.cache/huggingface/hub/models--mlx-community--DeepSeek-OCR-4bit/snapshots/7cb35246727a4332f80a2d1d1c27f79b81cbe585'
);

// Check if MLX is available
async function checkMLXAvailable(): Promise<boolean> {
  try {
    const result = await runPython(\`
import sys
try:
    import mlx_vlm
    print("available")
except ImportError:
    print("not_available")
\`);
    return result.trim() === 'available';
  } catch {
    return false;
  }
}

// Run Python script - tries pyenv first, then python3 directly
function runPython(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      PATH: \`/opt/homebrew/bin:\${process.env.PATH}\`,
      PYENV_VERSION: '3.12.0',
      HF_HUB_OFFLINE: '1',
    };

    // Try pyenv first, fallback to python3
    const pythonCmd = '(eval "$(pyenv init -)" 2>/dev/null && pyenv global 3.12.0 2>/dev/null && python) || python3';

    const pyenv = spawn('bash', ['-c', pythonCmd], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    pyenv.stdout.on('data', (data) => { stdout += data.toString(); });
    pyenv.stderr.on('data', (data) => { stderr += data.toString(); });

    pyenv.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(\`Python failed: \${stderr || stdout}\`));
    });

    pyenv.stdin.write(script);
    pyenv.stdin.end();
  });
}

// Perform OCR using MLX DeepSeek-OCR
async function performMLXOCR(imagePath: string, prompt?: string): Promise<string> {
  const finalPrompt = prompt || 'Extract all text from this image exactly as it appears.';

  const pythonScript = \`
import os
import json
import re
os.environ['HF_HUB_OFFLINE'] = '1'

from mlx_vlm import load, generate
from mlx_vlm.prompt_utils import apply_chat_template
from mlx_vlm.utils import load_config

model_path = "\${MLX_MODEL_PATH}"
model, processor = load(model_path)
config = load_config(model_path)

prompt = """\${finalPrompt}"""
image_path = "\${imagePath}"

formatted_prompt = apply_chat_template(processor, config, prompt, num_images=1)
result = generate(model, processor, formatted_prompt, [image_path], max_tokens=4096, verbose=False)

text = result.text if hasattr(result, 'text') else str(result)
# Clean markup
clean_text = re.sub(r'<\\\\|[^|]+\\\\|>[^<]*<\\\\|/[^|]+\\\\|>', '', text)
clean_text = re.sub(r'<\\\\|det\\\\|>[^<]*<\\\\|/det\\\\|>', '', clean_text)
print(clean_text.strip())
\`;

  return await runPython(pythonScript);
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (error) {
    throw new Error('Failed to parse PDF: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    // Handle multipart form data (file upload)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Handle PDF files - extract text directly
      if (file.type === 'application/pdf') {
        const text = await extractPdfText(buffer);
        return NextResponse.json({
          success: true,
          text,
          fullText: text,
          model: 'pdf-parse',
          filename: file.name,
          isPdf: true,
        });
      }

      // Handle images with MLX
      if (file.type.startsWith('image/')) {
        // Check if MLX is available
        const mlxAvailable = await checkMLXAvailable();
        if (!mlxAvailable) {
          return NextResponse.json({
            error: 'MLX-VLM not available. Install with: pip install mlx-vlm',
          }, { status: 503 });
        }

        // Save to temp file for MLX
        const tempPath = path.join(os.tmpdir(), \`ocr-\${Date.now()}-\${file.name}\`);
        await fs.writeFile(tempPath, buffer);

        try {
          const text = await performMLXOCR(tempPath);
          await fs.unlink(tempPath).catch(() => {});

          return NextResponse.json({
            success: true,
            text,
            fullText: text,
            model: 'DeepSeek-OCR-4bit',
            filename: file.name,
          });
        } catch (error) {
          await fs.unlink(tempPath).catch(() => {});
          throw error;
        }
      }

      return NextResponse.json({ error: 'Unsupported file type. Use images (PNG, JPG) or PDF.' }, { status: 400 });
    }

    // Handle JSON body with base64 image
    const body = await request.json();
    const { image, prompt } = body;

    if (!image) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    // Check MLX availability
    const mlxAvailable = await checkMLXAvailable();
    if (!mlxAvailable) {
      return NextResponse.json({
        error: 'MLX-VLM not available. Install with: pip install mlx-vlm',
      }, { status: 503 });
    }

    // Save base64 to temp file
    const base64Data = image.replace(/^data:image\\/\\w+;base64,/, '');
    const tempPath = path.join(os.tmpdir(), \`ocr-\${Date.now()}.png\`);
    await fs.writeFile(tempPath, Buffer.from(base64Data, 'base64'));

    try {
      const text = await performMLXOCR(tempPath, prompt);
      await fs.unlink(tempPath).catch(() => {});

      return NextResponse.json({
        success: true,
        text,
        model: 'DeepSeek-OCR-4bit',
      });
    } catch (error) {
      await fs.unlink(tempPath).catch(() => {});
      throw error;
    }
  } catch (error) {
    console.error('OCR Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'OCR failed' },
      { status: 500 }
    );
  }
}

// GET endpoint: Check OCR availability
export async function GET() {
  try {
    const mlxAvailable = await checkMLXAvailable();

    // Check if model exists
    let modelAvailable = false;
    try {
      await fs.access(MLX_MODEL_PATH);
      modelAvailable = true;
    } catch {}

    return NextResponse.json({
      available: mlxAvailable && modelAvailable,
      engine: 'MLX',
      model: 'DeepSeek-OCR-4bit',
      mlxInstalled: mlxAvailable,
      modelDownloaded: modelAvailable,
      supportedFormats: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf'],
      performance: {
        tokensPerSecond: '~550',
        memoryGB: '~3.7',
      },
    });
  } catch {
    return NextResponse.json({
      available: false,
      error: 'MLX OCR not available',
    }, { status: 503 });
  }
}
`;
}

// ============================================
// Epic + OCR Templates (Medical Document Scanner)
// ============================================

function getEpicOCRPackageJson(): string {
  return JSON.stringify({
    name: "epic-medical-document-scanner",
    version: "0.1.0",
    private: true,
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
      lint: "next lint"
    },
    dependencies: {
      next: "14.2.5",
      react: "^18",
      "react-dom": "^18",
      "clsx": "^2.1.0",
      "tailwind-merge": "^2.2.0",
      "lucide-react": "^0.344.0",
      "pdf-parse": "^1.1.1",
      "sharp": "^0.33.2"
    },
    devDependencies: {
      "@types/node": "^20",
      "@types/react": "^18",
      "@types/react-dom": "^18",
      autoprefixer: "^10",
      postcss: "^8",
      tailwindcss: "^3",
      typescript: "^5"
    }
  }, null, 2);
}

function getEpicOCRPage(): string {
  return `'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { usePatient, useMedications, useAllergies } from '@/lib/epic-fhir';
import { PatientCard } from '@/components/epic';

interface OCRResult {
  text: string;
  model: string;
  success: boolean;
  processingTime?: number;
  structuredData?: {
    documentType?: string;
    patientName?: string;
    dateOfService?: string;
    provider?: string;
    medications?: string[];
    diagnoses?: string[];
    notes?: string;
  };
}

const SANDBOX_PATIENTS = [
  { name: 'Theodore Mychart', id: 'e63wRTbPfr1p8UW81d8Seiw3' },
  { name: 'Camila Lopez', id: 'erXuFYUfucBZaryVksYEcMg3' },
];

const DOCUMENT_TYPES = [
  { id: 'general', label: 'General Document', prompt: 'Extract all text from this medical document. Preserve formatting and structure.' },
  { id: 'prescription', label: 'Prescription/Rx', prompt: 'Extract medication details from this prescription including: drug name, dosage, frequency, quantity, refills, prescriber, and date.' },
  { id: 'lab', label: 'Lab Results', prompt: 'Extract lab test results including: test names, values, units, reference ranges, and any flagged abnormal results.' },
  { id: 'notes', label: 'Clinical Notes', prompt: 'Extract clinical notes including: chief complaint, history, examination findings, assessment, and plan. Identify any handwritten annotations.' },
  { id: 'referral', label: 'Referral Letter', prompt: 'Extract referral information including: referring provider, specialist, reason for referral, urgency, and relevant history.' },
];

export default function MedicalDocumentScanner() {
  // OCR state
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [documentType, setDocumentType] = useState('general');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Epic state
  const [patientId, setPatientId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [checking, setChecking] = useState(true);

  const patient = usePatient(isConnected ? patientId : null);
  const medications = useMedications(isConnected ? patientId : null);
  const allergies = useAllergies(isConnected ? patientId : null);

  // Check Epic connection
  useEffect(() => {
    fetch('/api/epic')
      .then(r => r.json())
      .then(data => setIsConnected(data.connected))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const handleFile = useCallback((selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/') && selectedFile.type !== 'application/pdf') {
      setError('Please select an image or PDF file');
      return;
    }

    if (selectedFile.size > 20 * 1024 * 1024) {
      setError('File too large. Max size is 20MB');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setResult(null);

    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(selectedFile);
    } else {
      setPreview(null);
    }
  }, []);

  const processOCR = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    const startTime = Date.now();

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', documentType);
      formData.append('prompt', DOCUMENT_TYPES.find(d => d.id === documentType)?.prompt || '');
      if (patientId) formData.append('patientId', patientId);

      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'OCR processing failed');
      }

      setResult({
        text: data.fullText || data.text || '',
        model: data.model || 'DeepSeek-OCR',
        success: true,
        processingTime: Date.now() - startTime,
        structuredData: data.structuredData,
      });
    } catch (err: any) {
      setError(err.message || 'OCR processing failed');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!result?.text) return;
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const clear = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFile(droppedFile);
  };

  return (
    <main className="min-h-screen bg-background p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 text-foreground">
            <span>🏥</span> Medical Document Scanner
          </h1>
          <p className="text-foreground-muted mt-1">
            Scan medical documents with AI and link to patient records
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="px-3 py-1 bg-success-bg text-success rounded-full text-sm font-medium flex items-center gap-1">
              <span className="w-2 h-2 bg-success rounded-full"></span>
              Epic Connected
            </span>
          ) : (
            <span className="px-3 py-1 bg-background-muted text-foreground-muted rounded-full text-sm">
              Epic Offline
            </span>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Patient Context */}
        <div className="space-y-4">
          <div className="bg-card rounded-xl p-4 shadow-sm border border-border-light">
            <h2 className="font-semibold mb-3 flex items-center gap-2 text-foreground">
              <span>👤</span> Patient Context
            </h2>
            <p className="text-sm text-foreground-muted mb-3">
              Link scanned documents to a patient record
            </p>
            <div className="space-y-2">
              {SANDBOX_PATIENTS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPatientId(patientId === p.id ? null : p.id)}
                  disabled={!isConnected}
                  className={\`w-full px-3 py-2 text-left text-sm rounded-lg border border-border transition-colors disabled:opacity-50 \${
                    patientId === p.id
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'hover:bg-muted text-foreground'
                  }\`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {patientId && (
            <>
              <PatientCard patient={patient.data} loading={patient.loading} error={patient.error} />

              {/* Quick Reference */}
              <div className="bg-card rounded-xl p-4 shadow-sm border border-border">
                <h3 className="font-semibold text-foreground mb-3 text-sm flex items-center gap-2">
                  <span>⚠️</span> Allergies ({allergies.data.length})
                </h3>
                {allergies.loading ? (
                  <div className="animate-pulse h-8 bg-muted rounded"></div>
                ) : allergies.data.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No known allergies</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {allergies.data.slice(0, 5).map((a, i) => (
                      <span
                        key={i}
                        className={\`text-xs px-2 py-1 rounded \${
                          a.criticality === 'high'
                            ? 'bg-error/20 text-error'
                            : 'bg-warning/20 text-warning'
                        }\`}
                      >
                        {a.code?.text || a.code?.coding?.[0]?.display || 'Unknown'}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-card rounded-xl p-4 shadow-sm border border-border">
                <h3 className="font-semibold text-foreground mb-3 text-sm flex items-center gap-2">
                  <span>💊</span> Active Medications ({medications.data.length})
                </h3>
                {medications.loading ? (
                  <div className="animate-pulse h-16 bg-muted rounded"></div>
                ) : medications.data.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active medications</p>
                ) : (
                  <div className="space-y-1 max-h-32 overflow-y-auto text-sm">
                    {medications.data.slice(0, 5).map((m, i) => (
                      <p key={i} className="text-foreground truncate">
                        {m.medicationReference?.display ||
                          m.medicationCodeableConcept?.text ||
                          m.medicationCodeableConcept?.coding?.[0]?.display ||
                          'Unknown medication'}
                      </p>
                    ))}
                    {medications.data.length > 5 && (
                      <p className="text-muted-foreground text-xs">+{medications.data.length - 5} more</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Middle Column - Document Upload */}
        <div className="space-y-4">
          <div className="bg-card rounded-xl p-4 shadow-sm border border-border">
            <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <span>📄</span> Document Type
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {DOCUMENT_TYPES.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => setDocumentType(doc.id)}
                  className={\`px-3 py-2 text-sm rounded-lg border border-border transition-colors \${
                    documentType === doc.id
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'hover:bg-muted'
                  }\`}
                >
                  {doc.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl p-4 shadow-sm border border-border">
            <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <span>📤</span> Upload Document
            </h2>

            {!preview && !file ? (
              <div
                className={\`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors \${
                  isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground'
                }\`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <div className="text-3xl mb-2">📷</div>
                <p className="font-medium text-sm text-foreground">Drop document here</p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG, PDF up to 20MB</p>
              </div>
            ) : (
              <div className="space-y-3">
                {preview && (
                  <div className="relative rounded-lg overflow-hidden bg-muted">
                    <img
                      src={preview}
                      alt="Preview"
                      className="w-full h-auto max-h-48 object-contain"
                    />
                  </div>
                )}

                {file && !preview && (
                  <div className="bg-muted rounded-lg p-3 flex items-center gap-3">
                    <span className="text-xl">📄</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={processOCR}
                    disabled={loading}
                    className="flex-1 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                  >
                    {loading ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        Scanning...
                      </>
                    ) : (
                      <>
                        <span>🔍</span>
                        Scan Document
                      </>
                    )}
                  </button>
                  <button
                    onClick={clear}
                    className="px-4 py-2.5 bg-muted hover:bg-border rounded-lg transition-colors text-sm text-foreground"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-3 p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Results */}
        <div className="space-y-4">
          <div className="bg-card rounded-xl p-4 shadow-sm border border-border min-h-[400px]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <span>📝</span> Extracted Text
              </h2>
              {result && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {result.processingTime && <span>{(result.processingTime / 1000).toFixed(1)}s</span>}
                  <button
                    onClick={copyToClipboard}
                    className="p-1.5 hover:bg-muted rounded transition-colors"
                  >
                    {copied ? '✓' : '📋'}
                  </button>
                </div>
              )}
            </div>

            {result ? (
              <div className="space-y-3">
                <div className="bg-muted rounded-lg p-3 max-h-80 overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-mono text-sm text-foreground">
                    {result.text || 'No text extracted'}
                  </pre>
                </div>

                {patientId && (
                  <div className="p-3 bg-success/10 rounded-lg border border-success/30">
                    <p className="text-sm text-success flex items-center gap-2">
                      <span>✓</span>
                      Linked to patient: {patient.data ? \`\${patient.data.name?.[0]?.given?.[0]} \${patient.data.name?.[0]?.family}\` : patientId}
                    </p>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Processed using {result.model} (local AI)
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <div className="text-4xl mb-3 opacity-50">📝</div>
                <p className="text-sm">Scan a document to see extracted text</p>
              </div>
            )}
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-card rounded-lg p-3 text-center border border-border">
              <div className="text-xl mb-1">🔒</div>
              <p className="text-xs font-medium text-foreground">HIPAA Ready</p>
              <p className="text-xs text-muted-foreground">Local processing</p>
            </div>
            <div className="bg-card rounded-lg p-3 text-center border border-border">
              <div className="text-xl mb-1">✍️</div>
              <p className="text-xs font-medium text-foreground">Handwriting</p>
              <p className="text-xs text-muted-foreground">AI-powered</p>
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-muted-foreground text-sm mt-6">
        Requires MLX-VLM with DeepSeek-OCR • Epic connection optional
      </p>
    </main>
  );
}
`;
}

function getEpicOCRApiRoute(): string {
  return `import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

const MLX_MODEL_PATH = path.join(
  os.homedir(),
  '.cache/huggingface/hub/models--mlx-community--DeepSeek-OCR-4bit/snapshots/7cb35246727a4332f80a2d1d1c27f79b81cbe585'
);

// Check if MLX is available
async function checkMLXAvailable(): Promise<boolean> {
  try {
    const result = await runPython(\`
import sys
try:
    import mlx_vlm
    print("available")
except ImportError:
    print("not_available")
\`);
    return result.trim() === 'available';
  } catch {
    return false;
  }
}

// Run Python script - tries pyenv first, then python3 directly
function runPython(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      PATH: \`/opt/homebrew/bin:\${process.env.PATH}\`,
      PYENV_VERSION: '3.12.0',
      HF_HUB_OFFLINE: '1',
    };

    // Try pyenv first, fallback to python3
    const pythonCmd = '(eval "$(pyenv init -)" 2>/dev/null && pyenv global 3.12.0 2>/dev/null && python) || python3';

    const pyenv = spawn('bash', ['-c', pythonCmd], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    pyenv.stdout.on('data', (data) => { stdout += data.toString(); });
    pyenv.stderr.on('data', (data) => { stderr += data.toString(); });

    pyenv.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(\`Python failed: \${stderr || stdout}\`));
    });

    pyenv.stdin.write(script);
    pyenv.stdin.end();
  });
}

// Perform OCR using MLX DeepSeek-OCR
async function performMLXOCR(imagePath: string, prompt?: string): Promise<string> {
  const finalPrompt = prompt || 'Extract all text from this medical document. Preserve formatting, identify handwritten notes, and structure the output clearly.';

  const pythonScript = \`
import os
import json
import re
os.environ['HF_HUB_OFFLINE'] = '1'

from mlx_vlm import load, generate
from mlx_vlm.prompt_utils import apply_chat_template
from mlx_vlm.utils import load_config

model_path = "\${MLX_MODEL_PATH}"
model, processor = load(model_path)
config = load_config(model_path)

prompt = """\${finalPrompt}"""
image_path = "\${imagePath}"

formatted_prompt = apply_chat_template(processor, config, prompt, num_images=1)
result = generate(model, processor, formatted_prompt, [image_path], max_tokens=4096, verbose=False)

text = result.text if hasattr(result, 'text') else str(result)
# Clean markup
clean_text = re.sub(r'<\\\\|[^|]+\\\\|>[^<]*<\\\\|/[^|]+\\\\|>', '', text)
clean_text = re.sub(r'<\\\\|det\\\\|>[^<]*<\\\\|/det\\\\|>', '', clean_text)
print(clean_text.strip())
\`;

  return await runPython(pythonScript);
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (error) {
    throw new Error('Failed to parse PDF: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const documentType = formData.get('documentType') as string || 'general';
      const customPrompt = formData.get('prompt') as string || undefined;
      const patientId = formData.get('patientId') as string || undefined;

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Handle PDF files
      if (file.type === 'application/pdf') {
        const text = await extractPdfText(buffer);
        return NextResponse.json({
          success: true,
          text,
          fullText: text,
          model: 'pdf-parse',
          filename: file.name,
          documentType,
          patientId,
          timestamp: new Date().toISOString(),
          isPdf: true,
        });
      }

      // Handle images with MLX
      if (file.type.startsWith('image/')) {
        const mlxAvailable = await checkMLXAvailable();
        if (!mlxAvailable) {
          return NextResponse.json({
            error: 'MLX-VLM not available. Install with: pip install mlx-vlm',
          }, { status: 503 });
        }

        const tempPath = path.join(os.tmpdir(), \`ocr-\${Date.now()}-\${file.name}\`);
        await fs.writeFile(tempPath, buffer);

        try {
          const text = await performMLXOCR(tempPath, customPrompt);
          await fs.unlink(tempPath).catch(() => {});

          return NextResponse.json({
            success: true,
            text,
            fullText: text,
            model: 'DeepSeek-OCR-4bit',
            filename: file.name,
            documentType,
            patientId,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          await fs.unlink(tempPath).catch(() => {});
          throw error;
        }
      }

      return NextResponse.json({ error: 'Unsupported file type. Use images (PNG, JPG) or PDF.' }, { status: 400 });
    }

    const body = await request.json();
    const { image, prompt } = body;

    if (!image) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    const mlxAvailable = await checkMLXAvailable();
    if (!mlxAvailable) {
      return NextResponse.json({
        error: 'MLX-VLM not available. Install with: pip install mlx-vlm',
      }, { status: 503 });
    }

    const base64Data = image.replace(/^data:image\\/\\w+;base64,/, '');
    const tempPath = path.join(os.tmpdir(), \`ocr-\${Date.now()}.png\`);
    await fs.writeFile(tempPath, Buffer.from(base64Data, 'base64'));

    try {
      const text = await performMLXOCR(tempPath, prompt);
      await fs.unlink(tempPath).catch(() => {});

      return NextResponse.json({
        success: true,
        text,
        model: 'DeepSeek-OCR-4bit',
      });
    } catch (error) {
      await fs.unlink(tempPath).catch(() => {});
      throw error;
    }
  } catch (error) {
    console.error('OCR Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'OCR failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const mlxAvailable = await checkMLXAvailable();

    let modelAvailable = false;
    try {
      await fs.access(MLX_MODEL_PATH);
      modelAvailable = true;
    } catch {}

    return NextResponse.json({
      available: mlxAvailable && modelAvailable,
      engine: 'MLX',
      model: 'DeepSeek-OCR-4bit',
      mlxInstalled: mlxAvailable,
      modelDownloaded: modelAvailable,
      documentTypes: ['general', 'prescription', 'lab', 'notes', 'referral'],
      supportedFormats: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf'],
      performance: {
        tokensPerSecond: '~550',
        memoryGB: '~3.7',
      },
    });
  } catch {
    return NextResponse.json({
      available: false,
      error: 'MLX OCR not available',
    }, { status: 503 });
  }
}
`;
}

/**
 * Run a command asynchronously using spawn with cmd.exe /c for proper Windows handling
 */
function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  timeout: number,
  env?: Record<string, string | undefined>
): Promise<{ success: boolean; output?: string; error?: string }> {
  return new Promise((resolve) => {
    const fullCmd = `${cmd} ${args.join(' ')}`;
    console.log(`[runCommand] Starting: ${fullCmd} in ${cwd}`);
    const startTime = Date.now();

    let stdout = '';
    let stderr = '';
    let resolved = false;

    // Build clean environment - remove any turbopack/next.js parent vars
    const cleanEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      // Skip turbopack and next.js internal vars that could leak from parent
      if (key.startsWith('TURBO') || key.startsWith('__NEXT')) {
        continue;
      }
      if (value !== undefined) {
        cleanEnv[key] = value;
      }
    }
    // Apply custom env overrides
    if (env) {
      for (const [key, value] of Object.entries(env)) {
        if (value !== undefined) {
          cleanEnv[key] = value;
        }
      }
    }

    // On Windows, explicitly use cmd.exe /c to run the full command
    // This is more reliable than shell: true with separate args
    const isWindows = process.platform === 'win32';
    const proc = isWindows
      ? spawn('cmd.exe', ['/c', fullCmd], {
          cwd,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: cleanEnv as NodeJS.ProcessEnv,
          windowsHide: true,
        })
      : spawn(cmd, args, {
          cwd,
          shell: true,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: cleanEnv as NodeJS.ProcessEnv,
        });

    console.log(`[runCommand] Spawned PID: ${proc.pid}`);

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill('SIGKILL');
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[runCommand] Timeout after ${duration}s`);
        resolve({ success: false, error: `Command timed out after ${timeout / 1000} seconds` });
      }
    }, timeout);

    proc.stdout?.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      // Log first 200 chars of each chunk
      console.log(`[runCommand] stdout: ${chunk.slice(0, 200).replace(/\n/g, ' ')}`);
    });

    proc.stderr?.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      console.log(`[runCommand] stderr: ${chunk.slice(0, 200).replace(/\n/g, ' ')}`);
    });

    proc.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[runCommand] Error after ${duration}s: ${err.message}`);
        resolve({ success: false, error: err.message });
      }
    });

    proc.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[runCommand] Exited with code ${code} after ${duration}s`);
        console.log(`[runCommand] Total stdout: ${stdout.length} bytes, stderr: ${stderr.length} bytes`);

        // Check for success indicators
        const hasSuccess = stdout.includes('Compiled successfully') ||
                          stdout.includes('added ') ||
                          stdout.includes('up to date') ||
                          stdout.includes('Generating static pages') ||
                          stdout.includes('Finalizing page optimization');

        if (code === 0 || hasSuccess) {
          resolve({ success: true, output: stdout });
        } else {
          resolve({
            success: false,
            output: stdout,
            error: stderr || `Exit code: ${code}`,
          });
        }
      }
    });
  });
}

/**
 * Extract the most useful part of a build error
 */
function extractBuildError(output: string): string {
  const lines = output.split('\n');

  // More specific error patterns - avoid matching normal output
  const errorPatterns = [
    /error TS\d+:/i,
    /Module not found/i,
    /Cannot find module/i,
    /Type error:/i,
    /SyntaxError/i,
    /Build error occurred/i,
    /Failed to compile/i,
    /error:/i,  // lowercase only
  ];

  const errorLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip lines that are just status messages
    if (line.includes('Creating an optimized') || line.includes('Compiled successfully')) {
      continue;
    }
    if (errorPatterns.some(pattern => pattern.test(line))) {
      errorLines.push(line);
      if (lines[i + 1]) errorLines.push(lines[i + 1]);
      if (lines[i + 2]) errorLines.push(lines[i + 2]);
      if (errorLines.length > 10) break;
    }
  }

  if (errorLines.length > 0) {
    return errorLines.join('\n');
  }

  // Return last part of output for context
  return output.slice(-300);
}

/**
 * Setup database for a project based on the configuration
 */
async function setupDatabaseForProject(
  projectId: string,
  projectDir: string,
  databaseConfig: DatabaseConfig,
  requirements: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // Import database services dynamically to avoid circular deps
    const { provisionDatabase, setupPrismaInProject } = await import('./database-provisioning');
    const { schemaTemplates, generateSchemaFromRequirements } = await import('./schema-generator');
    const { loadDatabaseCredentials } = await import('@/lib/credentials-store');

    // Load credentials
    const credentials = await loadDatabaseCredentials();

    // Generate database name from project ID
    const dbName = projectId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

    // Get schema based on template or auto-generate
    let schema;
    if (databaseConfig.schemaTemplate === 'auto') {
      // Use Claude to generate schema from requirements
      schema = await generateSchemaFromRequirements({ requirements });
    } else if (schemaTemplates[databaseConfig.schemaTemplate]) {
      schema = {
        tables: schemaTemplates[databaseConfig.schemaTemplate](),
      };
    } else {
      // Fallback to authentication template
      schema = {
        tables: schemaTemplates.authentication(),
      };
    }

    // Provision the database
    const database = await provisionDatabase(
      projectId,
      databaseConfig.provider,
      dbName,
      {
        neonApiKey: credentials.neonApiKey,
        supabaseAccessToken: credentials.supabaseAccessToken,
        awsAccessKeyId: credentials.awsAccessKeyId,
        awsSecretAccessKey: credentials.awsSecretAccessKey,
        awsRegion: credentials.awsRegion,
      }
    );

    // Setup Prisma in the project
    await setupPrismaInProject(projectDir, database, schema);

    // Save database config to project
    const dbConfigPath = path.join(projectDir, '.database.json');
    await fs.writeFile(dbConfigPath, JSON.stringify({
      provider: database.provider,
      type: database.type,
      projectId: database.projectId,
      host: database.host,
      port: database.port,
      database: database.database,
      connectionString: database.connectionString, // Include connection string!
      ssl: database.ssl,
      supabaseUrl: database.supabaseUrl,
      rdsInstanceId: database.rdsInstanceId,
      provisionedAt: new Date().toISOString(),
    }, null, 2), 'utf-8');

    return {
      success: true,
      message: `${databaseConfig.provider} database provisioned with ${schema.tables.length} tables`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Quick fix - just rebuild (no AI needed for template apps)
 */
export async function attemptQuickFix(
  projectDir: string,
  error: string,
  onProgress: ProgressCallback
): Promise<{ success: boolean; error?: string }> {

  onProgress({
    phase: 'building',
    message: 'Retrying build...',
  });

  // Just try building again
  const buildResult = await runCommand('npm', ['run', 'build'], projectDir, 180000, {
    NODE_ENV: 'production',
  });

  if (buildResult.success) {
    onProgress({
      phase: 'complete',
      message: 'Build successful!',
    });
    return { success: true };
  } else {
    const errorDetails = extractBuildError(buildResult.output || buildResult.error || '');
    return { success: false, error: errorDetails };
  }
}

// ============================================
// Epic Healthcare Templates
// ============================================

function getEpicPackageJson(): string {
  return JSON.stringify({
    name: "epic-healthcare-app",
    version: "0.1.0",
    private: true,
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
      lint: "next lint"
    },
    dependencies: {
      next: "14.2.5",
      react: "^18",
      "react-dom": "^18",
      "clsx": "^2.1.0",
      "tailwind-merge": "^2.2.0",
      "lucide-react": "^0.344.0"
    },
    devDependencies: {
      "@types/node": "^20",
      "@types/react": "^18",
      "@types/react-dom": "^18",
      autoprefixer: "^10",
      postcss: "^8",
      tailwindcss: "^3",
      typescript: "^5"
    }
  }, null, 2);
}

function getEpicLayout(designSystem: DesignSystem | null = null): string {
  // Healthcare apps always use semantic classes now (light theme fallback in Tailwind config)
  const bgClass = 'bg-background text-foreground';

  return `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Healthcare App",
  description: "Built with Epic FHIR APIs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen ${bgClass}">
        {children}
      </body>
    </html>
  );
}
`;
}

function getUtilsFile(): string {
  return `import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`;
}

function getEpicFhirTypes(): string {
  return `// Epic FHIR R4 Type Definitions

export interface Patient {
  resourceType: 'Patient';
  id?: string;
  name?: Array<{
    use?: string;
    text?: string;
    family?: string;
    given?: string[];
  }>;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  telecom?: Array<{
    system?: string;
    value?: string;
    use?: string;
  }>;
  address?: Array<{
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
  }>;
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: { text?: string };
  }>;
  maritalStatus?: {
    coding?: Array<{ code?: string; display?: string }>;
    text?: string;
  };
  communication?: Array<{
    language?: {
      coding?: Array<{ code?: string; display?: string }>;
      text?: string;
    };
    preferred?: boolean;
  }>;
  active?: boolean;
}

export interface Observation {
  resourceType: 'Observation';
  id?: string;
  status: string;
  code: { coding?: Array<{ code?: string; display?: string }>; text?: string };
  valueQuantity?: { value?: number; unit?: string };
  valueString?: string;
  effectiveDateTime?: string;
  component?: Array<{
    code: { coding?: Array<{ code?: string; display?: string }> };
    valueQuantity?: { value?: number; unit?: string };
  }>;
}

export interface MedicationRequest {
  resourceType: 'MedicationRequest';
  id?: string;
  status: string;
  medicationCodeableConcept?: { coding?: Array<{ display?: string }>; text?: string };
  medicationReference?: { display?: string; reference?: string };
  dosageInstruction?: Array<{ text?: string; patientInstruction?: string; route?: { text?: string } }>;
  authoredOn?: string;
}

export interface AllergyIntolerance {
  resourceType: 'AllergyIntolerance';
  id?: string;
  code?: { coding?: Array<{ display?: string }>; text?: string };
  criticality?: 'low' | 'high' | 'unable-to-assess';
  category?: string[];
  clinicalStatus?: { coding?: Array<{ code?: string }> };
  reaction?: Array<{ manifestation: Array<{ text?: string }> }>;
  onsetDateTime?: string;
}

export interface Condition {
  resourceType: 'Condition';
  id?: string;
  code?: { coding?: Array<{ display?: string }>; text?: string };
  clinicalStatus?: { coding?: Array<{ code?: string }>; text?: string };
  severity?: { text?: string };
  onsetDateTime?: string;
  category?: Array<{ text?: string }>;
}

export interface Encounter {
  resourceType: 'Encounter';
  id?: string;
  status: string;
  class?: { code?: string; display?: string };
  type?: Array<{ coding?: Array<{ code?: string; display?: string }>; text?: string }>;
  subject?: { reference?: string; display?: string };
  participant?: Array<{ individual?: { reference?: string; display?: string } }>;
  period?: { start?: string; end?: string };
  reasonCode?: Array<{ coding?: Array<{ display?: string }>; text?: string }>;
  location?: Array<{ location?: { display?: string } }>;
  serviceProvider?: { reference?: string; display?: string };
}

export interface Immunization {
  resourceType: 'Immunization';
  id?: string;
  status: string;
  vaccineCode?: { coding?: Array<{ code?: string; display?: string }>; text?: string };
  patient?: { reference?: string };
  occurrenceDateTime?: string;
  primarySource?: boolean;
  lotNumber?: string;
  expirationDate?: string;
  site?: { coding?: Array<{ display?: string }>; text?: string };
  route?: { coding?: Array<{ display?: string }>; text?: string };
  doseQuantity?: { value?: number; unit?: string };
  performer?: Array<{ actor?: { display?: string } }>;
  note?: Array<{ text?: string }>;
}

export interface FHIRBundle<T> {
  resourceType: 'Bundle';
  total?: number;
  entry?: Array<{ resource?: T }>;
}
`;
}

function getEpicFhirClient(): string {
  return `// Epic FHIR API Client

import type { Patient, Observation, MedicationRequest, AllergyIntolerance, Condition, Encounter, Immunization, FHIRBundle } from './types';

const API_BASE = '/api/epic';

export async function getPatient(patientId: string): Promise<Patient> {
  const res = await fetch(\`\${API_BASE}/fhir/Patient/\${encodeURIComponent(patientId)}\`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.details || \`Failed to fetch patient (HTTP \${res.status})\`);
  }
  const data = await res.json();
  // Validate it's a Patient resource, not an OperationOutcome error
  if (data.resourceType === 'OperationOutcome') {
    throw new Error(data.issue?.[0]?.diagnostics || data.issue?.[0]?.details?.text || 'Patient not found');
  }
  if (data.resourceType !== 'Patient') {
    throw new Error('Invalid response: expected Patient resource');
  }
  return data;
}

export async function getObservations(patientId: string, category?: string): Promise<FHIRBundle<Observation>> {
  const params = new URLSearchParams({ patient: patientId, _count: '20' });
  if (category) params.set('category', category);
  const res = await fetch(\`\${API_BASE}/fhir/Observation?\${params}\`);
  if (!res.ok) throw new Error('Failed to fetch observations');
  return res.json();
}

export async function getMedications(patientId: string): Promise<FHIRBundle<MedicationRequest>> {
  const res = await fetch(\`\${API_BASE}/fhir/MedicationRequest?patient=\${patientId}&status=active\`);
  if (!res.ok) throw new Error('Failed to fetch medications');
  return res.json();
}

export async function getAllergies(patientId: string): Promise<FHIRBundle<AllergyIntolerance>> {
  const res = await fetch(\`\${API_BASE}/fhir/AllergyIntolerance?patient=\${patientId}\`);
  if (!res.ok) throw new Error('Failed to fetch allergies');
  return res.json();
}

export async function getConditions(patientId: string): Promise<FHIRBundle<Condition>> {
  const res = await fetch(\`\${API_BASE}/fhir/Condition?patient=\${patientId}&clinical-status=active\`);
  if (!res.ok) throw new Error('Failed to fetch conditions');
  return res.json();
}

export async function getEncounters(patientId: string, count: number = 10): Promise<FHIRBundle<Encounter>> {
  const res = await fetch(\`\${API_BASE}/fhir/Encounter?patient=\${patientId}&_count=\${count}&_sort=-date\`);
  if (!res.ok) throw new Error('Failed to fetch encounters');
  return res.json();
}

export async function getLabResults(patientId: string, count: number = 20): Promise<FHIRBundle<Observation>> {
  const res = await fetch(\`\${API_BASE}/fhir/Observation?patient=\${patientId}&category=laboratory&_count=\${count}&_sort=-date\`);
  if (!res.ok) throw new Error('Failed to fetch lab results');
  return res.json();
}

export async function getImmunizations(patientId: string): Promise<FHIRBundle<Immunization>> {
  const res = await fetch(\`\${API_BASE}/fhir/Immunization?patient=\${patientId}\`);
  if (!res.ok) throw new Error('Failed to fetch immunizations');
  return res.json();
}

// Generic FHIR search for any resource type
export async function search(resourceType: string, params: Record<string, string>): Promise<FHIRBundle<any>> {
  const searchParams = new URLSearchParams(params);
  const res = await fetch(\`\${API_BASE}/fhir/\${resourceType}?\${searchParams.toString()}\`);
  if (!res.ok) throw new Error(\`Failed to search \${resourceType}\`);
  return res.json();
}

export async function searchPatients(name: string): Promise<FHIRBundle<Patient>> {
  const res = await fetch(\`\${API_BASE}/fhir/Patient?name=\${encodeURIComponent(name)}&_count=20\`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.details || \`Failed to search patients (HTTP \${res.status})\`);
  }
  return res.json();
}

export function formatPatientName(patient: Patient): string {
  if (!patient.name?.[0]) return 'Unknown Patient';
  const name = patient.name[0];
  if (name.text) return name.text;
  return [name.given?.join(' '), name.family].filter(Boolean).join(' ') || 'Unknown';
}

export function calculateAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function extractResources<T>(bundle: FHIRBundle<T>): T[] {
  return bundle.entry?.filter(e => e.resource).map(e => e.resource as T) || [];
}
`;
}

function getEpicFhirHooks(): string {
  return `'use client';

import { useState, useEffect, useCallback } from 'react';
import * as api from './client';
import type { Patient, Observation, MedicationRequest, AllergyIntolerance, Condition, Encounter, Immunization } from './types';

// Extended patient data with computed fields
export interface PatientData extends Patient {
  displayName: string;
  age: number | null;
}

// Connection status hook - checks if main platform Epic API is available
export function useEpicConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ connected: boolean; patientId: string | null }>({ connected: false, patientId: null });

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/epic');
      const json = await res.json();
      setIsConnected(json.connected === true);
      setData(json);
    } catch (e: any) {
      setIsConnected(false);
      setError(e.message || 'Failed to check Epic connection');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return {
    isConnected,
    loading,
    error,
    data,
    refetch,
    setToken: async () => {},
    disconnect: async () => setIsConnected(false),
  };
}

// Patient search hook
// Note: Epic Backend Services apps may not support patient search by name
// Use sandbox patient IDs directly for testing (e.g., 'e63wRTbPfr1p8UW81d8Seiw3' for Theodore Mychart)
export function usePatientSearch(searchTerm: string) {
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2) {
      setPatients([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const timer = setTimeout(async () => {
      try {
        const bundle = await api.searchPatients(searchTerm);
        const rawPatients = api.extractResources(bundle);
        const enriched = rawPatients.map(p => ({
          ...p,
          displayName: api.formatPatientName(p),
          age: p.birthDate ? api.calculateAge(p.birthDate) : null,
        }));
        setPatients(enriched);
      } catch (e: any) {
        // Check for Epic scope/permission errors
        const msg = e.message || '';
        if (msg.includes('403') || msg.includes('forbidden') || msg.includes('scope')) {
          setError('Patient search not available. Backend Services apps cannot search by name. Use sandbox patient IDs instead.');
        } else {
          setError(msg || 'Failed to search patients');
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  return { patients, data: patients, loading, error, total: patients.length, refetch: async () => {} };
}

export function usePatient(patientId: string | null) {
  const [data, setData] = useState<PatientData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!patientId) { setData(null); return; }
    setLoading(true);
    setError(null);
    try {
      const patient = await api.getPatient(patientId);
      setData({
        ...patient,
        displayName: api.formatPatientName(patient),
        age: patient.birthDate ? api.calculateAge(patient.birthDate) : null,
      });
    } catch (e: any) {
      setError(e.message || 'Failed to fetch patient');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, error, refetch };
}

export function useVitalSigns(patientId: string | null) {
  const [data, setData] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) { setData([]); return; }
    setLoading(true);
    api.getObservations(patientId, 'vital-signs')
      .then(bundle => setData(api.extractResources(bundle)))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [patientId]);

  return { data, loading, error };
}

// Alias for useVitalSigns
export const useVitals = useVitalSigns;

export function useMedications(patientId: string | null) {
  const [data, setData] = useState<MedicationRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) { setData([]); return; }
    setLoading(true);
    api.getMedications(patientId)
      .then(bundle => setData(api.extractResources(bundle)))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [patientId]);

  return { data, loading, error };
}

export function useAllergies(patientId: string | null) {
  const [data, setData] = useState<AllergyIntolerance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) { setData([]); return; }
    setLoading(true);
    api.getAllergies(patientId)
      .then(bundle => setData(api.extractResources(bundle)))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [patientId]);

  return { data, loading, error };
}

export function useConditions(patientId: string | null) {
  const [data, setData] = useState<Condition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) { setData([]); return; }
    setLoading(true);
    api.getConditions(patientId)
      .then(bundle => setData(api.extractResources(bundle)))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [patientId]);

  return { data, loading, error };
}

export function useEncounters(patientId: string | null, count: number = 10) {
  const [data, setData] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) { setData([]); return; }
    setLoading(true);
    api.getEncounters(patientId, count)
      .then(bundle => setData(api.extractResources(bundle)))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [patientId, count]);

  return { data, loading, error };
}

export function useLabResults(patientId: string | null, count: number = 20) {
  const [data, setData] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) { setData([]); return; }
    setLoading(true);
    api.getLabResults(patientId, count)
      .then(bundle => setData(api.extractResources(bundle)))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [patientId, count]);

  return { data, loading, error };
}

export function useImmunizations(patientId: string | null) {
  const [data, setData] = useState<Immunization[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) { setData([]); return; }
    setLoading(true);
    api.getImmunizations(patientId)
      .then(bundle => setData(api.extractResources(bundle)))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [patientId]);

  return { data, loading, error };
}

export function useProcedures(patientId: string | null) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) { setData([]); return; }
    setLoading(true);
    api.search('Procedure', { patient: patientId, _count: '50' })
      .then(bundle => setData(api.extractResources(bundle)))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [patientId]);

  return { data, loading, error };
}

export function useAppointments(patientId: string | null) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) { setData([]); return; }
    setLoading(true);
    api.search('Appointment', { patient: patientId, _count: '50' })
      .then(bundle => setData(api.extractResources(bundle)))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [patientId]);

  return { data, loading, error };
}

export function useDocuments(patientId: string | null) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) { setData([]); return; }
    setLoading(true);
    api.search('DocumentReference', { patient: patientId, _count: '50' })
      .then(bundle => setData(api.extractResources(bundle)))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [patientId]);

  return { data, loading, error };
}

export function useCarePlans(patientId: string | null) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) { setData([]); return; }
    setLoading(true);
    api.search('CarePlan', { patient: patientId, _count: '50' })
      .then(bundle => setData(api.extractResources(bundle)))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [patientId]);

  return { data, loading, error };
}

export function useGoals(patientId: string | null) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) { setData([]); return; }
    setLoading(true);
    api.search('Goal', { patient: patientId, _count: '50' })
      .then(bundle => setData(api.extractResources(bundle)))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [patientId]);

  return { data, loading, error };
}

export function useCareTeam(patientId: string | null) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) { setData([]); return; }
    setLoading(true);
    api.search('CareTeam', { patient: patientId, _count: '50' })
      .then(bundle => setData(api.extractResources(bundle)))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [patientId]);

  return { data, loading, error };
}
`;
}

function getEpicFhirIndex(): string {
  return `export * from './types';
export * from './client';
export * from './hooks';
`;
}

// =============================================================================
// DYNAMIC COMPONENT GENERATION BASED ON TEMPLATE CONFIG
// =============================================================================

/**
 * Generate Epic components dynamically based on user's API selections
 */
function generateEpicComponents(templateConfig: TemplateConfig): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = [];
  const componentsByCategory: Record<string, string[]> = {
    patient: [],
    clinical: [],
    medications: [],
    scheduling: [],
    documents: [],
    care: [],
  };

  // Generate components for each selected API
  for (const api of templateConfig.epicApis) {
    const category = getApiCategory(api.apiId);

    for (const componentName of api.generateComponents) {
      const content = getComponentContent(componentName);
      if (content) {
        files.push({
          path: `components/${category}/${componentName}.tsx`,
          content,
        });
        componentsByCategory[category]?.push(componentName);
      }
    }
  }

  // Generate index files for each category that has components
  for (const [category, components] of Object.entries(componentsByCategory)) {
    if (components.length > 0) {
      const exports = components.map(c => `export { ${c} } from './${c}';`).join('\n');
      files.push({
        path: `components/${category}/index.ts`,
        content: exports + '\n',
      });
    }
  }

  return files;
}

/**
 * Map API ID to component category folder
 */
function getApiCategory(apiId: string): string {
  const categoryMap: Record<string, string> = {
    'patient': 'patient',
    'related-person': 'patient',
    'observation-vitals': 'clinical',
    'observation-labs': 'clinical',
    'condition': 'clinical',
    'procedure': 'clinical',
    'diagnostic-report': 'clinical',
    'immunization': 'clinical',
    'medication-request': 'medications',
    'allergy-intolerance': 'medications',
    'appointment': 'scheduling',
    'encounter': 'scheduling',
    'document-reference': 'documents',
    'imaging-study': 'documents',
    'care-plan': 'care',
    'goal': 'care',
    'care-team': 'care',
  };
  return categoryMap[apiId] || 'epic';
}

/**
 * Get component content by name
 */
function getComponentContent(componentName: string): string | null {
  const generators: Record<string, () => string> = {
    // Patient components
    'PatientBanner': getPatientBannerComponent,
    'PatientCard': getPatientCardComponent,
    'PatientSearch': getPatientSearchComponent,
    'PatientDemographics': getPatientDemographicsComponent,
    // Clinical components
    'VitalSignsChart': getVitalSignsChartComponent,
    'VitalSignsCard': getVitalSignsComponent,
    'BloodPressureDisplay': getBloodPressureDisplayComponent,
    'LabResultsPanel': getLabResultsPanelComponent,
    'ConditionsList': getConditionsListComponent,
    'ProcedureHistory': getProcedureHistoryComponent,
    'ImmunizationTimeline': getImmunizationTimelineComponent,
    // Medications components
    'MedicationsList': getMedicationsListComponent,
    'MedicationCard': getMedicationCardComponent,
    'AllergiesList': getAllergiesListComponent,
    'AllergyCard': getAllergyCardComponent,
    // Scheduling components
    'AppointmentCalendar': getAppointmentCalendarComponent,
    'AppointmentCard': getAppointmentCardComponent,
    'EncounterHistory': getEncounterHistoryComponent,
    // Documents components
    'DocumentList': getDocumentListComponent,
    'DocumentViewer': getDocumentViewerComponent,
    // Care components
    'CarePlanDisplay': getCarePlanDisplayComponent,
    'GoalTracker': getGoalTrackerComponent,
    'CareTeamList': getCareTeamListComponent,
  };

  const generator = generators[componentName];
  return generator ? generator() : null;
}

// =============================================================================
// PATIENT COMPONENTS
// =============================================================================

function getPatientBannerComponent(): string {
  return `'use client';

import { usePatient, formatPatientName, calculateAge } from '@/lib/epic-fhir';
import { cn } from '@/lib/utils';

interface Props {
  patientId: string;
  className?: string;
}

export function PatientBanner({ patientId, className }: Props) {
  const { data: patient, loading, error } = usePatient(patientId);

  if (loading) {
    return (
      <div className={cn("bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-6 animate-pulse", className)}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-muted" />
          <div className="flex-1">
            <div className="h-6 bg-muted rounded w-48 mb-2" />
            <div className="h-4 bg-muted rounded w-32" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className={cn("bg-error/10 rounded-xl p-6 border border-error/30", className)}>
        <p className="text-error">{error || 'Patient not found'}</p>
      </div>
    );
  }

  const name = formatPatientName(patient);
  const age = patient.birthDate ? calculateAge(patient.birthDate) : null;
  const mrn = patient.identifier?.find(i => i.type?.text === 'MRN' || i.system?.includes('mrn'))?.value || patient.identifier?.[0]?.value;

  return (
    <div className={cn("bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-6 border border-primary/20", className)}>
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-2xl font-bold text-primary">
            {name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </span>
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-foreground">{name}</h2>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            {age && <span>{age} years old</span>}
            {patient.gender && <span className="capitalize">{patient.gender}</span>}
            {mrn && <span>MRN: {mrn}</span>}
          </div>
        </div>
        <div className="text-right">
          {patient.birthDate && (
            <p className="text-sm text-muted-foreground">
              DOB: {new Date(patient.birthDate).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default PatientBanner;
`;
}

function getPatientSearchComponent(): string {
  return `'use client';

import { useState } from 'react';
import { usePatientSearch } from '@/lib/epic-fhir';
import { cn } from '@/lib/utils';

interface Props {
  onSelect: (patientId: string) => void;
  placeholder?: string;
  className?: string;
}

const SANDBOX_PATIENTS = [
  { name: 'Camila Lopez', id: 'erXuFYUfucBZaryVksYEcMg3', mrn: 'MRN-001' },
  { name: 'Theodore Mychart', id: 'e63wRTbPfr1p8UW81d8Seiw3', mrn: 'MRN-002' },
  { name: 'Derrick Lin', id: 'eq081-VQEgP8drUUqCWzHfw3', mrn: 'MRN-003' },
];

export function PatientSearch({ onSelect, placeholder = 'Search patients...', className }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { patients, loading } = usePatientSearch(searchTerm);

  // Use sandbox patients for demo
  const displayPatients = searchTerm.length >= 2
    ? SANDBOX_PATIENTS.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.mrn.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {isOpen && searchTerm.length >= 2 && (
        <div className="absolute z-50 w-full mt-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          {displayPatients.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">No patients found</div>
          ) : (
            displayPatients.map((patient) => (
              <button
                key={patient.id}
                onClick={() => {
                  onSelect(patient.id);
                  setSearchTerm(patient.name);
                  setIsOpen(false);
                }}
                className="w-full p-4 text-left hover:bg-muted/50 transition-colors border-b border-border last:border-0"
              >
                <p className="font-medium text-foreground">{patient.name}</p>
                <p className="text-sm text-muted-foreground">{patient.mrn}</p>
              </button>
            ))
          )}
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}

export default PatientSearch;
`;
}

function getPatientDemographicsComponent(): string {
  return `'use client';

import { usePatient, formatPatientName, calculateAge } from '@/lib/epic-fhir';
import { cn } from '@/lib/utils';

interface Props {
  patientId: string;
  className?: string;
}

export function PatientDemographics({ patientId, className }: Props) {
  const { data: patient, loading, error } = usePatient(patientId);

  if (loading) {
    return (
      <div className={cn("bg-card rounded-xl p-6 border border-border animate-pulse", className)}>
        <div className="h-5 bg-muted rounded w-40 mb-4" />
        <div className="grid grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i}>
              <div className="h-3 bg-muted rounded w-20 mb-2" />
              <div className="h-4 bg-muted rounded w-32" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className={cn("bg-error/10 rounded-xl p-6 border border-error/30", className)}>
        <p className="text-error">{error || 'Failed to load demographics'}</p>
      </div>
    );
  }

  const phone = patient.telecom?.find(t => t.system === 'phone')?.value;
  const email = patient.telecom?.find(t => t.system === 'email')?.value;
  const address = patient.address?.[0];
  const addressStr = address ? [address.line?.join(' '), address.city, address.state, address.postalCode].filter(Boolean).join(', ') : null;

  const fields = [
    { label: 'Full Name', value: formatPatientName(patient) },
    { label: 'Date of Birth', value: patient.birthDate ? new Date(patient.birthDate).toLocaleDateString() : null },
    { label: 'Age', value: patient.birthDate ? \`\${calculateAge(patient.birthDate)} years\` : null },
    { label: 'Gender', value: patient.gender },
    { label: 'Phone', value: phone },
    { label: 'Email', value: email },
    { label: 'Address', value: addressStr },
    { label: 'Marital Status', value: patient.maritalStatus?.coding?.[0]?.display },
  ];

  return (
    <div className={cn("bg-card rounded-xl p-6 border border-border", className)}>
      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        Demographics
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {fields.filter(f => f.value).map((field, i) => (
          <div key={i}>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{field.label}</p>
            <p className="text-sm font-medium text-foreground capitalize">{field.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PatientDemographics;
`;
}

// =============================================================================
// CLINICAL COMPONENTS
// =============================================================================

function getVitalSignsChartComponent(): string {
  return `'use client';

import { useVitalSigns } from '@/lib/epic-fhir';
import { cn } from '@/lib/utils';

interface Props {
  patientId: string;
  className?: string;
}

export function VitalSignsChart({ patientId, className }: Props) {
  const { data: vitals, loading, error } = useVitalSigns(patientId);

  if (loading) {
    return (
      <div className={cn("bg-card rounded-xl p-6 border border-border animate-pulse", className)}>
        <div className="h-5 bg-muted rounded w-32 mb-4" />
        <div className="h-48 bg-muted rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("bg-error/10 rounded-xl p-6 border border-error/30", className)}>
        <p className="text-error">{error}</p>
      </div>
    );
  }

  // Group vitals by type and get trends
  const vitalTypes = ['blood-pressure', 'heart-rate', 'temperature', 'respiratory-rate', 'oxygen-saturation'];

  return (
    <div className={cn("bg-card rounded-xl p-6 border border-border", className)}>
      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Vital Signs Trends
      </h3>
      <div className="h-48 flex items-center justify-center bg-muted/30 rounded-lg">
        <p className="text-muted-foreground">Chart visualization would go here</p>
      </div>
      {vitals && vitals.length > 0 && (
        <p className="text-sm text-muted-foreground mt-4">{vitals.length} readings available</p>
      )}
    </div>
  );
}

export default VitalSignsChart;
`;
}

function getBloodPressureDisplayComponent(): string {
  return `'use client';

import { useVitalSigns } from '@/lib/epic-fhir';
import { cn } from '@/lib/utils';

interface Props {
  patientId: string;
  className?: string;
}

export function BloodPressureDisplay({ patientId, className }: Props) {
  const { data: vitals, loading, error } = useVitalSigns(patientId);

  // Extract latest BP reading
  const latestBP = vitals?.find(v =>
    v.code?.coding?.[0]?.code === '85354-9' ||
    v.code?.text?.toLowerCase().includes('blood pressure')
  );

  const systolic = latestBP?.component?.find(c => c.code?.coding?.[0]?.code === '8480-6')?.valueQuantity?.value;
  const diastolic = latestBP?.component?.find(c => c.code?.coding?.[0]?.code === '8462-4')?.valueQuantity?.value;

  const getBPStatus = (sys: number, dia: number) => {
    if (sys < 120 && dia < 80) return { label: 'Normal', color: 'text-green-500', bg: 'bg-green-500/10' };
    if (sys < 130 && dia < 80) return { label: 'Elevated', color: 'text-yellow-500', bg: 'bg-yellow-500/10' };
    if (sys < 140 || dia < 90) return { label: 'High Stage 1', color: 'text-orange-500', bg: 'bg-orange-500/10' };
    return { label: 'High Stage 2', color: 'text-red-500', bg: 'bg-red-500/10' };
  };

  if (loading) {
    return (
      <div className={cn("bg-card rounded-xl p-6 border border-border animate-pulse", className)}>
        <div className="h-5 bg-muted rounded w-32 mb-4" />
        <div className="h-16 bg-muted rounded" />
      </div>
    );
  }

  const status = systolic && diastolic ? getBPStatus(systolic, diastolic) : null;

  return (
    <div className={cn("bg-card rounded-xl p-6 border border-border", className)}>
      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        Blood Pressure
      </h3>
      {systolic && diastolic ? (
        <div className="flex items-center gap-4">
          <div className="text-3xl font-bold text-foreground">
            {systolic}/{diastolic}
            <span className="text-sm font-normal text-muted-foreground ml-1">mmHg</span>
          </div>
          {status && (
            <span className={cn("px-3 py-1 rounded-full text-sm font-medium", status.bg, status.color)}>
              {status.label}
            </span>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground">No blood pressure data available</p>
      )}
    </div>
  );
}

export default BloodPressureDisplay;
`;
}

function getLabResultsPanelComponent(): string {
  return `'use client';

import { useLabResults } from '@/lib/epic-fhir';
import { cn } from '@/lib/utils';

interface Props {
  patientId: string;
  className?: string;
}

export function LabResultsPanel({ patientId, className }: Props) {
  const { data: labs, loading, error } = useLabResults(patientId);

  if (loading) {
    return (
      <div className={cn("bg-card rounded-xl p-6 border border-border animate-pulse", className)}>
        <div className="h-5 bg-muted rounded w-32 mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("bg-error/10 rounded-xl p-6 border border-error/30", className)}>
        <p className="text-error">{error}</p>
      </div>
    );
  }

  return (
    <div className={cn("bg-card rounded-xl p-6 border border-border", className)}>
      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
        Lab Results
      </h3>
      {labs && labs.length > 0 ? (
        <div className="space-y-3">
          {labs.slice(0, 10).map((lab, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <p className="font-medium text-foreground">{lab.code?.text || 'Unknown Test'}</p>
                <p className="text-xs text-muted-foreground">
                  {lab.effectiveDateTime ? new Date(lab.effectiveDateTime).toLocaleDateString() : 'Unknown date'}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-foreground">
                  {lab.valueQuantity?.value} {lab.valueQuantity?.unit}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No lab results available</p>
      )}
    </div>
  );
}

export default LabResultsPanel;
`;
}

function getConditionsListComponent(): string {
  return `'use client';

import { useConditions } from '@/lib/epic-fhir';
import { cn } from '@/lib/utils';

interface Props {
  patientId: string;
  className?: string;
}

export function ConditionsList({ patientId, className }: Props) {
  const { data: conditions, loading, error } = useConditions(patientId);

  if (loading) {
    return (
      <div className={cn("bg-card rounded-xl p-6 border border-border animate-pulse", className)}>
        <div className="h-5 bg-muted rounded w-32 mb-4" />
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("bg-error/10 rounded-xl p-6 border border-error/30", className)}>
        <p className="text-error">{error}</p>
      </div>
    );
  }

  return (
    <div className={cn("bg-card rounded-xl p-6 border border-border", className)}>
      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        Problem List
      </h3>
      {conditions && conditions.length > 0 ? (
        <ul className="space-y-2">
          {conditions.map((condition, i) => (
            <li key={i} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
              <span className={cn(
                "w-2 h-2 rounded-full mt-2",
                condition.clinicalStatus?.coding?.[0]?.code === 'active' ? 'bg-yellow-500' : 'bg-gray-400'
              )} />
              <div>
                <p className="font-medium text-foreground">
                  {condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown condition'}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {condition.clinicalStatus?.coding?.[0]?.code || 'unknown status'}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">No conditions recorded</p>
      )}
    </div>
  );
}

export default ConditionsList;
`;
}

function getProcedureHistoryComponent(): string {
  return `'use client';

import { useProcedures } from '@/lib/epic-fhir';
import { cn } from '@/lib/utils';

interface Props {
  patientId: string;
  className?: string;
}

export function ProcedureHistory({ patientId, className }: Props) {
  const { data: procedures, loading, error } = useProcedures(patientId);

  if (loading) {
    return (
      <div className={cn("bg-card rounded-xl p-6 border border-border animate-pulse", className)}>
        <div className="h-5 bg-muted rounded w-40 mb-4" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("bg-error/10 rounded-xl p-6 border border-error/30", className)}>
        <p className="text-error">{error}</p>
      </div>
    );
  }

  return (
    <div className={cn("bg-card rounded-xl p-6 border border-border", className)}>
      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        Procedure History
      </h3>
      {procedures && procedures.length > 0 ? (
        <div className="space-y-3">
          {procedures.map((procedure, i) => (
            <div key={i} className="py-3 border-b border-border last:border-0">
              <p className="font-medium text-foreground">
                {procedure.code?.text || procedure.code?.coding?.[0]?.display || 'Unknown procedure'}
              </p>
              <p className="text-sm text-muted-foreground">
                {procedure.performedDateTime ? new Date(procedure.performedDateTime).toLocaleDateString() : 'Date unknown'}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No procedures recorded</p>
      )}
    </div>
  );
}

export default ProcedureHistory;
`;
}

function getImmunizationTimelineComponent(): string {
  return `'use client';

import { useImmunizations } from '@/lib/epic-fhir';
import { cn } from '@/lib/utils';

interface Props {
  patientId: string;
  className?: string;
}

export function ImmunizationTimeline({ patientId, className }: Props) {
  const { data: immunizations, loading, error } = useImmunizations(patientId);

  if (loading) {
    return (
      <div className={cn("bg-card rounded-xl p-6 border border-border animate-pulse", className)}>
        <div className="h-5 bg-muted rounded w-40 mb-4" />
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="w-3 h-3 bg-muted rounded-full mt-1" />
              <div className="flex-1">
                <div className="h-4 bg-muted rounded w-48 mb-1" />
                <div className="h-3 bg-muted rounded w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("bg-error/10 rounded-xl p-6 border border-error/30", className)}>
        <p className="text-error">{error}</p>
      </div>
    );
  }

  return (
    <div className={cn("bg-card rounded-xl p-6 border border-border", className)}>
      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        Immunization History
      </h3>
      {immunizations && immunizations.length > 0 ? (
        <div className="relative pl-6 border-l-2 border-border space-y-4">
          {immunizations.map((imm, i) => (
            <div key={i} className="relative">
              <div className="absolute -left-[25px] w-3 h-3 bg-teal-500 rounded-full border-2 border-card" />
              <p className="font-medium text-foreground">
                {imm.vaccineCode?.text || imm.vaccineCode?.coding?.[0]?.display || 'Unknown vaccine'}
              </p>
              <p className="text-sm text-muted-foreground">
                {imm.occurrenceDateTime ? new Date(imm.occurrenceDateTime).toLocaleDateString() : 'Date unknown'}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No immunizations recorded</p>
      )}
    </div>
  );
}

export default ImmunizationTimeline;
`;
}

// =============================================================================
// MEDICATION COMPONENTS
// =============================================================================

function getMedicationCardComponent(): string {
  return `'use client';

import { cn } from '@/lib/utils';

interface Props {
  medication: {
    name: string;
    dosage?: string;
    frequency?: string;
    status?: string;
    prescriber?: string;
  };
  className?: string;
}

export function MedicationCard({ medication, className }: Props) {
  return (
    <div className={cn("bg-card rounded-lg p-4 border border-border", className)}>
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-medium text-foreground">{medication.name}</h4>
          {medication.dosage && (
            <p className="text-sm text-muted-foreground">{medication.dosage}</p>
          )}
          {medication.frequency && (
            <p className="text-xs text-muted-foreground mt-1">{medication.frequency}</p>
          )}
        </div>
        {medication.status && (
          <span className={cn(
            "px-2 py-1 text-xs rounded-full",
            medication.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'
          )}>
            {medication.status}
          </span>
        )}
      </div>
    </div>
  );
}

export default MedicationCard;
`;
}

function getAllergyCardComponent(): string {
  return `'use client';

import { cn } from '@/lib/utils';

interface Props {
  allergy: {
    substance: string;
    reaction?: string;
    severity?: string;
    type?: string;
  };
  className?: string;
}

export function AllergyCard({ allergy, className }: Props) {
  const severityColors = {
    severe: 'bg-red-500/10 text-red-500 border-red-500/30',
    moderate: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
    mild: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  };

  const severityClass = allergy.severity
    ? severityColors[allergy.severity.toLowerCase() as keyof typeof severityColors] || 'bg-gray-500/10 text-gray-500'
    : 'bg-gray-500/10 text-gray-500';

  return (
    <div className={cn("rounded-lg p-4 border", severityClass, className)}>
      <div className="flex items-start gap-3">
        <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div>
          <h4 className="font-medium">{allergy.substance}</h4>
          {allergy.reaction && (
            <p className="text-sm opacity-80">Reaction: {allergy.reaction}</p>
          )}
          {allergy.type && (
            <p className="text-xs opacity-60 mt-1 capitalize">{allergy.type} allergy</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default AllergyCard;
`;
}

// =============================================================================
// SCHEDULING COMPONENTS
// =============================================================================

function getAppointmentCalendarComponent(): string {
  return `'use client';

import { useAppointments } from '@/lib/epic-fhir';
import { cn } from '@/lib/utils';

interface Props {
  patientId: string;
  className?: string;
}

export function AppointmentCalendar({ patientId, className }: Props) {
  const { data: appointments, loading, error } = useAppointments(patientId);

  if (loading) {
    return (
      <div className={cn("bg-card rounded-xl p-6 border border-border animate-pulse", className)}>
        <div className="h-5 bg-muted rounded w-32 mb-4" />
        <div className="h-64 bg-muted rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("bg-error/10 rounded-xl p-6 border border-error/30", className)}>
        <p className="text-error">{error}</p>
      </div>
    );
  }

  return (
    <div className={cn("bg-card rounded-xl p-6 border border-border", className)}>
      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Appointments
      </h3>
      {appointments && appointments.length > 0 ? (
        <div className="space-y-3">
          {appointments.map((apt, i) => (
            <div key={i} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
              <div className="w-12 h-12 bg-cyan-500/10 rounded-lg flex flex-col items-center justify-center">
                <span className="text-xs text-cyan-500">
                  {apt.start ? new Date(apt.start).toLocaleDateString('en-US', { month: 'short' }) : ''}
                </span>
                <span className="text-lg font-bold text-cyan-500">
                  {apt.start ? new Date(apt.start).getDate() : '?'}
                </span>
              </div>
              <div>
                <p className="font-medium text-foreground">{apt.description || 'Appointment'}</p>
                <p className="text-sm text-muted-foreground">
                  {apt.start ? new Date(apt.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'Time TBD'}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No upcoming appointments</p>
      )}
    </div>
  );
}

export default AppointmentCalendar;
`;
}

function getAppointmentCardComponent(): string {
  return `'use client';

import { cn } from '@/lib/utils';

interface Props {
  appointment: {
    date: string;
    time?: string;
    description?: string;
    provider?: string;
    location?: string;
    status?: string;
  };
  className?: string;
}

export function AppointmentCard({ appointment, className }: Props) {
  const statusColors = {
    booked: 'bg-blue-500/10 text-blue-500',
    arrived: 'bg-green-500/10 text-green-500',
    cancelled: 'bg-red-500/10 text-red-500',
    completed: 'bg-gray-500/10 text-gray-500',
  };

  return (
    <div className={cn("bg-card rounded-lg p-4 border border-border", className)}>
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 bg-primary/10 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
          <span className="text-xs text-primary">
            {new Date(appointment.date).toLocaleDateString('en-US', { month: 'short' })}
          </span>
          <span className="text-xl font-bold text-primary">
            {new Date(appointment.date).getDate()}
          </span>
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-foreground">{appointment.description || 'Appointment'}</h4>
          {appointment.time && (
            <p className="text-sm text-muted-foreground">{appointment.time}</p>
          )}
          {appointment.provider && (
            <p className="text-sm text-muted-foreground">with {appointment.provider}</p>
          )}
          {appointment.location && (
            <p className="text-xs text-muted-foreground mt-1">{appointment.location}</p>
          )}
        </div>
        {appointment.status && (
          <span className={cn(
            "px-2 py-1 text-xs rounded-full capitalize",
            statusColors[appointment.status.toLowerCase() as keyof typeof statusColors] || 'bg-gray-500/10 text-gray-500'
          )}>
            {appointment.status}
          </span>
        )}
      </div>
    </div>
  );
}

export default AppointmentCard;
`;
}

function getEncounterHistoryComponent(): string {
  return `'use client';

import { useEncounters } from '@/lib/epic-fhir';
import { cn } from '@/lib/utils';

interface Props {
  patientId: string;
  className?: string;
}

export function EncounterHistory({ patientId, className }: Props) {
  const { data: encounters, loading, error } = useEncounters(patientId);

  if (loading) {
    return (
      <div className={cn("bg-card rounded-xl p-6 border border-border animate-pulse", className)}>
        <div className="h-5 bg-muted rounded w-40 mb-4" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("bg-error/10 rounded-xl p-6 border border-error/30", className)}>
        <p className="text-error">{error}</p>
      </div>
    );
  }

  return (
    <div className={cn("bg-card rounded-xl p-6 border border-border", className)}>
      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Visit History
      </h3>
      {encounters && encounters.length > 0 ? (
        <div className="space-y-3">
          {encounters.map((encounter, i) => (
            <div key={i} className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <p className="font-medium text-foreground">
                  {encounter.type?.[0]?.text || encounter.class?.display || 'Visit'}
                </p>
                <span className="text-sm text-muted-foreground">
                  {encounter.period?.start ? new Date(encounter.period.start).toLocaleDateString() : 'Date unknown'}
                </span>
              </div>
              {encounter.reasonCode?.[0]?.text && (
                <p className="text-sm text-muted-foreground mt-1">
                  Reason: {encounter.reasonCode[0].text}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No visit history available</p>
      )}
    </div>
  );
}

export default EncounterHistory;
`;
}

// =============================================================================
// DOCUMENT COMPONENTS
// =============================================================================

function getDocumentListComponent(): string {
  return `'use client';

import { useDocuments } from '@/lib/epic-fhir';
import { cn } from '@/lib/utils';

interface Props {
  patientId: string;
  onSelectDocument?: (documentId: string) => void;
  className?: string;
}

export function DocumentList({ patientId, onSelectDocument, className }: Props) {
  const { data: documents, loading, error } = useDocuments(patientId);

  if (loading) {
    return (
      <div className={cn("bg-card rounded-xl p-6 border border-border animate-pulse", className)}>
        <div className="h-5 bg-muted rounded w-32 mb-4" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("bg-error/10 rounded-xl p-6 border border-error/30", className)}>
        <p className="text-error">{error}</p>
      </div>
    );
  }

  return (
    <div className={cn("bg-card rounded-xl p-6 border border-border", className)}>
      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Documents
      </h3>
      {documents && documents.length > 0 ? (
        <div className="space-y-2">
          {documents.map((doc, i) => (
            <button
              key={i}
              onClick={() => onSelectDocument?.(doc.id || '')}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 rounded-lg transition-colors"
            >
              <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">
                  {doc.type?.text || doc.description || 'Document'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {doc.date ? new Date(doc.date).toLocaleDateString() : 'Unknown date'}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No documents available</p>
      )}
    </div>
  );
}

export default DocumentList;
`;
}

function getDocumentViewerComponent(): string {
  return `'use client';

import { cn } from '@/lib/utils';

interface Props {
  documentId: string | null;
  className?: string;
}

export function DocumentViewer({ documentId, className }: Props) {
  if (!documentId) {
    return (
      <div className={cn("bg-card rounded-xl p-6 border border-border h-full flex items-center justify-center", className)}>
        <div className="text-center">
          <svg className="w-12 h-12 text-muted-foreground mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-muted-foreground">Select a document to view</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-card rounded-xl p-6 border border-border", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Document Viewer</h3>
        <button className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
          Download
        </button>
      </div>
      <div className="bg-muted/30 rounded-lg p-8 min-h-[400px] flex items-center justify-center">
        <p className="text-muted-foreground">Document content would display here</p>
      </div>
    </div>
  );
}

export default DocumentViewer;
`;
}

// =============================================================================
// CARE COMPONENTS
// =============================================================================

function getCarePlanDisplayComponent(): string {
  return `'use client';

import { useCarePlans } from '@/lib/epic-fhir';
import { cn } from '@/lib/utils';

interface Props {
  patientId: string;
  className?: string;
}

export function CarePlanDisplay({ patientId, className }: Props) {
  const { data: carePlans, loading, error } = useCarePlans(patientId);

  if (loading) {
    return (
      <div className={cn("bg-card rounded-xl p-6 border border-border animate-pulse", className)}>
        <div className="h-5 bg-muted rounded w-32 mb-4" />
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("bg-error/10 rounded-xl p-6 border border-error/30", className)}>
        <p className="text-error">{error}</p>
      </div>
    );
  }

  return (
    <div className={cn("bg-card rounded-xl p-6 border border-border", className)}>
      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
        Care Plans
      </h3>
      {carePlans && carePlans.length > 0 ? (
        <div className="space-y-4">
          {carePlans.map((plan, i) => (
            <div key={i} className="p-4 bg-pink-500/5 rounded-lg border border-pink-500/20">
              <h4 className="font-medium text-foreground">{plan.title || 'Care Plan'}</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Status: <span className="capitalize">{plan.status}</span>
              </p>
              {plan.description && (
                <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No active care plans</p>
      )}
    </div>
  );
}

export default CarePlanDisplay;
`;
}

function getGoalTrackerComponent(): string {
  return `'use client';

import { useGoals } from '@/lib/epic-fhir';
import { cn } from '@/lib/utils';

interface Props {
  patientId: string;
  className?: string;
}

export function GoalTracker({ patientId, className }: Props) {
  const { data: goals, loading, error } = useGoals(patientId);

  if (loading) {
    return (
      <div className={cn("bg-card rounded-xl p-6 border border-border animate-pulse", className)}>
        <div className="h-5 bg-muted rounded w-28 mb-4" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("bg-error/10 rounded-xl p-6 border border-error/30", className)}>
        <p className="text-error">{error}</p>
      </div>
    );
  }

  return (
    <div className={cn("bg-card rounded-xl p-6 border border-border", className)}>
      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Health Goals
      </h3>
      {goals && goals.length > 0 ? (
        <div className="space-y-3">
          {goals.map((goal, i) => (
            <div key={i} className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-start justify-between">
                <p className="font-medium text-foreground">
                  {goal.description?.text || 'Health Goal'}
                </p>
                <span className={cn(
                  "px-2 py-0.5 text-xs rounded-full capitalize",
                  goal.lifecycleStatus === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'
                )}>
                  {goal.lifecycleStatus}
                </span>
              </div>
              {goal.target?.[0]?.detailString && (
                <p className="text-sm text-muted-foreground mt-1">
                  Target: {goal.target[0].detailString}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No health goals set</p>
      )}
    </div>
  );
}

export default GoalTracker;
`;
}

function getCareTeamListComponent(): string {
  return `'use client';

import { useCareTeam } from '@/lib/epic-fhir';
import { cn } from '@/lib/utils';

interface Props {
  patientId: string;
  className?: string;
}

export function CareTeamList({ patientId, className }: Props) {
  const { data: careTeam, loading, error } = useCareTeam(patientId);

  if (loading) {
    return (
      <div className={cn("bg-card rounded-xl p-6 border border-border animate-pulse", className)}>
        <div className="h-5 bg-muted rounded w-28 mb-4" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 bg-muted rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-muted rounded w-32 mb-1" />
                <div className="h-3 bg-muted rounded w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("bg-error/10 rounded-xl p-6 border border-error/30", className)}>
        <p className="text-error">{error}</p>
      </div>
    );
  }

  const members = careTeam?.[0]?.participant || [];

  return (
    <div className={cn("bg-card rounded-xl p-6 border border-border", className)}>
      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        Care Team
      </h3>
      {members.length > 0 ? (
        <div className="space-y-3">
          {members.map((member: any, i: number) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {member.member?.display || 'Team Member'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {member.role?.[0]?.text || member.role?.[0]?.coding?.[0]?.display || 'Care Team'}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No care team members listed</p>
      )}
    </div>
  );
}

export default CareTeamList;
`;
}

// =============================================================================
// EXISTING COMPONENT GENERATORS (keeping for backward compatibility)
// =============================================================================

function getPatientCardComponent(): string {
  return `'use client';

import { formatPatientName, calculateAge, type Patient } from '@/lib/epic-fhir';
import { cn } from '@/lib/utils';

interface Props {
  patient: Patient | null;
  loading?: boolean;
  error?: string | null;
}

export function PatientCard({ patient, loading, error }: Props) {
  if (loading) {
    return (
      <div className="bg-card rounded-xl p-6 shadow-sm border border-border animate-pulse">
        <div className="h-6 bg-muted rounded w-1/2 mb-4"></div>
        <div className="h-4 bg-muted rounded w-1/3"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-error/10 rounded-xl p-6 border border-error/30">
        <p className="text-error">{error}</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="bg-card rounded-xl p-6 shadow-sm border border-border text-center">
        <p className="text-muted-foreground">No patient selected</p>
      </div>
    );
  }

  const name = formatPatientName(patient);
  const age = patient.birthDate ? calculateAge(patient.birthDate) : null;

  return (
    <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
          {name.charAt(0)}
        </div>
        <div>
          <h3 className="text-xl font-semibold text-foreground">{name}</h3>
          <div className="flex gap-2 mt-1">
            {patient.gender && (
              <span className={cn(
                "px-2 py-0.5 rounded text-xs font-medium",
                patient.gender === 'male' ? "bg-secondary/20 text-secondary" : "bg-primary/20 text-primary"
              )}>
                {patient.gender}
              </span>
            )}
            {age && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                {age} years old
              </span>
            )}
          </div>
          {patient.birthDate && (
            <p className="text-sm text-muted-foreground mt-2">DOB: {patient.birthDate}</p>
          )}
        </div>
      </div>
    </div>
  );
}
`;
}

function getVitalSignsComponent(): string {
  return `'use client';

import type { Observation } from '@/lib/epic-fhir';

interface Props {
  vitals: Observation[];
  loading?: boolean;
  error?: string | null;
}

const VITAL_ICONS: Record<string, string> = {
  'heart': '❤️',
  'respiratory': '🌬️',
  'temperature': '🌡️',
  'blood pressure': '💓',
  'oxygen': '💨',
  'weight': '⚖️',
  'height': '📏',
};

function getIcon(display: string): string {
  const lower = display.toLowerCase();
  for (const [key, icon] of Object.entries(VITAL_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return '📊';
}

function getValue(obs: Observation): string {
  if (obs.valueQuantity) {
    return \`\${obs.valueQuantity.value} \${obs.valueQuantity.unit || ''}\`.trim();
  }
  if (obs.valueString) return obs.valueString;
  if (obs.component) {
    const systolic = obs.component.find(c => c.code.coding?.[0]?.code === '8480-6');
    const diastolic = obs.component.find(c => c.code.coding?.[0]?.code === '8462-4');
    if (systolic?.valueQuantity && diastolic?.valueQuantity) {
      return \`\${systolic.valueQuantity.value}/\${diastolic.valueQuantity.value} mmHg\`;
    }
  }
  return 'N/A';
}

export function VitalSignsCard({ vitals, loading, error }: Props) {
  if (loading) {
    return <div className="bg-card rounded-xl p-6 shadow-sm border border-border animate-pulse h-32"></div>;
  }

  if (error) {
    return <div className="bg-error/10 rounded-xl p-4 text-error text-sm">{error}</div>;
  }

  const uniqueVitals = vitals.reduce((acc, v) => {
    const name = v.code.text || v.code.coding?.[0]?.display || 'Unknown';
    if (!acc.find(x => (x.code.text || x.code.coding?.[0]?.display) === name)) {
      acc.push(v);
    }
    return acc;
  }, [] as Observation[]);

  return (
    <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <span>📊</span> Vital Signs
      </h3>
      {uniqueVitals.length === 0 ? (
        <p className="text-muted-foreground text-sm">No vital signs recorded</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {uniqueVitals.slice(0, 6).map((v, i) => {
            const name = v.code.text || v.code.coding?.[0]?.display || 'Unknown';
            return (
              <div key={i} className="bg-muted rounded-lg p-3">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <span>{getIcon(name)}</span>
                  <span className="truncate">{name}</span>
                </div>
                <p className="font-semibold text-foreground">{getValue(v)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
`;
}

function getMedicationsListComponent(): string {
  return `'use client';

import type { MedicationRequest } from '@/lib/epic-fhir';

interface Props {
  medications: MedicationRequest[];
  loading?: boolean;
  error?: string | null;
}

export function MedicationsList({ medications, loading, error }: Props) {
  if (loading) {
    return <div className="bg-card rounded-xl p-6 shadow-sm border border-border animate-pulse h-48"></div>;
  }

  if (error) {
    return <div className="bg-error/10 rounded-xl p-4 text-error text-sm">{error}</div>;
  }

  return (
    <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <span>💊</span> Medications
        <span className="ml-auto bg-secondary/20 text-secondary text-xs px-2 py-0.5 rounded-full">
          {medications.length}
        </span>
      </h3>
      {medications.length === 0 ? (
        <p className="text-muted-foreground text-sm">No medications on record</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {medications.map((med, i) => {
            const name = med.medicationReference?.display ||
              med.medicationCodeableConcept?.text ||
              med.medicationCodeableConcept?.coding?.[0]?.display ||
              'Unknown Medication';
            const dosage = med.dosageInstruction?.[0]?.text;
            return (
              <div key={i} className="p-3 bg-muted rounded-lg">
                <p className="font-medium text-sm text-foreground">{name}</p>
                {dosage && <p className="text-xs text-muted-foreground mt-1">{dosage}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
`;
}

function getAllergiesListComponent(): string {
  return `'use client';

import type { AllergyIntolerance } from '@/lib/epic-fhir';
import { cn } from '@/lib/utils';

interface Props {
  allergies: AllergyIntolerance[];
  loading?: boolean;
  error?: string | null;
}

export function AllergiesList({ allergies, loading, error }: Props) {
  if (loading) {
    return <div className="bg-card rounded-xl p-6 shadow-sm border border-border animate-pulse h-48"></div>;
  }

  if (error) {
    return <div className="bg-error/10 rounded-xl p-4 text-error text-sm">{error}</div>;
  }

  return (
    <div className="bg-card rounded-xl p-6 shadow-sm border border-border">
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <span>⚠️</span> Allergies
        <span className="ml-auto bg-warning/20 text-warning text-xs px-2 py-0.5 rounded-full">
          {allergies.length}
        </span>
      </h3>
      {allergies.length === 0 ? (
        <p className="text-muted-foreground text-sm">No known allergies</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {allergies.map((allergy, i) => {
            const name = allergy.code?.text || allergy.code?.coding?.[0]?.display || 'Unknown Allergen';
            const isHighRisk = allergy.criticality === 'high';
            return (
              <div key={i} className={cn(
                "p-3 rounded-lg",
                isHighRisk ? "bg-error/10 border border-error/30" : "bg-muted"
              )}>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm text-foreground">{name}</p>
                  {isHighRisk && <span className="text-error">⚠️</span>}
                </div>
                {allergy.category && (
                  <div className="flex gap-1 mt-1">
                    {allergy.category.map((cat, j) => (
                      <span key={j} className="text-xs px-1.5 py-0.5 bg-border/50 text-foreground rounded">{cat}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
`;
}

function getEpicComponentsIndex(): string {
  return `export { PatientCard } from './PatientCard';
export { VitalSignsCard } from './VitalSignsCard';
export { MedicationsList } from './MedicationsList';
export { AllergiesList } from './AllergiesList';
`;
}

function getEpicApiRoute(): string {
  return `import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering - this API proxies to main platform
export const dynamic = 'force-dynamic';

// Proxy to main platform's Epic API
const MAIN_PLATFORM_URL = process.env.MAIN_PLATFORM_URL || 'http://localhost:3000';

export async function GET() {
  try {
    console.log('[Epic API] Checking connection to:', MAIN_PLATFORM_URL);
    const res = await fetch(\`\${MAIN_PLATFORM_URL}/api/epic\`);

    if (!res.ok) {
      console.log('[Epic API] Main platform returned error:', res.status);
      return NextResponse.json({
        connected: false,
        error: \`Main platform returned \${res.status}\`,
        hint: 'Make sure the main AI Dev Platform is running on port 3000'
      });
    }

    const data = await res.json();
    console.log('[Epic API] Connection check result:', data);
    return NextResponse.json(data);
  } catch (e: any) {
    console.error('[Epic API] Connection failed:', e.message);
    return NextResponse.json({
      connected: false,
      error: e.message,
      hint: 'Make sure the main AI Dev Platform is running on http://localhost:3000'
    });
  }
}
`;
}

function getEpicFhirProxyRoute(): string {
  return `import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering - this API proxies to main platform
export const dynamic = 'force-dynamic';

// Proxy to main platform's Epic FHIR API (which has the token)
const MAIN_PLATFORM_URL = process.env.MAIN_PLATFORM_URL || 'http://localhost:3000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const fhirPath = path.join('/');
    const searchParams = request.nextUrl.searchParams.toString();
    const url = searchParams
      ? \`\${MAIN_PLATFORM_URL}/api/epic/fhir/\${fhirPath}?\${searchParams}\`
      : \`\${MAIN_PLATFORM_URL}/api/epic/fhir/\${fhirPath}\`;

    console.log('[Epic FHIR Proxy] Fetching:', url);

    const response = await fetch(url);

    if (!response.ok) {
      console.log('[Epic FHIR Proxy] Error:', response.status);
      const errorData = await response.json().catch(() => ({
        error: \`Request failed with status \${response.status}\`,
        hint: 'Make sure the main AI Dev Platform is running on port 3000'
      }));
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    console.log('[Epic FHIR Proxy] Success, returning data');
    return NextResponse.json(data);
  } catch (e: any) {
    console.error('[Epic FHIR Proxy] Error:', e.message);
    return NextResponse.json({
      error: e.message,
      hint: 'Make sure the main AI Dev Platform is running on http://localhost:3000'
    }, { status: 500 });
  }
}
`;
}

function getEpicDashboardPage(): string {
  return `'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePatient, useVitalSigns, useMedications, useAllergies, useConditions } from '@/lib/epic-fhir';

const SANDBOX_PATIENTS = [
  { name: 'Camila Lopez', id: 'erXuFYUfucBZaryVksYEcMg3', subtitle: 'Full clinical data' },
  { name: 'Theodore Mychart', id: 'e63wRTbPfr1p8UW81d8Seiw3', subtitle: 'MyChart patient' },
  { name: 'Derrick Lin', id: 'eq081-VQEgP8drUUqCWzHfw3', subtitle: 'Basic demographics' },
];

function getMedName(med: any): string {
  return med?.medicationCodeableConcept?.text || med?.medicationCodeableConcept?.coding?.[0]?.display || med?.medicationReference?.display || 'Unknown';
}

function getAllergyName(allergy: any): string {
  return allergy?.code?.text || allergy?.code?.coding?.[0]?.display || 'Unknown Allergen';
}

function getConditionName(condition: any): string {
  return condition?.code?.text || condition?.code?.coding?.[0]?.display || 'Unknown Condition';
}

function getVitalValue(obs: any): string {
  if (obs?.valueQuantity) return \`\${obs.valueQuantity.value} \${obs.valueQuantity.unit || ''}\`;
  if (obs?.component) {
    return obs.component.map((c: any) => \`\${c.valueQuantity?.value || '?'}\`).join('/');
  }
  return obs?.valueString || '—';
}

function getVitalName(obs: any): string {
  return obs?.code?.text || obs?.code?.coding?.[0]?.display || 'Unknown';
}

export default function PatientDashboard() {
  const [patientId, setPatientId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeSection, setActiveSection] = useState<'overview' | 'vitals' | 'meds' | 'allergies' | 'conditions'>('overview');

  const patient = usePatient(isConnected ? patientId : null);
  const vitals = useVitalSigns(isConnected ? patientId : null);
  const medications = useMedications(isConnected ? patientId : null);
  const allergies = useAllergies(isConnected ? patientId : null);
  const conditions = useConditions(isConnected ? patientId : null);

  useEffect(() => {
    fetch('/api/epic').then(r => r.json()).then(data => setIsConnected(data.connected)).catch(() => {});
  }, []);

  const stats = useMemo(() => ({
    vitalsCount: vitals.data?.length || 0,
    medsCount: medications.data?.length || 0,
    allergiesCount: allergies.data?.length || 0,
    conditionsCount: conditions.data?.length || 0,
  }), [vitals.data, medications.data, allergies.data, conditions.data]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Patient Dashboard</h1>
                <p className="text-sm text-slate-500">Epic FHIR Clinical View</p>
              </div>
            </div>
            <span className={\`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium \${isConnected ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20'}\`}>
              <span className={\`w-2 h-2 rounded-full \${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}\`}></span>
              {isConnected ? 'Epic Connected' : 'Not Connected'}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Patient Selection */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-3">Select Patient</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {SANDBOX_PATIENTS.map((p) => (
              <button key={p.id} onClick={() => setPatientId(p.id)} disabled={!isConnected}
                className={\`relative p-4 rounded-xl border-2 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed \${patientId === p.id ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20' : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'}\`}>
                <div className="flex items-center gap-3">
                  <div className={\`w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold \${patientId === p.id ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'}\`}>
                    {p.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div className={\`font-semibold \${patientId === p.id ? 'text-blue-900' : 'text-slate-900'}\`}>{p.name}</div>
                    <div className="text-sm text-slate-500">{p.subtitle}</div>
                  </div>
                </div>
                {patientId === p.id && <div className="absolute top-2 right-2"><svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg></div>}
              </button>
            ))}
          </div>
        </section>

        {patientId && patient.data && (
          <div className="grid lg:grid-cols-4 gap-6">
            {/* Sidebar */}
            <aside className="lg:col-span-1">
              {/* Patient Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
                <div className="text-center">
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-2xl font-bold text-blue-700 mx-auto mb-3">
                    {patient.data.displayName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">{patient.data.displayName}</h2>
                  <p className="text-sm text-slate-500 mt-1">{patient.data.gender ? patient.data.gender.charAt(0).toUpperCase() + patient.data.gender.slice(1) : ''}{patient.data.age !== null ? \`, \${patient.data.age} years\` : ''}</p>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">DOB</span><span className="text-slate-900 font-medium">{patient.data.birthDate ? new Date(patient.data.birthDate).toLocaleDateString() : '—'}</span></div>
                  {patient.data.identifier?.[0]?.value && <div className="flex justify-between"><span className="text-slate-500">MRN</span><span className="text-slate-900 font-medium">{patient.data.identifier[0].value}</span></div>}
                </div>
              </div>

              {/* Navigation */}
              <nav className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {[
                  { id: 'overview', label: 'Overview', icon: '📊' },
                  { id: 'vitals', label: \`Vitals (\${stats.vitalsCount})\`, icon: '❤️' },
                  { id: 'meds', label: \`Medications (\${stats.medsCount})\`, icon: '💊' },
                  { id: 'allergies', label: \`Allergies (\${stats.allergiesCount})\`, icon: '⚠️' },
                  { id: 'conditions', label: \`Conditions (\${stats.conditionsCount})\`, icon: '🩺' },
                ].map((item) => (
                  <button key={item.id} onClick={() => setActiveSection(item.id as any)}
                    className={\`w-full px-4 py-3 text-left text-sm font-medium flex items-center gap-2 transition-colors \${activeSection === item.id ? 'bg-blue-50 text-blue-700 border-l-2 border-blue-500' : 'text-slate-600 hover:bg-slate-50'}\`}>
                    <span>{item.icon}</span> {item.label}
                  </button>
                ))}
              </nav>
            </aside>

            {/* Main Content */}
            <main className="lg:col-span-3 space-y-6">
              {/* Stats Row */}
              {activeSection === 'overview' && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center text-lg">❤️</div>
                        <div><div className="text-2xl font-bold text-slate-900">{stats.vitalsCount}</div><div className="text-sm text-slate-500">Vitals</div></div>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-lg">💊</div>
                        <div><div className="text-2xl font-bold text-slate-900">{stats.medsCount}</div><div className="text-sm text-slate-500">Medications</div></div>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center text-lg">⚠️</div>
                        <div><div className="text-2xl font-bold text-slate-900">{stats.allergiesCount}</div><div className="text-sm text-slate-500">Allergies</div></div>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-lg">🩺</div>
                        <div><div className="text-2xl font-bold text-slate-900">{stats.conditionsCount}</div><div className="text-sm text-slate-500">Conditions</div></div>
                      </div>
                    </div>
                  </div>

                  {/* Quick View Sections */}
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Recent Vitals */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                      <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><span>❤️</span> Latest Vitals</h3>
                      {vitals.loading ? <div className="animate-pulse space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-slate-100 rounded"></div>)}</div> :
                       vitals.data?.slice(0, 4).map((v: any, i: number) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                          <span className="text-sm text-slate-600">{getVitalName(v)}</span>
                          <span className="font-medium text-slate-900">{getVitalValue(v)}</span>
                        </div>
                      ))}
                      {vitals.data?.length === 0 && <p className="text-sm text-slate-500">No vitals recorded</p>}
                    </div>

                    {/* Allergies */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                      <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><span>⚠️</span> Allergies</h3>
                      {allergies.loading ? <div className="animate-pulse space-y-2">{[1,2].map(i => <div key={i} className="h-10 bg-slate-100 rounded"></div>)}</div> :
                       allergies.data?.map((a: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 py-2">
                          <span className={\`w-2 h-2 rounded-full \${a.criticality === 'high' ? 'bg-red-500' : 'bg-amber-500'}\`}></span>
                          <span className="text-sm text-slate-900">{getAllergyName(a)}</span>
                        </div>
                      ))}
                      {allergies.data?.length === 0 && <p className="text-sm text-slate-500">No known allergies</p>}
                    </div>
                  </div>

                  {/* Medications */}
                  <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><span>💊</span> Active Medications</h3>
                    {medications.loading ? <div className="animate-pulse grid grid-cols-2 gap-2">{[1,2,3,4].map(i => <div key={i} className="h-12 bg-slate-100 rounded"></div>)}</div> :
                     <div className="grid sm:grid-cols-2 gap-2">
                      {medications.data?.map((m: any, i: number) => (
                        <div key={i} className="p-3 bg-slate-50 rounded-lg">
                          <span className="text-sm font-medium text-slate-900">{getMedName(m)}</span>
                        </div>
                      ))}
                    </div>}
                    {medications.data?.length === 0 && <p className="text-sm text-slate-500">No active medications</p>}
                  </div>

                  {/* Conditions */}
                  <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><span>🩺</span> Active Conditions</h3>
                    {conditions.loading ? <div className="animate-pulse space-y-2">{[1,2].map(i => <div key={i} className="h-10 bg-slate-100 rounded"></div>)}</div> :
                     <div className="space-y-2">
                      {conditions.data?.map((c: any, i: number) => (
                        <div key={i} className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                          <span className="text-sm font-medium text-purple-900">{getConditionName(c)}</span>
                        </div>
                      ))}
                    </div>}
                    {conditions.data?.length === 0 && <p className="text-sm text-slate-500">No active conditions</p>}
                  </div>
                </>
              )}

              {/* Vitals Section */}
              {activeSection === 'vitals' && (
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Vital Signs</h3>
                  {vitals.loading ? <div className="animate-pulse space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-slate-100 rounded-lg"></div>)}</div> :
                   <div className="space-y-3">
                    {vitals.data?.map((v: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                        <div>
                          <div className="font-medium text-slate-900">{getVitalName(v)}</div>
                          {v.effectiveDateTime && <div className="text-xs text-slate-500 mt-1">{new Date(v.effectiveDateTime).toLocaleString()}</div>}
                        </div>
                        <div className="text-xl font-bold text-blue-600">{getVitalValue(v)}</div>
                      </div>
                    ))}
                  </div>}
                  {vitals.data?.length === 0 && <p className="text-slate-500 text-center py-8">No vitals recorded</p>}
                </div>
              )}

              {/* Medications Section */}
              {activeSection === 'meds' && (
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Medications</h3>
                  {medications.loading ? <div className="animate-pulse space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-lg"></div>)}</div> :
                   <div className="space-y-3">
                    {medications.data?.map((m: any, i: number) => (
                      <div key={i} className="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                        <div className="font-medium text-emerald-900">{getMedName(m)}</div>
                        {m.dosageInstruction?.[0]?.text && <div className="text-sm text-emerald-700 mt-1">{m.dosageInstruction[0].text}</div>}
                        {m.authoredOn && <div className="text-xs text-emerald-600 mt-2">Prescribed: {new Date(m.authoredOn).toLocaleDateString()}</div>}
                      </div>
                    ))}
                  </div>}
                  {medications.data?.length === 0 && <p className="text-slate-500 text-center py-8">No active medications</p>}
                </div>
              )}

              {/* Allergies Section */}
              {activeSection === 'allergies' && (
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Allergies</h3>
                  {allergies.loading ? <div className="animate-pulse space-y-3">{[1,2].map(i => <div key={i} className="h-20 bg-slate-100 rounded-lg"></div>)}</div> :
                   <div className="space-y-3">
                    {allergies.data?.map((a: any, i: number) => (
                      <div key={i} className={\`p-4 rounded-lg border \${a.criticality === 'high' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}\`}>
                        <div className="flex items-center gap-2">
                          <span className={\`inline-flex px-2 py-0.5 rounded text-xs font-medium \${a.criticality === 'high' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}\`}>{a.criticality || 'unknown'}</span>
                          <span className="font-medium text-slate-900">{getAllergyName(a)}</span>
                        </div>
                        {a.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display && <div className="text-sm text-slate-600 mt-2">Reaction: {a.reaction[0].manifestation[0].coding[0].display}</div>}
                      </div>
                    ))}
                  </div>}
                  {allergies.data?.length === 0 && <p className="text-slate-500 text-center py-8">No known allergies</p>}
                </div>
              )}

              {/* Conditions Section */}
              {activeSection === 'conditions' && (
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Active Conditions</h3>
                  {conditions.loading ? <div className="animate-pulse space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-lg"></div>)}</div> :
                   <div className="space-y-3">
                    {conditions.data?.map((c: any, i: number) => (
                      <div key={i} className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                        <div className="font-medium text-purple-900">{getConditionName(c)}</div>
                        {c.onsetDateTime && <div className="text-sm text-purple-700 mt-1">Onset: {new Date(c.onsetDateTime).toLocaleDateString()}</div>}
                        {c.clinicalStatus?.coding?.[0]?.code && <span className="inline-flex mt-2 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">{c.clinicalStatus.coding[0].code}</span>}
                      </div>
                    ))}
                  </div>}
                  {conditions.data?.length === 0 && <p className="text-slate-500 text-center py-8">No active conditions</p>}
                </div>
              )}
            </main>
          </div>
        )}

        {/* Empty State */}
        {!patientId && isConnected && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Select a Patient</h3>
            <p className="text-slate-500 mt-2 max-w-md mx-auto">Choose a sandbox patient above to view their complete clinical dashboard.</p>
          </div>
        )}
      </div>
    </div>
  );
}
`;
}

function getEpicPatientLookupPage(): string {
  return `'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePatient } from '@/lib/epic-fhir';

const SANDBOX_PATIENTS = [
  { name: 'Camila Lopez', id: 'erXuFYUfucBZaryVksYEcMg3', subtitle: 'Female, Adult', mrn: 'MRN-001' },
  { name: 'Theodore Mychart', id: 'e63wRTbPfr1p8UW81d8Seiw3', subtitle: 'Male, Adult', mrn: 'MRN-002' },
  { name: 'Derrick Lin', id: 'eq081-VQEgP8drUUqCWzHfw3', subtitle: 'Male, Adult', mrn: 'MRN-003' },
];

function getPatientName(patient: any): string {
  const name = patient?.name?.[0];
  return name ? \`\${name.given?.join(' ') || ''} \${name.family || ''}\`.trim() : 'Unknown';
}

function getPatientAge(patient: any): string {
  if (!patient?.birthDate) return 'Unknown';
  const birth = new Date(patient.birthDate);
  const age = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return \`\${age} years\`;
}

function getPatientPhone(patient: any): string {
  const phone = patient?.telecom?.find((t: any) => t.system === 'phone');
  return phone?.value || 'Not provided';
}

function getPatientAddress(patient: any): string {
  const addr = patient?.address?.[0];
  if (!addr) return 'Not provided';
  return [addr.line?.join(' '), addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ');
}

export default function PatientSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [patientId, setPatientId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [recentPatients, setRecentPatients] = useState<string[]>([]);

  const { data, loading, error } = usePatient(isConnected ? patientId : null);

  useEffect(() => {
    fetch('/api/epic').then(r => r.json()).then(data => setIsConnected(data.connected)).catch(() => {});
  }, []);

  const filteredPatients = useMemo(() => {
    if (!searchQuery) return SANDBOX_PATIENTS;
    const query = searchQuery.toLowerCase();
    return SANDBOX_PATIENTS.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.mrn.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const handleSelectPatient = (id: string) => {
    setPatientId(id);
    if (!recentPatients.includes(id)) {
      setRecentPatients(prev => [id, ...prev].slice(0, 3));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Patient Search</h1>
                <p className="text-sm text-slate-500">Epic FHIR Integration</p>
              </div>
            </div>
            <span className={\`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium \${isConnected ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20'}\`}>
              <span className={\`w-2 h-2 rounded-full \${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}\`}></span>
              {isConnected ? 'Connected' : 'Not Connected'}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Search Panel */}
          <div className="col-span-12 lg:col-span-5">
            {/* Search Input */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or MRN..."
                  disabled={!isConnected}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:bg-slate-50"
                />
              </div>
            </div>

            {/* Patient List */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                <h2 className="text-sm font-medium text-slate-600">
                  {searchQuery ? \`Results (\${filteredPatients.length})\` : 'Sandbox Patients'}
                </h2>
              </div>
              <div className="divide-y divide-slate-100">
                {filteredPatients.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPatient(p.id)}
                    disabled={!isConnected}
                    className={\`w-full p-4 text-left transition-all disabled:opacity-50 \${
                      patientId === p.id ? 'bg-blue-50' : 'hover:bg-slate-50'
                    }\`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={\`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold \${patientId === p.id ? 'bg-blue-500' : 'bg-slate-400'}\`}>
                        {p.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={\`font-medium truncate \${patientId === p.id ? 'text-blue-900' : 'text-slate-900'}\`}>{p.name}</div>
                        <div className="text-sm text-slate-500">{p.mrn} • {p.subtitle}</div>
                      </div>
                      {patientId === p.id && (
                        <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
                {filteredPatients.length === 0 && (
                  <div className="p-8 text-center text-slate-500">No patients match your search</div>
                )}
              </div>
            </div>
          </div>

          {/* Patient Details */}
          <div className="col-span-12 lg:col-span-7">
            {!patientId ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center h-full flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">{isConnected ? 'Select a Patient' : 'Connect to Epic First'}</h3>
                <p className="text-slate-500 max-w-sm">{isConnected ? 'Search or select a patient from the list to view their details' : 'Configure Epic connection in Settings to begin'}</p>
              </div>
            ) : loading ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-slate-500">Loading patient data...</p>
              </div>
            ) : error ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">Error Loading Patient</h3>
                <p className="text-slate-500">{error.message || 'Could not load patient data'}</p>
              </div>
            ) : data ? (
              <div className="space-y-6">
                {/* Patient Header */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold">
                      {getPatientName(data)?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-slate-900">{getPatientName(data)}</h2>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          {data.gender || 'Unknown'}
                        </span>
                        <span>•</span>
                        <span>{getPatientAge(data)}</span>
                        <span>•</span>
                        <span>DOB: {data.birthDate || 'Unknown'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-900">Contact Information</h3>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <div className="text-sm text-slate-500 mb-1">Phone</div>
                      <div className="font-medium text-slate-900">{getPatientPhone(data)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-500 mb-1">Address</div>
                      <div className="font-medium text-slate-900">{getPatientAddress(data)}</div>
                    </div>
                  </div>
                </div>

                {/* Identifiers */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-900">Identifiers</h3>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-50 rounded-lg p-4">
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">FHIR ID</div>
                        <div className="font-mono text-sm text-slate-900 break-all">{data.id || 'N/A'}</div>
                      </div>
                      {data.identifier?.map((id: any, i: number) => (
                        <div key={i} className="bg-slate-50 rounded-lg p-4">
                          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{id.type?.text || id.system || 'ID'}</div>
                          <div className="font-mono text-sm text-slate-900 break-all">{id.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
`;
}

function getEpicMedicationsPage(): string {
  return `'use client';

import { useState, useEffect, useMemo } from 'react';
import { useMedications, usePatient, useAllergies } from '@/lib/epic-fhir';

const SANDBOX_PATIENTS = [
  { name: 'Camila Lopez', id: 'erXuFYUfucBZaryVksYEcMg3', subtitle: 'Has active medications' },
  { name: 'Theodore Mychart', id: 'e63wRTbPfr1p8UW81d8Seiw3', subtitle: 'MyChart test patient' },
  { name: 'Derrick Lin', id: 'eq081-VQEgP8drUUqCWzHfw3', subtitle: 'Basic demographics' },
];

// High-risk medication keywords
const HIGH_RISK_KEYWORDS = ['warfarin', 'heparin', 'insulin', 'opioid', 'methotrexate', 'chemotherapy', 'digoxin', 'lithium', 'phenytoin', 'coumadin', 'lovenox', 'morphine', 'fentanyl', 'oxycodone', 'hydrocodone'];

function getMedName(med: any): string {
  return med?.medicationCodeableConcept?.text || med?.medicationCodeableConcept?.coding?.[0]?.display || med?.medicationReference?.display || 'Unknown Medication';
}

function isHighRisk(med: any): boolean {
  const name = getMedName(med).toLowerCase();
  return HIGH_RISK_KEYWORDS.some(k => name.includes(k));
}

function getDosage(med: any): string {
  const dosage = med?.dosageInstruction?.[0];
  if (!dosage) return 'As directed';
  const text = dosage.text || '';
  const timing = dosage.timing?.code?.text || dosage.timing?.repeat?.frequency ? \`\${dosage.timing.repeat.frequency}x/\${dosage.timing.repeat.period} \${dosage.timing.repeat.periodUnit}\` : '';
  return text || timing || 'As directed';
}

export default function MedicationTracker() {
  const [patientId, setPatientId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'high-risk'>('all');

  const patient = usePatient(isConnected ? patientId : null);
  const medications = useMedications(isConnected ? patientId : null);
  const allergies = useAllergies(isConnected ? patientId : null);

  useEffect(() => {
    fetch('/api/epic').then(r => r.json()).then(data => setIsConnected(data.connected)).catch(() => {});
  }, []);

  const { allMeds, highRiskMeds, regularMeds } = useMemo(() => {
    const all = medications.data || [];
    const highRisk = all.filter(isHighRisk);
    const regular = all.filter(m => !isHighRisk(m));
    return { allMeds: all, highRiskMeds: highRisk, regularMeds: regular };
  }, [medications.data]);

  const displayMeds = activeTab === 'high-risk' ? highRiskMeds : allMeds;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Medication Tracker</h1>
                <p className="text-sm text-slate-500">Epic FHIR Integration</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={\`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium \${isConnected ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20'}\`}>
                <span className={\`w-2 h-2 rounded-full \${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}\`}></span>
                {isConnected ? 'Epic Connected' : 'Not Connected'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Patient Selection */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-3">Select Patient</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {SANDBOX_PATIENTS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPatientId(p.id)}
                disabled={!isConnected}
                className={\`relative p-4 rounded-xl border-2 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed \${
                  patientId === p.id
                    ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-md'
                }\`}
              >
                <div className="flex items-center gap-3">
                  <div className={\`w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold \${patientId === p.id ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'}\`}>
                    {p.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div className={\`font-semibold \${patientId === p.id ? 'text-emerald-900' : 'text-slate-900'}\`}>{p.name}</div>
                    <div className="text-sm text-slate-500">{p.subtitle}</div>
                  </div>
                </div>
                {patientId === p.id && (
                  <div className="absolute top-2 right-2">
                    <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
          {!isConnected && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="font-medium text-amber-800">Epic not connected</p>
                  <p className="text-sm text-amber-700 mt-1">Configure your Epic credentials in the main AI Dev Platform settings to load real patient data.</p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Patient Data */}
        {patientId && patient.data && (
          <>
            {/* Patient Banner */}
            <section className="mb-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-2xl font-bold text-emerald-700">
                    {patient.data.displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-slate-900">{patient.data.displayName}</h2>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-slate-600">
                      <span>DOB: {patient.data.birthDate ? new Date(patient.data.birthDate).toLocaleDateString() : 'Unknown'}</span>
                      {patient.data.age !== null && <span>Age: {patient.data.age}</span>}
                      {patient.data.gender && <span className="capitalize">{patient.data.gender}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Stats Cards */}
            <section className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900">{allMeds.length}</div>
                    <div className="text-sm text-slate-500">Active Meds</div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">{highRiskMeds.length}</div>
                    <div className="text-sm text-slate-500">High-Risk</div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900">{allergies.data?.length || 0}</div>
                    <div className="text-sm text-slate-500">Allergies</div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900">{regularMeds.length}</div>
                    <div className="text-sm text-slate-500">Regular Meds</div>
                  </div>
                </div>
              </div>
            </section>

            {/* High-Risk Alert */}
            {highRiskMeds.length > 0 && (
              <section className="mb-6">
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-red-800">High-Risk Medications Detected</h3>
                      <p className="text-sm text-red-700 mt-1">This patient is taking {highRiskMeds.length} high-risk medication(s) that require careful monitoring:</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {highRiskMeds.map((med: any, i: number) => (
                          <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            {getMedName(med)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Tabs */}
            <section className="mb-4">
              <div className="flex gap-2 border-b border-slate-200">
                <button onClick={() => setActiveTab('all')} className={\`px-4 py-2 text-sm font-medium border-b-2 transition-colors \${activeTab === 'all' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}\`}>
                  All Medications ({allMeds.length})
                </button>
                <button onClick={() => setActiveTab('high-risk')} className={\`px-4 py-2 text-sm font-medium border-b-2 transition-colors \${activeTab === 'high-risk' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'}\`}>
                  High-Risk Only ({highRiskMeds.length})
                </button>
              </div>
            </section>

            {/* Medications List */}
            <section>
              {medications.loading ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                  <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-slate-500">Loading medications...</p>
                </div>
              ) : medications.error ? (
                <div className="bg-red-50 rounded-xl border border-red-200 p-6 text-center">
                  <p className="text-red-700">{medications.error}</p>
                </div>
              ) : displayMeds.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                  <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                  <p className="text-slate-500">{activeTab === 'high-risk' ? 'No high-risk medications found' : 'No active medications found'}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {displayMeds.map((med: any, index: number) => {
                    const name = getMedName(med);
                    const dosage = getDosage(med);
                    const highRisk = isHighRisk(med);
                    return (
                      <div key={index} className={\`bg-white rounded-xl border p-4 transition-shadow hover:shadow-md \${highRisk ? 'border-red-200' : 'border-slate-200'}\`}>
                        <div className="flex items-start gap-4">
                          <div className={\`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 \${highRisk ? 'bg-red-100' : 'bg-emerald-100'}\`}>
                            <svg className={\`w-6 h-6 \${highRisk ? 'text-red-600' : 'text-emerald-600'}\`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-slate-900">{name}</h3>
                              {highRisk && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                  ⚠️ High-Risk
                                </span>
                              )}
                              <span className={\`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium \${med.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}\`}>
                                {med.status || 'active'}
                              </span>
                            </div>
                            <p className="text-sm text-slate-600 mt-1">{dosage}</p>
                            {med.authoredOn && (
                              <p className="text-xs text-slate-400 mt-2">Prescribed: {new Date(med.authoredOn).toLocaleDateString()}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {/* Empty State */}
        {!patientId && isConnected && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Select a Patient</h3>
            <p className="text-slate-500 mt-2 max-w-md mx-auto">
              Choose a sandbox patient above to view their active medications, high-risk alerts, and dosage information.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
`;
}

function getEpicAllergiesPage(): string {
  return `'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAllergies, usePatient } from '@/lib/epic-fhir';

const SANDBOX_PATIENTS = [
  { name: 'Camila Lopez', id: 'erXuFYUfucBZaryVksYEcMg3', subtitle: 'Multiple allergies' },
  { name: 'Theodore Mychart', id: 'e63wRTbPfr1p8UW81d8Seiw3', subtitle: 'MyChart patient' },
  { name: 'Derrick Lin', id: 'eq081-VQEgP8drUUqCWzHfw3', subtitle: 'Basic demographics' },
];

type AllergyCategory = 'all' | 'drug' | 'food' | 'environment';

function getAllergyName(allergy: any): string {
  return allergy?.code?.text || allergy?.code?.coding?.[0]?.display || 'Unknown Allergen';
}

function getAllergyCategory(allergy: any): string {
  const categories = allergy?.category || [];
  if (categories.includes('medication')) return 'drug';
  if (categories.includes('food')) return 'food';
  if (categories.includes('environment')) return 'environment';
  return 'other';
}

function getCriticalityColor(criticality: string): string {
  switch (criticality) {
    case 'high': return 'bg-red-100 text-red-800 ring-red-600/20';
    case 'low': return 'bg-green-100 text-green-800 ring-green-600/20';
    default: return 'bg-slate-100 text-slate-700 ring-slate-600/20';
  }
}

function getCategoryIcon(category: string): string {
  switch (category) {
    case 'drug': return '💊';
    case 'food': return '🍎';
    case 'environment': return '🌿';
    default: return '⚠️';
  }
}

export default function AllergyManager() {
  const [patientId, setPatientId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeCategory, setActiveCategory] = useState<AllergyCategory>('all');

  const patient = usePatient(isConnected ? patientId : null);
  const allergies = useAllergies(isConnected ? patientId : null);

  useEffect(() => {
    fetch('/api/epic').then(r => r.json()).then(data => setIsConnected(data.connected)).catch(() => {});
  }, []);

  const { stats, filteredAllergies } = useMemo(() => {
    const all = allergies.data || [];
    const drug = all.filter(a => getAllergyCategory(a) === 'drug');
    const food = all.filter(a => getAllergyCategory(a) === 'food');
    const environment = all.filter(a => getAllergyCategory(a) === 'environment');
    const highRisk = all.filter(a => a?.criticality === 'high');

    const filtered = activeCategory === 'all' ? all : all.filter(a => getAllergyCategory(a) === activeCategory);

    return {
      stats: { total: all.length, drug: drug.length, food: food.length, environment: environment.length, highRisk: highRisk.length },
      filteredAllergies: filtered,
    };
  }, [allergies.data, activeCategory]);

  const categories: { id: AllergyCategory; label: string; icon: string; count: number }[] = [
    { id: 'all', label: 'All', icon: '📋', count: stats.total },
    { id: 'drug', label: 'Drug', icon: '💊', count: stats.drug },
    { id: 'food', label: 'Food', icon: '🍎', count: stats.food },
    { id: 'environment', label: 'Environmental', icon: '🌿', count: stats.environment },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Allergy Manager</h1>
                <p className="text-sm text-slate-500">Epic FHIR Integration</p>
              </div>
            </div>
            <span className={\`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium \${isConnected ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20'}\`}>
              <span className={\`w-2 h-2 rounded-full \${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}\`}></span>
              {isConnected ? 'Connected' : 'Not Connected'}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Patient Selection */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-3">Select Patient</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {SANDBOX_PATIENTS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPatientId(p.id)}
                disabled={!isConnected}
                className={\`relative p-4 rounded-xl border-2 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed \${
                  patientId === p.id
                    ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/20'
                    : 'bg-white border-slate-200 hover:border-rose-300'
                }\`}
              >
                <div className="flex items-center gap-3">
                  <div className={\`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg \${patientId === p.id ? 'bg-rose-500' : 'bg-slate-400'}\`}>
                    {p.name.charAt(0)}
                  </div>
                  <div>
                    <div className={\`font-semibold \${patientId === p.id ? 'text-rose-900' : 'text-slate-900'}\`}>{p.name}</div>
                    <div className="text-sm text-slate-500">{p.subtitle}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {patientId && (
          <>
            {/* Stats Cards */}
            <section className="mb-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
                  <div className="text-sm text-slate-500">Total Allergies</div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="text-2xl font-bold text-red-600">{stats.highRisk}</div>
                  <div className="text-sm text-slate-500">High Risk</div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="text-2xl font-bold text-blue-600">{stats.drug}</div>
                  <div className="text-sm text-slate-500">Drug</div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="text-2xl font-bold text-orange-600">{stats.food}</div>
                  <div className="text-sm text-slate-500">Food</div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="text-2xl font-bold text-green-600">{stats.environment}</div>
                  <div className="text-sm text-slate-500">Environmental</div>
                </div>
              </div>
            </section>

            {/* High Risk Alert */}
            {stats.highRisk > 0 && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold text-red-800">High Risk Allergies Detected</div>
                  <div className="text-sm text-red-600">This patient has {stats.highRisk} high-criticality allerg{stats.highRisk === 1 ? 'y' : 'ies'} that require special attention.</div>
                </div>
              </div>
            )}

            {/* Category Filter */}
            <div className="mb-6 bg-white rounded-xl border border-slate-200 p-2 flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={\`flex items-center gap-2 px-4 py-2 rounded-lg transition-all \${
                    activeCategory === cat.id
                      ? 'bg-rose-100 text-rose-700 font-medium'
                      : 'text-slate-600 hover:bg-slate-50'
                  }\`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                  <span className={\`px-2 py-0.5 rounded-full text-xs font-medium \${activeCategory === cat.id ? 'bg-rose-200 text-rose-800' : 'bg-slate-100 text-slate-600'}\`}>
                    {cat.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Allergies List */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {allergies.loading ? (
                <div className="p-12 text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-slate-500">Loading allergies...</p>
                </div>
              ) : filteredAllergies.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">✓</span>
                  </div>
                  <h3 className="font-medium text-slate-900 mb-1">No Allergies Found</h3>
                  <p className="text-slate-500">{activeCategory === 'all' ? 'No allergies recorded for this patient' : \`No \${activeCategory} allergies recorded\`}</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredAllergies.map((allergy: any, i: number) => (
                    <div key={i} className={\`p-5 \${allergy?.criticality === 'high' ? 'bg-red-50/50' : ''}\`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-xl">
                            {getCategoryIcon(getAllergyCategory(allergy))}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{getAllergyName(allergy)}</div>
                            <div className="text-sm text-slate-500 mt-0.5 capitalize">{getAllergyCategory(allergy)} allergy</div>
                            {allergy?.reaction?.[0] && (
                              <div className="mt-2">
                                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Reaction: </span>
                                <span className="text-sm text-slate-700">{allergy.reaction[0].manifestation?.[0]?.text || 'Not specified'}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={\`px-2.5 py-1 rounded-full text-xs font-medium ring-1 \${getCriticalityColor(allergy?.criticality)}\`}>
                            {allergy?.criticality === 'high' ? '⚠️ High Risk' : allergy?.criticality === 'low' ? 'Low Risk' : 'Unknown Risk'}
                          </span>
                          {allergy?.verificationStatus?.coding?.[0]?.code && (
                            <span className="text-xs text-slate-500 capitalize">
                              {allergy.verificationStatus.coding[0].code}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {!patientId && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">{isConnected ? 'Select a Patient' : 'Connect to Epic First'}</h3>
            <p className="text-slate-500">{isConnected ? 'Choose a patient above to view their allergy information' : 'Configure Epic connection in Settings'}</p>
          </div>
        )}
      </main>
    </div>
  );
}
`;
}

// =============================================================================
// ADDITIONAL EPIC PAGE TEMPLATES
// =============================================================================

function getEpicClinicalSummaryPage(): string {
  return `'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePatient, useVitals, useMedications, useAllergies, useConditions } from '@/lib/epic-fhir';

const SANDBOX_PATIENTS = [
  { name: 'Camila Lopez', id: 'erXuFYUfucBZaryVksYEcMg3', subtitle: 'Full clinical data' },
  { name: 'Theodore Mychart', id: 'e63wRTbPfr1p8UW81d8Seiw3', subtitle: 'MyChart patient' },
  { name: 'Derrick Lin', id: 'eq081-VQEgP8drUUqCWzHfw3', subtitle: 'Basic demographics' },
];

type Section = 'overview' | 'vitals' | 'medications' | 'allergies' | 'conditions';

function getPatientName(patient: any): string {
  const name = patient?.name?.[0];
  return name ? \`\${name.given?.join(' ') || ''} \${name.family || ''}\`.trim() : 'Unknown';
}

function getPatientAge(patient: any): string {
  if (!patient?.birthDate) return 'Unknown';
  const birth = new Date(patient.birthDate);
  const age = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return \`\${age} years\`;
}

function formatVitalValue(vital: any): string {
  const value = vital?.valueQuantity;
  if (!value) return '--';
  return \`\${value.value?.toFixed(1) || '--'} \${value.unit || ''}\`;
}

function getVitalType(vital: any): string {
  const code = vital?.code?.coding?.[0]?.code;
  const types: Record<string, string> = {
    '8310-5': 'Temperature',
    '8867-4': 'Heart Rate',
    '9279-1': 'Respiratory Rate',
    '85354-9': 'Blood Pressure',
    '29463-7': 'Weight',
    '8302-2': 'Height',
    '2708-6': 'SpO2',
  };
  return types[code] || vital?.code?.text || 'Vital Sign';
}

export default function ClinicalSummary() {
  const [patientId, setPatientId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>('overview');

  const patient = usePatient(isConnected ? patientId : null);
  const vitals = useVitals(isConnected ? patientId : null);
  const medications = useMedications(isConnected ? patientId : null);
  const allergies = useAllergies(isConnected ? patientId : null);
  const conditions = useConditions(isConnected ? patientId : null);

  useEffect(() => {
    fetch('/api/epic').then(r => r.json()).then(data => setIsConnected(data.connected)).catch(() => {});
  }, []);

  const stats = useMemo(() => ({
    vitals: vitals.data?.length || 0,
    medications: medications.data?.length || 0,
    allergies: allergies.data?.length || 0,
    conditions: conditions.data?.length || 0,
  }), [vitals.data, medications.data, allergies.data, conditions.data]);

  const sections: { id: Section; label: string; icon: string; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'vitals', label: 'Vitals', icon: '💓', count: stats.vitals },
    { id: 'medications', label: 'Medications', icon: '💊', count: stats.medications },
    { id: 'allergies', label: 'Allergies', icon: '⚠️', count: stats.allergies },
    { id: 'conditions', label: 'Conditions', icon: '🩺', count: stats.conditions },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Clinical Summary</h1>
                <p className="text-sm text-slate-500">Epic FHIR Integration</p>
              </div>
            </div>
            <span className={\`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium \${isConnected ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20'}\`}>
              <span className={\`w-2 h-2 rounded-full \${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}\`}></span>
              {isConnected ? 'Connected' : 'Not Connected'}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar */}
          <aside className="col-span-12 lg:col-span-3">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden sticky top-24">
              <div className="p-4 border-b border-slate-100">
                <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Select Patient</h2>
              </div>
              <div className="p-2">
                {SANDBOX_PATIENTS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setPatientId(p.id); setActiveSection('overview'); }}
                    disabled={!isConnected}
                    className={\`w-full p-3 rounded-lg text-left transition-all disabled:opacity-50 \${
                      patientId === p.id
                        ? 'bg-violet-50 border-2 border-violet-500'
                        : 'hover:bg-slate-50 border-2 border-transparent'
                    }\`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={\`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold \${patientId === p.id ? 'bg-violet-500' : 'bg-slate-400'}\`}>
                        {p.name.charAt(0)}
                      </div>
                      <div>
                        <div className={\`font-medium \${patientId === p.id ? 'text-violet-900' : 'text-slate-900'}\`}>{p.name}</div>
                        <div className="text-xs text-slate-500">{p.subtitle}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="col-span-12 lg:col-span-9">
            {!patientId ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">{isConnected ? 'Select a Patient' : 'Connect to Epic First'}</h3>
                <p className="text-slate-500">{isConnected ? 'Choose a patient from the sidebar to view their clinical summary' : 'Configure Epic connection in Settings'}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Section Navigation */}
                <div className="bg-white rounded-xl border border-slate-200 p-2 flex flex-wrap gap-2">
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={\`flex items-center gap-2 px-4 py-2 rounded-lg transition-all \${
                        activeSection === section.id
                          ? 'bg-violet-100 text-violet-700 font-medium'
                          : 'text-slate-600 hover:bg-slate-50'
                      }\`}
                    >
                      <span>{section.icon}</span>
                      <span>{section.label}</span>
                      {section.count !== undefined && (
                        <span className={\`px-2 py-0.5 rounded-full text-xs font-medium \${activeSection === section.id ? 'bg-violet-200 text-violet-800' : 'bg-slate-100 text-slate-600'}\`}>
                          {section.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Patient Header */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                      {getPatientName(patient.data)?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-slate-900">{patient.loading ? 'Loading...' : getPatientName(patient.data)}</h2>
                      <div className="flex items-center gap-4 mt-1 text-slate-500">
                        <span>{patient.data?.gender || 'Unknown'}</span>
                        <span>•</span>
                        <span>{getPatientAge(patient.data)}</span>
                        <span>•</span>
                        <span>DOB: {patient.data?.birthDate || 'Unknown'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Overview Section */}
                {activeSection === 'overview' && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                      <div className="text-3xl mb-1">💓</div>
                      <div className="text-2xl font-bold text-slate-900">{stats.vitals}</div>
                      <div className="text-sm text-slate-500">Vital Signs</div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                      <div className="text-3xl mb-1">💊</div>
                      <div className="text-2xl font-bold text-slate-900">{stats.medications}</div>
                      <div className="text-sm text-slate-500">Medications</div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                      <div className="text-3xl mb-1">⚠️</div>
                      <div className="text-2xl font-bold text-slate-900">{stats.allergies}</div>
                      <div className="text-sm text-slate-500">Allergies</div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                      <div className="text-3xl mb-1">🩺</div>
                      <div className="text-2xl font-bold text-slate-900">{stats.conditions}</div>
                      <div className="text-sm text-slate-500">Conditions</div>
                    </div>
                  </div>
                )}

                {/* Vitals Section */}
                {activeSection === 'vitals' && (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100">
                      <h3 className="font-semibold text-slate-900">Vital Signs</h3>
                    </div>
                    {vitals.loading ? (
                      <div className="p-8 text-center text-slate-500">Loading vitals...</div>
                    ) : vitals.data?.length ? (
                      <div className="divide-y divide-slate-100">
                        {vitals.data.map((vital: any, i: number) => (
                          <div key={i} className="px-6 py-4 flex items-center justify-between">
                            <div>
                              <div className="font-medium text-slate-900">{getVitalType(vital)}</div>
                              <div className="text-sm text-slate-500">{vital.effectiveDateTime ? new Date(vital.effectiveDateTime).toLocaleDateString() : 'No date'}</div>
                            </div>
                            <div className="text-xl font-semibold text-violet-600">{formatVitalValue(vital)}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-slate-500">No vital signs recorded</div>
                    )}
                  </div>
                )}

                {/* Medications Section */}
                {activeSection === 'medications' && (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100">
                      <h3 className="font-semibold text-slate-900">Active Medications</h3>
                    </div>
                    {medications.loading ? (
                      <div className="p-8 text-center text-slate-500">Loading medications...</div>
                    ) : medications.data?.length ? (
                      <div className="divide-y divide-slate-100">
                        {medications.data.map((med: any, i: number) => (
                          <div key={i} className="px-6 py-4">
                            <div className="font-medium text-slate-900">{med?.medicationCodeableConcept?.text || 'Unknown Medication'}</div>
                            <div className="text-sm text-slate-500 mt-1">{med?.dosageInstruction?.[0]?.text || 'Dosage not specified'}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-slate-500">No active medications</div>
                    )}
                  </div>
                )}

                {/* Allergies Section */}
                {activeSection === 'allergies' && (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100">
                      <h3 className="font-semibold text-slate-900">Allergies & Intolerances</h3>
                    </div>
                    {allergies.loading ? (
                      <div className="p-8 text-center text-slate-500">Loading allergies...</div>
                    ) : allergies.data?.length ? (
                      <div className="divide-y divide-slate-100">
                        {allergies.data.map((allergy: any, i: number) => (
                          <div key={i} className="px-6 py-4 flex items-center justify-between">
                            <div>
                              <div className="font-medium text-slate-900">{allergy?.code?.text || 'Unknown Allergen'}</div>
                              <div className="text-sm text-slate-500">{allergy?.reaction?.[0]?.manifestation?.[0]?.text || 'Reaction not specified'}</div>
                            </div>
                            <span className={\`px-2.5 py-1 rounded-full text-xs font-medium \${
                              allergy?.criticality === 'high' ? 'bg-red-100 text-red-700' :
                              allergy?.criticality === 'low' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-700'
                            }\`}>
                              {allergy?.criticality || 'Unknown'} risk
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-slate-500">No known allergies</div>
                    )}
                  </div>
                )}

                {/* Conditions Section */}
                {activeSection === 'conditions' && (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100">
                      <h3 className="font-semibold text-slate-900">Active Conditions</h3>
                    </div>
                    {conditions.loading ? (
                      <div className="p-8 text-center text-slate-500">Loading conditions...</div>
                    ) : conditions.data?.length ? (
                      <div className="divide-y divide-slate-100">
                        {conditions.data.map((condition: any, i: number) => (
                          <div key={i} className="px-6 py-4">
                            <div className="font-medium text-slate-900">{condition?.code?.text || 'Unknown Condition'}</div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className={\`px-2 py-0.5 rounded text-xs font-medium \${
                                condition?.clinicalStatus?.coding?.[0]?.code === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                              }\`}>
                                {condition?.clinicalStatus?.coding?.[0]?.code || 'Unknown'}
                              </span>
                              <span className="text-sm text-slate-500">{condition?.onsetDateTime ? new Date(condition.onsetDateTime).toLocaleDateString() : ''}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-slate-500">No active conditions</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
`;
}

function getEpicLabResultsPage(): string {
  return `'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePatient } from '@/lib/epic-fhir';

const SANDBOX_PATIENTS = [
  { name: 'Camila Lopez', id: 'erXuFYUfucBZaryVksYEcMg3', subtitle: 'Has lab results' },
  { name: 'Theodore Mychart', id: 'e63wRTbPfr1p8UW81d8Seiw3', subtitle: 'MyChart patient' },
  { name: 'Derrick Lin', id: 'eq081-VQEgP8drUUqCWzHfw3', subtitle: 'Basic demographics' },
];

// Lab categories based on LOINC codes
const LAB_CATEGORIES: Record<string, { name: string; codes: string[]; color: string }> = {
  'cbc': { name: 'Complete Blood Count', codes: ['718-7', '4544-3', '787-2', '785-6', '786-4', '788-0', '789-8'], color: 'rose' },
  'bmp': { name: 'Basic Metabolic Panel', codes: ['2345-7', '2160-0', '3094-0', '2028-9', '17861-6', '2075-0', '6298-4'], color: 'blue' },
  'lipid': { name: 'Lipid Panel', codes: ['2093-3', '2571-8', '2085-9', '13457-7', '9830-1'], color: 'amber' },
  'liver': { name: 'Liver Function', codes: ['1742-6', '1920-8', '6768-6', '1975-2', '1968-7'], color: 'emerald' },
  'other': { name: 'Other Labs', codes: [] as string[], color: 'slate' },
};

interface LabResult {
  id: string;
  code: string;
  display: string;
  value: string;
  unit: string;
  date: string;
  status: 'normal' | 'high' | 'low' | 'critical';
  refRange?: string;
}

export default function LabResultsViewer() {
  const [patientId, setPatientId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [labs, setLabs] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const patient = usePatient(isConnected ? patientId : null);

  useEffect(() => {
    fetch('/api/epic').then(r => r.json()).then(data => setIsConnected(data.connected)).catch(() => {});
  }, []);

  useEffect(() => {
    if (patientId && isConnected) {
      setLoading(true);
      fetch(\`/api/epic/fhir/Observation?patient=\${patientId}&category=laboratory&_count=50\`)
        .then(r => r.json())
        .then(data => {
          const results: LabResult[] = (data.entry || []).map((e: any) => {
            const interp = e.resource.interpretation?.[0]?.coding?.[0]?.code;
            return {
              id: e.resource.id,
              code: e.resource.code?.coding?.[0]?.code || '',
              display: e.resource.code?.text || e.resource.code?.coding?.[0]?.display || 'Unknown Test',
              value: e.resource.valueQuantity?.value?.toFixed(1) || e.resource.valueString || 'N/A',
              unit: e.resource.valueQuantity?.unit || '',
              date: e.resource.effectiveDateTime || '',
              status: interp === 'H' || interp === 'HH' ? 'high' : interp === 'L' || interp === 'LL' ? 'low' : interp === 'A' ? 'critical' : 'normal',
              refRange: e.resource.referenceRange?.[0]?.text || (e.resource.referenceRange?.[0]?.low && e.resource.referenceRange?.[0]?.high ? \`\${e.resource.referenceRange[0].low.value}-\${e.resource.referenceRange[0].high.value}\` : ''),
            };
          });
          setLabs(results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        })
        .catch(() => setLabs([]))
        .finally(() => setLoading(false));
    }
  }, [patientId, isConnected]);

  const categorizedLabs = useMemo(() => {
    const result: Record<string, LabResult[]> = { all: labs };
    Object.entries(LAB_CATEGORIES).forEach(([key, cat]) => {
      result[key] = labs.filter(l => cat.codes.includes(l.code) || (key === 'other' && !Object.values(LAB_CATEGORIES).some(c => c.codes.includes(l.code))));
    });
    return result;
  }, [labs]);

  const stats = useMemo(() => ({
    total: labs.length,
    abnormal: labs.filter(l => l.status !== 'normal').length,
    high: labs.filter(l => l.status === 'high').length,
    low: labs.filter(l => l.status === 'low').length,
  }), [labs]);

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'high': return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-800', icon: '↑' };
      case 'low': return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800', icon: '↓' };
      case 'critical': return { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-800', badge: 'bg-red-200 text-red-900', icon: '⚠️' };
      default: return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800', icon: '✓' };
    }
  };

  const displayLabs = categorizedLabs[activeCategory] || labs;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Lab Results Viewer</h1>
                <p className="text-sm text-slate-500">Epic FHIR Laboratory Data</p>
              </div>
            </div>
            <span className={\`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium \${isConnected ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20'}\`}>
              <span className={\`w-2 h-2 rounded-full \${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}\`}></span>
              {isConnected ? 'Connected' : 'Not Connected'}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Patient Selection */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-3">Select Patient</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {SANDBOX_PATIENTS.map((p) => (
              <button key={p.id} onClick={() => setPatientId(p.id)} disabled={!isConnected}
                className={\`relative p-4 rounded-xl border-2 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed \${patientId === p.id ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-500/20' : 'bg-white border-slate-200 hover:border-teal-300 hover:shadow-md'}\`}>
                <div className="flex items-center gap-3">
                  <div className={\`w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold \${patientId === p.id ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-600'}\`}>
                    {p.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div className={\`font-semibold \${patientId === p.id ? 'text-teal-900' : 'text-slate-900'}\`}>{p.name}</div>
                    <div className="text-sm text-slate-500">{p.subtitle}</div>
                  </div>
                </div>
                {patientId === p.id && <div className="absolute top-2 right-2"><svg className="w-5 h-5 text-teal-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg></div>}
              </button>
            ))}
          </div>
        </section>

        {patientId && patient.data && (
          <>
            {/* Patient Banner */}
            <section className="mb-6">
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center text-xl font-bold text-teal-700">
                    {patient.data.displayName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{patient.data.displayName}</h2>
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                      <span>DOB: {patient.data.birthDate ? new Date(patient.data.birthDate).toLocaleDateString() : '—'}</span>
                      {patient.data.age !== null && <span>Age: {patient.data.age}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Stats */}
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
                <div className="text-sm text-slate-500">Total Results</div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="text-2xl font-bold text-amber-600">{stats.abnormal}</div>
                <div className="text-sm text-slate-500">Abnormal</div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="text-2xl font-bold text-red-600">{stats.high}</div>
                <div className="text-sm text-slate-500">High Values</div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="text-2xl font-bold text-blue-600">{stats.low}</div>
                <div className="text-sm text-slate-500">Low Values</div>
              </div>
            </section>

            {/* Category Tabs */}
            <section className="mb-4 overflow-x-auto">
              <div className="flex gap-2 min-w-max pb-2">
                <button onClick={() => setActiveCategory('all')} className={\`px-4 py-2 rounded-lg text-sm font-medium transition-colors \${activeCategory === 'all' ? 'bg-teal-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-teal-300'}\`}>
                  All ({labs.length})
                </button>
                {Object.entries(LAB_CATEGORIES).map(([key, cat]) => {
                  const count = categorizedLabs[key]?.length || 0;
                  if (count === 0) return null;
                  return (
                    <button key={key} onClick={() => setActiveCategory(key)} className={\`px-4 py-2 rounded-lg text-sm font-medium transition-colors \${activeCategory === key ? 'bg-teal-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-teal-300'}\`}>
                      {cat.name} ({count})
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Results */}
            <section>
              {loading ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                  <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-slate-500">Loading lab results...</p>
                </div>
              ) : displayLabs.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                  <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  <p className="text-slate-500">No lab results found{activeCategory !== 'all' ? ' in this category' : ''}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {displayLabs.map((lab) => {
                    const styles = getStatusStyles(lab.status);
                    return (
                      <div key={lab.id} className={\`bg-white rounded-xl border p-4 transition-shadow hover:shadow-md \${lab.status !== 'normal' ? styles.border : 'border-slate-200'}\`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-slate-900">{lab.display}</h3>
                              {lab.status !== 'normal' && (
                                <span className={\`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium \${styles.badge}\`}>
                                  {styles.icon} {lab.status.toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                              <span>{new Date(lab.date).toLocaleDateString()}</span>
                              {lab.refRange && <span>Ref: {lab.refRange}</span>}
                            </div>
                          </div>
                          <div className={\`text-right px-4 py-2 rounded-lg \${lab.status !== 'normal' ? styles.bg : 'bg-slate-50'}\`}>
                            <div className={\`text-xl font-bold \${lab.status !== 'normal' ? styles.text : 'text-slate-900'}\`}>
                              {lab.value}
                            </div>
                            <div className="text-xs text-slate-500">{lab.unit}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {/* Empty State */}
        {!patientId && isConnected && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Select a Patient</h3>
            <p className="text-slate-500 mt-2 max-w-md mx-auto">Choose a sandbox patient above to view their laboratory results.</p>
          </div>
        )}
      </main>
    </div>
  );
}
`;
}

function getEpicImmunizationsPage(): string {
  return `'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePatient } from '@/lib/epic-fhir';

const SANDBOX_PATIENTS = [
  { name: 'Camila Lopez', id: 'erXuFYUfucBZaryVksYEcMg3', subtitle: 'Has vaccination records' },
  { name: 'Theodore Mychart', id: 'e63wRTbPfr1p8UW81d8Seiw3', subtitle: 'MyChart patient' },
  { name: 'Derrick Lin', id: 'eq081-VQEgP8drUUqCWzHfw3', subtitle: 'Basic demographics' },
];

interface Immunization {
  id: string;
  vaccine: string;
  date: string;
  status: string;
  site?: string;
  lotNumber?: string;
}

function getPatientName(patient: any): string {
  const name = patient?.name?.[0];
  return name ? \`\${name.given?.join(' ') || ''} \${name.family || ''}\`.trim() : 'Unknown';
}

export default function ImmunizationRecord() {
  const [patientId, setPatientId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [immunizations, setImmunizations] = useState<Immunization[]>([]);
  const [loading, setLoading] = useState(false);

  const patient = usePatient(isConnected ? patientId : null);

  useEffect(() => {
    fetch('/api/epic').then(r => r.json()).then(data => setIsConnected(data.connected)).catch(() => {});
  }, []);

  useEffect(() => {
    if (patientId && isConnected) {
      setLoading(true);
      fetch(\`/api/epic/fhir/Immunization?patient=\${patientId}\`)
        .then(r => r.json())
        .then(data => {
          const results: Immunization[] = (data.entry || []).map((e: any) => ({
            id: e.resource.id,
            vaccine: e.resource.vaccineCode?.coding?.[0]?.display || e.resource.vaccineCode?.text || 'Unknown Vaccine',
            date: e.resource.occurrenceDateTime || '',
            status: e.resource.status || 'completed',
            site: e.resource.site?.coding?.[0]?.display,
            lotNumber: e.resource.lotNumber,
          }));
          setImmunizations(results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        })
        .catch(() => setImmunizations([]))
        .finally(() => setLoading(false));
    }
  }, [patientId, isConnected]);

  const { byYear, totalCount } = useMemo(() => {
    const grouped: Record<string, Immunization[]> = {};
    immunizations.forEach(imm => {
      const year = imm.date ? new Date(imm.date).getFullYear().toString() : 'Unknown';
      if (!grouped[year]) grouped[year] = [];
      grouped[year].push(imm);
    });
    return { byYear: grouped, totalCount: immunizations.length };
  }, [immunizations]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Immunization Record</h1>
                <p className="text-sm text-slate-500">Epic FHIR Integration</p>
              </div>
            </div>
            <span className={\`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium \${isConnected ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20'}\`}>
              <span className={\`w-2 h-2 rounded-full \${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}\`}></span>
              {isConnected ? 'Connected' : 'Not Connected'}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Patient Selection */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-3">Select Patient</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {SANDBOX_PATIENTS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPatientId(p.id)}
                disabled={!isConnected}
                className={\`relative p-4 rounded-xl border-2 text-left transition-all disabled:opacity-50 \${
                  patientId === p.id ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-500/20' : 'bg-white border-slate-200 hover:border-teal-300'
                }\`}
              >
                <div className="flex items-center gap-3">
                  <div className={\`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg \${patientId === p.id ? 'bg-teal-500' : 'bg-slate-400'}\`}>
                    {p.name.charAt(0)}
                  </div>
                  <div>
                    <div className={\`font-semibold \${patientId === p.id ? 'text-teal-900' : 'text-slate-900'}\`}>{p.name}</div>
                    <div className="text-sm text-slate-500">{p.subtitle}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {patientId && (
          <>
            {/* Patient Header */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {patient.loading ? '...' : getPatientName(patient.data)?.charAt(0) || '?'}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{patient.loading ? 'Loading...' : getPatientName(patient.data)}</h2>
                  <div className="text-slate-500">
                    {totalCount} vaccination{totalCount !== 1 ? 's' : ''} on record
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Vaccination Timeline</h3>
                <span className="text-sm text-slate-500">{totalCount} total</span>
              </div>

              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-slate-500">Loading immunizations...</p>
                </div>
              ) : totalCount === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">💉</span>
                  </div>
                  <h3 className="font-medium text-slate-900 mb-1">No Immunizations Found</h3>
                  <p className="text-slate-500">No vaccination records for this patient</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {Object.entries(byYear).sort(([a], [b]) => parseInt(b) - parseInt(a)).map(([year, imms]) => (
                    <div key={year}>
                      <div className="px-6 py-3 bg-slate-50 sticky top-16">
                        <h4 className="font-semibold text-slate-700">{year}</h4>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {imms.map(imm => (
                          <div key={imm.id} className="px-6 py-4 flex items-center gap-4">
                            <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-slate-900">{imm.vaccine}</div>
                              <div className="text-sm text-slate-500">
                                {imm.date ? new Date(imm.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date unknown'}
                                {imm.site && \` • \${imm.site}\`}
                                {imm.lotNumber && \` • Lot: \${imm.lotNumber}\`}
                              </div>
                            </div>
                            <span className={\`px-2.5 py-1 rounded-full text-xs font-medium \${
                              imm.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                              imm.status === 'entered-in-error' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                            }\`}>
                              {imm.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {!patientId && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">{isConnected ? 'Select a Patient' : 'Connect to Epic First'}</h3>
            <p className="text-slate-500">{isConnected ? 'Choose a patient to view their immunization history' : 'Configure Epic connection in Settings'}</p>
          </div>
        )}
      </main>
    </div>
  );
}
`;
}

function getEpicAppointmentsPage(): string {
  return `'use client';

import { useState, useEffect } from 'react';
import { usePatient } from '@/lib/epic-fhir';
import { PatientCard } from '@/components/epic';

const SANDBOX_PATIENTS = [
  { name: 'Theodore Mychart', id: 'e63wRTbPfr1p8UW81d8Seiw3' },
  { name: 'Camila Lopez', id: 'erXuFYUfucBZaryVksYEcMg3' },
];

interface Appointment {
  id: string;
  date: string;
  status: string;
  type: string;
  provider?: string;
  location?: string;
}

export default function AppointmentViewer() {
  const [patientId, setPatientId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);

  const patient = usePatient(isConnected ? patientId : null);

  useEffect(() => {
    fetch('/api/epic').then(r => r.json()).then(data => setIsConnected(data.connected)).catch(() => {});
  }, []);

  useEffect(() => {
    if (patientId && isConnected) {
      setLoading(true);
      fetch(\`/api/epic/fhir/Appointment?patient=\${patientId}\`)
        .then(r => r.json())
        .then(data => {
          const results: Appointment[] = (data.entry || []).map((e: any) => ({
            id: e.resource.id,
            date: e.resource.start || '',
            status: e.resource.status || 'booked',
            type: e.resource.appointmentType?.coding?.[0]?.display || e.resource.serviceType?.[0]?.coding?.[0]?.display || 'Appointment',
            provider: e.resource.participant?.find((p: any) => p.actor?.reference?.startsWith('Practitioner'))?.actor?.display,
            location: e.resource.participant?.find((p: any) => p.actor?.reference?.startsWith('Location'))?.actor?.display,
          }));
          setAppointments(results.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
        })
        .catch(() => setAppointments([]))
        .finally(() => setLoading(false));
    }
  }, [patientId, isConnected]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'booked': return 'text-blue-400 bg-blue-500/10';
      case 'arrived': return 'text-green-400 bg-green-500/10';
      case 'cancelled': return 'text-red-400 bg-red-500/10';
      case 'fulfilled': return 'text-gray-400 bg-gray-500/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-foreground">Appointment Viewer</h1>
        {isConnected ? <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">Connected</span> : <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm">Not Connected</span>}
      </div>

      {!isConnected && <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6"><p className="text-amber-400">Configure Epic token in main platform Settings.</p></div>}

      <div className="flex gap-2 mb-6">
        {SANDBOX_PATIENTS.map((p) => (<button key={p.id} onClick={() => setPatientId(p.id)} disabled={!isConnected} className={\`px-4 py-2 rounded-lg border border-border disabled:opacity-50 \${patientId === p.id ? 'bg-primary text-white' : 'hover:bg-muted text-foreground'}\`}>{p.name}</button>))}
      </div>

      {patientId ? (
        <div className="space-y-6">
          <PatientCard patient={patient.data} loading={patient.loading} error={patient.error} />

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Scheduled Appointments</h2>
            {loading ? (
              <div className="animate-pulse space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded"></div>)}
              </div>
            ) : appointments.length > 0 ? (
              <div className="space-y-3">
                {appointments.map(apt => (
                  <div key={apt.id} className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className="w-12 h-12 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                      <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{apt.type}</p>
                      <p className="text-sm text-muted-foreground">{new Date(apt.date).toLocaleString()}</p>
                      {apt.provider && <p className="text-sm text-muted-foreground">Provider: {apt.provider}</p>}
                      {apt.location && <p className="text-sm text-muted-foreground">Location: {apt.location}</p>}
                    </div>
                    <span className={\`px-2 py-1 rounded text-xs capitalize \${getStatusColor(apt.status)}\`}>{apt.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No appointments found</p>
            )}
          </div>
        </div>
      ) : <div className="text-center py-12 text-muted-foreground">{isConnected ? 'Select a patient above' : 'Connect to Epic first'}</div>}
    </main>
  );
}
`;
}

function getEpicDocumentsPage(): string {
  return `'use client';

import { useState, useEffect } from 'react';
import { usePatient } from '@/lib/epic-fhir';
import { PatientCard } from '@/components/epic';

const SANDBOX_PATIENTS = [
  { name: 'Theodore Mychart', id: 'e63wRTbPfr1p8UW81d8Seiw3' },
  { name: 'Camila Lopez', id: 'erXuFYUfucBZaryVksYEcMg3' },
];

interface Document {
  id: string;
  type: string;
  date: string;
  status: string;
  author?: string;
  description?: string;
}

export default function DocumentViewer() {
  const [patientId, setPatientId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);

  const patient = usePatient(isConnected ? patientId : null);

  useEffect(() => {
    fetch('/api/epic').then(r => r.json()).then(data => setIsConnected(data.connected)).catch(() => {});
  }, []);

  useEffect(() => {
    if (patientId && isConnected) {
      setLoading(true);
      fetch(\`/api/epic/fhir/DocumentReference?patient=\${patientId}\`)
        .then(r => r.json())
        .then(data => {
          const results: Document[] = (data.entry || []).map((e: any) => ({
            id: e.resource.id,
            type: e.resource.type?.coding?.[0]?.display || 'Document',
            date: e.resource.date || e.resource.context?.period?.start || '',
            status: e.resource.status || 'current',
            author: e.resource.author?.[0]?.display,
            description: e.resource.description,
          }));
          setDocuments(results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        })
        .catch(() => setDocuments([]))
        .finally(() => setLoading(false));
    }
  }, [patientId, isConnected]);

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-foreground">Document Viewer</h1>
        {isConnected ? <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">Connected</span> : <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm">Not Connected</span>}
      </div>

      {!isConnected && <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6"><p className="text-amber-400">Configure Epic token in main platform Settings.</p></div>}

      <div className="flex gap-2 mb-6">
        {SANDBOX_PATIENTS.map((p) => (<button key={p.id} onClick={() => setPatientId(p.id)} disabled={!isConnected} className={\`px-4 py-2 rounded-lg border border-border disabled:opacity-50 \${patientId === p.id ? 'bg-primary text-white' : 'hover:bg-muted text-foreground'}\`}>{p.name}</button>))}
      </div>

      {patientId ? (
        <div className="space-y-6">
          <PatientCard patient={patient.data} loading={patient.loading} error={patient.error} />

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Clinical Documents</h2>
            {loading ? (
              <div className="animate-pulse space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded"></div>)}
              </div>
            ) : documents.length > 0 ? (
              <div className="space-y-3">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                    <div className="w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                      <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{doc.type}</p>
                      {doc.description && <p className="text-sm text-foreground/80">{doc.description}</p>}
                      <p className="text-sm text-muted-foreground">{new Date(doc.date).toLocaleDateString()} {doc.author ? \`• \${doc.author}\` : ''}</p>
                    </div>
                    <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded text-xs capitalize">{doc.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No documents found</p>
            )}
          </div>
        </div>
      ) : <div className="text-center py-12 text-muted-foreground">{isConnected ? 'Select a patient above' : 'Connect to Epic first'}</div>}
    </main>
  );
}
`;
}

function getEpicCarePlanPage(): string {
  return `'use client';

import { useState, useEffect } from 'react';
import { usePatient } from '@/lib/epic-fhir';
import { PatientCard } from '@/components/epic';

const SANDBOX_PATIENTS = [
  { name: 'Theodore Mychart', id: 'e63wRTbPfr1p8UW81d8Seiw3' },
  { name: 'Camila Lopez', id: 'erXuFYUfucBZaryVksYEcMg3' },
];

interface CarePlan {
  id: string;
  title: string;
  status: string;
  period?: { start: string; end?: string };
  category?: string;
  goals: string[];
}

export default function CarePlanDisplay() {
  const [patientId, setPatientId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [carePlans, setCarePlans] = useState<CarePlan[]>([]);
  const [loading, setLoading] = useState(false);

  const patient = usePatient(isConnected ? patientId : null);

  useEffect(() => {
    fetch('/api/epic').then(r => r.json()).then(data => setIsConnected(data.connected)).catch(() => {});
  }, []);

  useEffect(() => {
    if (patientId && isConnected) {
      setLoading(true);
      fetch(\`/api/epic/fhir/CarePlan?patient=\${patientId}\`)
        .then(r => r.json())
        .then(data => {
          const results: CarePlan[] = (data.entry || []).map((e: any) => ({
            id: e.resource.id,
            title: e.resource.title || e.resource.category?.[0]?.coding?.[0]?.display || 'Care Plan',
            status: e.resource.status || 'active',
            period: e.resource.period,
            category: e.resource.category?.[0]?.coding?.[0]?.display,
            goals: (e.resource.goal || []).map((g: any) => g.display || g.reference),
          }));
          setCarePlans(results);
        })
        .catch(() => setCarePlans([]))
        .finally(() => setLoading(false));
    }
  }, [patientId, isConnected]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-500/10';
      case 'completed': return 'text-blue-400 bg-blue-500/10';
      case 'revoked': case 'cancelled': return 'text-red-400 bg-red-500/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-foreground">Care Plan Display</h1>
        {isConnected ? <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">Connected</span> : <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm">Not Connected</span>}
      </div>

      {!isConnected && <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6"><p className="text-amber-400">Configure Epic token in main platform Settings.</p></div>}

      <div className="flex gap-2 mb-6">
        {SANDBOX_PATIENTS.map((p) => (<button key={p.id} onClick={() => setPatientId(p.id)} disabled={!isConnected} className={\`px-4 py-2 rounded-lg border border-border disabled:opacity-50 \${patientId === p.id ? 'bg-primary text-white' : 'hover:bg-muted text-foreground'}\`}>{p.name}</button>))}
      </div>

      {patientId ? (
        <div className="space-y-6">
          <PatientCard patient={patient.data} loading={patient.loading} error={patient.error} />

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Active Care Plans</h2>
            {loading ? (
              <div className="animate-pulse space-y-3">
                {[1,2].map(i => <div key={i} className="h-32 bg-muted rounded"></div>)}
              </div>
            ) : carePlans.length > 0 ? (
              <div className="space-y-4">
                {carePlans.map(plan => (
                  <div key={plan.id} className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-foreground">{plan.title}</h3>
                        {plan.category && <p className="text-sm text-muted-foreground">{plan.category}</p>}
                      </div>
                      <span className={\`px-2 py-1 rounded text-xs capitalize \${getStatusColor(plan.status)}\`}>{plan.status}</span>
                    </div>
                    {plan.period && (
                      <p className="text-sm text-muted-foreground mb-3">
                        {new Date(plan.period.start).toLocaleDateString()} - {plan.period.end ? new Date(plan.period.end).toLocaleDateString() : 'Ongoing'}
                      </p>
                    )}
                    {plan.goals.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-foreground mb-2">Goals:</p>
                        <ul className="space-y-1">
                          {plan.goals.map((goal, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span className="w-1.5 h-1.5 rounded-full bg-pink-400"></span>
                              {goal}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No care plans found</p>
            )}
          </div>
        </div>
      ) : <div className="text-center py-12 text-muted-foreground">{isConnected ? 'Select a patient above' : 'Connect to Epic first'}</div>}
    </main>
  );
}
`;
}

export default { buildApp, attemptQuickFix };
