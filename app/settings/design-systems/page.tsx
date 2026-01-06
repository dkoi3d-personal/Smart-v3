'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Palette,
  Upload,
  Trash2,
  Star,
  Loader2,
  Check,
  AlertCircle,
  Plus,
  FileJson,
  FileText,
  Eye,
  Copy,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DesignSystem, DesignSystemListItem } from '@/lib/design-systems/types';
import { ComponentPreview } from '@/components/design-system/ComponentPreview';

export default function DesignSystemsSettingsPage() {
  // State
  const [designSystems, setDesignSystems] = useState<DesignSystemListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSystem, setSelectedSystem] = useState<DesignSystem | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'tokens' | 'components' | 'guidelines' | 'examples'>('preview');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load design systems list
  useEffect(() => {
    loadDesignSystems();
  }, []);

  // Load selected system details
  useEffect(() => {
    if (selectedId) {
      loadSystemDetails(selectedId);
    } else {
      setSelectedSystem(null);
    }
  }, [selectedId]);

  const loadDesignSystems = async () => {
    try {
      const response = await fetch('/api/design-systems');
      if (response.ok) {
        const data = await response.json();
        setDesignSystems(data);
        // Auto-select first one
        if (data.length > 0 && !selectedId) {
          setSelectedId(data[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load design systems:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSystemDetails = async (id: string) => {
    setLoadingDetails(true);
    try {
      const response = await fetch(`/api/design-systems/${id}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedSystem(data);
      }
    } catch (error) {
      console.error('Failed to load design system:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    setSaving(true);
    try {
      const response = await fetch('/api/design-systems/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultDesignSystemId: id }),
      });
      if (response.ok) {
        await loadDesignSystems();
        if (selectedId === id) {
          await loadSystemDetails(id);
        }
      }
    } catch (error) {
      console.error('Failed to set default:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this design system?')) {
      return;
    }

    try {
      const response = await fetch(`/api/design-systems/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setSelectedId(null);
        await loadDesignSystems();
      }
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/design-systems/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setUploadDialogOpen(false);
      await loadDesignSystems();
      setSelectedId(data.designSystem.id);
    } catch (error: any) {
      setUploadError(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  const copyPromptToClipboard = async () => {
    if (!selectedSystem) return;

    // Generate a simple prompt representation
    const prompt = `Design System: ${selectedSystem.name}\n\nColors:\n${Object.entries(selectedSystem.tokens.colors).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\nGuidelines:\n${selectedSystem.guidelines}`;

    await navigator.clipboard.writeText(prompt);
  };

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
              <Palette className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-xl font-bold">Design Systems</h1>
                <p className="text-sm text-muted-foreground">
                  Manage design systems for AI code generation
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => setUploadDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {/* Design System List */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Available Design Systems ({designSystems.length})
              </h3>
              <ScrollArea className="h-[calc(100vh-200px)]">
                <div className="space-y-2 pr-4">
                  {designSystems.map((ds) => (
                    <Card
                      key={ds.id}
                      className={cn(
                        'cursor-pointer transition-all hover:border-primary/50',
                        selectedId === ds.id && 'border-primary bg-primary/5'
                      )}
                      onClick={() => setSelectedId(ds.id)}
                    >
                      <CardContent className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-muted">
                            <Palette className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">{ds.name}</span>
                              {ds.isDefault && (
                                <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>v{ds.version}</span>
                              {ds.isBuiltIn && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0">
                                  Built-in
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Editor Panel */}
            <div className="md:col-span-2">
              {loadingDetails ? (
                <Card>
                  <CardContent className="py-12 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </CardContent>
                </Card>
              ) : selectedSystem ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {selectedSystem.name}
                          {selectedSystem.isDefault && (
                            <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                              Default
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription>{selectedSystem.description}</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={copyPromptToClipboard}
                          title="Copy prompt to clipboard"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        {!selectedSystem.isDefault && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetDefault(selectedSystem.id)}
                            disabled={saving}
                          >
                            {saving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Star className="h-4 w-4 mr-2" />
                            )}
                            Set Default
                          </Button>
                        )}
                        {!selectedSystem.isBuiltIn && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(selectedSystem.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                      <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="preview" className="gap-1">
                          <Play className="h-3 w-3" />
                          Preview
                        </TabsTrigger>
                        <TabsTrigger value="tokens">Tokens</TabsTrigger>
                        <TabsTrigger value="components">Components</TabsTrigger>
                        <TabsTrigger value="guidelines">Guidelines</TabsTrigger>
                        <TabsTrigger value="examples">Examples</TabsTrigger>
                      </TabsList>

                      <TabsContent value="preview" className="mt-4">
                        <ComponentPreview designSystem={selectedSystem} />
                      </TabsContent>

                      <TabsContent value="tokens" className="mt-4">
                        <ScrollArea className="h-[400px]">
                          <div className="space-y-6 pr-4">
                            {/* Colors */}
                            <div>
                              <h4 className="font-medium mb-3">Colors</h4>
                              <div className="grid grid-cols-2 gap-2">
                                {Object.entries(selectedSystem.tokens.colors).map(([name, value]) => (
                                  <div
                                    key={name}
                                    className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                                  >
                                    <div
                                      className="w-6 h-6 rounded border"
                                      style={{ backgroundColor: value as string }}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium truncate">{name}</p>
                                      <p className="text-[10px] text-muted-foreground truncate">
                                        {value as string}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Typography */}
                            <div>
                              <h4 className="font-medium mb-3">Typography</h4>
                              <div className="space-y-2">
                                <div className="p-2 rounded-lg bg-muted/50">
                                  <p className="text-xs font-medium">Font Family (Sans)</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {selectedSystem.tokens.typography.fontFamily.sans}
                                  </p>
                                </div>
                                <div className="p-2 rounded-lg bg-muted/50">
                                  <p className="text-xs font-medium">Font Family (Mono)</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {selectedSystem.tokens.typography.fontFamily.mono}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Border Radius */}
                            <div>
                              <h4 className="font-medium mb-3">Border Radius</h4>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(selectedSystem.tokens.radii).map(([name, value]) => (
                                  <div
                                    key={name}
                                    className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                                  >
                                    <div
                                      className="w-6 h-6 bg-primary/20 border border-primary/50"
                                      style={{ borderRadius: value }}
                                    />
                                    <div>
                                      <p className="text-xs font-medium">{name}</p>
                                      <p className="text-[10px] text-muted-foreground">{value}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </ScrollArea>
                      </TabsContent>

                      <TabsContent value="components" className="mt-4">
                        <ScrollArea className="h-[400px]">
                          <div className="space-y-4 pr-4">
                            {Object.entries(selectedSystem.components).map(([key, spec]) => (
                              <Card key={key} className="bg-muted/30">
                                <CardHeader className="py-3">
                                  <CardTitle className="text-sm">{spec.name}</CardTitle>
                                  <CardDescription className="text-xs">
                                    {spec.description}
                                  </CardDescription>
                                </CardHeader>
                                <CardContent className="py-2">
                                  <div className="flex flex-wrap gap-1">
                                    {spec.variants?.map((v) => (
                                      <Badge key={v} variant="outline" className="text-[10px]">
                                        {v}
                                      </Badge>
                                    ))}
                                  </div>
                                  {spec.doAndDont && (spec.doAndDont.do?.length > 0 || spec.doAndDont.dont?.length > 0) && (
                                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                      {spec.doAndDont.do?.[0] && (
                                        <div className="p-2 rounded bg-emerald-500/10 text-emerald-400">
                                          <p className="font-medium">Do</p>
                                          <p className="text-[10px]">{spec.doAndDont.do[0]}</p>
                                        </div>
                                      )}
                                      {spec.doAndDont.dont?.[0] && (
                                        <div className="p-2 rounded bg-red-500/10 text-red-400">
                                          <p className="font-medium">Don&apos;t</p>
                                          <p className="text-[10px]">{spec.doAndDont.dont[0]}</p>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </ScrollArea>
                      </TabsContent>

                      <TabsContent value="guidelines" className="mt-4">
                        <ScrollArea className="h-[400px]">
                          <div className="prose prose-sm prose-invert max-w-none pr-4">
                            <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/50 p-4 rounded-lg">
                              {selectedSystem.guidelines || 'No guidelines defined.'}
                            </pre>
                          </div>
                        </ScrollArea>
                      </TabsContent>

                      <TabsContent value="examples" className="mt-4">
                        <ScrollArea className="h-[400px]">
                          <div className="space-y-4 pr-4">
                            {selectedSystem.examples.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-8">
                                No code examples defined.
                              </p>
                            ) : (
                              selectedSystem.examples.map((example) => (
                                <Card key={example.id} className="bg-muted/30">
                                  <CardHeader className="py-3">
                                    <CardTitle className="text-sm">{example.title}</CardTitle>
                                    <CardDescription className="text-xs">
                                      {example.description}
                                    </CardDescription>
                                  </CardHeader>
                                  <CardContent className="py-2">
                                    <pre className="text-xs overflow-x-auto bg-background/50 p-3 rounded">
                                      <code>{example.code}</code>
                                    </pre>
                                    <div className="flex gap-1 mt-2">
                                      {example.tags.map((tag) => (
                                        <Badge key={tag} variant="outline" className="text-[10px]">
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                  </CardContent>
                                </Card>
                              ))
                            )}
                          </div>
                        </ScrollArea>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Palette className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>Select a design system to view details</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Design System</DialogTitle>
            <DialogDescription>
              Upload a design system file in JSON or Markdown format.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* File types info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <FileJson className="h-5 w-5 text-blue-400" />
                  <span className="font-medium text-sm">JSON</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Full design system with tokens, components, and examples
                </p>
              </div>
              <div className="p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-5 w-5 text-green-400" />
                  <span className="font-medium text-sm">Markdown</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Design documentation with colors and guidelines
                </p>
              </div>
            </div>

            {/* Upload area */}
            <div
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                'hover:border-primary/50 hover:bg-primary/5'
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.md,.markdown"
                onChange={handleFileSelect}
                className="hidden"
              />
              {uploading ? (
                <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-muted-foreground" />
              ) : (
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              )}
              <p className="text-sm">
                {uploading ? 'Uploading...' : 'Click to select a file'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports .json and .md files (max 5MB)
              </p>
            </div>

            {/* Error message */}
            {uploadError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {uploadError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
