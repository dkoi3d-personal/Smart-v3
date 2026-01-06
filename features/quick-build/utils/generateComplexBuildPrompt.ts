import type { BuildProgress, DatabaseConfig } from '../types';

/**
 * Generate a comprehensive prompt for complex build from quick build output
 */
export function generateComplexBuildPrompt(
  requirements: string,
  progress: BuildProgress | null,
  databaseConfig: DatabaseConfig | null
): string {
  const filesCreated = progress?.filesCreated || [];
  const hasDatabase = databaseConfig && databaseConfig.provider !== 'none';
  const reqLower = requirements.toLowerCase();
  const filesLower = filesCreated.map((f) => f.toLowerCase()).join(' ');

  let prompt = `Build a production-ready application based on the following prototype:\n\n`;
  prompt += `## Original Requirements\n${requirements}\n\n`;

  prompt += `## Features to Implement\n`;
  prompt += `Based on the quick build prototype, implement the following with full testing and security:\n\n`;

  // Analyze files AND requirements to understand what was built
  const hasComponents = filesCreated.some(
    (f) => f.includes('component') || f.includes('Component')
  );
  const hasPages = filesCreated.some((f) => f.includes('page') || f.includes('Page'));
  const hasApi = filesCreated.some((f) => f.includes('api/') || f.includes('route'));
  const hasEpic =
    filesCreated.some((f) => f.includes('epic') || f.includes('fhir')) ||
    reqLower.includes('epic') ||
    reqLower.includes('fhir');

  // OCR and image processing detection
  const hasOCR =
    reqLower.includes('ocr') ||
    reqLower.includes('text extraction') ||
    reqLower.includes('scan') ||
    reqLower.includes('document') ||
    filesLower.includes('ocr') ||
    filesLower.includes('scanner');
  const hasImageProcessing =
    reqLower.includes('image') ||
    reqLower.includes('photo') ||
    reqLower.includes('upload') ||
    reqLower.includes('camera') ||
    filesLower.includes('image') ||
    filesLower.includes('upload');

  // Authentication detection
  const hasAuth =
    reqLower.includes('auth') ||
    reqLower.includes('login') ||
    reqLower.includes('user') ||
    reqLower.includes('password') ||
    filesLower.includes('auth') ||
    filesLower.includes('login');

  // Data visualization detection
  const hasCharts =
    reqLower.includes('chart') ||
    reqLower.includes('graph') ||
    reqLower.includes('visualization') ||
    reqLower.includes('dashboard') ||
    filesLower.includes('chart') ||
    filesLower.includes('graph');

  // Real-time features detection
  const hasRealTime =
    reqLower.includes('real-time') ||
    reqLower.includes('realtime') ||
    reqLower.includes('live') ||
    reqLower.includes('websocket') ||
    reqLower.includes('notification');

  // Form handling detection
  const hasForms =
    reqLower.includes('form') ||
    reqLower.includes('input') ||
    reqLower.includes('submit') ||
    reqLower.includes('validation');

  // Search functionality detection
  const hasSearch =
    reqLower.includes('search') ||
    reqLower.includes('filter') ||
    reqLower.includes('query') ||
    filesLower.includes('search');

  // File handling detection
  const hasFileHandling =
    reqLower.includes('file') ||
    reqLower.includes('download') ||
    reqLower.includes('export') ||
    reqLower.includes('pdf') ||
    reqLower.includes('csv');

  // Medical/Healthcare specific detection
  const hasMedical =
    reqLower.includes('patient') ||
    reqLower.includes('medical') ||
    reqLower.includes('health') ||
    reqLower.includes('clinical') ||
    reqLower.includes('prescription') ||
    reqLower.includes('medication') ||
    reqLower.includes('allergy') ||
    reqLower.includes('vital');

  // Build feature list based on detection
  if (hasComponents || hasPages) {
    prompt += `- **UI Components**: Build responsive, accessible React components with proper error handling and loading states\n`;
  }
  if (hasApi) {
    prompt += `- **API Layer**: Implement robust API routes with validation, error handling, rate limiting, and proper HTTP status codes\n`;
  }
  if (hasOCR) {
    prompt += `- **OCR/Text Extraction**: Implement reliable OCR with Tesseract.js or similar, handle multiple image formats, provide text cleanup and formatting options\n`;
  }
  if (hasImageProcessing) {
    prompt += `- **Image Processing**: Implement secure image upload with validation, compression, format conversion, and preview functionality\n`;
  }
  if (hasEpic) {
    prompt += `- **Epic FHIR Integration**: Implement secure Epic FHIR API integration with proper JWT authentication, token refresh, and error handling\n`;
  }
  if (hasMedical && !hasEpic) {
    prompt += `- **Healthcare Data**: Implement HIPAA-compliant data handling, PHI protection, and audit logging\n`;
  }
  if (hasAuth) {
    prompt += `- **Authentication**: Implement secure authentication with password hashing, session management, and protected routes\n`;
  }
  if (hasCharts) {
    prompt += `- **Data Visualization**: Implement interactive charts with proper accessibility, responsive design, and data formatting\n`;
  }
  if (hasRealTime) {
    prompt += `- **Real-Time Updates**: Implement WebSocket or SSE for live updates with reconnection logic and offline handling\n`;
  }
  if (hasForms) {
    prompt += `- **Form Handling**: Implement form validation, error messages, and proper UX for data entry\n`;
  }
  if (hasSearch) {
    prompt += `- **Search & Filtering**: Implement efficient search with debouncing, pagination, and filter state management\n`;
  }
  if (hasFileHandling) {
    prompt += `- **File Operations**: Implement secure file handling with proper MIME type validation and size limits\n`;
  }
  if (hasDatabase) {
    prompt += `- **Database**: Set up ${databaseConfig!.provider} with ${databaseConfig!.schemaTemplate} schema, migrations, indexes, and data validation\n`;
  }

  prompt += `- **Testing**: Write comprehensive unit tests and integration tests for all features\n`;
  prompt += `- **Security**: Implement input validation, XSS prevention, CSRF protection, and secure data handling\n`;
  prompt += `- **Error Handling**: Add user-friendly error messages, logging, and graceful degradation\n`;
  prompt += `- **Accessibility**: Ensure WCAG 2.1 AA compliance with proper ARIA labels and keyboard navigation\n\n`;

  prompt += `## Quality Requirements\n`;
  prompt += `- All tests must pass\n`;
  prompt += `- Security scan must show no critical vulnerabilities\n`;
  prompt += `- Code should follow best practices and be well-documented\n`;
  prompt += `- UI should be responsive and work on mobile devices\n`;

  return prompt;
}
