/**
 * Patient Portal Template
 * Patient-facing dashboard for records, appointments, messages
 */

import { FeatureTemplate } from '../types';
import { patientPortalFiles } from './files';
import { patientPortalTests } from './tests';
import { patientPortalRequirements } from './requirements';

export const patientPortalTemplate: FeatureTemplate = {
  id: 'patient-portal',
  name: 'Patient Portal',
  version: '1.0.0',
  description: 'Patient-facing dashboard with health records, appointments, messaging, and profile management',
  category: 'healthcare',

  keywords: [
    'patient portal',
    'my health',
    'records',
    'health records',
    'patient dashboard',
    'healthcare portal',
    'patient engagement',
    'health information',
    'personal health',
    'phim',
    'consumer health',
  ],

  patterns: [
    'patient.*portal',
    'health.*dashboard',
    'my.*health',
    'patient.*records',
    'consumer.*health',
    'personal.*health.*record',
  ],

  files: patientPortalFiles,
  tests: patientPortalTests,
  requirements: patientPortalRequirements,

  dependencies: {
    packages: {
      'date-fns': '^3.0.0',
    },
    devPackages: {},
    expectedModels: [],
  },

  agentInstructions: `
## Patient Portal Template Customization

### What's Pre-Built:
- Portal layout with navigation sidebar
- Dashboard with health summary widgets
- Health records view with tabs (conditions, medications, vitals)
- Appointments list with book/reschedule/cancel
- Messages integration (uses secure-messaging template)
- Profile page with preferences

### File Locations:
- Layout: \`app/(portal)/portal/layout.tsx\`
- Pages: \`app/(portal)/portal/\` (dashboard, records, appointments, messages, profile)
- Components: \`components/portal/\`
- Hooks: \`hooks/usePatientData.ts\`, \`hooks/usePortalStats.ts\`
- API: \`app/api/portal/stats/route.ts\`
- Tests: \`__tests__/portal/\`

### Integration with Other Templates:
This template works best when combined with:
- **fhir-client**: Provides useFhirPatient, useFhirConditions, etc.
- **secure-messaging**: Provides useConversations, ChatWindow, etc.
- **appointment-scheduler**: Provides appointment booking flow

### Environment Variables:
Uses same variables as fhir-client template.

### How to Use:

1. **Access the portal**:
Navigate to \`/portal/dashboard\` (requires authentication)

2. **Customize the dashboard**:
\`\`\`tsx
// Add custom widgets to dashboard
<HealthSummary vitals={vitals} conditions={conditions} />
<QuickActions />

// Add custom stats
const { stats } = usePortalStats();
\`\`\`

3. **Use components in custom pages**:
\`\`\`tsx
<RecordCard
  type="condition"
  title="Diabetes"
  status="active"
  date={new Date()}
/>

<AppointmentCard
  providerName="Dr. Smith"
  type="telehealth"
  startTime={new Date()}
  status="confirmed"
  onJoin={() => startVideoCall()}
/>
\`\`\`

4. **Aggregate patient data**:
\`\`\`tsx
const {
  patient,
  conditions,
  medications,
  vitals,
  conversations,
  unreadMessages,
  loading,
} = usePatientData();
\`\`\`

### Customization Needed:
1. Configure portal branding (logo, colors)
2. Add custom widgets to dashboard
3. Configure which record types to show
4. Set up notification preferences logic
5. Add custom quick actions for your use case
6. Integrate with your appointment booking flow

### DO NOT Modify:
- Portal layout authentication flow
- Navigation badge logic
- Stats fetching structure
`,
};
