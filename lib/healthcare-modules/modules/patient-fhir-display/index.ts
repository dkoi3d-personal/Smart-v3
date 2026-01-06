/**
 * Patient FHIR Display Module
 *
 * Pre-built components for displaying patient data from FHIR APIs.
 * Supports both quick-build (instant) and agent-build (customizable) modes.
 */

import { HealthcareModule } from '../../types';
import { quickBuildFiles } from './quick-build-files';
import { agentBuildFiles } from './agent-build-files';

export const patientFhirDisplayModule: HealthcareModule = {
  id: 'patient-fhir-display-v1',
  name: 'Patient FHIR Display',
  version: '1.0.0',
  description: 'Pre-built components for displaying patient demographics, search, and clinical summary using FHIR APIs',
  category: 'clinical',
  level: 2, // Component level

  // ---------------------------------------------------------------------------
  // MATCHING & DISCOVERY
  // ---------------------------------------------------------------------------
  keywords: [
    'patient',
    'fhir',
    'epic',
    'demographics',
    'patient search',
    'patient lookup',
    'patient banner',
    'patient card',
    'patient display',
    'ehr',
    'emr',
    'clinical',
    'healthcare',
  ],

  storyPatterns: [
    'patient.*search',
    'patient.*lookup',
    'patient.*display',
    'patient.*banner',
    'patient.*demographics',
    'fhir.*patient',
    'epic.*patient',
    'view.*patient',
    'show.*patient',
  ],

  domainMatches: [
    'clinical',
    'patient',
    'healthcare',
    'ehr',
    'fhir',
  ],

  // ---------------------------------------------------------------------------
  // QUICK BUILD MODE
  // ---------------------------------------------------------------------------
  quickBuild: {
    enabled: true,
    files: quickBuildFiles,
    dependencies: {
      'clsx': '^2.1.0',
      'tailwind-merge': '^2.2.0',
    },
    devDependencies: {},
  },

  // ---------------------------------------------------------------------------
  // AGENT BUILD MODE
  // ---------------------------------------------------------------------------
  agentBuild: {
    enabled: true,
    files: agentBuildFiles,

    customizationGuide: `
## Patient FHIR Display Module - Customization Guide

### Overview
This module provides pre-built components for displaying patient data from FHIR APIs.
The components use the existing Epic FHIR hooks from \`lib/epic-fhir/\`.

### Files Provided
1. **PatientBanner.tsx** - Header banner showing patient photo, name, DOB, MRN
2. **PatientSearch.tsx** - Searchable patient picker with autocomplete
3. **PatientCard.tsx** - Compact card view of patient info
4. **PatientDemographics.tsx** - Detailed demographics display

### Required Customizations

1. **Styling**: Update Tailwind classes to match your design system
   - Check \`className\` props throughout
   - Adjust colors, spacing, typography as needed

2. **Fields Displayed**: Modify which patient fields are shown
   - Add/remove fields in the component render
   - Update types if adding custom fields

3. **Navigation**: Wire up click handlers
   - PatientCard onClick should navigate to patient detail
   - Search result selection should update app state

4. **Error States**: Customize error messages
   - Update error text for your context
   - Add retry buttons if needed

### DO NOT Modify
- FHIR data fetching logic (hooks are pre-tested)
- Type definitions (match FHIR R4 spec)
- Loading state patterns (consistent UX)

### Integration Points
- Uses \`usePatient\`, \`usePatientSearch\` from \`lib/epic-fhir/hooks\`
- Expects Epic FHIR proxy at \`/api/epic/fhir\`
- Works with sandbox patients: Camila Lopez, Theodore Mychart
`,

    acceptanceCriteria: [
      'Patient search returns results with debounced input',
      'Patient banner displays name, DOB, age, and MRN',
      'Loading states shown during data fetches',
      'Error states displayed with user-friendly messages',
      'Components are responsive on mobile and desktop',
      'Accessibility: proper ARIA labels and keyboard navigation',
    ],

    antiPatterns: [
      'DO NOT store PHI in localStorage or sessionStorage',
      'DO NOT log patient data to console in production',
      'DO NOT make FHIR calls directly - use the hooks',
      'DO NOT hardcode patient IDs - always use search or context',
    ],

    qualityChecklist: [
      'All components handle loading state',
      'All components handle error state',
      'All components handle empty data state',
      'Patient name formatted correctly (Last, First)',
      'DOB formatted in locale-appropriate format',
      'Age calculated correctly',
      'MRN displayed when available',
      'Search debounces to avoid excessive API calls',
    ],
  },

  // ---------------------------------------------------------------------------
  // COMPLIANCE
  // ---------------------------------------------------------------------------
  compliance: {
    hipaaRelevant: true,
    requiresBAA: true,
    phiHandling: 'display',
    certifications: ['HIPAA', 'HITRUST'],
    regulations: ['45 CFR §164.312'],
  },

  // ---------------------------------------------------------------------------
  // DEPENDENCIES
  // ---------------------------------------------------------------------------
  dependencies: {
    modules: [],
    packages: {
      'clsx': '^2.1.0',
      'tailwind-merge': '^2.2.0',
    },
    services: ['epic-fhir'],
    fhirResources: ['Patient'],
  },

  // ---------------------------------------------------------------------------
  // DOCUMENTATION
  // ---------------------------------------------------------------------------
  documentation: {
    overview: `
# Patient FHIR Display Module

This module provides ready-to-use React components for displaying patient data
from FHIR R4 APIs (Epic, Cerner, etc.).

## Components Included
- **PatientBanner**: Full-width header with patient photo and key info
- **PatientSearch**: Typeahead search for finding patients
- **PatientCard**: Compact card for patient lists
- **PatientDemographics**: Detailed demographics panel

## Prerequisites
- Epic FHIR API connection configured
- lib/epic-fhir hooks available
- Tailwind CSS configured
`,

    quickStart: `
## Quick Start

1. Import the components:
\`\`\`tsx
import { PatientBanner, PatientSearch, PatientCard } from '@/components/patient';
\`\`\`

2. Use in your page:
\`\`\`tsx
export default function PatientPage() {
  const [patientId, setPatientId] = useState<string | null>(null);

  return (
    <div>
      <PatientSearch onSelect={setPatientId} />
      {patientId && <PatientBanner patientId={patientId} />}
    </div>
  );
}
\`\`\`

3. The components handle loading, error, and empty states automatically.
`,

    examples: [
      {
        title: 'Basic Patient Search',
        description: 'Simple patient search with selection callback',
        code: `
<PatientSearch
  onSelect={(patientId) => setSelectedPatient(patientId)}
  placeholder="Search by name or MRN..."
/>`,
        language: 'tsx',
      },
      {
        title: 'Patient Banner with Actions',
        description: 'Patient banner with custom action buttons',
        code: `
<PatientBanner
  patientId={selectedPatientId}
  showActions
  onSchedule={() => openScheduleModal()}
  onMessage={() => openMessageModal()}
/>`,
        language: 'tsx',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // METADATA
  // ---------------------------------------------------------------------------
  testCoverage: 85,
  lastAuditDate: '2024-12-01',
  knownIssues: [
    'Photo display requires Epic image URL support',
  ],
  tags: ['patient', 'fhir', 'epic', 'clinical', 'demographics'],
};

export default patientFhirDisplayModule;
