/**
 * Auth Flow Template - Requirements
 */

import { TemplateRequirements } from '../types';

export const authFlowRequirements: TemplateRequirements = {
  text: `
## Authentication System (Pre-Built)

The following authentication features are pre-scaffolded with working components, API routes, and tests:

### Login Flow
- Email/password login form at \`/login\`
- JWT-based session management with secure httpOnly cookies
- Form validation with error messages
- Loading states and error handling

### Signup Flow
- User registration form at \`/signup\`
- Password hashing with bcrypt
- Email format validation
- Duplicate email prevention

### Password Reset
- Forgot password page at \`/forgot-password\`
- Reset token generation and email flow
- Secure password reset at \`/reset-password\`

### Session Management
- \`useAuth()\` hook for client-side auth state
- \`getSession()\` utility for server-side auth
- \`requireSession()\` for protected API routes
- Automatic session refresh

### Pre-Built API Endpoints
- \`POST /api/auth/login\` - User login
- \`POST /api/auth/signup\` - User registration
- \`POST /api/auth/logout\` - Session termination
- \`GET /api/auth/me\` - Current user info

### Customization Needed
- Configure email service for password reset (currently logs to console)
- Add your branding/logo to auth pages
- Configure session duration in \`lib/auth/config.ts\`
- Add OAuth providers if needed (Google, GitHub, etc.)
`,
  priority: 10, // High priority - auth should be mentioned first
};
