/**
 * Claude Account Service
 *
 * Manages Claude Code CLI authentication and account switching.
 * Provides proper logout, login, and account status detection.
 */

import { spawn, execSync, exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';

export interface ClaudeAccountStatus {
  isLoggedIn: boolean;
  email?: string;
  displayName?: string;
  accountType?: 'free' | 'pro' | 'max' | 'team' | 'enterprise';
  configDir: string;
  version?: string;
  error?: string;
}

export interface LoginProgress {
  type: 'info' | 'url' | 'success' | 'error' | 'waiting';
  message: string;
  url?: string;
}

class ClaudeAccountService extends EventEmitter {
  private configPaths: string[];

  constructor() {
    super();
    // All possible config locations for Claude CLI
    const homeDir = os.homedir();
    this.configPaths = [
      path.join(homeDir, '.claude.json'),
      path.join(homeDir, '.claude', 'config.json'),
      path.join(homeDir, '.claude', 'credentials.json'),
      path.join(homeDir, '.claude', 'settings.json'),
      path.join(process.env.APPDATA || '', 'claude', 'config.json'),
      path.join(process.env.APPDATA || '', 'Claude', 'config.json'),
      path.join(process.env.LOCALAPPDATA || '', 'claude', 'config.json'),
      path.join(process.env.LOCALAPPDATA || '', 'Claude', 'config.json'),
    ].filter(p => p && !p.startsWith(path.sep)); // Filter out invalid paths
  }

  /**
   * Find and read Claude config file
   */
  private findConfigFile(): { path: string; config: any } | null {
    for (const configPath of this.configPaths) {
      if (fs.existsSync(configPath)) {
        try {
          const content = fs.readFileSync(configPath, 'utf-8');
          const config = JSON.parse(content);
          return { path: configPath, config };
        } catch {
          continue;
        }
      }
    }
    return null;
  }

  /**
   * Get detailed account status
   */
  async getStatus(): Promise<ClaudeAccountStatus> {
    const result: ClaudeAccountStatus = {
      isLoggedIn: false,
      configDir: 'Unknown',
    };

    try {
      // Check if Claude CLI is installed
      const versionResult = execSync('claude --version', {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      result.version = versionResult.trim();

      // Try to get account info from config file
      const configFile = this.findConfigFile();
      if (configFile) {
        result.configDir = path.dirname(configFile.path);
        const config = configFile.config;

        // Check for OAuth account
        if (config.oauthAccount?.accountUuid) {
          result.isLoggedIn = true;
          result.email = config.oauthAccount.emailAddress || undefined;
          result.displayName = config.oauthAccount.displayName || undefined;

          // Detect account type from display name or email
          if (result.displayName?.toLowerCase().includes('team')) {
            result.accountType = 'team';
          } else if (result.displayName?.toLowerCase().includes('max')) {
            result.accountType = 'max';
          } else if (result.displayName?.toLowerCase().includes('pro')) {
            result.accountType = 'pro';
          } else {
            result.accountType = 'pro'; // Default assumption
          }
          return result;
        }

        // Check for API key auth
        if (config.apiKey || config.anthropicApiKey) {
          result.isLoggedIn = true;
          result.email = 'API Key Authentication';
          result.accountType = 'pro';
          return result;
        }
      }

      // Try running a simple command to check auth
      try {
        const testResult = execSync('claude --version', {
          encoding: 'utf-8',
          timeout: 10000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        // If Claude Code 2.x+ is installed, it uses OAuth which may work without config files
        if (result.version?.includes('Claude Code')) {
          // Try a quick test to see if authenticated
          try {
            execSync('claude -p --max-turns 0 "test"', {
              encoding: 'utf-8',
              timeout: 15000,
              stdio: ['pipe', 'pipe', 'pipe'],
            });
            result.isLoggedIn = true;
            result.email = 'Claude Account';
            result.accountType = 'pro';
          } catch (testErr: any) {
            const errMsg = testErr.message || testErr.stderr?.toString() || '';
            if (errMsg.includes('not authenticated') || errMsg.includes('login') || errMsg.includes('401')) {
              result.isLoggedIn = false;
              result.error = 'Not logged in. Click "Login with Claude" to authenticate.';
            } else {
              // Assume it's working if we don't get an auth error
              result.isLoggedIn = true;
              result.email = 'Claude Account';
              result.accountType = 'pro';
            }
          }
        }
      } catch {
        // Ignore
      }

      if (!result.isLoggedIn && !result.error) {
        result.error = 'Not logged in. Click "Login with Claude" to authenticate.';
      }

    } catch (error: any) {
      const errorMsg = error.message || String(error);
      console.error('[ClaudeAccountService] Status check failed:', errorMsg);

      if (errorMsg.includes('not found') || errorMsg.includes('ENOENT') || errorMsg.includes('not recognized')) {
        result.error = 'Claude CLI not installed. Install with: npm install -g @anthropic-ai/claude-code';
      } else {
        result.error = `Error checking status: ${errorMsg.substring(0, 100)}`;
      }
    }

    return result;
  }

  /**
   * Logout from Claude CLI by clearing credentials
   */
  async logout(): Promise<{ success: boolean; error?: string }> {
    console.log('[ClaudeAccountService] Starting logout...');

    try {
      // Try using claude logout if available (newer versions)
      try {
        execSync('claude logout', {
          encoding: 'utf-8',
          timeout: 10000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        console.log('[ClaudeAccountService] Logged out via claude logout command');
        return { success: true };
      } catch (e) {
        // Command may not exist in older versions
        console.log('[ClaudeAccountService] claude logout not available, clearing config files...');
      }

      // Fallback: Clear config files manually
      let cleared = false;
      for (const configPath of this.configPaths) {
        if (fs.existsSync(configPath)) {
          try {
            const content = fs.readFileSync(configPath, 'utf-8');
            const config = JSON.parse(content);

            // Remove OAuth credentials
            if (config.oauthAccount) {
              delete config.oauthAccount;
              fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
              console.log(`[ClaudeAccountService] Cleared OAuth from ${configPath}`);
              cleared = true;
            }

            // Remove API key if present
            if (config.apiKey || config.anthropicApiKey) {
              delete config.apiKey;
              delete config.anthropicApiKey;
              fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
              console.log(`[ClaudeAccountService] Cleared API key from ${configPath}`);
              cleared = true;
            }
          } catch (e) {
            console.log(`[ClaudeAccountService] Could not clear ${configPath}:`, e);
          }
        }
      }

      if (cleared) {
        return { success: true };
      }

      return {
        success: false,
        error: 'No credentials found to clear. You may already be logged out.',
      };

    } catch (error: any) {
      console.error('[ClaudeAccountService] Logout failed:', error);
      return {
        success: false,
        error: `Logout failed: ${error.message}`,
      };
    }
  }

  /**
   * Start the login process with proper streaming output
   */
  async *login(): AsyncGenerator<LoginProgress> {
    console.log('[ClaudeAccountService] login() called');

    yield {
      type: 'info',
      message: 'Starting Claude login...',
    };

    // Helper to open browser
    const openBrowser = (url: string) => {
      console.log('[ClaudeAccountService] Opening browser to:', url);
      const openCmd = process.platform === 'win32' ? 'start ""' :
                     process.platform === 'darwin' ? 'open' : 'xdg-open';
      exec(`${openCmd} "${url}"`, (error) => {
        if (error) {
          console.error('[ClaudeAccountService] Failed to open browser:', error);
        }
      });
    };

    try {
      yield {
        type: 'info',
        message: 'Opening browser for authentication...',
      };

      // First, try running 'claude' with no args to trigger login prompt
      // This works better than 'claude login' on some versions
      console.log('[ClaudeAccountService] Trying claude command...');

      let loginSucceeded = false;
      let authUrl: string | null = null;

      // Try to get auth URL from claude command
      try {
        const result = execSync('claude --help', {
          encoding: 'utf-8',
          timeout: 5000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        console.log('[ClaudeAccountService] Claude help output:', result.slice(0, 200));
      } catch (e) {
        console.log('[ClaudeAccountService] Claude help failed, trying login...');
      }

      // Try 'claude login' command
      const loginProcess = spawn('claude', ['login'], {
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      console.log('[ClaudeAccountService] Process spawned, PID:', loginProcess.pid);

      let outputBuffer = '';

      // Collect output to look for URL
      const outputPromise = new Promise<string>((resolve) => {
        const timeout = setTimeout(() => resolve(outputBuffer), 5000);

        loginProcess.stdout?.on('data', (data: Buffer) => {
          const text = data.toString();
          outputBuffer += text;
          console.log('[ClaudeAccountService] stdout:', text);

          // Look for URL in output
          const urlMatch = text.match(/(https:\/\/[^\s\)\"]+)/);
          if (urlMatch) {
            authUrl = urlMatch[1];
            clearTimeout(timeout);
            resolve(outputBuffer);
          }
        });

        loginProcess.stderr?.on('data', (data: Buffer) => {
          const text = data.toString();
          outputBuffer += text;
          console.log('[ClaudeAccountService] stderr:', text);

          const urlMatch = text.match(/(https:\/\/[^\s\)\"]+)/);
          if (urlMatch) {
            authUrl = urlMatch[1];
            clearTimeout(timeout);
            resolve(outputBuffer);
          }
        });

        loginProcess.on('close', () => {
          clearTimeout(timeout);
          resolve(outputBuffer);
        });
      });

      await outputPromise;

      // If we found an auth URL, open it
      if (authUrl) {
        console.log('[ClaudeAccountService] Found auth URL:', authUrl);
        openBrowser(authUrl);
        yield {
          type: 'url',
          message: `Opening authentication page...\n\nIf browser didn't open, visit:\n${authUrl}`,
          url: authUrl,
        };
      } else {
        // Fallback: open Claude login directly
        console.log('[ClaudeAccountService] No auth URL found, opening claude.ai directly');
        openBrowser('https://claude.ai/login');
        yield {
          type: 'url',
          message: 'Opening Claude login page.\n\nAfter signing in at claude.ai, you may need to run "claude" in a terminal to complete setup.',
          url: 'https://claude.ai/login',
        };
      }

      yield {
        type: 'waiting',
        message: 'Complete authentication in your browser, then click "Refresh Status".',
      };

      // Don't wait for the process - let user complete in browser
      loginProcess.unref();

    } catch (error: any) {
      console.error('[ClaudeAccountService] Login error:', error);

      // Fallback: open browser directly
      openBrowser('https://claude.ai/login');

      yield {
        type: 'url',
        message: 'Opening Claude login page.\n\nAfter signing in, run "claude" in a terminal to link your CLI.',
        url: 'https://claude.ai/login',
      };
    }
  }

  /**
   * Switch account - logout first, then login
   */
  async *switchAccount(): AsyncGenerator<LoginProgress> {
    console.log('[ClaudeAccountService] switchAccount() called');

    yield {
      type: 'info',
      message: 'Switching accounts...',
    };

    // Helper to open browser
    const openBrowser = (url: string) => {
      console.log('[ClaudeAccountService] Opening browser to:', url);
      const openCmd = process.platform === 'win32' ? 'start ""' :
                     process.platform === 'darwin' ? 'open' : 'xdg-open';
      exec(`${openCmd} "${url}"`, (error) => {
        if (error) {
          console.error('[ClaudeAccountService] Failed to open browser:', error);
        }
      });
    };

    // First logout locally
    console.log('[ClaudeAccountService] Calling logout...');
    const logoutResult = await this.logout();
    console.log('[ClaudeAccountService] Logout result:', logoutResult);

    // Also try CLI logout command
    try {
      execSync('claude logout', {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      console.log('[ClaudeAccountService] CLI logout succeeded');
    } catch (e) {
      console.log('[ClaudeAccountService] CLI logout not available or failed');
    }

    yield {
      type: 'info',
      message: 'Cleared local credentials...',
    };

    // Open Claude logout page to clear browser session
    yield {
      type: 'info',
      message: 'Opening browser to sign out of current account...',
    };

    // Open logout URL - this will sign out the current account in browser
    openBrowser('https://claude.ai/settings');

    yield {
      type: 'waiting',
      message: 'In the browser:\n1. Click your profile icon (bottom left)\n2. Click "Sign out"\n3. Then sign in with your other account\n4. Click "Refresh Status" here when done',
    };

    // Give user time to complete the logout/login
    console.log('[ClaudeAccountService] switchAccount() - waiting for user to complete in browser');
  }

  /**
   * Check if claude CLI is installed
   */
  isClaudeInstalled(): boolean {
    try {
      execSync('claude --version', {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Claude CLI version
   */
  getVersion(): string | null {
    try {
      return execSync('claude --version', {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
    } catch {
      return null;
    }
  }
}

// Singleton instance
export const claudeAccountService = new ClaudeAccountService();
