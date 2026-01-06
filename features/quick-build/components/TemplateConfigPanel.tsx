'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Plus,
  X,
  Check,
  Clock,
  Rocket,
  Sparkles,
  Database,
  Palette,
  Loader2,
} from 'lucide-react';
import type { QuickBuildTemplate, TemplateFeature } from '../data/templates';
import {
  getApiById,
  resolveAllDependencies,
  type EpicApiDefinition,
} from '../data/epic-api-catalog';
import { EpicApiPicker } from './EpicApiPicker';
import type { QuickBuildConfig, DatabaseConfig } from '../types';

const COLOR_MAP: Record<string, { bg: string; light: string; text: string }> = {
  blue: { bg: 'bg-blue-500', light: 'bg-blue-500/10', text: 'text-blue-400' },
  purple: { bg: 'bg-purple-500', light: 'bg-purple-500/10', text: 'text-purple-400' },
  green: { bg: 'bg-green-500', light: 'bg-green-500/10', text: 'text-green-400' },
  red: { bg: 'bg-red-500', light: 'bg-red-500/10', text: 'text-red-400' },
  teal: { bg: 'bg-teal-500', light: 'bg-teal-500/10', text: 'text-teal-400' },
  cyan: { bg: 'bg-cyan-500', light: 'bg-cyan-500/10', text: 'text-cyan-400' },
  indigo: { bg: 'bg-indigo-500', light: 'bg-indigo-500/10', text: 'text-indigo-400' },
  pink: { bg: 'bg-pink-500', light: 'bg-pink-500/10', text: 'text-pink-400' },
  amber: { bg: 'bg-amber-500', light: 'bg-amber-500/10', text: 'text-amber-400' },
  emerald: { bg: 'bg-emerald-500', light: 'bg-emerald-500/10', text: 'text-emerald-400' },
  slate: { bg: 'bg-slate-500', light: 'bg-slate-500/10', text: 'text-slate-400' },
  orange: { bg: 'bg-orange-500', light: 'bg-orange-500/10', text: 'text-orange-400' },
};

interface TemplateConfigPanelProps {
  template: QuickBuildTemplate;
  onBack: () => void;
  onBuild: (config: QuickBuildConfig) => void;
  isCreating?: boolean;
}

export function TemplateConfigPanel({
  template,
  onBack,
  onBuild,
  isCreating = false,
}: TemplateConfigPanelProps) {
  const [appName, setAppName] = useState(template.name);
  const [enabledFeatures, setEnabledFeatures] = useState<Set<string>>(
    new Set(template.features.filter(f => f.default).map(f => f.id))
  );
  const [additionalApis, setAdditionalApis] = useState<Set<string>>(new Set());
  const [showApiPicker, setShowApiPicker] = useState(false);
  const [includeDatabase, setIncludeDatabase] = useState(false);
  const [databaseProvider, setDatabaseProvider] = useState<DatabaseConfig['provider']>('sqlite');

  const colors = COLOR_MAP[template.color] || COLOR_MAP.blue;
  const Icon = template.icon;

  // Calculate all selected APIs (template defaults + feature additions + manual additions)
  const selectedApiIds = useMemo(() => {
    const apis = new Set(template.defaultEpicApis);

    // Add APIs from enabled features
    template.features.forEach(feature => {
      if (enabledFeatures.has(feature.id) && feature.epicApiIds) {
        feature.epicApiIds.forEach(id => apis.add(id));
      }
    });

    // Add manually added APIs
    additionalApis.forEach(id => apis.add(id));

    // Resolve all dependencies
    const allIds = resolveAllDependencies(Array.from(apis));
    return allIds;
  }, [template, enabledFeatures, additionalApis]);

  // Get API definitions for selected APIs
  const selectedApis = useMemo(() => {
    return selectedApiIds
      .map(id => getApiById(id))
      .filter(Boolean) as EpicApiDefinition[];
  }, [selectedApiIds]);

  // Calculate what will be generated
  const generatedStats = useMemo(() => {
    let components = 0;
    let hooks = 0;

    selectedApis.forEach(api => {
      components += api.components.length;
      hooks += api.hooks.length;
    });

    return { components, hooks, apis: selectedApis.length };
  }, [selectedApis]);

  const handleToggleFeature = (feature: TemplateFeature) => {
    setEnabledFeatures(prev => {
      const next = new Set(prev);
      if (next.has(feature.id)) {
        next.delete(feature.id);
      } else {
        next.add(feature.id);
      }
      return next;
    });
  };

  const handleAddApis = (apiIds: string[]) => {
    setAdditionalApis(prev => {
      const next = new Set(prev);
      apiIds.forEach(id => next.add(id));
      return next;
    });
  };

  const handleRemoveApi = (apiId: string) => {
    // Only remove manually added APIs
    if (additionalApis.has(apiId)) {
      setAdditionalApis(prev => {
        const next = new Set(prev);
        next.delete(apiId);
        return next;
      });
    }
  };

  const handleBuild = () => {
    const config: QuickBuildConfig = {
      templateId: template.id,
      appName,
      epicApis: selectedApis.map(api => ({
        apiId: api.id,
        resourceType: api.resourceType,
        displayName: api.displayName,
        isFromTemplate: template.defaultEpicApis.includes(api.id),
        isRequired: api.id === 'patient',
        generateComponents: api.components.map(c => c.name),
        generateHooks: api.hooks.map(h => h.name),
      })),
      enabledFeatures: Array.from(enabledFeatures),
      databaseConfig: includeDatabase
        ? { provider: databaseProvider, schemaTemplate: 'auto' }
        : undefined,
    };

    onBuild(config);
  };

  // Estimate build time based on complexity
  const estimatedTime = useMemo(() => {
    const baseTime = 2;
    const apiTime = (selectedApis.length - 4) * 0.1; // Extra time per additional API
    const dbTime = includeDatabase ? 0.5 : 0;
    return `~${Math.max(1.5, baseTime + apiTime + dbTime).toFixed(1)} min`;
  }, [selectedApis.length, includeDatabase]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className={cn('p-2.5 rounded-lg text-white', colors.bg)}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{template.name}</h1>
            <p className="text-sm text-muted-foreground">Configure your app</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Configuration */}
          <div className="space-y-6">
            {/* App Name */}
            <div>
              <label className="block text-sm font-medium mb-2">App Name</label>
              <input
                type="text"
                value={appName}
                onChange={e => setAppName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="My Epic App"
              />
            </div>

            {/* Features */}
            {template.features.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2">Features</label>
                <div className="space-y-2">
                  {template.features.map(feature => (
                    <label
                      key={feature.id}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                        enabledFeatures.has(feature.id)
                          ? 'border-primary/50 bg-primary/5'
                          : 'border-border hover:border-muted-foreground/30'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={enabledFeatures.has(feature.id)}
                        onChange={() => handleToggleFeature(feature)}
                        className="mt-0.5 w-4 h-4 rounded border-muted-foreground/30"
                      />
                      <div className="flex-1">
                        <span className="font-medium text-sm">{feature.name}</span>
                        <p className="text-xs text-muted-foreground">
                          {feature.description}
                        </p>
                        {feature.epicApiIds && feature.epicApiIds.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {feature.epicApiIds.map(id => (
                              <span
                                key={id}
                                className="text-xs bg-muted px-1.5 py-0.5 rounded"
                              >
                                +{getApiById(id)?.resourceType || id}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Database Option */}
            <div>
              <label className="block text-sm font-medium mb-2">
                <Database className="h-4 w-4 inline mr-1" />
                Database
              </label>
              <label
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                  includeDatabase
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border hover:border-muted-foreground/30'
                )}
              >
                <input
                  type="checkbox"
                  checked={includeDatabase}
                  onChange={e => setIncludeDatabase(e.target.checked)}
                  className="w-4 h-4 rounded border-muted-foreground/30"
                />
                <span className="text-sm">Include database setup</span>
              </label>

              {includeDatabase && (
                <div className="mt-2 pl-7">
                  <select
                    value={databaseProvider}
                    onChange={e => setDatabaseProvider(e.target.value as DatabaseConfig['provider'])}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-background"
                  >
                    <option value="sqlite">SQLite (Local)</option>
                    <option value="neon">Neon (Serverless PostgreSQL)</option>
                    <option value="supabase">Supabase</option>
                    <option value="aws-rds">AWS RDS</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Epic APIs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">
                Epic FHIR APIs ({selectedApis.length})
              </label>
              <button
                onClick={() => setShowApiPicker(true)}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add More
              </button>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {selectedApis.map(api => {
                const apiColors = COLOR_MAP[api.color] || COLOR_MAP.blue;
                const isFromTemplate = template.defaultEpicApis.includes(api.id);
                const isManuallyAdded = additionalApis.has(api.id);
                const isRequired = api.id === 'patient';

                return (
                  <div
                    key={api.id}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border',
                      isFromTemplate
                        ? cn('border-l-4', apiColors.light)
                        : 'border-dashed border-green-500/50 bg-green-500/10'
                    )}
                    style={{
                      borderLeftColor: isFromTemplate ? undefined : undefined,
                    }}
                  >
                    <div className={cn('p-1.5 rounded-md text-white', apiColors.bg)}>
                      <api.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{api.displayName}</span>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {api.resourceType}
                        </code>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {api.components.map(c => c.name).join(', ')}
                      </p>
                      {isManuallyAdded && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 mt-1">
                          <Plus className="h-3 w-3" />
                          Added
                        </span>
                      )}
                    </div>
                    {isManuallyAdded && !isRequired && (
                      <button
                        onClick={() => handleRemoveApi(api.id)}
                        className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    {isRequired && (
                      <span className="text-xs text-muted-foreground">Required</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Stats */}
            <div className="mt-4 p-3 rounded-lg bg-muted/50">
              <div className="text-sm font-medium mb-2">What you'll get:</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {generatedStats.apis}
                  </div>
                  <div className="text-xs text-muted-foreground">APIs</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {generatedStats.components}
                  </div>
                  <div className="text-xs text-muted-foreground">Components</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {generatedStats.hooks}
                  </div>
                  <div className="text-xs text-muted-foreground">Hooks</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {estimatedTime}
          </span>
        </div>
        <button
          onClick={handleBuild}
          disabled={isCreating}
          className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCreating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating Project...
            </>
          ) : (
            <>
              <Rocket className="h-4 w-4" />
              Build App
            </>
          )}
        </button>
      </div>

      {/* API Picker Modal */}
      <EpicApiPicker
        isOpen={showApiPicker}
        onClose={() => setShowApiPicker(false)}
        selectedApiIds={selectedApiIds}
        requiredApiIds={['patient']}
        onAddApis={handleAddApis}
      />
    </div>
  );
}

export default TemplateConfigPanel;
