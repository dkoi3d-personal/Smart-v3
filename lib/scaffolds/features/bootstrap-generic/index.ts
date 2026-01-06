/**
 * Generic Bootstrap Template
 * Base Next.js 14 + Prisma foundation
 * NOTE: Auth added by Coder when PO creates auth stories
 */

import { FeatureTemplate } from '../types';
import { bootstrapGenericFiles } from './files';
import { bootstrapGenericTests } from './tests';
import { bootstrapGenericRequirements } from './requirements';

export const bootstrapGenericTemplate: FeatureTemplate = {
  id: 'bootstrap-generic',
  name: 'Project Bootstrap',
  version: '1.0.0',
  description: 'Complete project foundation with Next.js 14, Prisma, and base UI components (auth added when needed)',
  category: 'foundation',

  keywords: [
    'bootstrap',
    'starter',
    'foundation',
    'setup',
    'nextjs',
    'project',
    'base',
    'scaffold',
  ],

  patterns: [],

  files: bootstrapGenericFiles,
  tests: bootstrapGenericTests,
  requirements: bootstrapGenericRequirements,

  dependencies: {
    packages: {
      'next': '^14.0.0',
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
      '@prisma/client': '^5.22.0',
      '@headlessui/react': '^1.7.0',
      'clsx': '^2.0.0',
      'tailwind-merge': '^2.0.0',
    },
    devPackages: {
      'prisma': '^5.22.0',
      'typescript': '^5.3.0',
      '@types/node': '^20.0.0',
      '@types/react': '^18.2.0',
      'tailwindcss': '^3.4.0',
      'autoprefixer': '^10.4.0',
      'postcss': '^8.4.0',
      'tsx': '^4.0.0',
    },
    // NOTE: Auth deps (next-auth, bcryptjs) added by Coder when PO creates auth stories
    expectedModels: ['User'],
  },

  agentInstructions: `
## Project Bootstrap Template

### What's Pre-Built:
This is the foundation template that sets up a complete Next.js 14 project.

**Framework:**
- Next.js 14 with App Router
- TypeScript configuration
- Tailwind CSS with design tokens
- ESLint configured

**Database:**
- Prisma ORM with SQLite (dev) / PostgreSQL (prod)
- Basic User model (no auth fields)
- Prisma client singleton

**Authentication:**
- NOT included by default
- PO creates auth stories when login/signup is in requirements
- Coder implements NextAuth when auth stories are assigned

**UI Components:**
- Button (5 variants, 3 sizes, loading state)
- Input (with label, error, hint)
- Card (header, title, content, footer)
- Modal (with Headless UI)
- Toast notifications (4 types, auto-dismiss)
- Spinner/PageLoader

**Layout Components:**
- Header
- Sidebar navigation
- Footer

### Project Structure:
\`\`\`
app/
├── layout.tsx       # Root layout
├── page.tsx         # Home page
└── globals.css      # Global styles

components/
├── ui/              # Base UI components
└── layout/          # Layout components

lib/
├── prisma.ts        # Prisma client
└── utils.ts         # Utility functions

prisma/
├── schema.prisma    # Database schema
└── seed.ts          # Seed script
\`\`\`

### Required Environment Variables:
\`\`\`env
DATABASE_URL="file:./dev.db"
\`\`\`

### After Bootstrap:
1. Run \`npm install\`
2. Run \`npx prisma generate\`
3. Run \`npx prisma db push\`
4. Add application-specific models
5. Add feature templates as needed
`,
};
