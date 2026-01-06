/**
 * Healthcare Bootstrap Template - Requirements
 */

import { TemplateRequirements } from '../types';

export const bootstrapHealthcareRequirements: TemplateRequirements = {
  text: `
## Healthcare Project Foundation (Pre-Built)

The following HIPAA-ready project foundation is pre-scaffolded:

### Everything from Generic Bootstrap PLUS:

### HIPAA Compliance Features
- Audit logging for all PHI access
- PHI-safe console logging (redacts sensitive data)
- Session timeout warnings
- Role-based access control (patient, provider, admin)

### Healthcare User Model
- Role field (patient, provider, care_team, admin)
- Specialty field (for providers)
- NPI number field (for providers)
- Organization association

### Healthcare Prisma Models
- AuditLog - Compliance tracking
- Conversation, Message, Participant - Secure messaging
- Appointment, Schedule - Scheduling
- Organization - Multi-tenant support

### Pre-Built Healthcare Components
- PHIWarning - Data sensitivity indicator
- SessionTimeout - Inactivity warning
- RoleGuard - Role-based route protection

### Environment Variables
- All generic variables PLUS:
- FHIR_BASE_URL
- FHIR_CLIENT_ID
- FHIR_CLIENT_SECRET
- NEXT_PUBLIC_SOCKET_URL

### Customization Needed
- Configure HIPAA log retention (default: 7 years)
- Set up log archival for compliance
- Configure FHIR/EPIC credentials
- Set session timeout duration
`,
  priority: 100, // Highest priority - foundation
};
