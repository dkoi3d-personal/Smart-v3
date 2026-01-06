'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Paintbrush,
  Database,
  Server,
  ExternalLink,
  Loader2,
  RefreshCw,
  Plus,
  ArrowRight,
  Check,
  Palette,
  Table,
  Cloud,
  Bot,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// DESIGN SYSTEMS SECTION
// ============================================================================

interface DesignSystem {
  id: string;
  name: string;
  description: string;
  colorScheme: any;
  createdAt: string;
  isDefault?: boolean;
}

export function DesignSystemsSection() {
  const [systems, setSystems] = useState<DesignSystem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSystems();
  }, []);

  const loadSystems = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/design-systems');
      if (response.ok) {
        const data = await response.json();
        setSystems(data.systems || []);
      }
    } catch (err) {
      console.error('Failed to load design systems:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Design Systems</h2>
          <p className="text-muted-foreground">
            Manage color schemes and design tokens for builds
          </p>
        </div>
        <Button onClick={() => (window.location.href = '/settings/design-systems')}>
          <Paintbrush className="h-4 w-4 mr-2" />
          Manage Systems
        </Button>
      </div>

      {/* Current Systems */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {systems.slice(0, 6).map((system) => (
            <Card key={system.id} className={system.isDefault ? 'border-primary' : ''}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Palette className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">{system.name}</h4>
                      {system.isDefault && (
                        <Badge variant="outline" className="text-xs">
                          Default
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {system.description || 'No description'}
                </p>
                {/* Color Preview */}
                {system.colorScheme && (
                  <div className="flex gap-1 mt-3">
                    {Object.entries(system.colorScheme)
                      .slice(0, 5)
                      .map(([key, value]) => (
                        <div
                          key={key}
                          className="w-6 h-6 rounded-full border"
                          style={{ backgroundColor: value as string }}
                          title={key}
                        />
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Add New Card */}
          <Card className="border-dashed">
            <CardContent className="pt-6 flex flex-col items-center justify-center min-h-[120px]">
              <Button
                variant="ghost"
                onClick={() => (window.location.href = '/settings/design-systems')}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Design System
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// DATABASE SECTION
// ============================================================================

interface DatabaseSchema {
  id: string;
  name: string;
  tables: number;
  createdAt: string;
}

export function DatabaseSection() {
  const [schemas, setSchemas] = useState<DatabaseSchema[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchemas();
  }, []);

  const loadSchemas = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/database/schemas');
      if (response.ok) {
        const data = await response.json();
        setSchemas(data.schemas || []);
      }
    } catch (err) {
      console.error('Failed to load schemas:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Database Schemas</h2>
          <p className="text-muted-foreground">
            Pre-defined database schemas for common use cases
          </p>
        </div>
        <Button onClick={() => (window.location.href = '/settings/database')}>
          <Database className="h-4 w-4 mr-2" />
          Manage Schemas
        </Button>
      </div>

      {/* Current Schemas */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : schemas.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {schemas.slice(0, 6).map((schema) => (
            <Card key={schema.id}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                    <Table className="h-4 w-4 text-orange-600" />
                  </div>
                  <h4 className="font-medium">{schema.name}</h4>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {schema.tables} tables
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(schema.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Database className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground mb-3">No database schemas defined yet</p>
            <Button
              variant="outline"
              onClick={() => (window.location.href = '/settings/database')}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Schema
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About Database Schemas</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Database schemas define the structure for data storage in your applications.
            You can create templates for common patterns like:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>User management and authentication</li>
            <li>E-commerce (products, orders, customers)</li>
            <li>Content management (posts, categories, media)</li>
            <li>Healthcare data (patients, appointments, records)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// SERVICES SECTION
// ============================================================================

interface ServiceCatalogSummary {
  apis: number;
  mcpServers: number;
  llmProviders: number;
  integrations: number;
}

export function ServicesSection() {
  const [summary, setSummary] = useState<ServiceCatalogSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/services/catalog');
      if (response.ok) {
        const data = await response.json();
        setSummary({
          apis: data.apis?.length || 0,
          mcpServers: data.mcpServers?.length || 0,
          llmProviders: data.llmProviders?.length || 0,
          integrations: data.externalIntegrations?.length || 0,
        });
      }
    } catch (err) {
      console.error('Failed to load service catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  const CATALOG_ITEMS = [
    {
      key: 'apis',
      label: 'APIs',
      icon: Cloud,
      color: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30',
      description: 'Internal APIs available to agents',
    },
    {
      key: 'mcpServers',
      label: 'MCP Servers',
      icon: Server,
      color: 'text-purple-500 bg-purple-100 dark:bg-purple-900/30',
      description: 'Model Context Protocol servers',
    },
    {
      key: 'llmProviders',
      label: 'LLM Providers',
      icon: Bot,
      color: 'text-orange-500 bg-orange-100 dark:bg-orange-900/30',
      description: 'AI model providers',
    },
    {
      key: 'integrations',
      label: 'Integrations',
      icon: Zap,
      color: 'text-green-500 bg-green-100 dark:bg-green-900/30',
      description: 'External service integrations',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Service Catalog</h2>
          <p className="text-muted-foreground">
            Manage APIs, MCP servers, and integrations
          </p>
        </div>
        <Button onClick={() => (window.location.href = '/settings/services')}>
          <Server className="h-4 w-4 mr-2" />
          Open Catalog
        </Button>
      </div>

      {/* Summary Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {CATALOG_ITEMS.map((item) => {
            const Icon = item.icon;
            const count = summary?.[item.key as keyof ServiceCatalogSummary] || 0;
            return (
              <Card key={item.key}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={cn('p-2 rounded-lg', item.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-sm text-muted-foreground">{item.label}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Open Full Catalog */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Server className="h-6 w-6 text-primary" />
              <div>
                <h4 className="font-medium">Full Service Catalog</h4>
                <p className="text-sm text-muted-foreground">
                  Add, edit, and manage all services in the dedicated catalog page
                </p>
              </div>
            </div>
            <Button onClick={() => (window.location.href = '/settings/services')}>
              Open Catalog
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
