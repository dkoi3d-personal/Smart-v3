/**
 * Shared Project Types
 * Used across quick-build and build modes
 */

export type BuildMode = 'quick' | 'complex';

export type ProjectStatus =
  | 'created'
  | 'planning'
  | 'building'
  | 'testing'
  | 'completed'
  | 'error'
  | 'paused';

export type TargetPlatform = 'web' | 'mobile' | 'desktop' | 'api';

export type DeploymentProvider = 'aws' | 'azure' | 'vercel' | 'manual';

export interface DeploymentConfig {
  provider: DeploymentProvider;
  region?: string;
  environment: 'dev' | 'staging' | 'prod';
}

export interface ProjectConfig {
  name: string;
  description?: string;
  techStack: string[];
  requirements: string;
  targetPlatform: TargetPlatform;
  deployment?: DeploymentConfig;
}

export interface ProjectMetadata {
  projectId: string;
  projectDir: string;
  buildType: BuildMode;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectState extends ProjectMetadata {
  config: ProjectConfig;
  status: ProjectStatus;
  progress: number;
  errors: string[];
}

export interface ProjectSummary {
  projectId: string;
  name: string;
  buildType: BuildMode;
  status: ProjectStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
}
