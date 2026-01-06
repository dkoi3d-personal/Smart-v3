/**
 * Generic Bootstrap Template - Requirements
 */

import { TemplateRequirements } from '../types';

export const bootstrapGenericRequirements: TemplateRequirements = {
  text: `
## Project Foundation (Pre-Built)

The following project foundation is pre-scaffolded:

### Next.js 14 App Router
- App directory structure with layouts
- TypeScript configuration
- Tailwind CSS with design tokens
- ESLint and Prettier configured

### Authentication
- NextAuth.js with credentials provider
- JWT session management
- Login/signup pages
- Protected route middleware
- useSession hook

### Database
- Prisma ORM configured
- User model with email/password
- Database connection pooling
- Migration scripts ready

### Base UI Components
- Button (variants: primary, secondary, outline, ghost)
- Input (with validation states)
- Card (header, body, footer)
- Modal (with portal)
- Toast notifications
- Loading spinners

### Project Structure
\`\`\`
app/
├── (auth)/login, signup, forgot-password
├── (dashboard)/dashboard
├── api/auth/[...nextauth]
├── layout.tsx
└── page.tsx
components/
├── ui/ (Button, Input, Card, Modal, Toast)
├── forms/ (Form, FormField)
└── layout/ (Header, Sidebar, Footer)
lib/
├── prisma.ts
├── auth.ts
└── utils.ts
hooks/
├── useAuth.ts
└── useToast.ts
\`\`\`

### Environment Variables
- DATABASE_URL
- NEXTAUTH_SECRET
- NEXTAUTH_URL

### Customization Needed
- Update branding (logo, colors)
- Add application-specific models
- Configure OAuth providers if needed
- Add business logic
`,
  priority: 100, // Highest priority - foundation
};
