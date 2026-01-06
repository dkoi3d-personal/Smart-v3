/**
 * Quick Build Feature Types
 */

export interface BuildProgress {
  phase: BuildPhase;
  message: string;
  details?: string;
  filesCreated?: string[];
  error?: string;
}

export type BuildPhase =
  | 'planning'
  | 'creating'
  | 'epic-setup'
  | 'installing'
  | 'building'
  | 'database'
  | 'complete'
  | 'error';

export interface DatabaseConfig {
  provider: 'none' | 'sqlite' | 'neon' | 'supabase' | 'aws-rds';
  schemaTemplate: 'auto' | 'authentication' | 'blog' | 'ecommerce' | 'saas' | 'todoApp';
}

export interface ExamplePrompt {
  title: string;
  description: string;
  prompt: string;
}

export interface QuickBuildState {
  requirements: string;
  projectId: string | null;
  building: boolean;
  progress: BuildProgress | null;
  logs: string[];
  databaseConfig: DatabaseConfig | null;
}

export interface PreviewState {
  url: string | null;
  loading: boolean;
  error: string | null;
}

export interface BuildResult {
  success: boolean;
  error?: string;
  projectDir: string;
}

// ===== NEW TEMPLATE-BASED TYPES =====

export interface EpicApiSelection {
  apiId: string;
  resourceType: string;
  displayName: string;
  isFromTemplate: boolean; // Was this in the base template?
  isRequired: boolean; // Can't be removed (e.g., Patient)
  generateComponents: string[];
  generateHooks: string[];
}

export interface QuickBuildConfig {
  // Template selection
  templateId: string;
  appName: string;

  // Epic API selections (includes template defaults + user additions)
  epicApis: EpicApiSelection[];

  // Feature toggles from template
  enabledFeatures: string[];

  // Design & DB
  designSystemId?: string;
  databaseConfig?: DatabaseConfig;
}

export interface TemplateSelectionState {
  // Current step: 'gallery' | 'configure' | 'building'
  step: 'gallery' | 'configure' | 'building';

  // Selected template
  selectedTemplateId: string | null;

  // Configuration
  config: QuickBuildConfig | null;

  // Build state
  projectId: string | null;
  building: boolean;
  progress: BuildProgress | null;
  logs: string[];
}

export type QuickBuildStep = 'gallery' | 'configure' | 'building';
