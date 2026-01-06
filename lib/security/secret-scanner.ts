/**
 * Secret Detection Scanner
 * Detects hardcoded secrets, API keys, tokens, and credentials in code
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';

export type SecretType =
  | 'API_KEY'
  | 'AWS_KEY'
  | 'PRIVATE_KEY'
  | 'PASSWORD'
  | 'JWT_TOKEN'
  | 'OAUTH_TOKEN'
  | 'DATABASE_URL'
  | 'WEBHOOK_SECRET'
  | 'ENCRYPTION_KEY'
  | 'GITHUB_TOKEN'
  | 'SLACK_TOKEN'
  | 'STRIPE_KEY'
  | 'SENDGRID_KEY'
  | 'TWILIO_KEY'
  | 'FIREBASE_KEY'
  | 'GENERIC_SECRET';

export interface SecretPattern {
  type: SecretType;
  name: string;
  pattern: RegExp;
  severity: 'critical' | 'high' | 'medium';
  description: string;
  falsePositiveHints: string[];
}

export interface SecretFinding {
  id: string;
  type: SecretType;
  name: string;
  severity: 'critical' | 'high' | 'medium';
  file: string;
  line: number;
  column: number;
  snippet: string;
  maskedValue: string;
  description: string;
  remediation: string;
  confidence: 'high' | 'medium' | 'low';
  entropy?: number;
}

// Secret detection patterns
const SECRET_PATTERNS: SecretPattern[] = [
  // AWS
  {
    type: 'AWS_KEY',
    name: 'AWS Access Key ID',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    severity: 'critical',
    description: 'AWS Access Key ID detected - can provide access to AWS services',
    falsePositiveHints: ['example', 'test', 'fake', 'dummy'],
  },
  {
    type: 'AWS_KEY',
    name: 'AWS Secret Access Key',
    pattern: /(?<![A-Za-z0-9\/+=])[A-Za-z0-9\/+=]{40}(?![A-Za-z0-9\/+=])/g,
    severity: 'critical',
    description: 'Potential AWS Secret Access Key detected',
    falsePositiveHints: ['example', 'test'],
  },

  // API Keys
  {
    type: 'API_KEY',
    name: 'Generic API Key',
    pattern: /['"](api[_-]?key|apikey)['"]\s*[=:]\s*['"]([a-zA-Z0-9_\-]{20,})['"]/gi,
    severity: 'high',
    description: 'Hardcoded API key detected',
    falsePositiveHints: ['process.env', 'YOUR_API_KEY', 'xxx'],
  },
  {
    type: 'API_KEY',
    name: 'Authorization Header',
    pattern: /['"](Authorization|Bearer)['"]\s*[=:]\s*['"]([a-zA-Z0-9_\-\.]{20,})['"]/gi,
    severity: 'high',
    description: 'Hardcoded authorization token detected',
    falsePositiveHints: ['Bearer ', 'token'],
  },

  // Private Keys
  {
    type: 'PRIVATE_KEY',
    name: 'RSA Private Key',
    pattern: /-----BEGIN RSA PRIVATE KEY-----/g,
    severity: 'critical',
    description: 'RSA private key detected - highly sensitive cryptographic material',
    falsePositiveHints: [],
  },
  {
    type: 'PRIVATE_KEY',
    name: 'OpenSSH Private Key',
    pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/g,
    severity: 'critical',
    description: 'OpenSSH private key detected',
    falsePositiveHints: [],
  },
  {
    type: 'PRIVATE_KEY',
    name: 'PGP Private Key',
    pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----/g,
    severity: 'critical',
    description: 'PGP private key detected',
    falsePositiveHints: [],
  },
  {
    type: 'PRIVATE_KEY',
    name: 'EC Private Key',
    pattern: /-----BEGIN EC PRIVATE KEY-----/g,
    severity: 'critical',
    description: 'Elliptic Curve private key detected',
    falsePositiveHints: [],
  },

  // Passwords
  {
    type: 'PASSWORD',
    name: 'Hardcoded Password',
    pattern: /['"]?(password|passwd|pwd)['"]?\s*[=:]\s*['"]([^'"]{6,})['"]/gi,
    severity: 'high',
    description: 'Hardcoded password detected',
    falsePositiveHints: ['process.env', 'undefined', 'null', 'password123', 'changeme'],
  },
  {
    type: 'PASSWORD',
    name: 'Database Password',
    pattern: /['"]?(db_password|database_password|mysql_password|postgres_password)['"]?\s*[=:]\s*['"]([^'"]{6,})['"]/gi,
    severity: 'critical',
    description: 'Database password detected',
    falsePositiveHints: ['process.env'],
  },

  // JWT
  {
    type: 'JWT_TOKEN',
    name: 'JWT Token',
    pattern: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    severity: 'high',
    description: 'JWT token detected - may contain sensitive claims',
    falsePositiveHints: ['example', 'test'],
  },

  // OAuth
  {
    type: 'OAUTH_TOKEN',
    name: 'OAuth Client Secret',
    pattern: /['"]?(client[_-]?secret|oauth[_-]?secret)['"]?\s*[=:]\s*['"]([a-zA-Z0-9_\-]{20,})['"]/gi,
    severity: 'high',
    description: 'OAuth client secret detected',
    falsePositiveHints: ['process.env', 'YOUR_'],
  },

  // Database URLs
  {
    type: 'DATABASE_URL',
    name: 'Database Connection String',
    pattern: /(mongodb|postgres|postgresql|mysql|redis|amqp):\/\/[^:\s]+:[^@\s]+@[^\s]+/gi,
    severity: 'critical',
    description: 'Database connection string with credentials detected',
    falsePositiveHints: ['localhost', '127.0.0.1', 'example.com'],
  },

  // GitHub
  {
    type: 'GITHUB_TOKEN',
    name: 'GitHub Personal Access Token',
    pattern: /ghp_[a-zA-Z0-9]{36,255}/g,
    severity: 'critical',
    description: 'GitHub Personal Access Token detected',
    falsePositiveHints: [],
  },
  {
    type: 'GITHUB_TOKEN',
    name: 'GitHub OAuth Token',
    pattern: /gho_[a-zA-Z0-9]{36,255}/g,
    severity: 'critical',
    description: 'GitHub OAuth Token detected',
    falsePositiveHints: [],
  },
  {
    type: 'GITHUB_TOKEN',
    name: 'GitHub App Token',
    pattern: /ghu_[a-zA-Z0-9]{36,255}/g,
    severity: 'critical',
    description: 'GitHub App User Token detected',
    falsePositiveHints: [],
  },

  // Slack
  {
    type: 'SLACK_TOKEN',
    name: 'Slack Bot Token',
    pattern: /xoxb-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}/g,
    severity: 'high',
    description: 'Slack Bot Token detected',
    falsePositiveHints: [],
  },
  {
    type: 'SLACK_TOKEN',
    name: 'Slack User Token',
    pattern: /xoxp-[0-9]{10,13}-[0-9]{10,13}-[0-9]{10,13}-[a-f0-9]{32}/g,
    severity: 'high',
    description: 'Slack User Token detected',
    falsePositiveHints: [],
  },
  {
    type: 'SLACK_TOKEN',
    name: 'Slack Webhook URL',
    pattern: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[a-zA-Z0-9]+/g,
    severity: 'medium',
    description: 'Slack Webhook URL detected',
    falsePositiveHints: [],
  },

  // Stripe
  {
    type: 'STRIPE_KEY',
    name: 'Stripe Secret Key',
    pattern: /sk_live_[a-zA-Z0-9]{24,}/g,
    severity: 'critical',
    description: 'Stripe live secret key detected - can process real payments',
    falsePositiveHints: [],
  },
  {
    type: 'STRIPE_KEY',
    name: 'Stripe Test Key',
    pattern: /sk_test_[a-zA-Z0-9]{24,}/g,
    severity: 'medium',
    description: 'Stripe test secret key detected',
    falsePositiveHints: [],
  },

  // SendGrid
  {
    type: 'SENDGRID_KEY',
    name: 'SendGrid API Key',
    pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/g,
    severity: 'high',
    description: 'SendGrid API key detected',
    falsePositiveHints: [],
  },

  // Twilio
  {
    type: 'TWILIO_KEY',
    name: 'Twilio API Key',
    pattern: /SK[a-f0-9]{32}/g,
    severity: 'high',
    description: 'Twilio API key detected',
    falsePositiveHints: [],
  },

  // Firebase
  {
    type: 'FIREBASE_KEY',
    name: 'Firebase API Key',
    pattern: /AIza[0-9A-Za-z_-]{35}/g,
    severity: 'medium',
    description: 'Firebase/Google API key detected',
    falsePositiveHints: [],
  },

  // Generic secrets
  {
    type: 'GENERIC_SECRET',
    name: 'Generic Secret',
    pattern: /['"]?(secret|token|auth)['"]?\s*[=:]\s*['"]([a-zA-Z0-9_\-]{20,})['"]/gi,
    severity: 'medium',
    description: 'Potential hardcoded secret detected',
    falsePositiveHints: ['process.env', 'YOUR_', 'xxx', 'undefined'],
  },
  {
    type: 'ENCRYPTION_KEY',
    name: 'Encryption Key',
    pattern: /['"]?(encryption[_-]?key|secret[_-]?key|private[_-]?key)['"]?\s*[=:]\s*['"]([a-zA-Z0-9_\-]{16,})['"]/gi,
    severity: 'critical',
    description: 'Hardcoded encryption key detected',
    falsePositiveHints: ['process.env'],
  },
];

export interface SecretScanResult {
  findings: SecretFinding[];
  filesScanned: number;
  scanDuration: number;
  summary: {
    critical: number;
    high: number;
    medium: number;
    total: number;
    byType: Record<SecretType, number>;
  };
}

export class SecretScanner {
  private patterns: SecretPattern[];
  private excludePatterns: string[];

  constructor() {
    this.patterns = SECRET_PATTERNS;
    this.excludePatterns = [
      '**/node_modules/**',
      '**/.git/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/*.min.js',
      '**/package-lock.json',
      '**/yarn.lock',
      '**/*.md',
      '**/LICENSE',
    ];
  }

  async scan(directory: string): Promise<SecretScanResult> {
    const startTime = Date.now();
    const findings: SecretFinding[] = [];
    let filesScanned = 0;

    // Normalize directory path for glob (use forward slashes on Windows)
    const normalizedDir = directory.replace(/\\/g, '/');

    // Find all files to scan
    const files = await glob('**/*.{js,ts,jsx,tsx,json,env,yml,yaml,xml,config,conf,properties,ini}', {
      cwd: normalizedDir,
      ignore: this.excludePatterns,
      absolute: true,
    });

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        const relativePath = path.relative(directory, filePath);
        filesScanned++;

        for (const pattern of this.patterns) {
          pattern.pattern.lastIndex = 0;

          let match;
          while ((match = pattern.pattern.exec(content)) !== null) {
            const matchedText = match[0];

            // Skip false positives
            if (this.isFalsePositive(matchedText, pattern.falsePositiveHints, content, match.index)) {
              continue;
            }

            // Calculate position
            const beforeMatch = content.substring(0, match.index);
            const lineNumber = beforeMatch.split('\n').length;
            const lastNewline = beforeMatch.lastIndexOf('\n');
            const column = match.index - lastNewline;

            // Get snippet and mask sensitive value
            const line = lines[lineNumber - 1] || '';
            const maskedValue = this.maskSecret(matchedText);

            // Calculate entropy for confidence scoring
            const entropy = this.calculateEntropy(matchedText);

            findings.push({
              id: `secret-${filesScanned}-${match.index}`,
              type: pattern.type,
              name: pattern.name,
              severity: pattern.severity,
              file: relativePath,
              line: lineNumber,
              column,
              snippet: line.substring(0, 200),
              maskedValue,
              description: pattern.description,
              remediation: this.getRemediation(pattern.type),
              confidence: this.calculateConfidence(matchedText, entropy, pattern),
              entropy,
            });
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    // Calculate summary
    const byType = {} as Record<SecretType, number>;
    for (const finding of findings) {
      byType[finding.type] = (byType[finding.type] || 0) + 1;
    }

    return {
      findings,
      filesScanned,
      scanDuration: Date.now() - startTime,
      summary: {
        critical: findings.filter(f => f.severity === 'critical').length,
        high: findings.filter(f => f.severity === 'high').length,
        medium: findings.filter(f => f.severity === 'medium').length,
        total: findings.length,
        byType,
      },
    };
  }

  private isFalsePositive(value: string, hints: string[], content: string, index: number): boolean {
    const lowerValue = value.toLowerCase();

    // Check hints
    for (const hint of hints) {
      if (lowerValue.includes(hint.toLowerCase())) {
        return true;
      }
    }

    // Check if it's in a comment
    const lineStart = content.lastIndexOf('\n', index) + 1;
    const lineContent = content.substring(lineStart, index).trim();
    if (lineContent.startsWith('//') || lineContent.startsWith('*') || lineContent.startsWith('#')) {
      return true;
    }

    // Check if it references environment variable
    const contextBefore = content.substring(Math.max(0, index - 50), index);
    if (contextBefore.includes('process.env') || contextBefore.includes('env.')) {
      return true;
    }

    return false;
  }

  private maskSecret(value: string): string {
    if (value.length <= 8) {
      return '*'.repeat(value.length);
    }
    return value.substring(0, 4) + '*'.repeat(value.length - 8) + value.substring(value.length - 4);
  }

  private calculateEntropy(str: string): number {
    const len = str.length;
    const charCounts: Record<string, number> = {};

    for (const char of str) {
      charCounts[char] = (charCounts[char] || 0) + 1;
    }

    let entropy = 0;
    for (const count of Object.values(charCounts)) {
      const freq = count / len;
      entropy -= freq * Math.log2(freq);
    }

    return Math.round(entropy * 100) / 100;
  }

  private calculateConfidence(value: string, entropy: number, pattern: SecretPattern): 'high' | 'medium' | 'low' {
    // High entropy secrets are more likely to be real
    if (entropy > 4.0 && value.length >= 32) {
      return 'high';
    }

    // Known patterns with specific formats
    if (pattern.type === 'AWS_KEY' || pattern.type === 'GITHUB_TOKEN' || pattern.type === 'STRIPE_KEY') {
      return 'high';
    }

    // Private keys are always high confidence
    if (pattern.type === 'PRIVATE_KEY') {
      return 'high';
    }

    // JWTs have a specific structure
    if (pattern.type === 'JWT_TOKEN' && value.split('.').length === 3) {
      return 'high';
    }

    if (entropy > 3.0) {
      return 'medium';
    }

    return 'low';
  }

  private getRemediation(type: SecretType): string {
    const remediations: Record<SecretType, string> = {
      API_KEY: 'Move to environment variables using process.env.API_KEY',
      AWS_KEY: 'Use AWS IAM roles or store in AWS Secrets Manager. Never commit AWS credentials.',
      PRIVATE_KEY: 'Store private keys in a secure vault (HashiCorp Vault, AWS Secrets Manager). Never commit to source control.',
      PASSWORD: 'Use environment variables or a secrets manager. Consider using .env files (gitignored) for local development.',
      JWT_TOKEN: 'Generate tokens dynamically. Never hardcode tokens. Use proper token management.',
      OAUTH_TOKEN: 'Store OAuth secrets in environment variables or a secrets manager.',
      DATABASE_URL: 'Use environment variables for database connection strings: process.env.DATABASE_URL',
      WEBHOOK_SECRET: 'Store webhook secrets in environment variables.',
      ENCRYPTION_KEY: 'Use a key management service (KMS) or secrets manager for encryption keys.',
      GITHUB_TOKEN: 'Use GitHub Apps or environment variables. Rotate the token immediately if exposed.',
      SLACK_TOKEN: 'Regenerate the token in Slack settings. Use environment variables.',
      STRIPE_KEY: 'Use environment variables. If a live key was exposed, rotate it immediately in Stripe dashboard.',
      SENDGRID_KEY: 'Store in environment variables. Regenerate key if exposed.',
      TWILIO_KEY: 'Use environment variables. Rotate key if exposed.',
      FIREBASE_KEY: 'For client-side keys, restrict API key usage in Google Console. Use server-side keys for sensitive operations.',
      GENERIC_SECRET: 'Move to environment variables or a secrets manager.',
    };

    return remediations[type] || 'Move to environment variables or a secrets manager.';
  }
}

export const secretScanner = new SecretScanner();
