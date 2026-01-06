'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  CheckCircle,
  XCircle,
  Loader2,
  Terminal,
  RefreshCw,
  ExternalLink,
  Cpu,
  Zap,
  Shield,
  ArrowRight,
  Copy,
  Check,
} from 'lucide-react';

interface VerificationResult {
  installed: boolean;
  authenticated: boolean;
  subscriptionType: string | null;
  accountEmail: string | null;
  version: string | null;
  error: string | null;
}

type SetupStep = 'checking' | 'not-installed' | 'not-authenticated' | 'ready' | 'error';

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<SetupStep>('checking');
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const verifySetup = async () => {
    setIsVerifying(true);
    setStep('checking');

    try {
      const response = await fetch('/api/setup/verify-claude');
      const data: VerificationResult = await response.json();
      setResult(data);

      if (!data.installed) {
        setStep('not-installed');
      } else if (!data.authenticated) {
        setStep('not-authenticated');
      } else {
        setStep('ready');
      }
    } catch (error) {
      setStep('error');
      setResult({
        installed: false,
        authenticated: false,
        subscriptionType: null,
        accountEmail: null,
        version: null,
        error: 'Failed to connect to verification API',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    verifySetup();
  }, []);

  const handleContinue = () => {
    // Mark setup as complete
    localStorage.setItem('ai-dev-platform-setup-complete', 'true');
    router.push('/');
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const CommandBlock = ({ command, id }: { command: string; id: string }) => (
    <div className="flex items-center gap-2 bg-black/60 rounded-lg p-3 font-mono text-sm">
      <span className="text-green-400">$</span>
      <code className="flex-1 text-white">{command}</code>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-white/60 hover:text-white"
        onClick={() => copyToClipboard(command, id)}
      >
        {copied === id ? (
          <Check className="h-4 w-4 text-green-400" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600">
              <Cpu className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">AI Dev Platform</h1>
          <p className="text-white/60">Multi-Agent Development Environment</p>
        </div>

        {/* Main Card */}
        <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Terminal className="h-5 w-5 text-blue-400" />
              Setup Verification
            </CardTitle>
            <CardDescription>
              Checking your Claude Code CLI installation and subscription
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status Indicators */}
            <div className="space-y-3">
              {/* CLI Installed Check */}
              <div className={cn(
                'flex items-center gap-3 p-3 rounded-lg border',
                step === 'checking' ? 'border-white/20 bg-white/5' :
                result?.installed ? 'border-green-500/50 bg-green-500/10' :
                'border-red-500/50 bg-red-500/10'
              )}>
                {step === 'checking' ? (
                  <Loader2 className="h-5 w-5 text-white/60 animate-spin" />
                ) : result?.installed ? (
                  <CheckCircle className="h-5 w-5 text-green-400" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-400" />
                )}
                <div className="flex-1">
                  <p className="text-white font-medium">Claude CLI Installed</p>
                  {result?.version && (
                    <p className="text-xs text-white/60">{result.version}</p>
                  )}
                </div>
                {result?.installed && (
                  <Badge className="bg-green-600">Installed</Badge>
                )}
              </div>

              {/* Authentication Check */}
              <div className={cn(
                'flex items-center gap-3 p-3 rounded-lg border',
                step === 'checking' ? 'border-white/20 bg-white/5' :
                !result?.installed ? 'border-white/10 bg-white/5 opacity-50' :
                result?.authenticated ? 'border-green-500/50 bg-green-500/10' :
                'border-red-500/50 bg-red-500/10'
              )}>
                {step === 'checking' ? (
                  <Loader2 className="h-5 w-5 text-white/60 animate-spin" />
                ) : !result?.installed ? (
                  <div className="h-5 w-5 rounded-full border-2 border-white/20" />
                ) : result?.authenticated ? (
                  <CheckCircle className="h-5 w-5 text-green-400" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-400" />
                )}
                <div className="flex-1">
                  <p className="text-white font-medium">Subscription Active</p>
                  {result?.accountEmail && (
                    <p className="text-xs text-white/60">{result.accountEmail}</p>
                  )}
                </div>
                {result?.authenticated && result?.subscriptionType && (
                  <Badge className="bg-purple-600">{result.subscriptionType}</Badge>
                )}
              </div>
            </div>

            {/* Instructions based on step */}
            {step === 'not-installed' && (
              <div className="space-y-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-start gap-3">
                  <Zap className="h-5 w-5 text-amber-400 mt-0.5" />
                  <div>
                    <h3 className="text-white font-medium mb-2">Install Claude Code CLI</h3>
                    <p className="text-sm text-white/70 mb-4">
                      Claude Code CLI is required to run the AI agents. Install it using npm:
                    </p>
                    <CommandBlock command="npm install -g @anthropic-ai/claude-code" id="install" />
                    <p className="text-xs text-white/50 mt-3">
                      After installing, click &quot;Verify Again&quot; to continue.
                    </p>
                  </div>
                </div>
                <div className="pt-3 border-t border-amber-500/20">
                  <a
                    href="https://docs.anthropic.com/en/docs/claude-code"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-amber-400 hover:text-amber-300"
                  >
                    View Claude Code Documentation
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            )}

            {step === 'not-authenticated' && (
              <div className="space-y-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-blue-400 mt-0.5" />
                  <div>
                    <h3 className="text-white font-medium mb-2">Login to Claude</h3>
                    <p className="text-sm text-white/70 mb-4">
                      Claude CLI is installed but you need to log in with your Claude account.
                      Run this command in your terminal:
                    </p>
                    <CommandBlock command="claude login" id="login" />
                    <p className="text-xs text-white/50 mt-3">
                      This will open a browser window to authenticate. After logging in, click &quot;Verify Again&quot;.
                    </p>
                  </div>
                </div>
                {result?.error && (
                  <div className="pt-3 border-t border-blue-500/20">
                    <p className="text-xs text-red-400">{result.error}</p>
                  </div>
                )}
              </div>
            )}

            {step === 'ready' && (
              <div className="space-y-4 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
                  <div>
                    <h3 className="text-white font-medium mb-2">You&apos;re All Set!</h3>
                    <p className="text-sm text-white/70">
                      Claude Code CLI is installed and authenticated. You can now use the AI Dev Platform
                      to build applications with multiple AI agents.
                    </p>
                    {result?.subscriptionType && (
                      <p className="text-sm text-green-400 mt-2">
                        Subscription: {result.subscriptionType}
                        {result.accountEmail && ` (${result.accountEmail})`}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {step === 'error' && result?.error && (
              <div className="space-y-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                <div className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-red-400 mt-0.5" />
                  <div>
                    <h3 className="text-white font-medium mb-2">Verification Failed</h3>
                    <p className="text-sm text-red-300">{result.error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              {step !== 'ready' && (
                <Button
                  variant="outline"
                  className="flex-1 border-white/20 text-white"
                  onClick={verifySetup}
                  disabled={isVerifying}
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Verify Again
                    </>
                  )}
                </Button>
              )}

              {step === 'ready' && (
                <Button
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500"
                  onClick={handleContinue}
                >
                  Continue to Dashboard
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>

            {/* Skip option for development */}
            {step !== 'ready' && (
              <div className="text-center pt-2">
                <button
                  className="text-xs text-white/40 hover:text-white/60 transition-colors"
                  onClick={() => {
                    if (confirm('Skip setup? Some features may not work without Claude CLI.')) {
                      handleContinue();
                    }
                  }}
                >
                  Skip for now (not recommended)
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Features Preview */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-lg bg-white/5 border border-white/10">
            <Cpu className="h-6 w-6 text-blue-400 mx-auto mb-2" />
            <p className="text-sm text-white font-medium">Multi-Agent</p>
            <p className="text-xs text-white/50">7 specialized AI agents</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-white/5 border border-white/10">
            <Zap className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
            <p className="text-sm text-white font-medium">Quick Build</p>
            <p className="text-xs text-white/50">Apps in minutes</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-white/5 border border-white/10">
            <Shield className="h-6 w-6 text-green-400 mx-auto mb-2" />
            <p className="text-sm text-white font-medium">Subscription</p>
            <p className="text-xs text-white/50">Uses your Claude plan</p>
          </div>
        </div>
      </div>
    </div>
  );
}
