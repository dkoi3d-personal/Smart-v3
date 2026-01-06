/**
 * Structured Logger with Correlation IDs
 *
 * Provides consistent logging with session/build context for tracing
 * requests through the multi-agent system.
 *
 * Usage:
 *   const logger = createLogger('Multi-Agent', { sessionId: 'abc', buildNumber: 1 });
 *   logger.log('Starting build');
 *   // Output: [abc][build-1][Multi-Agent] Starting build
 */

export interface LogContext {
  sessionId?: string;
  buildNumber?: number;
  projectId?: string;
  agentRole?: string;
  storyId?: string;
  instanceNumber?: number;
}

export interface Logger {
  log: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
  child: (prefix: string, additionalContext?: Partial<LogContext>) => Logger;
  getContext: () => LogContext;
}

/**
 * Formats the context prefix for log messages
 * Produces: [session-abc][build-1][projectId] or subset if fields missing
 */
function formatContextPrefix(context: LogContext): string {
  const parts: string[] = [];

  // Short session ID (last 8 chars) for readability
  if (context.sessionId) {
    const shortId = context.sessionId.length > 16
      ? context.sessionId.slice(-8)
      : context.sessionId.replace('session-', '');
    parts.push(`[${shortId}]`);
  }

  if (context.buildNumber !== undefined) {
    parts.push(`[build-${context.buildNumber}]`);
  }

  if (context.agentRole) {
    const roleStr = context.instanceNumber
      ? `${context.agentRole}-${context.instanceNumber}`
      : context.agentRole;
    parts.push(`[${roleStr}]`);
  }

  if (context.storyId) {
    // Short story ID for readability
    const shortStory = context.storyId.length > 12
      ? context.storyId.slice(-8)
      : context.storyId;
    parts.push(`[story:${shortStory}]`);
  }

  return parts.join('');
}

/**
 * Creates a logger instance with bound context
 *
 * @param prefix - Module/component name (e.g., 'Multi-Agent', 'StoryFileManager')
 * @param context - Correlation context (sessionId, buildNumber, etc.)
 * @returns Logger instance with log/warn/error/debug methods
 */
export function createLogger(prefix: string, context: LogContext = {}): Logger {
  const contextPrefix = formatContextPrefix(context);
  const fullPrefix = contextPrefix ? `${contextPrefix}[${prefix}]` : `[${prefix}]`;

  const log = (message: string, ...args: unknown[]) => {
    if (args.length > 0) {
      console.log(`${fullPrefix} ${message}`, ...args);
    } else {
      console.log(`${fullPrefix} ${message}`);
    }
  };

  const warn = (message: string, ...args: unknown[]) => {
    if (args.length > 0) {
      console.warn(`${fullPrefix} ${message}`, ...args);
    } else {
      console.warn(`${fullPrefix} ${message}`);
    }
  };

  const error = (message: string, ...args: unknown[]) => {
    if (args.length > 0) {
      console.error(`${fullPrefix} ${message}`, ...args);
    } else {
      console.error(`${fullPrefix} ${message}`);
    }
  };

  const debug = (message: string, ...args: unknown[]) => {
    // Only log debug messages if DEBUG env var is set
    if (process.env.DEBUG) {
      if (args.length > 0) {
        console.log(`${fullPrefix} [DEBUG] ${message}`, ...args);
      } else {
        console.log(`${fullPrefix} [DEBUG] ${message}`);
      }
    }
  };

  /**
   * Creates a child logger with additional context
   * Useful for adding storyId or agentRole mid-execution
   */
  const child = (childPrefix: string, additionalContext: Partial<LogContext> = {}): Logger => {
    return createLogger(childPrefix, { ...context, ...additionalContext });
  };

  const getContext = (): LogContext => ({ ...context });

  return { log, warn, error, debug, child, getContext };
}

/**
 * Global logger for use before session context is available
 * Use sparingly - prefer contextual loggers
 */
export const globalLogger = createLogger('System');

/**
 * Extract short session ID for display
 */
export function shortSessionId(sessionId: string): string {
  if (!sessionId) return '';
  return sessionId.length > 16 ? sessionId.slice(-8) : sessionId.replace('session-', '');
}
