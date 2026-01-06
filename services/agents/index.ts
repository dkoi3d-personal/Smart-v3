/**
 * Agent Types and Utilities
 *
 * This module exports shared types and utilities for the multi-agent system.
 * Extracted from multi-agent-service.ts for better maintainability.
 */

// Types
export * from './types';

// Configurations
export { AGENT_CONFIGS, type AgentConfig } from './configs/prompts';
export { getTools } from './configs/tools';

// Tool handlers (registry pattern for O(1) tool execution)
export {
  registerTool,
  getToolHandler,
  executeToolFromRegistry,
  hasToolHandler,
  getRegisteredTools,
  type ToolContext,
  type ToolHandler,
} from './tool-handlers';

// Context helpers
export {
  getProjectSourceInfo,
  loadFigmaContext,
  getFigmaProductOwnerInstructions,
  getFigmaCoderInstructions,
  getDesignTokenInstructions,
  type ProjectSourceInfo,
} from './figma-context';

export {
  loadProjectArchitecture,
  formatArchitectureForPrompt,
  getArchitectureContext,
  preloadArchitecture,
  clearArchitectureCache,
  type ArchitectureContext,
} from './architecture-context';

// Learning memory
export {
  getLearningsContext,
  captureErrorLearning,
  capturePatternLearning,
  captureAgentOutputLearnings,
  detectTechStack,
} from './learning-memory';
