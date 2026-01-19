/**
 * UAT Workflow Types
 *
 * Types for browser-based UI testing workflows using Computer Use + Playwright
 */

// =============================================================================
// Workflow Types
// =============================================================================

export interface UIWorkflow {
  id: string;
  name: string;
  description: string;
  projectId: string;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;

  // Priority for regression testing
  priority: 'critical' | 'high' | 'medium' | 'low';

  // Brand configuration for visual validation
  brandConfig?: BrandConfig;

  // Recording metadata
  recordedFrom?: {
    url: string;
    viewport: { width: number; height: number };
  };
  recordedBy?: string;

  // Execution statistics
  stats: {
    runCount: number;
    passCount: number;
    failCount: number;
    passRate: number;        // 0-100
    avgDuration: number;     // ms
    lastRun?: {
      date: string;
      status: 'passed' | 'failed';
      duration: number;
      executionId: string;
    };
  };
}

export interface WorkflowStep {
  id: string;
  sequence: number;
  action: WorkflowAction;
  selector?: string;  // CSS selector or XPath
  value?: string;     // For type actions
  url?: string;       // For navigate actions
  coordinates?: { x: number; y: number };  // For click actions
  waitFor?: WaitCondition;
  assertion?: StepAssertion;
  screenshot?: {
    before?: string;  // Base64 or path
    after?: string;
  };
  // Metadata from recording
  timestamp?: number;
  elementInfo?: {
    tagName: string;
    text?: string;
    attributes?: Record<string, string>;
  };
}

export type WorkflowAction =
  | 'navigate'
  | 'click'
  | 'type'
  | 'select'
  | 'hover'
  | 'scroll'
  | 'wait'
  | 'screenshot'
  | 'assert';

export interface WaitCondition {
  type: 'selector' | 'url' | 'timeout' | 'networkIdle';
  value: string | number;
  timeout?: number;
}

export interface StepAssertion {
  type: 'visible' | 'text' | 'value' | 'url' | 'brand-compliant' | 'custom';
  expected: string;
  actual?: string;
  passed?: boolean;
}

// =============================================================================
// Brand Configuration
// =============================================================================

export interface BrandConfig {
  name: string;  // e.g., "Employers"
  colors: {
    primary: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
  };
  logo?: {
    selector?: string;
    expectedSrc?: string;
  };
  typography?: {
    fontFamily?: string;
    headingFont?: string;
  };
}

// Default Employers brand config
export const EMPLOYERS_BRAND: BrandConfig = {
  name: 'Employers',
  colors: {
    primary: '#F97316',    // Orange
    secondary: '#1E3A5F',  // Navy
    accent: '#10B981',     // Green
    background: '#FFFFFF',
    text: '#1F2937',
  },
  logo: {
    selector: '[data-testid="employers-logo"], .employers-logo, img[alt*="Employers"]',
  },
  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',
  },
};

// =============================================================================
// Execution Types
// =============================================================================

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  projectId: string;
  status: 'running' | 'passed' | 'failed' | 'stopped';
  startedAt: string;
  completedAt?: string;
  results: StepResult[];
  summary?: ExecutionSummary;
}

export interface StepResult {
  stepId: string;
  sequence: number;
  status: 'passed' | 'failed' | 'skipped';
  action: WorkflowAction;
  duration: number;  // ms
  error?: string;
  screenshot?: string;  // Base64
  assertion?: StepAssertion;
}

export interface ExecutionSummary {
  totalSteps: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  failedSteps: {
    stepId: string;
    action: string;
    error: string;
  }[];
}

// =============================================================================
// Computer Use Types
// =============================================================================

export interface ComputerUseAction {
  type: 'screenshot' | 'click' | 'type' | 'key' | 'scroll' | 'move';
  coordinate?: [number, number];
  text?: string;
  key?: string;
  scrollDirection?: 'up' | 'down' | 'left' | 'right';
  scrollAmount?: number;
}

export interface ComputerUseResult {
  success: boolean;
  screenshot?: string;  // Base64
  error?: string;
}

// =============================================================================
// Recording Types
// =============================================================================

export interface RecordingSession {
  id: string;
  projectId: string;
  status: 'recording' | 'stopped' | 'processing';
  startedAt: string;
  url: string;
  viewport: { width: number; height: number };
  events: RecordedEvent[];
}

export interface RecordedEvent {
  timestamp: number;
  type: 'click' | 'input' | 'navigation' | 'scroll';
  target?: {
    selector: string;
    tagName: string;
    text?: string;
    attributes?: Record<string, string>;
  };
  value?: string;
  url?: string;
  coordinates?: { x: number; y: number };
}

// =============================================================================
// Batch Execution Types (Run All Workflows)
// =============================================================================

export interface BatchExecution {
  id: string;
  projectId: string;
  status: 'running' | 'completed' | 'stopped';
  startedAt: string;
  completedAt?: string;
  mode: 'all' | 'failed' | 'critical';
  results: BatchWorkflowResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
}

export interface BatchWorkflowResult {
  workflowId: string;
  workflowName: string;
  priority: string;
  status: 'passed' | 'failed' | 'skipped' | 'running';
  duration: number;
  executionId?: string;
  error?: string;
  failedStep?: {
    stepId: string;
    action: string;
    error: string;
  };
}

// =============================================================================
// Auto-Fix Types
// =============================================================================

export interface AutoFixRequest {
  workflowId: string;
  executionId: string;
  failedStep: StepResult;
  screenshot: string;
  domSnapshot?: string;
  relevantFiles?: string[];
}

export interface AutoFixResult {
  success: boolean;
  fix?: {
    file: string;
    description: string;
    diff?: string;
  };
  error?: string;
  retryRecommended: boolean;
}
