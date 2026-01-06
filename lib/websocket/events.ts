/**
 * WebSocket Event Types and Helpers
 */

export type WSEventType =
  | 'connected'
  | 'story:update'
  | 'code:change'
  | 'test:result'
  | 'security:alert'
  | 'deployment:progress'
  | 'agent:status'
  | 'agent:message'
  | 'clarification:request'
  | 'clarification:response'
  | 'approval:request'
  | 'approval:response'
  | 'workflow:status'
  | 'notification'
  | 'error';

export interface WSEvent<T = any> {
  type: WSEventType;
  payload: T;
  timestamp: Date;
}

export interface StoryUpdateEvent {
  id: string;
  status: 'backlog' | 'in_progress' | 'testing' | 'done';
  progress: number;
  assignedAgent?: string;
}

export interface CodeChangeEvent {
  file: string;
  content: string;
  language: string;
  action: 'created' | 'modified' | 'deleted';
  animateTyping?: boolean;
  typingSpeed?: number;
}

export interface TestResultEvent {
  testSuite: string;
  passed: number;
  failed: number;
  coverage: {
    lines: number;
    statements: number;
    functions: number;
    branches: number;
  };
  failedTests?: Array<{
    name: string;
    error: string;
  }>;
}

export interface SecurityAlertEvent {
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  file?: string;
  autoFixAvailable: boolean;
}

export interface DeploymentProgressEvent {
  step: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  logs?: string[];
}

export interface AgentStatusEvent {
  agentId: string;
  type: string;
  status: 'idle' | 'thinking' | 'working' | 'waiting' | 'error' | 'completed';
  currentTask?: string;
  progress?: number;
}

export interface AgentMessageEvent {
  agentId: string;
  agentType: string;
  type: 'info' | 'question' | 'error' | 'success';
  content: string;
  metadata?: Record<string, any>;
}

export interface ClarificationRequestEvent {
  id: string;
  agentId: string;
  question: string;
  context: string;
  options?: string[];
  priority: 'blocking' | 'high' | 'normal';
}

export interface ApprovalRequestEvent {
  id: string;
  type: 'deployment' | 'architecture' | 'cost' | 'security';
  message: string;
  details: any;
  estimatedCost?: number;
}

export interface NotificationEvent {
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  requiresResponse?: boolean;
}

export interface WorkflowStatusEvent {
  status: 'idle' | 'planning' | 'developing' | 'testing' | 'deploying' | 'completed' | 'error';
  details?: any;
}
