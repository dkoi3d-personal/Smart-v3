'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Rocket,
  CheckCircle2,
  XCircle,
  Loader2,
  Cloud,
  Server,
  Globe,
  Container,
  FileCode,
  ExternalLink,
  AlertCircle,
  AlertTriangle,
  Settings,
  ChevronRight,
  ChevronDown,
  Database,
  Terminal,
  Package,
  Hammer,
  Copy,
  Check,
  Eye,
  RotateCcw,
  Info,
  Shield,
  Upload,
  Key,
  EyeOff,
  Activity,
  RefreshCw,
  HardDrive,
  Users,
  Trash2,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface DeployTabProps {
  projectId: string;
  projectName: string;
  projectDirectory: string;
  buildStatus: 'loading' | 'planned' | 'building' | 'completed' | 'error' | 'paused' | 'stopped';
  onAutoDeployChange?: (enabled: boolean) => void;
  autoDeployEnabled?: boolean;
  healthcareSettings?: {
    complianceLevel?: 'hipaa' | 'hipaa-hitrust' | 'basic';
    appType?: 'patient-facing' | 'clinical' | 'administrative' | 'analytics';
    dataTypes?: string[];
  } | null;
  databaseConfig?: {
    provider?: string;
    schemaTemplate?: string;
    databaseId?: string;
    tier?: string;
  } | null;
  onDeployComplete?: (url: string) => void;
  initialDeploymentUrl?: string | null;
}

interface DeploymentResult {
  success: boolean;
  deploymentId: string;
  serviceType: string;
  url?: string;
  resourceGroupName: string;
  appName: string;
  steps: { name: string; status: string; message?: string; error?: string }[];
  logs: string[];
  resources: { type: string; id: string; url?: string }[];
  error?: string;
  monitoring?: {
    applicationInsightsId?: string;
    instrumentationKey?: string;
    dashboardUrl?: string;
  };
}

type DeploymentPhase = 'idle' | 'preparing' | 'building' | 'packaging' | 'uploading' | 'deploying' | 'verifying' | 'complete' | 'failed';

// ============================================================================
// Constants
// ============================================================================

const SERVICE_OPTIONS = {
  'app-service': {
    icon: Server,
    name: 'App Service',
    description: 'Full-stack Next.js apps',
    color: 'text-blue-400',
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/30',
  },
  'container-apps': {
    icon: Container,
    name: 'Container Apps',
    description: 'Microservices & containers',
    color: 'text-purple-400',
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/30',
  },
  'static-web-apps': {
    icon: FileCode,
    name: 'Static Web Apps',
    description: 'Static sites & SPAs',
    color: 'text-green-400',
    bg: 'bg-green-500/20',
    border: 'border-green-500/30',
  },
};

const PHASE_CONFIG: Record<DeploymentPhase, { icon: React.ElementType; label: string }> = {
  idle: { icon: Cloud, label: 'Ready' },
  preparing: { icon: Settings, label: 'Preparing' },
  building: { icon: Hammer, label: 'Building' },
  packaging: { icon: Package, label: 'Packaging' },
  uploading: { icon: Upload, label: 'Uploading' },
  deploying: { icon: Rocket, label: 'Deploying' },
  verifying: { icon: Shield, label: 'Verifying' },
  complete: { icon: CheckCircle2, label: 'Complete' },
  failed: { icon: XCircle, label: 'Failed' },
};

const SKU_OPTIONS = [
  { value: 'F1', label: 'Free', price: '$0/mo', note: 'Dev only' },
  { value: 'B1', label: 'Basic', price: '$13/mo', note: 'Dev/Test' },
  { value: 'B2', label: 'Basic+', price: '$26/mo', note: 'Small apps' },
  { value: 'S1', label: 'Standard', price: '$70/mo', note: 'Production' },
  { value: 'P1v3', label: 'Premium', price: '$100/mo', note: 'High perf' },
];

// ============================================================================
// Helper Components
// ============================================================================

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-gray-700/50 transition-colors"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-400" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-gray-400" />
      )}
    </button>
  );
}

function PhaseStep({ phase, currentPhase, index }: { phase: DeploymentPhase; currentPhase: DeploymentPhase; index: number }) {
  const config = PHASE_CONFIG[phase];
  const Icon = config.icon;

  const phases: DeploymentPhase[] = ['preparing', 'building', 'packaging', 'uploading', 'deploying', 'verifying'];
  const currentIndex = phases.indexOf(currentPhase);
  const phaseIndex = phases.indexOf(phase);

  const isComplete = currentPhase === 'complete' || phaseIndex < currentIndex;
  const isCurrent = phase === currentPhase;
  const isFailed = currentPhase === 'failed' && isCurrent;

  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium',
      isComplete && 'text-green-400',
      isCurrent && !isFailed && 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
      isFailed && 'bg-red-500/20 text-red-400 border border-red-500/30',
      !isComplete && !isCurrent && 'text-gray-500'
    )}>
      {isComplete ? (
        <CheckCircle2 className="w-3.5 h-3.5" />
      ) : isCurrent ? (
        isFailed ? <XCircle className="w-3.5 h-3.5" /> : <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Icon className="w-3.5 h-3.5" />
      )}
      {config.label}
    </div>
  );
}

function LogViewer({ logs }: { logs: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogColor = (log: string) => {
    if (log.includes('❌') || log.includes('Error') || log.includes('failed')) return 'text-red-400';
    if (log.includes('✅') || log.includes('Success') || log.includes('complete')) return 'text-green-400';
    if (log.includes('⚠️') || log.includes('Warning')) return 'text-yellow-400';
    if (log.includes('⏳') || log.includes('...') || log.includes('🔨') || log.includes('📦')) return 'text-blue-400';
    if (log.includes('🎉') || log.includes('🌐')) return 'text-green-400';
    return 'text-gray-300';
  };

  return (
    <div
      ref={containerRef}
      className="h-full bg-gray-900 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed"
    >
      {logs.length === 0 ? (
        <div className="h-full flex items-center justify-center text-gray-500">
          <div className="text-center">
            <Terminal className="w-6 h-6 mx-auto mb-1 opacity-50" />
            <p className="text-xs">Waiting for deployment...</p>
          </div>
        </div>
      ) : (
        logs.map((log, i) => (
          <div key={i} className={cn('py-0.5 whitespace-pre-wrap break-words', getLogColor(log))}>
            <span className="text-gray-600 select-none mr-2 inline-block w-6 text-right">{i + 1}</span>
            {log}
          </div>
        ))
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function DeployTab({
  projectId,
  projectName,
  projectDirectory,
  buildStatus,
  onDeployComplete,
  initialDeploymentUrl,
}: DeployTabProps) {
  // Credentials state
  const [hasCredentials, setHasCredentials] = useState(false);
  const [isCheckingCredentials, setIsCheckingCredentials] = useState(true);

  // Configuration state
  const [selectedService, setSelectedService] = useState<keyof typeof SERVICE_OPTIONS>('app-service');
  const [selectedSku, setSelectedSku] = useState('B1');
  const [selectedRegion, setSelectedRegion] = useState('eastus2');
  const [selectedEnv, setSelectedEnv] = useState<'dev' | 'staging' | 'production'>('dev');

  // Deployment state
  const [isDeploying, setIsDeploying] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<DeploymentPhase>('idle');
  const [deployment, setDeployment] = useState<DeploymentResult | null>(null);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(initialDeploymentUrl || null);
  const [error, setError] = useState<string | null>(null);

  // Log initial deployment URL for debugging
  useEffect(() => {
    if (initialDeploymentUrl) {
      console.log('[Deploy] Received initial deployment URL:', initialDeploymentUrl);
    }
  }, [initialDeploymentUrl]);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<'database' | 'appservice' | 'config' | 'env' | 'logs'>('config');
  const [showLogs, setShowLogs] = useState(false);

  // Environment variables state - now per environment (includes local)
  const [envVars, setEnvVars] = useState<{
    key: string;
    value: string;
    masked: boolean;
    source?: string;
    isDefault?: boolean;
    perEnv?: { local?: string; dev?: string; staging?: string; production?: string };
  }[]>([]);
  const [isLoadingEnv, setIsLoadingEnv] = useState(false);
  const [selectedEnvTab, setSelectedEnvTab] = useState<'local' | 'dev' | 'staging' | 'production'>('local');
  const [envNeedsSync, setEnvNeedsSync] = useState(false);
  const [isSyncingEnv, setIsSyncingEnv] = useState(false);

  // Migration/Reset options state - 'auto' means use smart default (no user selection)
  const [migrationStrategy, setMigrationStrategy] = useState<'auto' | 'migrate' | 'push-safe' | 'push-force' | 'reset' | 'none'>('auto');
  const [seedAfterMigration, setSeedAfterMigration] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showAdvancedDbOptions, setShowAdvancedDbOptions] = useState(false);

  // Migration status (from API check)
  const [migrationStatus, setMigrationStatus] = useState<{
    hasPendingMigrations: boolean;
    pendingMigrations: string[];
    hasSchemaChanges: boolean;
    isDestructive: boolean;
    recommendation: 'migrate' | 'push-safe' | 'push-force' | 'none';
    isChecking: boolean;
    isGenerating: boolean;
    error?: string;
  }>({
    hasPendingMigrations: false,
    pendingMigrations: [],
    hasSchemaChanges: false,
    isDestructive: false,
    recommendation: 'none',
    isChecking: false,
    isGenerating: false,
  });

  // Project analysis state
  const [projectAnalysis, setProjectAnalysis] = useState<{
    hasPrisma: boolean;
    hasSqlite: boolean;
    hasPostgresUrl: boolean;
    databaseReady: boolean;
    isAnalyzing: boolean;
    models: string[];
  }>({
    hasPrisma: false,
    hasSqlite: false,
    hasPostgresUrl: false,
    databaseReady: true, // Assume ready until proven otherwise
    isAnalyzing: true,
    models: [],
  });

  // Infrastructure state
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [provisionLogs, setProvisionLogs] = useState<string[]>([]);
  const [provisionedDatabase, setProvisionedDatabase] = useState<{
    provider: string;
    host: string;
    database: string;
    port?: number;
  } | null>(null);
  const [appServiceHealth, setAppServiceHealth] = useState<{
    state: string;
    availabilityState: string;
    enabled: boolean;
  } | null>(null);
  const [appServiceInfo, setAppServiceInfo] = useState<{
    appName: string;
    resourceGroup: string;
    sku?: string;
    deployedAt?: string;
  } | null>(null);
  const [azureAppLogs, setAzureAppLogs] = useState<string[]>([]);
  const [azureDbLogs, setAzureDbLogs] = useState<string[]>([]);
  const [isLoadingAppLogs, setIsLoadingAppLogs] = useState(false);
  const [isLoadingDbLogs, setIsLoadingDbLogs] = useState(false);
  const [databaseMetrics, setDatabaseMetrics] = useState<{
    cpu: number;
    memory: number;
    storage: number;
    connections: number;
  } | null>(null);
  const [isLoadingInfra, setIsLoadingInfra] = useState(true);
  const [expandedInfraSection, setExpandedInfraSection] = useState<'database' | 'appservice' | null>(
    null // Start collapsed, will expand database if needed
  );


  // Check credentials on mount
  useEffect(() => {
    const checkCredentials = async () => {
      try {
        const response = await fetch('/api/infrastructure/azure?action=status');
        if (response.ok) {
          const data = await response.json();
          setHasCredentials(data.configured === true);
        } else {
          setHasCredentials(false);
        }
      } catch {
        setHasCredentials(false);
      } finally {
        setIsCheckingCredentials(false);
      }
    };
    checkCredentials();
  }, []);

  // Load environment variables from project
  useEffect(() => {
    const loadEnvVars = async () => {
      if (!projectDirectory) return;
      setIsLoadingEnv(true);
      try {
        const response = await fetch(`/api/projects/${projectId}/env?directory=${encodeURIComponent(projectDirectory)}`);
        if (response.ok) {
          const data = await response.json();
          setEnvVars(data.variables || []);
          setEnvNeedsSync(data.envNeedsSync || false);
        }
      } catch {
        // Silently fail - env vars are optional
      } finally {
        setIsLoadingEnv(false);
      }
    };
    loadEnvVars();
  }, [projectId, projectDirectory]);

  // Analyze project for database needs
  useEffect(() => {
    const analyzeProject = async () => {
      if (!projectDirectory) {
        setProjectAnalysis(prev => ({ ...prev, isAnalyzing: false }));
        return;
      }

      try {
        const response = await fetch(`/api/projects/${projectId}/analyze?directory=${encodeURIComponent(projectDirectory)}`);
        if (response.ok) {
          const data = await response.json();
          setProjectAnalysis({
            hasPrisma: data.hasPrisma,
            hasSqlite: data.hasSqlite,
            hasPostgresUrl: data.hasPostgresUrl,
            databaseReady: data.databaseReady,
            isAnalyzing: false,
            models: data.models || [],
          });
        } else {
          setProjectAnalysis(prev => ({ ...prev, isAnalyzing: false }));
        }
      } catch {
        setProjectAnalysis(prev => ({ ...prev, isAnalyzing: false }));
      }
    };
    analyzeProject();
  }, [projectId, projectDirectory]);

  // Auto-detect Azure service type based on project analysis
  useEffect(() => {
    // For Next.js apps with database, App Service is the best choice
    // Static sites could use Static Web Apps, but App Service handles everything
    if (projectAnalysis.hasPrisma) {
      setSelectedService('app-service');
    }
    // Default to app-service for all Next.js apps as it handles SSR, API routes, etc.
  }, [projectAnalysis.hasPrisma]);

  // Load infrastructure data (existing database, deployment info)
  useEffect(() => {
    const loadInfrastructure = async () => {
      if (!projectDirectory) {
        setIsLoadingInfra(false);
        return;
      }

      setIsLoadingInfra(true);
      try {
        // Load existing database config from project's .database.json
        const dbResponse = await fetch(`/api/database/provision?projectId=${projectId}`);
        if (dbResponse.ok) {
          const dbData = await dbResponse.json();
          if (dbData.hasDatabase) {
            setProvisionedDatabase({
              provider: dbData.provider,
              host: dbData.host || '',
              database: dbData.database || projectId,
              port: dbData.port,
            });

            // Try to load database metrics if it's an Azure database
            if (dbData.host && dbData.host.includes('azure')) {
              const serverName = dbData.host.split('.')[0];
              try {
                const metricsResponse = await fetch(
                  `/api/database/azure?action=metrics&serverName=${serverName}&resourceGroup=ai-platform-databases`
                );
                if (metricsResponse.ok) {
                  const metricsData = await metricsResponse.json();
                  const metrics = metricsData.metrics || metricsData;
                  if (metrics.cpu !== undefined) {
                    setDatabaseMetrics(metrics);
                  }
                }
              } catch {
                // Metrics optional
              }
            }
          }
        }

        // Try to load from .infrastructure.json first
        let appName: string | null = null;
        let resourceGroup: string | null = null;
        let infraUrl: string | null = null;

        if (projectDirectory) {
          try {
            const infraResponse = await fetch(`/api/infrastructure/config?projectDirectory=${encodeURIComponent(projectDirectory)}`);
            if (infraResponse.ok) {
              const infraData = await infraResponse.json();
              if (infraData.exists && infraData.config?.appService) {
                const appService = infraData.config.appService;
                appName = appService.appName;
                resourceGroup = appService.resourceGroup;
                infraUrl = appService.url;
                setAppServiceInfo({
                  appName: appService.appName,
                  resourceGroup: appService.resourceGroup,
                  sku: appService.sku,
                  deployedAt: appService.deployedAt,
                });
                console.log('[Deploy] Loaded from .infrastructure.json:', { appName, resourceGroup, infraUrl });
              }
            }
          } catch (err) {
            console.log('[Deploy] Could not load infrastructure config:', err);
          }
        }

        // Fallback to projects API if no infrastructure config
        if (!infraUrl) {
          const projectsResponse = await fetch('/api/projects');
          if (projectsResponse.ok) {
            const projectsData = await projectsResponse.json();
            const project = projectsData.projects?.find((p: any) => p.projectId === projectId);
            console.log('[Deploy] Looking for project:', projectId, 'Found:', project?.projectId, 'DeploymentUrl:', project?.deploymentUrl);

            if (project?.deploymentUrl) {
              infraUrl = project.deploymentUrl;
              // Extract app name from URL (e.g., "https://weight-loss-mobile-2-dev.azurewebsites.net")
              const urlMatch = project.deploymentUrl.match(/https?:\/\/([^.]+)/);
              appName = urlMatch ? urlMatch[1] : null;
              // Derive resource group name from app name
              resourceGroup = appName ? `rg-${appName}` : null;
            }
          }
        }

        // Set the URL and fetch Azure status
        if (infraUrl) {
          setDeployedUrl(infraUrl);
          console.log('[Deploy] Found deployment URL:', infraUrl);

          if (appName && resourceGroup) {
            // Try to get deployment status from Azure
            try {
              const statusResponse = await fetch(
                `/api/azure/deploy?resourceGroup=${resourceGroup}&appName=${appName}&serviceType=app-service`
              );
              if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                console.log('[Deploy] App service status:', statusData);
                // Azure returns { status: 'Running', url: '...' }
                if (statusData.status) {
                  setAppServiceHealth({
                    state: statusData.status,
                    availabilityState: statusData.status === 'Running' ? 'Normal' : 'Unknown',
                    enabled: statusData.status === 'Running',
                  });
                  // Update URL if we got a better one from Azure
                  if (statusData.url && statusData.status !== 'not_found') {
                    setDeployedUrl(statusData.url);
                  }
                }
              } else {
                console.log('[Deploy] Status API returned:', statusResponse.status);
              }
            } catch (err) {
              console.log('[Deploy] Could not get Azure status:', err);
              // App exists but we couldn't get status - show as unknown
              setAppServiceHealth({
                state: 'Unknown',
                availabilityState: 'Unknown',
                enabled: true,
              });
            }
          }
        }
      } catch (error) {
        console.error('Failed to load infrastructure:', error);
      } finally {
        setIsLoadingInfra(false);
        // Expand database section if database is needed
        if (!provisionedDatabase && projectAnalysis.hasPrisma && !projectAnalysis.databaseReady) {
          setExpandedInfraSection('database');
        }
      }
    };

    loadInfrastructure();
  }, [projectId, projectDirectory, projectAnalysis.hasPrisma, projectAnalysis.databaseReady]);

  // Check migration status when project has Prisma
  const checkMigrationStatus = useCallback(async () => {
    if (!projectDirectory || !projectAnalysis.hasPrisma) return;

    setMigrationStatus(prev => ({ ...prev, isChecking: true, error: undefined }));

    try {
      const response = await fetch(
        `/api/deploy/migrate?projectDirectory=${encodeURIComponent(projectDirectory)}&environment=${selectedEnv}`
      );

      if (response.ok) {
        const data = await response.json();
        setMigrationStatus({
          hasPendingMigrations: data.hasPendingMigrations || false,
          pendingMigrations: data.pendingMigrations || [],
          hasSchemaChanges: data.hasSchemaChanges || false,
          isDestructive: data.isDestructive || false,
          recommendation: data.recommendation || 'none',
          isChecking: false,
          isGenerating: false,
        });
        // Don't auto-select - let 'auto' handle it at deploy time
      } else {
        const errorData = await response.json().catch(() => ({}));
        setMigrationStatus(prev => ({
          ...prev,
          isChecking: false,
          error: errorData.error || 'Failed to check migration status',
        }));
      }
    } catch (error: any) {
      setMigrationStatus(prev => ({
        ...prev,
        isChecking: false,
        error: error.message || 'Failed to check migration status',
      }));
    }
  }, [projectDirectory, projectAnalysis.hasPrisma, selectedEnv]);

  // Check migration status when project has Prisma and database is ready
  useEffect(() => {
    if (projectAnalysis.hasPrisma && (projectAnalysis.databaseReady || provisionedDatabase)) {
      checkMigrationStatus();
    }
  }, [projectAnalysis.hasPrisma, projectAnalysis.databaseReady, provisionedDatabase, checkMigrationStatus]);

  // Auto-switch from 'migrate' to 'auto' when Safe Migrate is unavailable
  useEffect(() => {
    if (migrationStrategy === 'migrate' && migrationStatus.hasSchemaChanges && !migrationStatus.hasPendingMigrations) {
      // Safe Migrate is not available - reset to auto
      setMigrationStrategy('auto');
    }
  }, [migrationStrategy, migrationStatus.hasSchemaChanges, migrationStatus.hasPendingMigrations]);

  // Generate migration files automatically
  const generateMigration = useCallback(async () => {
    if (!projectDirectory) return;

    setMigrationStatus(prev => ({ ...prev, isGenerating: true, error: undefined }));

    try {
      const response = await fetch('/api/deploy/migrate/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectDirectory,
          migrationName: `schema_update_${Date.now()}`,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Refresh migration status to show the new migration
        await checkMigrationStatus();
        // Switch to Safe Migrate now that we have migrations
        setMigrationStrategy('migrate');
      } else {
        setMigrationStatus(prev => ({
          ...prev,
          isGenerating: false,
          error: data.error || 'Failed to generate migration',
        }));
      }
    } catch (error: any) {
      setMigrationStatus(prev => ({
        ...prev,
        isGenerating: false,
        error: error.message || 'Failed to generate migration',
      }));
    }
  }, [projectDirectory, checkMigrationStatus]);

  // Database provisioning function
  const provisionDatabase = async (provider: 'neon' | 'azure') => {
    setIsProvisioning(true);
    setProvisionError(null);
    setProvisionLogs([]);
    setExpandedInfraSection('database');

    const addProvisionLog = (msg: string) => {
      setProvisionLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);
    };

    const timeoutIds: NodeJS.Timeout[] = [];

    try {
      const dbName = projectName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      addProvisionLog(`Starting ${provider === 'neon' ? 'Neon Serverless' : 'Azure PostgreSQL'} provisioning...`);
      addProvisionLog(`Database name: ${dbName}`);

      if (provider === 'azure') {
        addProvisionLog('Authenticating with Azure...');
        timeoutIds.push(setTimeout(() => addProvisionLog('Creating resource group...'), 2000));
        timeoutIds.push(setTimeout(() => addProvisionLog('Provisioning PostgreSQL Flexible Server...'), 4000));
        timeoutIds.push(setTimeout(() => addProvisionLog('This typically takes 5-10 minutes...'), 6000));
      } else {
        addProvisionLog('Connecting to Neon API...');
        timeoutIds.push(setTimeout(() => addProvisionLog('Creating Neon project...'), 1000));
      }

      const clearAllTimeouts = () => timeoutIds.forEach(id => clearTimeout(id));

      const response = await fetch('/api/database/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          projectDirectory,
          provider,
          dbName,
          location: selectedRegion,
        }),
      });

      clearAllTimeouts();
      const data = await response.json();

      if (!response.ok) {
        addProvisionLog(`Error: ${data.error || 'Failed to provision database'}`);
        throw new Error(data.error || 'Failed to provision database');
      }

      addProvisionLog('Database server created successfully!');
      if (data.schemaPushed) addProvisionLog('Schema pushed to database!');
      if (data.databaseSeeded) addProvisionLog('Database seeded with initial data!');

      setProvisionedDatabase({
        provider: data.database?.provider || provider,
        host: data.database?.host || '',
        database: data.database?.database || '',
      });

      // Re-analyze project
      const analyzeResponse = await fetch(`/api/projects/${projectId}/analyze?directory=${encodeURIComponent(projectDirectory)}`);
      if (analyzeResponse.ok) {
        const analysisData = await analyzeResponse.json();
        setProjectAnalysis({
          hasPrisma: analysisData.hasPrisma,
          hasSqlite: analysisData.hasSqlite,
          hasPostgresUrl: analysisData.hasPostgresUrl,
          databaseReady: analysisData.databaseReady,
          isAnalyzing: false,
          models: analysisData.models || [],
        });
      }

      // Reload env vars
      const envResponse = await fetch(`/api/projects/${projectId}/env?directory=${encodeURIComponent(projectDirectory)}`);
      if (envResponse.ok) {
        const envData = await envResponse.json();
        setEnvVars(envData.variables || []);
        setEnvNeedsSync(envData.envNeedsSync || false);
      }

      addProvisionLog('');
      addProvisionLog('Database provisioning complete! Ready to deploy.');

    } catch (err: any) {
      setProvisionError(err.message || 'Failed to provision database');
      addProvisionLog(`${err.message || 'Failed to provision database'}`);
    } finally {
      setIsProvisioning(false);
    }
  };

  // Refresh infrastructure health
  const refreshInfraHealth = useCallback(async () => {
    setIsLoadingInfra(true);
    try {
      // Refresh database metrics
      if (provisionedDatabase?.host && provisionedDatabase.host.includes('azure')) {
        try {
          const serverName = provisionedDatabase.host.split('.')[0];
          const response = await fetch(
            `/api/database/azure?action=metrics&serverName=${serverName}&resourceGroup=ai-platform-databases`
          );
          if (response.ok) {
            const data = await response.json();
            const metrics = data.metrics || data;
            if (metrics.cpu !== undefined) {
              setDatabaseMetrics(metrics);
            }
          }
        } catch {
          // Silent fail
        }
      }

      // Refresh app service health
      if (deployedUrl) {
        const urlMatch = deployedUrl.match(/https?:\/\/([^.]+)/);
        const appName = urlMatch ? urlMatch[1] : null;

        if (appName) {
          const resourceGroup = `rg-${appName}`;
          try {
            const statusResponse = await fetch(
              `/api/azure/deploy?resourceGroup=${resourceGroup}&appName=${appName}&serviceType=app-service`
            );
            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              if (statusData.status) {
                setAppServiceHealth({
                  state: statusData.status,
                  availabilityState: statusData.status === 'Running' ? 'Normal' : 'Unknown',
                  enabled: statusData.status === 'Running',
                });
              }
            }
          } catch {
            // Silent fail - keep existing state
          }
        }
      }
    } finally {
      setIsLoadingInfra(false);
    }
  }, [provisionedDatabase?.host, deployedUrl]);

  // Fetch Azure App Service logs
  const fetchAppLogs = useCallback(async () => {
    if (!appServiceInfo?.appName || !appServiceInfo?.resourceGroup) return;

    setIsLoadingAppLogs(true);
    try {
      const response = await fetch(
        `/api/azure/logs?type=app&resourceGroup=${encodeURIComponent(appServiceInfo.resourceGroup)}&appName=${encodeURIComponent(appServiceInfo.appName)}&lines=50`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.logs && data.logs.length > 0) {
          setAzureAppLogs(data.logs);
        }
      }
    } catch (err) {
      console.error('Failed to fetch app logs:', err);
    } finally {
      setIsLoadingAppLogs(false);
    }
  }, [appServiceInfo?.appName, appServiceInfo?.resourceGroup]);

  // Fetch Azure Database logs
  const fetchDbLogs = useCallback(async () => {
    if (!provisionedDatabase?.host) return;

    setIsLoadingDbLogs(true);
    try {
      const serverName = provisionedDatabase.host.split('.')[0];
      const response = await fetch(
        `/api/azure/logs?type=database&serverName=${encodeURIComponent(serverName)}&lines=50`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.logs && data.logs.length > 0) {
          setAzureDbLogs(data.logs);
        }
      }
    } catch (err) {
      console.error('Failed to fetch database logs:', err);
    } finally {
      setIsLoadingDbLogs(false);
    }
  }, [provisionedDatabase?.host]);

  // Sync .env files from provisioned database
  const syncEnvFiles = useCallback(async () => {
    if (!projectDirectory) return;

    setIsSyncingEnv(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/env?directory=${encodeURIComponent(projectDirectory)}`,
        { method: 'PATCH' }
      );

      if (response.ok) {
        // Reload env vars after sync
        const reloadResponse = await fetch(`/api/projects/${projectId}/env?directory=${encodeURIComponent(projectDirectory)}`);
        if (reloadResponse.ok) {
          const data = await reloadResponse.json();
          setEnvVars(data.variables || []);
          setEnvNeedsSync(data.envNeedsSync || false);
        }
      } else {
        const error = await response.json();
        console.error('Failed to sync env files:', error.error);
      }
    } catch (err) {
      console.error('Failed to sync env files:', err);
    } finally {
      setIsSyncingEnv(false);
    }
  }, [projectId, projectDirectory]);

  const addLog = useCallback((message: string) => {
    setLogs(prev => [...prev, message]);
  }, []);

  const resetDeployment = useCallback(() => {
    setIsDeploying(false);
    setCurrentPhase('idle');
    setDeployment(null);
    setDeployedUrl(null);
    setError(null);
    setLogs([]);
    setProgress(0);
    setActiveTab('config'); // Go back to config tab
    setShowLogs(false);
  }, []);


  const startDeployment = async () => {
    setIsDeploying(true);
    setShowLogs(true);
    setActiveTab('logs'); // Switch to logs tab when deployment starts
    setError(null);
    setLogs([]);
    setProgress(0);
    setCurrentPhase('preparing');
    addLog('🚀 Starting deployment to Azure...');
    addLog(`📁 Project: ${projectName}`);
    addLog(`🌐 Service: ${SERVICE_OPTIONS[selectedService].name}`);
    addLog(`📍 Region: ${selectedRegion}`);

    try {
      const response = await fetch('/api/azure/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          projectName,
          projectDirectory,
          serviceType: selectedService,
          sku: selectedSku,
          location: selectedRegion,
          environment: selectedEnv,
          enableMonitoring: true, // Always enabled
          stream: true, // Enable streaming
          // Database migration - 'auto' uses smart default (push-safe)
          migrationStrategy: migrationStrategy === 'auto'
            ? (migrationStatus.hasPendingMigrations ? 'migrate' : 'push-safe')
            : migrationStrategy,
          seedDatabase: seedAfterMigration,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Deployment failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.slice(6));

            // Handle log messages
            if (data.log) {
              const log = data.log;
              addLog(log);

              // Update phase based on log content (match actual service messages)
              if (log.includes('Initializing Azure') || log.includes('Analyzing project') || log.includes('Creating resource group')) {
                setCurrentPhase('preparing');
                setProgress(10);
              } else if (log.includes('Installing dependencies') || log.includes('npm install')) {
                setCurrentPhase('building');
                setProgress(15);
              } else if (log.includes('Building project') || log.includes('🔨')) {
                setCurrentPhase('building');
                setProgress(25);
              } else if (log.includes('Build completed') || log.includes('Build output verified')) {
                setCurrentPhase('building');
                setProgress(35);
              } else if (log.includes('Packaging') || log.includes('Package size') || log.includes('Packaged')) {
                setCurrentPhase('packaging');
                setProgress(45);
              } else if (log.includes('Uploading') || log.includes('📡') || log.includes('📤')) {
                setCurrentPhase('uploading');
                setProgress(55);
              } else if (log.includes('Upload accepted') || log.includes('Upload response')) {
                setCurrentPhase('uploading');
                setProgress(65);
              } else if (log.includes('Creating Web App') || log.includes('Creating App Service') || log.includes('⏳ Deploying')) {
                setCurrentPhase('deploying');
                setProgress(75);
              } else if (log.includes('Web App created') || log.includes('Code deployed')) {
                setCurrentPhase('deploying');
                setProgress(85);
              } else if (log.includes('Waiting for app') || log.includes('should be live')) {
                setCurrentPhase('verifying');
                setProgress(92);
              } else if (log.includes('Deployment successful') || log.includes('Deployment complete') || log.includes('🎉')) {
                setCurrentPhase('verifying');
                setProgress(98);
              }
            }

            // Handle completion
            if (data.complete && data.result) {
              setCurrentPhase('complete');
              setProgress(100);
              setDeployment(data.result);
              if (data.result.url) {
                setDeployedUrl(data.result.url);
                onDeployComplete?.(data.result.url);
              }
            }

            // Handle errors
            if (data.error) {
              setCurrentPhase('failed');
              setError(data.error);
              addLog(`❌ ${data.error}`);
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (err: any) {
      setCurrentPhase('failed');
      setError(err.message || 'Deployment failed');
      addLog(`❌ Error: ${err.message}`);
    } finally {
      setIsDeploying(false);
    }
  };

  // Loading state
  if (isCheckingCredentials) {
    return (
      <div className="h-full flex flex-col">
        <CardHeader className="pb-3 border-b border-gray-700">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-gray-200">
            <Cloud className="w-4 h-4 text-blue-400" />
            Deploy to Azure
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </CardContent>
      </div>
    );
  }

  // No credentials state
  if (!hasCredentials) {
    return (
      <div className="h-full flex flex-col">
        <CardHeader className="pb-3 border-b border-gray-700">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-gray-200">
            <Cloud className="w-4 h-4 text-blue-400" />
            Deploy to Azure
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center text-center p-6">
          <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-yellow-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-200 mb-2">Azure Credentials Required</h3>
          <p className="text-sm text-gray-400 mb-4 max-w-xs">
            Configure your Azure Service Principal in Settings to enable deployment.
          </p>
          <Button variant="default" size="sm" asChild>
            <a href="/settings">
              <Settings className="w-4 h-4 mr-2" />
              Go to Settings
            </a>
          </Button>
        </CardContent>
      </div>
    );
  }

  // Success state
  if (deployment?.success && currentPhase === 'complete') {
    return (
      <div className="h-full flex flex-col">
        <CardHeader className="pb-3 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-gray-200">
              <Cloud className="w-4 h-4 text-blue-400" />
              Deploy to Azure
            </CardTitle>
            {deployedUrl && (
              <a
                href={deployedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded border border-green-500/30 hover:bg-green-500/30 transition-colors"
              >
                <Globe className="w-3 h-3" />
                <span className="max-w-[150px] truncate">{deployedUrl.replace('https://', '')}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-4 space-y-4">
          {/* Success Banner */}
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-green-400">Deployment Successful!</h3>
                <p className="text-sm text-gray-400">Your app is live on Azure</p>
              </div>
            </div>

            {deployment.url && (
              <div className="flex items-center gap-2 p-2 bg-gray-800/50 rounded border border-gray-700">
                <Globe className="w-4 h-4 text-green-400 flex-shrink-0" />
                <a
                  href={deployment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-sm font-medium text-green-400 hover:underline truncate"
                >
                  {deployment.url}
                </a>
                <CopyButton text={deployment.url} />
                <a
                  href={deployment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded hover:bg-gray-700/50 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                </a>
              </div>
            )}
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
              <p className="text-xs text-gray-500 mb-1">Service</p>
              <p className="text-sm font-medium text-gray-200 capitalize">{deployment.serviceType.replace('-', ' ')}</p>
            </div>
            <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
              <p className="text-xs text-gray-500 mb-1">Resource Group</p>
              <p className="text-sm font-medium text-gray-200 truncate">{deployment.resourceGroupName}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700/50" asChild>
              <a href={deployment.url} target="_blank" rel="noopener noreferrer">
                <Eye className="w-4 h-4 mr-1.5" />
                View App
              </a>
            </Button>
            <Button variant="outline" size="sm" className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700/50" onClick={resetDeployment}>
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Deploy Again
            </Button>
          </div>

          {/* Logs Accordion */}
          <div>
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-300 transition-colors"
            >
              {showLogs ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Deployment Logs ({logs.length} lines)
            </button>
            {showLogs && (
              <div className="mt-2 h-48">
                <LogViewer logs={logs} />
              </div>
            )}
          </div>
        </CardContent>
      </div>
    );
  }

  // Main deployment UI
  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-blue-950/20 to-gray-900/30">
      {/* Header - Black bar with Deploy button like Infra tab */}
      <div className="bg-gray-900 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cloud className="w-5 h-5 text-blue-400" />
            <span className="text-sm font-medium text-white">Deploy to Azure</span>
            {deployedUrl && (
              <a
                href={deployedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
              >
                <Globe className="w-3 h-3" />
                <span className="max-w-[100px] truncate">{deployedUrl.replace('https://', '')}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <div className="flex items-center gap-2">
            {buildStatus === 'completed' ? (
              <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded border border-green-500/30">
                Ready
              </span>
            ) : (
              <span className="px-2 py-0.5 text-xs bg-gray-600/50 text-gray-400 rounded border border-gray-600">
                Build Required
              </span>
            )}
            <Button
              size="sm"
              disabled={buildStatus !== 'completed' || isDeploying || (projectAnalysis.hasPrisma && !projectAnalysis.databaseReady)}
              onClick={startDeployment}
              className="h-7"
            >
              {isDeploying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Rocket className="w-3.5 h-3.5 mr-1.5" />
                  Deploy
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <CardContent className="flex-1 overflow-hidden flex flex-col p-0">
        {/* Deployment Progress - Always visible when deploying */}
        {isDeploying && (
          <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-300">{PHASE_CONFIG[currentPhase].label}...</span>
              <span className="text-xs text-gray-500">{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5 mb-3" />
            <div className="flex flex-wrap gap-1.5">
              {(['preparing', 'building', 'packaging', 'uploading', 'deploying', 'verifying'] as DeploymentPhase[]).map((phase, i) => (
                <PhaseStep key={phase} phase={phase} currentPhase={currentPhase} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'database' | 'appservice' | 'config' | 'env' | 'logs')} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 mt-3 grid grid-cols-5 h-8 bg-gray-800/60 border border-gray-700">
            <TabsTrigger
              value="database"
              className="text-xs h-7 text-gray-300 data-[state=active]:bg-gray-700 data-[state=active]:text-white relative"
            >
              <Database className={cn("w-3 h-3 mr-1", provisionedDatabase ? "text-green-400" : (projectAnalysis.hasPrisma && !projectAnalysis.databaseReady) ? "text-amber-400" : "")} />
              DB
              {!provisionedDatabase && projectAnalysis.hasPrisma && !projectAnalysis.databaseReady && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full" />
              )}
            </TabsTrigger>
            <TabsTrigger
              value="appservice"
              className="text-xs h-7 text-gray-300 data-[state=active]:bg-gray-700 data-[state=active]:text-white"
            >
              <Server className={cn("w-3 h-3 mr-1", deployedUrl ? "text-green-400" : "")} />
              App
            </TabsTrigger>
            <TabsTrigger
              value="config"
              className="text-xs h-7 text-gray-300 data-[state=active]:bg-gray-700 data-[state=active]:text-white"
            >
              <Settings className="w-3 h-3 mr-1" />
              Config
            </TabsTrigger>
            <TabsTrigger
              value="env"
              className="text-xs h-7 text-gray-300 data-[state=active]:bg-gray-700 data-[state=active]:text-white"
            >
              <Key className="w-3 h-3 mr-1" />
              Env
            </TabsTrigger>
            <TabsTrigger
              value="logs"
              className="text-xs h-7 text-gray-300 data-[state=active]:bg-gray-700 data-[state=active]:text-white"
            >
              <Terminal className="w-3 h-3 mr-1" />
              Logs
            </TabsTrigger>
          </TabsList>

          {/* Database Tab */}
          <TabsContent value="database" className="flex-1 overflow-auto px-4 py-3 space-y-4 m-0">
            {/* Status Header */}
            <div className={cn(
              "p-3 rounded-lg border flex items-center justify-between",
              provisionedDatabase ? "bg-green-500/10 border-green-500/30" :
              (projectAnalysis.hasPrisma && !projectAnalysis.databaseReady) ? "bg-amber-500/10 border-amber-500/30" :
              "bg-gray-800/40 border-gray-700"
            )}>
              <div className="flex items-center gap-3">
                <Database className={cn(
                  "w-5 h-5",
                  provisionedDatabase ? "text-green-400" :
                  (projectAnalysis.hasPrisma && !projectAnalysis.databaseReady) ? "text-amber-400" : "text-gray-500"
                )} />
                <div>
                  <p className={cn(
                    "text-sm font-medium",
                    provisionedDatabase ? "text-green-400" :
                    (projectAnalysis.hasPrisma && !projectAnalysis.databaseReady) ? "text-amber-400" : "text-gray-400"
                  )}>
                    {provisionedDatabase ? `${provisionedDatabase.provider} Database` :
                     (projectAnalysis.hasPrisma && !projectAnalysis.databaseReady) ? "Database Required" :
                     projectAnalysis.hasPrisma ? "Database Configured" : "No Database Needed"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {provisionedDatabase ? provisionedDatabase.host :
                     (projectAnalysis.hasPrisma && !projectAnalysis.databaseReady) ? "Provision PostgreSQL for production deployment" :
                     "Project does not require a database"}
                  </p>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={refreshInfraHealth} disabled={isLoadingInfra}>
                <RefreshCw className={cn("w-4 h-4", isLoadingInfra && "animate-spin")} />
              </Button>
            </div>

            {/* Provisioning UI */}
            {!provisionedDatabase && projectAnalysis.hasPrisma && !projectAnalysis.databaseReady && (
              <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700 space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-white mb-1">Provision Database</h4>
                  <p className="text-xs text-gray-400">
                    {projectAnalysis.hasSqlite
                      ? "Your project uses SQLite which only works locally. Choose a cloud PostgreSQL provider:"
                      : "Choose a database provider to set up PostgreSQL for your app:"}
                  </p>
                </div>

                {provisionError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                    {provisionError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => provisionDatabase('neon')}
                    disabled={isProvisioning}
                    className="p-4 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-green-500/50 hover:bg-green-500/5 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Database className="w-5 h-5 text-green-400" />
                      <span className="text-sm font-medium text-white">Neon</span>
                      <span className="px-1.5 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded">Free Tier</span>
                    </div>
                    <p className="text-xs text-gray-500">Serverless PostgreSQL with generous free tier. Great for development.</p>
                  </button>
                  <button
                    onClick={() => provisionDatabase('azure')}
                    disabled={isProvisioning}
                    className="p-4 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-blue-500/50 hover:bg-blue-500/5 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Cloud className="w-5 h-5 text-blue-400" />
                      <span className="text-sm font-medium text-white">Azure</span>
                      <span className="px-1.5 py-0.5 text-[10px] bg-blue-500/20 text-blue-400 rounded">Flexible</span>
                    </div>
                    <p className="text-xs text-gray-500">Azure PostgreSQL Flexible Server. Best for production workloads.</p>
                  </button>
                </div>

                {isProvisioning && (
                  <div className="flex items-center gap-2 text-sm text-blue-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Provisioning database...
                  </div>
                )}
              </div>
            )}

            {/* Database Info */}
            {provisionedDatabase && (
              <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Provider</p>
                    <p className="text-sm text-white font-medium">{provisionedDatabase.provider}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Database</p>
                    <p className="text-sm text-white font-medium">{provisionedDatabase.database}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Port</p>
                    <p className="text-sm text-white font-medium">{provisionedDatabase.port || 5432}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-500 mb-1">Host</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs text-gray-300 bg-gray-900 px-2 py-1 rounded font-mono truncate">
                      {provisionedDatabase.host}
                    </code>
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => navigator.clipboard.writeText(provisionedDatabase.host)}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {/* Metrics */}
                {databaseMetrics && databaseMetrics.cpu !== undefined && (
                  <div className="pt-3 border-t border-gray-700">
                    <p className="text-xs text-gray-500 mb-3">Metrics</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-400">CPU</span>
                          <span className="text-xs text-cyan-400">{(databaseMetrics.cpu ?? 0).toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-cyan-400 rounded-full transition-all" style={{ width: `${Math.min(databaseMetrics.cpu ?? 0, 100)}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-400">Memory</span>
                          <span className="text-xs text-purple-400">{(databaseMetrics.memory ?? 0).toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-400 rounded-full transition-all" style={{ width: `${Math.min(databaseMetrics.memory ?? 0, 100)}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-400">Connections</span>
                          <span className="text-xs text-green-400">{Math.round(databaseMetrics.connections ?? 0)}</span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-green-400 rounded-full transition-all" style={{ width: `${Math.min((databaseMetrics.connections ?? 0) / 100 * 100, 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Models */}
                {projectAnalysis.models.length > 0 && (
                  <div className="pt-3 border-t border-gray-700">
                    <p className="text-xs text-gray-500 mb-2">Prisma Models ({projectAnalysis.models.length})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {projectAnalysis.models.map((m) => (
                        <span key={m} className="px-2 py-1 text-xs bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Provisioning Logs */}
            {provisionLogs.length > 0 && (
              <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-700 flex items-center gap-2">
                  <Terminal className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-400">Provisioning Log</span>
                </div>
                <div className="p-3 font-mono text-xs max-h-48 overflow-y-auto">
                  {provisionLogs.map((log, i) => (
                    <div key={i} className={cn(
                      "py-0.5",
                      log.includes('Error') ? 'text-red-400' :
                      log.includes('complete') || log.includes('success') ? 'text-green-400' : 'text-gray-400'
                    )}>{log}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Azure Database Logs */}
            {provisionedDatabase && (
              <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-3 h-3 text-cyan-400" />
                    <span className="text-xs text-gray-400">Database Logs</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs"
                    onClick={fetchDbLogs}
                    disabled={isLoadingDbLogs}
                  >
                    {isLoadingDbLogs ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                  </Button>
                </div>
                <div className="p-3 font-mono text-xs max-h-48 overflow-y-auto">
                  {azureDbLogs.length === 0 ? (
                    <div className="text-center text-gray-500 py-4">
                      <Database className="w-5 h-5 mx-auto mb-2 opacity-50" />
                      <p>Click refresh to fetch database logs</p>
                    </div>
                  ) : (
                    azureDbLogs.map((log, i) => (
                      <div key={i} className={cn(
                        "py-0.5",
                        log.includes('ERROR') || log.includes('error') ? 'text-red-400' :
                        log.includes('WARN') || log.includes('warn') ? 'text-yellow-400' : 'text-gray-400'
                      )}>{log}</div>
                    ))
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* App Service Tab */}
          <TabsContent value="appservice" className="flex-1 overflow-auto px-4 py-3 space-y-4 m-0">
            {/* Status Header */}
            <div className={cn(
              "p-3 rounded-lg border flex items-center justify-between",
              deployedUrl && appServiceHealth?.state === 'Running' ? "bg-green-500/10 border-green-500/30" :
              deployedUrl ? "bg-yellow-500/10 border-yellow-500/30" :
              "bg-gray-800/40 border-gray-700"
            )}>
              <div className="flex items-center gap-3">
                <Server className={cn(
                  "w-5 h-5",
                  deployedUrl && appServiceHealth?.state === 'Running' ? "text-green-400" :
                  deployedUrl ? "text-yellow-400" : "text-gray-500"
                )} />
                <div>
                  <p className={cn(
                    "text-sm font-medium",
                    deployedUrl && appServiceHealth?.state === 'Running' ? "text-green-400" :
                    appServiceHealth?.state === 'not_found' ? "text-red-400" :
                    deployedUrl ? "text-yellow-400" : "text-gray-400"
                  )}>
                    {!deployedUrl ? "Not Deployed" :
                     appServiceHealth?.state === 'not_found' ? "Resource Not Found" :
                     appServiceHealth?.state || 'Checking...'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {!deployedUrl ? "Deploy your app using the Config tab" :
                     appServiceHealth?.state === 'not_found' ? "Azure resource may have been deleted - redeploy to recreate" :
                     deployedUrl}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {deployedUrl && (
                  <>
                    <Button size="sm" variant="outline" asChild>
                      <a href={deployedUrl} target="_blank" rel="noopener noreferrer">
                        <Globe className="w-4 h-4 mr-1.5" />
                        Open
                      </a>
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  </>
                )}
                <Button size="sm" variant="ghost" onClick={refreshInfraHealth} disabled={isLoadingInfra}>
                  <RefreshCw className={cn("w-4 h-4", isLoadingInfra && "animate-spin")} />
                </Button>
              </div>
            </div>

            {!deployedUrl ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                <Server className="w-12 h-12 text-gray-600 mb-4" />
                <h3 className="text-lg font-medium text-gray-300 mb-2">No Deployment Yet</h3>
                <p className="text-sm text-gray-500 max-w-md mb-4">
                  Configure your deployment settings in the Config tab and click Deploy to see your app status here.
                </p>
                <Button onClick={() => setActiveTab('config')}>
                  <Settings className="w-4 h-4 mr-2" />
                  Go to Config
                </Button>
              </div>
            ) : (
              <>
                {/* Deployment Info */}
                {(() => {
                  // Use stored info from infrastructure config, or derive from URL as fallback
                  const appName = appServiceInfo?.appName || (() => {
                    const urlMatch = deployedUrl?.match(/https?:\/\/([^.]+)/);
                    return urlMatch ? urlMatch[1] : null;
                  })();
                  const resourceGroup = appServiceInfo?.resourceGroup || (appName ? `rg-${appName}` : null);

                  return (
                    <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">App Name</p>
                          <p className="text-sm text-white font-medium">{appName || 'Unknown'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Resource Group</p>
                          <p className="text-sm text-white font-medium">{resourceGroup || 'Unknown'}</p>
                        </div>
                        {appServiceInfo?.sku && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">SKU</p>
                            <p className="text-sm text-white font-medium">{appServiceInfo.sku}</p>
                          </div>
                        )}
                        {appServiceInfo?.deployedAt && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Deployed</p>
                            <p className="text-sm text-white font-medium">{new Date(appServiceInfo.deployedAt).toLocaleString()}</p>
                          </div>
                        )}
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 mb-1">URL</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-xs text-blue-400 bg-gray-900 px-2 py-1 rounded font-mono truncate">
                            {deployedUrl}
                          </code>
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => navigator.clipboard.writeText(deployedUrl || '')}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Health Status */}
                {isLoadingInfra && !appServiceHealth ? (
                  <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-400 mr-2" />
                    <span className="text-sm text-gray-400">Loading app status from Azure...</span>
                  </div>
                ) : appServiceHealth ? (
                  <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700">
                    <h4 className="text-sm font-medium text-white mb-3">Health Status</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                        <div className={cn(
                          "w-3 h-3 rounded-full mx-auto mb-2",
                          appServiceHealth.state === 'Running' ? "bg-green-400" : "bg-yellow-400"
                        )} />
                        <p className="text-sm text-white font-medium">{appServiceHealth.state}</p>
                        <p className="text-xs text-gray-500">State</p>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                        <div className={cn(
                          "w-3 h-3 rounded-full mx-auto mb-2",
                          appServiceHealth.availabilityState === 'Normal' ? "bg-green-400" : "bg-yellow-400"
                        )} />
                        <p className="text-sm text-white font-medium">{appServiceHealth.availabilityState}</p>
                        <p className="text-xs text-gray-500">Availability</p>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                        <div className={cn(
                          "w-3 h-3 rounded-full mx-auto mb-2",
                          appServiceHealth.enabled ? "bg-green-400" : "bg-red-400"
                        )} />
                        <p className="text-sm text-white font-medium">{appServiceHealth.enabled ? 'Yes' : 'No'}</p>
                        <p className="text-xs text-gray-500">Enabled</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-800/40 rounded-lg p-4 border border-gray-700 text-center">
                    <p className="text-sm text-gray-400">Could not load Azure status</p>
                    <Button size="sm" variant="ghost" onClick={refreshInfraHealth} className="mt-2">
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Retry
                    </Button>
                  </div>
                )}

                {/* Azure App Logs */}
                {appServiceInfo && (
                  <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Activity className="w-3 h-3 text-blue-400" />
                        <span className="text-xs text-gray-400">Application Logs</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs"
                        onClick={fetchAppLogs}
                        disabled={isLoadingAppLogs}
                      >
                        {isLoadingAppLogs ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                    <div className="p-3 font-mono text-xs max-h-64 overflow-y-auto">
                      {azureAppLogs.length === 0 ? (
                        <div className="text-center text-gray-500 py-4">
                          <Server className="w-5 h-5 mx-auto mb-2 opacity-50" />
                          <p>Click refresh to fetch application logs from Azure</p>
                        </div>
                      ) : (
                        azureAppLogs.map((log, i) => (
                          <div key={i} className={cn(
                            "py-0.5",
                            log.includes('ERROR') || log.includes('error') || log.includes('Error') ? 'text-red-400' :
                            log.includes('WARN') || log.includes('warn') || log.includes('Warning') ? 'text-yellow-400' :
                            log.includes('INFO') || log.includes('info') ? 'text-blue-400' : 'text-gray-400'
                          )}>{log}</div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Deployment Logs (from current session) */}
                {logs.length > 0 && (
                  <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-400">Deployment Logs (this session)</span>
                      </div>
                      <span className="text-xs text-gray-600">{logs.length} entries</span>
                    </div>
                    <div className="p-3 font-mono text-xs max-h-64 overflow-y-auto">
                      {logs.map((log, i) => (
                        <div key={i} className={cn(
                          "py-0.5",
                          log.includes('Error') || log.includes('error') ? 'text-red-400' :
                          log.includes('complete') || log.includes('success') || log.includes('✓') ? 'text-green-400' : 'text-gray-400'
                        )}>{log}</div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Configuration Tab */}
          <TabsContent value="config" className="flex-1 overflow-auto px-4 py-3 space-y-4 m-0">
            {/* Error Display */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-red-400 mb-1">Deployment Failed</h4>
                    <p className="text-xs text-gray-300 break-words mb-2">{error}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={resetDeployment}
                      className="h-6 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Try Again
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Service Selection */}
            <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-white">Azure Service</label>
                {projectAnalysis.hasPrisma && (
                  <span className="text-[10px] text-green-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Auto-detected
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(SERVICE_OPTIONS) as (keyof typeof SERVICE_OPTIONS)[]).map((key) => {
                  const service = SERVICE_OPTIONS[key];
                  const Icon = service.icon;
                  const isSelected = selectedService === key;

                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedService(key)}
                      disabled={isDeploying}
                      className={cn(
                        'p-2.5 rounded-lg border text-left transition-all relative',
                        isSelected
                          ? `${service.bg} ${service.border}`
                          : 'border-gray-700 hover:border-gray-600 bg-gray-800/50',
                        isDeploying && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      {/* Auto-detected checkmark for App Service */}
                      {key === 'app-service' && projectAnalysis.hasPrisma && (
                        <div className="absolute top-1.5 right-1.5 bg-blue-500 rounded-full p-0.5">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                      <Icon className={cn('w-4 h-4 mb-1', isSelected ? service.color : 'text-gray-400')} />
                      <p className={cn('text-xs font-medium', isSelected ? 'text-white' : 'text-gray-300')}>{service.name}</p>
                      <p className="text-[10px] text-gray-500">{service.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Compact Settings Row - Environment + Region + Tier together */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-white mb-1 block">Environment</label>
                <Select value={selectedEnv} onValueChange={(v) => setSelectedEnv(v as any)} disabled={isDeploying}>
                  <SelectTrigger className="h-8 text-xs bg-gray-800/50 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dev">Development</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-white mb-1 block">Region</label>
                <Select value={selectedRegion} onValueChange={setSelectedRegion} disabled={isDeploying}>
                  <SelectTrigger className="h-8 text-xs bg-gray-800/50 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eastus2">East US 2</SelectItem>
                    <SelectItem value="eastus">East US</SelectItem>
                    <SelectItem value="westus2">West US 2</SelectItem>
                    <SelectItem value="centralus">Central US</SelectItem>
                    <SelectItem value="westeurope">West Europe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-white mb-1 block">Tier</label>
                <Select value={selectedSku} onValueChange={setSelectedSku} disabled={isDeploying}>
                  <SelectTrigger className="h-8 text-xs bg-gray-800/50 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SKU_OPTIONS.map((sku) => (
                      <SelectItem key={sku.value} value={sku.value}>
                        <span>{sku.label} - {sku.price}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Auto-enabled features */}
            <div className="flex items-center gap-4 p-2.5 bg-gray-800/30 rounded-lg border border-gray-700">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-green-500/20 flex items-center justify-center">
                  <Check className="w-3 h-3 text-green-400" />
                </div>
                <span className="text-xs text-white">Application Insights</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-green-500/20 flex items-center justify-center">
                  <Check className="w-3 h-3 text-green-400" />
                </div>
                <span className="text-xs text-white">SSL Certificate</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-green-500/20 flex items-center justify-center">
                  <Check className="w-3 h-3 text-green-400" />
                </div>
                <span className="text-xs text-white">Auto-scaling</span>
              </div>
            </div>

            {/* Database - Simple status with Advanced Options hidden */}
            {projectAnalysis.hasPrisma && (
              <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-700">
                {/* Simple status line - what users see by default */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-medium text-white">Database</span>
                    {migrationStatus.isChecking ? (
                      <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
                    ) : migrationStatus.hasSchemaChanges || migrationStatus.hasPendingMigrations ? (
                      <span className="px-1.5 py-0.5 text-[9px] bg-blue-500/20 text-blue-400 rounded flex items-center gap-1">
                        <RefreshCw className="w-2.5 h-2.5" />
                        Will be updated
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 text-[9px] bg-green-500/20 text-green-400 rounded flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" />
                        Ready
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowAdvancedDbOptions(!showAdvancedDbOptions)}
                    className="text-[10px] text-gray-500 hover:text-gray-400 flex items-center gap-1"
                  >
                    Advanced
                    <ChevronDown className={cn('w-3 h-3 transition-transform', showAdvancedDbOptions && 'rotate-180')} />
                  </button>
                </div>

                {/* Advanced Options - Hidden by default */}
                {showAdvancedDbOptions && (
                  <div className="mt-3 pt-3 border-t border-gray-700 space-y-3">
                    {/* Migration Strategy */}
                    <div className="space-y-2">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Migration Strategy</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setMigrationStrategy('push-safe')}
                          disabled={isDeploying}
                          className={cn(
                            'p-2 rounded-lg border text-left transition-all',
                            migrationStrategy === 'push-safe'
                              ? 'bg-blue-500/10 border-blue-500/30'
                              : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <RefreshCw className={cn('w-3.5 h-3.5', migrationStrategy === 'push-safe' ? 'text-blue-400' : 'text-gray-400')} />
                            <span className={cn('text-xs font-medium', migrationStrategy === 'push-safe' ? 'text-white' : 'text-gray-300')}>
                              Sync Schema
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-500 mt-1">Keeps your data</p>
                        </button>

                        <button
                          onClick={() => setMigrationStrategy('migrate')}
                          disabled={isDeploying || (migrationStatus.hasSchemaChanges && !migrationStatus.hasPendingMigrations)}
                          className={cn(
                            'p-2 rounded-lg border text-left transition-all',
                            migrationStrategy === 'migrate'
                              ? 'bg-green-500/10 border-green-500/30'
                              : 'border-gray-700 hover:border-gray-600 bg-gray-800/50',
                            (migrationStatus.hasSchemaChanges && !migrationStatus.hasPendingMigrations) && 'opacity-50'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className={cn('w-3.5 h-3.5', migrationStrategy === 'migrate' ? 'text-green-400' : 'text-gray-400')} />
                            <span className={cn('text-xs font-medium', migrationStrategy === 'migrate' ? 'text-white' : 'text-gray-300')}>
                              Safe Migrate
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-500 mt-1">Version-controlled</p>
                        </button>
                      </div>

                      {/* Show what 'auto' will do */}
                      {migrationStrategy === 'auto' && (
                        <p className="text-[10px] text-gray-500 italic">
                          Using automatic mode: {migrationStatus.hasPendingMigrations ? 'will apply pending migrations' : 'will sync schema safely'}
                        </p>
                      )}

                      {/* Generate migrations button if needed */}
                      {migrationStatus.hasSchemaChanges && !migrationStatus.hasPendingMigrations && migrationStrategy === 'migrate' && (
                        <button
                          onClick={generateMigration}
                          disabled={migrationStatus.isGenerating}
                          className={cn(
                            'w-full px-3 py-2 text-xs font-medium rounded-lg transition-all',
                            'bg-green-500/20 text-green-400 border border-green-500/30',
                            'hover:bg-green-500/30',
                            migrationStatus.isGenerating && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          {migrationStatus.isGenerating ? (
                            <>
                              <Loader2 className="w-3 h-3 inline mr-1.5 animate-spin" />
                              Generating migration files...
                            </>
                          ) : (
                            <>
                              <FileCode className="w-3 h-3 inline mr-1.5" />
                              Generate Migration Files
                            </>
                          )}
                        </button>
                      )}

                      {/* Dangerous options */}
                      {selectedEnv !== 'production' && (
                        <div className="pt-2 border-t border-gray-700/50">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Destructive Options</p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setMigrationStrategy('push-force')}
                              disabled={isDeploying}
                              className={cn(
                                'p-2 rounded-lg border text-left transition-all',
                                migrationStrategy === 'push-force'
                                  ? 'bg-yellow-500/10 border-yellow-500/30'
                                  : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <AlertTriangle className={cn('w-3.5 h-3.5', migrationStrategy === 'push-force' ? 'text-yellow-400' : 'text-gray-400')} />
                                <span className={cn('text-xs font-medium', migrationStrategy === 'push-force' ? 'text-white' : 'text-gray-300')}>
                                  Force Push
                                </span>
                              </div>
                              <p className="text-[10px] text-yellow-500/70 mt-1">May lose data</p>
                            </button>

                            <button
                              onClick={() => {
                                setMigrationStrategy('reset');
                                setShowResetConfirm(true);
                              }}
                              disabled={isDeploying}
                              className={cn(
                                'p-2 rounded-lg border text-left transition-all',
                                migrationStrategy === 'reset'
                                  ? 'bg-red-500/10 border-red-500/30'
                                  : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <Trash2 className={cn('w-3.5 h-3.5', migrationStrategy === 'reset' ? 'text-red-400' : 'text-gray-400')} />
                                <span className={cn('text-xs font-medium', migrationStrategy === 'reset' ? 'text-white' : 'text-gray-300')}>
                                  Reset & Seed
                                </span>
                              </div>
                              <p className="text-[10px] text-red-500/70 mt-1">Wipes all data</p>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Reset confirmation warning */}
                      {migrationStrategy === 'reset' && (
                        <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs text-red-400 font-medium">Warning: This will delete ALL data!</p>
                              <p className="text-[10px] text-gray-400 mt-1">
                                The database will be completely wiped and re-seeded with fresh data.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick summary */}
            <div className="text-[10px] text-gray-500">
              Deploying to <span className="text-gray-300">{selectedRegion}</span> as <span className="text-gray-300">{selectedEnv}</span> with <span className="text-gray-300">{SKU_OPTIONS.find(s => s.value === selectedSku)?.label}</span> tier ({SKU_OPTIONS.find(s => s.value === selectedSku)?.price})
            </div>
          </TabsContent>

          {/* Environment Tab */}
          <TabsContent value="env" className="flex-1 overflow-auto px-4 py-3 space-y-3 m-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-medium text-white">Environment Variables</span>
              </div>
              <div className="flex items-center gap-1">
                {(['local', 'dev', 'staging', 'production'] as const).map((env) => (
                  <button
                    key={env}
                    onClick={() => setSelectedEnvTab(env)}
                    className={cn(
                      'px-2 py-1 text-[10px] rounded transition-all',
                      selectedEnvTab === env
                        ? env === 'production'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : env === 'staging'
                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                            : env === 'local'
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'text-gray-500 hover:text-gray-300'
                    )}
                  >
                    {env.charAt(0).toUpperCase() + env.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Env file indicator */}
            <div className="flex items-center gap-2 text-[10px] text-gray-500">
              <FileCode className="w-3 h-3" />
              <span>
                From: {selectedEnvTab === 'local' ? '.env, .env.local' : `.env.${selectedEnvTab === 'dev' ? 'development' : selectedEnvTab}`}
              </span>
            </div>

            {/* Sync warning banner */}
            {envNeedsSync && (
              <div className="flex items-center justify-between p-2.5 bg-amber-500/10 border border-amber-500/30 rounded">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-amber-300">
                    .env file uses SQLite but database is provisioned. Sync to update.
                  </span>
                </div>
                <button
                  onClick={syncEnvFiles}
                  disabled={isSyncingEnv}
                  className={cn(
                    "px-2.5 py-1 text-xs rounded transition-all flex items-center gap-1.5",
                    "bg-amber-500/20 text-amber-400 border border-amber-500/30",
                    "hover:bg-amber-500/30",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {isSyncingEnv ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3 h-3" />
                      Sync Now
                    </>
                  )}
                </button>
              </div>
            )}

            {isLoadingEnv ? (
              <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
                Loading environment variables...
              </div>
            ) : envVars.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <EyeOff className="w-8 h-8 text-gray-600 mb-2" />
                <p className="text-sm text-gray-300">No environment variables found</p>
                <p className="text-xs text-gray-500 mt-1">
                  Add a .env or .env.{selectedEnvTab} file to your project
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {envVars.map((envVar, idx) => {
                  // Get value for selected environment, fall back to base value
                  const envValue = envVar.perEnv?.[selectedEnvTab] || envVar.value;
                  const isDifferent = envVar.perEnv?.[selectedEnvTab] && envVar.perEnv[selectedEnvTab] !== envVar.value;
                  const isDefault = envVar.isDefault || envVar.source === 'default';

                  return (
                    <div
                      key={idx}
                      className={cn(
                        "flex items-center justify-between p-2 bg-gray-800/50 rounded border",
                        isDefault ? "border-amber-500/30" : isDifferent ? "border-blue-500/30" : "border-gray-700"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs font-mono font-medium text-yellow-400 whitespace-nowrap">
                          {envVar.key}
                        </span>
                        <span className="text-gray-600">=</span>
                        <span className={cn(
                          "text-xs font-mono truncate",
                          envVar.masked ? "text-gray-500 italic" : isDefault ? "text-amber-300" : "text-white"
                        )}>
                          {envValue}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        {isDefault && (
                          <span className="text-[10px] text-amber-400">
                            expected
                          </span>
                        )}
                        {isDifferent && !isDefault && (
                          <span className="text-[10px] text-blue-400">
                            {selectedEnvTab} override
                          </span>
                        )}
                        {envVar.source && !isDifferent && !isDefault && (
                          <span className="text-[10px] text-gray-600">{envVar.source}</span>
                        )}
                        {envVar.masked && (
                          <span title="Sensitive value masked">
                            <Shield className="w-3 h-3 text-gray-500" />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                <p className="text-[10px] text-gray-500 mt-2 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  {selectedEnvTab === 'local'
                    ? 'Local development uses SQLite (.env.local)'
                    : `Variables for ${selectedEnvTab} will be deployed to Azure App Settings`
                  }
                </p>
              </div>
            )}
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="flex-1 overflow-hidden m-0 flex flex-col">
            <div className="flex-1 mx-4 my-3 overflow-hidden rounded-lg border border-gray-700">
              <LogViewer logs={logs} />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Status bar at bottom */}
      {(projectAnalysis.hasPrisma && !projectAnalysis.databaseReady) && (
        <div className="px-4 py-2 border-t border-gray-700 bg-gray-900/50">
          <p className="text-[10px] text-center text-amber-400">
            Configure database before deploying
          </p>
        </div>
      )}
      {buildStatus !== 'completed' && !(projectAnalysis.hasPrisma && !projectAnalysis.databaseReady) && (
        <div className="px-4 py-2 border-t border-gray-700 bg-gray-900/50">
          <p className="text-[10px] text-center text-gray-500">
            Complete the build first to enable deployment
          </p>
        </div>
      )}
    </div>
  );
}
