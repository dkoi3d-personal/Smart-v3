/**
 * FHIR Client Template
 * SMART on FHIR OAuth + API wrapper for EPIC/Cerner
 */

import { FeatureTemplate } from '../types';
import { fhirClientFiles } from './files';
import { fhirClientTests } from './tests';
import { fhirClientRequirements } from './requirements';

export const fhirClientTemplate: FeatureTemplate = {
  id: 'fhir-client',
  name: 'FHIR Client',
  version: '1.0.0',
  description: 'SMART on FHIR OAuth integration with EPIC/Cerner, patient lookup, and clinical data hooks',
  category: 'integration',

  keywords: [
    'fhir',
    'epic',
    'cerner',
    'smart',
    'ehr',
    'emr',
    'patient data',
    'medical records',
    'healthcare',
    'clinical data',
    'patient portal',
    'health records',
    'vitals',
    'medications',
    'conditions',
    'observations',
    'oauth',
    'smart on fhir',
  ],

  patterns: [
    'fhir.*integration',
    'epic.*connect',
    'cerner.*api',
    'ehr.*integration',
    'patient.*records',
    'medical.*records',
    'smart.*on.*fhir',
    'clinical.*data',
  ],

  files: fhirClientFiles,
  tests: fhirClientTests,
  requirements: fhirClientRequirements,

  dependencies: {
    packages: {},
    devPackages: {},
    expectedModels: [],
  },

  agentInstructions: `
## FHIR Client Template Customization

### What's Pre-Built:
- SMART on FHIR OAuth 2.0 flow (authorize, callback, token refresh)
- FhirClient class for authenticated FHIR requests
- React hooks for Patient, Observations, Conditions, Medications
- PatientBanner, PatientSearch, VitalsChart, MedicationList, ConditionList components
- FHIR proxy API routes with audit logging
- Type definitions for common FHIR resources

### File Locations:
- Lib: \`lib/fhir/\` (types.ts, config.ts, auth.ts, client.ts)
- API: \`app/api/fhir/\` (auth, callback, proxy)
- Hooks: \`hooks/useFhir.ts\`
- Components: \`components/fhir/\`
- Pages: \`app/(fhir)/fhir/\` (dashboard, patient detail, error)
- Tests: \`__tests__/fhir/\`

### Environment Variables Required:
\`\`\`env
FHIR_BASE_URL=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
FHIR_CLIENT_ID=your-client-id
FHIR_CLIENT_SECRET=your-client-secret  # Optional for public apps
FHIR_REDIRECT_URI=http://localhost:3000/api/fhir/callback
\`\`\`

### How to Use:

1. **Start OAuth flow**:
\`\`\`typescript
// Redirect user to authorization
<a href="/api/fhir/auth">Connect to EHR</a>

// With launch context (EHR launch)
<a href="/api/fhir/auth?launch=xyz">Launch from EHR</a>
\`\`\`

2. **Use hooks in components**:
\`\`\`typescript
import { useFhirPatient, useFhirMedications } from '@/hooks/useFhir';

function PatientView({ patientId }) {
  const { data: patient, loading } = useFhirPatient({ patientId });
  const { data: meds } = useFhirMedications({ patientId });

  if (loading) return <Spinner />;
  return <div>{patient.name[0].text}</div>;
}
\`\`\`

3. **Make direct FHIR requests**:
\`\`\`typescript
import { FhirClient } from '@/lib/fhir/client';

const client = await FhirClient.create();
if (client) {
  const patient = await client.getPatient();
  const vitals = await client.getVitals();
  const conditions = await client.getConditions();
}
\`\`\`

4. **Use pre-built components**:
\`\`\`tsx
<PatientBanner patientId={patientId} />
<VitalsChart patientId={patientId} />
<MedicationList patientId={patientId} />
<ConditionList patientId={patientId} />
<PatientSearch onSelect={(patient) => router.push(\`/patient/\${patient.id}\`)} />
\`\`\`

### EPIC Sandbox Setup:
1. Register at https://fhir.epic.com/
2. Create a new app in the EPIC Developer Portal
3. Set redirect URI to your callback URL
4. Copy Client ID and configure .env
5. Test with EPIC sandbox patients

### Cerner Sandbox Setup:
1. Register at https://code.cerner.com/
2. Create a new app
3. Configure OAuth settings
4. Copy credentials to .env

### Customization Needed:
1. Configure FHIR server credentials in .env
2. Add additional FHIR resource queries as needed
3. Customize patient display components
4. Add error handling for your use cases
5. Implement token storage for production (database instead of cookies)

### DO NOT Modify:
- OAuth token exchange logic
- FHIR proxy authentication
- Cookie security settings
- Token refresh flow
`,
};
