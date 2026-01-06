/**
 * Static Application Security Testing (SAST) Scanner
 * Detects code-level vulnerabilities through pattern matching and AST analysis
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';

export type SASTCategory =
  | 'XSS'
  | 'SQL_INJECTION'
  | 'COMMAND_INJECTION'
  | 'PATH_TRAVERSAL'
  | 'INSECURE_CRYPTO'
  | 'HARDCODED_SECRET'
  | 'INSECURE_RANDOM'
  | 'PROTOTYPE_POLLUTION'
  | 'OPEN_REDIRECT'
  | 'SSRF'
  | 'XXE'
  | 'INSECURE_DESERIALIZATION'
  | 'MISSING_AUTH'
  | 'SENSITIVE_DATA_EXPOSURE'
  | 'SECURITY_MISCONFIGURATION';

export interface SASTPattern {
  id: string;
  category: SASTCategory;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  pattern: RegExp;
  fileTypes: string[];
  cwe?: string;
  owasp?: string;
  remediation: string;
  autoFixable: boolean;
}

export interface SASTFinding {
  id: string;
  patternId: string;
  category: SASTCategory;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  file: string;
  line: number;
  column: number;
  snippet: string;
  cwe?: string;
  owasp?: string;
  remediation: string;
  autoFixable: boolean;
  confidence: 'high' | 'medium' | 'low';
}

// SAST patterns for vulnerability detection
const SAST_PATTERNS: SASTPattern[] = [
  // XSS Vulnerabilities
  {
    id: 'xss-eval',
    category: 'XSS',
    severity: 'critical',
    title: 'Use of eval()',
    description: 'eval() can execute arbitrary code and is a major XSS vector',
    pattern: /\beval\s*\(/g,
    fileTypes: ['.js', '.ts', '.jsx', '.tsx'],
    cwe: 'CWE-95',
    owasp: 'A03:2021',
    remediation: 'Replace eval() with safer alternatives like JSON.parse() for data or Function() for dynamic code',
    autoFixable: false,
  },
  {
    id: 'xss-innerhtml',
    category: 'XSS',
    severity: 'high',
    title: 'Direct innerHTML assignment',
    description: 'Setting innerHTML directly can lead to XSS if user input is included',
    pattern: /\.innerHTML\s*=/g,
    fileTypes: ['.js', '.ts', '.jsx', '.tsx'],
    cwe: 'CWE-79',
    owasp: 'A03:2021',
    remediation: 'Use textContent for text, or sanitize HTML with DOMPurify before using innerHTML',
    autoFixable: false,
  },
  {
    id: 'xss-document-write',
    category: 'XSS',
    severity: 'high',
    title: 'Use of document.write()',
    description: 'document.write() can inject arbitrary HTML and JavaScript',
    pattern: /document\.write\s*\(/g,
    fileTypes: ['.js', '.ts', '.jsx', '.tsx'],
    cwe: 'CWE-79',
    owasp: 'A03:2021',
    remediation: 'Use DOM manipulation methods like createElement() and appendChild()',
    autoFixable: false,
  },
  {
    id: 'xss-dangerously-set',
    category: 'XSS',
    severity: 'medium',
    title: 'React dangerouslySetInnerHTML',
    description: 'dangerouslySetInnerHTML can cause XSS if content is not sanitized',
    pattern: /dangerouslySetInnerHTML\s*=\s*\{/g,
    fileTypes: ['.jsx', '.tsx'],
    cwe: 'CWE-79',
    owasp: 'A03:2021',
    remediation: 'Sanitize content with DOMPurify before using dangerouslySetInnerHTML, or use a safe markdown renderer',
    autoFixable: false,
  },

  // SQL Injection
  {
    id: 'sql-string-concat',
    category: 'SQL_INJECTION',
    severity: 'critical',
    title: 'SQL query string concatenation',
    description: 'Building SQL queries with string concatenation is vulnerable to injection',
    pattern: /\b(query|execute|raw)\s*\(\s*[`"'].*?\$\{.*?\}.*?[`"']/g,
    fileTypes: ['.js', '.ts'],
    cwe: 'CWE-89',
    owasp: 'A03:2021',
    remediation: 'Use parameterized queries with placeholders (?) or prepared statements',
    autoFixable: false,
  },
  {
    id: 'sql-template-literal',
    category: 'SQL_INJECTION',
    severity: 'critical',
    title: 'SQL in template literal',
    description: 'Template literals in SQL queries can be exploited for injection',
    pattern: /\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE)\b.*?\$\{/gi,
    fileTypes: ['.js', '.ts'],
    cwe: 'CWE-89',
    owasp: 'A03:2021',
    remediation: 'Use parameterized queries or an ORM like Prisma, TypeORM, or Sequelize',
    autoFixable: false,
  },

  // Command Injection
  {
    id: 'cmd-exec',
    category: 'COMMAND_INJECTION',
    severity: 'critical',
    title: 'Command execution with user input',
    description: 'exec/spawn with string concatenation can lead to command injection',
    pattern: /\b(exec|execSync|spawn|spawnSync)\s*\(\s*[`"'].*?\$\{.*?\}.*?[`"']/g,
    fileTypes: ['.js', '.ts'],
    cwe: 'CWE-78',
    owasp: 'A03:2021',
    remediation: 'Use spawn with array arguments, validate and sanitize input, or use a library like shell-escape',
    autoFixable: false,
  },
  {
    id: 'cmd-shell-true',
    category: 'COMMAND_INJECTION',
    severity: 'high',
    title: 'Shell execution enabled',
    description: 'Using shell: true with spawn increases command injection risk',
    pattern: /shell\s*:\s*true/g,
    fileTypes: ['.js', '.ts'],
    cwe: 'CWE-78',
    owasp: 'A03:2021',
    remediation: 'Avoid shell: true, use spawn with array arguments instead',
    autoFixable: false,
  },

  // Path Traversal
  {
    id: 'path-traversal',
    category: 'PATH_TRAVERSAL',
    severity: 'high',
    title: 'Potential path traversal',
    description: 'File operations with user input may allow directory traversal',
    pattern: /\b(readFile|writeFile|unlink|rmdir|mkdir)\s*\(\s*[`"'].*?\$\{.*?\}.*?[`"']/g,
    fileTypes: ['.js', '.ts'],
    cwe: 'CWE-22',
    owasp: 'A01:2021',
    remediation: 'Validate paths with path.resolve() and check they stay within allowed directories',
    autoFixable: false,
  },
  {
    id: 'path-join-user-input',
    category: 'PATH_TRAVERSAL',
    severity: 'medium',
    title: 'Path.join with potential user input',
    description: 'path.join with variables may allow traversal if input contains ..',
    pattern: /path\.(join|resolve)\s*\([^)]*\b(req|request|params|query|body)\b/g,
    fileTypes: ['.js', '.ts'],
    cwe: 'CWE-22',
    owasp: 'A01:2021',
    remediation: 'Sanitize input by removing .. and validate the final path is within allowed directories',
    autoFixable: false,
  },

  // Insecure Cryptography
  {
    id: 'crypto-md5',
    category: 'INSECURE_CRYPTO',
    severity: 'high',
    title: 'Use of MD5 hash',
    description: 'MD5 is cryptographically broken and should not be used for security',
    pattern: /\b(createHash|crypto\.hash)\s*\(\s*[`"']md5[`"']/gi,
    fileTypes: ['.js', '.ts'],
    cwe: 'CWE-328',
    owasp: 'A02:2021',
    remediation: 'Use SHA-256 or stronger (SHA-384, SHA-512) for hashing',
    autoFixable: true,
  },
  {
    id: 'crypto-sha1',
    category: 'INSECURE_CRYPTO',
    severity: 'medium',
    title: 'Use of SHA-1 hash',
    description: 'SHA-1 is deprecated and vulnerable to collision attacks',
    pattern: /\b(createHash|crypto\.hash)\s*\(\s*[`"']sha1[`"']/gi,
    fileTypes: ['.js', '.ts'],
    cwe: 'CWE-328',
    owasp: 'A02:2021',
    remediation: 'Use SHA-256 or stronger for hashing',
    autoFixable: true,
  },
  {
    id: 'crypto-weak-random',
    category: 'INSECURE_RANDOM',
    severity: 'medium',
    title: 'Use of Math.random() for security',
    description: 'Math.random() is not cryptographically secure',
    pattern: /Math\.random\s*\(\s*\)/g,
    fileTypes: ['.js', '.ts', '.jsx', '.tsx'],
    cwe: 'CWE-330',
    owasp: 'A02:2021',
    remediation: 'Use crypto.randomBytes() or crypto.randomUUID() for security-sensitive random values',
    autoFixable: false,
  },

  // Prototype Pollution
  {
    id: 'proto-pollution-merge',
    category: 'PROTOTYPE_POLLUTION',
    severity: 'high',
    title: 'Potential prototype pollution in object merge',
    description: 'Deep object merging without prototype checks can lead to pollution',
    pattern: /Object\.assign\s*\(\s*\{\s*\}/g,
    fileTypes: ['.js', '.ts'],
    cwe: 'CWE-1321',
    owasp: 'A03:2021',
    remediation: 'Use Object.create(null) as base, or filter __proto__ and constructor keys',
    autoFixable: false,
  },
  {
    id: 'proto-pollution-bracket',
    category: 'PROTOTYPE_POLLUTION',
    severity: 'medium',
    title: 'Dynamic property assignment',
    description: 'Dynamic property assignment with user input can pollute prototype',
    pattern: /\[\s*(req|request|params|query|body)\.[^\]]+\s*\]\s*=/g,
    fileTypes: ['.js', '.ts'],
    cwe: 'CWE-1321',
    owasp: 'A03:2021',
    remediation: 'Validate property names against an allowlist, block __proto__ and constructor',
    autoFixable: false,
  },

  // SSRF
  {
    id: 'ssrf-fetch',
    category: 'SSRF',
    severity: 'high',
    title: 'Potential SSRF in fetch/axios',
    description: 'HTTP requests with user-controlled URLs can lead to SSRF',
    pattern: /\b(fetch|axios\.get|axios\.post|http\.get|https\.get)\s*\(\s*[`"'].*?\$\{.*?\}.*?[`"']/g,
    fileTypes: ['.js', '.ts', '.jsx', '.tsx'],
    cwe: 'CWE-918',
    owasp: 'A10:2021',
    remediation: 'Validate URLs against an allowlist of hosts, block internal IP ranges',
    autoFixable: false,
  },

  // Open Redirect
  {
    id: 'open-redirect',
    category: 'OPEN_REDIRECT',
    severity: 'medium',
    title: 'Potential open redirect',
    description: 'Redirecting to user-controlled URLs can enable phishing',
    pattern: /\b(redirect|location\.href|window\.location)\s*=\s*[`"'].*?\$\{.*?\}.*?[`"']/g,
    fileTypes: ['.js', '.ts', '.jsx', '.tsx'],
    cwe: 'CWE-601',
    owasp: 'A01:2021',
    remediation: 'Validate redirect URLs against an allowlist of trusted domains',
    autoFixable: false,
  },

  // Sensitive Data Exposure
  {
    id: 'console-sensitive',
    category: 'SENSITIVE_DATA_EXPOSURE',
    severity: 'medium',
    title: 'Logging potentially sensitive data',
    description: 'Console logging of variables named password, token, secret, etc.',
    pattern: /console\.(log|info|debug|warn|error)\s*\([^)]*\b(password|token|secret|apiKey|api_key|credential|auth)\b/gi,
    fileTypes: ['.js', '.ts', '.jsx', '.tsx'],
    cwe: 'CWE-532',
    owasp: 'A09:2021',
    remediation: 'Remove logging of sensitive data, or redact sensitive fields before logging',
    autoFixable: false,
  },
  {
    id: 'error-stack-exposure',
    category: 'SENSITIVE_DATA_EXPOSURE',
    severity: 'low',
    title: 'Stack trace exposed to client',
    description: 'Sending error.stack to client can reveal internal structure',
    pattern: /res\.(send|json)\s*\([^)]*error\.stack/g,
    fileTypes: ['.js', '.ts'],
    cwe: 'CWE-209',
    owasp: 'A09:2021',
    remediation: 'Log full errors server-side, return generic error messages to clients',
    autoFixable: false,
  },

  // Security Misconfiguration
  {
    id: 'cors-wildcard',
    category: 'SECURITY_MISCONFIGURATION',
    severity: 'medium',
    title: 'CORS wildcard origin',
    description: 'Using * for CORS origin allows any website to make requests',
    pattern: /['"]Access-Control-Allow-Origin['"]\s*[,:]\s*['"]\*/g,
    fileTypes: ['.js', '.ts'],
    cwe: 'CWE-942',
    owasp: 'A05:2021',
    remediation: 'Specify exact allowed origins instead of wildcard',
    autoFixable: false,
  },
  {
    id: 'helmet-missing',
    category: 'SECURITY_MISCONFIGURATION',
    severity: 'low',
    title: 'Security headers not configured',
    description: 'Express app without helmet middleware for security headers',
    pattern: /express\s*\(\s*\)/g,
    fileTypes: ['.js', '.ts'],
    cwe: 'CWE-693',
    owasp: 'A05:2021',
    remediation: 'Use helmet middleware: app.use(helmet())',
    autoFixable: false,
  },
  {
    id: 'cookie-insecure',
    category: 'SECURITY_MISCONFIGURATION',
    severity: 'medium',
    title: 'Insecure cookie configuration',
    description: 'Cookies without secure, httpOnly, or sameSite flags',
    pattern: /cookie\s*\([^)]*\)\s*(?!.*\b(secure|httpOnly|sameSite)\b)/gi,
    fileTypes: ['.js', '.ts'],
    cwe: 'CWE-614',
    owasp: 'A05:2021',
    remediation: 'Set secure: true, httpOnly: true, sameSite: "strict" on cookies',
    autoFixable: false,
  },

  // Missing Authentication
  {
    id: 'no-auth-check',
    category: 'MISSING_AUTH',
    severity: 'high',
    title: 'API route without authentication',
    description: 'API endpoint may lack authentication middleware',
    pattern: /app\.(get|post|put|delete|patch)\s*\(\s*['"](\/api\/[^'"]+)['"]\s*,\s*(?!.*auth)/g,
    fileTypes: ['.js', '.ts'],
    cwe: 'CWE-306',
    owasp: 'A07:2021',
    remediation: 'Add authentication middleware to protect sensitive API routes',
    autoFixable: false,
  },
];

export interface SASTScanResult {
  findings: SASTFinding[];
  filesScanned: number;
  linesAnalyzed: number;
  scanDuration: number;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  categories: Record<SASTCategory, number>;
}

export class SASTScanner {
  private patterns: SASTPattern[];
  private excludePatterns: string[];

  constructor(customPatterns?: SASTPattern[]) {
    this.patterns = customPatterns || SAST_PATTERNS;
    this.excludePatterns = [
      '**/node_modules/**',
      '**/.git/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/*.min.js',
      '**/*.d.ts',
    ];
  }

  async scan(directory: string, includePatterns?: string[]): Promise<SASTScanResult> {
    const startTime = Date.now();
    const findings: SASTFinding[] = [];
    let filesScanned = 0;
    let linesAnalyzed = 0;

    // Default file patterns
    const filePatterns = includePatterns || ['**/*.{js,ts,jsx,tsx}'];

    // Normalize directory path for glob (use forward slashes on Windows)
    const normalizedDir = directory.replace(/\\/g, '/');

    // Find all matching files
    const files: string[] = [];
    for (const pattern of filePatterns) {
      const matches = await glob(pattern, {
        cwd: normalizedDir,
        ignore: this.excludePatterns,
        absolute: true,
      });
      files.push(...matches);
    }

    // Deduplicate files
    const uniqueFiles = [...new Set(files)];

    // Scan each file
    for (const filePath of uniqueFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        linesAnalyzed += lines.length;
        filesScanned++;

        const relativePath = path.relative(directory, filePath);
        const ext = path.extname(filePath);

        // Check each pattern against the file
        for (const pattern of this.patterns) {
          // Skip if pattern doesn't apply to this file type
          if (!pattern.fileTypes.includes(ext)) continue;

          // Reset regex lastIndex
          pattern.pattern.lastIndex = 0;

          let match;
          while ((match = pattern.pattern.exec(content)) !== null) {
            // Calculate line and column
            const beforeMatch = content.substring(0, match.index);
            const lineNumber = beforeMatch.split('\n').length;
            const lastNewline = beforeMatch.lastIndexOf('\n');
            const column = match.index - lastNewline;

            // Get code snippet (the line containing the match)
            const snippet = lines[lineNumber - 1]?.trim() || '';

            findings.push({
              id: `${pattern.id}-${filesScanned}-${match.index}`,
              patternId: pattern.id,
              category: pattern.category,
              severity: pattern.severity,
              title: pattern.title,
              description: pattern.description,
              file: relativePath,
              line: lineNumber,
              column,
              snippet: snippet.substring(0, 200),
              cwe: pattern.cwe,
              owasp: pattern.owasp,
              remediation: pattern.remediation,
              autoFixable: pattern.autoFixable,
              confidence: this.calculateConfidence(pattern, snippet),
            });
          }
        }
      } catch (error) {
        // Skip files that can't be read
        console.warn(`Could not scan file: ${filePath}`);
      }
    }

    // Calculate summary
    const summary = {
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length,
      total: findings.length,
    };

    // Calculate category breakdown
    const categories = {} as Record<SASTCategory, number>;
    for (const finding of findings) {
      categories[finding.category] = (categories[finding.category] || 0) + 1;
    }

    return {
      findings,
      filesScanned,
      linesAnalyzed,
      scanDuration: Date.now() - startTime,
      summary,
      categories,
    };
  }

  private calculateConfidence(pattern: SASTPattern, snippet: string): 'high' | 'medium' | 'low' {
    // High confidence for critical patterns with clear indicators
    if (pattern.severity === 'critical') {
      return 'high';
    }

    // Medium confidence for most patterns
    if (snippet.includes('user') || snippet.includes('input') || snippet.includes('req.')) {
      return 'high';
    }

    return 'medium';
  }

  getPatternCategories(): SASTCategory[] {
    return [...new Set(this.patterns.map(p => p.category))];
  }

  getPatternsBySeverity(severity: 'critical' | 'high' | 'medium' | 'low'): SASTPattern[] {
    return this.patterns.filter(p => p.severity === severity);
  }
}

export const sastScanner = new SASTScanner();
