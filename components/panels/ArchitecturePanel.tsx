'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  FileCode2,
  Database,
  Network,
  Bot,
  RefreshCw,
  Search,
  ChevronRight,
  ChevronDown,
  Layers,
  Box,
  GitBranch,
  Code2,
  FileJson,
  Workflow,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Copy,
  Download,
  Clock,
  Sparkles,
  FolderTree,
  Hash,
  List,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { useArchitectureStore } from '@/stores/architecture-store';
import { cn } from '@/lib/utils';
import { MermaidDiagram } from '@/components/MermaidDiagram';
import type {
  ArchitectureDiagram,
  ComponentDoc,
  DataModel,
  APIEndpoint,
  AgentDocumentation,
  DiagramType,
} from '@/lib/architecture/types';

interface ArchitecturePanelProps {
  projectId: string;
  projectPath?: string; // Optional path for cloned repos or custom locations
  autoLoad?: boolean; // Auto-load existing documentation on mount
}

export function ArchitecturePanel({ projectId, projectPath, autoLoad = true }: ArchitecturePanelProps) {
  const {
    overview,
    activeTab,
    setActiveTab,
    generationStatus,
    isGenerating,
    error,
    searchQuery,
    setSearchQuery,
    selectedDiagram,
    selectDiagram,
    selectedComponent,
    selectComponent,
    selectedDataModel,
    selectDataModel,
    selectedEndpoint,
    selectEndpoint,
    selectedAgent,
    selectAgent,
    setOverview,
    startGeneration,
    completeGeneration,
    setGenerationStatus,
    setGenerationError,
    getFilteredDiagrams,
    getFilteredComponents,
    getFilteredEndpoints,
    getFilteredAgents,
    clearOverview,
  } = useArchitectureStore();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  // Generate architecture documentation
  const generateDocs = useCallback(async () => {
    if (isGenerating) return;

    startGeneration();
    setIsRefreshing(true);
    setLoadError(null);

    try {
      // Include projectPath if available for cloned repos
      const requestBody: { projectId: string; projectPath?: string } = { projectId };
      if (projectPath) {
        requestBody.projectPath = projectPath;
      }

      const response = await fetch('/api/architecture/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to generate documentation (${response.status})`);
      }

      // Handle streaming response for progress updates
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const data = JSON.parse(line);
              if (data.type === 'progress') {
                setGenerationStatus(data.status);
              } else if (data.type === 'complete') {
                setOverview(data.overview);
                completeGeneration();
              } else if (data.type === 'error') {
                setGenerationError(data.message);
              }
            } catch {
              // Skip invalid JSON lines
              console.warn('Invalid JSON in stream:', line.slice(0, 100));
            }
          }
        }

        // Process any remaining buffer
        if (buffer.trim()) {
          try {
            const data = JSON.parse(buffer);
            if (data.type === 'complete') {
              setOverview(data.overview);
              completeGeneration();
            }
          } catch {
            // Ignore incomplete data
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setGenerationError(message);
      setLoadError(message);
    } finally {
      setIsRefreshing(false);
    }
  }, [projectId, projectPath, isGenerating, startGeneration, setGenerationStatus, setOverview, completeGeneration, setGenerationError]);

  // Load existing documentation on mount with better error handling
  useEffect(() => {
    // Prevent double-loading in React strict mode
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const loadExisting = async () => {
      if (!autoLoad) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetch(`/api/architecture/${projectId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.overview) {
            setOverview(data.overview);
            // Auto-select first items for better UX
            if (data.overview.diagrams?.length > 0) {
              selectDiagram(data.overview.diagrams[0]);
            }
          }
        } else if (response.status !== 404) {
          const errorData = await response.json().catch(() => ({}));
          setLoadError(errorData.error || 'Failed to load architecture data');
        }
      } catch (err) {
        console.warn('Could not load existing architecture documentation:', err);
        setLoadError('Failed to connect to server');
      } finally {
        setIsLoading(false);
      }
    };

    loadExisting();
  }, [projectId, autoLoad, setOverview, selectDiagram]);

  // Reset when projectId changes
  useEffect(() => {
    return () => {
      hasLoadedRef.current = false;
    };
  }, [projectId]);

  const copyToClipboard = (text: string, id?: string) => {
    navigator.clipboard.writeText(text);
    if (id) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const downloadDiagram = (diagram: ArchitectureDiagram) => {
    const blob = new Blob([diagram.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${diagram.name.toLowerCase().replace(/\s+/g, '-')}.${diagram.format === 'mermaid' ? 'mmd' : diagram.format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Generate full ER diagram from all data models (no limits)
  // Only includes 'data', 'config', 'response', 'request' categories (excludes Props, Context, State)
  const generateFullERDiagram = (): string => {
    if (!overview?.dataModels?.length) return '';

    // Filter to only real data models (not Props, Context, State, etc.)
    const validCategories = ['data', 'config', 'response', 'request', 'enum'];
    const validModels = overview.dataModels.filter(m =>
      m.name &&
      m.fields &&
      m.fields.length > 0 &&
      /^[a-zA-Z]/.test(m.name) &&
      // Only include valid categories, or if no category is set (legacy data)
      (!m.category || validCategories.includes(m.category))
    );

    const sanitizeName = (name: string) =>
      name.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '') || 'Model';

    const modelNames = new Set(validModels.map(m => sanitizeName(m.name)));
    let entities = '';
    let relationships = '';
    const seenRelationships = new Set<string>();

    for (const model of validModels) {
      const modelName = sanitizeName(model.name);

      // All fields, no limit
      const fields = model.fields?.map(f => {
        let type = (f.type || 'any')
          .replace(/\|/g, '_or_')
          .replace(/[^a-zA-Z0-9_]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '')
          .substring(0, 15) || 'any';
        if (!/^[a-zA-Z]/.test(type)) type = 'any';

        let fieldName = (f.name || 'field')
          .replace(/[^a-zA-Z0-9_]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '')
          .substring(0, 20);
        if (!/^[a-zA-Z]/.test(fieldName)) fieldName = 'field';

        return `        ${type} ${fieldName}`;
      }).filter(Boolean).join('\n');

      if (fields) {
        entities += `    ${modelName} {\n${fields}\n    }\n`;
      }

      // All relationships, no limit
      for (const rel of (model.relationships || [])) {
        const targetName = sanitizeName(rel.targetModel);
        if (modelNames.has(targetName) && targetName !== modelName) {
          const relKey = [modelName, targetName].sort().join('_');
          if (seenRelationships.has(relKey)) continue;
          seenRelationships.add(relKey);

          const relType = rel.type === 'one-to-many' ? '||--o{' : '||--||';
          const fieldLabel = (rel.fieldName || 'ref').replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 15) || 'ref';
          relationships += `    ${modelName} ${relType} ${targetName} : "${fieldLabel}"\n`;
        }
      }
    }

    return `erDiagram\n${entities}${relationships}`;
  };

  // Open diagram in Mermaid Live Editor
  const openInMermaidLive = (diagram: ArchitectureDiagram) => {
    // For ER diagrams, generate full content from all data models
    let content = diagram.content;
    if (diagram.type === 'entity-relationship' && overview?.dataModels?.length) {
      content = generateFullERDiagram();
    }

    // Mermaid Live expects base64-encoded JSON with the diagram code
    const state = {
      code: content,
      mermaid: { theme: 'dark' },
      autoSync: true,
      updateDiagram: true,
    };
    const encoded = btoa(JSON.stringify(state));
    const url = `https://mermaid.live/edit#base64:${encoded}`;
    window.open(url, '_blank');
  };

  // Format date for display
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get complexity color
  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'low': return 'text-green-500 bg-green-500/10';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10';
      case 'high': return 'text-red-500 bg-red-500/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  return (
    <div className="h-full flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-500" />
            Architecture
            {overview && (
              <Badge variant="secondary" className="text-xs font-normal">
                {overview.components?.length || 0} components
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {overview && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearOverview()}
                className="text-muted-foreground hover:text-foreground"
              >
                Clear
              </Button>
            )}
            <Button
              variant={overview ? 'outline' : 'default'}
              size="sm"
              onClick={generateDocs}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className={cn('w-4 h-4 mr-1')} />
              )}
              {isGenerating ? 'Generating...' : overview ? 'Regenerate' : 'Generate'}
            </Button>
          </div>
        </div>

        {/* Search - only show if we have data */}
        {overview && (
          <div className="relative mt-2">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search architecture..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8"
            />
          </div>
        )}

        {/* Last updated timestamp */}
        {overview?.lastUpdated && !isGenerating && (
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            Last updated: {formatDate(overview.lastUpdated)}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        {/* Generation Progress */}
        {isGenerating && generationStatus && (
          <div className="px-4 py-2 border-b bg-muted/50">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">{generationStatus.currentPhase}</span>
              <span className="font-medium">{generationStatus.progress}%</span>
            </div>
            <Progress value={generationStatus.progress} className="h-1" />
            <div className="flex flex-wrap gap-1 mt-2">
              {generationStatus.stages.map((stage) => (
                <Badge
                  key={stage.name}
                  variant={
                    stage.status === 'complete' ? 'default' :
                    stage.status === 'in_progress' ? 'secondary' :
                    'outline'
                  }
                  className="text-xs"
                >
                  {stage.status === 'complete' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                  {stage.status === 'in_progress' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  {stage.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Error Display */}
        {(error || loadError) && (
          <div className="px-4 py-2 bg-destructive/10 border-b flex items-center justify-between text-sm text-destructive">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error || loadError}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => {
                setGenerationError('');
                setLoadError(null);
              }}
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !isGenerating && !overview && (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading architecture data...</span>
          </div>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="h-full flex flex-col">
          <TabsList className="mx-4 mt-2 flex-shrink-0">
            <TabsTrigger value="overview" className="text-xs">
              <Layers className="w-3 h-3 mr-1" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="diagrams" className="text-xs">
              <GitBranch className="w-3 h-3 mr-1" />
              Diagrams
            </TabsTrigger>
            <TabsTrigger value="components" className="text-xs">
              <Box className="w-3 h-3 mr-1" />
              Components
            </TabsTrigger>
            <TabsTrigger value="data-models" className="text-xs">
              <Database className="w-3 h-3 mr-1" />
              Models
            </TabsTrigger>
            <TabsTrigger value="api" className="text-xs">
              <Network className="w-3 h-3 mr-1" />
              API
            </TabsTrigger>
            <TabsTrigger value="agents" className="text-xs">
              <Bot className="w-3 h-3 mr-1" />
              Agents
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden">
            {/* Overview Tab */}
            <TabsContent value="overview" className="h-full m-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-4">
                  {overview ? (
                    <>
                      {/* Project Header */}
                      <div className="p-4 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-lg">{overview.projectName}</h3>
                            <p className="text-sm text-muted-foreground mt-1">{overview.description}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            v{overview.version}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(overview.lastUpdated)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Generated by {overview.generatedBy || 'agent'}
                          </span>
                        </div>
                      </div>

                      {/* Tech Stack */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          <Zap className="w-4 h-4 text-yellow-500" />
                          Tech Stack
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {overview.techStack.map((tech, i) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className={cn(
                                "text-xs",
                                tech.category === 'frontend' && 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
                                tech.category === 'backend' && 'bg-green-500/10 text-green-700 dark:text-green-300',
                                tech.category === 'database' && 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
                                tech.category === 'infrastructure' && 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
                                tech.category === 'testing' && 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
                                tech.category === 'devops' && 'bg-red-500/10 text-red-700 dark:text-red-300',
                                tech.category === 'ai' && 'bg-pink-500/10 text-pink-700 dark:text-pink-300'
                              )}
                            >
                              {tech.name} {tech.version && `v${tech.version}`}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Quick Stats with Navigation */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          <Hash className="w-4 h-4 text-purple-500" />
                          Quick Stats
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          <StatCard
                            icon={<GitBranch className="w-4 h-4" />}
                            label="Diagrams"
                            value={overview.diagrams.length}
                            onClick={() => setActiveTab('diagrams')}
                          />
                          <StatCard
                            icon={<Box className="w-4 h-4" />}
                            label="Components"
                            value={overview.components.length}
                            onClick={() => setActiveTab('components')}
                          />
                          <StatCard
                            icon={<Database className="w-4 h-4" />}
                            label="Data Models"
                            value={overview.dataModels.length}
                            onClick={() => setActiveTab('data-models')}
                          />
                          <StatCard
                            icon={<Network className="w-4 h-4" />}
                            label="API Endpoints"
                            value={overview.apiDocumentation?.endpoints.length || 0}
                            onClick={() => setActiveTab('api')}
                          />
                          <StatCard
                            icon={<Bot className="w-4 h-4" />}
                            label="Agents"
                            value={overview.agents.length}
                            onClick={() => setActiveTab('agents')}
                          />
                          <StatCard
                            icon={<Workflow className="w-4 h-4" />}
                            label="Patterns"
                            value={overview.designPatterns.length}
                          />
                        </div>
                      </div>

                      {/* Component Summary by Type */}
                      {overview.components.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium flex items-center gap-2">
                            <FolderTree className="w-4 h-4 text-blue-500" />
                            Component Breakdown
                          </h4>
                          <div className="grid grid-cols-3 gap-2">
                            {['page', 'component', 'hook', 'store', 'service', 'api', 'utility'].map((type) => {
                              const count = overview.components.filter(c => c.type === type).length;
                              if (count === 0) return null;
                              return (
                                <div
                                  key={type}
                                  className="p-2 rounded bg-muted/50 text-xs cursor-pointer hover:bg-muted transition-colors"
                                  onClick={() => setActiveTab('components')}
                                >
                                  <div className="font-medium capitalize">{type}s</div>
                                  <div className="text-muted-foreground">{count}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Design Patterns */}
                      {overview.designPatterns.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium flex items-center gap-2">
                            <List className="w-4 h-4 text-green-500" />
                            Design Patterns ({overview.designPatterns.length})
                          </h4>
                          <div className="space-y-1.5">
                            {overview.designPatterns.slice(0, 5).map((pattern, i) => (
                              <div key={i} className="p-2.5 bg-muted/50 rounded-lg text-xs border border-transparent hover:border-border transition-colors">
                                <div className="font-medium flex items-center gap-2">
                                  {pattern.name}
                                  {pattern.category && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                      {pattern.category}
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-muted-foreground mt-0.5">{pattern.description}</div>
                                {pattern.files && pattern.files.length > 0 && (
                                  <div className="flex items-center gap-1 mt-1.5">
                                    <span className="text-muted-foreground">Used in:</span>
                                    {pattern.files.slice(0, 3).map((loc, j) => (
                                      <Badge key={j} variant="secondary" className="text-[10px] px-1.5 py-0">
                                        {loc.split('/').pop()}
                                      </Badge>
                                    ))}
                                    {pattern.files.length > 3 && (
                                      <span className="text-muted-foreground">+{pattern.files.length - 3}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                            {overview.designPatterns.length > 5 && (
                              <p className="text-xs text-muted-foreground text-center">
                                +{overview.designPatterns.length - 5} more patterns
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* API Summary */}
                      {overview.apiDocumentation && overview.apiDocumentation.endpoints.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium flex items-center gap-2">
                            <Network className="w-4 h-4 text-orange-500" />
                            API Overview
                          </h4>
                          <div className="p-3 rounded-lg bg-muted/50">
                            <div className="text-xs space-y-1">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Base URL:</span>
                                <code className="text-xs">{overview.apiDocumentation.baseUrl || '/api'}</code>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Endpoints:</span>
                                <span>{overview.apiDocumentation.endpoints.length}</span>
                              </div>
                              <div className="flex gap-2 mt-2">
                                {['GET', 'POST', 'PUT', 'DELETE'].map((method) => {
                                  const count = overview.apiDocumentation!.endpoints.filter(e => e.method === method).length;
                                  if (count === 0) return null;
                                  return (
                                    <Badge
                                      key={method}
                                      variant="outline"
                                      className={cn(
                                        "text-[10px]",
                                        method === 'GET' && 'border-green-500/50 text-green-600',
                                        method === 'POST' && 'border-blue-500/50 text-blue-600',
                                        method === 'PUT' && 'border-orange-500/50 text-orange-600',
                                        method === 'DELETE' && 'border-red-500/50 text-red-600'
                                      )}
                                    >
                                      {method} ({count})
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <EmptyState
                      icon={<Layers className="w-12 h-12" />}
                      title="No Architecture Documentation"
                      description="Click 'Generate' to analyze your project and create comprehensive architecture documentation including components, data models, API docs, and diagrams."
                    />
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Diagrams Tab */}
            <TabsContent value="diagrams" className="h-full m-0">
              <div className="h-full flex">
                {/* Diagram List */}
                <div className="w-48 border-r flex-shrink-0">
                  <ScrollArea className="h-full">
                    <div className="p-2 space-y-1">
                      {getFilteredDiagrams().map((diagram) => (
                        <DiagramListItem
                          key={diagram.id}
                          diagram={diagram}
                          isSelected={selectedDiagram?.id === diagram.id}
                          onClick={() => selectDiagram(diagram)}
                        />
                      ))}
                      {getFilteredDiagrams().length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          No diagrams available
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Diagram View */}
                <div className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    {selectedDiagram ? (
                      <div className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">{selectedDiagram.name}</h3>
                            <p className="text-sm text-muted-foreground">{selectedDiagram.description}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(selectedDiagram.content)}
                              title="Copy diagram source"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadDiagram(selectedDiagram)}
                              title="Download diagram"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openInMermaidLive(selectedDiagram)}
                              title="Open in Mermaid Live Editor"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Mermaid Diagram Preview */}
                        <div className="border rounded-lg overflow-hidden">
                          <MermaidDiagram content={selectedDiagram.content} />
                        </div>

                        {/* Diagram Source */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">Source ({selectedDiagram.format})</h4>
                          <pre className="p-3 bg-muted rounded text-xs overflow-x-auto">
                            {selectedDiagram.content}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <EmptyState
                        icon={<GitBranch className="w-12 h-12" />}
                        title="Select a Diagram"
                        description="Choose a diagram from the list to view details"
                      />
                    )}
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>

            {/* Components Tab */}
            <TabsContent value="components" className="h-full m-0">
              <div className="h-full flex">
                {/* Component List */}
                <div className="w-48 border-r flex-shrink-0">
                  <ScrollArea className="h-full">
                    <div className="p-2 space-y-1">
                      {getFilteredComponents().map((component) => (
                        <ComponentListItem
                          key={component.id}
                          component={component}
                          isSelected={selectedComponent?.id === component.id}
                          onClick={() => selectComponent(component)}
                        />
                      ))}
                      {getFilteredComponents().length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          No components available
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Component Details */}
                <div className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    {selectedComponent ? (
                      <div className="p-4 space-y-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{selectedComponent.name}</h3>
                            <Badge variant="outline" className="text-xs">{selectedComponent.type}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{selectedComponent.description}</p>
                          <p className="text-xs text-muted-foreground font-mono">{selectedComponent.path}</p>
                        </div>

                        {/* Props */}
                        {selectedComponent.props && selectedComponent.props.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">Props</h4>
                            <div className="space-y-1">
                              {selectedComponent.props.map((prop, i) => (
                                <div key={i} className="p-2 bg-muted/50 rounded text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-medium">{prop.name}</span>
                                    <Badge variant="secondary" className="text-xs">{prop.type}</Badge>
                                    {prop.required && <Badge variant="destructive" className="text-xs">required</Badge>}
                                  </div>
                                  <p className="text-muted-foreground mt-1">{prop.description}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Dependencies */}
                        {selectedComponent.dependencies.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">Dependencies</h4>
                            <div className="flex flex-wrap gap-1">
                              {selectedComponent.dependencies.map((dep, i) => (
                                <Badge key={i} variant="outline" className="text-xs">{dep}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Stats */}
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>Lines: {selectedComponent.linesOfCode}</span>
                          <span>Complexity: {selectedComponent.complexity}</span>
                        </div>
                      </div>
                    ) : (
                      <EmptyState
                        icon={<Box className="w-12 h-12" />}
                        title="Select a Component"
                        description="Choose a component from the list to view details"
                      />
                    )}
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>

            {/* Data Models Tab */}
            <TabsContent value="data-models" className="h-full m-0">
              <div className="h-full flex">
                {/* Model List */}
                <div className="w-48 border-r flex-shrink-0">
                  <ScrollArea className="h-full">
                    <div className="p-2 space-y-1">
                      {overview?.dataModels.map((model) => (
                        <DataModelListItem
                          key={model.id}
                          model={model}
                          isSelected={selectedDataModel?.id === model.id}
                          onClick={() => selectDataModel(model)}
                        />
                      ))}
                      {(!overview?.dataModels || overview.dataModels.length === 0) && (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          No data models available
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Model Details */}
                <div className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    {selectedDataModel ? (
                      <div className="p-4 space-y-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold font-mono">{selectedDataModel.name}</h3>
                            {selectedDataModel.category && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-xs uppercase',
                                  selectedDataModel.category === 'data' && 'border-emerald-500 text-emerald-500',
                                  selectedDataModel.category === 'config' && 'border-blue-500 text-blue-500',
                                  selectedDataModel.category === 'response' && 'border-purple-500 text-purple-500',
                                  selectedDataModel.category === 'request' && 'border-orange-500 text-orange-500',
                                  selectedDataModel.category === 'enum' && 'border-yellow-500 text-yellow-500',
                                )}
                              >
                                {selectedDataModel.category}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{selectedDataModel.description}</p>
                          {selectedDataModel.filePath && (
                            <p className="text-xs text-muted-foreground mt-1 font-mono">
                              📁 {selectedDataModel.filePath}
                            </p>
                          )}
                        </div>

                        {/* Fields */}
                        {selectedDataModel.fields && selectedDataModel.fields.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">Fields</h4>
                            <div className="border rounded overflow-hidden">
                              <table className="w-full text-xs">
                                <thead className="bg-muted">
                                  <tr>
                                    <th className="text-left p-2">Name</th>
                                    <th className="text-left p-2">Type</th>
                                    <th className="text-left p-2">Required</th>
                                    <th className="text-left p-2">Description</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {selectedDataModel.fields.map((field, i) => (
                                    <tr key={i} className="border-t">
                                      <td className="p-2 font-mono">{field.name}</td>
                                      <td className="p-2 font-mono text-muted-foreground">{field.type}</td>
                                      <td className="p-2">{field.required ? 'Yes' : 'No'}</td>
                                      <td className="p-2 text-muted-foreground">{field.description}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Relationships */}
                        {selectedDataModel.relationships && selectedDataModel.relationships.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">Relationships</h4>
                            <div className="space-y-1">
                              {selectedDataModel.relationships.map((rel, i) => (
                                <div key={i} className="p-2 bg-muted/50 rounded text-xs flex items-center gap-2">
                                  <Badge variant="outline">{rel.type}</Badge>
                                  <span className="font-mono">{rel.targetModel}</span>
                                  <span className="text-muted-foreground">via {rel.fieldName}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <EmptyState
                        icon={<Database className="w-12 h-12" />}
                        title="Select a Data Model"
                        description="Choose a model from the list to view details"
                      />
                    )}
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>

            {/* API Tab */}
            <TabsContent value="api" className="h-full m-0">
              <div className="h-full flex">
                {/* Endpoint List */}
                <div className="w-56 border-r flex-shrink-0">
                  <ScrollArea className="h-full">
                    <div className="p-2 space-y-1">
                      {getFilteredEndpoints().map((endpoint) => (
                        <EndpointListItem
                          key={endpoint.id}
                          endpoint={endpoint}
                          isSelected={selectedEndpoint?.id === endpoint.id}
                          onClick={() => selectEndpoint(endpoint)}
                        />
                      ))}
                      {getFilteredEndpoints().length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          No endpoints available
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Endpoint Details */}
                <div className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    {selectedEndpoint ? (
                      <div className="p-4 space-y-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <MethodBadge method={selectedEndpoint.method} />
                            <span className="font-mono text-sm">{selectedEndpoint.path}</span>
                          </div>
                          <h3 className="font-semibold mt-2">{selectedEndpoint.summary}</h3>
                          <p className="text-sm text-muted-foreground">{selectedEndpoint.description}</p>
                        </div>

                        {/* Tags */}
                        {selectedEndpoint.tags && selectedEndpoint.tags.length > 0 && (
                          <div className="flex gap-1">
                            {selectedEndpoint.tags.map((tag, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
                            ))}
                          </div>
                        )}

                        {/* Parameters */}
                        {selectedEndpoint.parameters && selectedEndpoint.parameters.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">Parameters</h4>
                            <div className="space-y-1">
                              {selectedEndpoint.parameters.map((param, i) => (
                                <div key={i} className="p-2 bg-muted/50 rounded text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-medium">{param.name}</span>
                                    <Badge variant="secondary">{param.in}</Badge>
                                    <Badge variant="outline">{param.type}</Badge>
                                    {param.required && <Badge variant="destructive">required</Badge>}
                                  </div>
                                  <p className="text-muted-foreground mt-1">{param.description}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Request Body */}
                        {selectedEndpoint.requestBody && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">Request Body</h4>
                            <div className="p-2 bg-muted/50 rounded text-xs">
                              <p className="text-muted-foreground">{selectedEndpoint.requestBody.description}</p>
                              {selectedEndpoint.requestBody.example && (
                                <pre className="mt-2 p-2 bg-background rounded overflow-x-auto">
                                  {JSON.stringify(selectedEndpoint.requestBody.example, null, 2)}
                                </pre>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Responses */}
                        {selectedEndpoint.responses && selectedEndpoint.responses.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">Responses</h4>
                            <div className="space-y-1">
                              {selectedEndpoint.responses.map((response, i) => (
                                <div key={i} className="p-2 bg-muted/50 rounded text-xs">
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant={response.statusCode < 300 ? 'default' : response.statusCode < 400 ? 'secondary' : 'destructive'}
                                    >
                                      {response.statusCode}
                                    </Badge>
                                    <span className="text-muted-foreground">{response.description}</span>
                                  </div>
                                  {response.example && (
                                    <pre className="mt-2 p-2 bg-background rounded overflow-x-auto">
                                      {JSON.stringify(response.example, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <EmptyState
                        icon={<Network className="w-12 h-12" />}
                        title="Select an Endpoint"
                        description="Choose an API endpoint from the list to view details"
                      />
                    )}
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>

            {/* Agents Tab */}
            <TabsContent value="agents" className="h-full m-0">
              <div className="h-full flex">
                {/* Agent List */}
                <div className="w-48 border-r flex-shrink-0">
                  <ScrollArea className="h-full">
                    <div className="p-2 space-y-1">
                      {getFilteredAgents().map((agent) => (
                        <AgentListItem
                          key={agent.id}
                          agent={agent}
                          isSelected={selectedAgent?.id === agent.id}
                          onClick={() => selectAgent(agent)}
                        />
                      ))}
                      {getFilteredAgents().length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          No agents available
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Agent Details */}
                <div className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    {selectedAgent ? (
                      <div className="p-4 space-y-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <Bot className="w-5 h-5 text-purple-500" />
                            <h3 className="font-semibold">{selectedAgent.name}</h3>
                            <Badge variant="secondary">{selectedAgent.type}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{selectedAgent.description}</p>
                        </div>

                        {/* Responsibilities */}
                        {selectedAgent.responsibilities && selectedAgent.responsibilities.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">Responsibilities</h4>
                            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                              {selectedAgent.responsibilities.map((resp, i) => (
                                <li key={i}>{resp}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Capabilities */}
                        {selectedAgent.capabilities && selectedAgent.capabilities.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">Capabilities</h4>
                            <div className="flex flex-wrap gap-1">
                              {selectedAgent.capabilities.map((cap, i) => (
                                <Badge key={i} variant="outline" className="text-xs">{cap}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Tools */}
                        {selectedAgent.tools && selectedAgent.tools.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">Tools</h4>
                            <div className="space-y-1">
                              {selectedAgent.tools.map((tool, i) => (
                                <div key={i} className="p-2 bg-muted/50 rounded text-xs">
                                  <div className="font-medium font-mono">{tool.name}</div>
                                  <p className="text-muted-foreground">{tool.description}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Interactions */}
                        {selectedAgent.interactions && selectedAgent.interactions.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">Interactions</h4>
                            <div className="space-y-1">
                              {selectedAgent.interactions.map((int, i) => (
                                <div key={i} className="p-2 bg-muted/50 rounded text-xs flex items-center gap-2">
                                  <Badge variant="outline">{int.type}</Badge>
                                  <span>{int.withAgent}</span>
                                  <span className="text-muted-foreground">- {int.description}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Limitations */}
                        {selectedAgent.limitations && selectedAgent.limitations.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-orange-500">Limitations</h4>
                            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                              {selectedAgent.limitations.map((lim, i) => (
                                <li key={i}>{lim}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <EmptyState
                        icon={<Bot className="w-12 h-12" />}
                        title="Select an Agent"
                        description="Choose an agent from the list to view details"
                      />
                    )}
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </div>
  );
}

// Sub-components

function StatCard({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: number; onClick?: () => void }) {
  const content = (
    <>
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
      {onClick && <ArrowRight className="w-4 h-4 text-muted-foreground/50 ml-auto" />}
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="p-3 bg-muted/50 rounded-lg flex items-center gap-3 hover:bg-muted transition-colors text-left w-full"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="p-3 bg-muted/50 rounded-lg flex items-center gap-3">
      {content}
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
      <div className="opacity-50 mb-4">{icon}</div>
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm">{description}</p>
    </div>
  );
}

function DiagramListItem({ diagram, isSelected, onClick }: { diagram: ArchitectureDiagram; isSelected: boolean; onClick: () => void }) {
  const icons: Record<DiagramType, React.ReactNode> = {
    'system-overview': <Layers className="w-4 h-4" />,
    'component-diagram': <Box className="w-4 h-4" />,
    'sequence-diagram': <GitBranch className="w-4 h-4" />,
    'data-flow': <Workflow className="w-4 h-4" />,
    'deployment-diagram': <Network className="w-4 h-4" />,
    'entity-relationship': <Database className="w-4 h-4" />,
    'class-diagram': <FileCode2 className="w-4 h-4" />,
    'api-flow': <Network className="w-4 h-4" />,
    'state-management': <Zap className="w-4 h-4" />,
    'module-dependencies': <GitBranch className="w-4 h-4" />,
    'route-structure': <FolderTree className="w-4 h-4" />,
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-2 rounded text-xs hover:bg-muted transition-colors flex items-center gap-2',
        isSelected && 'bg-muted'
      )}
    >
      {icons[diagram.type] || <GitBranch className="w-4 h-4" />}
      <span className="truncate">{diagram.name}</span>
    </button>
  );
}

function ComponentListItem({ component, isSelected, onClick }: { component: ComponentDoc; isSelected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-2 rounded text-xs hover:bg-muted transition-colors',
        isSelected && 'bg-muted'
      )}
    >
      <div className="flex items-center gap-2">
        <Code2 className="w-4 h-4 text-blue-500" />
        <span className="truncate font-medium">{component.name}</span>
      </div>
      <div className="text-muted-foreground truncate ml-6">{component.type}</div>
    </button>
  );
}

function DataModelListItem({ model, isSelected, onClick }: { model: DataModel; isSelected: boolean; onClick: () => void }) {
  // Category badge color mapping
  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'data': return 'bg-emerald-500/20 text-emerald-500';
      case 'config': return 'bg-blue-500/20 text-blue-500';
      case 'response': return 'bg-purple-500/20 text-purple-500';
      case 'request': return 'bg-orange-500/20 text-orange-500';
      case 'enum': return 'bg-yellow-500/20 text-yellow-500';
      default: return 'bg-gray-500/20 text-gray-500';
    }
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-2 rounded text-xs hover:bg-muted transition-colors',
        isSelected && 'bg-muted'
      )}
    >
      <div className="flex items-center gap-2">
        <FileJson className="w-4 h-4 text-green-500" />
        <span className="truncate font-mono flex-1">{model.name}</span>
        {model.category && (
          <span className={cn('px-1.5 py-0.5 rounded text-[10px] uppercase font-medium', getCategoryColor(model.category))}>
            {model.category}
          </span>
        )}
      </div>
      <div className="text-muted-foreground truncate ml-6">{model.fields?.length || 0} fields</div>
    </button>
  );
}

function EndpointListItem({ endpoint, isSelected, onClick }: { endpoint: APIEndpoint; isSelected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-2 rounded text-xs hover:bg-muted transition-colors',
        isSelected && 'bg-muted'
      )}
    >
      <div className="flex items-center gap-2">
        <MethodBadge method={endpoint.method} size="sm" />
        <span className="truncate font-mono">{endpoint.path}</span>
      </div>
      <div className="text-muted-foreground truncate ml-12">{endpoint.summary}</div>
    </button>
  );
}

function AgentListItem({ agent, isSelected, onClick }: { agent: AgentDocumentation; isSelected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-2 rounded text-xs hover:bg-muted transition-colors',
        isSelected && 'bg-muted'
      )}
    >
      <div className="flex items-center gap-2">
        <Bot className="w-4 h-4 text-purple-500" />
        <span className="truncate font-medium">{agent.name}</span>
      </div>
      <div className="text-muted-foreground truncate ml-6">{agent.type}</div>
    </button>
  );
}

function MethodBadge({ method, size = 'default' }: { method: APIEndpoint['method']; size?: 'sm' | 'default' }) {
  const colors: Record<string, string> = {
    GET: 'bg-green-500',
    POST: 'bg-blue-500',
    PUT: 'bg-orange-500',
    PATCH: 'bg-yellow-500',
    DELETE: 'bg-red-500',
  };

  return (
    <span
      className={cn(
        'text-white font-bold rounded',
        colors[method] || 'bg-gray-500',
        size === 'sm' ? 'px-1 text-[10px]' : 'px-2 py-0.5 text-xs'
      )}
    >
      {method}
    </span>
  );
}

export default ArchitecturePanel;
