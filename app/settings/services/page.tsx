'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit2,
  Play,
  Square,
  Check,
  X,
  Loader2,
  RefreshCw,
  Server,
  Cloud,
  Bot,
  Database,
  Search,
  Code,
  Eye,
  Heart,
  Zap,
  ExternalLink,
  Copy,
  AlertCircle,
  CheckCircle,
  Settings,
  Save,
  RotateCcw,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface ApiEndpoint {
  path: string;
  method: string;
  description: string;
}

interface CodeExample {
  title: string;
  language: string;
  code: string;
}

interface ApiService {
  id: string;
  name: string;
  description: string;
  category: string;
  baseUrl: string;
  endpoints: ApiEndpoint[];
  authentication?: {
    type: string;
    envVariable?: string;
  };
  examples: CodeExample[];
  tags: string[];
  enabled: boolean;
  requiresSetup?: boolean;
  setupInstructions?: string;
}

interface McpTool {
  name: string;
  description: string;
}

interface McpServer {
  id: string;
  name: string;
  description: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  tools: McpTool[];
  enabled: boolean;
  autoStart?: boolean;
  category: string;
  status?: string;
}

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

interface IntegrationEnvVar {
  name: string;
  description: string;
  required: boolean;
  example?: string;
}

interface IntegrationInjection {
  target: string;
  filename?: string;
  code: string;
  importStatement?: string;
}

interface ExternalIntegration {
  id: string;
  name: string;
  description: string;
  category: string;
  icon?: string;
  packages: string[];
  envVars: IntegrationEnvVar[];
  injections: IntegrationInjection[];
  setupSteps: string[];
  docsUrl?: string;
  mockEndpoint?: string;
  enabled: boolean;
}

interface ServiceCatalog {
  version: string;
  lastUpdated: string;
  apis: ApiService[];
  mcpServers: McpServer[];
  llmProviders: LlmProvider[];
  externalIntegrations: ExternalIntegration[];
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ServicesSettingsPage() {
  const [catalog, setCatalog] = useState<ServiceCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('apis');

  // Modal states
  const [apiModalOpen, setApiModalOpen] = useState(false);
  const [mcpModalOpen, setMcpModalOpen] = useState(false);
  const [llmModalOpen, setLlmModalOpen] = useState(false);
  const [integrationModalOpen, setIntegrationModalOpen] = useState(false);
  const [editingApi, setEditingApi] = useState<ApiService | null>(null);
  const [editingMcp, setEditingMcp] = useState<McpServer | null>(null);
  const [editingLlm, setEditingLlm] = useState<LlmProvider | null>(null);
  const [editingIntegration, setEditingIntegration] = useState<ExternalIntegration | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string; name: string } | null>(null);
  const [integrationDetailOpen, setIntegrationDetailOpen] = useState(false);
  const [viewingIntegration, setViewingIntegration] = useState<ExternalIntegration | null>(null);

  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/services/catalog');
      if (!response.ok) throw new Error('Failed to load catalog');
      const data = await response.json();
      setCatalog(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const toggleEnabled = async (type: 'api' | 'mcp' | 'llm' | 'integration', id: string, enabled: boolean) => {
    try {
      await fetch('/api/services/catalog', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id, enabled }),
      });
      await loadCatalog();
    } catch (err) {
      console.error('Failed to toggle:', err);
    }
  };

  const setDefaultLlm = async (id: string) => {
    try {
      await fetch('/api/services/catalog', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'llm', id, isDefault: true }),
      });
      await loadCatalog();
    } catch (err) {
      console.error('Failed to set default:', err);
    }
  };

  const startMcpServer = async (id: string) => {
    try {
      await fetch(`/api/services/mcp/${id}/start`, { method: 'POST' });
      await loadCatalog();
    } catch (err) {
      console.error('Failed to start server:', err);
    }
  };

  const stopMcpServer = async (id: string) => {
    try {
      await fetch(`/api/services/mcp/${id}/stop`, { method: 'POST' });
      await loadCatalog();
    } catch (err) {
      console.error('Failed to stop server:', err);
    }
  };

  const saveService = async (type: string, service: any) => {
    try {
      setSaving(true);
      await fetch('/api/services/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, service }),
      });
      await loadCatalog();
      setApiModalOpen(false);
      setMcpModalOpen(false);
      setLlmModalOpen(false);
      setIntegrationModalOpen(false);
      setEditingApi(null);
      setEditingMcp(null);
      setEditingLlm(null);
      setEditingIntegration(null);
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  const deleteService = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/services/catalog?type=${deleteTarget.type}&id=${deleteTarget.id}`, {
        method: 'DELETE',
      });
      await loadCatalog();
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const openEditApi = (api: ApiService) => {
    setEditingApi(api);
    setApiModalOpen(true);
  };

  const openEditMcp = (mcp: McpServer) => {
    setEditingMcp(mcp);
    setMcpModalOpen(true);
  };

  const openEditLlm = (llm: LlmProvider) => {
    setEditingLlm(llm);
    setLlmModalOpen(true);
  };

  const openEditIntegration = (integration: ExternalIntegration) => {
    setEditingIntegration(integration);
    setIntegrationModalOpen(true);
  };

  const viewIntegrationDetails = (integration: ExternalIntegration) => {
    setViewingIntegration(integration);
    setIntegrationDetailOpen(true);
  };

  const confirmDelete = (type: string, id: string, name: string) => {
    setDeleteTarget({ type, id, name });
    setDeleteConfirmOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/settings">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Server className="w-6 h-6 text-purple-400" />
                  Service Catalog
                </h1>
                <p className="text-sm text-gray-400">
                  Manage APIs, MCP servers, and LLM providers
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {catalog && (
                <span className="text-xs text-gray-500">
                  v{catalog.version} | Last updated: {new Date(catalog.lastUpdated).toLocaleDateString()}
                </span>
              )}
              <Button variant="outline" size="sm" onClick={loadCatalog}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-gray-800 border border-gray-700">
            <TabsTrigger value="apis" className="data-[state=active]:bg-purple-600">
              <Cloud className="w-4 h-4 mr-2" />
              APIs ({catalog?.apis.length || 0})
            </TabsTrigger>
            <TabsTrigger value="mcp" className="data-[state=active]:bg-purple-600">
              <Server className="w-4 h-4 mr-2" />
              MCP Servers ({catalog?.mcpServers.length || 0})
            </TabsTrigger>
            <TabsTrigger value="llm" className="data-[state=active]:bg-purple-600">
              <Bot className="w-4 h-4 mr-2" />
              LLM Providers ({catalog?.llmProviders.length || 0})
            </TabsTrigger>
            <TabsTrigger value="integrations" className="data-[state=active]:bg-purple-600">
              <Zap className="w-4 h-4 mr-2" />
              Integrations ({catalog?.externalIntegrations?.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* APIs Tab */}
          <TabsContent value="apis" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-gray-400">
                Internal APIs that agents can use when building applications.
              </p>
              <Button onClick={() => { setEditingApi(null); setApiModalOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add API
              </Button>
            </div>

            <div className="grid gap-4">
              {catalog?.apis.map(api => (
                <ApiCard
                  key={api.id}
                  api={api}
                  onToggle={(enabled) => toggleEnabled('api', api.id, enabled)}
                  onEdit={() => openEditApi(api)}
                  onDelete={() => confirmDelete('api', api.id, api.name)}
                />
              ))}
            </div>
          </TabsContent>

          {/* MCP Servers Tab */}
          <TabsContent value="mcp" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-gray-400">
                MCP servers provide additional tools to agents via the Model Context Protocol.
              </p>
              <Button onClick={() => { setEditingMcp(null); setMcpModalOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add MCP Server
              </Button>
            </div>

            <div className="grid gap-4">
              {catalog?.mcpServers.map(server => (
                <McpCard
                  key={server.id}
                  server={server}
                  onToggle={(enabled) => toggleEnabled('mcp', server.id, enabled)}
                  onStart={() => startMcpServer(server.id)}
                  onStop={() => stopMcpServer(server.id)}
                  onEdit={() => openEditMcp(server)}
                  onDelete={() => confirmDelete('mcp', server.id, server.name)}
                />
              ))}
            </div>
          </TabsContent>

          {/* LLM Providers Tab */}
          <TabsContent value="llm" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-gray-400">
                LLM providers for agent tasks. The system routes to the optimal provider automatically.
              </p>
              <Button onClick={() => { setEditingLlm(null); setLlmModalOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Provider
              </Button>
            </div>

            <div className="grid gap-4">
              {catalog?.llmProviders.map(provider => (
                <LlmCard
                  key={provider.id}
                  provider={provider}
                  onToggle={(enabled) => toggleEnabled('llm', provider.id, enabled)}
                  onSetDefault={() => setDefaultLlm(provider.id)}
                  onEdit={() => openEditLlm(provider)}
                  onDelete={() => confirmDelete('llm', provider.id, provider.name)}
                />
              ))}
            </div>
          </TabsContent>

          {/* Integrations Tab */}
          <TabsContent value="integrations" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-gray-400">
                External services that get injected into builds (analytics, auth, payments, etc.)
              </p>
              <Button onClick={() => { setEditingIntegration(null); setIntegrationModalOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Integration
              </Button>
            </div>

            <div className="grid gap-4">
              {catalog?.externalIntegrations?.map(integration => (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                  onToggle={(enabled) => toggleEnabled('integration', integration.id, enabled)}
                  onView={() => viewIntegrationDetails(integration)}
                  onEdit={() => openEditIntegration(integration)}
                  onDelete={() => confirmDelete('integration', integration.id, integration.name)}
                />
              ))}
              {(!catalog?.externalIntegrations || catalog.externalIntegrations.length === 0) && (
                <div className="text-center py-8 text-gray-500">
                  No integrations configured yet. Add Google Analytics, Stripe, or other services.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* API Modal */}
      <ApiModal
        open={apiModalOpen}
        onClose={() => { setApiModalOpen(false); setEditingApi(null); }}
        api={editingApi}
        onSave={(api) => saveService('api', api)}
        saving={saving}
      />

      {/* MCP Modal */}
      <McpModal
        open={mcpModalOpen}
        onClose={() => { setMcpModalOpen(false); setEditingMcp(null); }}
        server={editingMcp}
        onSave={(server) => saveService('mcp', server)}
        saving={saving}
      />

      {/* LLM Modal */}
      <LlmModal
        open={llmModalOpen}
        onClose={() => { setLlmModalOpen(false); setEditingLlm(null); }}
        provider={editingLlm}
        onSave={(provider) => saveService('llm', provider)}
        saving={saving}
      />

      {/* Integration Modal */}
      <IntegrationModal
        open={integrationModalOpen}
        onClose={() => { setIntegrationModalOpen(false); setEditingIntegration(null); }}
        integration={editingIntegration}
        onSave={(integration) => saveService('integration', integration)}
        saving={saving}
      />

      {/* Integration Detail Modal */}
      <IntegrationDetailModal
        open={integrationDetailOpen}
        onClose={() => { setIntegrationDetailOpen(false); setViewingIntegration(null); }}
        integration={viewingIntegration}
      />

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Service</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteService}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// API CARD COMPONENT
// ============================================================================

function ApiCard({
  api,
  onToggle,
  onEdit,
  onDelete,
}: {
  api: ApiService;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'ocr': return <Eye className="w-5 h-5" />;
      case 'healthcare': return <Heart className="w-5 h-5" />;
      case 'database': return <Database className="w-5 h-5" />;
      case 'ai': return <Bot className="w-5 h-5" />;
      default: return <Cloud className="w-5 h-5" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'ocr': return 'bg-blue-500/20 text-blue-400';
      case 'healthcare': return 'bg-red-500/20 text-red-400';
      case 'database': return 'bg-green-500/20 text-green-400';
      case 'ai': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <Card className={`bg-gray-800/50 border-gray-700 ${!api.enabled && 'opacity-60'}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${getCategoryColor(api.category)}`}>
              {getCategoryIcon(api.category)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white">{api.name}</h3>
                <Badge variant="outline" className="text-xs">
                  {api.category}
                </Badge>
                {api.requiresSetup && (
                  <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-400/30">
                    Setup Required
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-400 mt-1">{api.description}</p>
              <div className="flex items-center gap-2 mt-2">
                <code className="text-xs bg-gray-900 px-2 py-1 rounded text-purple-400">
                  {api.baseUrl}
                </code>
                <span className="text-xs text-gray-500">
                  {api.endpoints.length} endpoint{api.endpoints.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {api.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="w-4 h-4 text-red-400" />
            </Button>
            <Switch checked={api.enabled} onCheckedChange={onToggle} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MCP CARD COMPONENT
// ============================================================================

function McpCard({
  server,
  onToggle,
  onStart,
  onStop,
  onEdit,
  onDelete,
}: {
  server: McpServer;
  onToggle: (enabled: boolean) => void;
  onStart: () => void;
  onStop: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'filesystem': return <Server className="w-5 h-5" />;
      case 'database': return <Database className="w-5 h-5" />;
      case 'search': return <Search className="w-5 h-5" />;
      case 'code': return <Code className="w-5 h-5" />;
      default: return <Server className="w-5 h-5" />;
    }
  };

  const isRunning = server.status === 'running';

  return (
    <Card className={`bg-gray-800/50 border-gray-700 ${!server.enabled && 'opacity-60'}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
              {getCategoryIcon(server.category)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white">{server.name}</h3>
                <Badge variant="outline" className="text-xs">
                  {server.category}
                </Badge>
                <div className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${
                    server.status === 'running' ? 'bg-green-400' :
                    server.status === 'starting' ? 'bg-yellow-400 animate-pulse' :
                    server.status === 'error' ? 'bg-red-400' : 'bg-gray-500'
                  }`} />
                  <span className={`text-xs ${
                    server.status === 'running' ? 'text-green-400' :
                    server.status === 'starting' ? 'text-yellow-400' :
                    server.status === 'error' ? 'text-red-400' : 'text-gray-500'
                  }`}>
                    {server.status || 'stopped'}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-400 mt-1">{server.description}</p>
              <div className="mt-2">
                <code className="text-xs bg-gray-900 px-2 py-1 rounded text-gray-400">
                  {server.command} {server.args.join(' ')}
                </code>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {server.tools.map(tool => (
                  <Badge key={tool.name} variant="secondary" className="text-xs">
                    {tool.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {server.enabled && (
              <Button
                variant={isRunning ? 'destructive' : 'default'}
                size="sm"
                onClick={isRunning ? onStop : onStart}
              >
                {isRunning ? (
                  <>
                    <Square className="w-4 h-4 mr-1" />
                    Stop
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-1" />
                    Start
                  </>
                )}
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="w-4 h-4 text-red-400" />
            </Button>
            <Switch checked={server.enabled} onCheckedChange={onToggle} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// LLM CARD COMPONENT
// ============================================================================

function LlmCard({
  provider,
  onToggle,
  onSetDefault,
  onEdit,
  onDelete,
}: {
  provider: LlmProvider;
  onToggle: (enabled: boolean) => void;
  onSetDefault: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'anthropic': return 'bg-orange-500/20 text-orange-400';
      case 'openai': return 'bg-green-500/20 text-green-400';
      case 'ollama': return 'bg-blue-500/20 text-blue-400';
      case 'groq': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <Card className={`bg-gray-800/50 border-gray-700 ${!provider.enabled && 'opacity-60'}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${getTypeColor(provider.type)}`}>
              <Bot className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white">{provider.name}</h3>
                <Badge variant="outline" className={`text-xs ${getTypeColor(provider.type)}`}>
                  {provider.type}
                </Badge>
                {provider.isDefault && (
                  <Badge className="text-xs bg-purple-600">
                    Default
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {provider.capabilities.map(cap => (
                  <Badge key={cap} variant="secondary" className="text-xs">
                    {cap}
                  </Badge>
                ))}
              </div>
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-1">Models:</p>
                <div className="flex flex-wrap gap-2">
                  {provider.models.map(model => (
                    <div key={model.id} className="flex items-center gap-1 text-xs bg-gray-900 px-2 py-1 rounded">
                      <span className="text-gray-300">{model.name}</span>
                      {model.supportsVision && (
                        <Eye className="w-3 h-3 text-blue-400" />
                      )}
                      {model.supportsTools && (
                        <Zap className="w-3 h-3 text-yellow-400" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Best for: {provider.useCases.join(', ')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {provider.enabled && !provider.isDefault && (
              <Button variant="outline" size="sm" onClick={onSetDefault}>
                Set Default
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="w-4 h-4 text-red-400" />
            </Button>
            <Switch checked={provider.enabled} onCheckedChange={onToggle} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// API MODAL
// ============================================================================

function ApiModal({
  open,
  onClose,
  api,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  api: ApiService | null;
  onSave: (api: ApiService) => void;
  saving: boolean;
}) {
  const [formData, setFormData] = useState<Partial<ApiService>>({
    id: '',
    name: '',
    description: '',
    category: 'utility',
    baseUrl: '',
    endpoints: [],
    tags: [],
    enabled: true,
    examples: [],
  });

  const [endpointsText, setEndpointsText] = useState('');
  const [tagsText, setTagsText] = useState('');

  useEffect(() => {
    if (api) {
      setFormData(api);
      setEndpointsText(api.endpoints.map(e => `${e.method} ${e.path} - ${e.description}`).join('\n'));
      setTagsText(api.tags.join(', '));
    } else {
      setFormData({
        id: '',
        name: '',
        description: '',
        category: 'utility',
        baseUrl: '',
        endpoints: [],
        tags: [],
        enabled: true,
        examples: [],
      });
      setEndpointsText('');
      setTagsText('');
    }
  }, [api, open]);

  const handleSave = () => {
    // Parse endpoints from text
    const endpoints = endpointsText.split('\n').filter(Boolean).map(line => {
      const match = line.match(/^(GET|POST|PUT|DELETE|PATCH)\s+(\S+)\s*-?\s*(.*)$/i);
      if (match) {
        return { method: match[1].toUpperCase(), path: match[2], description: match[3] || '' };
      }
      return null;
    }).filter(Boolean) as ApiEndpoint[];

    // Parse tags
    const tags = tagsText.split(',').map(t => t.trim()).filter(Boolean);

    // Generate ID if new
    const id = formData.id || formData.name?.toLowerCase().replace(/\s+/g, '-') || '';

    onSave({
      ...formData,
      id,
      endpoints,
      tags,
    } as ApiService);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{api ? 'Edit API' : 'Add New API'}</DialogTitle>
          <DialogDescription>
            Configure an internal API that agents can use.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="MLX OCR Service"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ocr">OCR</SelectItem>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="database">Database</SelectItem>
                  <SelectItem value="storage">Storage</SelectItem>
                  <SelectItem value="ai">AI</SelectItem>
                  <SelectItem value="utility">Utility</SelectItem>
                  <SelectItem value="external">External</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Base URL</Label>
            <Input
              value={formData.baseUrl || ''}
              onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
              placeholder="/api/mlx/ocr"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What does this API do?"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Endpoints (one per line: METHOD /path - description)</Label>
            <Textarea
              value={endpointsText}
              onChange={(e) => setEndpointsText(e.target.value)}
              placeholder="POST / - Extract text from image&#10;GET /status - Check service status"
              rows={4}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>Tags (comma-separated)</Label>
            <Input
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="ocr, vision, local"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
            />
            <Label>Enabled</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// MCP MODAL
// ============================================================================

function McpModal({
  open,
  onClose,
  server,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  server: McpServer | null;
  onSave: (server: McpServer) => void;
  saving: boolean;
}) {
  const [formData, setFormData] = useState<Partial<McpServer>>({
    id: '',
    name: '',
    description: '',
    command: 'npx',
    args: [],
    tools: [],
    enabled: true,
    autoStart: false,
    category: 'custom',
  });

  const [argsText, setArgsText] = useState('');
  const [toolsText, setToolsText] = useState('');

  useEffect(() => {
    if (server) {
      setFormData(server);
      setArgsText(server.args.join(' '));
      setToolsText(server.tools.map(t => `${t.name} - ${t.description}`).join('\n'));
    } else {
      setFormData({
        id: '',
        name: '',
        description: '',
        command: 'npx',
        args: [],
        tools: [],
        enabled: true,
        autoStart: false,
        category: 'custom',
      });
      setArgsText('');
      setToolsText('');
    }
  }, [server, open]);

  const handleSave = () => {
    const args = argsText.split(' ').filter(Boolean);
    const tools = toolsText.split('\n').filter(Boolean).map(line => {
      const [name, ...descParts] = line.split(' - ');
      return { name: name.trim(), description: descParts.join(' - ').trim() };
    });
    const id = formData.id || formData.name?.toLowerCase().replace(/\s+/g, '-') || '';

    onSave({
      ...formData,
      id,
      args,
      tools,
    } as McpServer);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{server ? 'Edit MCP Server' : 'Add MCP Server'}</DialogTitle>
          <DialogDescription>
            Configure an MCP server that provides tools to agents.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Filesystem Server"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="filesystem">Filesystem</SelectItem>
                  <SelectItem value="database">Database</SelectItem>
                  <SelectItem value="search">Search</SelectItem>
                  <SelectItem value="code">Code</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What does this server do?"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Command</Label>
              <Input
                value={formData.command || ''}
                onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                placeholder="npx"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Arguments</Label>
              <Input
                value={argsText}
                onChange={(e) => setArgsText(e.target.value)}
                placeholder="-y @modelcontextprotocol/server-filesystem /tmp"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tools (one per line: name - description)</Label>
            <Textarea
              value={toolsText}
              onChange={(e) => setToolsText(e.target.value)}
              placeholder="read_file - Read contents of a file&#10;write_file - Write content to a file"
              rows={4}
              className="font-mono text-sm"
            />
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
              <Label>Enabled</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.autoStart}
                onCheckedChange={(checked) => setFormData({ ...formData, autoStart: checked })}
              />
              <Label>Auto-start</Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// LLM MODAL
// ============================================================================

function LlmModal({
  open,
  onClose,
  provider,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  provider: LlmProvider | null;
  onSave: (provider: LlmProvider) => void;
  saving: boolean;
}) {
  const [formData, setFormData] = useState<Partial<LlmProvider>>({
    id: '',
    name: '',
    type: 'openai',
    baseUrl: '',
    apiKeyEnvVar: '',
    models: [],
    capabilities: [],
    useCases: [],
    enabled: true,
    isDefault: false,
  });

  const [modelsText, setModelsText] = useState('');
  const [capabilitiesText, setCapabilitiesText] = useState('');
  const [useCasesText, setUseCasesText] = useState('');

  useEffect(() => {
    if (provider) {
      setFormData(provider);
      setModelsText(provider.models.map(m => {
        const features = [];
        if (m.supportsVision) features.push('vision');
        if (m.supportsTools) features.push('tools');
        return `${m.id}|${m.name}|${m.contextWindow}${features.length ? '|' + features.join(',') : ''}`;
      }).join('\n'));
      setCapabilitiesText(provider.capabilities.join(', '));
      setUseCasesText(provider.useCases.join(', '));
    } else {
      setFormData({
        id: '',
        name: '',
        type: 'openai',
        baseUrl: '',
        apiKeyEnvVar: '',
        models: [],
        capabilities: [],
        useCases: [],
        enabled: true,
        isDefault: false,
      });
      setModelsText('');
      setCapabilitiesText('');
      setUseCasesText('');
    }
  }, [provider, open]);

  const handleSave = () => {
    const models = modelsText.split('\n').filter(Boolean).map(line => {
      const [id, name, contextWindow, features] = line.split('|');
      const featureList = features?.split(',') || [];
      return {
        id: id.trim(),
        name: name?.trim() || id.trim(),
        contextWindow: parseInt(contextWindow) || 128000,
        supportsVision: featureList.includes('vision'),
        supportsTools: featureList.includes('tools'),
      };
    });

    const capabilities = capabilitiesText.split(',').map(c => c.trim()).filter(Boolean);
    const useCases = useCasesText.split(',').map(u => u.trim()).filter(Boolean);
    const id = formData.id || formData.name?.toLowerCase().replace(/\s+/g, '-') || '';

    onSave({
      ...formData,
      id,
      models,
      capabilities,
      useCases,
    } as LlmProvider);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{provider ? 'Edit LLM Provider' : 'Add LLM Provider'}</DialogTitle>
          <DialogDescription>
            Configure an LLM provider for agent tasks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="OpenAI"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="ollama">Ollama</SelectItem>
                  <SelectItem value="groq">Groq</SelectItem>
                  <SelectItem value="azure">Azure</SelectItem>
                  <SelectItem value="local">Local</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Base URL (optional)</Label>
              <Input
                value={formData.baseUrl || ''}
                onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1"
              />
            </div>
            <div className="space-y-2">
              <Label>API Key Env Variable</Label>
              <Input
                value={formData.apiKeyEnvVar || ''}
                onChange={(e) => setFormData({ ...formData, apiKeyEnvVar: e.target.value })}
                placeholder="OPENAI_API_KEY"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Models (one per line: id|name|contextWindow|features)</Label>
            <Textarea
              value={modelsText}
              onChange={(e) => setModelsText(e.target.value)}
              placeholder="gpt-4o|GPT-4o|128000|vision,tools&#10;gpt-4o-mini|GPT-4o Mini|128000|vision,tools"
              rows={4}
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-500">Features: vision, tools (comma-separated)</p>
          </div>

          <div className="space-y-2">
            <Label>Capabilities (comma-separated)</Label>
            <Input
              value={capabilitiesText}
              onChange={(e) => setCapabilitiesText(e.target.value)}
              placeholder="vision, code, chat, function-calling"
            />
          </div>

          <div className="space-y-2">
            <Label>Use Cases (comma-separated)</Label>
            <Input
              value={useCasesText}
              onChange={(e) => setUseCasesText(e.target.value)}
              placeholder="Code generation, Analysis, Chat"
            />
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
              <Label>Enabled</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isDefault}
                onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
              />
              <Label>Set as Default</Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// INTEGRATION CARD COMPONENT
// ============================================================================

function IntegrationCard({
  integration,
  onToggle,
  onView,
  onEdit,
  onDelete,
}: {
  integration: ExternalIntegration;
  onToggle: (enabled: boolean) => void;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'analytics': return <Eye className="w-5 h-5" />;
      case 'auth': return <Settings className="w-5 h-5" />;
      case 'payments': return <Code className="w-5 h-5" />;
      case 'email': return <Cloud className="w-5 h-5" />;
      case 'database': return <Database className="w-5 h-5" />;
      case 'storage': return <Cloud className="w-5 h-5" />;
      case 'monitoring': return <Eye className="w-5 h-5" />;
      case 'mock': return <Bot className="w-5 h-5" />;
      default: return <Zap className="w-5 h-5" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'analytics': return 'bg-blue-500/20 text-blue-400';
      case 'auth': return 'bg-green-500/20 text-green-400';
      case 'payments': return 'bg-yellow-500/20 text-yellow-400';
      case 'email': return 'bg-pink-500/20 text-pink-400';
      case 'database': return 'bg-orange-500/20 text-orange-400';
      case 'storage': return 'bg-cyan-500/20 text-cyan-400';
      case 'monitoring': return 'bg-red-500/20 text-red-400';
      case 'mock': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <Card className={`bg-gray-800/50 border-gray-700 ${!integration.enabled && 'opacity-60'}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${getCategoryColor(integration.category)}`}>
              {getCategoryIcon(integration.category)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white">{integration.name}</h3>
                <Badge variant="outline" className="text-xs">
                  {integration.category}
                </Badge>
                {integration.mockEndpoint && (
                  <Badge variant="outline" className="text-xs text-purple-400 border-purple-400/30">
                    Testable
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-400 mt-1">{integration.description}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {integration.packages.length > 0 && (
                  <span className="text-xs text-gray-500">
                    Packages: {integration.packages.join(', ')}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {integration.envVars.map(env => (
                  <Badge key={env.name} variant="secondary" className="text-xs font-mono">
                    {env.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onView} title="View Details">
              <Eye className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="w-4 h-4 text-red-400" />
            </Button>
            <Switch checked={integration.enabled} onCheckedChange={onToggle} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// INTEGRATION MODAL
// ============================================================================

function IntegrationModal({
  open,
  onClose,
  integration,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  integration: ExternalIntegration | null;
  onSave: (integration: ExternalIntegration) => void;
  saving: boolean;
}) {
  const [formData, setFormData] = useState<Partial<ExternalIntegration>>({
    id: '',
    name: '',
    description: '',
    category: 'analytics',
    packages: [],
    envVars: [],
    injections: [],
    setupSteps: [],
    enabled: true,
  });

  const [packagesText, setPackagesText] = useState('');
  const [envVarsText, setEnvVarsText] = useState('');
  const [setupStepsText, setSetupStepsText] = useState('');

  useEffect(() => {
    if (integration) {
      setFormData(integration);
      setPackagesText(integration.packages.join(', '));
      setEnvVarsText(integration.envVars.map(e => `${e.name}|${e.description}|${e.required ? 'required' : 'optional'}|${e.example || ''}`).join('\n'));
      setSetupStepsText(integration.setupSteps.join('\n'));
    } else {
      setFormData({
        id: '',
        name: '',
        description: '',
        category: 'analytics',
        packages: [],
        envVars: [],
        injections: [],
        setupSteps: [],
        enabled: true,
      });
      setPackagesText('');
      setEnvVarsText('');
      setSetupStepsText('');
    }
  }, [integration, open]);

  const handleSave = () => {
    const packages = packagesText.split(',').map(p => p.trim()).filter(Boolean);
    const envVars = envVarsText.split('\n').filter(Boolean).map(line => {
      const [name, description, required, example] = line.split('|');
      return {
        name: name?.trim() || '',
        description: description?.trim() || '',
        required: required?.trim() === 'required',
        example: example?.trim(),
      };
    }).filter(e => e.name);
    const setupSteps = setupStepsText.split('\n').filter(Boolean);
    const id = formData.id || formData.name?.toLowerCase().replace(/\s+/g, '-') || '';

    onSave({
      ...formData,
      id,
      packages,
      envVars,
      setupSteps,
      injections: formData.injections || [],
    } as ExternalIntegration);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{integration ? 'Edit Integration' : 'Add New Integration'}</DialogTitle>
          <DialogDescription>
            Configure an external service to inject into builds.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Google Analytics 4"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="analytics">Analytics</SelectItem>
                  <SelectItem value="auth">Authentication</SelectItem>
                  <SelectItem value="payments">Payments</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="database">Database</SelectItem>
                  <SelectItem value="storage">Storage</SelectItem>
                  <SelectItem value="monitoring">Monitoring</SelectItem>
                  <SelectItem value="mock">Mock/Testing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What does this integration do?"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>NPM Packages (comma-separated)</Label>
            <Input
              value={packagesText}
              onChange={(e) => setPackagesText(e.target.value)}
              placeholder="@next/third-parties, react-ga4"
            />
          </div>

          <div className="space-y-2">
            <Label>Environment Variables (one per line: name|description|required/optional|example)</Label>
            <Textarea
              value={envVarsText}
              onChange={(e) => setEnvVarsText(e.target.value)}
              placeholder="NEXT_PUBLIC_GA_ID|Google Analytics Measurement ID|required|G-XXXXXXXXXX"
              rows={3}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>Setup Steps (one per line)</Label>
            <Textarea
              value={setupStepsText}
              onChange={(e) => setSetupStepsText(e.target.value)}
              placeholder="1. Go to analytics.google.com&#10;2. Create a new property&#10;3. Copy your Measurement ID"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Documentation URL (optional)</Label>
              <Input
                value={formData.docsUrl || ''}
                onChange={(e) => setFormData({ ...formData, docsUrl: e.target.value })}
                placeholder="https://docs.example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Mock Endpoint (optional)</Label>
              <Input
                value={formData.mockEndpoint || ''}
                onChange={(e) => setFormData({ ...formData, mockEndpoint: e.target.value })}
                placeholder="/api/mock-analytics"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
            />
            <Label>Enabled</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// INTEGRATION DETAIL MODAL
// ============================================================================

function IntegrationDetailModal({
  open,
  onClose,
  integration,
}: {
  open: boolean;
  onClose: () => void;
  integration: ExternalIntegration | null;
}) {
  if (!integration) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-400" />
            {integration.name}
          </DialogTitle>
          <DialogDescription>
            {integration.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Packages */}
          {integration.packages.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-white mb-2">NPM Packages</h4>
              <div className="flex flex-wrap gap-2">
                {integration.packages.map(pkg => (
                  <code key={pkg} className="px-2 py-1 bg-gray-800 rounded text-sm text-purple-400">
                    {pkg}
                  </code>
                ))}
              </div>
            </div>
          )}

          {/* Environment Variables */}
          <div>
            <h4 className="text-sm font-medium text-white mb-2">Environment Variables</h4>
            <div className="space-y-2">
              {integration.envVars.map(env => (
                <div key={env.name} className="p-3 bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <code className="text-sm text-green-400">{env.name}</code>
                    {env.required && (
                      <Badge variant="destructive" className="text-xs">Required</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mt-1">{env.description}</p>
                  {env.example && (
                    <p className="text-xs text-gray-500 mt-1">Example: <code>{env.example}</code></p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Code Injections */}
          <div>
            <h4 className="text-sm font-medium text-white mb-2">Code Injections ({integration.injections.length})</h4>
            <div className="space-y-3">
              {integration.injections.map((injection, idx) => (
                <div key={idx} className="border border-gray-700 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{injection.target}</Badge>
                      {injection.filename && (
                        <code className="text-xs text-gray-400">{injection.filename}</code>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(injection.code)}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <pre className="p-3 text-xs overflow-x-auto bg-gray-900">
                    <code className="text-gray-300">{injection.code}</code>
                  </pre>
                </div>
              ))}
            </div>
          </div>

          {/* Setup Steps */}
          <div>
            <h4 className="text-sm font-medium text-white mb-2">Setup Steps</h4>
            <ol className="list-decimal list-inside space-y-1">
              {integration.setupSteps.map((step, idx) => (
                <li key={idx} className="text-sm text-gray-400">{step}</li>
              ))}
            </ol>
          </div>

          {/* Links */}
          <div className="flex gap-4">
            {integration.docsUrl && (
              <a
                href={integration.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
              >
                <ExternalLink className="w-4 h-4" />
                Documentation
              </a>
            )}
            {integration.mockEndpoint && (
              <span className="text-sm text-gray-400 flex items-center gap-1">
                <Bot className="w-4 h-4" />
                Mock endpoint: <code>{integration.mockEndpoint}</code>
              </span>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
