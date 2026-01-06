/**
 * Feature Template Registry
 * Manages registration, retrieval, and matching of feature templates
 */

import { FeatureTemplate, TemplateMatch, FeatureCategory } from './types';

export class FeatureTemplateRegistry {
  private templates: Map<string, FeatureTemplate> = new Map();

  /**
   * Register a template
   */
  register(template: FeatureTemplate): void {
    if (this.templates.has(template.id)) {
      console.warn(`[TemplateRegistry] Template ${template.id} already registered, overwriting`);
    }
    this.templates.set(template.id, template);
  }

  /**
   * Register multiple templates
   */
  registerAll(templates: FeatureTemplate[]): void {
    for (const template of templates) {
      this.register(template);
    }
  }

  /**
   * Get a template by ID
   */
  get(templateId: string): FeatureTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Get all registered templates
   */
  getAll(): FeatureTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by category
   */
  getByCategory(category: FeatureCategory): FeatureTemplate[] {
    return this.getAll().filter(t => t.category === category);
  }

  /**
   * Match templates against requirements text
   * Returns matches sorted by score (highest first)
   */
  matchTemplates(requirements: string, options?: { minScore?: number }): TemplateMatch[] {
    const minScore = options?.minScore ?? 2;
    const normalizedReq = requirements.toLowerCase();
    const matches: TemplateMatch[] = [];

    for (const template of Array.from(this.templates.values())) {
      const matchedKeywords: string[] = [];

      // Check keyword matches
      for (const keyword of template.keywords) {
        if (normalizedReq.includes(keyword.toLowerCase())) {
          matchedKeywords.push(keyword);
        }
      }

      // Check pattern matches (if defined)
      if (template.patterns) {
        for (const pattern of template.patterns) {
          try {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(requirements)) {
              matchedKeywords.push(`pattern:${pattern}`);
            }
          } catch {
            // Invalid regex, skip
          }
        }
      }

      const score = matchedKeywords.length;

      if (score >= minScore) {
        matches.push({
          templateId: template.id,
          templateName: template.name,
          score,
          matchedKeywords,
        });
      }
    }

    // Sort by score (highest first)
    return matches.sort((a, b) => b.score - a.score);
  }

  /**
   * Detect templates from requirements (convenience method)
   */
  detectTemplates(requirements: string): string[] {
    const matches = this.matchTemplates(requirements);
    return matches.map(m => m.templateId);
  }

  /**
   * Check if requirements contain auth-related keywords
   */
  isAuthRelated(requirements: string): boolean {
    const authKeywords = ['login', 'signup', 'auth', 'password', 'session', 'register', 'signin'];
    const normalized = requirements.toLowerCase();
    return authKeywords.some(k => normalized.includes(k));
  }

  /**
   * Check if requirements contain CRUD/dashboard keywords
   */
  isCrudDashboardRelated(requirements: string): boolean {
    const crudKeywords = ['dashboard', 'admin', 'crud', 'table', 'list', 'manage', 'data table'];
    const normalized = requirements.toLowerCase();
    return crudKeywords.some(k => normalized.includes(k));
  }

  /**
   * Get template count
   */
  get size(): number {
    return this.templates.size;
  }
}

// Singleton instance
let registryInstance: FeatureTemplateRegistry | null = null;

/**
 * Get the global template registry instance
 */
export function getTemplateRegistry(): FeatureTemplateRegistry {
  if (!registryInstance) {
    registryInstance = new FeatureTemplateRegistry();
  }
  return registryInstance;
}

/**
 * Initialize the registry with default templates
 * Called lazily when templates are first accessed
 */
export function initializeTemplates(): void {
  // Templates are registered when imported via index.ts
  // This function exists for explicit initialization if needed
}
