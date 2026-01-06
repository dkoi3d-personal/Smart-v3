'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Bot,
  FolderCog,
  Cpu,
  Figma,
  Heart,
  Key,
  Sparkles,
  Users,
  CheckCircle,
  AlertCircle,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import { useSettings } from '../SettingsContext';
import { StatusIndicator, StatusType } from '../shared/StatusIndicator';
import { SettingsSection } from '../SettingsSidebar';

interface OverviewSectionProps {
  onNavigate: (section: SettingsSection) => void;
}

interface StatusItem {
  id: SettingsSection;
  label: string;
  icon: React.ReactNode;
  status: StatusType;
  statusLabel: string;
  description: string;
}

export function OverviewSection({ onNavigate }: OverviewSectionProps) {
  const {
    claudeStatus,
    mlxStatus,
    ollamaStatus,
    epicStatus,
    figmaStatus,
    projectDirConfig,
    credentialStatus,
    credentialConfigs,
  } = useSettings();

  // Calculate statuses
  const getClaudeStatus = (): StatusType => {
    if (claudeStatus?.authenticated) return 'success';
    if (claudeStatus?.installed) return 'warning';
    return 'error';
  };

  const getLocalAIStatus = (): StatusType => {
    if (mlxStatus?.mlxAvailable && mlxStatus.model.available) return 'success';
    if (ollamaStatus?.deepseekOcrAvailable) return 'success';
    if (mlxStatus?.mlxAvailable || ollamaStatus?.ollamaAvailable) return 'warning';
    return 'inactive';
  };

  const getProjectDirStatus = (): StatusType => {
    return projectDirConfig?.directoryExists ? 'success' : 'warning';
  };

  const getFigmaStatus = (): StatusType => {
    return figmaStatus?.configured ? 'success' : 'inactive';
  };

  const getEpicStatus = (): StatusType => {
    if (epicStatus?.connected) return 'success';
    if (epicStatus?.configured) return 'warning';
    return 'inactive';
  };

  const configuredKeys = Object.values(credentialStatus).filter(Boolean).length;
  const totalKeys = credentialConfigs.length;
  const getKeysStatus = (): StatusType => {
    if (configuredKeys === totalKeys && totalKeys > 0) return 'success';
    if (configuredKeys > 0) return 'warning';
    return 'inactive';
  };

  const statusItems: StatusItem[] = [
    {
      id: 'claude',
      label: 'Claude Subscription',
      icon: <Bot className="h-5 w-5" />,
      status: getClaudeStatus(),
      statusLabel: claudeStatus?.authenticated
        ? 'Connected'
        : claudeStatus?.installed
        ? 'Not Logged In'
        : 'Not Installed',
      description: claudeStatus?.authenticated
        ? `${claudeStatus.subscriptionType || 'Active'}`
        : 'Required for AI builds',
    },
    {
      id: 'project-dir',
      label: 'Project Directory',
      icon: <FolderCog className="h-5 w-5" />,
      status: getProjectDirStatus(),
      statusLabel: projectDirConfig?.directoryExists ? 'Configured' : 'Check Path',
      description: projectDirConfig?.isConfigured ? 'Custom directory' : 'Using default',
    },
    {
      id: 'local-ai',
      label: 'Local AI',
      icon: <Cpu className="h-5 w-5" />,
      status: getLocalAIStatus(),
      statusLabel:
        mlxStatus?.mlxAvailable && mlxStatus.model.available
          ? 'MLX Ready'
          : ollamaStatus?.deepseekOcrAvailable
          ? 'Ollama Ready'
          : 'Not Configured',
      description: 'OCR & Vision processing',
    },
    {
      id: 'figma',
      label: 'Figma',
      icon: <Figma className="h-5 w-5" />,
      status: getFigmaStatus(),
      statusLabel: figmaStatus?.configured ? 'Connected' : 'Not Connected',
      description: 'Design imports',
    },
    {
      id: 'epic',
      label: 'Epic Healthcare',
      icon: <Heart className="h-5 w-5" />,
      status: getEpicStatus(),
      statusLabel: epicStatus?.connected
        ? 'Connected'
        : epicStatus?.configured
        ? 'Configured'
        : 'Not Connected',
      description: 'FHIR & EHR integration',
    },
    {
      id: 'api-keys',
      label: 'API Keys',
      icon: <Key className="h-5 w-5" />,
      status: getKeysStatus(),
      statusLabel: `${configuredKeys}/${totalKeys} configured`,
      description: 'External service credentials',
    },
  ];

  const successCount = statusItems.filter((s) => s.status === 'success').length;
  const warningCount = statusItems.filter((s) => s.status === 'warning').length;
  const errorCount = statusItems.filter((s) => s.status === 'error').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Settings Overview</h2>
        <p className="text-muted-foreground">
          Quick view of your platform configuration status
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-green-500/30 bg-green-50/50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/50">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                  {successCount}
                </p>
                <p className="text-sm text-green-600 dark:text-green-500">Ready</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-500/30 bg-yellow-50/50 dark:bg-yellow-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-yellow-100 dark:bg-yellow-900/50">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                  {warningCount}
                </p>
                <p className="text-sm text-yellow-600 dark:text-yellow-500">Needs Attention</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-500/30 bg-red-50/50 dark:bg-red-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/50">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-400">{errorCount}</p>
                <p className="text-sm text-red-600 dark:text-red-500">Issues</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Service Status</CardTitle>
          <CardDescription>Click on any item to configure</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {statusItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition-colors text-left group"
              >
                <div
                  className={`p-2 rounded-lg ${
                    item.status === 'success'
                      ? 'bg-green-100 text-green-600 dark:bg-green-900/30'
                      : item.status === 'warning'
                      ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30'
                      : item.status === 'error'
                      ? 'bg-red-100 text-red-600 dark:bg-red-900/30'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{item.label}</span>
                    <StatusIndicator status={item.status} size="sm" />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{item.statusLabel}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      {(getClaudeStatus() !== 'success' || getLocalAIStatus() === 'inactive') && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Recommended Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {getClaudeStatus() !== 'success' && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-background">
                <div className="flex items-center gap-3">
                  <Bot className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Connect Claude</p>
                    <p className="text-sm text-muted-foreground">
                      Required for AI-powered builds
                    </p>
                  </div>
                </div>
                <Button size="sm" onClick={() => onNavigate('claude')}>
                  Configure
                </Button>
              </div>
            )}
            {getLocalAIStatus() === 'inactive' && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-background">
                <div className="flex items-center gap-3">
                  <Cpu className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Setup Local AI</p>
                    <p className="text-sm text-muted-foreground">
                      Enable local OCR & vision processing
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => onNavigate('local-ai')}>
                  Setup
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
