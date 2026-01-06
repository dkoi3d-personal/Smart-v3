/**
 * Architecture Documentation Types
 * Types for diagrams, data models, API documentation, and agent documentation
 */

// Diagram Types
export type DiagramType =
  | 'system-overview'
  | 'component-diagram'
  | 'sequence-diagram'
  | 'data-flow'
  | 'deployment-diagram'
  | 'entity-relationship'
  | 'class-diagram'
  | 'api-flow'
  | 'state-management'      // Context providers, stores, state flow
  | 'module-dependencies'   // File/module import dependencies
  | 'route-structure';      // Page/routing structure for Next.js/React Router

export type DiagramFormat = 'mermaid' | 'plantuml' | 'ascii' | 'svg';

export interface ArchitectureDiagram {
  id: string;
  name: string;
  type: DiagramType;
  format: DiagramFormat;
  content: string; // Mermaid/PlantUML code or SVG
  description: string;
  components: string[];
  lastUpdated: Date;
  version: number;
}

// Component Documentation
export interface ComponentDoc {
  id: string;
  name: string;
  path: string;
  type: 'page' | 'component' | 'hook' | 'service' | 'store' | 'api' | 'utility' | 'layout';
  description: string;
  props?: PropDefinition[];
  dependencies: string[];
  dependents: string[];
  exports: string[];
  complexity: 'low' | 'medium' | 'high';
  linesOfCode: number;
  lastModified: Date;
}

export interface PropDefinition {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  description: string;
}

// Data Model Category - distinguishes real data models from UI props
export type DataModelCategory =
  | 'data'      // Real data/domain models (Lead, User, Doctor)
  | 'props'     // React component props (XxxProps)
  | 'context'   // Context value types (XxxContextValue)
  | 'enum'      // Enumeration types
  | 'state'     // State types (XxxState)
  | 'config'    // Configuration types (XxxConfig, XxxOptions)
  | 'response'  // API response types (XxxResponse)
  | 'request'   // API request types (XxxRequest, XxxPayload)
  | 'utility';  // Utility/helper types

// Data Model Documentation
export interface DataModel {
  id: string;
  name: string;
  description: string;
  fields: DataField[];
  relationships: DataRelationship[];
  source: 'typescript' | 'database' | 'api';
  filePath?: string;
  examples?: Record<string, unknown>;
  category?: DataModelCategory;  // Categorization for filtering
}

export interface DataField {
  name: string;
  type: string;
  required: boolean;
  description: string;
  constraints?: string[];
  defaultValue?: string;
}

export interface DataRelationship {
  targetModel: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  fieldName: string;
  description: string;
}

// API Documentation (OpenAPI/Swagger-like)
export interface APIEndpoint {
  id: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  summary: string;
  description: string;
  tags: string[];
  parameters: APIParameter[];
  requestBody?: APIRequestBody;
  responses: APIResponse[];
  authentication?: 'none' | 'api_key' | 'bearer' | 'basic';
  rateLimit?: string;
  deprecated?: boolean;
  examples?: APIExample[];
}

export interface APIParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  type: string;
  required: boolean;
  description: string;
  example?: string;
  schema?: Record<string, unknown>;
}

export interface APIRequestBody {
  description: string;
  required: boolean;
  contentType: string;
  schema: Record<string, unknown>;
  example?: Record<string, unknown>;
}

export interface APIResponse {
  statusCode: number;
  description: string;
  contentType?: string;
  schema?: Record<string, unknown>;
  example?: Record<string, unknown>;
}

export interface APIExample {
  name: string;
  description: string;
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
}

export interface APIDocumentation {
  title: string;
  version: string;
  description: string;
  baseUrl: string;
  endpoints: APIEndpoint[];
  tags: APITag[];
  schemas: Record<string, DataModel>;
  lastGenerated: Date;
}

export interface APITag {
  name: string;
  description: string;
}

// Agent Documentation
export interface AgentDocumentation {
  id: string;
  name: string;
  type: string;
  description: string;
  responsibilities: string[];
  capabilities: string[];
  tools: AgentTool[];
  inputs: AgentInput[];
  outputs: AgentOutput[];
  systemPrompt?: string;
  interactions: AgentInteraction[];
  examples: AgentExample[];
  limitations?: string[];
  bestPractices?: string[];
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: {
    name: string;
    type: string;
    required: boolean;
    description: string;
  }[];
}

export interface AgentInput {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

export interface AgentOutput {
  name: string;
  type: string;
  description: string;
}

export interface AgentInteraction {
  withAgent: string;
  type: 'triggers' | 'receives_from' | 'coordinates_with';
  description: string;
}

export interface AgentExample {
  scenario: string;
  input: string;
  output: string;
  notes?: string;
}

// Architecture Overview
export interface ArchitectureOverview {
  projectId: string;
  projectName: string;
  description: string;
  techStack: TechStackItem[];
  diagrams: ArchitectureDiagram[];
  components: ComponentDoc[];
  dataModels: DataModel[];
  apiDocumentation?: APIDocumentation;
  agents: AgentDocumentation[];
  designPatterns: DesignPattern[];
  securityArchitecture?: SecurityArchitecture;
  deploymentArchitecture?: DeploymentArchitecture;
  lastUpdated: Date;
  version: string;
  generatedBy: 'manual' | 'agent' | 'hybrid';
}

export interface TechStackItem {
  category: 'frontend' | 'backend' | 'database' | 'infrastructure' | 'testing' | 'devops' | 'ai';
  name: string;
  version?: string;
  purpose: string;
  documentation?: string;
}

export interface DesignPattern {
  name: string;
  category: 'architectural' | 'behavioral' | 'creational' | 'structural';
  description: string;
  usage: string[];
  files: string[];
}

export interface SecurityArchitecture {
  authenticationMethod: string;
  authorizationModel: string;
  dataEncryption: string;
  secretsManagement: string;
  compliance: string[];
  vulnerabilityManagement: string;
}

export interface DeploymentArchitecture {
  provider: string;
  services: DeploymentService[];
  regions: string[];
  scalingStrategy: string;
  backupStrategy: string;
  monitoringTools: string[];
}

export interface DeploymentService {
  name: string;
  type: string;
  purpose: string;
  configuration?: Record<string, unknown>;
}

// Generation Status
export interface ArchitectureGenerationStatus {
  projectId: string;
  status: 'idle' | 'analyzing' | 'generating' | 'complete' | 'error';
  currentPhase?: string;
  progress: number;
  stages: GenerationStage[];
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface GenerationStage {
  name: string;
  status: 'pending' | 'in_progress' | 'complete' | 'error';
  description: string;
  progress: number;
}

// Architecture Events
export type ArchitectureEventType =
  | 'diagram:created'
  | 'diagram:updated'
  | 'component:analyzed'
  | 'api:documented'
  | 'agent:documented'
  | 'model:extracted'
  | 'generation:started'
  | 'generation:progress'
  | 'generation:complete'
  | 'generation:error';

export interface ArchitectureEvent {
  type: ArchitectureEventType;
  projectId: string;
  timestamp: Date;
  data: unknown;
}
