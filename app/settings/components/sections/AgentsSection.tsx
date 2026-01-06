'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Bot,
  Code,
  TestTube,
  Shield,
  Wrench,
  Search,
  Users,
  Loader2,
  Save,
  RotateCcw,
  Zap,
  FileText,
  Heart,
  Check,
  AlertCircle,
  Info,
  Settings,
} from 'lucide-react';
import { useSettings } from '../SettingsContext';
import { cn } from '@/lib/utils';

// Types
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
};

export function AgentsSection() {
  const { agentMode, healthcareSettings, agentModeLoading, saveAgentMode } = useSettings();

  const [config, setConfig] = useState<FullConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'mode' | 'quick' | 'prompts'>('mode');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  useEffect(() => {
    loadConfig();
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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Agent Settings</h2>
          <p className="text-muted-foreground">Configure AI agent behavior and prompts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setResetDialogOpen(true)}>
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

      {/* Status Messages */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 text-green-600 flex items-center gap-2">
          <Check className="h-4 w-4" />
          {success}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={activeTab === 'mode' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('mode')}
        >
          <Heart className="h-4 w-4 mr-2" />
          Agent Mode
        </Button>
        <Button
          variant={activeTab === 'quick' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('quick')}
        >
          <Zap className="h-4 w-4 mr-2" />
          Quick Settings
        </Button>
        <Button
          variant={activeTab === 'prompts' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('prompts')}
        >
          <Bot className="h-4 w-4 mr-2" />
          Agent Prompts
        </Button>
      </div>

      {/* Agent Mode Tab */}
      {activeTab === 'mode' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Agent Mode
              </CardTitle>
              <CardDescription>
                Choose between default general-purpose mode or specialized healthcare mode
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <button
                  onClick={() => saveAgentMode('default')}
                  className={cn(
                    'p-4 rounded-lg border-2 text-left transition-colors',
                    agentMode === 'default'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Bot className="h-5 w-5 text-primary" />
                    <span className="font-medium">Default Mode</span>
                    {agentMode === 'default' && (
                      <Badge className="bg-primary">Active</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    General-purpose AI agents for building any type of application
                  </p>
                </button>

                <button
                  onClick={() => saveAgentMode('healthcare', healthcareSettings)}
                  className={cn(
                    'p-4 rounded-lg border-2 text-left transition-colors',
                    agentMode === 'healthcare'
                      ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                      : 'border-border hover:border-red-500/50'
                  )}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Heart className="h-5 w-5 text-red-500" />
                    <span className="font-medium">Healthcare Mode</span>
                    {agentMode === 'healthcare' && (
                      <Badge className="bg-red-500">Active</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    HIPAA-aware agents with FHIR, Epic API, and compliance knowledge
                  </p>
                </button>
              </div>

              {agentMode === 'healthcare' && (
                <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                  <h4 className="font-medium text-sm">Healthcare Settings</h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="flex items-center justify-between">
                      <Label>Include Epic APIs</Label>
                      <Switch
                        checked={healthcareSettings.includeEpicAPIs}
                        onCheckedChange={(checked) =>
                          saveAgentMode('healthcare', {
                            ...healthcareSettings,
                            includeEpicAPIs: checked,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Include Test Patients</Label>
                      <Switch
                        checked={healthcareSettings.includeTestPatients}
                        onCheckedChange={(checked) =>
                          saveAgentMode('healthcare', {
                            ...healthcareSettings,
                            includeTestPatients: checked,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Include FHIR Examples</Label>
                      <Switch
                        checked={healthcareSettings.includeFHIRExamples}
                        onCheckedChange={(checked) =>
                          saveAgentMode('healthcare', {
                            ...healthcareSettings,
                            includeFHIRExamples: checked,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>EHR Platform</Label>
                      <Select
                        value={healthcareSettings.ehrPlatform}
                        onValueChange={(value: any) =>
                          saveAgentMode('healthcare', {
                            ...healthcareSettings,
                            ehrPlatform: value,
                          })
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="generic">Generic FHIR</SelectItem>
                          <SelectItem value="epic">Epic</SelectItem>
                          <SelectItem value="cerner">Cerner</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Settings Tab */}
      {activeTab === 'quick' && config && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Story & Epic Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Story & Epic Limits
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Min Stories</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={config.quickSettings.minStories}
                    onChange={(e) =>
                      updateQuickSetting('minStories', parseInt(e.target.value) || 1)
                    }
                  />
                </div>
                <div>
                  <Label>Max Stories</Label>
                  <Input
                    type="number"
                    min={1}
                    max={35}
                    value={config.quickSettings.maxStories}
                    onChange={(e) =>
                      updateQuickSetting('maxStories', parseInt(e.target.value) || 6)
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Min Epics</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={config.quickSettings.minEpics}
                    onChange={(e) =>
                      updateQuickSetting('minEpics', parseInt(e.target.value) || 1)
                    }
                  />
                </div>
                <div>
                  <Label>Max Epics</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={config.quickSettings.maxEpics}
                    onChange={(e) =>
                      updateQuickSetting('maxEpics', parseInt(e.target.value) || 3)
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Coder Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Code className="h-4 w-4" />
                Coder Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Parallel Coders</Label>
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
                <Label>Max Retries on Failure</Label>
                <Input
                  type="number"
                  min={0}
                  max={5}
                  value={config.quickSettings.maxRetries}
                  onChange={(e) =>
                    updateQuickSetting('maxRetries', parseInt(e.target.value) || 2)
                  }
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
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Require Tests</Label>
                <Switch
                  checked={config.quickSettings.requireTests}
                  onCheckedChange={(checked) => updateQuickSetting('requireTests', checked)}
                />
              </div>
              <div>
                <Label>Parallel Testers</Label>
                <Select
                  value={config.quickSettings.parallelTesters.toString()}
                  onValueChange={(v) => updateQuickSetting('parallelTesters', parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 (Sequential)</SelectItem>
                    <SelectItem value="2">2 Parallel</SelectItem>
                    <SelectItem value="3">3 Parallel</SelectItem>
                  </SelectContent>
                </Select>
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
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Security Scan Enabled</Label>
                <Switch
                  checked={config.quickSettings.securityScanEnabled}
                  onCheckedChange={(checked) =>
                    updateQuickSetting('securityScanEnabled', checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Block on Critical Issues</Label>
                <Switch
                  checked={config.quickSettings.blockOnCritical}
                  onCheckedChange={(checked) =>
                    updateQuickSetting('blockOnCritical', checked)
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Agent Prompts Tab */}
      {activeTab === 'prompts' && config && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Click on an agent to view and edit its system prompt and configuration.
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(config.agents).map(([role, agent]) => {
              const meta = AGENT_META[role];
              if (!meta) return null;
              const Icon = meta.icon;
              return (
                <Card
                  key={role}
                  className={cn(
                    'cursor-pointer transition-colors hover:border-primary/50',
                    selectedAgent === role && 'border-primary'
                  )}
                  onClick={() => setSelectedAgent(selectedAgent === role ? null : role)}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={cn('p-2 rounded-lg bg-muted', meta.color)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-medium">{agent.name}</h4>
                        <p className="text-xs text-muted-foreground">{meta.description}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Badge variant="outline" className="text-xs">
                        {agent.model}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {agent.maxTurns} turns
                      </Badge>
                      <Badge
                        variant={agent.enabled ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {agent.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Agent Detail Panel */}
          {selectedAgent && config.agents[selectedAgent] && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg">
                  Edit {config.agents[selectedAgent].name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label>Model</Label>
                    <Select
                      value={config.agents[selectedAgent].model}
                      onValueChange={(v: any) =>
                        updateAgentConfig(selectedAgent, 'model', v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="opus">Opus (Most Capable)</SelectItem>
                        <SelectItem value="sonnet">Sonnet (Balanced)</SelectItem>
                        <SelectItem value="haiku">Haiku (Fastest)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Max Turns</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={config.agents[selectedAgent].maxTurns}
                      onChange={(e) =>
                        updateAgentConfig(
                          selectedAgent,
                          'maxTurns',
                          parseInt(e.target.value) || 20
                        )
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Switch
                      checked={config.agents[selectedAgent].enabled}
                      onCheckedChange={(checked) =>
                        updateAgentConfig(selectedAgent, 'enabled', checked)
                      }
                    />
                    <Label>Enabled</Label>
                  </div>
                </div>
                <div>
                  <Label>Custom Instructions</Label>
                  <Textarea
                    value={config.agents[selectedAgent].customInstructions}
                    onChange={(e) =>
                      updateAgentConfig(selectedAgent, 'customInstructions', e.target.value)
                    }
                    placeholder="Add custom instructions for this agent..."
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Reset Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset to Defaults</DialogTitle>
            <DialogDescription>
              This will reset all agent settings to their default values. This action cannot
              be undone.
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
              Reset All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
