/**
 * Bug Tracking System for UAT Testers
 *
 * Features:
 * - Bug reporting with screenshots
 * - Priority and severity levels
 * - Integration with Claude for automatic fixes
 * - Status tracking and history
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export type BugSeverity = 'critical' | 'high' | 'medium' | 'low';
export type BugStatus = 'open' | 'in_progress' | 'fix_requested' | 'fixed' | 'verified' | 'closed' | 'wont_fix';
export type BugCategory = 'ui' | 'functionality' | 'performance' | 'security' | 'accessibility' | 'other';

export interface BugScreenshot {
  id: string;
  filename: string;
  path: string;
  annotations?: BugAnnotation[];
  capturedAt: string;
}

export interface BugAnnotation {
  id: string;
  type: 'rectangle' | 'circle' | 'arrow' | 'text';
  x: number;
  y: number;
  width?: number;
  height?: number;
  endX?: number;
  endY?: number;
  text?: string;
  color: string;
}

export interface BugComment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  content: string;
  createdAt: string;
  isClaudeResponse?: boolean;
}

export interface BugFixRequest {
  id: string;
  requestedBy: string;
  requestedAt: string;
  description: string;
  claudeResponse?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fixCommitId?: string;
  completedAt?: string;
}

export interface Bug {
  id: string;
  projectId: string;
  title: string;
  description: string;
  stepsToReproduce: string[];
  expectedBehavior: string;
  actualBehavior: string;
  severity: BugSeverity;
  category: BugCategory;
  status: BugStatus;
  reportedBy: string;
  reportedByName: string;
  assignedTo?: string;
  screenshots: BugScreenshot[];
  comments: BugComment[];
  fixRequests: BugFixRequest[];
  environment: {
    browser?: string;
    os?: string;
    screenSize?: string;
    url?: string;
  };
  tags: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  verifiedAt?: string;
}

export interface BugStats {
  total: number;
  open: number;
  inProgress: number;
  fixed: number;
  verified: number;
  closed: number;
  bySeverity: Record<BugSeverity, number>;
  byCategory: Record<BugCategory, number>;
}

const BUGS_DIR = path.join(process.cwd(), 'data', 'bugs');
const SCREENSHOTS_DIR = path.join(process.cwd(), 'data', 'bugs', 'screenshots');

/**
 * Initialize bug tracking directories
 */
async function ensureDirs() {
  await fs.mkdir(BUGS_DIR, { recursive: true });
  await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
}

/**
 * Get bug file path
 */
function getBugPath(projectId: string, bugId: string): string {
  return path.join(BUGS_DIR, projectId, `${bugId}.json`);
}

/**
 * Load all bugs for a project
 */
export async function loadProjectBugs(projectId: string): Promise<Bug[]> {
  try {
    const projectBugsDir = path.join(BUGS_DIR, projectId);
    await fs.mkdir(projectBugsDir, { recursive: true });

    const files = await fs.readdir(projectBugsDir);
    const bugs: Bug[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const data = await fs.readFile(path.join(projectBugsDir, file), 'utf-8');
        bugs.push(JSON.parse(data) as Bug);
      }
    }

    // Sort by creation date, newest first
    return bugs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

/**
 * Load a single bug
 */
export async function loadBug(projectId: string, bugId: string): Promise<Bug | null> {
  try {
    const data = await fs.readFile(getBugPath(projectId, bugId), 'utf-8');
    return JSON.parse(data) as Bug;
  } catch {
    return null;
  }
}

/**
 * Save a bug
 */
async function saveBug(bug: Bug): Promise<void> {
  const projectBugsDir = path.join(BUGS_DIR, bug.projectId);
  await fs.mkdir(projectBugsDir, { recursive: true });
  await fs.writeFile(getBugPath(bug.projectId, bug.id), JSON.stringify(bug, null, 2), 'utf-8');
}

/**
 * Create a new bug report
 */
export async function createBug(
  bug: Omit<Bug, 'id' | 'createdAt' | 'updatedAt' | 'comments' | 'fixRequests'>
): Promise<Bug> {
  await ensureDirs();

  const newBug: Bug = {
    ...bug,
    id: `bug-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    comments: [],
    fixRequests: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveBug(newBug);
  return newBug;
}

/**
 * Update a bug
 */
export async function updateBug(
  projectId: string,
  bugId: string,
  updates: Partial<Bug>
): Promise<Bug | null> {
  const bug = await loadBug(projectId, bugId);
  if (!bug) return null;

  const updatedBug: Bug = {
    ...bug,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await saveBug(updatedBug);
  return updatedBug;
}

/**
 * Add a comment to a bug
 */
export async function addComment(
  projectId: string,
  bugId: string,
  comment: Omit<BugComment, 'id' | 'createdAt'>
): Promise<BugComment | null> {
  const bug = await loadBug(projectId, bugId);
  if (!bug) return null;

  const newComment: BugComment = {
    ...comment,
    id: `comment-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  bug.comments.push(newComment);
  bug.updatedAt = new Date().toISOString();
  await saveBug(bug);

  return newComment;
}

/**
 * Request a fix from Claude
 */
export async function requestFix(
  projectId: string,
  bugId: string,
  requestedBy: string,
  description: string
): Promise<BugFixRequest | null> {
  const bug = await loadBug(projectId, bugId);
  if (!bug) return null;

  const fixRequest: BugFixRequest = {
    id: `fix-${Date.now()}`,
    requestedBy,
    requestedAt: new Date().toISOString(),
    description,
    status: 'pending',
  };

  bug.fixRequests.push(fixRequest);
  bug.status = 'fix_requested';
  bug.updatedAt = new Date().toISOString();
  await saveBug(bug);

  return fixRequest;
}

/**
 * Update fix request status
 */
export async function updateFixRequest(
  projectId: string,
  bugId: string,
  fixRequestId: string,
  updates: Partial<BugFixRequest>
): Promise<BugFixRequest | null> {
  const bug = await loadBug(projectId, bugId);
  if (!bug) return null;

  const fixIndex = bug.fixRequests.findIndex(f => f.id === fixRequestId);
  if (fixIndex === -1) return null;

  bug.fixRequests[fixIndex] = { ...bug.fixRequests[fixIndex], ...updates };

  if (updates.status === 'completed') {
    bug.status = 'fixed';
    bug.fixRequests[fixIndex].completedAt = new Date().toISOString();
  }

  bug.updatedAt = new Date().toISOString();
  await saveBug(bug);

  return bug.fixRequests[fixIndex];
}

/**
 * Save screenshot
 */
export async function saveScreenshot(
  projectId: string,
  bugId: string,
  screenshotData: string, // base64 encoded
  annotations?: BugAnnotation[]
): Promise<BugScreenshot | null> {
  await ensureDirs();

  const bug = await loadBug(projectId, bugId);
  if (!bug) return null;

  const screenshotId = `screenshot-${Date.now()}`;
  const filename = `${screenshotId}.png`;
  const screenshotDir = path.join(SCREENSHOTS_DIR, projectId, bugId);
  await fs.mkdir(screenshotDir, { recursive: true });

  const screenshotPath = path.join(screenshotDir, filename);

  // Remove base64 prefix if present
  const base64Data = screenshotData.replace(/^data:image\/\w+;base64,/, '');
  await fs.writeFile(screenshotPath, Buffer.from(base64Data, 'base64'));

  const screenshot: BugScreenshot = {
    id: screenshotId,
    filename,
    path: `/api/bugs/screenshot/${projectId}/${bugId}/${filename}`,
    annotations,
    capturedAt: new Date().toISOString(),
  };

  bug.screenshots.push(screenshot);
  bug.updatedAt = new Date().toISOString();
  await saveBug(bug);

  return screenshot;
}

/**
 * Get bug statistics for a project
 */
export async function getBugStats(projectId: string): Promise<BugStats> {
  const bugs = await loadProjectBugs(projectId);

  const stats: BugStats = {
    total: bugs.length,
    open: 0,
    inProgress: 0,
    fixed: 0,
    verified: 0,
    closed: 0,
    bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
    byCategory: { ui: 0, functionality: 0, performance: 0, security: 0, accessibility: 0, other: 0 },
  };

  for (const bug of bugs) {
    // Status counts
    switch (bug.status) {
      case 'open':
      case 'fix_requested':
        stats.open++;
        break;
      case 'in_progress':
        stats.inProgress++;
        break;
      case 'fixed':
        stats.fixed++;
        break;
      case 'verified':
        stats.verified++;
        break;
      case 'closed':
      case 'wont_fix':
        stats.closed++;
        break;
    }

    // Severity counts
    stats.bySeverity[bug.severity]++;

    // Category counts
    stats.byCategory[bug.category]++;
  }

  return stats;
}

/**
 * Delete a bug
 */
export async function deleteBug(projectId: string, bugId: string): Promise<boolean> {
  try {
    await fs.unlink(getBugPath(projectId, bugId));

    // Also delete screenshots
    const screenshotDir = path.join(SCREENSHOTS_DIR, projectId, bugId);
    try {
      await fs.rm(screenshotDir, { recursive: true });
    } catch {
      // Screenshots dir might not exist
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Verify a fixed bug
 */
export async function verifyBug(
  projectId: string,
  bugId: string,
  verifiedBy: string
): Promise<Bug | null> {
  const bug = await loadBug(projectId, bugId);
  if (!bug || bug.status !== 'fixed') return null;

  bug.status = 'verified';
  bug.verifiedAt = new Date().toISOString();
  bug.updatedAt = new Date().toISOString();

  await addComment(projectId, bugId, {
    authorId: verifiedBy,
    authorName: 'Tester',
    authorRole: 'uat_tester',
    content: 'Bug verified as fixed.',
  });

  await saveBug(bug);
  return bug;
}

/**
 * Close a bug
 */
export async function closeBug(
  projectId: string,
  bugId: string,
  reason?: string
): Promise<Bug | null> {
  const bug = await loadBug(projectId, bugId);
  if (!bug) return null;

  bug.status = 'closed';
  bug.resolvedAt = new Date().toISOString();
  bug.updatedAt = new Date().toISOString();

  if (reason) {
    await addComment(projectId, bugId, {
      authorId: 'system',
      authorName: 'System',
      authorRole: 'system',
      content: `Bug closed: ${reason}`,
    });
  }

  await saveBug(bug);
  return bug;
}

export const bugTracker = {
  loadProjectBugs,
  loadBug,
  createBug,
  updateBug,
  addComment,
  requestFix,
  updateFixRequest,
  saveScreenshot,
  getBugStats,
  deleteBug,
  verifyBug,
  closeBug,
};

export default bugTracker;
