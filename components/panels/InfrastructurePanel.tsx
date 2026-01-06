'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Cloud,
  Database,
  Server,
  HardDrive,
  Globe,
  Zap,
  RefreshCw,
  CheckCircle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Copy,
  ExternalLink,
  Activity,
  Terminal,
  MapPin,
  Users,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface DeploymentInfo {
  success: boolean;
  appName: string;
  resourceGroupName: string;
  url?: string;
  serviceType: string;
}

interface DatabaseInfo {
  provider: string;
  host: string;
  database: string;
  status: 'provisioned' | 'connected' | 'error';
}

interface ProjectAnalysis {
  hasPrisma: boolean;
  hasSqlite: boolean;
  hasPostgresUrl: boolean;
  databaseReady: boolean;
  models: string[];
}

interface InfrastructurePanelProps {
  projectId: string;
  projectDirectory?: string;
  deployment?: DeploymentInfo | null;
  provisionedDatabase?: DatabaseInfo | null;
  projectAnalysis?: ProjectAnalysis;
  onDatabaseProvisioned?: (database: DatabaseInfo) => void;
  onProvisioningStart?: () => void;
}

interface AppServiceHealth {
  state: string;
  availabilityState: string;
  usageState: string;
  enabled: boolean;
  lastModifiedTime: string;
  defaultHostName: string;
}

interface DatabaseMetrics {
  cpu: number;
  memory: number;
  storage: number;
  connections: number;
}

export default function InfrastructurePanel({
  projectId,
  projectDirectory,
  deployment,
  provisionedDatabase,
  projectAnalysis,
  onDatabaseProvisioned,
  onProvisioningStart,
}: InfrastructurePanelProps) {
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [provisionLogs, setProvisionLogs] = useState<string[]>([]);
  const [localProvisionedDb, setLocalProvisionedDb] = useState<DatabaseInfo | null>(null);
  const [localDeployment, setLocalDeployment] = useState<DeploymentInfo | null>(null);
  const [localProjectAnalysis, setLocalProjectAnalysis] = useState<ProjectAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Health states
  const [appServiceHealth, setAppServiceHealth] = useState<AppServiceHealth | null>(null);
  const [databaseMetrics, setDatabaseMetrics] = useState<DatabaseMetrics | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);

  // Expanded sections
  const [expandedSection, setExpandedSection] = useState<'database' | 'appservice' | 'logs' | null>('database');

  // Use provided or loaded data
  const database = provisionedDatabase || localProvisionedDb;
  const currentDeployment = deployment || localDeployment;
  const analysis = projectAnalysis || localProjectAnalysis;

  // Load existing database config and project info on mount
  useEffect(() => {
    const loadProjectData = async () => {
      if (!projectDirectory) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // Load database config
        const dbResponse = await fetch(`/api/database/provision?projectId=${projectId}`);
        if (dbResponse.ok) {
          const dbData = await dbResponse.json();
          if (dbData.hasDatabase) {
            setLocalProvisionedDb({
              provider: dbData.provider,
              host: dbData.host || '',
              database: dbData.database || projectId,
              status: 'provisioned',
            });
          }
        }

        // Load project analysis
        const analysisResponse = await fetch(
          `/api/projects/${projectId}/analyze?directory=${encodeURIComponent(projectDirectory)}`
        );
        if (analysisResponse.ok) {
          const analysisData = await analysisResponse.json();
          setLocalProjectAnalysis({
            hasPrisma: analysisData.hasPrisma,
            hasSqlite: analysisData.hasSqlite,
            hasPostgresUrl: analysisData.hasPostgresUrl,
            databaseReady: analysisData.databaseReady,
            models: analysisData.models || [],
          });
        }

        // Load deployment info from projects.json
        const projectsResponse = await fetch('/api/projects');
        if (projectsResponse.ok) {
          const projectsData = await projectsResponse.json();
          const project = projectsData.projects?.find((p: any) => p.id === projectId);
          if (project?.deploymentUrl) {
            // Try to extract app name from deployment URL
            const urlMatch = project.deploymentUrl.match(/https?:\/\/([^.]+)/);
            const appName = urlMatch ? urlMatch[1] : projectId;
            setLocalDeployment({
              success: true,
              appName: appName,
              resourceGroupName: `rg-${projectId}-dev`,
              url: project.deploymentUrl,
              serviceType: 'app-service',
            });
          }
        }
      } catch (error) {
        console.error('Failed to load project data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProjectData();
  }, [projectId, projectDirectory]);

  // Add log helper
  const addProvisionLog = useCallback((msg: string) => {
    setProvisionLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);
  }, []);

  // Provision database
  const provisionDatabase = async (provider: 'neon' | 'azure') => {
    setIsProvisioning(true);
    setProvisionError(null);
    setProvisionLogs([]);
    onProvisioningStart?.();

    const timeoutIds: NodeJS.Timeout[] = [];

    try {
      const dbName = projectId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      addProvisionLog(`Starting ${provider === 'neon' ? 'Neon Serverless' : 'Azure PostgreSQL'} provisioning...`);
      addProvisionLog(`Database name: ${dbName}`);

      if (provider === 'azure') {
        addProvisionLog('Authenticating with Azure...');
        timeoutIds.push(setTimeout(() => addProvisionLog('Creating resource group (if needed)...'), 2000));
        timeoutIds.push(setTimeout(() => addProvisionLog('Provisioning PostgreSQL Flexible Server...'), 4000));
        timeoutIds.push(setTimeout(() => addProvisionLog('This typically takes 5-10 minutes...'), 6000));
        timeoutIds.push(setTimeout(() => addProvisionLog('Pushing schema to database...'), 400000));
        timeoutIds.push(setTimeout(() => addProvisionLog('Running database seed (if exists)...'), 440000));
      } else {
        addProvisionLog('Connecting to Neon API...');
        timeoutIds.push(setTimeout(() => addProvisionLog('Creating Neon project...'), 1000));
        timeoutIds.push(setTimeout(() => addProvisionLog('Pushing schema to database...'), 4000));
        timeoutIds.push(setTimeout(() => addProvisionLog('Running database seed (if exists)...'), 6000));
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
          location: 'eastus2',
        }),
      });

      clearAllTimeouts();
      const data = await response.json();

      if (!response.ok) {
        addProvisionLog(`Error: ${data.error || 'Failed to provision database'}`);
        throw new Error(data.error || 'Failed to provision database');
      }

      addProvisionLog('Database server created successfully!');
      addProvisionLog(`   Provider: ${data.database?.provider || provider}`);
      addProvisionLog(`   Host: ${data.database?.host}`);
      addProvisionLog(`   Database: ${data.database?.database}`);

      if (data.schemaPushed) {
        addProvisionLog('Schema pushed to database - tables created!');
      }
      if (data.databaseSeeded) {
        addProvisionLog('Database seeded with initial data!');
      }

      const dbInfo: DatabaseInfo = {
        provider: data.database?.provider || provider,
        host: data.database?.host || '',
        database: data.database?.database || '',
        status: 'provisioned',
      };

      setLocalProvisionedDb(dbInfo);
      onDatabaseProvisioned?.(dbInfo);

      addProvisionLog('');
      addProvisionLog('Database provisioning complete!');

    } catch (err: any) {
      setProvisionError(err.message || 'Failed to provision database');
      addProvisionLog(`${err.message || 'Failed to provision database'}`);
    } finally {
      setIsProvisioning(false);
    }
  };

  // Load App Service health
  const loadAppServiceHealth = useCallback(async () => {
    if (!currentDeployment?.appName || !currentDeployment?.resourceGroupName) return;

    setIsLoadingHealth(true);
    try {
      const response = await fetch(
        `/api/azure/health?appName=${currentDeployment.appName}&resourceGroup=${currentDeployment.resourceGroupName}`
      );
      if (response.ok) {
        const data = await response.json();
        setAppServiceHealth(data);
      }
    } catch (error) {
      console.error('Failed to load App Service health:', error);
    } finally {
      setIsLoadingHealth(false);
    }
  }, [currentDeployment?.appName, currentDeployment?.resourceGroupName]);

  // Load database metrics
  const loadDatabaseMetrics = useCallback(async () => {
    if (!database?.host) return;

    try {
      const serverName = database.host.split('.')[0];
      const response = await fetch(
        `/api/database/azure?action=metrics&serverName=${serverName}&resourceGroup=ai-platform-databases`
      );
      if (response.ok) {
        const data = await response.json();
        // Handle both { metrics: {...} } and { cpu, memory, ... } structures
        const metrics = data.metrics || data;
        if (metrics.cpu !== undefined) {
          setDatabaseMetrics(metrics);
        }
      }
    } catch (error) {
      console.error('Failed to load database metrics:', error);
    }
  }, [database?.host]);

  // Auto-load health when deployment exists
  useEffect(() => {
    if (currentDeployment) {
      loadAppServiceHealth();
    }
  }, [currentDeployment, loadAppServiceHealth]);

  useEffect(() => {
    if (database) {
      loadDatabaseMetrics();
    }
  }, [database, loadDatabaseMetrics]);

  const needsDatabase = analysis?.hasPrisma && !analysis?.databaseReady && !database;
  const hasDeployment = !!currentDeployment;

  // Show loading state
  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-900">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400 mb-2" />
        <p className="text-sm text-gray-400">Loading infrastructure...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-900">
      {/* Header */}
      <div className="flex-none p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-sm font-semibold text-gray-100">Infrastructure</h2>
              <p className="text-xs text-gray-500">Database & App Service for {projectId}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              loadAppServiceHealth();
              loadDatabaseMetrics();
            }}
            disabled={isLoadingHealth}
            className="h-7"
          >
            <RefreshCw className={cn("w-3 h-3", isLoadingHealth && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {/* Database Section */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <button
            onClick={() => setExpandedSection(expandedSection === 'database' ? null : 'database')}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Database className={cn(
                "w-4 h-4",
                database ? "text-green-400" : needsDatabase ? "text-amber-400" : "text-gray-400"
              )} />
              <div className="text-left">
                <p className="text-sm font-medium text-white">Database</p>
                <p className="text-xs text-gray-500">
                  {database ? `${database.provider} - ${database.database}` :
                   needsDatabase ? 'Setup required' : 'Not configured'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {database && (
                <span className="px-2 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded">
                  Ready
                </span>
              )}
              {needsDatabase && (
                <span className="px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded">
                  Required
                </span>
              )}
              {expandedSection === 'database' ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </button>

          {expandedSection === 'database' && (
            <div className="p-3 pt-0 border-t border-gray-700 space-y-3">
              {/* Provision Actions */}
              {needsDatabase && (
                <div className="bg-gray-900/50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-3">
                    {analysis?.hasSqlite
                      ? "Your project uses SQLite (local only). Provision PostgreSQL for deployment."
                      : "Choose a database provider to set up PostgreSQL."}
                  </p>

                  {provisionError && (
                    <div className="p-2 mb-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
                      {provisionError}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => provisionDatabase('neon')}
                      disabled={isProvisioning}
                      className="h-8 bg-green-600 hover:bg-green-700 text-white"
                    >
                      {isProvisioning ? (
                        <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                      ) : (
                        <Database className="w-3 h-3 mr-1.5" />
                      )}
                      Neon (Free)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => provisionDatabase('azure')}
                      disabled={isProvisioning}
                      className="h-8 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                    >
                      {isProvisioning ? (
                        <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                      ) : (
                        <Cloud className="w-3 h-3 mr-1.5" />
                      )}
                      Azure PostgreSQL
                    </Button>
                  </div>
                </div>
              )}

              {/* Database Info */}
              {database && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-gray-900/50 rounded p-2">
                      <span className="text-gray-500 block">Provider</span>
                      <span className="text-white font-medium">{database.provider}</span>
                    </div>
                    <div className="bg-gray-900/50 rounded p-2">
                      <span className="text-gray-500 block">Database</span>
                      <span className="text-white font-medium">{database.database}</span>
                    </div>
                    <div className="col-span-2 bg-gray-900/50 rounded p-2">
                      <span className="text-gray-500 block">Host</span>
                      <span className="text-white font-medium text-[11px] truncate block">{database.host}</span>
                    </div>
                  </div>

                  {/* Database Metrics */}
                  {databaseMetrics && databaseMetrics.cpu !== undefined && (
                    <div>
                      <p className="text-[10px] text-gray-500 mb-2">Metrics</p>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="bg-gray-900/50 rounded p-2 text-center">
                          <Activity className="w-3 h-3 text-cyan-400 mx-auto mb-1" />
                          <p className="text-[10px] text-white font-medium">{(databaseMetrics.cpu ?? 0).toFixed(1)}%</p>
                          <p className="text-[8px] text-gray-500">CPU</p>
                        </div>
                        <div className="bg-gray-900/50 rounded p-2 text-center">
                          <HardDrive className="w-3 h-3 text-purple-400 mx-auto mb-1" />
                          <p className="text-[10px] text-white font-medium">{(databaseMetrics.memory ?? 0).toFixed(1)}%</p>
                          <p className="text-[8px] text-gray-500">Memory</p>
                        </div>
                        <div className="bg-gray-900/50 rounded p-2 text-center">
                          <Database className="w-3 h-3 text-blue-400 mx-auto mb-1" />
                          <p className="text-[10px] text-white font-medium">{(databaseMetrics.storage ?? 0).toFixed(1)}%</p>
                          <p className="text-[8px] text-gray-500">Storage</p>
                        </div>
                        <div className="bg-gray-900/50 rounded p-2 text-center">
                          <Users className="w-3 h-3 text-green-400 mx-auto mb-1" />
                          <p className="text-[10px] text-white font-medium">{Math.round(databaseMetrics.connections ?? 0)}</p>
                          <p className="text-[8px] text-gray-500">Conns</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const connStr = `postgresql://pgadmin:PASSWORD@${database.host}:5432/${database.database}?sslmode=require`;
                        navigator.clipboard.writeText(connStr);
                      }}
                      className="h-6 text-[10px] flex-1"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy URL
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`https://portal.azure.com`, '_blank')}
                      className="h-6 text-[10px]"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Models */}
              {analysis?.models && analysis.models.length > 0 && (
                <div>
                  <p className="text-[10px] text-gray-500 mb-1">Prisma Models</p>
                  <div className="flex flex-wrap gap-1">
                    {analysis.models.map((model) => (
                      <span key={model} className="px-1.5 py-0.5 text-[10px] bg-blue-500/20 text-blue-300 rounded">
                        {model}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* App Service Section */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <button
            onClick={() => setExpandedSection(expandedSection === 'appservice' ? null : 'appservice')}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Globe className={cn(
                "w-4 h-4",
                hasDeployment ? "text-green-400" : "text-gray-400"
              )} />
              <div className="text-left">
                <p className="text-sm font-medium text-white">App Service</p>
                <p className="text-xs text-gray-500">
                  {hasDeployment ? currentDeployment.appName : 'Not deployed'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasDeployment && (
                <span className={cn(
                  "px-2 py-0.5 text-[10px] rounded",
                  appServiceHealth?.state === 'Running'
                    ? "bg-green-500/20 text-green-400"
                    : "bg-yellow-500/20 text-yellow-400"
                )}>
                  {appServiceHealth?.state || 'Unknown'}
                </span>
              )}
              {!hasDeployment && (
                <span className="px-2 py-0.5 text-[10px] bg-gray-700 text-gray-400 rounded">
                  Pending
                </span>
              )}
              {expandedSection === 'appservice' ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </button>

          {expandedSection === 'appservice' && (
            <div className="p-3 pt-0 border-t border-gray-700 space-y-3">
              {!hasDeployment ? (
                <div className="text-center py-6">
                  <Server className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No deployment yet</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Deploy your app to see health metrics
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* App Info */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-gray-900/50 rounded p-2">
                      <span className="text-gray-500 block">App Name</span>
                      <span className="text-white font-medium">{currentDeployment.appName}</span>
                    </div>
                    <div className="bg-gray-900/50 rounded p-2">
                      <span className="text-gray-500 block">Service Type</span>
                      <span className="text-white font-medium">{currentDeployment.serviceType}</span>
                    </div>
                    <div className="col-span-2 bg-gray-900/50 rounded p-2">
                      <span className="text-gray-500 block">Resource Group</span>
                      <span className="text-white font-medium">{currentDeployment.resourceGroupName}</span>
                    </div>
                  </div>

                  {/* Health Status */}
                  {appServiceHealth && (
                    <div>
                      <p className="text-[10px] text-gray-500 mb-2">Health Status</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-gray-900/50 rounded p-2 text-center">
                          <div className={cn(
                            "w-2 h-2 rounded-full mx-auto mb-1",
                            appServiceHealth.state === 'Running' ? "bg-green-400" : "bg-yellow-400"
                          )} />
                          <p className="text-[10px] text-white font-medium">{appServiceHealth.state}</p>
                          <p className="text-[8px] text-gray-500">State</p>
                        </div>
                        <div className="bg-gray-900/50 rounded p-2 text-center">
                          <div className={cn(
                            "w-2 h-2 rounded-full mx-auto mb-1",
                            appServiceHealth.availabilityState === 'Normal' ? "bg-green-400" : "bg-yellow-400"
                          )} />
                          <p className="text-[10px] text-white font-medium">{appServiceHealth.availabilityState}</p>
                          <p className="text-[8px] text-gray-500">Availability</p>
                        </div>
                        <div className="bg-gray-900/50 rounded p-2 text-center">
                          <div className={cn(
                            "w-2 h-2 rounded-full mx-auto mb-1",
                            appServiceHealth.enabled ? "bg-green-400" : "bg-red-400"
                          )} />
                          <p className="text-[10px] text-white font-medium">{appServiceHealth.enabled ? 'Yes' : 'No'}</p>
                          <p className="text-[8px] text-gray-500">Enabled</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* URL */}
                  {currentDeployment.url && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(currentDeployment.url, '_blank')}
                        className="h-7 text-xs flex-1"
                      >
                        <Globe className="w-3 h-3 mr-1.5" />
                        Open App
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(`https://portal.azure.com`, '_blank')}
                        className="h-7 text-xs"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Logs Section */}
        {provisionLogs.length > 0 && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === 'logs' ? null : 'logs')}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Terminal className="w-4 h-4 text-gray-400" />
                <div className="text-left">
                  <p className="text-sm font-medium text-white">Provisioning Logs</p>
                  <p className="text-xs text-gray-500">{provisionLogs.length} entries</p>
                </div>
              </div>
              {expandedSection === 'logs' ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {expandedSection === 'logs' && (
              <div className="border-t border-gray-700">
                <div className="p-2 max-h-48 overflow-y-auto font-mono text-[11px] bg-gray-900/50">
                  {provisionLogs.map((log, i) => (
                    <div key={i} className={cn(
                      "py-0.5",
                      log.includes('Error') ? 'text-red-400' :
                      log.includes('complete') || log.includes('success') || log.includes('Created') ? 'text-green-400' :
                      'text-gray-400'
                    )}>
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* No Infrastructure Message */}
        {!database && !hasDeployment && !needsDatabase && provisionLogs.length === 0 && (
          <div className="text-center py-8">
            <Server className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No infrastructure configured</p>
            <p className="text-xs text-gray-500 mt-1">
              Add Prisma to your project or deploy to see infrastructure
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
