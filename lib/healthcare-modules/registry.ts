/**
 * Healthcare Module Registry
 *
 * Central registry for all healthcare modules. Provides:
 * - Module registration and retrieval
 * - Keyword/pattern matching for requirements
 * - Story-to-module matching for build
 */

import {
  HealthcareModule,
  ModuleMatch,
  ModuleMatchOptions,
  ModuleRegistryOptions,
  ModuleUsageRecord,
  ModuleCategory,
  ModuleAnalysisResult,
  StoryWithModules,
} from './types';

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_MATCH_OPTIONS: Required<ModuleMatchOptions> = {
  minScore: 40,
  maxMatches: 3,
  category: undefined as unknown as ModuleCategory,
  maxLevel: 5,
};

const MATCH_WEIGHTS = {
  keywordExact: 15,      // Exact keyword match
  keywordPartial: 8,     // Partial keyword match
  domainMatch: 25,       // Domain ID matches
  patternMatch: 20,      // Regex pattern matches
  categoryBonus: 10,     // Category alignment bonus
};

// =============================================================================
// MODULE REGISTRY CLASS
// =============================================================================

export class HealthcareModuleRegistry {
  private modules: Map<string, HealthcareModule> = new Map();
  private usageHistory: ModuleUsageRecord[] = [];
  private options: ModuleRegistryOptions;

  constructor(options: ModuleRegistryOptions = {}) {
    this.options = options;
  }

  // ---------------------------------------------------------------------------
  // REGISTRATION
  // ---------------------------------------------------------------------------

  /**
   * Register a healthcare module
   */
  register(module: HealthcareModule): void {
    if (this.options.validateOnLoad) {
      this.validateModule(module);
    }
    this.modules.set(module.id, module);
  }

  /**
   * Register multiple modules at once
   */
  registerAll(modules: HealthcareModule[]): void {
    for (const module of modules) {
      this.register(module);
    }
  }

  /**
   * Unregister a module by ID
   */
  unregister(moduleId: string): boolean {
    return this.modules.delete(moduleId);
  }

  // ---------------------------------------------------------------------------
  // RETRIEVAL
  // ---------------------------------------------------------------------------

  /**
   * Get a module by ID
   */
  get(moduleId: string): HealthcareModule | undefined {
    return this.modules.get(moduleId);
  }

  /**
   * Get all registered modules
   */
  getAll(): HealthcareModule[] {
    return Array.from(this.modules.values());
  }

  /**
   * Get modules by category
   */
  getByCategory(category: ModuleCategory): HealthcareModule[] {
    return this.getAll().filter(m => m.category === category);
  }

  /**
   * Get modules that support quick-build
   */
  getQuickBuildModules(): HealthcareModule[] {
    return this.getAll().filter(m => m.quickBuild.enabled);
  }

  /**
   * Get modules that support agent-build
   */
  getAgentBuildModules(): HealthcareModule[] {
    return this.getAll().filter(m => m.agentBuild.enabled);
  }

  // ---------------------------------------------------------------------------
  // MATCHING - REQUIREMENTS TEXT
  // ---------------------------------------------------------------------------

  /**
   * Match modules against user requirements text (for quick-build)
   */
  matchForQuickBuild(requirements: string, options?: ModuleMatchOptions): ModuleMatch[] {
    const opts = { ...DEFAULT_MATCH_OPTIONS, ...options };
    const lowerReq = requirements.toLowerCase();

    const matches: ModuleMatch[] = [];

    for (const module of this.getQuickBuildModules()) {
      if (opts.maxLevel && module.level > opts.maxLevel) continue;
      if (opts.category && module.category !== opts.category) continue;

      const match = this.calculateMatch(module, lowerReq);
      if (match.score >= opts.minScore) {
        matches.push(match);
      }
    }

    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, opts.maxMatches);
  }

  /**
   * Match modules against a story (for build/fleet)
   */
  matchForStory(
    storyTitle: string,
    storyDescription: string,
    storyTags?: string[],
    domainId?: string,
    options?: ModuleMatchOptions
  ): ModuleMatch[] {
    const opts = { ...DEFAULT_MATCH_OPTIONS, ...options };
    const combinedText = `${storyTitle} ${storyDescription}`.toLowerCase();

    const matches: ModuleMatch[] = [];

    for (const module of this.getAgentBuildModules()) {
      if (opts.maxLevel && module.level > opts.maxLevel) continue;
      if (opts.category && module.category !== opts.category) continue;

      const match = this.calculateStoryMatch(
        module,
        combinedText,
        storyTags || [],
        domainId
      );

      if (match.score >= opts.minScore) {
        matches.push(match);
      }
    }

    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, opts.maxMatches);
  }

  /**
   * Analyze multiple stories for module opportunities
   */
  analyzeStories(
    stories: Array<{
      id: string;
      title: string;
      description: string;
      tags?: string[];
      domainId?: string;
    }>,
    options?: ModuleMatchOptions
  ): ModuleAnalysisResult {
    const storiesWithModules: StoryWithModules[] = [];
    const moduleUsageCounts = new Map<string, number>();

    for (const story of stories) {
      const matches = this.matchForStory(
        story.title,
        story.description,
        story.tags,
        story.domainId,
        options
      );

      if (matches.length > 0) {
        storiesWithModules.push({
          storyId: story.id,
          recommendedModules: matches,
          modulesApplied: false,
        });

        for (const match of matches) {
          moduleUsageCounts.set(
            match.moduleId,
            (moduleUsageCounts.get(match.moduleId) || 0) + 1
          );
        }
      }
    }

    // Estimate time savings: ~4 minutes per story with module vs ~8 minutes without
    const estimatedTimeSavings = storiesWithModules.length * 4;

    return {
      storiesWithModules,
      estimatedTimeSavings,
      uniqueModulesRecommended: Array.from(moduleUsageCounts.keys()),
    };
  }

  // ---------------------------------------------------------------------------
  // MATCHING - INTERNAL
  // ---------------------------------------------------------------------------

  private calculateMatch(module: HealthcareModule, lowerReq: string): ModuleMatch {
    let score = 0;
    const matchedKeywords: string[] = [];
    const matchedPatterns: string[] = [];
    const reasons: string[] = [];

    // Keyword matching
    for (const keyword of module.keywords) {
      const lowerKeyword = keyword.toLowerCase();
      if (lowerReq.includes(lowerKeyword)) {
        // Check for exact word match vs partial
        const exactMatch = new RegExp(`\\b${this.escapeRegex(lowerKeyword)}\\b`).test(lowerReq);
        if (exactMatch) {
          score += MATCH_WEIGHTS.keywordExact;
          matchedKeywords.push(keyword);
        } else {
          score += MATCH_WEIGHTS.keywordPartial;
          matchedKeywords.push(`~${keyword}`);
        }
      }
    }

    // Pattern matching
    for (const pattern of module.storyPatterns) {
      try {
        if (new RegExp(pattern, 'i').test(lowerReq)) {
          score += MATCH_WEIGHTS.patternMatch;
          matchedPatterns.push(pattern);
        }
      } catch {
        // Invalid regex, skip
      }
    }

    // Build reason string
    if (matchedKeywords.length > 0) {
      reasons.push(`keywords: ${matchedKeywords.join(', ')}`);
    }
    if (matchedPatterns.length > 0) {
      reasons.push(`patterns matched`);
    }

    return {
      moduleId: module.id,
      score: Math.min(100, score),
      reason: reasons.join('; ') || 'low match',
      matchedKeywords,
      matchedPatterns,
    };
  }

  private calculateStoryMatch(
    module: HealthcareModule,
    combinedText: string,
    storyTags: string[],
    domainId?: string
  ): ModuleMatch {
    // Start with basic text matching
    const baseMatch = this.calculateMatch(module, combinedText);
    let score = baseMatch.score;
    const reasons: string[] = [baseMatch.reason];

    // Domain matching bonus
    if (domainId && module.domainMatches.includes(domainId)) {
      score += MATCH_WEIGHTS.domainMatch;
      reasons.push(`domain: ${domainId}`);
    }

    // Tag matching - check if any story tags match module keywords
    const tagMatches = storyTags.filter(tag =>
      module.keywords.some(k => k.toLowerCase() === tag.toLowerCase())
    );
    if (tagMatches.length > 0) {
      score += tagMatches.length * 5;
      reasons.push(`tags: ${tagMatches.join(', ')}`);
    }

    // Check for explicit module tag
    const moduleTag = storyTags.find(t => t.startsWith('module:'));
    if (moduleTag && moduleTag === `module:${module.id}`) {
      score = 100; // Explicit assignment
      reasons.push('explicitly assigned');
    }

    return {
      moduleId: module.id,
      score: Math.min(100, score),
      reason: reasons.filter(r => r && r !== 'low match').join('; '),
      matchedKeywords: baseMatch.matchedKeywords,
      matchedPatterns: baseMatch.matchedPatterns,
    };
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ---------------------------------------------------------------------------
  // VALIDATION
  // ---------------------------------------------------------------------------

  private validateModule(module: HealthcareModule): void {
    if (!module.id || typeof module.id !== 'string') {
      throw new Error('Module must have a valid id');
    }
    if (!module.name || typeof module.name !== 'string') {
      throw new Error(`Module ${module.id} must have a valid name`);
    }
    if (!module.keywords || !Array.isArray(module.keywords) || module.keywords.length === 0) {
      throw new Error(`Module ${module.id} must have at least one keyword`);
    }
    if (!module.quickBuild && !module.agentBuild) {
      throw new Error(`Module ${module.id} must have either quickBuild or agentBuild config`);
    }
  }

  // ---------------------------------------------------------------------------
  // USAGE TRACKING
  // ---------------------------------------------------------------------------

  /**
   * Record module usage for analytics
   */
  recordUsage(record: ModuleUsageRecord): void {
    this.usageHistory.push(record);
  }

  /**
   * Get usage history for a module
   */
  getUsageHistory(moduleId: string): ModuleUsageRecord[] {
    return this.usageHistory.filter(r => r.moduleId === moduleId);
  }

  /**
   * Get most used modules
   */
  getMostUsedModules(limit: number = 10): Array<{ moduleId: string; count: number }> {
    const counts = new Map<string, number>();
    for (const record of this.usageHistory) {
      counts.set(record.moduleId, (counts.get(record.moduleId) || 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([moduleId, count]) => ({ moduleId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  // ---------------------------------------------------------------------------
  // HELPERS FOR ADAPTERS
  // ---------------------------------------------------------------------------

  /**
   * Get files for quick-build mode
   */
  getQuickBuildFiles(moduleId: string): Array<{ path: string; content: string }> {
    const module = this.get(moduleId);
    if (!module || !module.quickBuild.enabled) {
      return [];
    }

    return module.quickBuild.files.map(f => ({
      path: f.path,
      content: f.content,
    }));
  }

  /**
   * Get files for agent-build mode
   */
  getAgentBuildFiles(moduleId: string): Array<{ path: string; content: string }> {
    const module = this.get(moduleId);
    if (!module || !module.agentBuild.enabled) {
      return [];
    }

    return module.agentBuild.files.map(f => ({
      path: f.path,
      content: f.content,
    }));
  }

  /**
   * Get agent customization guide
   */
  getAgentContext(moduleId: string): string {
    const module = this.get(moduleId);
    if (!module || !module.agentBuild.enabled) {
      return '';
    }

    const files = module.agentBuild.files;
    const fileList = files.map(f => `- ${f.path} (${f.type})`).join('\n');

    return `
=== PRE-BUILT MODULE: ${module.name} ===
${module.description}

**Files Provided:**
${fileList}

**Customization Guide:**
${module.agentBuild.customizationGuide}

**Acceptance Criteria (from module):**
${module.agentBuild.acceptanceCriteria.map(c => `- ${c}`).join('\n')}

${module.agentBuild.antiPatterns?.length ? `
**Anti-Patterns to Avoid:**
${module.agentBuild.antiPatterns.map(p => `- ${p}`).join('\n')}
` : ''}

${module.agentBuild.qualityChecklist?.length ? `
**Quality Checklist:**
${module.agentBuild.qualityChecklist.map(c => `☐ ${c}`).join('\n')}
` : ''}
===
`.trim();
  }

  /**
   * Get combined dependencies for multiple modules
   */
  getCombinedDependencies(moduleIds: string[]): {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  } {
    const deps: Record<string, string> = {};
    const devDeps: Record<string, string> = {};

    for (const moduleId of moduleIds) {
      const module = this.get(moduleId);
      if (!module) continue;

      // Add package dependencies
      Object.assign(deps, module.dependencies.packages);

      // Add quick-build specific deps if available
      if (module.quickBuild.enabled) {
        Object.assign(deps, module.quickBuild.dependencies);
        Object.assign(devDeps, module.quickBuild.devDependencies || {});
      }
    }

    return { dependencies: deps, devDependencies: devDeps };
  }

  /**
   * Get module summary for Product Owner context
   */
  getModuleSummaryForPO(): string {
    const modules = this.getAll();
    if (modules.length === 0) {
      return 'No healthcare modules available.';
    }

    return modules.map(m => `- **${m.id}**: ${m.description} (keywords: ${m.keywords.slice(0, 5).join(', ')})`).join('\n');
  }

  /**
   * Check if requirements suggest a healthcare project
   */
  isHealthcareProject(requirements: string): boolean {
    const healthcareKeywords = [
      'patient', 'healthcare', 'medical', 'clinical', 'health',
      'fhir', 'hl7', 'epic', 'ehr', 'emr', 'hipaa',
      'hospital', 'clinic', 'provider', 'physician', 'nurse',
      'medication', 'prescription', 'diagnosis', 'treatment',
      'appointment', 'scheduling', 'billing', 'claims', 'insurance',
      'vital', 'lab', 'allergy', 'immunization',
    ];

    const lowerReq = requirements.toLowerCase();
    const matchCount = healthcareKeywords.filter(k => lowerReq.includes(k)).length;

    // If 2+ healthcare keywords found, it's likely a healthcare project
    return matchCount >= 2;
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let registryInstance: HealthcareModuleRegistry | null = null;

/**
 * Get the singleton registry instance
 */
export function getHealthcareModuleRegistry(): HealthcareModuleRegistry {
  if (!registryInstance) {
    registryInstance = new HealthcareModuleRegistry({ validateOnLoad: true });
  }
  return registryInstance;
}

/**
 * Initialize the registry with modules
 */
export function initializeHealthcareModules(modules: HealthcareModule[]): void {
  const registry = getHealthcareModuleRegistry();
  registry.registerAll(modules);
}
