/**
 * Medication Tracking - Agent Build Files
 *
 * Extended files with customization points for AI agents.
 * These provide more flexibility for complex builds.
 */

import { ModuleFile } from '../../types';
import { quickBuildFiles } from './quick-build-files';

// For agent builds, we use the same base files but can add more complexity
export const agentBuildFiles: ModuleFile[] = quickBuildFiles.map(file => ({
  ...file,
  customizationPoints: getCustomizationPoints(file.path),
}));

function getCustomizationPoints(path: string): ModuleFile['customizationPoints'] {
  switch (path) {
    case 'components/medications/types.ts':
      return [
        {
          line: 10,
          description: 'Add additional medication fields as needed (e.g., NDC code, lot number)',
          example: 'ndcCode?: string;',
        },
        {
          line: 55,
          description: 'Add more high-risk medications specific to your use case',
          example: "'metoprolol': { category: 'cardiovascular', reason: 'Beta blocker - monitor heart rate' },",
        },
      ];

    case 'components/medications/useMedications.ts':
      return [
        {
          line: 30,
          description: 'Modify the FHIR endpoint URL if using a different EHR system',
          example: "const response = await fetch(`/api/cerner/fhir/MedicationRequest?patient=${patientId}`);",
        },
        {
          line: 85,
          description: 'Add custom medication mapping logic for your EHR',
          example: '// Add Cerner-specific field mapping here',
        },
      ];

    case 'components/medications/MedicationList.tsx':
      return [
        {
          line: 45,
          description: 'Customize the filter options based on your requirements',
          example: "type FilterType = 'all' | 'high-risk' | 'anticoagulant' | 'opioid';",
        },
      ];

    case 'components/medications/MedicationCard.tsx':
      return [
        {
          line: 12,
          description: 'Add additional category colors as needed',
        },
        {
          line: 90,
          description: 'Customize the expanded details section with additional fields',
        },
      ];

    case 'components/medications/HighRiskMedicationAlert.tsx':
      return [
        {
          line: 75,
          description: 'Customize the recommended actions based on clinical workflow',
        },
      ];

    case 'app/page.tsx':
      return [
        {
          line: 15,
          description: 'Add additional dashboard components or metrics',
          example: '<AdherenceTracker patientId={patientId} />',
        },
        {
          line: 25,
          description: 'Customize the layout for your specific use case',
        },
      ];

    default:
      return undefined;
  }
}
