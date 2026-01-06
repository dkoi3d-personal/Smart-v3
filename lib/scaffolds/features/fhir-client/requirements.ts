/**
 * FHIR Client Template - Requirements
 */

import { TemplateRequirements } from '../types';

export const fhirClientRequirements: TemplateRequirements = {
  text: `
## FHIR/EPIC Integration (Pre-Built)

The following FHIR integration features are pre-scaffolded:

### SMART on FHIR OAuth
- OAuth 2.0 authorization flow for EPIC/Cerner
- \`/authorize\` - Redirects to EHR authorization
- \`/callback\` - Handles OAuth callback and token exchange
- Secure token storage with automatic refresh
- Session integration with existing auth

### Pre-Built Components
- \`PatientBanner\` - Displays patient demographics header
- \`PatientSearch\` - Search patients by name/MRN
- \`VitalsChart\` - Visualize observation data
- \`MedicationList\` - Display active medications
- \`ConditionList\` - Display patient conditions

### Pre-Built Hooks
- \`useFhirPatient()\` - Fetch patient demographics
- \`useFhirObservations()\` - Fetch vitals/labs
- \`useFhirConditions()\` - Fetch problem list
- \`useFhirMedications()\` - Fetch medication list
- \`useFhirClient()\` - Low-level FHIR client access

### Pre-Built API Routes
- \`GET /api/fhir/auth\` - Start OAuth flow
- \`GET /api/fhir/callback\` - OAuth callback
- \`GET /api/fhir/token\` - Token refresh
- \`GET/POST /api/fhir/[...path]\` - FHIR proxy to EHR

### FHIR Resources Supported
- Patient - Demographics
- Observation - Vitals, Labs
- Condition - Problem list
- MedicationRequest - Active medications
- AllergyIntolerance - Allergies
- Immunization - Vaccine history
- Encounter - Visits
- DiagnosticReport - Lab results

### Customization Needed
- Configure EPIC/Cerner OAuth credentials in .env
- Set up allowed redirect URIs in EHR portal
- Add additional FHIR resource queries as needed
- Customize patient display components
`,
  priority: 20, // High priority - core healthcare integration
};
