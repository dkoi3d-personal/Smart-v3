/**
 * Patient Portal Template - Requirements
 */

import { TemplateRequirements } from '../types';

export const patientPortalRequirements: TemplateRequirements = {
  text: `
## Patient Portal (Pre-Built)

The following patient portal features are pre-scaffolded:

### Dashboard Overview
- Health summary at a glance
- Upcoming appointments widget
- Recent messages widget
- Quick action buttons
- Unread notifications

### Pre-Built Pages
- \`/portal/dashboard\` - Overview with widgets
- \`/portal/records\` - Medical records view
- \`/portal/appointments\` - Appointment history
- \`/portal/messages\` - Message inbox
- \`/portal/profile\` - Patient profile

### Pre-Built Components
- \`PortalNav\` - Navigation sidebar
- \`RecordCard\` - Clinical record display
- \`AppointmentCard\` - Appointment preview
- \`HealthSummary\` - Vitals/conditions overview
- \`QuickActions\` - Common patient actions

### Pre-Built Hooks
- \`usePatientData()\` - Aggregate patient data
- \`usePortalStats()\` - Dashboard statistics

### Integration Points
- FHIR client for medical records (fhir-client template)
- Messaging system (secure-messaging template)
- Appointment scheduling (appointment-scheduler template)

### Customization Needed
- Configure portal branding/theme
- Add custom widgets for your use case
- Configure which records are visible
- Set up notification preferences
`,
  priority: 16, // High priority for patient engagement
};
