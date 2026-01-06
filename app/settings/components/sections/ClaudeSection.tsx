'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  Check,
  RefreshCw,
  ExternalLink,
  Loader2,
  Users,
  Terminal,
  LogOut,
  ArrowRightLeft,
} from 'lucide-react';
import { useSettings } from '../SettingsContext';
import { ServiceCard } from '../shared/ServiceCard';
import { cn } from '@/lib/utils';

export function ClaudeSection() {
  const {
    claudeStatus,
    verifyingClaude,
    verifyClaude,
    isLoggingIn,
    fleetLoginProgress,
    startFleetLogin,
    switchClaudeAccount,
    logoutClaude,
  } = useSettings();

  const handleSwitchAccount = () => {
    console.log('[ClaudeSection] Switch account clicked');
    switchClaudeAccount();
  };

  const handleLogout = () => {
    console.log('[ClaudeSection] Logout clicked');
    logoutClaude();
  };

  const getStatus = () => {
    if (claudeStatus?.authenticated) return 'success';
    if (claudeStatus?.installed) return 'warning';
    return 'error';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Claude Subscription</h2>
        <p className="text-muted-foreground">
          Connect your Claude subscription for AI-powered builds
        </p>
      </div>

      {/* Main Card */}
      <ServiceCard
        title="Claude Code CLI"
        description="Used for Fleet Builds"
        icon={<Bot className="h-5 w-5" />}
        status={getStatus()}
        onRefresh={verifyClaude}
        loading={verifyingClaude}
        externalLinkUrl="https://claude.ai"
      >
        {claudeStatus && (
          <div className="space-y-4">
            {/* Status Display */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {claudeStatus.authenticated
                    ? 'Connected'
                    : claudeStatus.installed
                    ? 'CLI Installed - Not Logged In'
                    : 'CLI Not Installed'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {claudeStatus.authenticated ? (
                    <>
                      {claudeStatus.subscriptionType}{' '}
                      {claudeStatus.accountEmail && `• ${claudeStatus.accountEmail}`}
                    </>
                  ) : claudeStatus.installed ? (
                    'Click Login to authenticate with your Claude account'
                  ) : (
                    'Install Claude Code CLI first'
                  )}
                </p>
              </div>
              {claudeStatus.authenticated && (
                <Badge className="bg-green-600 text-white text-xs">
                  <Check className="h-3 w-3 mr-1" />
                  Ready
                </Badge>
              )}
            </div>

            {/* Version */}
            {claudeStatus.version && (
              <p className="text-xs text-muted-foreground">Version: {claudeStatus.version}</p>
            )}

            {/* Account Actions */}
            {claudeStatus.installed && (
              <div className="pt-3 border-t border-border space-y-3">
                {claudeStatus.authenticated ? (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={handleSwitchAccount}
                      disabled={isLoggingIn}
                    >
                      {isLoggingIn ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Switching...
                        </>
                      ) : (
                        <>
                          <ArrowRightLeft className="h-4 w-4 mr-2" />
                          Switch Account
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={handleLogout}
                      disabled={isLoggingIn}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    onClick={startFleetLogin}
                    disabled={isLoggingIn}
                  >
                    {isLoggingIn ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Opening Browser...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Login with Claude
                      </>
                    )}
                  </Button>
                )}

                {/* Login Progress */}
                {(fleetLoginProgress.length > 0 || isLoggingIn) && (
                  <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-2">
                    {isLoggingIn && fleetLoginProgress.length === 0 && (
                      <p className="text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Connecting...
                      </p>
                    )}
                    {fleetLoginProgress.slice(-5).map((msg, i) => (
                      <p key={i} className="text-muted-foreground whitespace-pre-line">
                        {msg}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Installation Instructions */}
            {!claudeStatus.installed && (
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <p className="text-sm font-medium">Install Claude Code CLI</p>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Run this command in your terminal:</p>
                  <code className="block p-3 bg-black/80 text-white rounded font-mono text-sm">
                    npm install -g @anthropic-ai/claude-code
                  </code>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open('https://docs.anthropic.com/en/docs/claude-code', '_blank')
                  }
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  View Documentation
                </Button>
              </div>
            )}

            {/* Error Display */}
            {claudeStatus.error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 text-sm">
                {claudeStatus.error}
              </div>
            )}
          </div>
        )}
      </ServiceCard>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About Claude Subscription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            The Claude Code CLI uses your Claude subscription to power AI builds. This means:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>No separate API costs for builds</li>
            <li>Uses your existing Claude Pro/Team subscription</li>
            <li>Full access to Claude's latest capabilities</li>
          </ul>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('https://claude.ai/settings', '_blank')}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Manage Subscription
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
