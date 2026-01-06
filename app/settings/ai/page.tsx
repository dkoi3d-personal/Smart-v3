'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Brain,
  Sparkles,
  Server,
  Cloud,
  Cpu,
  Zap,
  Settings2,
  Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AIConfig, AIProvider, AIProviderStatus } from '@/lib/ai-config/types';

// Provider metadata
const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    icon: Sparkles,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    docsUrl: 'https://platform.openai.com/api-keys',
    description: 'GPT-4o, GPT-4 Turbo, GPT-3.5',
  },
  anthropic: {
    name: 'Anthropic',
    icon: Brain,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    docsUrl: 'https://console.anthropic.com/',
    description: 'Claude 3 Opus, Sonnet, Haiku',
  },
  groq: {
    name: 'Groq',
    icon: Zap,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    docsUrl: 'https://console.groq.com/',
    description: 'Fast inference - Llama, Mixtral',
  },
  openrouter: {
    name: 'OpenRouter',
    icon: Cloud,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    docsUrl: 'https://openrouter.ai/keys',
    description: 'Access multiple providers',
  },
  ollama: {
    name: 'Ollama',
    icon: Server,
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
    docsUrl: 'https://ollama.ai',
    description: 'Local LLMs - Llama, Mistral, Phi',
  },
  mlx: {
    name: 'MLX',
    icon: Cpu,
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/10',
    docsUrl: 'https://github.com/ml-explore/mlx',
    description: 'Apple Silicon optimized',
  },
};

export default function AISettingsPage() {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [providerStatus, setProviderStatus] = useState<Record<string, AIProviderStatus>>({});
  const [checkingProvider, setCheckingProvider] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [tempKeys, setTempKeys] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    provider: string;
    model?: string;
    response?: string;
    error?: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/ai-config');
      const data = await response.json();
      setConfig(data);
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;

    setSaving(true);
    try {
      // Merge temp keys into config
      const configToSave = {
        ...config,
        providers: {
          ...config.providers,
          ...Object.fromEntries(
            Object.entries(config.providers).map(([key, provider]) => [
              key,
              {
                ...provider,
                apiKey: tempKeys[key] || provider.apiKey,
              },
            ])
          ),
        },
      };

      await fetch('/api/ai-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configToSave),
      });

      setHasChanges(false);
      setTempKeys({});
      await loadConfig();
    } catch (error) {
      console.error('Failed to save config:', error);
    } finally {
      setSaving(false);
    }
  };

  const checkProvider = async (provider: string, apiKey?: string, baseUrl?: string) => {
    setCheckingProvider(provider);
    try {
      const response = await fetch('/api/ai-config/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: apiKey || tempKeys[provider],
          baseUrl,
        }),
      });
      const status = await response.json();
      setProviderStatus((prev) => ({ ...prev, [provider]: status }));
    } catch (error) {
      console.error('Failed to check provider:', error);
    } finally {
      setCheckingProvider(null);
    }
  };

  const updateProvider = (
    provider: keyof AIConfig['providers'],
    updates: Partial<AIConfig['providers'][typeof provider]>
  ) => {
    if (!config) return;
    setConfig({
      ...config,
      providers: {
        ...config.providers,
        [provider]: {
          ...config.providers[provider],
          ...updates,
        },
      },
    });
    setHasChanges(true);
  };

  const updateLocalLLM = (
    llm: 'ollama' | 'mlx',
    updates: Partial<AIConfig['localLLM']['ollama']>
  ) => {
    if (!config) return;
    setConfig({
      ...config,
      localLLM: {
        ...config.localLLM,
        [llm]: {
          ...config.localLLM[llm],
          ...updates,
        },
      },
    });
    setHasChanges(true);
  };

  const testAI = async (provider?: string) => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch('/api/ai-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      const result = await response.json();
      setTestResult(result);
    } catch {
      setTestResult({
        success: false,
        provider: provider || config?.defaultProvider || 'unknown',
        error: 'Failed to connect to test endpoint',
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Failed to load configuration</p>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">AI Configuration</h1>
            <p className="text-muted-foreground">
              Configure AI providers for built applications
            </p>
          </div>
        </div>
        <Button onClick={saveConfig} disabled={saving || !hasChanges}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>

      {/* Default Provider Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Default Provider
          </CardTitle>
          <CardDescription>
            The default AI provider for built applications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={config.defaultProvider}
            onValueChange={(value: AIProvider) => {
              setConfig({ ...config, defaultProvider: value });
              setHasChanges(true);
            }}
          >
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PROVIDERS).map(([key, meta]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <meta.icon className={cn('h-4 w-4', meta.color)} />
                    {meta.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Cloud Providers */}
      <h2 className="text-lg font-semibold mb-4">Cloud Providers</h2>
      <div className="grid gap-4 mb-8">
        {(['openai', 'anthropic', 'groq', 'openrouter'] as const).map((provider) => {
          const meta = PROVIDERS[provider];
          const providerConfig = config.providers[provider];
          const status = providerStatus[provider];

          return (
            <Card key={provider}>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-lg', meta.bgColor)}>
                      <meta.icon className={cn('h-5 w-5', meta.color)} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{meta.name}</CardTitle>
                      <CardDescription>{meta.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {status && (
                      <Badge variant={status.available ? 'default' : 'secondary'}>
                        {status.available ? (
                          <CheckCircle className="h-3 w-3 mr-1" />
                        ) : (
                          <AlertCircle className="h-3 w-3 mr-1" />
                        )}
                        {status.available ? 'Connected' : status.error || 'Not connected'}
                      </Badge>
                    )}
                    <Switch
                      checked={providerConfig.enabled}
                      onCheckedChange={(enabled) =>
                        updateProvider(provider, { enabled })
                      }
                    />
                  </div>
                </div>
              </CardHeader>
              {providerConfig.enabled && (
                <CardContent className="pt-0 space-y-4">
                  {/* Show if key is already saved */}
                  {'hasKey' in providerConfig && (providerConfig as { hasKey?: boolean }).hasKey && tempKeys[provider] === undefined ? (
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      API key is saved. Click the field to enter a new key.
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Input
                        type={showKeys[provider] ? 'text' : 'password'}
                        placeholder={`Paste your ${meta.name} API key here`}
                        value={tempKeys[provider] ?? ''}
                        onFocus={() => {
                          // Clear the placeholder dots when focusing
                          if (tempKeys[provider] === undefined) {
                            setTempKeys((prev) => ({ ...prev, [provider]: '' }));
                          }
                        }}
                        onChange={(e) => {
                          setTempKeys((prev) => ({
                            ...prev,
                            [provider]: e.target.value,
                          }));
                          setHasChanges(true);
                        }}
                        className="pr-10 font-mono text-sm"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          setShowKeys((prev) => ({
                            ...prev,
                            [provider]: !prev[provider],
                          }))
                        }
                      >
                        {showKeys[provider] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        // Pass the temp key only if user typed something, otherwise use saved key
                        const keyToTest = tempKeys[provider]?.trim() || undefined;
                        checkProvider(provider, keyToTest);
                      }}
                      disabled={checkingProvider === provider}
                    >
                      {checkingProvider === provider ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" asChild>
                      <a href={meta.docsUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>

                  {status?.available && status.models.length > 0 && (
                    <div>
                      <Label className="text-sm">Default Model</Label>
                      <Select
                        value={providerConfig.defaultModel}
                        onValueChange={(model) =>
                          updateProvider(provider, { defaultModel: model })
                        }
                      >
                        <SelectTrigger className="w-full mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {status.models.map((model) => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Local LLMs */}
      <h2 className="text-lg font-semibold mb-4">Local LLMs</h2>
      <div className="grid gap-4 mb-8">
        {/* Global Local LLM Settings */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Prefer Local LLMs</Label>
                <p className="text-sm text-muted-foreground">
                  Use local LLMs when available instead of cloud providers
                </p>
              </div>
              <Switch
                checked={config.localLLM.preferLocal}
                onCheckedChange={(preferLocal) => {
                  setConfig({
                    ...config,
                    localLLM: { ...config.localLLM, preferLocal },
                  });
                  setHasChanges(true);
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Ollama */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn('p-2 rounded-lg', PROVIDERS.ollama.bgColor)}>
                  <Server className={cn('h-5 w-5', PROVIDERS.ollama.color)} />
                </div>
                <div>
                  <CardTitle className="text-base">Ollama</CardTitle>
                  <CardDescription>Local LLM server for Windows/Mac/Linux</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {providerStatus.ollama && (
                  <Badge variant={providerStatus.ollama.available ? 'default' : 'secondary'}>
                    {providerStatus.ollama.available ? (
                      <CheckCircle className="h-3 w-3 mr-1" />
                    ) : (
                      <AlertCircle className="h-3 w-3 mr-1" />
                    )}
                    {providerStatus.ollama.available
                      ? `${providerStatus.ollama.models.length} models`
                      : 'Not running'}
                  </Badge>
                )}
                <Switch
                  checked={config.localLLM.ollama.enabled}
                  onCheckedChange={(enabled) => updateLocalLLM('ollama', { enabled })}
                />
              </div>
            </div>
          </CardHeader>
          {config.localLLM.ollama.enabled && (
            <CardContent className="pt-0 space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="http://localhost:11434"
                  value={config.localLLM.ollama.baseUrl}
                  onChange={(e) =>
                    updateLocalLLM('ollama', { baseUrl: e.target.value })
                  }
                />
                <Button
                  variant="outline"
                  onClick={() =>
                    checkProvider('ollama', undefined, config.localLLM.ollama.baseUrl)
                  }
                  disabled={checkingProvider === 'ollama'}
                >
                  {checkingProvider === 'ollama' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
                <Button variant="ghost" size="icon" asChild>
                  <a href={PROVIDERS.ollama.docsUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>

              {providerStatus.ollama?.available && providerStatus.ollama.models.length > 0 && (
                <div>
                  <Label className="text-sm">Default Model</Label>
                  <Select
                    value={config.localLLM.ollama.defaultModel}
                    onValueChange={(model) =>
                      updateLocalLLM('ollama', { defaultModel: model })
                    }
                  >
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {providerStatus.ollama.models.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {providerStatus.ollama && !providerStatus.ollama.available && (
                <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                  <p className="font-medium mb-1">Ollama not detected</p>
                  <p>
                    Install Ollama from{' '}
                    <a
                      href="https://ollama.ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      ollama.ai
                    </a>
                    , then run: <code className="bg-background px-1 rounded">ollama pull llama3.2</code>
                  </p>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* MLX (macOS only) */}
        {process.platform === 'darwin' && (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg', PROVIDERS.mlx.bgColor)}>
                    <Cpu className={cn('h-5 w-5', PROVIDERS.mlx.color)} />
                  </div>
                  <div>
                    <CardTitle className="text-base">MLX</CardTitle>
                    <CardDescription>Apple Silicon optimized inference</CardDescription>
                  </div>
                </div>
                <Switch
                  checked={config.localLLM.mlx.enabled}
                  onCheckedChange={(enabled) => updateLocalLLM('mlx', { enabled })}
                />
              </div>
            </CardHeader>
            {config.localLLM.mlx.enabled && (
              <CardContent className="pt-0 space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="http://localhost:8080"
                    value={config.localLLM.mlx.baseUrl}
                    onChange={(e) =>
                      updateLocalLLM('mlx', { baseUrl: e.target.value })
                    }
                  />
                  <Button
                    variant="outline"
                    onClick={() =>
                      checkProvider('mlx', undefined, config.localLLM.mlx.baseUrl)
                    }
                    disabled={checkingProvider === 'mlx'}
                  >
                    {checkingProvider === 'mlx' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        )}
      </div>

      {/* Built App Settings */}
      <h2 className="text-lg font-semibold mb-4">Built App Settings</h2>
      <Card className="mb-8">
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Include .env.example</Label>
              <p className="text-sm text-muted-foreground">
                Generate .env.example with API key placeholders
              </p>
            </div>
            <Switch
              checked={config.builtAppSettings.includeEnvExample}
              onCheckedChange={(includeEnvExample) => {
                setConfig({
                  ...config,
                  builtAppSettings: {
                    ...config.builtAppSettings,
                    includeEnvExample,
                  },
                });
                setHasChanges(true);
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Include AI Service Wrapper</Label>
              <p className="text-sm text-muted-foreground">
                Add error handling, retries, and fallback logic
              </p>
            </div>
            <Switch
              checked={config.builtAppSettings.includeServiceWrapper}
              onCheckedChange={(includeServiceWrapper) => {
                setConfig({
                  ...config,
                  builtAppSettings: {
                    ...config.builtAppSettings,
                    includeServiceWrapper,
                  },
                });
                setHasChanges(true);
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Include Local LLM Fallback</Label>
              <p className="text-sm text-muted-foreground">
                Fall back to Ollama if cloud provider fails
              </p>
            </div>
            <Switch
              checked={config.builtAppSettings.includeLocalFallback}
              onCheckedChange={(includeLocalFallback) => {
                setConfig({
                  ...config,
                  builtAppSettings: {
                    ...config.builtAppSettings,
                    includeLocalFallback,
                  },
                });
                setHasChanges(true);
              }}
            />
          </div>

          <div>
            <Label className="text-base">API Key Injection</Label>
            <p className="text-sm text-muted-foreground mb-2">
              How to handle API keys in built applications
            </p>
            <Select
              value={config.builtAppSettings.injectProvider}
              onValueChange={(value: 'configured' | 'placeholder' | 'none') => {
                setConfig({
                  ...config,
                  builtAppSettings: {
                    ...config.builtAppSettings,
                    injectProvider: value,
                  },
                });
                setHasChanges(true);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="placeholder">
                  Placeholder (client adds their own keys)
                </SelectItem>
                <SelectItem value="configured">
                  Use configured keys (inject your keys)
                </SelectItem>
                <SelectItem value="none">
                  None (no AI setup in built app)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Test AI */}
      <h2 className="text-lg font-semibold mb-4">Test AI</h2>
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Label className="text-base">Test AI Generation</Label>
              <p className="text-sm text-muted-foreground">
                Send a test request to verify your AI provider works
              </p>
            </div>
            <div className="flex gap-2">
              <Select
                defaultValue={config.defaultProvider}
                onValueChange={(provider) => testAI(provider)}
                disabled={testing}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROVIDERS).map(([key, meta]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <meta.icon className={cn('h-4 w-4', meta.color)} />
                        {meta.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => testAI()}
                disabled={testing}
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Test Default
              </Button>
            </div>
          </div>

          {testResult && (
            <div
              className={cn(
                'p-4 rounded-lg border',
                testResult.success
                  ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
                  : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
              )}
            >
              <div className="flex items-start gap-3">
                {testResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="font-medium">
                    {testResult.success ? 'AI is working!' : 'Test failed'}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Provider: {testResult.provider}
                    {testResult.model && ` (${testResult.model})`}
                  </div>
                  {testResult.response && (
                    <div className="mt-2 p-2 bg-background rounded text-sm font-mono">
                      {testResult.response}
                    </div>
                  )}
                  {testResult.error && (
                    <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                      {testResult.error}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
