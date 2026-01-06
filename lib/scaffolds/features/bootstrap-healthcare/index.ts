/**
 * Healthcare Bootstrap Template
 * HIPAA-ready Next.js 14 + Prisma + Auth with audit logging
 */

import { FeatureTemplate } from '../types';
import { bootstrapHealthcareFiles } from './files';
import { bootstrapHealthcareTests } from './tests';
import { bootstrapHealthcareRequirements } from './requirements';

export const bootstrapHealthcareTemplate: FeatureTemplate = {
  id: 'bootstrap-healthcare',
  name: 'Healthcare Project Bootstrap',
  version: '1.0.0',
  description: 'HIPAA-ready project foundation with audit logging, PHI protection, role-based access, and healthcare data models',
  category: 'foundation',

  keywords: [
    'bootstrap',
    'healthcare',
    'hipaa',
    'medical',
    'health',
    'clinic',
    'hospital',
    'provider',
    'patient',
    'phi',
    'audit',
    'compliance',
    'starter',
    'foundation',
  ],

  patterns: [
    '\\bhipaa\\b',
    '\\bphi\\b',
    '\\bprotected health information\\b',
    '\\bhealthcare compliance\\b',
    '\\bmedical records?\\b',
    '\\bpatient portal\\b',
  ],

  files: bootstrapHealthcareFiles,
  tests: bootstrapHealthcareTests,
  requirements: bootstrapHealthcareRequirements,

  dependencies: {
    packages: {
      // All generic packages plus healthcare-specific
      'next': '^14.0.0',
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
      'next-auth': '^4.24.0',
      '@prisma/client': '^5.22.0',
      'bcryptjs': '^2.4.3',
      '@headlessui/react': '^1.7.0',
      'clsx': '^2.0.0',
      'tailwind-merge': '^2.0.0',
      // Healthcare-specific
      'winston': '^3.11.0', // For audit logging
    },
    devPackages: {
      'prisma': '^5.22.0',
      'typescript': '^5.3.0',
      '@types/node': '^20.0.0',
      '@types/react': '^18.2.0',
      '@types/bcryptjs': '^2.4.0',
      'tailwindcss': '^3.4.0',
      'autoprefixer': '^10.4.0',
      'postcss': '^8.4.0',
      'tsx': '^4.0.0',
    },
    expectedModels: [
      'User',
      'Session',
      'AuditLog',
      'Organization',
      'Conversation',
      'Message',
      'Participant',
      'Appointment',
      'Schedule',
    ],
  },

  agentInstructions: `
## Healthcare Bootstrap Template (HIPAA-Ready)

### What's Pre-Built:
This is the HIPAA-compliant foundation template extending the generic bootstrap.

**Everything from Generic Bootstrap PLUS:**

**HIPAA Compliance Features:**
- Audit logging for all PHI access (7-year retention ready)
- PHI-safe console logging (automatic redaction)
- Session timeout warnings (configurable)
- Role-based access control (patient, provider, care_team, admin)

**Healthcare User Model:**
- Role field (patient, provider, care_team, admin)
- Specialty field (for providers)
- NPI number field (for providers)
- Organization association

**Healthcare Prisma Models:**
\`\`\`
AuditLog       - HIPAA compliance tracking
Conversation   - Secure messaging threads
Message        - Encrypted messages
Participant    - Conversation members
Appointment    - Scheduling
Schedule       - Provider availability
Organization   - Multi-tenant support
\`\`\`

**Pre-Built Healthcare Components:**
- PHIWarning - Data sensitivity indicator
- SessionTimeout - Inactivity warning modal
- RoleGuard - Role-based content protection

**Security Utilities:**
- lib/phi-logger.ts - Automatic PHI redaction
- lib/session-security.ts - Session timeout management
- lib/roles.ts - Role permissions and guards

### Project Structure:
\`\`\`
app/
├── (auth)/              # Auth pages with role selection
├── (dashboard)/         # Protected dashboard
├── api/auth/            # Auth API with audit logging
├── layout.tsx           # Root layout with providers
├── page.tsx             # Home page
└── globals.css          # Global styles

components/
├── ui/                  # Base UI components (from generic)
├── layout/              # Layout components
└── healthcare/          # Healthcare-specific components
    ├── PHIWarning.tsx
    ├── SessionTimeout.tsx
    └── RoleGuard.tsx

lib/
├── prisma.ts            # Prisma client
├── auth.ts              # NextAuth with audit logging
├── utils.ts             # Utility functions
├── phi-logger.ts        # PHI-safe logging
├── session-security.ts  # Session management
└── roles.ts             # Role utilities
\`\`\`

### Required Environment Variables:
\`\`\`env
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="http://localhost:3000"
# Healthcare-specific
FHIR_BASE_URL="https://fhir.epic.com/sandbox"
FHIR_CLIENT_ID="your-client-id"
FHIR_CLIENT_SECRET="your-client-secret"
NEXT_PUBLIC_SOCKET_URL="http://localhost:3001"
# Session settings
SESSION_TIMEOUT_MINUTES=30
SESSION_WARNING_MINUTES=5
\`\`\`

### After Bootstrap:
1. Run \`npm install\`
2. Run \`npx prisma generate\`
3. Run \`npx prisma db push\`
4. Configure HIPAA log retention (default: 7 years)
5. Set up log archival for compliance
6. Configure FHIR/EPIC credentials
7. Set session timeout duration
8. Add healthcare feature templates as needed
`,
};
