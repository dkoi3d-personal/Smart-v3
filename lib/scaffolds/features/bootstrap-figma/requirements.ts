/**
 * Figma Bootstrap Template - Requirements
 * Infrastructure requirements for Figma-based builds
 */

import { TemplateRequirements } from '../types';

export const bootstrapFigmaRequirements: TemplateRequirements = {
  text: `## Infrastructure Bootstrap (Figma Build)

This project uses Figma design extraction for all UI components.
The infrastructure layer provides:

### Database (Prisma + PostgreSQL)
- User model with authentication fields
- Session management
- Connection pooling for production

### Authentication (NextAuth.js)
- Credentials provider with email/password
- JWT sessions (30-day expiry)
- Protected route middleware
- Login/signup API endpoints

### API Layer
- RESTful API routes
- User management endpoints
- Error handling patterns

### Hooks & Utilities
- \`useAuth\` hook for auth state
- Utility functions (cn, formatDate, etc.)
- TypeScript types

### Important Notes
- **UI components come from Figma** - do NOT create generic Button, Input, Card components
- The design system is auto-generated from Figma colors and typography
- Build components that match the Figma design exactly
- Use the design tokens from \`globals.css\` and \`tailwind.config.ts\`
`,
  priority: 100, // Highest priority - infrastructure comes first
};
