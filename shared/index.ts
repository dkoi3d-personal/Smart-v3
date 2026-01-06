/**
 * Shared Module
 *
 * Common utilities, services, types, and components
 * used across all features (quick-build, build, fleet).
 *
 * @see README.md for full documentation
 */

// Types
export type {
  BuildMode,
  ProjectStatus,
  TargetPlatform,
  DeploymentProvider,
  DeploymentConfig,
  ProjectConfig,
  ProjectMetadata,
  ProjectState,
  ProjectSummary,
  ApiResponse,
  PaginatedResponse,
  StreamEvent,
  ErrorResponse,
} from './types';

// Utils
export {
  formatDuration,
  formatBytes,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  truncate,
} from './utils';
