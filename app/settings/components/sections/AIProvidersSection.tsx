'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Bot,
  Sparkles,
  Loader2,
  RefreshCw,
  ExternalLink,
  Check,
  Star,
  Eye,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LlmModel {
  id: string;
  name: string;
  contextWindow: number;
  supportsVision?: boolean;
  supportsTools?: boolean;
}

interface LlmProvider {
  id: string;
  name: string;
  type: string;
  baseUrl?: string;
  apiKeyEnvVar?: string;
  models: LlmModel[];
  capabilities: string[];
  useCases: string[];
  enabled: boolean;
  isDefault?: boolean;
}

export function AIProvidersSection() {
  const [providers, setProviders] = useState<LlmProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/services/catalog');
      if (!response.ok) throw new Error('Failed to load providers');
      const data = await response.json();
      setProviders(data.llmProviders || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const toggleProvider = async (id: string, enabled: boolean) => {
    try {
      await fetch('/api/services/catalog', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'llm', id, enabled }),
      });
      await loadProviders();
    } catch (err) {
      console.error('Failed to toggle provider:', err);
    }
  };

  const setDefault = async (id: string) => {
    try {
      await fetch('/api/services/catalog', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'llm', id, isDefault: true }),
      });
      await loadProviders();
    } catch (err) {
      console.error('Failed to set default:', err);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'anthropic':
        return 'bg-orange-100 text-orange-600 dark:bg-orange-900/30';
      case 'openai':
        return 'bg-green-100 text-green-600 dark:bg-green-900/30';
      case 'ollama':
        return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30';
      case 'groq':
        return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30';
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-900/30';
    }
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
          <h2 className="text-2xl font-bold">AI Providers</h2>
          <p className="text-muted-foreground">
            Configure LLM providers for built applications
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadProviders}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Info Card */}
      <Card className="border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                AI Providers for Built Apps
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                These providers are available for applications you build. The system
                automatically routes to the optimal provider based on the task.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Providers Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {providers.map((provider) => (
          <Card
            key={provider.id}
            className={cn(
              'transition-colors',
              provider.enabled ? 'border-green-500/50' : 'border-border opacity-75'
            )}
          >
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2.5 rounded-lg', getTypeColor(provider.type))}>
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{provider.name}</h3>
                      {provider.isDefault && (
                        <Badge className="bg-primary text-xs">
                          <Star className="h-3 w-3 mr-1" />
                          Default
                        </Badge>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs mt-1">
                      {provider.type}
                    </Badge>
                  </div>
                </div>
                <Switch
                  checked={provider.enabled}
                  onCheckedChange={(checked) => toggleProvider(provider.id, checked)}
                />
              </div>

              {/* Capabilities */}
              <div className="flex flex-wrap gap-1 mb-3">
                {provider.capabilities.map((cap) => (
                  <Badge key={cap} variant="secondary" className="text-xs">
                    {cap}
                  </Badge>
                ))}
              </div>

              {/* Models */}
              <div className="space-y-1 mb-3">
                <p className="text-xs text-muted-foreground">Models:</p>
                <div className="flex flex-wrap gap-2">
                  {provider.models.slice(0, 3).map((model) => (
                    <div
                      key={model.id}
                      className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded"
                    >
                      <span>{model.name}</span>
                      {model.supportsVision && <Eye className="h-3 w-3 text-blue-400" />}
                      {model.supportsTools && <Zap className="h-3 w-3 text-yellow-400" />}
                    </div>
                  ))}
                  {provider.models.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{provider.models.length - 3} more
                    </span>
                  )}
                </div>
              </div>

              {/* Use Cases */}
              <p className="text-xs text-muted-foreground">
                Best for: {provider.useCases.join(', ')}
              </p>

              {/* Actions */}
              {provider.enabled && !provider.isDefault && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setDefault(provider.id)}
                >
                  Set as Default
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Manage All Link */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Full Provider Management</h4>
              <p className="text-sm text-muted-foreground">
                Add, edit, or remove AI providers in the Service Catalog
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => (window.location.href = '/settings/services')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Service Catalog
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
