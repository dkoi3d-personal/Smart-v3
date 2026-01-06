/**
 * Pending Learnings Service
 *
 * Tracks potential learnings detected from agent output that haven't been
 * formally saved to the learning store. This allows users to review and
 * decide which learnings to keep.
 *
 * Use cases:
 * 1. Agent detects a potential pattern but confidence is low
 * 2. User wants to review auto-extracted learnings before saving
 * 3. Track learnings that were extracted but might be duplicates
 *
 * Now persisted to SQLite for durability across restarts.
 */

import { EventEmitter } from 'events';
import Database, { Database as DatabaseType } from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { Learning, LearningType, Severity } from './learning-store';

// ============================================================================
// Types
// ============================================================================

export interface PendingLearning extends Omit<Learning, 'id'> {
  pendingId: string;
  detectedAt: Date;
  source: 'agent_output' | 'error_extraction' | 'pattern_detection' | 'manual';
  sourceContext?: {
    agentId?: string;
    storyId?: string;
    projectId?: string;
    outputSnippet?: string;
  };
  confidence: number; // 0-1 confidence score
  status: 'pending' | 'approved' | 'rejected' | 'merged';
  reviewedAt?: Date;
  mergedWithId?: number; // If merged with existing learning
}

export interface PendingLearningsStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  byType: Record<LearningType, number>;
  bySeverity: Record<Severity, number>;
  bySource: Record<string, number>;
  avgConfidence: number;
}

// ============================================================================
// Pending Learnings Service (SQLite-backed)
// ============================================================================

class PendingLearningsService extends EventEmitter {
  private db: DatabaseType;
  private dbPath: string;
  private maxPendingLearnings: number = 100; // Limit to prevent bloat

  constructor(dbPath?: string) {
    super();
    this.dbPath = dbPath || path.join(process.cwd(), 'data', 'learnings.db');

    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      -- Pending learnings table for persistence
      CREATE TABLE IF NOT EXISTS pending_learnings (
        pending_id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        solution TEXT,
        severity TEXT DEFAULT 'info',
        library TEXT,
        library_version TEXT,
        tags TEXT DEFAULT '[]',
        project_name TEXT,
        error_pattern TEXT,
        code_example TEXT,
        detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        source TEXT NOT NULL,
        source_context TEXT,
        confidence REAL DEFAULT 0.5,
        status TEXT DEFAULT 'pending',
        reviewed_at DATETIME,
        merged_with_id INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_learnings(status);
      CREATE INDEX IF NOT EXISTS idx_pending_confidence ON pending_learnings(confidence);
      CREATE INDEX IF NOT EXISTS idx_pending_source ON pending_learnings(source);
    `);
  }

  /**
   * Add a pending learning for review
   */
  add(
    learning: Omit<Learning, 'id'>,
    source: PendingLearning['source'],
    confidence: number,
    sourceContext?: PendingLearning['sourceContext']
  ): PendingLearning {
    // Generate unique ID
    const pendingId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Enforce max limit (remove oldest pending)
    const count = this.getCount();
    if (count >= this.maxPendingLearnings) {
      const oldest = this.getOldest();
      if (oldest) {
        this.remove(oldest.pendingId);
      }
    }

    const stmt = this.db.prepare(`
      INSERT INTO pending_learnings (
        pending_id, type, category, title, description, solution, severity,
        library, library_version, tags, project_name, error_pattern, code_example,
        source, source_context, confidence, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `);

    stmt.run(
      pendingId,
      learning.type,
      learning.category,
      learning.title,
      learning.description,
      learning.solution || null,
      learning.severity || 'info',
      learning.library || null,
      learning.libraryVersion || null,
      JSON.stringify(learning.tags || []),
      learning.projectName || null,
      learning.errorPattern || null,
      learning.codeExample || null,
      source,
      sourceContext ? JSON.stringify(sourceContext) : null,
      Math.max(0, Math.min(1, confidence))
    );

    const pendingLearning: PendingLearning = {
      ...learning,
      pendingId,
      detectedAt: new Date(),
      source,
      sourceContext,
      confidence: Math.max(0, Math.min(1, confidence)),
      status: 'pending',
    };

    this.emit('learning:added', pendingLearning);

    console.log(`[PendingLearnings] Added: ${learning.title} (confidence: ${(confidence * 100).toFixed(0)}%)`);
    return pendingLearning;
  }

  private getCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM pending_learnings WHERE status = ?').get('pending') as any;
    return row?.count || 0;
  }

  /**
   * Get all pending learnings (optionally filtered)
   */
  getAll(options?: {
    status?: PendingLearning['status'];
    minConfidence?: number;
    source?: PendingLearning['source'];
    limit?: number;
  }): PendingLearning[] {
    let query = 'SELECT * FROM pending_learnings WHERE 1=1';
    const params: any[] = [];

    if (options?.status) {
      query += ' AND status = ?';
      params.push(options.status);
    }
    if (options?.minConfidence !== undefined) {
      query += ' AND confidence >= ?';
      params.push(options.minConfidence);
    }
    if (options?.source) {
      query += ' AND source = ?';
      params.push(options.source);
    }

    query += ' ORDER BY confidence DESC, detected_at DESC';

    if (options?.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    const rows = this.db.prepare(query).all(...params);
    return rows.map(row => this.rowToPendingLearning(row));
  }

  /**
   * Get a specific pending learning
   */
  get(pendingId: string): PendingLearning | undefined {
    const row = this.db.prepare('SELECT * FROM pending_learnings WHERE pending_id = ?').get(pendingId);
    return row ? this.rowToPendingLearning(row) : undefined;
  }

  private rowToPendingLearning(row: any): PendingLearning {
    return {
      pendingId: row.pending_id,
      type: row.type as LearningType,
      category: row.category,
      title: row.title,
      description: row.description,
      solution: row.solution,
      severity: row.severity as Severity,
      library: row.library,
      libraryVersion: row.library_version,
      tags: JSON.parse(row.tags || '[]'),
      projectName: row.project_name,
      errorPattern: row.error_pattern,
      codeExample: row.code_example,
      detectedAt: new Date(row.detected_at),
      source: row.source as PendingLearning['source'],
      sourceContext: row.source_context ? JSON.parse(row.source_context) : undefined,
      confidence: row.confidence,
      status: row.status as PendingLearning['status'],
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
      mergedWithId: row.merged_with_id,
    };
  }

  /**
   * Approve a pending learning (marks it for saving)
   */
  approve(pendingId: string): PendingLearning | null {
    const stmt = this.db.prepare(`
      UPDATE pending_learnings
      SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP
      WHERE pending_id = ?
    `);
    const result = stmt.run(pendingId);

    if (result.changes === 0) return null;

    const learning = this.get(pendingId);
    if (learning) {
      this.emit('learning:approved', learning);
    }
    return learning || null;
  }

  /**
   * Reject a pending learning
   */
  reject(pendingId: string): PendingLearning | null {
    const stmt = this.db.prepare(`
      UPDATE pending_learnings
      SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP
      WHERE pending_id = ?
    `);
    const result = stmt.run(pendingId);

    if (result.changes === 0) return null;

    const learning = this.get(pendingId);
    if (learning) {
      this.emit('learning:rejected', learning);
    }
    return learning || null;
  }

  /**
   * Mark a pending learning as merged with an existing one
   */
  markMerged(pendingId: string, existingLearningId: number): PendingLearning | null {
    const stmt = this.db.prepare(`
      UPDATE pending_learnings
      SET status = 'merged', merged_with_id = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE pending_id = ?
    `);
    const result = stmt.run(existingLearningId, pendingId);

    if (result.changes === 0) return null;

    const learning = this.get(pendingId);
    if (learning) {
      this.emit('learning:merged', { pending: learning, existingId: existingLearningId });
    }
    return learning || null;
  }

  /**
   * Remove a pending learning from the queue
   */
  remove(pendingId: string): boolean {
    const result = this.db.prepare('DELETE FROM pending_learnings WHERE pending_id = ?').run(pendingId);
    if (result.changes > 0) {
      this.emit('learning:removed', pendingId);
      return true;
    }
    return false;
  }

  /**
   * Clear all pending learnings (optionally by status)
   */
  clear(status?: PendingLearning['status']): number {
    let result;
    if (!status) {
      result = this.db.prepare('DELETE FROM pending_learnings').run();
    } else {
      result = this.db.prepare('DELETE FROM pending_learnings WHERE status = ?').run(status);
    }
    this.emit('learnings:cleared', result.changes);
    return result.changes;
  }

  /**
   * Get statistics about pending learnings
   */
  getStats(): PendingLearningsStats {
    const total = (this.db.prepare('SELECT COUNT(*) as count FROM pending_learnings').get() as any).count;

    const byType: Record<string, number> = {};
    this.db.prepare('SELECT type, COUNT(*) as count FROM pending_learnings GROUP BY type')
      .all()
      .forEach((row: any) => { byType[row.type] = row.count; });

    const bySeverity: Record<string, number> = {};
    this.db.prepare('SELECT severity, COUNT(*) as count FROM pending_learnings GROUP BY severity')
      .all()
      .forEach((row: any) => { bySeverity[row.severity] = row.count; });

    const bySource: Record<string, number> = {};
    this.db.prepare('SELECT source, COUNT(*) as count FROM pending_learnings GROUP BY source')
      .all()
      .forEach((row: any) => { bySource[row.source] = row.count; });

    const statusRows = this.db.prepare('SELECT status, COUNT(*) as count FROM pending_learnings GROUP BY status').all() as any[];
    const statusCounts = { pending: 0, approved: 0, rejected: 0, merged: 0 };
    for (const row of statusRows) {
      if (row.status in statusCounts) {
        statusCounts[row.status as keyof typeof statusCounts] = row.count;
      }
    }

    const avgRow = this.db.prepare('SELECT AVG(confidence) as avg FROM pending_learnings').get() as any;
    const avgConfidence = avgRow?.avg || 0;

    return {
      total,
      pending: statusCounts.pending,
      approved: statusCounts.approved,
      rejected: statusCounts.rejected,
      byType: byType as Record<LearningType, number>,
      bySeverity: bySeverity as Record<Severity, number>,
      bySource,
      avgConfidence,
    };
  }

  /**
   * Get learnings grouped by project
   */
  getByProject(): Map<string, PendingLearning[]> {
    const byProject = new Map<string, PendingLearning[]>();
    const rows = this.db.prepare('SELECT * FROM pending_learnings').all();

    for (const row of rows) {
      const learning = this.rowToPendingLearning(row);
      const projectId = learning.sourceContext?.projectId || 'unknown';
      if (!byProject.has(projectId)) {
        byProject.set(projectId, []);
      }
      byProject.get(projectId)!.push(learning);
    }

    return byProject;
  }

  /**
   * Check if a similar pending learning already exists
   */
  hasSimilar(title: string, threshold: number = 0.7): PendingLearning | null {
    const rows = this.db.prepare('SELECT * FROM pending_learnings WHERE status = ?').all('pending');
    for (const row of rows) {
      const learning = this.rowToPendingLearning(row);
      if (this.titleSimilarity(learning.title, title) >= threshold) {
        return learning;
      }
    }
    return null;
  }

  /**
   * Update the confidence of a pending learning
   */
  updateConfidence(pendingId: string, newConfidence: number): boolean {
    const result = this.db.prepare(`
      UPDATE pending_learnings SET confidence = ? WHERE pending_id = ?
    `).run(Math.max(0, Math.min(1, newConfidence)), pendingId);

    if (result.changes > 0) {
      const learning = this.get(pendingId);
      if (learning) {
        this.emit('learning:updated', learning);
      }
      return true;
    }
    return false;
  }

  /**
   * Update a pending learning with additional information
   */
  update(pendingId: string, updates: Partial<Omit<PendingLearning, 'pendingId' | 'detectedAt'>>): PendingLearning | null {
    const current = this.get(pendingId);
    if (!current) return null;

    // Build update query dynamically
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
    if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
    if (updates.solution !== undefined) { fields.push('solution = ?'); values.push(updates.solution); }
    if (updates.severity !== undefined) { fields.push('severity = ?'); values.push(updates.severity); }
    if (updates.confidence !== undefined) { fields.push('confidence = ?'); values.push(updates.confidence); }
    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(updates.tags)); }

    if (fields.length === 0) return current;

    values.push(pendingId);
    this.db.prepare(`UPDATE pending_learnings SET ${fields.join(', ')} WHERE pending_id = ?`).run(...values);

    const updated = this.get(pendingId);
    if (updated) {
      this.emit('learning:updated', updated);
    }
    return updated || null;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private getOldest(): PendingLearning | null {
    const row = this.db.prepare(`
      SELECT * FROM pending_learnings
      WHERE status = 'pending'
      ORDER BY detected_at ASC
      LIMIT 1
    `).get();
    return row ? this.rowToPendingLearning(row) : null;
  }

  private titleSimilarity(a: string, b: string): number {
    const aWords = a.toLowerCase().split(/\s+/);
    const bWords = new Set(b.toLowerCase().split(/\s+/));
    const intersection = aWords.filter(x => bWords.has(x));
    const union = new Set([...aWords, ...bWords]);
    return intersection.length / union.size;
  }
}

// ============================================================================
// Singleton
// ============================================================================

let instance: PendingLearningsService | null = null;

export function getPendingLearningsService(dbPath?: string): PendingLearningsService {
  if (!instance) {
    instance = new PendingLearningsService(dbPath);
  }
  return instance;
}

export function createPendingLearningsService(dbPath?: string): PendingLearningsService {
  return new PendingLearningsService(dbPath);
}

export { PendingLearningsService };
export default PendingLearningsService;
