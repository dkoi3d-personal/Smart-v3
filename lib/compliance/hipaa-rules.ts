/**
 * HIPAA Compliance Rules Engine
 *
 * Comprehensive rules for detecting HIPAA Security Rule violations in code.
 * Based on 45 CFR §164.312 (Technical Safeguards) and related sections.
 */

import {
  ComplianceRule,
  RegulationReference,
  ComplianceSeverity,
  ComplianceCategory,
} from './types';

// ============================================================================
// HIPAA REGULATION REFERENCES
// ============================================================================

const HIPAA_REFS: Record<string, RegulationReference> = {
  ACCESS_CONTROL: {
    regulation: 'HIPAA',
    section: '164.312(a)(1)',
    title: 'Access Control',
    description: 'Implement technical policies and procedures for electronic information systems that maintain ePHI to allow access only to authorized persons or software programs.',
    requirement: 'required',
    url: 'https://www.law.cornell.edu/cfr/text/45/164.312',
  },
  UNIQUE_USER_ID: {
    regulation: 'HIPAA',
    section: '164.312(a)(2)(i)',
    title: 'Unique User Identification',
    description: 'Assign a unique name and/or number for identifying and tracking user identity.',
    requirement: 'required',
  },
  EMERGENCY_ACCESS: {
    regulation: 'HIPAA',
    section: '164.312(a)(2)(ii)',
    title: 'Emergency Access Procedure',
    description: 'Establish procedures for obtaining necessary ePHI during an emergency.',
    requirement: 'required',
  },
  AUTO_LOGOFF: {
    regulation: 'HIPAA',
    section: '164.312(a)(2)(iii)',
    title: 'Automatic Logoff',
    description: 'Implement electronic procedures that terminate an electronic session after a predetermined time of inactivity.',
    requirement: 'addressable',
  },
  ENCRYPTION_DECRYPTION: {
    regulation: 'HIPAA',
    section: '164.312(a)(2)(iv)',
    title: 'Encryption and Decryption',
    description: 'Implement a mechanism to encrypt and decrypt ePHI.',
    requirement: 'addressable',
  },
  AUDIT_CONTROLS: {
    regulation: 'HIPAA',
    section: '164.312(b)',
    title: 'Audit Controls',
    description: 'Implement hardware, software, and/or procedural mechanisms that record and examine activity in information systems that contain or use ePHI.',
    requirement: 'required',
  },
  INTEGRITY: {
    regulation: 'HIPAA',
    section: '164.312(c)(1)',
    title: 'Integrity',
    description: 'Implement policies and procedures to protect ePHI from improper alteration or destruction.',
    requirement: 'required',
  },
  INTEGRITY_MECHANISM: {
    regulation: 'HIPAA',
    section: '164.312(c)(2)',
    title: 'Mechanism to Authenticate ePHI',
    description: 'Implement electronic mechanisms to corroborate that ePHI has not been altered or destroyed in an unauthorized manner.',
    requirement: 'addressable',
  },
  AUTHENTICATION: {
    regulation: 'HIPAA',
    section: '164.312(d)',
    title: 'Person or Entity Authentication',
    description: 'Implement procedures to verify that a person or entity seeking access to ePHI is the one claimed.',
    requirement: 'required',
  },
  TRANSMISSION_SECURITY: {
    regulation: 'HIPAA',
    section: '164.312(e)(1)',
    title: 'Transmission Security',
    description: 'Implement technical security measures to guard against unauthorized access to ePHI being transmitted over an electronic communications network.',
    requirement: 'required',
  },
  TRANSMISSION_INTEGRITY: {
    regulation: 'HIPAA',
    section: '164.312(e)(2)(i)',
    title: 'Integrity Controls',
    description: 'Implement security measures to ensure that electronically transmitted ePHI is not improperly modified without detection.',
    requirement: 'addressable',
  },
  TRANSMISSION_ENCRYPTION: {
    regulation: 'HIPAA',
    section: '164.312(e)(2)(ii)',
    title: 'Encryption',
    description: 'Implement a mechanism to encrypt ePHI whenever deemed appropriate.',
    requirement: 'addressable',
  },
  MINIMUM_NECESSARY: {
    regulation: 'HIPAA',
    section: '164.502(b)',
    title: 'Minimum Necessary',
    description: 'Limit PHI to the minimum necessary to accomplish the intended purpose.',
    requirement: 'required',
  },
  DE_IDENTIFICATION: {
    regulation: 'HIPAA',
    section: '164.514',
    title: 'De-identification of PHI',
    description: 'Health information that does not identify an individual and with respect to which there is no reasonable basis to believe that the information can be used to identify an individual is not individually identifiable health information.',
    requirement: 'required',
  },
};

// ============================================================================
// PHI DETECTION PATTERNS
// ============================================================================

const PHI_FIELD_PATTERNS = [
  // Direct identifiers
  'ssn', 'social_security', 'socialSecurity', 'social-security',
  'mrn', 'medical_record', 'medicalRecord', 'medical-record',
  'patient_id', 'patientId', 'patient-id',
  'member_id', 'memberId', 'member-id',
  'dob', 'date_of_birth', 'dateOfBirth', 'date-of-birth', 'birthDate', 'birth_date',
  'death_date', 'deathDate', 'date_of_death',

  // Names
  'first_name', 'firstName', 'first-name', 'fname',
  'last_name', 'lastName', 'last-name', 'lname',
  'full_name', 'fullName', 'full-name',
  'patient_name', 'patientName', 'patient-name',
  'maiden_name', 'maidenName',

  // Contact info
  'email', 'email_address', 'emailAddress',
  'phone', 'phone_number', 'phoneNumber', 'telephone',
  'fax', 'fax_number', 'faxNumber',
  'address', 'street_address', 'streetAddress',
  'zip', 'zip_code', 'zipCode', 'postal_code', 'postalCode',

  // Clinical data
  'diagnosis', 'diagnoses', 'icd_code', 'icdCode',
  'medication', 'medications', 'prescription', 'rx',
  'procedure', 'procedures', 'cpt_code', 'cptCode',
  'lab_result', 'labResult', 'lab_value', 'labValue',
  'vital', 'vitals', 'blood_pressure', 'bloodPressure',
  'allergy', 'allergies',
  'condition', 'conditions', 'medical_history', 'medicalHistory',

  // Identifiers
  'drivers_license', 'driversLicense', 'driver_license',
  'passport', 'passport_number', 'passportNumber',
  'insurance_id', 'insuranceId', 'policy_number', 'policyNumber',
  'account_number', 'accountNumber',
  'certificate', 'license_number', 'licenseNumber',

  // Biometric
  'fingerprint', 'biometric', 'face_id', 'faceId',
  'retina', 'voice_print', 'voicePrint',

  // Device/IP
  'ip_address', 'ipAddress', 'mac_address', 'macAddress',
  'device_id', 'deviceId', 'device_serial', 'deviceSerial',
];

// ============================================================================
// HIPAA COMPLIANCE RULES
// ============================================================================

export const HIPAA_RULES: ComplianceRule[] = [
  // =========================================================================
  // PHI EXPOSURE RULES
  // =========================================================================
  {
    id: 'HIPAA-PHI-001',
    name: 'PHI in Console Logs',
    description: 'Protected Health Information should never be logged to console in production code.',
    category: 'phi_exposure',
    severity: 'critical',
    regulations: [HIPAA_REFS.AUDIT_CONTROLS, HIPAA_REFS.MINIMUM_NECESSARY],
    patterns: [
      {
        type: 'regex',
        pattern: `console\\.(log|info|debug|warn|error)\\s*\\([^)]*\\b(${PHI_FIELD_PATTERNS.join('|')})\\b`,
        flags: 'gi',
        language: ['typescript', 'javascript'],
        context: { inLogStatement: true },
      },
    ],
    recommendation: 'Use a HIPAA-compliant logging service that redacts PHI. Never log patient identifiers directly.',
    codeExample: {
      bad: `console.log('Patient SSN:', patient.ssn);`,
      good: `auditLogger.log('PHI_ACCESS', { action: 'view', resourceType: 'Patient', resourceId: hashId(patient.id) });`,
    },
    autoFixable: false,
    tags: ['phi', 'logging', 'critical'],
  },

  {
    id: 'HIPAA-PHI-002',
    name: 'PHI in URL Parameters',
    description: 'PHI should never be passed in URL query parameters as they are logged in browser history and server logs.',
    category: 'phi_exposure',
    severity: 'critical',
    regulations: [HIPAA_REFS.TRANSMISSION_SECURITY, HIPAA_REFS.AUDIT_CONTROLS],
    patterns: [
      {
        type: 'regex',
        pattern: `[?&](${PHI_FIELD_PATTERNS.join('|')})=`,
        flags: 'gi',
      },
      {
        type: 'regex',
        pattern: `\\$\\{.*\\b(${PHI_FIELD_PATTERNS.join('|')})\\b.*\\}.*[?&]`,
        flags: 'gi',
        language: ['typescript', 'javascript'],
      },
    ],
    recommendation: 'Use POST requests with encrypted body for PHI transmission. Never include PHI in URLs.',
    codeExample: {
      bad: `fetch(\`/api/patient?ssn=\${patient.ssn}\`)`,
      good: `fetch('/api/patient', { method: 'POST', body: JSON.stringify({ patientId: patient.id }), headers: { 'Content-Type': 'application/json' } })`,
    },
    autoFixable: false,
    tags: ['phi', 'url', 'critical'],
  },

  {
    id: 'HIPAA-PHI-003',
    name: 'PHI in Error Messages',
    description: 'Error messages exposed to users should not contain PHI.',
    category: 'phi_exposure',
    severity: 'high',
    regulations: [HIPAA_REFS.MINIMUM_NECESSARY, HIPAA_REFS.ACCESS_CONTROL],
    patterns: [
      {
        type: 'regex',
        pattern: `(throw new Error|reject|res\\.status\\([45]\\d{2}\\)).*\\b(${PHI_FIELD_PATTERNS.join('|')})\\b`,
        flags: 'gi',
        language: ['typescript', 'javascript'],
        context: { inErrorHandler: true },
      },
    ],
    recommendation: 'Return generic error messages to users. Log detailed errors server-side with proper PHI redaction.',
    codeExample: {
      bad: `throw new Error(\`Patient \${patient.name} not found with SSN \${patient.ssn}\`);`,
      good: `throw new Error('Patient not found');
// Server-side: auditLogger.error('PATIENT_NOT_FOUND', { patientId: hashId(patient.id) });`,
    },
    autoFixable: false,
    tags: ['phi', 'error-handling', 'high'],
  },

  {
    id: 'HIPAA-PHI-004',
    name: 'PHI in LocalStorage/SessionStorage',
    description: 'PHI should not be stored in browser storage as it persists and is accessible to JavaScript.',
    category: 'phi_exposure',
    severity: 'critical',
    regulations: [HIPAA_REFS.ENCRYPTION_DECRYPTION, HIPAA_REFS.ACCESS_CONTROL],
    patterns: [
      {
        type: 'regex',
        pattern: `(localStorage|sessionStorage)\\.(setItem|getItem).*\\b(${PHI_FIELD_PATTERNS.join('|')})\\b`,
        flags: 'gi',
        language: ['typescript', 'javascript'],
      },
    ],
    recommendation: 'Store PHI only on the server. Use encrypted, httpOnly, secure cookies for session tokens only.',
    codeExample: {
      bad: `localStorage.setItem('patient', JSON.stringify({ ssn: '123-45-6789' }));`,
      good: `// Keep PHI on server, store only session token in httpOnly cookie`,
    },
    autoFixable: false,
    tags: ['phi', 'storage', 'browser', 'critical'],
  },

  // =========================================================================
  // ENCRYPTION RULES
  // =========================================================================
  {
    id: 'HIPAA-ENC-001',
    name: 'Hardcoded Encryption Keys',
    description: 'Encryption keys must not be hardcoded in source code.',
    category: 'key_management',
    severity: 'critical',
    regulations: [HIPAA_REFS.ENCRYPTION_DECRYPTION, HIPAA_REFS.ACCESS_CONTROL],
    patterns: [
      {
        type: 'regex',
        pattern: `(encryption_key|encryptionKey|secret_key|secretKey|api_key|apiKey|private_key|privateKey)\\s*[:=]\\s*['"\`][A-Za-z0-9+/=]{16,}['"\`]`,
        flags: 'gi',
      },
      {
        type: 'regex',
        pattern: `(AES|RSA|DES).*['"\`][A-Fa-f0-9]{32,}['"\`]`,
        flags: 'gi',
      },
    ],
    recommendation: 'Use environment variables or a secrets management service (AWS Secrets Manager, HashiCorp Vault).',
    codeExample: {
      bad: `const encryptionKey = 'MySecretKey123456';`,
      good: `const encryptionKey = process.env.ENCRYPTION_KEY;`,
    },
    autoFixable: true,
    tags: ['encryption', 'keys', 'secrets', 'critical'],
  },

  {
    id: 'HIPAA-ENC-002',
    name: 'Weak Encryption Algorithm',
    description: 'DES, 3DES, MD5, and SHA1 are considered weak and should not be used for PHI.',
    category: 'encryption',
    severity: 'high',
    regulations: [HIPAA_REFS.ENCRYPTION_DECRYPTION, HIPAA_REFS.INTEGRITY_MECHANISM],
    patterns: [
      {
        type: 'regex',
        pattern: `(createCipher|createDecipher|createHash)\\s*\\(\\s*['"\`](des|3des|des3|md5|sha1)['"\`]`,
        flags: 'gi',
        language: ['typescript', 'javascript'],
      },
      {
        type: 'regex',
        pattern: `crypto\\.(MD5|SHA1|DES)`,
        flags: 'gi',
      },
    ],
    recommendation: 'Use AES-256-GCM for encryption and SHA-256 or higher for hashing. Use bcrypt/argon2 for passwords.',
    codeExample: {
      bad: `crypto.createHash('md5').update(password).digest('hex');`,
      good: `crypto.createHash('sha256').update(data).digest('hex');
// For passwords: await bcrypt.hash(password, 12);`,
    },
    autoFixable: true,
    tags: ['encryption', 'algorithm', 'high'],
  },

  {
    id: 'HIPAA-ENC-003',
    name: 'Missing HTTPS Enforcement',
    description: 'All PHI transmission must use HTTPS/TLS encryption.',
    category: 'transmission_security',
    severity: 'critical',
    regulations: [HIPAA_REFS.TRANSMISSION_SECURITY, HIPAA_REFS.TRANSMISSION_ENCRYPTION],
    patterns: [
      {
        type: 'regex',
        pattern: `http://(?!localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0)`,
        flags: 'gi',
      },
      {
        type: 'regex',
        pattern: `fetch\\s*\\(\\s*['"\`]http://`,
        flags: 'gi',
        language: ['typescript', 'javascript'],
      },
    ],
    recommendation: 'Always use HTTPS for external communications. Implement HSTS headers.',
    codeExample: {
      bad: `fetch('http://api.hospital.com/patients');`,
      good: `fetch('https://api.hospital.com/patients');`,
    },
    autoFixable: true,
    tags: ['https', 'tls', 'transmission', 'critical'],
  },

  {
    id: 'HIPAA-ENC-004',
    name: 'Unencrypted Database Connection',
    description: 'Database connections containing PHI must use SSL/TLS encryption.',
    category: 'transmission_security',
    severity: 'critical',
    regulations: [HIPAA_REFS.TRANSMISSION_SECURITY, HIPAA_REFS.ENCRYPTION_DECRYPTION],
    patterns: [
      {
        type: 'regex',
        pattern: `(postgres|mysql|mongodb|mssql)://[^?]*(?!.*ssl)`,
        flags: 'gi',
      },
      {
        type: 'regex',
        pattern: `ssl\\s*:\\s*(false|0)`,
        flags: 'gi',
      },
    ],
    recommendation: 'Enable SSL/TLS on all database connections. Use ssl: true or sslmode=require in connection strings.',
    codeExample: {
      bad: `postgres://user:pass@host:5432/db`,
      good: `postgres://user:pass@host:5432/db?sslmode=require`,
    },
    autoFixable: true,
    tags: ['database', 'ssl', 'encryption', 'critical'],
  },

  // =========================================================================
  // ACCESS CONTROL RULES
  // =========================================================================
  {
    id: 'HIPAA-ACC-001',
    name: 'Missing Authentication Check',
    description: 'API endpoints accessing PHI must verify user authentication.',
    category: 'access_control',
    severity: 'critical',
    regulations: [HIPAA_REFS.ACCESS_CONTROL, HIPAA_REFS.AUTHENTICATION],
    patterns: [
      {
        type: 'regex',
        pattern: `export\\s+(async\\s+)?function\\s+(GET|POST|PUT|DELETE|PATCH)\\s*\\([^)]*\\)\\s*{(?!.*(?:auth|session|token|verify|authenticate))`,
        flags: 'gis',
        language: ['typescript', 'javascript'],
        context: { inApiRoute: true },
      },
    ],
    recommendation: 'Implement authentication middleware. Verify session/token before processing PHI requests.',
    codeExample: {
      bad: `export async function GET(req) {
  const patients = await db.patients.findAll();
  return Response.json(patients);
}`,
      good: `export async function GET(req) {
  const session = await verifySession(req);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const patients = await db.patients.findAll({ where: { providerId: session.userId } });
  return Response.json(patients);
}`,
    },
    autoFixable: false,
    tags: ['authentication', 'api', 'critical'],
  },

  {
    id: 'HIPAA-ACC-002',
    name: 'Missing Authorization Check',
    description: 'Access to PHI must be restricted based on user roles and permissions.',
    category: 'access_control',
    severity: 'high',
    regulations: [HIPAA_REFS.ACCESS_CONTROL, HIPAA_REFS.MINIMUM_NECESSARY],
    patterns: [
      {
        type: 'regex',
        pattern: `(patient|diagnosis|medication|labResult).*(?:find|get|query|select)(?!.*(?:role|permission|authorize|canAccess|hasPermission))`,
        flags: 'gis',
        language: ['typescript', 'javascript'],
        context: { inFunction: true },
      },
    ],
    recommendation: 'Implement role-based access control (RBAC). Check user permissions before returning PHI.',
    codeExample: {
      bad: `async function getPatient(patientId) {
  return await db.patients.findById(patientId);
}`,
      good: `async function getPatient(patientId, userId) {
  const hasAccess = await checkPatientAccess(userId, patientId);
  if (!hasAccess) throw new AuthorizationError('Access denied');

  return await db.patients.findById(patientId);
}`,
    },
    autoFixable: false,
    tags: ['authorization', 'rbac', 'high'],
  },

  {
    id: 'HIPAA-ACC-003',
    name: 'Missing Session Timeout',
    description: 'Sessions accessing PHI must have automatic timeout/logoff.',
    category: 'session_management',
    severity: 'medium',
    regulations: [HIPAA_REFS.AUTO_LOGOFF, HIPAA_REFS.ACCESS_CONTROL],
    patterns: [
      {
        type: 'regex',
        pattern: `(session|cookie).*(?:maxAge|expires)\\s*[:=]\\s*(\\d{8,}|Infinity|null|undefined)`,
        flags: 'gi',
        language: ['typescript', 'javascript'],
      },
    ],
    recommendation: 'Set session timeout to 15-30 minutes of inactivity. Implement activity-based timeout extension.',
    codeExample: {
      bad: `session.maxAge = Infinity;`,
      good: `session.maxAge = 15 * 60 * 1000; // 15 minutes`,
    },
    autoFixable: true,
    tags: ['session', 'timeout', 'medium'],
  },

  // =========================================================================
  // AUDIT LOGGING RULES
  // =========================================================================
  {
    id: 'HIPAA-AUD-001',
    name: 'Missing Audit Log for PHI Access',
    description: 'All access to PHI must be logged for audit purposes.',
    category: 'audit_logging',
    severity: 'high',
    regulations: [HIPAA_REFS.AUDIT_CONTROLS],
    patterns: [
      {
        type: 'regex',
        pattern: `(patient|diagnosis|medication|labResult|encounter).*(?:find|get|query|select|update|delete|create)(?!.*(?:audit|log|track))`,
        flags: 'gis',
        language: ['typescript', 'javascript'],
        context: { inDatabaseQuery: true },
      },
    ],
    recommendation: 'Implement comprehensive audit logging for all PHI access. Include user, action, timestamp, and resource.',
    codeExample: {
      bad: `const patient = await db.patients.findById(id);`,
      good: `const patient = await db.patients.findById(id);
await auditLog.record({
  event: 'PHI_ACCESS',
  userId: currentUser.id,
  action: 'READ',
  resourceType: 'Patient',
  resourceId: id,
  timestamp: new Date(),
  ipAddress: req.ip
});`,
    },
    autoFixable: false,
    tags: ['audit', 'logging', 'high'],
  },

  {
    id: 'HIPAA-AUD-002',
    name: 'Insufficient Audit Log Detail',
    description: 'Audit logs must capture who, what, when, where for PHI access.',
    category: 'audit_logging',
    severity: 'medium',
    regulations: [HIPAA_REFS.AUDIT_CONTROLS],
    patterns: [
      {
        type: 'regex',
        pattern: `audit.*log(?!.*(?:userId|user_id|action|timestamp|resource|ip))`,
        flags: 'gis',
        language: ['typescript', 'javascript'],
      },
    ],
    recommendation: 'Include userId, action, timestamp, resourceType, resourceId, and IP address in all audit logs.',
    codeExample: {
      bad: `auditLog('accessed patient record');`,
      good: `auditLog({
  userId: user.id,
  action: 'READ',
  resourceType: 'Patient',
  resourceId: patient.id,
  timestamp: new Date().toISOString(),
  ipAddress: req.ip,
  userAgent: req.headers['user-agent']
});`,
    },
    autoFixable: false,
    tags: ['audit', 'detail', 'medium'],
  },

  // =========================================================================
  // DATA INTEGRITY RULES
  // =========================================================================
  {
    id: 'HIPAA-INT-001',
    name: 'Missing Input Validation',
    description: 'All user input must be validated to prevent injection attacks that could compromise PHI.',
    category: 'input_validation',
    severity: 'high',
    regulations: [HIPAA_REFS.INTEGRITY, HIPAA_REFS.ACCESS_CONTROL],
    patterns: [
      {
        type: 'regex',
        pattern: `(req\\.body|req\\.query|req\\.params)\\.[a-zA-Z]+(?!.*(?:validate|sanitize|escape|parse|schema))`,
        flags: 'gi',
        language: ['typescript', 'javascript'],
        context: { inApiRoute: true },
      },
    ],
    recommendation: 'Use input validation libraries (zod, yup, joi). Sanitize all user input before processing.',
    codeExample: {
      bad: `const patientId = req.body.patientId;
const patient = await db.query(\`SELECT * FROM patients WHERE id = '\${patientId}'\`);`,
      good: `const schema = z.object({ patientId: z.string().uuid() });
const { patientId } = schema.parse(req.body);
const patient = await db.patients.findById(patientId);`,
    },
    autoFixable: false,
    tags: ['validation', 'injection', 'high'],
  },

  {
    id: 'HIPAA-INT-002',
    name: 'SQL Injection Risk with PHI',
    description: 'Raw SQL queries with user input can lead to PHI exposure through injection attacks.',
    category: 'input_validation',
    severity: 'critical',
    regulations: [HIPAA_REFS.INTEGRITY, HIPAA_REFS.ACCESS_CONTROL],
    patterns: [
      {
        type: 'regex',
        pattern: `(query|execute|raw)\\s*\\(\\s*[\`'"].*\\$\\{.*\\}.*[\`'"]\\s*\\)`,
        flags: 'gi',
        language: ['typescript', 'javascript'],
        context: { inDatabaseQuery: true },
      },
      {
        type: 'regex',
        pattern: `SELECT.*FROM.*(patient|diagnosis|medication).*WHERE.*\\+.*\\+`,
        flags: 'gi',
      },
    ],
    recommendation: 'Use parameterized queries or an ORM. Never concatenate user input into SQL strings.',
    codeExample: {
      bad: `db.query(\`SELECT * FROM patients WHERE name = '\${userInput}'\`);`,
      good: `db.query('SELECT * FROM patients WHERE name = $1', [userInput]);`,
    },
    autoFixable: false,
    tags: ['sql', 'injection', 'critical'],
  },

  // =========================================================================
  // MINIMUM NECESSARY RULES
  // =========================================================================
  {
    id: 'HIPAA-MIN-001',
    name: 'Excessive PHI in API Response',
    description: 'API responses should only include the minimum necessary PHI for the requested purpose.',
    category: 'minimum_necessary',
    severity: 'medium',
    regulations: [HIPAA_REFS.MINIMUM_NECESSARY],
    patterns: [
      {
        type: 'regex',
        pattern: `Response\\.json\\(\\s*(patient|user|member)\\s*\\)`,
        flags: 'gi',
        language: ['typescript', 'javascript'],
      },
      {
        type: 'regex',
        pattern: `SELECT\\s+\\*\\s+FROM\\s+(patient|member|diagnosis)`,
        flags: 'gi',
      },
    ],
    recommendation: 'Explicitly select only needed fields. Create DTOs that exclude unnecessary PHI.',
    codeExample: {
      bad: `return Response.json(patient); // Returns all fields including SSN`,
      good: `return Response.json({
  id: patient.id,
  firstName: patient.firstName,
  lastName: patient.lastName,
  // Only include fields needed for this use case
});`,
    },
    autoFixable: false,
    tags: ['minimum-necessary', 'api', 'medium'],
  },

  // =========================================================================
  // BREACH NOTIFICATION RULES
  // =========================================================================
  {
    id: 'HIPAA-BRE-001',
    name: 'Missing Error Monitoring',
    description: 'Security errors and potential breaches must be monitored and alerted.',
    category: 'breach_notification',
    severity: 'medium',
    regulations: [HIPAA_REFS.AUDIT_CONTROLS],
    patterns: [
      {
        type: 'regex',
        pattern: `catch\\s*\\([^)]*\\)\\s*{[^}]*}`,
        flags: 'gi',
        language: ['typescript', 'javascript'],
        context: { inErrorHandler: true },
      },
    ],
    recommendation: 'Implement security event monitoring. Alert on authentication failures, access denials, and anomalies.',
    codeExample: {
      bad: `catch (error) {
  console.error(error);
}`,
      good: `catch (error) {
  if (error instanceof SecurityError) {
    await securityMonitor.alert({
      type: 'SECURITY_INCIDENT',
      severity: 'HIGH',
      details: error.sanitizedMessage,
      timestamp: new Date()
    });
  }
  logger.error('Operation failed', { errorCode: error.code });
}`,
    },
    autoFixable: false,
    tags: ['monitoring', 'breach', 'medium'],
  },
];

// ============================================================================
// RULE LOOKUP UTILITIES
// ============================================================================

export function getRuleById(ruleId: string): ComplianceRule | undefined {
  return HIPAA_RULES.find(rule => rule.id === ruleId);
}

export function getRulesByCategory(category: ComplianceCategory): ComplianceRule[] {
  return HIPAA_RULES.filter(rule => rule.category === category);
}

export function getRulesBySeverity(severity: ComplianceSeverity): ComplianceRule[] {
  return HIPAA_RULES.filter(rule => rule.severity === severity);
}

export function getCriticalRules(): ComplianceRule[] {
  return HIPAA_RULES.filter(rule => rule.severity === 'critical');
}

export function getAutoFixableRules(): ComplianceRule[] {
  return HIPAA_RULES.filter(rule => rule.autoFixable);
}

export { PHI_FIELD_PATTERNS, HIPAA_REFS };
