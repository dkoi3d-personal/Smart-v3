/**
 * Auth Flow Template
 * Complete authentication with login, signup, password reset, and session management
 */

import { FeatureTemplate } from '../types';
import { authFlowFiles } from './files';
import { authFlowTests } from './tests';
import { authFlowRequirements } from './requirements';

export const authFlowTemplate: FeatureTemplate = {
  id: 'auth-flow',
  name: 'Authentication Flow',
  version: '1.0.0',
  description: 'Complete authentication with login, signup, password reset, and session management',
  category: 'auth',

  keywords: [
    'auth',
    'authentication',
    'login',
    'signup',
    'sign up',
    'sign in',
    'signin',
    'register',
    'registration',
    'password',
    'session',
    'jwt',
    'user account',
    'forgot password',
    'reset password',
    'logout',
    'log out',
    'sign out',
  ],

  patterns: [
    'user.*login',
    'user.*signup',
    'user.*auth',
    'auth.*flow',
    'password.*reset',
    'session.*management',
    'login.*page',
    'signup.*form',
  ],

  files: authFlowFiles,
  tests: authFlowTests,
  requirements: authFlowRequirements,

  dependencies: {
    packages: {
      'bcryptjs': '^2.4.3',
      'jsonwebtoken': '^9.0.0',
      'zod': '^3.22.0',
    },
    devPackages: {
      '@types/bcryptjs': '^2.4.6',
      '@types/jsonwebtoken': '^9.0.5',
    },
    expectedModels: ['User'],
  },

  agentInstructions: `
## Auth Flow Template Customization

### What's Pre-Built:
- Login page (\`/login\`) with email/password form
- Signup page (\`/signup\`) with validation
- Forgot password page (\`/forgot-password\`)
- JWT-based session management with httpOnly cookies
- \`useAuth()\` hook for client-side auth state
- \`getSession()\` and \`requireSession()\` for server-side auth
- Pre-written tests for all auth endpoints

### File Locations:
- Pages: \`app/(auth)/login\`, \`app/(auth)/signup\`, \`app/(auth)/forgot-password\`
- API Routes: \`app/api/auth/login\`, \`signup\`, \`logout\`, \`me\`, \`forgot-password\`
- Utilities: \`lib/auth/session.ts\`, \`lib/auth/jwt.ts\`, \`lib/auth/config.ts\`
- Hook: \`hooks/useAuth.ts\`
- Tests: \`__tests__/auth/\`

### Required Customizations:
1. Configure email service for password reset (currently logs to console)
2. Add your logo/branding to auth pages
3. Configure session duration in \`lib/auth/config.ts\`
4. Set \`JWT_SECRET\` environment variable for production

### DO NOT Modify:
- Password hashing logic (bcrypt is pre-configured correctly)
- JWT token structure (maintain compatibility with session utilities)
- Cookie security settings (httpOnly, secure, sameSite are intentional)

### Extending Auth:
- To add OAuth: Create new routes in \`app/api/auth/[provider]\`
- To add roles: Extend the User model and TokenPayload interface
- To add 2FA: Add a new verification step after login
`,
};
