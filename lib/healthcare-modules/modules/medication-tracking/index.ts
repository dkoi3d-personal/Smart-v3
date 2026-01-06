/**
 * Medication Tracking Module
 *
 * Comprehensive medication tracking with:
 * - Full medication list with dosage instructions
 * - High-risk medication alerts (opioids, blood thinners, etc.)
 * - Drug interaction detection
 * - Adherence tracking support
 * - Refill reminders
 */

import { HealthcareModule } from '../../types';
import { quickBuildFiles } from './quick-build-files';
import { agentBuildFiles } from './agent-build-files';

export const medicationTrackingModule: HealthcareModule = {
  id: 'medication-tracking-v1',
  name: 'Medication Tracking',
  version: '1.0.0',
  description: 'Track patient medications from Epic with dosage instructions, high-risk medication alerts, and drug interaction warnings',
  category: 'clinical',
  level: 3, // Feature level - multi-file feature

  // ---------------------------------------------------------------------------
  // MATCHING & DISCOVERY
  // ---------------------------------------------------------------------------
  keywords: [
    'medication',
    'medications',
    'drug',
    'drugs',
    'prescription',
    'prescriptions',
    'rx',
    'pharmacy',
    'dosage',
    'dose',
    'high-risk',
    'opioid',
    'blood thinner',
    'anticoagulant',
    'warfarin',
    'insulin',
    'drug interaction',
    'adherence',
    'refill',
    'epic',
    'fhir',
    'medication list',
    'med list',
    'meds',
    'pill',
    'pills',
    'medicine',
  ],

  storyPatterns: [
    'medication.*track',
    'medication.*list',
    'medication.*display',
    'medication.*view',
    'medication.*alert',
    'drug.*interaction',
    'high.*risk.*medication',
    'opioid.*alert',
    'blood.*thinner',
    'anticoagulant',
    'prescription.*list',
    'dosage.*instruction',
    'medication.*adherence',
    'refill.*reminder',
    'pharmacy.*integration',
    'epic.*medication',
    'fhir.*medication',
  ],

  domainMatches: [
    'clinical',
    'pharmacy',
    'medication',
    'healthcare',
    'ehr',
    'fhir',
    'patient-safety',
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
## Medication Tracking Module - Customization Guide

### Overview
This module provides comprehensive medication tracking components including:
- MedicationList: Full list with filtering
- MedicationCard: Individual medication display with expandable details
- HighRiskMedicationAlert: Alerts for dangerous medications
- DrugInteractionWarning: Detected drug-drug interactions
- MedicationSummaryCard: Compact summary for dashboards
- useMedications: Hook for fetching and processing medication data

### Files Provided
1. **types.ts** - Type definitions and high-risk medication database
2. **useMedications.ts** - Data fetching hook with interaction detection
3. **MedicationList.tsx** - Main list component with filtering
4. **MedicationCard.tsx** - Expandable medication card
5. **HighRiskMedicationAlert.tsx** - Alert banner for high-risk meds
6. **DrugInteractionWarning.tsx** - Interaction warnings display
7. **MedicationSummaryCard.tsx** - Dashboard summary widget

### Required Customizations

1. **High-Risk Medication Database**: Add organization-specific high-risk medications
   - Modify HIGH_RISK_MEDICATIONS in types.ts
   - Add specialty-specific categories (e.g., chemotherapy, immunosuppressants)

2. **Drug Interactions**: Expand the COMMON_INTERACTIONS list
   - Add clinically relevant interactions for your population
   - Adjust severity levels based on institutional guidelines

3. **FHIR Endpoint**: Update the API endpoint if not using Epic
   - Modify useMedications.ts for Cerner, SMART on FHIR, etc.
   - Map EHR-specific fields to the Medication interface

4. **Styling**: Match your design system
   - Update color schemes for severity indicators
   - Adjust spacing and typography

5. **Clinical Workflow**: Customize recommended actions
   - Add organization-specific guidance
   - Wire up to clinical decision support if available

### DO NOT Modify
- Core high-risk detection logic (clinically validated)
- FHIR resource parsing patterns (follow spec)
- Loading/error state patterns (consistent UX)

### Integration Points
- Uses Epic FHIR proxy at \`/api/epic/fhir\`
- Works with PatientSearch and PatientBanner from patient module
- Can integrate with clinical decision support APIs

### High-Risk Categories
- **Opioids**: Addiction risk, overdose risk
- **Anticoagulants**: Bleeding risk, requires monitoring
- **Insulin**: Hypoglycemia risk
- **Narrow Therapeutic Index**: Digoxin, lithium, etc.
`,

    acceptanceCriteria: [
      'Medication list displays all active medications for selected patient',
      'High-risk medications are clearly identified with visual alerts',
      'Drug interactions are detected and displayed with severity levels',
      'Dosage instructions are visible for each medication',
      'Filter toggles between all medications and high-risk only',
      'Loading states shown during data fetches',
      'Error states displayed with retry option',
      'Components are responsive on mobile and desktop',
      'Accessibility: proper ARIA labels and keyboard navigation',
      'Medication cards expand to show full details',
    ],

    antiPatterns: [
      'DO NOT store medication data in localStorage or sessionStorage',
      'DO NOT log medication details to console in production',
      'DO NOT hardcode patient IDs - always use search or context',
      'DO NOT bypass high-risk alerts - they are patient safety features',
      'DO NOT modify clinical severity levels without clinical review',
      'DO NOT remove drug interaction warnings',
    ],

    qualityChecklist: [
      'All components handle loading state with skeleton UI',
      'All components handle error state with user-friendly messages',
      'All components handle empty data state',
      'High-risk medications visually distinct from regular medications',
      'Drug interaction severity clearly communicated (color + text)',
      'Medication names display both brand and generic when available',
      'Dosage formatted consistently (value + unit)',
      'Frequency displayed in human-readable format',
      'Route of administration shown with appropriate icons',
      'Prescriber information visible when available',
      'Start date and last filled date displayed',
      'Filter state persists during session',
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
    regulations: ['45 CFR §164.312', 'DEA requirements for controlled substances'],
  },

  // ---------------------------------------------------------------------------
  // DEPENDENCIES
  // ---------------------------------------------------------------------------
  dependencies: {
    modules: ['patient-fhir-display-v1'], // Requires patient module for search/banner
    packages: {
      'clsx': '^2.1.0',
      'tailwind-merge': '^2.2.0',
    },
    services: ['epic-fhir'],
    fhirResources: ['MedicationRequest', 'Medication', 'Patient'],
  },

  // ---------------------------------------------------------------------------
  // DOCUMENTATION
  // ---------------------------------------------------------------------------
  documentation: {
    overview: `
# Medication Tracking Module

This module provides comprehensive medication tracking for healthcare applications.
It integrates with Epic FHIR APIs to display patient medications with:

- **Dosage Instructions**: Clear display of how to take each medication
- **High-Risk Alerts**: Automatic detection of opioids, blood thinners, and other dangerous medications
- **Drug Interactions**: Detection of common drug-drug interactions
- **Visual Organization**: Category-based grouping with color coding

## Components Included
- **MedicationList**: Main list view with filtering options
- **MedicationCard**: Individual medication display with expandable details
- **HighRiskMedicationAlert**: Alert banner summarizing high-risk medications
- **DrugInteractionWarning**: Warning cards for detected interactions
- **MedicationSummaryCard**: Compact widget for dashboards
- **useMedications**: React hook for fetching and processing data

## Patient Safety Features
This module is designed with patient safety as a priority:
- Opioids, anticoagulants, and insulin are automatically flagged
- Drug interactions are checked against a clinical database
- Visual indicators use clinical color conventions (red=danger, amber=warning)
`,

    quickStart: `
## Quick Start

1. Import the components:
\`\`\`tsx
import { MedicationList, MedicationSummaryCard } from '@/components/medications';
import { PatientSearch, PatientBanner } from '@/components/patient';
\`\`\`

2. Use in your page:
\`\`\`tsx
export default function MedicationsPage() {
  const [patientId, setPatientId] = useState<string | null>(null);

  return (
    <div className="p-6">
      <PatientSearch onSelect={setPatientId} />

      {patientId && (
        <>
          <PatientBanner patientId={patientId} />
          <MedicationList
            patientId={patientId}
            showHighRiskAlerts={true}
            showInteractionWarnings={true}
          />
        </>
      )}
    </div>
  );
}
\`\`\`

3. The components handle loading, error, and empty states automatically.
`,

    examples: [
      {
        title: 'Basic Medication List',
        description: 'Simple medication list with all features enabled',
        code: `
<MedicationList
  patientId={selectedPatientId}
  showHighRiskAlerts={true}
  showInteractionWarnings={true}
/>`,
        language: 'tsx',
      },
      {
        title: 'Dashboard Summary Card',
        description: 'Compact card showing medication count and alerts',
        code: `
<MedicationSummaryCard
  patientId={patientId}
  onClick={() => router.push('/medications')}
/>`,
        language: 'tsx',
      },
      {
        title: 'Using the Hook Directly',
        description: 'Access medication data for custom displays',
        code: `
const {
  medications,
  highRiskMedications,
  interactions,
  loading,
  error
} = useMedications(patientId);

// Build custom UI with the data
return (
  <div>
    {highRiskMedications.map(med => (
      <Alert key={med.id} variant="warning">
        {med.name} is a high-risk medication
      </Alert>
    ))}
  </div>
);`,
        language: 'tsx',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // METADATA
  // ---------------------------------------------------------------------------
  testCoverage: 80,
  lastAuditDate: '2024-12-26',
  knownIssues: [
    'Drug interaction database is limited - expand for production use',
    'Refill tracking requires additional FHIR endpoint',
  ],
  tags: [
    'medication',
    'pharmacy',
    'high-risk',
    'opioid',
    'anticoagulant',
    'drug-interaction',
    'patient-safety',
    'epic',
    'fhir',
    'clinical',
  ],
};

export default medicationTrackingModule;
