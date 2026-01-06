'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Bot,
  Code,
  TestTube,
  Shield,
  Wrench,
  Search,
  Loader2,
  Save,
  RotateCcw,
  Settings,
  Sliders,
  FileText,
  Zap,
  Users,
  AlertCircle,
  Check,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getHealthcareProductOwnerPrompt,
  getHealthcareCoderPrompt,
  getHealthcareTesterPrompt,
  getHealthcareSecurityPrompt,
  getHealthcareFixerPrompt,
  HealthcareSettings,
} from '@/lib/healthcare-agent-prompts';
import { Heart } from 'lucide-react';

// Types
interface AgentModeConfig {
  mode: 'default' | 'healthcare';
  healthcareSettings?: HealthcareSettings;
}

interface QuickSettings {
  minStories: number;
  maxStories: number;
  minEpics: number;
  maxEpics: number;
  parallelCoders: number;
  maxRetries: number;
  requireTests: boolean;
  minCoverage: number;
  parallelTesters: number;
  securityScanEnabled: boolean;
  blockOnCritical: boolean;
  defaultModel: 'opus' | 'sonnet' | 'haiku';
  maxTurnsPerAgent: number;
  verboseLogging: boolean;
}

interface AgentConfig {
  role: string;
  name: string;
  enabled: boolean;
  model: 'opus' | 'sonnet' | 'haiku';
  maxTurns: number;
  systemPrompt: string;
  customInstructions: string;
  temperature: number;
}

interface FullConfig {
  quickSettings: QuickSettings;
  agents: Record<string, AgentConfig>;
  updatedAt: string;
}

// Agent metadata for UI
const AGENT_META: Record<string, { icon: any; color: string; description: string }> = {
  product_owner: {
    icon: Users,
    color: 'text-orange-500',
    description: 'Creates epics and user stories from requirements',
  },
  coder: {
    icon: Code,
    color: 'text-blue-500',
    description: 'Implements features and writes application code',
  },
  tester: {
    icon: TestTube,
    color: 'text-green-500',
    description: 'Writes and runs tests for completed stories',
  },
  security: {
    icon: Shield,
    color: 'text-red-500',
    description: 'Scans code for security vulnerabilities',
  },
  fixer: {
    icon: Wrench,
    color: 'text-amber-500',
    description: 'Debugs and fixes errors in the project',
  },
  researcher: {
    icon: Search,
    color: 'text-cyan-500',
    description: 'Analyzes requirements and suggests improvements',
  },
};

// Helper function to get healthcare prompt for an agent role
function getHealthcarePromptForRole(role: string, settings: HealthcareSettings): string {
  switch (role) {
    case 'product_owner':
      return getHealthcareProductOwnerPrompt(settings);
    case 'coder':
      return getHealthcareCoderPrompt(settings);
    case 'tester':
      return getHealthcareTesterPrompt(settings);
    case 'security':
      return getHealthcareSecurityPrompt(settings);
    case 'fixer':
      return getHealthcareFixerPrompt(settings);
    default:
      return '';
  }
}

export default function AgentSettingsPage() {
  const [config, setConfig] = useState<FullConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('quick');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  // Agent mode state
  const [agentMode, setAgentMode] = useState<AgentModeConfig>({
    mode: 'default',
    healthcareSettings: {
      includeEpicAPIs: true,
      includeTestPatients: true,
      includeFHIRExamples: true,
      ehrPlatform: 'generic',
      complianceLevel: 'hipaa',
    },
  });

  useEffect(() => {
    loadConfig();
    loadAgentMode();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/agent-config');
      if (!response.ok) throw new Error('Failed to load configuration');
      const data = await response.json();
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const loadAgentMode = async () => {
    try {
      const response = await fetch('/api/config/agent-mode');
      if (response.ok) {
        const data = await response.json();
        setAgentMode({
          mode: data.mode || 'default',
          healthcareSettings: data.healthcareSettings || {
            includeEpicAPIs: true,
            includeTestPatients: true,
            includeFHIRExamples: true,
            ehrPlatform: 'generic',
            complianceLevel: 'hipaa',
          },
        });
      }
    } catch (err) {
      console.error('Failed to load agent mode:', err);
    }
  };

  const saveConfig = async () => {
    if (!config) return;

    try {
      setSaving(true);
      setError(null);

      const response = await fetch('/api/agent-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) throw new Error('Failed to save configuration');

      setSuccess('Configuration saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/agent-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });

      if (!response.ok) throw new Error('Failed to reset');

      const data = await response.json();
      setConfig(data.config);
      setResetDialogOpen(false);
      setSuccess('Reset to defaults successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset');
    } finally {
      setSaving(false);
    }
  };

  const updateQuickSetting = (key: keyof QuickSettings, value: any) => {
    if (!config) return;
    setConfig({
      ...config,
      quickSettings: { ...config.quickSettings, [key]: value },
    });
  };

  const updateAgentConfig = (role: string, key: keyof AgentConfig, value: any) => {
    if (!config) return;
    setConfig({
      ...config,
      agents: {
        ...config.agents,
        [role]: { ...config.agents[role], [key]: value },
      },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading agent configuration...</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-4 text-red-500" />
          <p className="text-red-500">Failed to load configuration</p>
          <Button onClick={loadConfig} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/settings">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </Link>
              <div className="h-6 w-px bg-border" />
              <Bot className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-xl font-bold">Agent Configuration</h1>
                <p className="text-sm text-muted-foreground">
                  Customize AI agent behavior and prompts
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResetDialogOpen(true)}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset All
              </Button>
              <Button onClick={saveConfig} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Status Messages */}
      {(error || success) && (
        <div className="max-w-6xl mx-auto px-4 pt-4">
          {error && (
            <Card className="border-red-500 bg-red-50 dark:bg-red-950/20 mb-4">
              <CardContent className="py-3">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              </CardContent>
            </Card>
          )}
          {success && (
            <Card className="border-green-500 bg-green-50 dark:bg-green-950/20 mb-4">
              <CardContent className="py-3">
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="h-4 w-4" />
                  <span>{success}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <main className="max-w-6xl mx-auto p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="quick" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Quick Settings
            </TabsTrigger>
            <TabsTrigger value="agents" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Agent Prompts
            </TabsTrigger>
          </TabsList>

          {/* Quick Settings Tab */}
          <TabsContent value="quick">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Story & Epic Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Story & Epic Limits
                  </CardTitle>
                  <CardDescription>
                    Control how many stories and epics the Product Owner creates
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Min Stories</label>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={config.quickSettings.minStories}
                        onChange={(e) => updateQuickSetting('minStories', parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Max Stories</label>
                      <Input
                        type="number"
                        min={1}
                        max={35}
                        value={config.quickSettings.maxStories}
                        onChange={(e) => updateQuickSetting('maxStories', parseInt(e.target.value) || 6)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Min Epics</label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={config.quickSettings.minEpics}
                        onChange={(e) => updateQuickSetting('minEpics', parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Max Epics</label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={config.quickSettings.maxEpics}
                        onChange={(e) => updateQuickSetting('maxEpics', parseInt(e.target.value) || 3)}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-start gap-1">
                    <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    More stories = more comprehensive but slower builds. Start with 3-6 for simple apps.
                  </p>
                </CardContent>
              </Card>

              {/* Coder Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    Coder Settings
                  </CardTitle>
                  <CardDescription>
                    Configure how the Coder agent implements features
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Parallel Coders</label>
                    <Select
                      value={config.quickSettings.parallelCoders.toString()}
                      onValueChange={(v) => updateQuickSetting('parallelCoders', parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 (Sequential)</SelectItem>
                        <SelectItem value="2">2 Parallel</SelectItem>
                        <SelectItem value="3">3 Parallel</SelectItem>
                        <SelectItem value="4">4 Parallel</SelectItem>
                        <SelectItem value="5">5 Parallel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Max Retries on Failure</label>
                    <Input
                      type="number"
                      min={0}
                      max={5}
                      value={config.quickSettings.maxRetries}
                      onChange={(e) => updateQuickSetting('maxRetries', parseInt(e.target.value) || 2)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Testing Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TestTube className="h-4 w-4" />
                    Testing Settings
                  </CardTitle>
                  <CardDescription>
                    Configure test requirements and parallel execution
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Require Tests</label>
                      <p className="text-xs text-muted-foreground">Run tests before marking stories done</p>
                    </div>
                    <Switch
                      checked={config.quickSettings.requireTests}
                      onCheckedChange={(v) => updateQuickSetting('requireTests', v)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Parallel Testing Agents</label>
                    <Select
                      value={(config.quickSettings.parallelTesters || 1).toString()}
                      onValueChange={(v) => updateQuickSetting('parallelTesters', parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 (Sequential)</SelectItem>
                        <SelectItem value="2">2 Parallel</SelectItem>
                        <SelectItem value="3">3 Parallel</SelectItem>
                        <SelectItem value="4">4 Parallel</SelectItem>
                        <SelectItem value="5">5 Parallel</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Run multiple test agents simultaneously for faster test execution
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Minimum Coverage %</label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={config.quickSettings.minCoverage}
                      onChange={(e) => updateQuickSetting('minCoverage', parseInt(e.target.value) || 0)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">0 = no coverage requirement</p>
                  </div>
                </CardContent>
              </Card>

              {/* Security Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Security Settings
                  </CardTitle>
                  <CardDescription>
                    Configure security scanning behavior
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Enable Security Scan</label>
                      <p className="text-xs text-muted-foreground">Run security agent on builds</p>
                    </div>
                    <Switch
                      checked={config.quickSettings.securityScanEnabled}
                      onCheckedChange={(v) => updateQuickSetting('securityScanEnabled', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Block on Critical</label>
                      <p className="text-xs text-muted-foreground">Fail build if critical issues found</p>
                    </div>
                    <Switch
                      checked={config.quickSettings.blockOnCritical}
                      onCheckedChange={(v) => updateQuickSetting('blockOnCritical', v)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Model Settings */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sliders className="h-4 w-4" />
                    Global Model Settings
                  </CardTitle>
                  <CardDescription>
                    Default settings applied to all agents (can be overridden per-agent)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium">Default Model</label>
                      <Select
                        value={config.quickSettings.defaultModel}
                        onValueChange={(v) => updateQuickSetting('defaultModel', v as any)}
                      >
                        <SelectTrigger>
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
                      <label className="text-sm font-medium">Max Turns per Agent</label>
                      <Input
                        type="number"
                        min={10}
                        max={200}
                        value={config.quickSettings.maxTurnsPerAgent}
                        onChange={(e) => updateQuickSetting('maxTurnsPerAgent', parseInt(e.target.value) || 50)}
                      />
                    </div>
                    <div className="flex items-end">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={config.quickSettings.verboseLogging}
                          onCheckedChange={(v) => updateQuickSetting('verboseLogging', v)}
                        />
                        <label className="text-sm font-medium">Verbose Logging</label>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Agent Prompts Tab */}
          <TabsContent value="agents">
            <div className="grid gap-4 md:grid-cols-3">
              {/* Agent List */}
              <div className="space-y-2">
                {Object.entries(config.agents).map(([role, agent]) => {
                  const meta = AGENT_META[role] || { icon: Bot, color: 'text-gray-500', description: '' };
                  const Icon = meta.icon;

                  return (
                    <Card
                      key={role}
                      className={cn(
                        'cursor-pointer transition-all hover:border-primary/50',
                        selectedAgent === role && 'border-primary bg-primary/5'
                      )}
                      onClick={() => setSelectedAgent(role)}
                    >
                      <CardContent className="py-3">
                        <div className="flex items-center gap-3">
                          <div className={cn('p-2 rounded-lg bg-muted', meta.color)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{agent.name}</span>
                              {!agent.enabled && (
                                <Badge variant="secondary" className="text-xs">Disabled</Badge>
                              )}
                              {agentMode.mode === 'healthcare' && getHealthcarePromptForRole(role, agentMode.healthcareSettings!) && (
                                <Heart className="h-3 w-3 text-green-500" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {agentMode.mode === 'healthcare' && getHealthcarePromptForRole(role, agentMode.healthcareSettings!)
                                ? 'Healthcare prompt active'
                                : meta.description}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Agent Editor */}
              <div className="md:col-span-2">
                {selectedAgent ? (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          {(() => {
                            const meta = AGENT_META[selectedAgent];
                            const Icon = meta?.icon || Bot;
                            return <Icon className={cn('h-5 w-5', meta?.color)} />;
                          })()}
                          {config.agents[selectedAgent].name}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Enabled</span>
                          <Switch
                            checked={config.agents[selectedAgent].enabled}
                            onCheckedChange={(v) => updateAgentConfig(selectedAgent, 'enabled', v)}
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Model & Settings */}
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="text-sm font-medium">Model</label>
                          <Select
                            value={config.agents[selectedAgent].model}
                            onValueChange={(v) => updateAgentConfig(selectedAgent, 'model', v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="haiku">Haiku</SelectItem>
                              <SelectItem value="sonnet">Sonnet</SelectItem>
                              <SelectItem value="opus">Opus</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Max Turns</label>
                          <Input
                            type="number"
                            min={10}
                            max={200}
                            value={config.agents[selectedAgent].maxTurns}
                            onChange={(e) => updateAgentConfig(selectedAgent, 'maxTurns', parseInt(e.target.value) || 50)}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Temperature</label>
                          <Input
                            type="number"
                            min={0}
                            max={1}
                            step={0.1}
                            value={config.agents[selectedAgent].temperature}
                            onChange={(e) => updateAgentConfig(selectedAgent, 'temperature', parseFloat(e.target.value) || 0.5)}
                          />
                        </div>
                      </div>

                      {/* System Prompt */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-sm font-medium">System Prompt</label>
                          {agentMode.mode === 'healthcare' && getHealthcarePromptForRole(selectedAgent, agentMode.healthcareSettings!) && (
                            <Badge className="bg-green-600 text-white text-xs">
                              <Heart className="h-3 w-3 mr-1" />
                              Healthcare Mode Active
                            </Badge>
                          )}
                        </div>

                        {/* Healthcare Mode Banner */}
                        {agentMode.mode === 'healthcare' && getHealthcarePromptForRole(selectedAgent, agentMode.healthcareSettings!) && (
                          <div className="mb-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                            <p className="text-sm text-green-700 dark:text-green-400 mb-2">
                              <strong>Healthcare mode is enabled.</strong> The prompt below shows the healthcare-specific version that will be used during builds.
                            </p>
                            <p className="text-xs text-muted-foreground">
                              To edit the default prompt, switch to Default mode in Settings → Agents.
                            </p>
                          </div>
                        )}

                        <Textarea
                          className="font-mono text-xs min-h-[200px]"
                          value={
                            agentMode.mode === 'healthcare' && getHealthcarePromptForRole(selectedAgent, agentMode.healthcareSettings!)
                              ? getHealthcarePromptForRole(selectedAgent, agentMode.healthcareSettings!)
                              : config.agents[selectedAgent].systemPrompt
                          }
                          onChange={(e) => {
                            // Only allow editing if in default mode
                            if (agentMode.mode === 'default' || !getHealthcarePromptForRole(selectedAgent, agentMode.healthcareSettings!)) {
                              updateAgentConfig(selectedAgent, 'systemPrompt', e.target.value);
                            }
                          }}
                          readOnly={agentMode.mode === 'healthcare' && !!getHealthcarePromptForRole(selectedAgent, agentMode.healthcareSettings!)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {agentMode.mode === 'healthcare' && getHealthcarePromptForRole(selectedAgent, agentMode.healthcareSettings!)
                            ? 'Healthcare prompts are read-only. Custom instructions below are still applied.'
                            : 'The base instructions for this agent. Be careful when modifying.'}
                        </p>
                      </div>

                      {/* Custom Instructions */}
                      <div>
                        <label className="text-sm font-medium">Custom Instructions (Optional)</label>
                        <Textarea
                          className="font-mono text-xs min-h-[100px]"
                          placeholder="Add custom instructions that will be appended to the system prompt..."
                          value={config.agents[selectedAgent].customInstructions}
                          onChange={(e) => updateAgentConfig(selectedAgent, 'customInstructions', e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Additional instructions appended to the system prompt. Safer than editing the base prompt.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <Bot className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p>Select an agent to edit its configuration</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Reset Confirmation Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <RotateCcw className="h-5 w-5" />
              Reset All Settings
            </DialogTitle>
            <DialogDescription>
              This will reset all agent configurations and quick settings to their defaults.
              Any customizations you've made will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={resetToDefaults} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Reset to Defaults
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
