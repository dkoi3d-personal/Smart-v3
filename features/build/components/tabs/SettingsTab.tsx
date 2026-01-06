'use client';

import { useState, useEffect, useRef } from 'react';
import {
  GitBranch,
  Zap,
  FileText,
  TestTube,
  Shield,
  Sliders,
  Paintbrush,
  Key,
  Bot,
  AlertCircle,
  Info,
  Loader2,
  ExternalLink,
  Check,
  Upload,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DesignSystemSelector } from '@/components/design-system/DesignSystemSelector';
import type { QuickSettings } from '../../types';

interface SettingsTabProps {
  projectId: string;
  projectName: string;
  gitRepoUrl: string;
  gitBranch: string;
  isCloningRepo: boolean;
  gitCloneError: string | null;
  quickSettings: QuickSettings;
  onGitRepoUrlChange: (url: string) => void;
  onGitBranchChange: (branch: string) => void;
  onIsCloningChange: (isCloning: boolean) => void;
  onQuickSettingsChange: (settings: QuickSettings) => void;
  onGitCloneErrorChange: (error: string | null) => void;
}

export function SettingsTab({
  projectId,
  projectName,
  gitRepoUrl,
  gitBranch,
  isCloningRepo,
  gitCloneError,
  quickSettings,
  onGitRepoUrlChange,
  onGitBranchChange,
  onIsCloningChange,
  onQuickSettingsChange,
  onGitCloneErrorChange,
}: SettingsTabProps) {
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  // Git push state
  const [isPushing, setIsPushing] = useState(false);
  const [pushLogs, setPushLogs] = useState<string[]>([]);
  const [pushError, setPushError] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [showPushLogs, setShowPushLogs] = useState(false);
  const [gitStatus, setGitStatus] = useState<{
    hasChanges: boolean;
    changes: string[];
    branch: string;
    remoteUrl: string;
    lastCommit: string | null;
  } | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const pushLogsRef = useRef<HTMLDivElement>(null);

  // Check git status when component mounts or gitRepoUrl changes
  useEffect(() => {
    const checkGitStatus = async () => {
      if (!projectId) return;
      setIsCheckingStatus(true);
      try {
        const response = await fetch(`/api/git/push?projectId=${projectId}`);
        if (response.ok) {
          const data = await response.json();
          setGitStatus(data);
        }
      } catch (err) {
        console.error('Failed to check git status:', err);
      } finally {
        setIsCheckingStatus(false);
      }
    };
    checkGitStatus();
  }, [projectId, gitRepoUrl]);

  // Auto-scroll push logs
  useEffect(() => {
    if (pushLogsRef.current) {
      pushLogsRef.current.scrollTop = pushLogsRef.current.scrollHeight;
    }
  }, [pushLogs]);

  const handlePush = async () => {
    setIsPushing(true);
    setPushError(null);
    setPushLogs([]);
    setShowPushLogs(true);

    try {
      const response = await fetch('/api/git/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          commitMessage: commitMessage || `Build update from AI Platform`,
          branch: gitBranch || 'main',
        }),
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.log) {
                setPushLogs((prev) => [...prev, data.log]);
              }
              if (data.status === 'complete') {
                setSettingsSuccess('Successfully pushed to GitHub!');
                setTimeout(() => setSettingsSuccess(null), 3000);
                // Refresh git status
                const statusRes = await fetch(`/api/git/push?projectId=${projectId}`);
                if (statusRes.ok) {
                  setGitStatus(await statusRes.json());
                }
              }
              if (data.status === 'error') {
                setPushError(data.error || 'Push failed');
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      setPushError(err instanceof Error ? err.message : 'Push failed');
      setPushLogs((prev) => [...prev, `❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`]);
    } finally {
      setIsPushing(false);
    }
  };

  const refreshGitStatus = async () => {
    setIsCheckingStatus(true);
    try {
      const response = await fetch(`/api/git/push?projectId=${projectId}`);
      if (response.ok) {
        setGitStatus(await response.json());
      }
    } catch (err) {
      console.error('Failed to refresh git status:', err);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleClone = async () => {
    if (!gitRepoUrl) return;
    onIsCloningChange(true);
    onGitCloneErrorChange(null);
    try {
      const response = await fetch('/api/git/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl: gitRepoUrl,
          branch: gitBranch,
          projectName: projectName || projectId,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to clone repository');
      }
      setSettingsSuccess('Repository cloned successfully!');
      setTimeout(() => setSettingsSuccess(null), 3000);
    } catch (err) {
      onGitCloneErrorChange(err instanceof Error ? err.message : 'Clone failed');
    } finally {
      onIsCloningChange(false);
    }
  };

  const updateQuickSetting = <K extends keyof QuickSettings>(
    key: K,
    value: QuickSettings[K]
  ) => {
    onQuickSettingsChange({ ...quickSettings, [key]: value });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-6">
      {/* Git Repository Configuration */}
      <Card className="border-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-orange-500" />
            Git Repository
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm font-medium">Repository URL</label>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="https://github.com/username/repo.git"
                  value={gitRepoUrl}
                  onChange={(e) => {
                    onGitRepoUrlChange(e.target.value);
                    onGitCloneErrorChange(null);
                  }}
                  className="flex-1"
                />
                <Button
                  onClick={handleClone}
                  disabled={!gitRepoUrl || isCloningRepo}
                >
                  {isCloningRepo ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <GitBranch className="h-4 w-4" />
                  )}
                  <span className="ml-2">Clone</span>
                </Button>
              </div>
              {gitCloneError && (
                <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {gitCloneError}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Branch</label>
              <Input
                placeholder="main"
                value={gitBranch}
                onChange={(e) => onGitBranchChange(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Git Status & Push Section */}
          {gitStatus && (
            <div className="border-t pt-4 mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Upload className="h-4 w-4 text-green-500" />
                  Push to GitHub
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refreshGitStatus}
                  disabled={isCheckingStatus}
                >
                  <RefreshCw className={`h-3 w-3 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {/* Status Info */}
              <div className="text-xs space-y-1 bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Branch:</span>
                  <span className="font-mono">{gitStatus.branch || 'main'}</span>
                </div>
                {gitStatus.remoteUrl && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Remote:</span>
                    <span className="font-mono truncate max-w-[300px]">{gitStatus.remoteUrl}</span>
                  </div>
                )}
                {gitStatus.lastCommit && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Last commit:</span>
                    <span className="font-mono truncate max-w-[300px]">{gitStatus.lastCommit}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Status:</span>
                  {gitStatus.hasChanges ? (
                    <span className="text-amber-500">{gitStatus.changes.length} uncommitted changes</span>
                  ) : (
                    <span className="text-green-500">No uncommitted changes</span>
                  )}
                </div>
              </div>

              {/* Commit Message & Push Button */}
              <div className="flex gap-2">
                <Input
                  placeholder="Commit message (optional)"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  className="flex-1"
                  disabled={isPushing}
                />
                <Button
                  onClick={handlePush}
                  disabled={isPushing || !gitStatus.remoteUrl}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isPushing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  <span className="ml-2">Push</span>
                </Button>
              </div>

              {/* Push Error */}
              {pushError && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {pushError}
                </p>
              )}

              {/* Push Logs */}
              {pushLogs.length > 0 && (
                <div className="space-y-2">
                  <button
                    onClick={() => setShowPushLogs(!showPushLogs)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {showPushLogs ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {showPushLogs ? 'Hide' : 'Show'} push logs ({pushLogs.length} lines)
                  </button>
                  {showPushLogs && (
                    <div
                      ref={pushLogsRef}
                      className="bg-black/90 rounded-lg p-3 font-mono text-xs text-green-400 max-h-48 overflow-y-auto"
                    >
                      {pushLogs.map((log, i) => (
                        <div key={i} className="whitespace-pre-wrap">{log}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* No remote configured message */}
          {gitStatus && !gitStatus.remoteUrl && (
            <p className="text-xs text-amber-500 flex items-start gap-1">
              <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              No remote configured. Clone a repository or add a remote to enable push.
            </p>
          )}

          <p className="text-xs text-muted-foreground flex items-start gap-1">
            <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
            Clone an existing repository to use as the base for this project. Make sure you have the necessary credentials configured in Settings.
          </p>
        </CardContent>
      </Card>

      {/* Quick Settings */}
      <Card className="border-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            Build Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Story & Epic Limits */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Story & Epic Limits
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Min Stories</label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={quickSettings.minStories}
                    onChange={(e) => updateQuickSetting('minStories', parseInt(e.target.value) || 1)}
                    className="h-8 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Max Stories</label>
                  <Input
                    type="number"
                    min={1}
                    max={35}
                    value={quickSettings.maxStories}
                    onChange={(e) => updateQuickSetting('maxStories', parseInt(e.target.value) || 6)}
                    className="h-8 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Min Epics</label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={quickSettings.minEpics}
                    onChange={(e) => updateQuickSetting('minEpics', parseInt(e.target.value) || 1)}
                    className="h-8 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Max Epics</label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={quickSettings.maxEpics}
                    onChange={(e) => updateQuickSetting('maxEpics', parseInt(e.target.value) || 3)}
                    className="h-8 mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Testing Settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <TestTube className="h-4 w-4" />
                Testing
              </h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm">Require Tests</label>
                    <p className="text-xs text-muted-foreground">Run tests before marking done</p>
                  </div>
                  <Switch
                    checked={quickSettings.requireTests}
                    onCheckedChange={(v: boolean) => updateQuickSetting('requireTests', v)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Min Coverage %</label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={quickSettings.minCoverage}
                    onChange={(e) => updateQuickSetting('minCoverage', parseInt(e.target.value) || 0)}
                    className="h-8 mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Security Settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Security
              </h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm">Security Scan</label>
                    <p className="text-xs text-muted-foreground">Run security agent</p>
                  </div>
                  <Switch
                    checked={quickSettings.securityScanEnabled}
                    onCheckedChange={(v: boolean) => updateQuickSetting('securityScanEnabled', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm">Block on Critical</label>
                    <p className="text-xs text-muted-foreground">Fail on critical issues</p>
                  </div>
                  <Switch
                    checked={quickSettings.blockOnCritical}
                    onCheckedChange={(v: boolean) => updateQuickSetting('blockOnCritical', v)}
                  />
                </div>
              </div>
            </div>

            {/* Model Settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Sliders className="h-4 w-4" />
                Model
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Default Model</label>
                  <Select
                    value={quickSettings.defaultModel}
                    onValueChange={(v) => updateQuickSetting('defaultModel', v as 'opus' | 'sonnet' | 'haiku')}
                  >
                    <SelectTrigger className="h-8 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="haiku">Haiku (Fast)</SelectItem>
                      <SelectItem value="sonnet">Sonnet (Balanced)</SelectItem>
                      <SelectItem value="opus">Opus (Powerful)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Max Turns</label>
                  <Input
                    type="number"
                    min={10}
                    max={200}
                    value={quickSettings.maxTurnsPerAgent}
                    onChange={(e) => updateQuickSetting('maxTurnsPerAgent', parseInt(e.target.value) || 50)}
                    className="h-8 mt-1"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Design System */}
      <Card className="border-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Paintbrush className="h-4 w-4 text-pink-500" />
            Design System
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DesignSystemSelector
            projectId={projectId}
            showLabel={false}
          />
        </CardContent>
      </Card>

      {/* API Keys Link */}
      <Card className="border-2 hover:border-primary/50 transition-all cursor-pointer" onClick={() => window.open('/settings', '_blank')}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Key className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-medium">API Keys & Credentials</h3>
                <p className="text-sm text-muted-foreground">
                  Manage GitHub, AWS, and AI provider credentials
                </p>
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      {/* Agent Configuration Link */}
      <Card className="border-2 hover:border-primary/50 transition-all cursor-pointer" onClick={() => window.open('/settings/agents', '_blank')}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Bot className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-medium">Agent Configuration</h3>
                <p className="text-sm text-muted-foreground">
                  Customize AI agent prompts and behavior
                </p>
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      {/* Success message */}
      {settingsSuccess && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <Check className="h-4 w-4" />
          {settingsSuccess}
        </div>
      )}
    </div>
  );
}
