/**
 * Audit Logger Template
 * HIPAA-compliant activity logging with persistence and admin UI
 */

import { FeatureTemplate } from '../types';
import { auditLoggerFiles } from './files';
import { auditLoggerTests } from './tests';
import { auditLoggerRequirements } from './requirements';

export const auditLoggerTemplate: FeatureTemplate = {
  id: 'audit-logger',
  name: 'HIPAA Audit Logger',
  version: '1.0.0',
  description: 'HIPAA-compliant audit trail with database persistence, query API, and admin dashboard',
  category: 'compliance',

  keywords: [
    'audit',
    'logging',
    'compliance',
    'hipaa',
    'access log',
    'audit trail',
    'phi access',
    'activity log',
    'security log',
    'healthcare compliance',
    'patient data access',
    'medical records',
    'ehr',
    'emr',
  ],

  patterns: [
    'audit.*log',
    'access.*log',
    'phi.*access',
    'hipaa.*compliance',
    'activity.*tracking',
    'user.*activity',
    'healthcare.*compliance',
  ],

  files: auditLoggerFiles,
  tests: auditLoggerTests,
  requirements: auditLoggerRequirements,

  dependencies: {
    packages: {},
    devPackages: {},
    expectedModels: ['AuditLog'],
  },

  agentInstructions: `
## HIPAA Audit Logger Template Customization

### What's Pre-Built:
- AuditLog Prisma model with all required fields
- auditLog() function for logging any PHI access event
- withAuditLogging() middleware for automatic API logging
- Query API with filters (date, action, user, resource, PHI)
- Export API for compliance CSV downloads
- Admin dashboard at /admin/audit-log
- AuditTable, AuditFilters, AuditDetail components

### File Locations:
- Lib: \`lib/audit/\` (logger.ts, middleware.ts, types.ts)
- API: \`app/api/audit/\` (query, export endpoints)
- Components: \`components/audit/\`
- Admin Page: \`app/admin/audit-log/page.tsx\`
- Tests: \`__tests__/audit/\`

### Required Prisma Model:
\`\`\`prisma
model AuditLog {
  id          String   @id @default(cuid())
  timestamp   DateTime @default(now())
  userId      Int?
  userEmail   String?
  action      String   // VIEW, CREATE, UPDATE, DELETE, EXPORT, LOGIN, LOGOUT
  resourceType String  // Patient, Appointment, Message, etc.
  resourceId  String?
  ipAddress   String?
  userAgent   String?
  details     Json?
  phiAccessed Boolean  @default(false)

  @@index([timestamp])
  @@index([userId])
  @@index([action])
  @@index([resourceType])
  @@index([phiAccessed])
}
\`\`\`

### How to Use:

1. **Log PHI access in API routes**:
\`\`\`typescript
import { auditLog } from '@/lib/audit/logger';

// In your API route
await auditLog({
  userId: session.user.id,
  userEmail: session.user.email,
  action: 'VIEW',
  resourceType: 'Patient',
  resourceId: patientId,
  phiAccessed: true,
  ipAddress: request.headers.get('x-forwarded-for'),
});
\`\`\`

2. **Use middleware for automatic logging**:
\`\`\`typescript
import { withAuditLogging } from '@/lib/audit/middleware';

async function handler(req: NextRequest, context: RouteContext) {
  // Your handler logic
  return NextResponse.json(data);
}

export const GET = withAuditLogging(handler, {
  action: 'VIEW',
  resourceType: 'Patient',
  phiAccessed: true,
});
\`\`\`

3. **Quick logging shortcuts**:
\`\`\`typescript
import { audit } from '@/lib/audit/logger';

// Convenience methods
await audit.view('Patient', patientId, { userId, userEmail });
await audit.create('Appointment', appointmentId, { userId, userEmail });
await audit.update('Patient', patientId, { userId, userEmail, details: { fields: ['name'] } });
await audit.delete('Message', messageId, { userId, userEmail });
await audit.export('Report', reportId, { userId, userEmail });
await audit.login({ userId, userEmail, ipAddress });
await audit.logout({ userId, userEmail });
\`\`\`

### PHI Resource Types:
The following resource types are automatically flagged as PHI:
- Patient
- Observation
- Condition
- MedicationRequest
- DiagnosticReport
- Immunization
- AllergyIntolerance
- Encounter
- CarePlan
- ClinicalNote

### Customization Needed:
1. Add your resource types to the PHI_RESOURCES list if needed
2. Configure log retention period (default: 7 years for HIPAA)
3. Set up log archival for long-term storage
4. Add custom event types as needed
5. Configure alerting for suspicious activity patterns

### DO NOT Modify:
- Core audit logging logic (ensures compliance)
- Timestamp handling (uses server time)
- PHI detection logic
- Export format (compliance-required fields)
`,
};
