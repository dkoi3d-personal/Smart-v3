/**
 * Azure Monitoring Service
 * Handles Application Insights provisioning, metrics retrieval, and monitoring dashboards.
 */

import { ClientSecretCredential } from '@azure/identity';
import { MonitorClient } from '@azure/arm-monitor';
import { OperationalInsightsManagementClient } from '@azure/arm-operationalinsights';
import { ResourceManagementClient } from '@azure/arm-resources';
import { loadAzureCredentials, AzureCredentials, ensureResourceGroup } from './azure-infrastructure';

export interface ApplicationInsightsConfig {
  id: string;
  name: string;
  instrumentationKey: string;
  connectionString: string;
  resourceGroupName: string;
  location: string;
}

export interface LogAnalyticsConfig {
  id: string;
  workspaceId: string;
  name: string;
}

export interface MonitoringMetrics {
  requests: {
    total: number;
    failed: number;
    avgDuration: number;
  };
  availability: number;
  exceptions: number;
  performanceCounters: {
    cpuPercentage: number;
    memoryAvailable: number;
  };
  timestamps: string[];
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  checks: {
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message?: string;
  }[];
  lastChecked: Date;
}

export class AzureMonitoringService {
  private credentials: AzureCredentials | null = null;
  private monitorClient: MonitorClient | null = null;
  private logAnalyticsClient: OperationalInsightsManagementClient | null = null;
  private resourceClient: ResourceManagementClient | null = null;

  /**
   * Initialize the service with Azure credentials
   */
  async initialize(): Promise<boolean> {
    this.credentials = await loadAzureCredentials();
    if (!this.credentials) {
      return false;
    }

    const credential = new ClientSecretCredential(
      this.credentials.tenantId,
      this.credentials.clientId,
      this.credentials.clientSecret
    );

    this.monitorClient = new MonitorClient(credential, this.credentials.subscriptionId);
    this.logAnalyticsClient = new OperationalInsightsManagementClient(credential, this.credentials.subscriptionId);
    this.resourceClient = new ResourceManagementClient(credential, this.credentials.subscriptionId);

    return true;
  }

  /**
   * Create a Log Analytics Workspace
   */
  async createLogAnalyticsWorkspace(
    resourceGroupName: string,
    workspaceName: string,
    location: string
  ): Promise<LogAnalyticsConfig> {
    if (!await this.initialize()) {
      throw new Error('Failed to initialize Azure credentials');
    }

    // Ensure resource group exists
    await ensureResourceGroup(this.credentials!, resourceGroupName, location);

    console.log(`Creating Log Analytics Workspace: ${workspaceName}`);

    const workspace = await this.logAnalyticsClient!.workspaces.beginCreateOrUpdateAndWait(
      resourceGroupName,
      workspaceName,
      {
        location,
        sku: {
          name: 'PerGB2018',
        },
        retentionInDays: 30,
        tags: {
          createdBy: 'ai-dev-platform',
          managedBy: 'monitoring-service',
        },
      }
    );

    return {
      id: workspace.id!,
      workspaceId: workspace.customerId!,
      name: workspace.name!,
    };
  }

  /**
   * Create Application Insights resource
   */
  async createApplicationInsights(
    resourceGroupName: string,
    appInsightsName: string,
    location: string,
    logAnalyticsWorkspaceId?: string
  ): Promise<ApplicationInsightsConfig> {
    if (!await this.initialize()) {
      throw new Error('Failed to initialize Azure credentials');
    }

    // Ensure resource group exists
    await ensureResourceGroup(this.credentials!, resourceGroupName, location);

    console.log(`Creating Application Insights: ${appInsightsName}`);

    // Application Insights is created via generic resource
    const appInsights = await this.resourceClient!.resources.beginCreateOrUpdateAndWait(
      resourceGroupName,
      'Microsoft.Insights',
      '',
      'components',
      appInsightsName,
      '2020-02-02',
      {
        location,
        kind: 'web',
        properties: {
          Application_Type: 'web',
          Flow_Type: 'Bluefield',
          Request_Source: 'rest',
          WorkspaceResourceId: logAnalyticsWorkspaceId,
        },
        tags: {
          createdBy: 'ai-dev-platform',
          managedBy: 'monitoring-service',
        },
      }
    );

    // Get the instrumentation key
    const component = await this.resourceClient!.resources.get(
      resourceGroupName,
      'Microsoft.Insights',
      '',
      'components',
      appInsightsName,
      '2020-02-02'
    );

    const properties = component.properties as any;

    return {
      id: component.id!,
      name: appInsightsName,
      instrumentationKey: properties?.InstrumentationKey || '',
      connectionString: properties?.ConnectionString || '',
      resourceGroupName,
      location,
    };
  }

  /**
   * Configure monitoring for an App Service
   */
  async configureAppServiceMonitoring(
    resourceGroupName: string,
    appName: string,
    appInsightsConfig: ApplicationInsightsConfig
  ): Promise<void> {
    if (!await this.initialize()) {
      throw new Error('Failed to initialize Azure credentials');
    }

    console.log(`Configuring monitoring for App Service: ${appName}`);

    // Update App Service with Application Insights settings
    // This would typically be done through the App Service management client
    // For now, we log the configuration needed

    console.log(`App Insights configuration for ${appName}:`);
    console.log(`  APPINSIGHTS_INSTRUMENTATIONKEY: ${appInsightsConfig.instrumentationKey}`);
    console.log(`  APPLICATIONINSIGHTS_CONNECTION_STRING: ${appInsightsConfig.connectionString}`);
  }

  /**
   * Get metrics from Application Insights
   */
  async getMetrics(
    resourceGroupName: string,
    appInsightsName: string,
    timeRange: '1h' | '6h' | '24h' | '7d' = '24h'
  ): Promise<MonitoringMetrics> {
    if (!await this.initialize()) {
      throw new Error('Failed to initialize Azure credentials');
    }

    const now = new Date();
    const timeSpan = this.getTimeSpan(timeRange);
    const startTime = new Date(now.getTime() - timeSpan);

    const resourceUri = `/subscriptions/${this.credentials!.subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Insights/components/${appInsightsName}`;

    try {
      // Query metrics using the monitor client
      const metricsResponse = await this.monitorClient!.metrics.list(
        resourceUri,
        {
          timespan: `${startTime.toISOString()}/${now.toISOString()}`,
          interval: this.getInterval(timeRange),
          metricnames: 'requests/count,requests/failed,requests/duration,exceptions/count,performanceCounters/processCpuPercentage,performanceCounters/memoryAvailableBytes',
          aggregation: 'Average,Count,Total',
        }
      );

      // Process the metrics
      const metrics: MonitoringMetrics = {
        requests: {
          total: 0,
          failed: 0,
          avgDuration: 0,
        },
        availability: 100,
        exceptions: 0,
        performanceCounters: {
          cpuPercentage: 0,
          memoryAvailable: 0,
        },
        timestamps: [],
      };

      for (const metric of metricsResponse.value || []) {
        const timeseries = metric.timeseries?.[0]?.data || [];

        switch (metric.name?.value) {
          case 'requests/count':
            metrics.requests.total = this.sumMetricData(timeseries, 'total');
            break;
          case 'requests/failed':
            metrics.requests.failed = this.sumMetricData(timeseries, 'total');
            break;
          case 'requests/duration':
            metrics.requests.avgDuration = this.avgMetricData(timeseries, 'average');
            break;
          case 'exceptions/count':
            metrics.exceptions = this.sumMetricData(timeseries, 'total');
            break;
          case 'performanceCounters/processCpuPercentage':
            metrics.performanceCounters.cpuPercentage = this.avgMetricData(timeseries, 'average');
            break;
          case 'performanceCounters/memoryAvailableBytes':
            metrics.performanceCounters.memoryAvailable = this.avgMetricData(timeseries, 'average') / (1024 * 1024 * 1024); // Convert to GB
            break;
        }

        // Collect timestamps
        if (timeseries.length > 0 && metrics.timestamps.length === 0) {
          metrics.timestamps = timeseries.map(d => d.timeStamp?.toISOString() || '');
        }
      }

      // Calculate availability
      if (metrics.requests.total > 0) {
        metrics.availability = ((metrics.requests.total - metrics.requests.failed) / metrics.requests.total) * 100;
      }

      return metrics;
    } catch (error) {
      console.error('Error fetching metrics:', error);
      // Return empty metrics on error
      return {
        requests: { total: 0, failed: 0, avgDuration: 0 },
        availability: 0,
        exceptions: 0,
        performanceCounters: { cpuPercentage: 0, memoryAvailable: 0 },
        timestamps: [],
      };
    }
  }

  /**
   * Get health status for a deployed application
   */
  async getHealthStatus(
    resourceGroupName: string,
    appInsightsName: string
  ): Promise<HealthStatus> {
    try {
      const metrics = await this.getMetrics(resourceGroupName, appInsightsName, '1h');

      const checks: HealthStatus['checks'] = [];

      // Check availability
      if (metrics.availability >= 99) {
        checks.push({ name: 'Availability', status: 'pass', message: `${metrics.availability.toFixed(2)}% availability` });
      } else if (metrics.availability >= 95) {
        checks.push({ name: 'Availability', status: 'warn', message: `${metrics.availability.toFixed(2)}% availability (below 99%)` });
      } else {
        checks.push({ name: 'Availability', status: 'fail', message: `${metrics.availability.toFixed(2)}% availability (critical)` });
      }

      // Check response time
      if (metrics.requests.avgDuration < 500) {
        checks.push({ name: 'Response Time', status: 'pass', message: `${metrics.requests.avgDuration.toFixed(0)}ms average` });
      } else if (metrics.requests.avgDuration < 2000) {
        checks.push({ name: 'Response Time', status: 'warn', message: `${metrics.requests.avgDuration.toFixed(0)}ms average (slow)` });
      } else {
        checks.push({ name: 'Response Time', status: 'fail', message: `${metrics.requests.avgDuration.toFixed(0)}ms average (very slow)` });
      }

      // Check exceptions
      const exceptionRate = metrics.requests.total > 0 ? (metrics.exceptions / metrics.requests.total) * 100 : 0;
      if (exceptionRate < 1) {
        checks.push({ name: 'Exceptions', status: 'pass', message: `${metrics.exceptions} exceptions` });
      } else if (exceptionRate < 5) {
        checks.push({ name: 'Exceptions', status: 'warn', message: `${exceptionRate.toFixed(1)}% exception rate` });
      } else {
        checks.push({ name: 'Exceptions', status: 'fail', message: `${exceptionRate.toFixed(1)}% exception rate (high)` });
      }

      // Check CPU
      if (metrics.performanceCounters.cpuPercentage < 70) {
        checks.push({ name: 'CPU Usage', status: 'pass', message: `${metrics.performanceCounters.cpuPercentage.toFixed(1)}%` });
      } else if (metrics.performanceCounters.cpuPercentage < 90) {
        checks.push({ name: 'CPU Usage', status: 'warn', message: `${metrics.performanceCounters.cpuPercentage.toFixed(1)}% (high)` });
      } else {
        checks.push({ name: 'CPU Usage', status: 'fail', message: `${metrics.performanceCounters.cpuPercentage.toFixed(1)}% (critical)` });
      }

      // Determine overall status
      const failCount = checks.filter(c => c.status === 'fail').length;
      const warnCount = checks.filter(c => c.status === 'warn').length;

      let status: HealthStatus['status'] = 'healthy';
      if (failCount > 0) {
        status = 'unhealthy';
      } else if (warnCount > 0) {
        status = 'degraded';
      }

      return {
        status,
        checks,
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        status: 'unknown',
        checks: [{ name: 'Connection', status: 'fail', message: 'Unable to fetch health status' }],
        lastChecked: new Date(),
      };
    }
  }

  /**
   * Get the Azure Portal dashboard URL for Application Insights
   */
  getDashboardUrl(resourceGroupName: string, appInsightsName: string): string {
    return `https://portal.azure.com/#@${this.credentials?.tenantId}/resource/subscriptions/${this.credentials?.subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Insights/components/${appInsightsName}/overview`;
  }

  /**
   * Delete monitoring resources
   */
  async deleteMonitoringResources(
    resourceGroupName: string,
    appInsightsName: string,
    workspaceName?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!await this.initialize()) {
      return { success: false, error: 'Failed to initialize Azure credentials' };
    }

    try {
      // Delete Application Insights
      await this.resourceClient!.resources.beginDeleteAndWait(
        resourceGroupName,
        'Microsoft.Insights',
        '',
        'components',
        appInsightsName,
        '2020-02-02'
      );

      // Delete Log Analytics Workspace if specified
      if (workspaceName) {
        await this.logAnalyticsClient!.workspaces.beginDeleteAndWait(
          resourceGroupName,
          workspaceName
        );
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Helper: Get time span in milliseconds
   */
  private getTimeSpan(timeRange: '1h' | '6h' | '24h' | '7d'): number {
    const spans: Record<string, number> = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
    };
    return spans[timeRange] || spans['24h'];
  }

  /**
   * Helper: Get metric interval based on time range
   */
  private getInterval(timeRange: '1h' | '6h' | '24h' | '7d'): string {
    const intervals: Record<string, string> = {
      '1h': 'PT5M',
      '6h': 'PT15M',
      '24h': 'PT1H',
      '7d': 'PT6H',
    };
    return intervals[timeRange] || intervals['24h'];
  }

  /**
   * Helper: Sum metric data
   */
  private sumMetricData(data: any[], field: string): number {
    return data.reduce((sum, d) => sum + (d[field] || 0), 0);
  }

  /**
   * Helper: Average metric data
   */
  private avgMetricData(data: any[], field: string): number {
    const values = data.filter(d => d[field] !== undefined && d[field] !== null);
    if (values.length === 0) return 0;
    return values.reduce((sum, d) => sum + d[field], 0) / values.length;
  }
}

// Singleton instance
export const azureMonitoringService = new AzureMonitoringService();
export default azureMonitoringService;
