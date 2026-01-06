/**
 * Learning Store V1
 *
 * Simple, practical cross-project memory system.
 * SQLite + FTS5 for storage and search.
 */

import Database, { Database as DatabaseType } from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

// ============================================================================
// Types
// ============================================================================

export type LearningType =
  | 'gotcha'           // Unexpected behavior
  | 'pattern'          // Good approach that worked
  | 'anti-pattern'     // Bad approach to avoid
  | 'library-issue'    // Library-specific problem
  | 'workaround'       // Temporary fix
  | 'best-practice'    // Recommended approach
  | 'error-solution'   // Specific error + fix
  | 'config';          // Configuration insight

export type Severity = 'info' | 'warning' | 'critical';

export interface Learning {
  id?: number;
  type: LearningType;
  category: string;
  title: string;
  description: string;
  solution?: string;
  severity: Severity;
  library?: string;
  libraryVersion?: string;
  tags: string[];
  projectName?: string;
  errorPattern?: string;     // Regex pattern to match this error
  codeExample?: string;
  helpfulCount?: number;
  notHelpfulCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface LearningSearchOptions {
  category?: string;
  library?: string;
  severity?: Severity;
  type?: LearningType;
  limit?: number;
}

// ============================================================================
// Learning Store
// ============================================================================

export class LearningStore {
  private db: DatabaseType;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), 'data', 'learnings.db');

    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL'); // Better concurrent access
    this.initialize();
  }

  private initialize() {
    this.db.exec(`
      -- Main learnings table
      CREATE TABLE IF NOT EXISTS learnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        helpful_count INTEGER DEFAULT 0,
        not_helpful_count INTEGER DEFAULT 0,
        times_shown INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Full-text search index
      CREATE VIRTUAL TABLE IF NOT EXISTS learnings_fts USING fts5(
        title,
        description,
        solution,
        library,
        tags,
        content='learnings',
        content_rowid='id'
      );

      -- Triggers to keep FTS in sync
      CREATE TRIGGER IF NOT EXISTS learnings_ai AFTER INSERT ON learnings BEGIN
        INSERT INTO learnings_fts(rowid, title, description, solution, library, tags)
        VALUES (new.id, new.title, new.description, new.solution, new.library, new.tags);
      END;

      CREATE TRIGGER IF NOT EXISTS learnings_ad AFTER DELETE ON learnings BEGIN
        INSERT INTO learnings_fts(learnings_fts, rowid, title, description, solution, library, tags)
        VALUES ('delete', old.id, old.title, old.description, old.solution, old.library, old.tags);
      END;

      CREATE TRIGGER IF NOT EXISTS learnings_au AFTER UPDATE ON learnings BEGIN
        INSERT INTO learnings_fts(learnings_fts, rowid, title, description, solution, library, tags)
        VALUES ('delete', old.id, old.title, old.description, old.solution, old.library, old.tags);
        INSERT INTO learnings_fts(rowid, title, description, solution, library, tags)
        VALUES (new.id, new.title, new.description, new.solution, new.library, new.tags);
      END;

      -- Indexes for common queries
      CREATE INDEX IF NOT EXISTS idx_learnings_category ON learnings(category);
      CREATE INDEX IF NOT EXISTS idx_learnings_library ON learnings(library);
      CREATE INDEX IF NOT EXISTS idx_learnings_severity ON learnings(severity);
      CREATE INDEX IF NOT EXISTS idx_learnings_type ON learnings(type);
    `);
  }

  // ==========================================================================
  // CRUD Operations
  // ==========================================================================

  /**
   * Add a new learning
   */
  add(learning: Omit<Learning, 'id' | 'createdAt' | 'updatedAt' | 'helpfulCount' | 'notHelpfulCount'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO learnings (
        type, category, title, description, solution, severity,
        library, library_version, tags, project_name, error_pattern, code_example
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
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
      learning.codeExample || null
    );

    return result.lastInsertRowid as number;
  }

  /**
   * Get a learning by ID
   */
  get(id: number): Learning | null {
    const row = this.db.prepare('SELECT * FROM learnings WHERE id = ?').get(id);
    return row ? this.rowToLearning(row) : null;
  }

  /**
   * Update a learning
   */
  update(id: number, updates: Partial<Learning>): boolean {
    const current = this.get(id);
    if (!current) return false;

    const merged = { ...current, ...updates };

    const stmt = this.db.prepare(`
      UPDATE learnings SET
        type = ?, category = ?, title = ?, description = ?, solution = ?,
        severity = ?, library = ?, library_version = ?, tags = ?,
        project_name = ?, error_pattern = ?, code_example = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      merged.type,
      merged.category,
      merged.title,
      merged.description,
      merged.solution,
      merged.severity,
      merged.library,
      merged.libraryVersion,
      JSON.stringify(merged.tags),
      merged.projectName,
      merged.errorPattern,
      merged.codeExample,
      id
    );

    return true;
  }

  /**
   * Delete a learning
   */
  delete(id: number): boolean {
    const result = this.db.prepare('DELETE FROM learnings WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // ==========================================================================
  // Search & Retrieval
  // ==========================================================================

  /**
   * Full-text search across learnings
   */
  search(query: string, limit = 10): Learning[] {
    // Escape special FTS5 characters and create search query
    const searchQuery = query
      .replace(/['"]/g, '')
      .split(/\s+/)
      .filter(term => term.length > 0)
      .map(term => `"${term}"*`)
      .join(' OR ');

    if (!searchQuery) return [];

    try {
      const rows = this.db.prepare(`
        SELECT l.*, bm25(learnings_fts) as rank
        FROM learnings l
        JOIN learnings_fts fts ON fts.rowid = l.id
        WHERE learnings_fts MATCH ?
        ORDER BY
          CASE l.severity
            WHEN 'critical' THEN 0
            WHEN 'warning' THEN 1
            ELSE 2
          END,
          rank
        LIMIT ?
      `).all(searchQuery, limit);

      return rows.map(row => this.rowToLearning(row));
    } catch {
      // Fallback to LIKE search if FTS fails
      return this.searchFallback(query, limit);
    }
  }

  private searchFallback(query: string, limit: number): Learning[] {
    const pattern = `%${query}%`;
    const rows = this.db.prepare(`
      SELECT * FROM learnings
      WHERE title LIKE ? OR description LIKE ? OR solution LIKE ?
      ORDER BY severity DESC, created_at DESC
      LIMIT ?
    `).all(pattern, pattern, pattern, limit);

    return rows.map(row => this.rowToLearning(row));
  }

  /**
   * Get all critical learnings (always show these)
   */
  getCritical(): Learning[] {
    const rows = this.db.prepare(`
      SELECT * FROM learnings
      WHERE severity = 'critical'
      ORDER BY created_at DESC
    `).all();

    return rows.map(row => this.rowToLearning(row));
  }

  /**
   * Get learnings by category
   */
  getByCategory(category: string, limit = 20): Learning[] {
    const rows = this.db.prepare(`
      SELECT * FROM learnings
      WHERE category = ?
      ORDER BY
        CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
        helpful_count DESC,
        created_at DESC
      LIMIT ?
    `).all(category, limit);

    return rows.map(row => this.rowToLearning(row));
  }

  /**
   * Get learnings for a specific library
   */
  getByLibrary(library: string, limit = 20): Learning[] {
    const rows = this.db.prepare(`
      SELECT * FROM learnings
      WHERE library = ? OR library LIKE ?
      ORDER BY
        CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
        created_at DESC
      LIMIT ?
    `).all(library, `${library}%`, limit);

    return rows.map(row => this.rowToLearning(row));
  }

  /**
   * Get learnings by type
   */
  getByType(type: LearningType, limit = 20): Learning[] {
    const rows = this.db.prepare(`
      SELECT * FROM learnings
      WHERE type = ?
      ORDER BY severity DESC, created_at DESC
      LIMIT ?
    `).all(type, limit);

    return rows.map(row => this.rowToLearning(row));
  }

  /**
   * Get learnings by tag (searches JSON tags array)
   */
  getByTag(tag: string, limit = 20): Learning[] {
    // Use JSON contains pattern for SQLite
    const pattern = `%"${tag.replace(/"/g, '')}"%`;
    const rows = this.db.prepare(`
      SELECT * FROM learnings
      WHERE tags LIKE ?
      ORDER BY
        CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
        created_at DESC
      LIMIT ?
    `).all(pattern, limit);

    return rows.map(row => this.rowToLearning(row));
  }

  /**
   * Get recent learnings
   */
  getRecent(limit = 20): Learning[] {
    const rows = this.db.prepare(`
      SELECT * FROM learnings
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit);

    return rows.map(row => this.rowToLearning(row));
  }

  /**
   * Get all learnings (paginated)
   */
  getAll(offset = 0, limit = 50): Learning[] {
    const rows = this.db.prepare(`
      SELECT * FROM learnings
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    return rows.map(row => this.rowToLearning(row));
  }

  /**
   * Match error message against stored patterns
   */
  matchError(errorMessage: string): Learning | null {
    const rows = this.db.prepare(`
      SELECT * FROM learnings
      WHERE error_pattern IS NOT NULL
    `).all();

    for (const row of rows as any[]) {
      try {
        const pattern = new RegExp(row.error_pattern, 'i');
        if (pattern.test(errorMessage)) {
          this.trackShown(row.id);
          return this.rowToLearning(row);
        }
      } catch {
        // Invalid regex, skip
      }
    }

    return null;
  }

  // ==========================================================================
  // Feedback & Metrics
  // ==========================================================================

  markHelpful(id: number): void {
    this.db.prepare(`
      UPDATE learnings
      SET helpful_count = helpful_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);
  }

  markNotHelpful(id: number): void {
    this.db.prepare(`
      UPDATE learnings
      SET not_helpful_count = not_helpful_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);
  }

  trackShown(id: number): void {
    this.db.prepare(`
      UPDATE learnings SET times_shown = times_shown + 1 WHERE id = ?
    `).run(id);
  }

  // ==========================================================================
  // Stats
  // ==========================================================================

  getStats(): {
    total: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    topHelpful: Learning[];
    recentCount: number;
    topTags: Array<{ tag: string; count: number }>;
  } {
    const total = (this.db.prepare('SELECT COUNT(*) as count FROM learnings').get() as any).count;

    const byCategory: Record<string, number> = {};
    this.db.prepare('SELECT category, COUNT(*) as count FROM learnings GROUP BY category')
      .all()
      .forEach((row: any) => { byCategory[row.category] = row.count; });

    const bySeverity: Record<string, number> = {};
    this.db.prepare('SELECT severity, COUNT(*) as count FROM learnings GROUP BY severity')
      .all()
      .forEach((row: any) => { bySeverity[row.severity] = row.count; });

    const byType: Record<string, number> = {};
    this.db.prepare('SELECT type, COUNT(*) as count FROM learnings GROUP BY type')
      .all()
      .forEach((row: any) => { byType[row.type] = row.count; });

    const topHelpful = (this.db.prepare(`
      SELECT * FROM learnings
      ORDER BY helpful_count DESC
      LIMIT 10
    `).all() as any[]).map(row => this.rowToLearning(row));

    // Count learnings from last 7 days
    const recentCount = (this.db.prepare(`
      SELECT COUNT(*) as count FROM learnings
      WHERE created_at >= datetime('now', '-7 days')
    `).get() as any).count;

    // Get top tags (parse from JSON and count)
    const allTags: Record<string, number> = {};
    const tagRows = this.db.prepare('SELECT tags FROM learnings').all() as any[];
    for (const row of tagRows) {
      try {
        const tags = JSON.parse(row.tags || '[]');
        for (const tag of tags) {
          allTags[tag] = (allTags[tag] || 0) + 1;
        }
      } catch { /* ignore parse errors */ }
    }
    const topTags = Object.entries(allTags)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return { total, byCategory, bySeverity, byType, topHelpful, recentCount, topTags };
  }

  // ==========================================================================
  // Prompt Formatting
  // ==========================================================================

  /**
   * Format learnings for injection into agent prompts
   */
  formatForPrompt(learnings: Learning[]): string {
    if (learnings.length === 0) return '';

    const critical = learnings.filter(l => l.severity === 'critical');
    const warnings = learnings.filter(l => l.severity === 'warning');
    const info = learnings.filter(l => l.severity === 'info');

    let output = '\n## LEARNINGS FROM PAST PROJECTS\n';
    output += 'These are lessons learned from previous work. Pay attention to them.\n';

    if (critical.length > 0) {
      output += '\n### CRITICAL - Must Follow\n';
      for (const l of critical) {
        output += `- **${l.title}**`;
        if (l.library) output += ` [${l.library}]`;
        output += `\n  ${l.description}`;
        if (l.solution) output += `\n  Solution: ${l.solution}`;
        output += '\n';
      }
    }

    if (warnings.length > 0) {
      output += '\n### WARNINGS\n';
      for (const l of warnings) {
        output += `- **${l.title}**`;
        if (l.library) output += ` [${l.library}]`;
        output += `: ${l.description}`;
        if (l.solution) output += ` → ${l.solution}`;
        output += '\n';
      }
    }

    if (info.length > 0) {
      output += '\n### Tips\n';
      for (const l of info) {
        output += `- ${l.title}: ${l.description}\n`;
      }
    }

    return output;
  }

  /**
   * Get context-aware learnings for a task
   */
  getContextForTask(
    taskDescription: string,
    techStack?: string[],
    limit = 10
  ): Learning[] {
    const results: Map<number, Learning> = new Map();

    // 1. Always include critical learnings
    for (const l of this.getCritical()) {
      results.set(l.id!, l);
    }

    // 2. Search by task description
    for (const l of this.search(taskDescription, limit)) {
      if (!results.has(l.id!)) {
        results.set(l.id!, l);
      }
    }

    // 3. Get learnings for tech stack
    if (techStack) {
      for (const tech of techStack) {
        for (const l of this.getByLibrary(tech, 5)) {
          if (!results.has(l.id!)) {
            results.set(l.id!, l);
          }
        }
      }
    }

    // Track that these were shown
    Array.from(results.keys()).forEach(id => {
      this.trackShown(id);
    });

    // Sort: critical first, then warnings, then info
    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    const sorted = Array.from(results.values()).sort((a, b) => {
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    return sorted.slice(0, limit);
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private rowToLearning(row: any): Learning {
    return {
      id: row.id,
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
      helpfulCount: row.helpful_count,
      notHelpfulCount: row.not_helpful_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

// ============================================================================
// Singleton instance for convenience
// ============================================================================

let instance: LearningStore | null = null;

export function getLearningStore(dbPath?: string): LearningStore {
  if (!instance) {
    instance = new LearningStore(dbPath);
  }
  return instance;
}

export default LearningStore;
