/**
 * Figma Bootstrap Template
 * Infrastructure only: Next.js + Prisma
 * NO UI components - those come from Figma design
 * NOTE: Auth added by Coder when PO creates auth stories
 */

import { FeatureTemplate } from '../types';
import { bootstrapFigmaFiles } from './files';
import { bootstrapFigmaTests } from './tests';
import { bootstrapFigmaRequirements } from './requirements';

export const bootstrapFigmaTemplate: FeatureTemplate = {
  id: 'bootstrap-figma',
  name: 'Figma Project Bootstrap',
  version: '1.0.0',
  description: 'Infrastructure foundation for Figma-based builds: Next.js 14, Prisma (NO UI components, auth added when needed)',
  category: 'foundation',

  keywords: [
    'bootstrap',
    'figma',
    'starter',
    'foundation',
    'infrastructure',
    'design',
    'nextjs',
    'project',
  ],

  patterns: [
    'figma',
    'design.*system',
    'from.*design',
  ],

  files: bootstrapFigmaFiles,
  tests: bootstrapFigmaTests,
  requirements: bootstrapFigmaRequirements,

  dependencies: {
    packages: {
      'next': '^14.0.0',
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
      '@prisma/client': '^5.22.0',
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
## Figma Project Bootstrap Template

### IMPORTANT: UI Components Come From Figma
This template provides ONLY infrastructure. All UI components will be generated
from the Figma design extraction. Do NOT create generic Button, Input, Card,
Modal, or other UI components - they will come from Figma.

### What's Pre-Built:

**Framework:**
- Next.js 14 with App Router
- TypeScript configuration
- Tailwind CSS with design token variables (from Figma)

**Database:**
- Prisma ORM with SQLite (dev) / PostgreSQL (prod)
- Basic User model (no auth fields)
- Prisma client singleton

**Authentication:**
- NOT included by default
- PO creates auth stories when login/signup is in requirements or Figma
- Coder implements NextAuth when auth stories are assigned

### Project Structure:
\`\`\`
app/
├── api/user/        # User API routes
├── layout.tsx       # Root layout
└── globals.css      # CSS with design tokens

lib/
├── prisma.ts        # Prisma client
└── utils.ts         # Utility functions

prisma/
├── schema.prisma    # Database schema
└── seed.ts          # Seed script
\`\`\`

### Building UI from Figma:
1. The Figma design is extracted before this template runs
2. Design tokens (colors, fonts, spacing) are in globals.css
3. Build components that EXACTLY match the Figma design
4. Use the extracted component names and structure
5. Reference the Figma design context in the requirements

### Required Environment Variables:
\`\`\`env
DATABASE_URL="file:./dev.db"
\`\`\`

### After Bootstrap:
1. Run \`npm install\`
2. Run \`npx prisma generate\`
3. Run \`npx prisma db push\`
4. Build UI components from Figma design
5. Add application-specific models to Prisma schema
`,
};
