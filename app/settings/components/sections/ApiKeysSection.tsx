'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  Key,
  Plus,
  Check,
  X,
  Eye,
  EyeOff,
  Trash2,
  ExternalLink,
  Loader2,
  Play,
  CheckCircle,
  XCircle,
  AlertCircle,
  Github,
  Cloud,
  Bot,
  Database,
  Container,
  Heart,
  Copy,
} from 'lucide-react';
import { useSettings, CredentialConfig } from '../SettingsContext';
import { cn } from '@/lib/utils';

// Icon mapping
const ICONS: Record<string, any> = {
  Github,
  Cloud,
  Bot,
  Database,
  Container,
  Heart,
  Key,
};

export function ApiKeysSection() {
  const {
    credentialConfigs,
    credentialStatus,
    credentialsLoading,
    loadCredentials,
    saveCredential,
    deleteCredential,
    testCredential,
  } = useSettings();

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<CredentialConfig | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteType, setDeleteType] = useState<string | null>(null);

  // View dialog state
  const [viewValues, setViewValues] = useState<Record<string, string>>({});
  const [viewMasked, setViewMasked] = useState<Record<string, string>>({});
  const [viewRevealed, setViewRevealed] = useState<Record<string, boolean>>({});
  const [loadingView, setLoadingView] = useState(false);

  // Test state
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { success: boolean; message: string }>
  >({});

  const configuredCount = Object.values(credentialStatus).filter(Boolean).length;
  const totalCount = credentialConfigs.length;

  const openAddDialog = (config: CredentialConfig) => {
    setSelectedConfig(config);
    setFormValues({});
    setShowPasswords({});
    setSaveError(null);
    setAddDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedConfig) return;
    for (const field of selectedConfig.fields) {
      if (field.required && !formValues[field.key]) {
        setSaveError(`${field.label} is required`);
        return;
      }
    }
    setSaving(true);
    setSaveError(null);
    const success = await saveCredential(selectedConfig.type, formValues);
    if (success) {
      setAddDialogOpen(false);
    } else {
      setSaveError('Failed to save credentials');
    }
    setSaving(false);
  };

  const openViewDialog = async (config: CredentialConfig) => {
    setSelectedConfig(config);
    setViewRevealed({});
    setViewDialogOpen(true);
    setLoadingView(true);
    try {
      const response = await fetch(`/api/credentials/${config.type}`);
      const data = await response.json();
      setViewMasked(data.maskedValues || {});
      const revealResponse = await fetch(`/api/credentials/${config.type}?reveal=true`);
      const revealData = await revealResponse.json();
      setViewValues(revealData.values || {});
    } catch (err) {
      console.error('Error loading credential values:', err);
    } finally {
      setLoadingView(false);
    }
  };

  const confirmDelete = (type: string) => {
    setDeleteType(type);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteType) return;
    setDeleting(true);
    const success = await deleteCredential(deleteType);
    if (success) {
      setDeleteDialogOpen(false);
      setDeleteType(null);
    }
    setDeleting(false);
  };

  const handleTest = async (type: string) => {
    setTesting(type);
    setTestResults((prev) => {
      const updated = { ...prev };
      delete updated[type];
      return updated;
    });
    const result = await testCredential(type);
    setTestResults((prev) => ({ ...prev, [type]: result }));
    setTesting(null);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getIcon = (iconName: string) => ICONS[iconName] || Key;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">API Keys</h2>
          <p className="text-muted-foreground">
            Manage credentials for external services
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {configuredCount}/{totalCount} configured
        </Badge>
      </div>

      {/* Credentials Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {credentialConfigs.map((config) => {
          const Icon = getIcon(config.icon);
          const isConfigured = credentialStatus[config.type];
          const testResult = testResults[config.type];

          return (
            <Card
              key={config.type}
              className={cn(
                'transition-colors',
                isConfigured ? 'border-green-500/50' : 'border-border'
              )}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'p-2.5 rounded-lg',
                        isConfigured
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : 'bg-muted'
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-5 w-5',
                          isConfigured ? 'text-green-600' : 'text-muted-foreground'
                        )}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold">{config.label}</h3>
                      <p className="text-xs text-muted-foreground">{config.description}</p>
                    </div>
                  </div>
                  {isConfigured && (
                    <Badge className="bg-green-600 text-white text-xs">
                      <Check className="h-3 w-3 mr-1" />
                      Configured
                    </Badge>
                  )}
                </div>

                {/* Test Result */}
                {testResult && (
                  <div
                    className={cn(
                      'mb-4 p-2 rounded text-xs flex items-center gap-2',
                      testResult.success
                        ? 'bg-green-50 dark:bg-green-950/30 text-green-700'
                        : 'bg-red-50 dark:bg-red-950/30 text-red-700'
                    )}
                  >
                    {testResult.success ? (
                      <CheckCircle className="h-3.5 w-3.5" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" />
                    )}
                    {testResult.message}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {isConfigured ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openViewDialog(config)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTest(config.type)}
                        disabled={testing === config.type}
                      >
                        {testing === config.type ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Test
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => confirmDelete(config.type)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={() => openAddDialog(config)}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Configure
                    </Button>
                  )}
                  {config.docsUrl && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(config.docsUrl, '_blank')}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure {selectedConfig?.label}</DialogTitle>
            <DialogDescription>{selectedConfig?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedConfig?.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label>
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                {field.type === 'select' ? (
                  <Select
                    value={formValues[field.key] || ''}
                    onValueChange={(value) =>
                      setFormValues((prev) => ({ ...prev, [field.key]: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={field.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options?.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="relative">
                    <Input
                      type={
                        field.type === 'password' && !showPasswords[field.key]
                          ? 'password'
                          : 'text'
                      }
                      value={formValues[field.key] || ''}
                      onChange={(e) =>
                        setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      placeholder={field.placeholder}
                    />
                    {field.type === 'password' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1 h-7 w-7 p-0"
                        onClick={() =>
                          setShowPasswords((prev) => ({
                            ...prev,
                            [field.key]: !prev[field.key],
                          }))
                        }
                      >
                        {showPasswords[field.key] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {saveError && (
              <div className="p-2 rounded bg-red-50 dark:bg-red-950/30 text-sm text-red-600 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {saveError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>View {selectedConfig?.label}</DialogTitle>
            <DialogDescription>Current credential values</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {loadingView ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              selectedConfig?.fields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label>{field.label}</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-muted rounded text-sm font-mono">
                      {viewRevealed[field.key]
                        ? viewValues[field.key]
                        : viewMasked[field.key] || '••••••••'}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setViewRevealed((prev) => ({
                          ...prev,
                          [field.key]: !prev[field.key],
                        }))
                      }
                    >
                      {viewRevealed[field.key] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(viewValues[field.key] || '')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
            <Button
              variant="default"
              onClick={() => {
                setViewDialogOpen(false);
                if (selectedConfig) openAddDialog(selectedConfig);
              }}
            >
              Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Credentials</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete these credentials? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
