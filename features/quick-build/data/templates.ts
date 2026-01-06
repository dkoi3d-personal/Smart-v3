/**
 * Quick Build Templates
 *
 * Pre-configured Epic app templates with default API selections.
 */

import type { LucideIcon } from 'lucide-react';
import {
  Users,
  Pill,
  Activity,
  Calendar,
  FileText,
  Target,
  Search,
  Syringe,
  Heart,
  FlaskConical,
  Sparkles,
} from 'lucide-react';
import type { EpicApiCategory } from './epic-api-catalog';

export interface TemplateFeature {
  id: string;
  name: string;
  description: string;
  default: boolean;
  epicApiIds?: string[]; // Additional APIs needed for this feature
}

export interface QuickBuildTemplate {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  category: EpicApiCategory | 'custom';
  icon: LucideIcon;
  color: string;

  // Default Epic APIs included
  defaultEpicApis: string[];

  // Configurable features
  features: TemplateFeature[];

  // Estimated build time
  estimatedTime: string;

  // Tags for filtering
  tags: string[];

  // Is this a custom/blank template?
  isCustom?: boolean;
}

export const QUICK_BUILD_TEMPLATES: QuickBuildTemplate[] = [
  // ===== PATIENT TEMPLATES =====
  {
    id: 'patient-dashboard',
    name: 'Patient Dashboard',
    description: 'Complete patient overview with vitals, meds, and allergies',
    longDescription:
      'A comprehensive patient dashboard showing demographics, vital signs, active medications, allergies, and conditions in a clean clinical interface. Perfect for care coordination and patient summary views.',
    category: 'patient',
    icon: Users,
    color: 'blue',
    defaultEpicApis: ['patient', 'observation-vitals', 'medication-request', 'allergy-intolerance'],
    features: [
      {
        id: 'demographics',
        name: 'Patient Demographics',
        description: 'Name, DOB, MRN, contact info, photo',
        default: true,
      },
      {
        id: 'vitals',
        name: 'Vital Signs Chart',
        description: 'BP, heart rate, temp, weight trends',
        default: true,
      },
      {
        id: 'medications',
        name: 'Medications List',
        description: 'Active prescriptions with dosage',
        default: true,
      },
      {
        id: 'allergies',
        name: 'Allergies Section',
        description: 'Drug, food, environmental allergies',
        default: true,
      },
      {
        id: 'conditions',
        name: 'Conditions History',
        description: 'Active diagnoses and problem list',
        default: false,
        epicApiIds: ['condition'],
      },
      {
        id: 'labs',
        name: 'Lab Results Panel',
        description: 'Recent lab values with trends',
        default: false,
        epicApiIds: ['observation-labs'],
      },
    ],
    estimatedTime: '~2 min',
    tags: ['patient', 'clinical', 'dashboard', 'overview'],
  },

  {
    id: 'patient-search',
    name: 'Patient Search',
    description: 'Search and lookup patients by name or MRN',
    longDescription:
      'A patient search tool with real-time search by name, MRN, or date of birth. Shows results in a list with quick access to patient summary information.',
    category: 'patient',
    icon: Search,
    color: 'slate',
    defaultEpicApis: ['patient'],
    features: [
      {
        id: 'search',
        name: 'Search Interface',
        description: 'Search by name, MRN, or DOB',
        default: true,
      },
      {
        id: 'results-grid',
        name: 'Results Grid',
        description: 'Paginated search results',
        default: true,
      },
      {
        id: 'quick-view',
        name: 'Quick View Panel',
        description: 'Preview patient without navigation',
        default: true,
      },
      {
        id: 'recent-patients',
        name: 'Recent Patients',
        description: 'List of recently viewed patients',
        default: false,
      },
    ],
    estimatedTime: '~1.5 min',
    tags: ['patient', 'search', 'lookup'],
  },

  // ===== CLINICAL TEMPLATES =====
  {
    id: 'clinical-summary',
    name: 'Clinical Summary',
    description: 'Vitals, labs, diagnoses, and procedures in one view',
    longDescription:
      'A clinical summary view combining vital signs, laboratory results, diagnoses, and procedures. Ideal for clinical review and handoff situations.',
    category: 'clinical',
    icon: Activity,
    color: 'purple',
    defaultEpicApis: ['patient', 'observation-vitals', 'observation-labs', 'condition'],
    features: [
      {
        id: 'vitals',
        name: 'Vital Signs',
        description: 'Current and trending vitals',
        default: true,
      },
      {
        id: 'labs',
        name: 'Lab Results',
        description: 'Recent labs with reference ranges',
        default: true,
      },
      {
        id: 'conditions',
        name: 'Problem List',
        description: 'Active diagnoses',
        default: true,
      },
      {
        id: 'procedures',
        name: 'Procedure History',
        description: 'Surgical and procedure history',
        default: false,
        epicApiIds: ['procedure'],
      },
      {
        id: 'reports',
        name: 'Diagnostic Reports',
        description: 'Lab panels and radiology reports',
        default: false,
        epicApiIds: ['diagnostic-report'],
      },
    ],
    estimatedTime: '~2 min',
    tags: ['clinical', 'summary', 'vitals', 'labs'],
  },

  {
    id: 'lab-results-viewer',
    name: 'Lab Results Viewer',
    description: 'Lab panels with trends and reference ranges',
    longDescription:
      'A dedicated lab results viewer with trending charts, reference ranges, and abnormal value highlighting. Great for monitoring chronic conditions.',
    category: 'clinical',
    icon: FlaskConical,
    color: 'emerald',
    defaultEpicApis: ['patient', 'observation-labs', 'diagnostic-report'],
    features: [
      {
        id: 'lab-panels',
        name: 'Lab Panels',
        description: 'CBC, BMP, lipids organized by panel',
        default: true,
      },
      {
        id: 'trend-charts',
        name: 'Trend Charts',
        description: 'Line charts for lab value trends',
        default: true,
      },
      {
        id: 'abnormal-flags',
        name: 'Abnormal Highlighting',
        description: 'Visual flags for out-of-range values',
        default: true,
      },
      {
        id: 'reference-ranges',
        name: 'Reference Ranges',
        description: 'Show normal ranges for each test',
        default: true,
      },
    ],
    estimatedTime: '~2 min',
    tags: ['clinical', 'labs', 'diagnostics', 'trends'],
  },

  {
    id: 'immunization-record',
    name: 'Immunization Record',
    description: 'Vaccine history, due dates, and series tracking',
    longDescription:
      'Complete immunization record showing vaccine history, series completion status, and upcoming due dates. Useful for wellness visits and school/travel requirements.',
    category: 'clinical',
    icon: Syringe,
    color: 'teal',
    defaultEpicApis: ['patient', 'immunization'],
    features: [
      {
        id: 'vaccine-history',
        name: 'Vaccine History',
        description: 'All administered vaccines',
        default: true,
      },
      {
        id: 'timeline',
        name: 'Immunization Timeline',
        description: 'Visual timeline of vaccinations',
        default: true,
      },
      {
        id: 'due-dates',
        name: 'Due Date Tracking',
        description: 'Upcoming and overdue vaccines',
        default: false,
      },
    ],
    estimatedTime: '~1.5 min',
    tags: ['clinical', 'immunizations', 'vaccines'],
  },

  // ===== MEDICATION TEMPLATES =====
  {
    id: 'medication-tracker',
    name: 'Medication Tracker',
    description: 'Active medications with high-risk alerts',
    longDescription:
      'A medication tracking app showing active prescriptions, dosage instructions, high-risk medication alerts, and potential drug interactions.',
    category: 'medications',
    icon: Pill,
    color: 'green',
    defaultEpicApis: ['patient', 'medication-request'],
    features: [
      {
        id: 'med-list',
        name: 'Medication List',
        description: 'All active prescriptions',
        default: true,
      },
      {
        id: 'dosage-info',
        name: 'Dosage Instructions',
        description: 'How and when to take each med',
        default: true,
      },
      {
        id: 'high-risk-alerts',
        name: 'High-Risk Alerts',
        description: 'Alerts for opioids, anticoagulants',
        default: true,
      },
      {
        id: 'interactions',
        name: 'Drug Interactions',
        description: 'Potential interaction warnings',
        default: false,
      },
      {
        id: 'allergies',
        name: 'Allergy Cross-Check',
        description: 'Check meds against allergies',
        default: false,
        epicApiIds: ['allergy-intolerance'],
      },
    ],
    estimatedTime: '~2 min',
    tags: ['medications', 'prescriptions', 'safety'],
  },

  {
    id: 'allergy-manager',
    name: 'Allergy Manager',
    description: 'View allergies with severity and reactions',
    longDescription:
      'An allergy management app showing all patient allergies with severity levels, reaction details, and categorization by type (drug, food, environmental).',
    category: 'medications',
    icon: Heart,
    color: 'red',
    defaultEpicApis: ['patient', 'allergy-intolerance'],
    features: [
      {
        id: 'allergy-list',
        name: 'Allergy List',
        description: 'All documented allergies',
        default: true,
      },
      {
        id: 'severity-badges',
        name: 'Severity Indicators',
        description: 'Visual severity levels',
        default: true,
      },
      {
        id: 'reaction-details',
        name: 'Reaction Details',
        description: 'What happens when exposed',
        default: true,
      },
      {
        id: 'category-filter',
        name: 'Category Filtering',
        description: 'Filter by drug/food/environmental',
        default: false,
      },
    ],
    estimatedTime: '~1.5 min',
    tags: ['medications', 'allergies', 'safety'],
  },

  // ===== SCHEDULING TEMPLATES =====
  {
    id: 'appointment-viewer',
    name: 'Appointment Viewer',
    description: 'Upcoming and past appointments calendar',
    longDescription:
      'View and manage patient appointments with calendar view, provider details, and visit preparation information.',
    category: 'scheduling',
    icon: Calendar,
    color: 'cyan',
    defaultEpicApis: ['patient', 'appointment'],
    features: [
      {
        id: 'upcoming',
        name: 'Upcoming Appointments',
        description: 'List of scheduled visits',
        default: true,
      },
      {
        id: 'calendar-view',
        name: 'Calendar View',
        description: 'Month/week calendar display',
        default: true,
      },
      {
        id: 'provider-info',
        name: 'Provider Details',
        description: 'Show provider and location',
        default: true,
        epicApiIds: ['practitioner', 'location'],
      },
      {
        id: 'past-visits',
        name: 'Past Appointments',
        description: 'Historical appointment list',
        default: false,
      },
    ],
    estimatedTime: '~2 min',
    tags: ['scheduling', 'appointments', 'calendar'],
  },

  // ===== DOCUMENTS TEMPLATES =====
  {
    id: 'document-viewer',
    name: 'Document Viewer',
    description: 'Clinical notes, reports, and documents',
    longDescription:
      'View clinical documents including notes, discharge summaries, reports, and uploaded files with full-text search.',
    category: 'documents',
    icon: FileText,
    color: 'indigo',
    defaultEpicApis: ['patient', 'document-reference'],
    features: [
      {
        id: 'document-list',
        name: 'Document List',
        description: 'All patient documents',
        default: true,
      },
      {
        id: 'viewer',
        name: 'Document Viewer',
        description: 'View document content',
        default: true,
      },
      {
        id: 'search',
        name: 'Document Search',
        description: 'Search document contents',
        default: true,
      },
      {
        id: 'imaging',
        name: 'Imaging Studies',
        description: 'Link to radiology images',
        default: false,
        epicApiIds: ['imaging-study'],
      },
    ],
    estimatedTime: '~2 min',
    tags: ['documents', 'notes', 'reports'],
  },

  // ===== CARE PLAN TEMPLATES =====
  {
    id: 'care-plan-display',
    name: 'Care Plan Display',
    description: 'Active care plans, goals, and team members',
    longDescription:
      'View active care plans with associated goals, activities, and care team members. Supports care coordination and patient engagement.',
    category: 'care',
    icon: Target,
    color: 'pink',
    defaultEpicApis: ['patient', 'care-plan', 'goal', 'care-team'],
    features: [
      {
        id: 'care-plans',
        name: 'Care Plans',
        description: 'Active treatment plans',
        default: true,
      },
      {
        id: 'goals',
        name: 'Health Goals',
        description: 'Patient goals with progress',
        default: true,
      },
      {
        id: 'care-team',
        name: 'Care Team',
        description: 'Team members and contacts',
        default: true,
      },
      {
        id: 'activities',
        name: 'Activity Checklist',
        description: 'Care plan activities',
        default: false,
      },
    ],
    estimatedTime: '~2 min',
    tags: ['care', 'plans', 'goals', 'coordination'],
  },

  // ===== CUSTOM TEMPLATE =====
  {
    id: 'custom',
    name: 'Custom Build',
    description: 'Start from scratch and pick your own APIs',
    longDescription:
      'Create a custom Epic app by selecting exactly which APIs and features you need. Full flexibility to build any healthcare application.',
    category: 'custom',
    icon: Sparkles,
    color: 'amber',
    defaultEpicApis: ['patient'], // Start with just patient
    features: [],
    estimatedTime: '~2-3 min',
    tags: ['custom', 'flexible', 'advanced'],
    isCustom: true,
  },
];

// Helper functions
export function getTemplateById(id: string): QuickBuildTemplate | undefined {
  return QUICK_BUILD_TEMPLATES.find(t => t.id === id);
}

export function getTemplatesByCategory(category: EpicApiCategory | 'custom' | 'all'): QuickBuildTemplate[] {
  if (category === 'all') return QUICK_BUILD_TEMPLATES;
  return QUICK_BUILD_TEMPLATES.filter(t => t.category === category);
}

export function getTemplateEpicApis(template: QuickBuildTemplate, enabledFeatures: string[]): string[] {
  const apis = new Set(template.defaultEpicApis);

  // Add APIs from enabled features
  template.features.forEach(feature => {
    if (enabledFeatures.includes(feature.id) && feature.epicApiIds) {
      feature.epicApiIds.forEach(apiId => apis.add(apiId));
    }
  });

  return Array.from(apis);
}

export function getDefaultEnabledFeatures(template: QuickBuildTemplate): string[] {
  return template.features.filter(f => f.default).map(f => f.id);
}
