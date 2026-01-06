/**
 * Appointment Scheduler Template - Requirements
 */

import { TemplateRequirements } from '../types';

export const appointmentSchedulerRequirements: TemplateRequirements = {
  text: `
## Appointment Scheduling (Pre-Built)

The following appointment scheduling features are pre-scaffolded:

### Booking Flow
- Provider selection
- Date/time picker with availability
- Visit type selection (in-person, telehealth, phone)
- Booking confirmation
- Appointment reminders

### Pre-Built Components
- \`Calendar\` - Date picker with availability indicators
- \`TimeSlots\` - Available time slot selection
- \`ProviderSelect\` - Provider search and selection
- \`BookingConfirm\` - Confirmation modal
- \`AppointmentSummary\` - Booking receipt

### Pre-Built API Endpoints
- \`GET /api/appointments\` - List user's appointments
- \`POST /api/appointments\` - Create new appointment
- \`PATCH /api/appointments/[id]\` - Reschedule/cancel
- \`GET /api/appointments/availability\` - Get available slots
- \`GET /api/providers\` - List providers

### Pre-Built Hooks
- \`useAvailability()\` - Fetch available slots
- \`useAppointments()\` - Manage appointments

### Prisma Models Included
- Appointment - Patient appointment
- Schedule - Provider weekly schedule
- TimeSlot - Available time blocks

### Customization Needed
- Configure provider schedules
- Set up appointment types and durations
- Add insurance verification if needed
- Configure reminder notifications
- Add waitlist functionality if needed
`,
  priority: 17, // High priority for patient access
};
