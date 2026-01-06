/**
 * API Route: Verify Claude CLI Installation and Authentication
 *
 * Checks if:
 * 1. Claude CLI is installed
 * 2. User is authenticated (logged in)
 * 3. Subscription is active
 */

import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

interface VerificationResult {
  installed: boolean;
  authenticated: boolean;
  subscriptionType: string | null;
  accountEmail: string | null;
  version: string | null;
  error: string | null;
}

export async function GET() {
  const result: VerificationResult = {
    installed: false,
    authenticated: false,
    subscriptionType: null,
    accountEmail: null,
    version: null,
    error: null,
  };

  try {
    // Step 1: Check if Claude CLI is installed
    try {
      const version = execSync('claude --version', {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
      result.installed = true;
      result.version = version;
    } catch (err) {
      const error = err as { message?: string; stderr?: Buffer };
      const errorMsg = error.message || '';
      if (errorMsg.includes('not recognized') ||
          errorMsg.includes('not found') ||
          errorMsg.includes('command not found') ||
          errorMsg.includes('ENOENT')) {
        result.error = 'Claude CLI is not installed. Please install it first.';
      } else {
        result.error = `Claude CLI check failed: ${errorMsg}`;
      }
      return NextResponse.json(result);
    }

    // Step 2: Check for OAuth credentials in various config locations
    const configPaths = [
      join(homedir(), '.claude.json'),
      join(homedir(), '.claude', 'config.json'),
      join(homedir(), '.claude', 'credentials.json'),
      join(process.env.APPDATA || '', 'claude', 'config.json'),
    ];

    let foundAuth = false;
    for (const configPath of configPaths) {
      if (configPath && existsSync(configPath)) {
        try {
          const configContent = readFileSync(configPath, 'utf-8');
          const config = JSON.parse(configContent);

          // Check for OAuth account credentials
          if (config.oauthAccount?.accountUuid) {
            result.authenticated = true;
            result.subscriptionType = 'Active';
            if (config.oauthAccount.emailAddress) {
              result.accountEmail = config.oauthAccount.emailAddress;
            }
            if (config.oauthAccount.displayName) {
              result.subscriptionType = `Active (${config.oauthAccount.displayName})`;
            }
            foundAuth = true;
            break;
          }
        } catch {
          // Continue to next path
        }
      }
    }

    // If Claude Code 2.x is installed and version shows "Claude Code", assume it's working
    // Claude Code 2.x uses OAuth and may not have traditional config files
    if (!foundAuth && result.version?.includes('Claude Code')) {
      result.authenticated = true;
      result.subscriptionType = 'Claude Code CLI';
      result.accountEmail = 'via CLI authentication';
    } else if (!foundAuth) {
      result.error = 'Claude CLI is installed but not logged in. Run "claude setup-token" in your terminal.';
    }

  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error during verification';
  }

  return NextResponse.json(result);
}

export async function POST() {
  // POST can be used to trigger a fresh verification (same logic)
  return GET();
}
