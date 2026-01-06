/**
 * Session Service - Manage independent sessions for each project
 * Each project maintains its own session state, allowing parallel development
 */

import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { ProjectSession, AgentMessage } from '@/lib/agents/types';

// In-memory session store for active sessions
const activeSessions = new Map<string, ProjectSession>();

// Session file name within project directory
const SESSION_FILE = 'session-state.json';

export interface SessionCreateOptions {
  projectId: string;
  projectDir: string;
  resumeIfExists?: boolean;
}

/**
 * Create or resume a session for a project
 */
export async function createSession(
  options: SessionCreateOptions
): Promise<ProjectSession> {
  const { projectId, projectDir, resumeIfExists = true } = options;

  // Check if session already active in memory
  const existingSession = activeSessions.get(projectId);
  if (existingSession && existingSession.status !== 'idle') {
    existingSession.lastActiveAt = new Date();
    return existingSession;
  }

  // Try to load persisted session
  if (resumeIfExists) {
    const persistedSession = await loadSessionFromDisk(projectDir);
    if (persistedSession) {
      persistedSession.status = 'active';
      persistedSession.lastActiveAt = new Date();
      activeSessions.set(projectId, persistedSession);
      await saveSessionToDisk(projectDir, persistedSession);
      console.log(`🔄 Resumed session ${persistedSession.sessionId} for project ${projectId}`);
      return persistedSession;
    }
  }

  // Create new session
  const session: ProjectSession = {
    sessionId: uuidv4(),
    projectId,
    startedAt: new Date(),
    lastActiveAt: new Date(),
    status: 'active',
    messages: [],
    terminalOutput: [],
  };

  activeSessions.set(projectId, session);
  await saveSessionToDisk(projectDir, session);
  console.log(`✅ Created new session ${session.sessionId} for project ${projectId}`);

  return session;
}

/**
 * Get the current session for a project
 */
export function getSession(projectId: string): ProjectSession | undefined {
  return activeSessions.get(projectId);
}

/**
 * Get all active sessions
 */
export function getAllSessions(): ProjectSession[] {
  return Array.from(activeSessions.values());
}

/**
 * Update session state
 */
export async function updateSession(
  projectId: string,
  projectDir: string,
  updates: Partial<ProjectSession>
): Promise<ProjectSession | undefined> {
  const session = activeSessions.get(projectId);
  if (!session) {
    console.warn(`⚠️ No session found for project ${projectId}`);
    return undefined;
  }

  // Apply updates
  Object.assign(session, updates, { lastActiveAt: new Date() });

  // Persist to disk
  await saveSessionToDisk(projectDir, session);

  return session;
}

/**
 * Add a message to the session
 */
export async function addSessionMessage(
  projectId: string,
  projectDir: string,
  message: AgentMessage
): Promise<void> {
  const session = activeSessions.get(projectId);
  if (!session) {
    console.warn(`⚠️ No session found for project ${projectId}`);
    return;
  }

  // Avoid duplicates
  if (!session.messages.some((m) => m.id === message.id)) {
    session.messages.push(message);
    session.lastActiveAt = new Date();
    await saveSessionToDisk(projectDir, session);
  }
}

/**
 * Add terminal output to the session
 */
export async function addTerminalOutput(
  projectId: string,
  projectDir: string,
  output: string
): Promise<void> {
  const session = activeSessions.get(projectId);
  if (!session) {
    return;
  }

  session.terminalOutput.push(output);
  // Keep last 1000 lines
  if (session.terminalOutput.length > 1000) {
    session.terminalOutput = session.terminalOutput.slice(-1000);
  }
  session.lastActiveAt = new Date();

  // Batch save terminal output (don't save on every line)
  // The session will be saved on next meaningful update
}

/**
 * Pause a session
 */
export async function pauseSession(
  projectId: string,
  projectDir: string
): Promise<void> {
  const session = activeSessions.get(projectId);
  if (!session) {
    console.warn(`⚠️ No session found for project ${projectId}`);
    return;
  }

  session.status = 'paused';
  session.lastActiveAt = new Date();
  await saveSessionToDisk(projectDir, session);
  console.log(`⏸️ Paused session ${session.sessionId}`);
}

/**
 * Resume a paused session
 */
export async function resumeSession(
  projectId: string,
  projectDir: string
): Promise<ProjectSession | undefined> {
  const session = activeSessions.get(projectId);
  if (!session) {
    // Try to load from disk
    const persistedSession = await loadSessionFromDisk(projectDir);
    if (persistedSession) {
      persistedSession.status = 'active';
      persistedSession.lastActiveAt = new Date();
      activeSessions.set(projectId, persistedSession);
      await saveSessionToDisk(projectDir, persistedSession);
      console.log(`▶️ Resumed session ${persistedSession.sessionId} from disk`);
      return persistedSession;
    }
    return undefined;
  }

  session.status = 'active';
  session.lastActiveAt = new Date();
  await saveSessionToDisk(projectDir, session);
  console.log(`▶️ Resumed session ${session.sessionId}`);
  return session;
}

/**
 * End a session (set to idle)
 */
export async function endSession(
  projectId: string,
  projectDir: string
): Promise<void> {
  const session = activeSessions.get(projectId);
  if (!session) {
    return;
  }

  session.status = 'idle';
  session.currentAgentId = undefined;
  session.currentTaskId = undefined;
  session.lastActiveAt = new Date();
  await saveSessionToDisk(projectDir, session);
  console.log(`⏹️ Ended session ${session.sessionId}`);
}

/**
 * Completely remove a session
 */
export async function destroySession(
  projectId: string,
  projectDir: string
): Promise<void> {
  activeSessions.delete(projectId);

  try {
    const sessionFile = path.join(projectDir, SESSION_FILE);
    await fs.unlink(sessionFile);
    console.log(`🗑️ Destroyed session for project ${projectId}`);
  } catch {
    // File might not exist
  }
}

/**
 * Set the current agent working on the session
 */
export async function setCurrentAgent(
  projectId: string,
  projectDir: string,
  agentId: string | undefined,
  taskId: string | undefined
): Promise<void> {
  const session = activeSessions.get(projectId);
  if (!session) {
    return;
  }

  session.currentAgentId = agentId;
  session.currentTaskId = taskId;
  session.lastActiveAt = new Date();
  await saveSessionToDisk(projectDir, session);
}

/**
 * Load session state from disk
 */
async function loadSessionFromDisk(
  projectDir: string
): Promise<ProjectSession | null> {
  try {
    const sessionFile = path.join(projectDir, SESSION_FILE);
    const data = await fs.readFile(sessionFile, 'utf-8');
    const session = JSON.parse(data);

    // Convert date strings back to Date objects
    session.startedAt = new Date(session.startedAt);
    session.lastActiveAt = new Date(session.lastActiveAt);
    session.messages = session.messages.map((m: any) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));

    return session;
  } catch {
    return null;
  }
}

/**
 * Save session state to disk
 */
async function saveSessionToDisk(
  projectDir: string,
  session: ProjectSession
): Promise<void> {
  try {
    await fs.mkdir(projectDir, { recursive: true });
    const sessionFile = path.join(projectDir, SESSION_FILE);
    await fs.writeFile(sessionFile, JSON.stringify(session, null, 2), 'utf-8');
  } catch (error) {
    console.error(`❌ Failed to save session:`, error);
  }
}

/**
 * Get session summary for display
 */
export function getSessionSummary(projectId: string): {
  active: boolean;
  status: string;
  duration: number;
  messageCount: number;
  currentTask?: string;
} | null {
  const session = activeSessions.get(projectId);
  if (!session) {
    return null;
  }

  const duration = Date.now() - new Date(session.startedAt).getTime();

  return {
    active: session.status === 'active',
    status: session.status,
    duration,
    messageCount: session.messages.length,
    currentTask: session.currentTaskId,
  };
}

/**
 * Cleanup inactive sessions (idle for more than specified time)
 */
export async function cleanupInactiveSessions(
  maxIdleMs: number = 3600000 // 1 hour default
): Promise<number> {
  const now = Date.now();
  let cleaned = 0;

  for (const [projectId, session] of activeSessions.entries()) {
    const idleTime = now - new Date(session.lastActiveAt).getTime();
    if (session.status === 'idle' && idleTime > maxIdleMs) {
      activeSessions.delete(projectId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} inactive sessions`);
  }

  return cleaned;
}

// Cleanup inactive sessions every 30 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => cleanupInactiveSessions(), 1800000);
}
