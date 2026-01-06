'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  FolderCog,
  FolderOpen,
  Check,
  AlertCircle,
  RefreshCw,
  Loader2,
  HardDrive,
} from 'lucide-react';
import { useSettings } from '../SettingsContext';
import { ServiceCard } from '../shared/ServiceCard';

export function ProjectDirSection() {
  const {
    projectDirConfig,
    projectDirLoading,
    projectDirError,
    loadProjectDirConfig,
    saveProjectDir,
    resetProjectDir,
    setProjectDirError,
  } = useSettings();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newDir, setNewDir] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!newDir.trim()) {
      setProjectDirError('Please enter a directory path');
      return;
    }
    setSaving(true);
    const success = await saveProjectDir(newDir);
    if (success) {
      setDialogOpen(false);
      setNewDir('');
    }
    setSaving(false);
  };

  const getStatus = () => {
    return projectDirConfig?.directoryExists ? 'success' : 'warning';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Project Directory</h2>
        <p className="text-muted-foreground">
          Configure where new projects are created on your system
        </p>
      </div>

      {/* Main Card */}
      <ServiceCard
        title="Project Storage Location"
        description="Where all new projects are saved"
        icon={<FolderCog className="h-5 w-5" />}
        status={getStatus()}
        onRefresh={loadProjectDirConfig}
        loading={projectDirLoading && !projectDirConfig}
      >
        {projectDirConfig && (
          <div className="space-y-4">
            {/* Status Display */}
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {projectDirConfig.isConfigured ? 'Custom Directory' : 'Default Directory'}
                </p>
                <p
                  className="text-xs text-muted-foreground truncate"
                  title={projectDirConfig.activeDirectory}
                >
                  {projectDirConfig.activeDirectory}
                </p>
              </div>
              {projectDirConfig.directoryExists ? (
                <Badge className="bg-green-600 text-white text-xs shrink-0">
                  <Check className="h-3 w-3 mr-1" />
                  Exists
                </Badge>
              ) : (
                <Badge className="bg-yellow-600 text-white text-xs shrink-0">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Not Found
                </Badge>
              )}
            </div>

            {/* Current Path Display */}
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Active Path</span>
              </div>
              <code className="block text-xs font-mono bg-background p-2 rounded border break-all">
                {projectDirConfig.activeDirectory}
              </code>
              {projectDirConfig.isConfigured && projectDirConfig.configuredAt && (
                <p className="text-xs text-muted-foreground mt-2">
                  Configured: {new Date(projectDirConfig.configuredAt).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Error Display */}
            {projectDirError && (
              <div className="p-2 rounded bg-red-50 dark:bg-red-950/30 text-xs text-red-600 flex items-center gap-2">
                <AlertCircle className="h-3 w-3" />
                {projectDirError}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 ml-auto text-xs"
                  onClick={() => setProjectDirError(null)}
                >
                  Dismiss
                </Button>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setNewDir(projectDirConfig.activeDirectory);
                  setProjectDirError(null);
                  setDialogOpen(true);
                }}
              >
                <FolderCog className="h-3.5 w-3.5 mr-1.5" />
                Change Directory
              </Button>
              {projectDirConfig.isConfigured && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={resetProjectDir}
                  disabled={projectDirLoading}
                >
                  {projectDirLoading ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Reset to Default
                </Button>
              )}
            </div>

            {/* Info */}
            {!projectDirConfig.isConfigured && (
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-xs">
                <p className="text-blue-700 dark:text-blue-300">
                  <span className="font-medium">Tip:</span> You can set a custom directory where
                  all new projects will be created. The directory must already exist on your
                  system.
                </p>
              </div>
            )}
          </div>
        )}
      </ServiceCard>

      {/* Storage Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Storage Information
          </CardTitle>
          <CardDescription>How project data is organized</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <FolderOpen className="h-4 w-4 text-blue-500" />
                <h4 className="font-medium text-sm">Project Files</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                Each project gets its own folder with source code, config files, and build
                outputs in your configured directory.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <HardDrive className="h-4 w-4 text-purple-500" />
                <h4 className="font-medium text-sm">Platform Data</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                Settings, learnings, and design systems are stored in the platform's data
                directory.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Directory Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Project Directory</DialogTitle>
            <DialogDescription>
              Enter the full path to the directory where you want projects to be created. The
              directory must already exist.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Directory Path</label>
              <Input
                value={newDir}
                onChange={(e) => setNewDir(e.target.value)}
                placeholder="C:\Users\username\projects"
                className="font-mono"
              />
            </div>
            {projectDirError && (
              <p className="text-sm text-red-600">{projectDirError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
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
    </div>
  );
}
