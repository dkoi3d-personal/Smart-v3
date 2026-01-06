/**
 * Healthcare Module System Types
 *
 * This module provides type definitions for the healthcare module registry
 * that serves /quick-build, /build, and /fleet systems.
 */

// =============================================================================
// CORE MODULE TYPES
// =============================================================================

export type ModuleCategory =
  | 'clinical'        // Patient data, vitals, labs, medications
  | 'administrative'  // Scheduling, registration, consent
  | 'financial'       // Billing, claims, payments
  | 'integration'     // FHIR, HL7, Epic, Cerner
  | 'security'        // Auth, HIPAA, encryption
  | 'portal';         // Patient-facing features

export type ModuleLevel =
  | 1  // Micro: Single functions/utilities
  | 2  // Component: Reusable UI/logic units
  | 3  // Feature: Multi-file features
  | 4  // Integration: External system connectors
  | 5; // Domain: Complete subsystems

export type PHIHandling = 'none' | 'display' | 'storage' | 'transmission';

// =============================================================================
// MODULE FILE TYPES
// =============================================================================

export interface ModuleFile {
  /** Relative path within the module, e.g., 'components/PatientBanner.tsx' */
  path: string;

  /** File type for categorization */
  type: 'component' | 'hook' | 'util' | 'service' | 'type' | 'test' | 'api' | 'config';

  /** The actual file content */
  content: string;

  /** Points where the agent should customize this file */
  customizationPoints?: CustomizationPoint[];
}

export interface CustomizationPoint {
  /** Line number (1-indexed) where customization should happen */
  line: number;

  /** Description of what to customize */
  description: string;

  /** Example of the customization */
  example?: string;
}

// =============================================================================
// COMPLIANCE & REQUIREMENTS
// =============================================================================

export interface ModuleCompliance {
  /** Whether this module handles HIPAA-relevant data */
  hipaaRelevant: boolean;

  /** Whether using this module requires a BAA */
  requiresBAA: boolean;

  /** How this module handles PHI */
  phiHandling: PHIHandling;

  /** Certifications this module supports */
  certifications: string[];

  /** Specific regulations addressed */
  regulations?: string[];
}

export interface ModuleDependencies {
  /** Other module IDs that must be installed first */
  modules: string[];

  /** npm packages required with versions */
  packages: Record<string, string>;

  /** External services needed (e.g., 'epic-fhir', 'clearinghouse') */
  services: string[];

  /** FHIR resources this module interacts with */
  fhirResources: string[];
}

// =============================================================================
// QUICK BUILD MODE
// =============================================================================

export interface QuickBuildConfig {
  /** Whether this module supports quick-build (instant, no AI) */
  enabled: boolean;

  /** Simplified files for instant deployment */
  files: ModuleFile[];

  /** npm dependencies to add to package.json */
  dependencies: Record<string, string>;

  /** Dev dependencies to add */
  devDependencies?: Record<string, string>;

  /** Optional database setup for quick-build */
  databaseSetup?: {
    provider: 'sqlite' | 'postgres';
    schema: string;
  };
}

// =============================================================================
// AGENT BUILD MODE (for /build and /fleet)
// =============================================================================

export interface AgentBuildConfig {
  /** Whether this module supports agent-based building */
  enabled: boolean;

  /** Full-featured files with customization points */
  files: ModuleFile[];

  /** Markdown guide for the AI agent on how to customize */
  customizationGuide: string;

  /** Acceptance criteria the agent should verify */
  acceptanceCriteria: string[];

  /** Anti-patterns the agent should avoid */
  antiPatterns?: string[];

  /** Quality checklist for completion */
  qualityChecklist?: string[];
}

// =============================================================================
// DOCUMENTATION
// =============================================================================

export interface ModuleDocumentation {
  /** High-level overview */
  overview: string;

  /** Quick start guide */
  quickStart: string;

  /** API reference */
  apiReference?: string;

  /** Code examples */
  examples: CodeExample[];
}

export interface CodeExample {
  /** Example title */
  title: string;

  /** Description of what this example shows */
  description: string;

  /** The actual code */
  code: string;

  /** Language for syntax highlighting */
  language: 'typescript' | 'tsx' | 'json' | 'bash';
}

// =============================================================================
// MAIN MODULE INTERFACE
// =============================================================================

export interface HealthcareModule {
  /** Unique identifier, e.g., 'patient-fhir-display-v1' */
  id: string;

  /** Human-readable name */
  name: string;

  /** Semantic version */
  version: string;

  /** Brief description */
  description: string;

  /** Module category */
  category: ModuleCategory;

  /** Complexity level (1-5) */
  level: ModuleLevel;

  // -------------------------------------------------------------------------
  // MATCHING & DISCOVERY
  // -------------------------------------------------------------------------

  /** Keywords for matching against user requirements */
  keywords: string[];

  /** Regex patterns to match against story titles/descriptions */
  storyPatterns: string[];

  /** Domain IDs this module is relevant for */
  domainMatches: string[];

  // -------------------------------------------------------------------------
  // MODE-SPECIFIC CONFIGURATIONS
  // -------------------------------------------------------------------------

  /** Configuration for /quick-build (instant templates) */
  quickBuild: QuickBuildConfig;

  /** Configuration for /build and /fleet (AI customization) */
  agentBuild: AgentBuildConfig;

  // -------------------------------------------------------------------------
  // COMPLIANCE & DEPENDENCIES
  // -------------------------------------------------------------------------

  /** Compliance information */
  compliance: ModuleCompliance;

  /** Dependencies */
  dependencies: ModuleDependencies;

  // -------------------------------------------------------------------------
  // DOCUMENTATION & METADATA
  // -------------------------------------------------------------------------

  /** Documentation */
  documentation: ModuleDocumentation;

  /** Test coverage percentage */
  testCoverage?: number;

  /** Last security audit date */
  lastAuditDate?: string;

  /** Known issues or limitations */
  knownIssues?: string[];

  /** Tags for additional categorization */
  tags?: string[];
}

// =============================================================================
// MATCHING TYPES
// =============================================================================

export interface ModuleMatch {
  /** The matched module ID */
  moduleId: string;

  /** Match confidence score (0-100) */
  score: number;

  /** Reason for the match */
  reason: string;

  /** Which keywords matched */
  matchedKeywords: string[];

  /** Which patterns matched */
  matchedPatterns: string[];
}

export interface ModuleMatchOptions {
  /** Minimum score threshold (default: 40) */
  minScore?: number;

  /** Maximum number of matches to return (default: 3) */
  maxMatches?: number;

  /** Required category filter */
  category?: ModuleCategory;

  /** Maximum level filter */
  maxLevel?: ModuleLevel;
}

// =============================================================================
// REGISTRY TYPES
// =============================================================================

export interface ModuleRegistryOptions {
  /** Base directory for module files */
  modulesDir?: string;

  /** Whether to validate modules on load */
  validateOnLoad?: boolean;
}

export interface ModuleUsageRecord {
  /** Module ID */
  moduleId: string;

  /** Project ID where used */
  projectId: string;

  /** Story ID (for build/fleet) */
  storyId?: string;

  /** Whether the usage was successful */
  success: boolean;

  /** Customizations made by the agent */
  customizations?: string[];

  /** Timestamp */
  timestamp: Date;
}

// =============================================================================
// ADAPTER TYPES
// =============================================================================

export interface QuickBuildAdapterResult {
  /** Files to add to the project */
  files: Array<{ path: string; content: string }>;

  /** Dependencies to add to package.json */
  dependencies: Record<string, string>;

  /** Dev dependencies to add */
  devDependencies: Record<string, string>;

  /** Modules that were matched */
  matchedModules: string[];
}

export interface AgentBuildAdapterResult {
  /** Module context to inject into agent prompt */
  promptContext: string;

  /** Files to pre-copy to project/worktree */
  files: Array<{ path: string; content: string }>;

  /** Acceptance criteria from modules */
  acceptanceCriteria: string[];

  /** Modules that were matched */
  matchedModules: string[];
}

// =============================================================================
// STORY INTEGRATION TYPES
// =============================================================================

export interface StoryWithModules {
  /** Original story ID */
  storyId: string;

  /** Recommended modules for this story */
  recommendedModules: ModuleMatch[];

  /** Whether modules were pre-populated */
  modulesApplied: boolean;
}

export interface ModuleAnalysisResult {
  /** Stories that can use modules */
  storiesWithModules: StoryWithModules[];

  /** Total potential time savings (estimated minutes) */
  estimatedTimeSavings: number;

  /** Modules recommended across all stories */
  uniqueModulesRecommended: string[];
}
