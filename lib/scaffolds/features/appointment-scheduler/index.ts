/**
 * Appointment Scheduler Template
 * Booking system with provider availability
 */

import { FeatureTemplate } from '../types';
import { appointmentSchedulerFiles } from './files';
import { appointmentSchedulerTests } from './tests';
import { appointmentSchedulerRequirements } from './requirements';

export const appointmentSchedulerTemplate: FeatureTemplate = {
  id: 'appointment-scheduler',
  name: 'Appointment Scheduler',
  version: '1.0.0',
  description: 'Complete booking system with provider availability, calendar, and scheduling APIs',
  category: 'scheduling',

  keywords: [
    'appointment',
    'scheduling',
    'booking',
    'calendar',
    'provider',
    'slot',
    'availability',
    'schedule',
    'book appointment',
    'time slot',
    'healthcare scheduling',
    'doctor appointment',
  ],

  patterns: [
    'appointment.*booking',
    'schedule.*appointment',
    'book.*appointment',
    'provider.*availability',
    'time.*slot',
    'calendar.*scheduling',
  ],

  files: appointmentSchedulerFiles,
  tests: appointmentSchedulerTests,
  requirements: appointmentSchedulerRequirements,

  dependencies: {
    packages: {
      'date-fns': '^3.0.0',
    },
    devPackages: {},
    expectedModels: ['Appointment', 'Schedule'],
  },

  agentInstructions: `
## Appointment Scheduler Template Customization

### What's Pre-Built:
- Booking wizard (provider → type → date → time → confirm)
- Calendar with availability indicators
- Time slot picker grouped by morning/afternoon/evening
- Provider search and selection
- Availability calculation engine
- Appointment CRUD APIs
- useAvailability and useAppointments hooks

### File Locations:
- Lib: \`lib/scheduling/\` (types.ts, availability.ts, slots.ts)
- API: \`app/api/appointments/\` and \`app/api/providers/\`
- Hooks: \`hooks/useAvailability.ts\`, \`hooks/useAppointments.ts\`
- Components: \`components/scheduling/\`
- Pages: \`app/(scheduling)/book/page.tsx\`
- Tests: \`__tests__/scheduling/\`

### Required Prisma Models:
\`\`\`prisma
model Appointment {
  id          String   @id @default(cuid())
  patientId   Int
  patient     User     @relation("PatientAppointments", fields: [patientId], references: [id])
  providerId  Int
  provider    User     @relation("ProviderAppointments", fields: [providerId], references: [id])
  startTime   DateTime
  endTime     DateTime
  type        String   // in_person, telehealth, phone
  status      String   // scheduled, confirmed, cancelled, completed, no_show
  notes       String?
  location    String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([patientId])
  @@index([providerId])
  @@index([startTime])
  @@index([status])
}

model Schedule {
  id          String   @id @default(cuid())
  providerId  Int
  provider    User     @relation(fields: [providerId], references: [id])
  dayOfWeek   Int      // 0 = Sunday, 6 = Saturday
  startTime   String   // "09:00"
  endTime     String   // "17:00"
  slotMinutes Int      @default(30)

  @@unique([providerId, dayOfWeek])
}
\`\`\`

### How to Use:

1. **Book an appointment**:
Navigate to \`/book\` to start the booking wizard.

2. **Use the booking hook**:
\`\`\`typescript
const { appointments, book, cancel, reschedule } = useAppointments();

// Book
await book({
  providerId: 1,
  startTime: new Date('2024-01-15T10:00:00'),
  type: 'in_person',
});

// Cancel
await cancel(appointmentId);

// Reschedule
await reschedule(appointmentId, newStartTime);
\`\`\`

3. **Check availability**:
\`\`\`typescript
const { slots, availableDates, loading } = useAvailability({
  providerId: 1,
  date: selectedDate,
});

// Use availableDates for calendar
// Use slots for time picker
\`\`\`

4. **Use components**:
\`\`\`tsx
<Calendar
  selectedDate={date}
  availableDates={availableDates}
  onSelect={setDate}
/>

<TimeSlots
  slots={slots}
  selectedSlot={time}
  onSelect={setTime}
/>

<ProviderSelect
  value={providerId}
  onChange={setProvider}
  specialty="Primary Care"
/>
\`\`\`

### Setting Up Provider Schedules:
Create schedules for providers in the database:
\`\`\`typescript
await prisma.schedule.createMany({
  data: [
    { providerId: 1, dayOfWeek: 1, startTime: '09:00', endTime: '17:00', slotMinutes: 30 },
    { providerId: 1, dayOfWeek: 2, startTime: '09:00', endTime: '17:00', slotMinutes: 30 },
    // ... more days
  ],
});
\`\`\`

### Customization Needed:
1. Set up provider schedules in database
2. Configure appointment types and durations
3. Add insurance verification if needed
4. Configure reminder notifications (email/SMS)
5. Add waitlist functionality if needed
6. Integrate with EHR for provider availability

### DO NOT Modify:
- Slot overlap detection logic
- Availability calculation algorithm
- Calendar date math
`,
};
