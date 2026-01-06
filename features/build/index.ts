/**
 * Complex Build Feature
 *
 * Production-ready multi-agent development with full quality gates.
 * Manages medium-complexity projects with parallel specialized agents.
 *
 * @see README.md for full documentation
 */

// Components
export { BuildHeader, AgentChatPanel, MetricsPanel } from './components';

// Hooks
export { useBuildState, useFileTree, useBuildPreview, usePreviewServer } from './hooks';
export type { BuildStateConfig, UseFileTreeOptions, UsePreviewServerOptions } from './hooks';

// Services - Build API with clean-slate architecture
export {
  startMultiAgentBuild,
  startNewBuildOnExistingProject,
  buildExistingProjectRequirements,
  buildFigmaExistingProjectRequirements,
  extractFigmaDesign,
  saveFigmaContext,
  downloadFigmaFrames,
  setupFigmaForBuild,
} from './services';
export type {
  BuildConfig,
  CoderConfig,
  FigmaDesignContext,
} from './services';

// Constants
export {
  AGENT_COLORS,
  AGENT_BG_COLORS,
  AGENT_ICONS,
  AGENT_NAMES,
  KANBAN_COLUMNS,
  STATUS_TO_COLUMN,
  DEFAULT_BUILD_METRICS,
  DEFAULT_TESTING_METRICS,
} from './constants';

// Types
export type {
  Epic,
  Task,
  TaskStatus,
  AgentRole,
  MessageType,
  AgentMessage,
  ResearchSuggestion,
  FileChange,
  BuildLogType,
  BuildLog,
  BuildMetrics,
  DoraRating,
  DoraMetrics,
  SecurityGrade,
  RiskLevel,
  Severity,
  OwaspStatus,
  SecurityVulnerability,
  SecurityMetrics,
  TestingMetrics,
  TreeNode,
  BuildPhase,
  KanbanColumn,
  BuildState,
  ComplexBuildContext,
  QuickSettings,
  PreviewStatus,
  ConnectionStatus,
  MainTab,
  CheckpointInfo,
} from './types';
