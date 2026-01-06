'use client';

import React, { useState, useEffect } from 'react';
import {
  Database,
  Shield,
  ShieldCheck,
  ShieldAlert,
  DollarSign,
  Check,
  X,
  Info,
  Server,
  Cloud,
  HardDrive,
  Zap,
  Lock,
  FileCode,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

// Types from database-catalog
type DatabaseEngine = 'postgresql' | 'mysql' | 'sqlserver' | 'cosmosdb' | 'sqlite';
type ComplianceLevel = 'hipaa' | 'standard' | 'development';
type AzureTier = 'burstable' | 'general-purpose' | 'memory-optimized' | 'serverless';

interface DatabasePricing {
  tier: AzureTier;
  estimatedMonthlyCost: string;
  computeSize: string;
  storage: string;
  description: string;
}

interface DatabaseOption {
  id: string;
  name: string;
  engine: DatabaseEngine;
  description: string;
  supportedCompliance: ComplianceLevel[];
  hipaaRecommended: boolean;
  pricing: DatabasePricing[];
  features: string[];
  limitations: string[];
  tags: string[];
  enabled: boolean;
}

interface DatabaseSelection {
  databaseId: string;
  complianceLevel: ComplianceLevel;
  tier: AzureTier;
}

interface DatabaseSelectorProps {
  value?: DatabaseSelection;
  onChange?: (selection: DatabaseSelection) => void;
  showPricing?: boolean;
  showFeatures?: boolean;
  compactMode?: boolean;
  disabled?: boolean;
}

const ENGINE_ICONS: Record<DatabaseEngine, React.ReactNode> = {
  postgresql: <Database className="w-4 h-4 text-blue-500" />,
  mysql: <Database className="w-4 h-4 text-orange-500" />,
  sqlserver: <Server className="w-4 h-4 text-red-500" />,
  cosmosdb: <Cloud className="w-4 h-4 text-purple-500" />,
  sqlite: <HardDrive className="w-4 h-4 text-gray-500" />,
};

const TIER_ICONS: Record<AzureTier, React.ReactNode> = {
  burstable: <Zap className="w-3 h-3" />,
  'general-purpose': <Server className="w-3 h-3" />,
  'memory-optimized': <Database className="w-3 h-3" />,
  serverless: <Cloud className="w-3 h-3" />,
};

export default function DatabaseSelector({
  value,
  onChange,
  showPricing = true,
  showFeatures = true,
  compactMode = false,
  disabled = false,
}: DatabaseSelectorProps) {
  const [databases, setDatabases] = useState<DatabaseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDb, setSelectedDb] = useState<string>(value?.databaseId || '');
  const [complianceLevel, setComplianceLevel] = useState<ComplianceLevel>(
    value?.complianceLevel || 'hipaa'
  );
  const [selectedTier, setSelectedTier] = useState<AzureTier>(
    value?.tier || 'burstable'
  );
  const [showDetails, setShowDetails] = useState(!compactMode);

  // Load database catalog
  useEffect(() => {
    async function loadCatalog() {
      try {
        const response = await fetch('/api/databases/catalog');
        if (response.ok) {
          const data = await response.json();
          setDatabases(data.databases || []);
          if (!selectedDb && data.defaultDatabaseId) {
            setSelectedDb(data.defaultDatabaseId);
          }
        } else {
          // Fallback to hardcoded defaults
          setDatabases(getDefaultDatabases());
          if (!selectedDb) {
            setSelectedDb('azure-postgresql-flexible');
          }
        }
      } catch {
        setDatabases(getDefaultDatabases());
        if (!selectedDb) {
          setSelectedDb('azure-postgresql-flexible');
        }
      } finally {
        setLoading(false);
      }
    }
    loadCatalog();
  }, []);

  // Notify parent of changes
  useEffect(() => {
    if (selectedDb && onChange) {
      onChange({
        databaseId: selectedDb,
        complianceLevel,
        tier: selectedTier,
      });
    }
  }, [selectedDb, complianceLevel, selectedTier, onChange]);

  const selectedDatabase = databases.find((db) => db.id === selectedDb);
  const filteredDatabases = databases.filter(
    (db) => db.enabled && db.supportedCompliance.includes(complianceLevel)
  );

  const isHipaaMode = complianceLevel === 'hipaa';

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-10 bg-zinc-800 rounded-md" />
        <div className="h-24 bg-zinc-800 rounded-md" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Compliance Level Toggle */}
      <div className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg border border-zinc-800">
        <div className="flex items-center gap-3">
          {isHipaaMode ? (
            <ShieldCheck className="w-5 h-5 text-green-500" />
          ) : (
            <Shield className="w-5 h-5 text-zinc-500" />
          )}
          <div>
            <Label className="text-sm font-medium">HIPAA Compliance</Label>
            <p className="text-xs text-zinc-500">
              {isHipaaMode
                ? 'Full encryption, audit logging, and compliance settings'
                : 'Standard security without compliance features'}
            </p>
          </div>
        </div>
        <Switch
          checked={isHipaaMode}
          onCheckedChange={(checked) =>
            setComplianceLevel(checked ? 'hipaa' : 'standard')
          }
          disabled={disabled}
        />
      </div>

      {/* HIPAA Warning for non-compliant selections */}
      {isHipaaMode && selectedDatabase && !selectedDatabase.hipaaRecommended && (
        <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
          <div className="text-xs text-yellow-200">
            <strong>Note:</strong> This database is HIPAA-eligible but not
            recommended for healthcare workloads. Consider{' '}
            <button
              className="underline hover:text-yellow-100"
              onClick={() => setSelectedDb('azure-postgresql-flexible')}
            >
              Azure PostgreSQL
            </button>{' '}
            for best HIPAA support.
          </div>
        </div>
      )}

      {/* Database Selector */}
      <div className="space-y-2">
        <Label className="text-sm text-zinc-400">Database</Label>
        <Select
          value={selectedDb}
          onValueChange={setSelectedDb}
          disabled={disabled}
        >
          <SelectTrigger className="w-full bg-zinc-900 border-zinc-700">
            <SelectValue placeholder="Select a database">
              {selectedDatabase && (
                <div className="flex items-center gap-2">
                  {ENGINE_ICONS[selectedDatabase.engine]}
                  <span>{selectedDatabase.name}</span>
                  {selectedDatabase.hipaaRecommended && isHipaaMode && (
                    <Badge
                      variant="outline"
                      className="ml-1 text-[10px] px-1.5 py-0 border-green-600 text-green-500"
                    >
                      Recommended
                    </Badge>
                  )}
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectGroup>
              <SelectLabel className="text-zinc-500">
                {isHipaaMode ? 'HIPAA-Eligible Databases' : 'Available Databases'}
              </SelectLabel>
              {filteredDatabases.map((db) => (
                <SelectItem
                  key={db.id}
                  value={db.id}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    {ENGINE_ICONS[db.engine]}
                    <span>{db.name}</span>
                    {db.hipaaRecommended && isHipaaMode && (
                      <ShieldCheck className="w-3 h-3 text-green-500 ml-1" />
                    )}
                    {db.engine === 'sqlite' && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        Dev Only
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* Selected Database Details */}
      {selectedDatabase && (
        <div className="border border-zinc-800 rounded-lg overflow-hidden">
          {/* Header */}
          <div
            className="flex items-center justify-between p-3 bg-zinc-900 cursor-pointer hover:bg-zinc-800/50 transition-colors"
            onClick={() => setShowDetails(!showDetails)}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-zinc-800">
                {ENGINE_ICONS[selectedDatabase.engine]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {selectedDatabase.name}
                  </span>
                  {selectedDatabase.hipaaRecommended && isHipaaMode && (
                    <Badge className="bg-green-600 text-white text-[10px] px-1.5 py-0">
                      HIPAA Recommended
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-zinc-500 line-clamp-1">
                  {selectedDatabase.description}
                </p>
              </div>
            </div>
            {showDetails ? (
              <ChevronUp className="w-4 h-4 text-zinc-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-500" />
            )}
          </div>

          {/* Expanded Details */}
          {showDetails && (
            <div className="p-3 space-y-4 border-t border-zinc-800">
              {/* Pricing Tier Selection */}
              {showPricing && selectedDatabase.pricing.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-zinc-400 flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    Pricing Tier
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedDatabase.pricing.map((pricing) => (
                      <button
                        key={pricing.tier}
                        onClick={() => setSelectedTier(pricing.tier)}
                        disabled={disabled}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          selectedTier === pricing.tier
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            {TIER_ICONS[pricing.tier]}
                            <span className="text-xs font-medium capitalize">
                              {pricing.tier.replace('-', ' ')}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-green-500">
                            {pricing.estimatedMonthlyCost}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-500">
                          {pricing.computeSize}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Features */}
              {showFeatures && selectedDatabase.features.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-zinc-400 flex items-center gap-1">
                    <Check className="w-3 h-3 text-green-500" />
                    Features
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {selectedDatabase.features.slice(0, 6).map((feature, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-1.5 text-[11px] text-zinc-400"
                      >
                        <Check className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Limitations */}
              {showFeatures && selectedDatabase.limitations.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-zinc-400 flex items-center gap-1">
                    <Info className="w-3 h-3 text-yellow-500" />
                    Limitations
                  </Label>
                  <div className="space-y-1">
                    {selectedDatabase.limitations.map((limitation, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-1.5 text-[11px] text-zinc-500"
                      >
                        <X className="w-3 h-3 text-zinc-600 mt-0.5 shrink-0" />
                        <span>{limitation}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* HIPAA Settings Preview */}
              {isHipaaMode && (
                <div className="p-2 bg-green-500/5 border border-green-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="w-3 h-3 text-green-500" />
                    <span className="text-xs font-medium text-green-400">
                      HIPAA Configuration
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-zinc-400">
                    <div className="flex items-center gap-1">
                      <Check className="w-2.5 h-2.5 text-green-500" />
                      SSL/TLS Required
                    </div>
                    <div className="flex items-center gap-1">
                      <Check className="w-2.5 h-2.5 text-green-500" />
                      Encryption at Rest
                    </div>
                    <div className="flex items-center gap-1">
                      <Check className="w-2.5 h-2.5 text-green-500" />
                      Audit Logging (90 days)
                    </div>
                    <div className="flex items-center gap-1">
                      <Check className="w-2.5 h-2.5 text-green-500" />
                      Geo-Redundant Backup
                    </div>
                    {selectedDatabase.engine === 'postgresql' && (
                      <div className="flex items-center gap-1">
                        <Check className="w-2.5 h-2.5 text-green-500" />
                        pgAudit Extension
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Check className="w-2.5 h-2.5 text-green-500" />
                      Azure AD Auth
                    </div>
                  </div>
                </div>
              )}

              {/* Tags */}
              <div className="flex flex-wrap gap-1">
                {selectedDatabase.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 text-zinc-500 border-zinc-700"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Development Mode Warning */}
      {complianceLevel === 'development' && (
        <div className="flex items-start gap-2 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
          <ShieldAlert className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
          <div className="text-xs text-orange-200">
            <strong>Development Mode:</strong> This configuration is for local
            development only. Do not use with real patient data. Switch to HIPAA
            mode before production deployment.
          </div>
        </div>
      )}
    </div>
  );
}

// Fallback database options if API fails
function getDefaultDatabases(): DatabaseOption[] {
  return [
    {
      id: 'azure-postgresql-flexible',
      name: 'Azure PostgreSQL Flexible Server',
      engine: 'postgresql',
      description:
        'Fully managed PostgreSQL. Best for HIPAA-compliant healthcare apps.',
      supportedCompliance: ['hipaa', 'standard', 'development'],
      hipaaRecommended: true,
      pricing: [
        {
          tier: 'burstable',
          estimatedMonthlyCost: '$15-50',
          computeSize: 'B1ms (1 vCore)',
          storage: '32GB',
          description: 'Dev/test workloads',
        },
        {
          tier: 'general-purpose',
          estimatedMonthlyCost: '$100-300',
          computeSize: 'D2s_v3 (2 vCores)',
          storage: '64GB',
          description: 'Production workloads',
        },
      ],
      features: [
        'HIPAA eligible with BAA',
        'Automatic backups',
        'pgAudit for compliance',
        'Azure AD authentication',
      ],
      limitations: ['No true serverless option'],
      tags: ['postgresql', 'hipaa', 'recommended'],
      enabled: true,
    },
    {
      id: 'azure-sql-database',
      name: 'Azure SQL Database',
      engine: 'sqlserver',
      description: 'Managed SQL Server with serverless option.',
      supportedCompliance: ['hipaa', 'standard', 'development'],
      hipaaRecommended: true,
      pricing: [
        {
          tier: 'serverless',
          estimatedMonthlyCost: '$5-50',
          computeSize: 'Auto-scale',
          storage: '32GB',
          description: 'Pay per second',
        },
        {
          tier: 'burstable',
          estimatedMonthlyCost: '$15-30',
          computeSize: 'Basic (5 DTU)',
          storage: '2GB',
          description: 'Small workloads',
        },
      ],
      features: [
        'HIPAA eligible with BAA',
        'Serverless auto-pause',
        'Built-in threat detection',
      ],
      limitations: ['Higher cost than PostgreSQL'],
      tags: ['sqlserver', 'hipaa', 'serverless'],
      enabled: true,
    },
    {
      id: 'sqlite-local',
      name: 'SQLite (Development Only)',
      engine: 'sqlite',
      description: 'File-based database for local development only.',
      supportedCompliance: ['development'],
      hipaaRecommended: false,
      pricing: [
        {
          tier: 'burstable',
          estimatedMonthlyCost: '$0',
          computeSize: 'N/A',
          storage: 'Local disk',
          description: 'Free',
        },
      ],
      features: ['Zero configuration', 'No server needed', 'Fast prototyping'],
      limitations: [
        'NOT HIPAA compliant',
        'Cannot deploy to production',
        'No network access',
      ],
      tags: ['sqlite', 'development', 'local'],
      enabled: true,
    },
  ];
}

export type { DatabaseSelection, ComplianceLevel, AzureTier };
