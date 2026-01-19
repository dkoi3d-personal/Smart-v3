'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
  Link2,
  RefreshCw,
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

  // Figma import state
  const [figmaDialogOpen, setFigmaDialogOpen] = useState(false);
  const [figmaUrl, setFigmaUrl] = useState('');
  const [figmaName, setFigmaName] = useState('');
  const [figmaSetDefault, setFigmaSetDefault] = useState(false);
  const [figmaImporting, setFigmaImporting] = useState(false);
  const [figmaError, setFigmaError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

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

  const handleFigmaImport = async () => {
    if (!figmaUrl.trim()) {
      setFigmaError('Please enter a Figma URL');
      return;
    }

    setFigmaImporting(true);
    setFigmaError(null);

    try {
      const response = await fetch('/api/design-systems/import-figma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          figmaUrl: figmaUrl.trim(),
          name: figmaName.trim() || undefined,
          setAsDefault: figmaSetDefault,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setFigmaDialogOpen(false);
      setFigmaUrl('');
      setFigmaName('');
      setFigmaSetDefault(false);
      await loadDesignSystems();
      setSelectedId(data.designSystem.id);
    } catch (error: any) {
      setFigmaError(error.message);
    } finally {
      setFigmaImporting(false);
    }
  };

  const handleSync = async () => {
    if (!selectedSystem?.figmaSource) return;

    setSyncing(true);
    try {
      const response = await fetch(`/api/design-systems/${selectedSystem.id}/sync`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sync failed');
      }

      await loadSystemDetails(selectedSystem.id);
    } catch (error: any) {
      console.error('Sync failed:', error);
      alert(`Sync failed: ${error.message}`);
    } finally {
      setSyncing(false);
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
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" className="text-xs sm:text-sm" onClick={() => setFigmaDialogOpen(true)}>
                <Link2 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Import from Figma</span>
                <span className="sm:hidden">Figma</span>
              </Button>
              <Button variant="outline" size="sm" className="text-xs sm:text-sm" onClick={() => setUploadDialogOpen(true)}>
                <Upload className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Upload</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-2 sm:p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Design System List */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Available Design Systems ({designSystems.length})
              </h3>
              <ScrollArea className="h-[200px] sm:h-[calc(100vh-200px)]">
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
                              {ds.figmaSourceUrl && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 border-purple-500/30 text-purple-400">
                                  Figma
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
            <div className="lg:col-span-2">
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
                        <CardDescription>
                          {selectedSystem.description}
                          {selectedSystem.figmaSource && (
                            <div className="flex items-center gap-2 mt-1 text-xs">
                              <Link2 className="h-3 w-3 text-purple-400" />
                              <span className="text-muted-foreground">
                                Synced from Figma
                                {selectedSystem.figmaSource.lastSyncedAt && (
                                  <> · Last sync: {new Date(selectedSystem.figmaSource.lastSyncedAt).toLocaleDateString()}</>
                                )}
                              </span>
                            </div>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex gap-1 sm:gap-2 flex-wrap justify-end">
                        {selectedSystem.figmaSource && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSync}
                            disabled={syncing}
                            title="Sync from Figma"
                            className="text-xs"
                          >
                            {syncing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4 sm:mr-1" />
                            )}
                            <span className="hidden sm:inline">Sync</span>
                          </Button>
                        )}
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
                            className="text-xs"
                          >
                            {saving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Star className="h-4 w-4 sm:mr-1" />
                            )}
                            <span className="hidden sm:inline">Set Default</span>
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
                      <div className="overflow-x-auto -mx-2 px-2">
                        <TabsList className="inline-flex w-auto min-w-full sm:grid sm:w-full sm:grid-cols-5">
                          <TabsTrigger value="preview" className="gap-1 text-xs sm:text-sm whitespace-nowrap">
                            <Play className="h-3 w-3" />
                            Preview
                          </TabsTrigger>
                          <TabsTrigger value="tokens" className="text-xs sm:text-sm whitespace-nowrap">Tokens</TabsTrigger>
                          <TabsTrigger value="components" className="text-xs sm:text-sm whitespace-nowrap">Components</TabsTrigger>
                          <TabsTrigger value="guidelines" className="text-xs sm:text-sm whitespace-nowrap">Guidelines</TabsTrigger>
                          <TabsTrigger value="examples" className="text-xs sm:text-sm whitespace-nowrap">Examples</TabsTrigger>
                        </TabsList>
                      </div>

                      <TabsContent value="preview" className="mt-4">
                        <ComponentPreview designSystem={selectedSystem} />
                      </TabsContent>

                      <TabsContent value="tokens" className="mt-4">
                        <ScrollArea className="h-[300px] sm:h-[400px]">
                          <div className="space-y-6 pr-4">
                            {/* Semantic Colors */}
                            <div>
                              <h4 className="font-medium mb-3 text-sm sm:text-base">Semantic Colors</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {Object.entries(selectedSystem.tokens.colors)
                                  .filter(([name]) => name !== 'custom' && typeof selectedSystem.tokens.colors[name as keyof typeof selectedSystem.tokens.colors] === 'string')
                                  .map(([name, value]) => (
                                  <div
                                    key={name}
                                    className="flex items-center gap-2 p-2 rounded-lg bg-neutral-800"
                                  >
                                    <div className="w-6 h-6 rounded bg-[repeating-conic-gradient(#666_0%_25%,#888_0%_50%)] bg-[length:8px_8px] p-0.5">
                                      <div
                                        className="w-full h-full rounded-sm"
                                        style={{ backgroundColor: value as string }}
                                      />
                                    </div>
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

                            {/* Custom/Extracted Colors (from Figma) */}
                            {selectedSystem.tokens.colors.custom && typeof selectedSystem.tokens.colors.custom === 'object' && (
                              <div>
                                <h4 className="font-medium mb-3 text-sm sm:text-base">
                                  Extracted Colors ({Object.keys(selectedSystem.tokens.colors.custom).length})
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {Object.entries(selectedSystem.tokens.colors.custom as Record<string, string>).map(([name, value]) => (
                                    <div
                                      key={name}
                                      className="flex items-center gap-2 p-1.5 rounded-lg bg-neutral-800"
                                    >
                                      <div className="w-5 h-5 rounded bg-[repeating-conic-gradient(#666_0%_25%,#888_0%_50%)] bg-[length:6px_6px] p-0.5 flex-shrink-0">
                                        <div
                                          className="w-full h-full rounded-sm"
                                          style={{ backgroundColor: value }}
                                        />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-medium truncate" title={name}>{name}</p>
                                        <p className="text-[9px] text-muted-foreground truncate">
                                          {value}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

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
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 mb-4">
                          <p className="text-sm font-medium text-primary">Component Library</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Use the <strong>Preview</strong> tab to see live components with design tokens applied.
                            Toggle between light/dark mode using the sun/moon button.
                          </p>
                        </div>
                        <ComponentPreview designSystem={selectedSystem} />
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
                            {/* Default examples showing how to use components */}
                            {[
                              {
                                id: 'button-example',
                                title: 'Button Component',
                                description: 'Primary action buttons with variants',
                                code: `import { Button } from '@/components/ui/button';

// Primary button (uses primary token)
<Button>Save Changes</Button>

// Secondary button
<Button variant="secondary">Cancel</Button>

// Outline button
<Button variant="outline">Edit</Button>

// Destructive action
<Button variant="destructive">Delete</Button>`,
                                tags: ['button', 'action'],
                              },
                              {
                                id: 'card-example',
                                title: 'Card Layout',
                                description: 'Content container with header and actions',
                                code: `import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description text</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card content goes here</p>
  </CardContent>
  <CardFooter className="flex justify-end gap-2">
    <Button variant="outline">Cancel</Button>
    <Button>Save</Button>
  </CardFooter>
</Card>`,
                                tags: ['card', 'layout'],
                              },
                              {
                                id: 'form-example',
                                title: 'Form with Inputs',
                                description: 'Form fields with labels and validation',
                                code: `import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

<form className="space-y-4">
  <div className="space-y-2">
    <Label htmlFor="email">Email</Label>
    <Input id="email" type="email" placeholder="you@example.com" />
  </div>
  <div className="space-y-2">
    <Label htmlFor="password">Password</Label>
    <Input id="password" type="password" />
  </div>
  <Button type="submit" className="w-full">Sign In</Button>
</form>`,
                                tags: ['form', 'input'],
                              },
                              {
                                id: 'badge-example',
                                title: 'Status Badges',
                                description: 'Status indicators and labels',
                                code: `import { Badge } from '@/components/ui/badge';

// Default badge
<Badge>New</Badge>

// Status badges with custom colors
<Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/25">
  Active
</Badge>

<Badge className="bg-amber-500/15 text-amber-500 border-amber-500/25">
  Pending
</Badge>

<Badge variant="destructive">Error</Badge>`,
                                tags: ['badge', 'status'],
                              },
                            ].map((example) => (
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
                            ))}

                            {/* Show custom examples from design system if any */}
                            {selectedSystem.examples.length > 0 && (
                              <>
                                <div className="border-t pt-4 mt-4">
                                  <p className="text-sm font-medium mb-3">Custom Examples</p>
                                </div>
                                {selectedSystem.examples.map((example) => (
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
                                ))}
                              </>
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

      {/* Figma Import Dialog */}
      <Dialog open={figmaDialogOpen} onOpenChange={setFigmaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import from Figma</DialogTitle>
            <DialogDescription>
              Import design tokens from a Figma file or frame. Paste the URL from your browser.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Figma URL input */}
            <div className="space-y-2">
              <Label htmlFor="figma-url">Figma URL</Label>
              <Input
                id="figma-url"
                placeholder="https://www.figma.com/design/..."
                value={figmaUrl}
                onChange={(e) => setFigmaUrl(e.target.value)}
                disabled={figmaImporting}
              />
              <p className="text-xs text-muted-foreground">
                Paste the URL of a Figma file or specific frame
              </p>
            </div>

            {/* Optional name */}
            <div className="space-y-2">
              <Label htmlFor="figma-name">Name (optional)</Label>
              <Input
                id="figma-name"
                placeholder="My Design System"
                value={figmaName}
                onChange={(e) => setFigmaName(e.target.value)}
                disabled={figmaImporting}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use the Figma file/frame name
              </p>
            </div>

            {/* Set as default checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="figma-default"
                checked={figmaSetDefault}
                onCheckedChange={(checked) => setFigmaSetDefault(checked === true)}
                disabled={figmaImporting}
              />
              <Label htmlFor="figma-default" className="text-sm font-normal cursor-pointer">
                Set as default design system
              </Label>
            </div>

            {/* Info box */}
            <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
              <p className="font-medium mb-1">What gets imported:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Colors from fills and backgrounds</li>
                <li>Typography (fonts, sizes, weights)</li>
                <li>Spacing and padding values</li>
                <li>Border radius values</li>
                <li>Shadow effects</li>
              </ul>
            </div>

            {/* Error message */}
            {figmaError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {figmaError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setFigmaDialogOpen(false);
                setFigmaError(null);
              }}
              disabled={figmaImporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleFigmaImport}
              disabled={figmaImporting || !figmaUrl.trim()}
            >
              {figmaImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  Import
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
