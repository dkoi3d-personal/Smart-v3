'use client';

/**
 * Code-to-Compliance Dashboard Component
 *
 * Real-time healthcare compliance monitoring panel showing:
 * - Compliance score with gauge
 * - Violation breakdown by severity
 * - Regulatory coverage
 * - Detailed violation list with code snippets
 * - Remediation recommendations
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  AlertCircle,
  Info,
  FileCode,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Download,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface ComplianceViolation {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  rule: string;
  ruleId: string;
  category: string;
  file: string;
  line: number;
  column: number;
  message: string;
  codeSnippet: string;
  regulations: string[];
  recommendation: string;
  autoFixAvailable: boolean;
}

interface ComplianceRecommendation {
  priority: number;
  title: string;
  description: string;
  effort: 'low' | 'medium' | 'high';
  affectedFiles: number;
  steps: string[];
}

interface RegulatoryCoverage {
  regulation: string;
  coveragePercentage: number;
  status: 'compliant' | 'partial' | 'non-compliant';
  details: {
    section: string;
    status: string;
    issues: number;
  }[];
}

interface ComplianceScanResult {
  success: boolean;
  scanId: string;
  timestamp: string;
  duration: number;
  complianceScore: number;
  summary: {
    totalFiles: number;
    totalViolations: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  violations: ComplianceViolation[];
  recommendations: ComplianceRecommendation[];
  regulatoryCoverage: RegulatoryCoverage[];
}

interface ComplianceDashboardProps {
  projectId?: string;
  projectPath?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  onScanComplete?: (result: ComplianceScanResult) => void;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const SeverityBadge: React.FC<{ severity: ComplianceViolation['severity'] }> = ({ severity }) => {
  const config = {
    critical: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50' },
    high: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/50' },
    medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/50' },
    low: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/50' },
    info: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/50' },
  };

  const { bg, text, border } = config[severity];

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded border ${bg} ${text} ${border}`}>
      {severity.toUpperCase()}
    </span>
  );
};

const ComplianceGauge: React.FC<{ score: number }> = ({ score }) => {
  const getColor = (s: number) => {
    if (s >= 90) return '#22c55e'; // green
    if (s >= 70) return '#eab308'; // yellow
    if (s >= 50) return '#f97316'; // orange
    return '#ef4444'; // red
  };

  const color = getColor(score);
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-32 h-32">
      <svg className="w-full h-full transform -rotate-90">
        {/* Background circle */}
        <circle
          cx="64"
          cy="64"
          r="45"
          fill="none"
          stroke="#374151"
          strokeWidth="8"
        />
        {/* Progress circle */}
        <circle
          cx="64"
          cy="64"
          r="45"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" style={{ color }}>{score}</span>
        <span className="text-xs text-gray-400">Compliance</span>
      </div>
    </div>
  );
};

const ViolationCard: React.FC<{
  violation: ComplianceViolation;
  expanded: boolean;
  onToggle: () => void;
}> = ({ violation, expanded, onToggle }) => {
  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden bg-gray-800/50">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
          <SeverityBadge severity={violation.severity} />
          <span className="text-sm font-medium text-gray-200">{violation.rule}</span>
        </div>
        <div className="flex items-center gap-2">
          {violation.autoFixAvailable && (
            <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">
              Auto-fix
            </span>
          )}
          <span className="text-xs text-gray-500">{violation.file.split('/').pop()}:{violation.line}</span>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 py-3 border-t border-gray-700 space-y-3">
          {/* File location */}
          <div className="flex items-center gap-2 text-sm">
            <FileCode className="w-4 h-4 text-gray-400" />
            <span className="text-gray-400">{violation.file}</span>
            <span className="text-gray-500">Line {violation.line}</span>
          </div>

          {/* Message */}
          <p className="text-sm text-gray-300">{violation.message}</p>

          {/* Code snippet */}
          <pre className="p-3 bg-gray-900 rounded text-xs overflow-x-auto font-mono">
            <code className="text-gray-300">{violation.codeSnippet}</code>
          </pre>

          {/* Regulations */}
          <div className="flex flex-wrap gap-2">
            {violation.regulations.map((reg, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded"
              >
                {reg}
              </span>
            ))}
          </div>

          {/* Recommendation */}
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 mt-0.5" />
              <p className="text-sm text-blue-300">{violation.recommendation}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const RegulationCoverageBar: React.FC<{ coverage: RegulatoryCoverage }> = ({ coverage }) => {
  const statusConfig = {
    compliant: { color: 'bg-green-500', icon: CheckCircle2 },
    partial: { color: 'bg-yellow-500', icon: AlertCircle },
    'non-compliant': { color: 'bg-red-500', icon: XCircle },
  };

  const { color, icon: StatusIcon } = statusConfig[coverage.status];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon className={`w-4 h-4 ${color.replace('bg-', 'text-')}`} />
          <span className="text-sm font-medium text-gray-200">{coverage.regulation}</span>
        </div>
        <span className="text-sm text-gray-400">{coverage.coveragePercentage}%</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${coverage.coveragePercentage}%` }}
        />
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ComplianceDashboard: React.FC<ComplianceDashboardProps> = ({
  projectId,
  projectPath,
  autoRefresh = false,
  refreshInterval = 60000,
  onScanComplete,
}) => {
  const [scanResult, setScanResult] = useState<ComplianceScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedViolations, setExpandedViolations] = useState<Set<string>>(new Set());
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'violations' | 'recommendations' | 'coverage'>('violations');

  // Run compliance scan
  const runScan = useCallback(async () => {
    if (!projectPath && !projectId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/compliance/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath,
          projectId,
          outputFormat: 'full',
          includeAnnotations: true,
          includeRecommendations: true,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Scan failed');
      }

      setScanResult(result);
      onScanComplete?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setLoading(false);
    }
  }, [projectPath, projectId, onScanComplete]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(runScan, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, runScan]);

  // Initial scan
  useEffect(() => {
    runScan();
  }, [runScan]);

  // Toggle violation expansion
  const toggleViolation = (id: string) => {
    setExpandedViolations(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Filter violations
  const filteredViolations = scanResult?.violations.filter(v => {
    if (severityFilter !== 'all' && v.severity !== severityFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        v.rule.toLowerCase().includes(query) ||
        v.file.toLowerCase().includes(query) ||
        v.message.toLowerCase().includes(query)
      );
    }
    return true;
  }) || [];

  // Export report
  const exportReport = () => {
    if (!scanResult) return;

    const blob = new Blob([JSON.stringify(scanResult, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-report-${scanResult.scanId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-purple-400" />
          <h2 className="font-semibold">Code-to-Compliance</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportReport}
            disabled={!scanResult}
            className="p-2 hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
            title="Export Report"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={runScan}
            disabled={loading}
            className="p-2 hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
            title="Refresh Scan"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && !scanResult && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-2" />
            <p className="text-gray-400">Scanning for compliance violations...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="m-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-red-300">{error}</span>
          </div>
        </div>
      )}

      {/* Main content */}
      {scanResult && (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Summary section */}
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center gap-6">
              {/* Compliance gauge */}
              <ComplianceGauge score={scanResult.complianceScore} />

              {/* Summary stats */}
              <div className="flex-1 grid grid-cols-4 gap-4">
                <div className="text-center p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                  <div className="text-2xl font-bold text-red-400">{scanResult.summary.critical}</div>
                  <div className="text-xs text-gray-400">Critical</div>
                </div>
                <div className="text-center p-3 bg-orange-500/10 rounded-lg border border-orange-500/30">
                  <div className="text-2xl font-bold text-orange-400">{scanResult.summary.high}</div>
                  <div className="text-xs text-gray-400">High</div>
                </div>
                <div className="text-center p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                  <div className="text-2xl font-bold text-yellow-400">{scanResult.summary.medium}</div>
                  <div className="text-xs text-gray-400">Medium</div>
                </div>
                <div className="text-center p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <div className="text-2xl font-bold text-blue-400">{scanResult.summary.low}</div>
                  <div className="text-xs text-gray-400">Low</div>
                </div>
              </div>
            </div>

            {/* Scan info */}
            <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(scanResult.timestamp).toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                {scanResult.duration}ms
              </span>
              <span className="flex items-center gap-1">
                <FileCode className="w-3 h-3" />
                {scanResult.summary.totalFiles} files scanned
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-4 pt-2 border-b border-gray-700">
            <div className="flex gap-4">
              {(['violations', 'recommendations', 'coverage'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-purple-400 text-purple-400'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {tab === 'violations' && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-700 rounded">
                      {scanResult.violations.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Violations tab */}
            {activeTab === 'violations' && (
              <div className="space-y-4">
                {/* Filters */}
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search violations..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <select
                    value={severityFilter}
                    onChange={e => setSeverityFilter(e.target.value)}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                  >
                    <option value="all">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                {/* Violation list */}
                <div className="space-y-2">
                  {filteredViolations.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      {scanResult.violations.length === 0 ? (
                        <div className="flex flex-col items-center gap-2">
                          <ShieldCheck className="w-12 h-12 text-green-400" />
                          <p>No compliance violations found!</p>
                        </div>
                      ) : (
                        <p>No violations match your filter</p>
                      )}
                    </div>
                  ) : (
                    filteredViolations.map(violation => (
                      <ViolationCard
                        key={violation.id}
                        violation={violation}
                        expanded={expandedViolations.has(violation.id)}
                        onToggle={() => toggleViolation(violation.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Recommendations tab */}
            {activeTab === 'recommendations' && (
              <div className="space-y-4">
                {scanResult.recommendations?.map((rec, i) => (
                  <div
                    key={i}
                    className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 flex items-center justify-center bg-purple-500/20 text-purple-400 rounded-full text-sm font-medium">
                          {rec.priority}
                        </span>
                        <h3 className="font-medium text-gray-200">{rec.title}</h3>
                      </div>
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        rec.effort === 'low' ? 'bg-green-500/20 text-green-400' :
                        rec.effort === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {rec.effort} effort
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">{rec.description}</p>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-500 uppercase">Steps:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        {rec.steps.map((step, j) => (
                          <li key={j} className="text-sm text-gray-300">{step}</li>
                        ))}
                      </ol>
                    </div>
                    <p className="text-xs text-gray-500">
                      Affects {rec.affectedFiles} file{rec.affectedFiles !== 1 ? 's' : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Coverage tab */}
            {activeTab === 'coverage' && (
              <div className="space-y-6">
                {scanResult.regulatoryCoverage?.map((coverage, i) => (
                  <div key={i} className="space-y-4">
                    <RegulationCoverageBar coverage={coverage} />

                    {/* Section details */}
                    <div className="pl-6 space-y-2">
                      {coverage.details.map((detail, j) => (
                        <div
                          key={j}
                          className="flex items-center justify-between py-2 border-b border-gray-800"
                        >
                          <span className="text-sm text-gray-300">{detail.section}</span>
                          <div className="flex items-center gap-2">
                            {detail.issues > 0 && (
                              <span className="text-xs text-red-400">
                                {detail.issues} issue{detail.issues !== 1 ? 's' : ''}
                              </span>
                            )}
                            <span className={`px-2 py-0.5 text-xs rounded ${
                              detail.status === 'met' ? 'bg-green-500/20 text-green-400' :
                              detail.status === 'partial' ? 'bg-yellow-500/20 text-yellow-400' :
                              detail.status === 'unmet' ? 'bg-red-500/20 text-red-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              {detail.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplianceDashboard;
