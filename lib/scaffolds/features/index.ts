/**
 * Feature Templates
 * Pre-built feature templates for rapid application development
 *
 * Usage:
 * ```typescript
 * import { detectFeatureTemplates, applyTemplates, mergeRequirements } from '@/lib/scaffolds/features';
 *
 * // Detect matching templates
 * const matches = detectFeatureTemplates(requirements);
 *
 * // Apply templates to project
 * await applyTemplates(projectDir, matches.map(m => m.templateId));
 *
 * // Merge requirements
 * const { mergedRequirements } = mergeRequirements(requirements, templateIds);
 * ```
 */

// Export types
export * from './types';

// Export registry
export {
  FeatureTemplateRegistry,
  getTemplateRegistry,
  initializeTemplates,
} from './registry';

// Export applier
export {
  applyTemplate,
  applyTemplates,
  autoApplyTemplates,
} from './template-applier';

// Export merger
export {
  mergeRequirements,
  getTemplateRequirementsSection,
  getTemplateAgentInstructions,
  getTemplateSummary,
} from './requirement-merger';

// Import templates
import { authFlowTemplate } from './auth-flow';
import { crudDashboardTemplate } from './crud-dashboard';
// Bootstrap templates
import { bootstrapGenericTemplate } from './bootstrap-generic';
import { bootstrapHealthcareTemplate } from './bootstrap-healthcare';
import { bootstrapFigmaTemplate } from './bootstrap-figma';
// Healthcare templates
import { auditLoggerTemplate } from './audit-logger';
import { fhirClientTemplate } from './fhir-client';
import { secureMessagingTemplate } from './secure-messaging';
import { patientPortalTemplate } from './patient-portal';
import { appointmentSchedulerTemplate } from './appointment-scheduler';
import { getTemplateRegistry } from './registry';
import type { TemplateMatch } from './types';

// All available templates
export const FEATURE_TEMPLATES = [
  // Bootstrap templates (foundation)
  bootstrapGenericTemplate,
  bootstrapHealthcareTemplate,
  bootstrapFigmaTemplate,
  // Core templates
  authFlowTemplate,
  crudDashboardTemplate,
  // Healthcare templates
  auditLoggerTemplate,
  fhirClientTemplate,
  secureMessagingTemplate,
  patientPortalTemplate,
  appointmentSchedulerTemplate,
];

// Register templates on module load
let initialized = false;

function ensureInitialized(): void {
  if (initialized) return;

  const registry = getTemplateRegistry();
  registry.registerAll(FEATURE_TEMPLATES);
  initialized = true;

  console.log(`[FeatureTemplates] Registered ${FEATURE_TEMPLATES.length} templates`);
}

/**
 * Detect which templates match the given requirements
 * Returns matches sorted by score (highest first)
 */
export function detectFeatureTemplates(requirements: string): TemplateMatch[] {
  ensureInitialized();
  const registry = getTemplateRegistry();
  return registry.matchTemplates(requirements);
}

/**
 * Get a specific template by ID
 */
export function getFeatureTemplate(templateId: string) {
  ensureInitialized();
  const registry = getTemplateRegistry();
  return registry.get(templateId);
}

/**
 * Check if requirements are auth-related
 */
export function isAuthRelated(requirements: string): boolean {
  ensureInitialized();
  const registry = getTemplateRegistry();
  return registry.isAuthRelated(requirements);
}

/**
 * Check if requirements are CRUD/dashboard-related
 */
export function isCrudDashboardRelated(requirements: string): boolean {
  ensureInitialized();
  const registry = getTemplateRegistry();
  return registry.isCrudDashboardRelated(requirements);
}

// Re-export individual templates for direct access
export { authFlowTemplate } from './auth-flow';
export { crudDashboardTemplate } from './crud-dashboard';
// Bootstrap templates
export { bootstrapGenericTemplate } from './bootstrap-generic';
export { bootstrapHealthcareTemplate } from './bootstrap-healthcare';
export { bootstrapFigmaTemplate } from './bootstrap-figma';
// Healthcare templates
export { auditLoggerTemplate } from './audit-logger';
export { fhirClientTemplate } from './fhir-client';
export { secureMessagingTemplate } from './secure-messaging';
export { patientPortalTemplate } from './patient-portal';
export { appointmentSchedulerTemplate } from './appointment-scheduler';

/**
 * Get the appropriate bootstrap template based on source and compliance mode
 *
 * @param options.source - 'figma' or 'text' - determines if UI components are included
 * @param options.complianceMode - 'generic' or 'hipaa' - determines healthcare compliance features
 *
 * For Figma builds: Use bootstrapFigmaTemplate (infrastructure only, no UI)
 * For Text builds with HIPAA: Use bootstrapHealthcareTemplate
 * For Text builds without HIPAA: Use bootstrapGenericTemplate
 */
export function getBootstrapTemplate(options: {
  source?: 'figma' | 'text';
  complianceMode?: 'generic' | 'hipaa';
} = {}) {
  const { source = 'text', complianceMode = 'generic' } = options;

  // Figma builds use infrastructure-only template (no UI components)
  if (source === 'figma') {
    return bootstrapFigmaTemplate;
  }

  // Text builds include UI components
  return complianceMode === 'hipaa' ? bootstrapHealthcareTemplate : bootstrapGenericTemplate;
}

/**
 * Check if requirements suggest healthcare/HIPAA compliance
 */
export function isHealthcareRelated(requirements: string): boolean {
  const healthcarePatterns = [
    /\bhipaa\b/i,
    /\bphi\b/i,
    /\bhealthcare\b/i,
    /\bmedical\b/i,
    /\bpatient\b/i,
    /\bprovider\b/i,
    /\bclinic\b/i,
    /\bhospital\b/i,
    /\bhealth\s*care\b/i,
    /\behr\b/i,
    /\bemr\b/i,
    /\bfhir\b/i,
    /\bepic\b/i,
  ];

  return healthcarePatterns.some(pattern => pattern.test(requirements));
}
