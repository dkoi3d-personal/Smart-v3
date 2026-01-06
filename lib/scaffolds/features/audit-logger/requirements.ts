/**
 * Audit Logger Template - Requirements
 */

import { TemplateRequirements } from '../types';

export const auditLoggerRequirements: TemplateRequirements = {
  text: `
## HIPAA Audit Logging (Pre-Built)

The following audit logging features are pre-scaffolded for HIPAA compliance:

### Audit Trail
- Automatic logging of all PHI access
- User activity tracking (who, what, when, where)
- Immutable log storage in database
- IP address and user agent capture

### Pre-Built Components
- \`AuditTable\` - Paginated log viewer
- \`AuditFilters\` - Date range, action type, user filters
- \`AuditDetail\` - Detailed event modal

### Pre-Built API Endpoints
- \`GET /api/audit\` - Query audit logs with filters
- \`GET /api/audit/export\` - Export logs for compliance review

### Audit Logger Utility
- \`auditLog()\` - Log any PHI access event
- \`withAuditLogging()\` - Middleware for automatic API logging
- PHI access detection and flagging

### Logged Events
- VIEW - Reading patient data
- CREATE - New record creation
- UPDATE - Record modifications
- DELETE - Record deletion
- EXPORT - Data exports
- LOGIN/LOGOUT - Authentication events

### Admin Dashboard
- \`/admin/audit-log\` - View and search audit logs
- Filter by date, user, action type
- Export to CSV for compliance audits

### Customization Needed
- Configure log retention period
- Set up log archival for long-term storage
- Add custom event types as needed
- Configure alerting for suspicious activity
`,
  priority: 15, // High priority - compliance foundation
};
