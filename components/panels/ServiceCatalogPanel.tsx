'use client';

import React, { useState, useEffect } from 'react';
import {
  Server,
  Cloud,
  Bot,
  Database,
  Search,
  Code,
  Eye,
  Heart,
  Zap,
  Settings,
  Play,
  Square,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Copy,
  AlertCircle,
  CheckCircle,
  Loader2,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface ApiService {
  id: string;
  name: string;
  description: string;
  category: string;
  baseUrl: string;
  endpoints: Array<{
    path: string;
    method: string;
    description: string;
  }>;
  tags: string[];
  enabled: boolean;
  requiresSetup?: boolean;
  examples?: Array<{
    title: string;
    language: string;
    code: string;
  }>;
}

interface McpServer {
  id: string;
  name: string;
  description: string;
  command: string;
  args: string[];
  tools: Array<{
    name: string;
    description: string;
  }>;
  enabled: boolean;
  autoStart?: boolean;
  category: string;
  status?: 'stopped' | 'starting' | 'running' | 'error';
}

interface LlmProvider {
  id: string;
  name: string;
  type: string;
  baseUrl?: string;
  models: Array<{
    id: string;
    name: string;
    contextWindow: number;
    supportsVision?: boolean;
    supportsTools?: boolean;
  }>;
  capabilities: string[];
  useCases: string[];
  enabled: boolean;
  isDefault?: boolean;
}

interface ServiceCatalog {
  version: string;
  lastUpdated: string;
  apis: ApiService[];
  mcpServers: McpServer[];
  llmProviders: LlmProvider[];
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ServiceCatalogPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'apis' | 'mcp' | 'llm'>('apis');
  const [catalog, setCatalog] = useState<ServiceCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

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
      setError(err instanceof Error ? err.message : 'Failed to load catalog');
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleEnabled = async (type: 'api' | 'mcp' | 'llm', id: string, enabled: boolean) => {
    try {
      await fetch('/api/services/catalog', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id, enabled }),
      });
      await loadCatalog();
    } catch (err) {
      console.error('Failed to toggle service:', err);
    }
  };

  const startMcpServer = async (id: string) => {
    try {
      await fetch(`/api/services/mcp/${id}/start`, { method: 'POST' });
      await loadCatalog();
    } catch (err) {
      console.error('Failed to start MCP server:', err);
    }
  };

  const stopMcpServer = async (id: string) => {
    try {
      await fetch(`/api/services/mcp/${id}/stop`, { method: 'POST' });
      await loadCatalog();
    } catch (err) {
      console.error('Failed to stop MCP server:', err);
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
      console.error('Failed to set default LLM:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-400">
        <AlertCircle className="w-12 h-12 mb-4" />
        <p>{error}</p>
        <button
          onClick={loadCatalog}
          className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!catalog) return null;

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <Server className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold">Service Catalog</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            v{catalog.version} | Updated {new Date(catalog.lastUpdated).toLocaleDateString()}
          </span>
          <button
            onClick={loadCatalog}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        {[
          { id: 'apis', label: 'APIs', icon: Cloud, count: catalog.apis.length },
          { id: 'mcp', label: 'MCP Servers', icon: Server, count: catalog.mcpServers.length },
          { id: 'llm', label: 'LLM Providers', icon: Bot, count: catalog.llmProviders.length },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                isActive
                  ? 'border-purple-400 text-purple-400 bg-purple-500/10'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              <span className={`px-1.5 py-0.5 text-xs rounded ${isActive ? 'bg-purple-500/30' : 'bg-gray-700'}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'apis' && (
          <ApiServicesList
            apis={catalog.apis}
            expandedItems={expandedItems}
            onToggleExpand={toggleItem}
            onToggleEnabled={(id, enabled) => toggleEnabled('api', id, enabled)}
          />
        )}
        {activeTab === 'mcp' && (
          <McpServersList
            servers={catalog.mcpServers}
            expandedItems={expandedItems}
            onToggleExpand={toggleItem}
            onToggleEnabled={(id, enabled) => toggleEnabled('mcp', id, enabled)}
            onStart={startMcpServer}
            onStop={stopMcpServer}
          />
        )}
        {activeTab === 'llm' && (
          <LlmProvidersList
            providers={catalog.llmProviders}
            expandedItems={expandedItems}
            onToggleExpand={toggleItem}
            onToggleEnabled={(id, enabled) => toggleEnabled('llm', id, enabled)}
            onSetDefault={setDefaultLlm}
          />
        )}
      </div>
    </div>
  );
};

// ============================================================================
// API SERVICES LIST
// ============================================================================

const ApiServicesList: React.FC<{
  apis: ApiService[];
  expandedItems: Set<string>;
  onToggleExpand: (id: string) => void;
  onToggleEnabled: (id: string, enabled: boolean) => void;
}> = ({ apis, expandedItems, onToggleExpand, onToggleEnabled }) => {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'ocr': return Eye;
      case 'healthcare': return Heart;
      case 'database': return Database;
      case 'ai': return Bot;
      default: return Cloud;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'ocr': return 'text-blue-400 bg-blue-500/20';
      case 'healthcare': return 'text-red-400 bg-red-500/20';
      case 'database': return 'text-green-400 bg-green-500/20';
      case 'ai': return 'text-purple-400 bg-purple-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  return (
    <div className="space-y-3">
      {apis.map(api => {
        const isExpanded = expandedItems.has(api.id);
        const Icon = getCategoryIcon(api.category);
        const colorClass = getCategoryColor(api.category);

        return (
          <div
            key={api.id}
            className={`border rounded-lg transition-colors ${
              api.enabled ? 'border-gray-700 bg-gray-800/50' : 'border-gray-800 bg-gray-900/50 opacity-60'
            }`}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between p-3 cursor-pointer"
              onClick={() => onToggleExpand(api.id)}
            >
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
                <div className={`p-2 rounded-lg ${colorClass}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{api.name}</span>
                    {api.requiresSetup && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-yellow-500/20 text-yellow-400 rounded">
                        Setup Required
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">{api.baseUrl}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {api.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="px-1.5 py-0.5 text-[10px] bg-gray-700 text-gray-400 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleEnabled(api.id, !api.enabled);
                  }}
                  className={`w-10 h-5 rounded-full transition-colors ${
                    api.enabled ? 'bg-green-500' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transform transition-transform ${
                      api.enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-gray-700">
                <p className="text-sm text-gray-400 mt-3 mb-4">{api.description}</p>

                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Endpoints</h4>
                  <div className="space-y-1">
                    {api.endpoints.map((endpoint, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                          endpoint.method === 'GET' ? 'bg-green-500/20 text-green-400' :
                          endpoint.method === 'POST' ? 'bg-blue-500/20 text-blue-400' :
                          endpoint.method === 'PUT' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {endpoint.method}
                        </span>
                        <code className="text-gray-300">{endpoint.path}</code>
                        <span className="text-gray-500">- {endpoint.description}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {api.examples && api.examples.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Example</h4>
                    <div className="relative">
                      <pre className="p-3 bg-gray-900 rounded-lg text-xs overflow-x-auto">
                        <code className="text-gray-300">{api.examples[0].code}</code>
                      </pre>
                      <button
                        onClick={() => navigator.clipboard.writeText(api.examples![0].code)}
                        className="absolute top-2 right-2 p-1 hover:bg-gray-700 rounded"
                        title="Copy code"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ============================================================================
// MCP SERVERS LIST
// ============================================================================

const McpServersList: React.FC<{
  servers: McpServer[];
  expandedItems: Set<string>;
  onToggleExpand: (id: string) => void;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
}> = ({ servers, expandedItems, onToggleExpand, onToggleEnabled, onStart, onStop }) => {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'filesystem': return Server;
      case 'database': return Database;
      case 'search': return Search;
      case 'code': return Code;
      default: return Server;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'running': return 'text-green-400';
      case 'starting': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">
          MCP servers provide additional tools and capabilities to agents via the Model Context Protocol.
        </p>
      </div>

      {servers.map(server => {
        const isExpanded = expandedItems.has(server.id);
        const Icon = getCategoryIcon(server.category);
        const isRunning = server.status === 'running';

        return (
          <div
            key={server.id}
            className={`border rounded-lg transition-colors ${
              server.enabled ? 'border-gray-700 bg-gray-800/50' : 'border-gray-800 bg-gray-900/50 opacity-60'
            }`}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between p-3 cursor-pointer"
              onClick={() => onToggleExpand(server.id)}
            >
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
                <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{server.name}</span>
                    <span className={`flex items-center gap-1 text-xs ${getStatusColor(server.status)}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        server.status === 'running' ? 'bg-green-400' :
                        server.status === 'starting' ? 'bg-yellow-400 animate-pulse' :
                        server.status === 'error' ? 'bg-red-400' : 'bg-gray-500'
                      }`} />
                      {server.status || 'stopped'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">{server.tools.length} tools available</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {server.enabled && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      isRunning ? onStop(server.id) : onStart(server.id);
                    }}
                    className={`px-3 py-1 text-xs rounded-lg flex items-center gap-1 ${
                      isRunning
                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                        : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    }`}
                  >
                    {isRunning ? (
                      <>
                        <Square className="w-3 h-3" /> Stop
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3" /> Start
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleEnabled(server.id, !server.enabled);
                  }}
                  className={`w-10 h-5 rounded-full transition-colors ${
                    server.enabled ? 'bg-green-500' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transform transition-transform ${
                      server.enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-gray-700">
                <p className="text-sm text-gray-400 mt-3 mb-4">{server.description}</p>

                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Available Tools</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {server.tools.map((tool, i) => (
                      <div key={i} className="p-2 bg-gray-900 rounded-lg">
                        <div className="text-sm font-mono text-purple-400">{tool.name}</div>
                        <div className="text-xs text-gray-500">{tool.description}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Command</h4>
                  <code className="block p-2 bg-gray-900 rounded-lg text-xs text-gray-400">
                    {server.command} {server.args.join(' ')}
                  </code>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ============================================================================
// LLM PROVIDERS LIST
// ============================================================================

const LlmProvidersList: React.FC<{
  providers: LlmProvider[];
  expandedItems: Set<string>;
  onToggleExpand: (id: string) => void;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onSetDefault: (id: string) => void;
}> = ({ providers, expandedItems, onToggleExpand, onToggleEnabled, onSetDefault }) => {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'anthropic': return 'text-orange-400 bg-orange-500/20';
      case 'openai': return 'text-green-400 bg-green-500/20';
      case 'ollama': return 'text-blue-400 bg-blue-500/20';
      case 'groq': return 'text-purple-400 bg-purple-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">
          Configure LLM providers for agent tasks. The system will automatically route to the optimal provider.
        </p>
      </div>

      {providers.map(provider => {
        const isExpanded = expandedItems.has(provider.id);
        const colorClass = getTypeColor(provider.type);

        return (
          <div
            key={provider.id}
            className={`border rounded-lg transition-colors ${
              provider.enabled ? 'border-gray-700 bg-gray-800/50' : 'border-gray-800 bg-gray-900/50 opacity-60'
            }`}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between p-3 cursor-pointer"
              onClick={() => onToggleExpand(provider.id)}
            >
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
                <div className={`p-2 rounded-lg ${colorClass}`}>
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{provider.name}</span>
                    {provider.isDefault && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-purple-500/20 text-purple-400 rounded">
                        Default
                      </span>
                    )}
                    <span className={`px-1.5 py-0.5 text-[10px] rounded ${colorClass}`}>
                      {provider.type}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">{provider.models.length} models</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {provider.enabled && !provider.isDefault && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetDefault(provider.id);
                    }}
                    className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded-lg"
                  >
                    Set Default
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleEnabled(provider.id, !provider.enabled);
                  }}
                  className={`w-10 h-5 rounded-full transition-colors ${
                    provider.enabled ? 'bg-green-500' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transform transition-transform ${
                      provider.enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-gray-700">
                <div className="flex flex-wrap gap-2 mt-3 mb-4">
                  {provider.capabilities.map(cap => (
                    <span key={cap} className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded-lg">
                      {cap}
                    </span>
                  ))}
                </div>

                <div className="mb-4">
                  <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Models</h4>
                  <div className="space-y-2">
                    {provider.models.map(model => (
                      <div key={model.id} className="flex items-center justify-between p-2 bg-gray-900 rounded-lg">
                        <div>
                          <div className="text-sm font-medium">{model.name}</div>
                          <div className="text-xs text-gray-500">
                            {model.contextWindow.toLocaleString()} tokens
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {model.supportsVision && (
                            <span className="px-1.5 py-0.5 text-[10px] bg-blue-500/20 text-blue-400 rounded">
                              vision
                            </span>
                          )}
                          {model.supportsTools && (
                            <span className="px-1.5 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded">
                              tools
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Best For</h4>
                  <div className="flex flex-wrap gap-1">
                    {provider.useCases.map(useCase => (
                      <span key={useCase} className="px-2 py-1 text-xs bg-gray-800 text-gray-400 rounded">
                        {useCase}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ServiceCatalogPanel;
