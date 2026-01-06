'use client';

/**
 * Compliance Tab - Comprehensive Healthcare Compliance Dashboard
 *
 * Displays all outputs from the Compliance Agent including:
 * - Real-time compliance score and status
 * - Detailed violations with full metadata
 * - HIPAA section coverage breakdown
 * - PHI field detection results
 * - Audit trail requirements
 * - Remediation recommendations with effort estimates
 * - Regulatory references and citations
 * - Code annotations preview
 * - Export capabilities
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  AlertCircle,
  AlertOctagon,
  Info,
  FileCode,
  FileText,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  RefreshCw,
  Download,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Eye,
  EyeOff,
  Copy,
  Check,
  BookOpen,
  Scale,
  Lock,
  Unlock,
  Database,
  Activity,
  FileWarning,
  Fingerprint,
  Network,
  Server,
  Terminal,
  Code2,
  GitBranch,
  History,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  PieChart,
  List,
  LayoutGrid,
  Settings,
  HelpCircle,
  Clipboard,
  FileJson,
  FileType,
  Layers,
  Tag,
  Users,
  Building,
  Stethoscope,
  HeartPulse,
  Wrench,
  PlayCircle,
  CheckSquare,
  Square,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

type ComplianceSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface RegulationReference {
  regulation: string;
  section: string;
  title: string;
  description: string;
  requirement: 'required' | 'addressable';
  url?: string;
}

interface PHIField {
  name: string;
  type: string;
  sensitivity: 'standard' | 'sensitive' | 'highly_sensitive';
  file: string;
  line: number;
  deIdentificationMethod?: string;
}

interface AuditRequirement {
  eventType: string;
  description: string;
  file: string;
  line: number;
  implemented: boolean;
  requiredFields: string[];
  missingFields?: string[];
}

interface ComplianceViolation {
  id: string;
  severity: ComplianceSeverity;
  rule: string;
  ruleId: string;
  category: string;
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  codeSnippet: string;
  regulations: RegulationReference[];
  recommendation: string;
  autoFixAvailable: boolean;
  suggestedFix?: string;
  codeExample?: {
    bad: string;
    good: string;
  };
  tags: string[];
  timestamp: string;
}

interface ComplianceAnnotation {
  file: string;
  line: number;
  comment: string;
  regulations: string[];
  dataClassification?: string;
  auditType?: string;
  phiFields?: string[];
}

interface ComplianceRecommendation {
  priority: number;
  title: string;
  description: string;
  effort: 'low' | 'medium' | 'high';
  affectedFiles: string[];
  steps: string[];
  regulations: string[];
  estimatedTime?: string;
  category: string;
}

interface RegulatoryCoverage {
  regulation: string;
  fullName: string;
  coveragePercentage: number;
  status: 'compliant' | 'partial' | 'non-compliant';
  lastUpdated: string;
  details: {
    section: string;
    title: string;
    status: 'met' | 'partial' | 'unmet' | 'not_applicable';
    issues: number;
    findings: string[];
  }[];
}

interface ScanMetadata {
  scanId: string;
  projectId: string;
  projectName: string;
  timestamp: string;
  duration: number;
  filesScanned: number;
  filesSkipped: number;
  linesOfCode: number;
  scanType: 'full' | 'incremental' | 'quick';
  triggeredBy: 'manual' | 'story_complete' | 'pre_testing' | 'pre_deploy' | 'scheduled';
  configuredRegulations: string[];
  minSeverity: ComplianceSeverity;
}

interface ComplianceScanResult {
  success: boolean;
  metadata: ScanMetadata;
  summary: {
    complianceScore: number;
    previousScore?: number;
    trend: 'up' | 'down' | 'stable';
    totalViolations: number;
    bySeverity: Record<ComplianceSeverity, number>;
    byCategory: Record<string, number>;
    byRegulation: Record<string, number>;
    phiFieldsDetected: number;
    auditGaps: number;
  };
  violations: ComplianceViolation[];
  annotations: ComplianceAnnotation[];
  phiFields: PHIField[];
  auditRequirements: AuditRequirement[];
  recommendations: ComplianceRecommendation[];
  regulatoryCoverage: RegulatoryCoverage[];
}

interface ComplianceTabProps {
  projectId: string;
  projectPath?: string;
  onViolationClick?: (violation: ComplianceViolation) => void;
  onFileOpen?: (file: string, line: number) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SEVERITY_CONFIG: Record<ComplianceSeverity, { color: string; bg: string; border: string; icon: React.ElementType }> = {
  critical: { color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/50', icon: AlertOctagon },
  high: { color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/50', icon: AlertTriangle },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/50', icon: AlertCircle },
  low: { color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/50', icon: Info },
  info: { color: 'text-gray-400', bg: 'bg-gray-500/20', border: 'border-gray-500/50', icon: Info },
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  phi_exposure: Eye,
  encryption: Lock,
  access_control: Users,
  audit_logging: History,
  data_integrity: Database,
  transmission_security: Network,
  authentication: Fingerprint,
  session_management: Clock,
  error_handling: AlertCircle,
  input_validation: FileWarning,
  key_management: Lock,
  minimum_necessary: Layers,
  breach_notification: AlertOctagon,
};

const REGULATION_ICONS: Record<string, React.ElementType> = {
  HIPAA: Stethoscope,
  HITECH: HeartPulse,
  HITRUST: Shield,
  FDA_21_CFR_11: Scale,
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const CopyButton: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`p-1 hover:bg-gray-700 rounded transition-colors ${className}`}
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
    </button>
  );
};

const ScoreGauge: React.FC<{ score: number; previousScore?: number; size?: 'sm' | 'md' | 'lg' }> = ({
  score,
  previousScore,
  size = 'lg',
}) => {
  const getColor = (s: number) => {
    if (s >= 90) return { stroke: '#22c55e', text: 'text-green-400' };
    if (s >= 70) return { stroke: '#eab308', text: 'text-yellow-400' };
    if (s >= 50) return { stroke: '#f97316', text: 'text-orange-400' };
    return { stroke: '#ef4444', text: 'text-red-400' };
  };

  const sizeConfig = {
    sm: { width: 80, radius: 30, stroke: 6, fontSize: 'text-xl' },
    md: { width: 120, radius: 42, stroke: 8, fontSize: 'text-3xl' },
    lg: { width: 160, radius: 58, stroke: 10, fontSize: 'text-4xl' },
  };

  const config = sizeConfig[size];
  const { stroke: strokeColor, text: textColor } = getColor(score);
  const circumference = 2 * Math.PI * config.radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const center = config.width / 2;

  const trend = previousScore !== undefined
    ? score > previousScore ? 'up' : score < previousScore ? 'down' : 'stable'
    : 'stable';

  return (
    <div className="relative" style={{ width: config.width, height: config.width }}>
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx={center}
          cy={center}
          r={config.radius}
          fill="none"
          stroke="#374151"
          strokeWidth={config.stroke}
        />
        <circle
          cx={center}
          cy={center}
          r={config.radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={config.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="flex items-center gap-1">
          <span className={`${config.fontSize} font-bold ${textColor}`}>{score}</span>
          {trend === 'up' && <TrendingUp className="w-4 h-4 text-green-400" />}
          {trend === 'down' && <TrendingDown className="w-4 h-4 text-red-400" />}
          {trend === 'stable' && previousScore !== undefined && <Minus className="w-4 h-4 text-gray-400" />}
        </div>
        <span className="text-xs text-gray-400">Compliance</span>
        {previousScore !== undefined && (
          <span className={`text-xs ${trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-500'}`}>
            {trend === 'up' ? '+' : ''}{score - previousScore} pts
          </span>
        )}
      </div>
    </div>
  );
};

const SeverityBadge: React.FC<{ severity: ComplianceSeverity; showIcon?: boolean }> = ({ severity, showIcon = true }) => {
  const config = SEVERITY_CONFIG[severity];
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${config.bg} ${config.color} ${config.border}`}>
      {showIcon && <Icon className="w-3 h-3" />}
      {severity.toUpperCase()}
    </span>
  );
};

const CategoryBadge: React.FC<{ category: string }> = ({ category }) => {
  const Icon = CATEGORY_ICONS[category] || FileCode;
  const displayName = category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded border border-purple-500/30">
      <Icon className="w-3 h-3" />
      {displayName}
    </span>
  );
};

const RegulationBadge: React.FC<{ regulation: RegulationReference; expanded?: boolean }> = ({ regulation, expanded = false }) => {
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 text-xs bg-indigo-500/20 text-indigo-400 rounded border border-indigo-500/30 ${expanded ? 'flex-col items-start' : ''}`}>
      <div className="flex items-center gap-1">
        <Scale className="w-3 h-3" />
        <span className="font-medium">{regulation.regulation} §{regulation.section}</span>
        {regulation.requirement === 'required' && (
          <span className="px-1 py-0.5 text-[10px] bg-red-500/30 text-red-300 rounded">REQ</span>
        )}
      </div>
      {expanded && (
        <>
          <span className="text-indigo-300 font-medium">{regulation.title}</span>
          <span className="text-gray-400 text-[11px]">{regulation.description}</span>
          {regulation.url && (
            <a href={regulation.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-400 hover:underline">
              <ExternalLink className="w-3 h-3" />
              Reference
            </a>
          )}
        </>
      )}
    </div>
  );
};

const ViolationCard: React.FC<{
  violation: ComplianceViolation;
  expanded: boolean;
  onToggle: () => void;
  onFileOpen?: (file: string, line: number) => void;
}> = ({ violation, expanded, onToggle, onFileOpen }) => {
  const [showGoodExample, setShowGoodExample] = useState(false);
  const config = SEVERITY_CONFIG[violation.severity];

  return (
    <div className={`border rounded-lg overflow-hidden bg-gray-800/50 ${config.border}`}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-700/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
          <SeverityBadge severity={violation.severity} />
          <span className="text-sm font-medium text-gray-200 truncate">{violation.rule}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {violation.autoFixAvailable && (
            <span className="px-2 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded border border-green-500/30">
              AUTO-FIX
            </span>
          )}
          <span className="text-xs text-gray-500 font-mono">{violation.file.split('/').pop()}:{violation.line}</span>
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 py-4 border-t border-gray-700 space-y-4">
          {/* Rule ID & Category */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded font-mono">{violation.ruleId}</span>
            <CategoryBadge category={violation.category} />
            {violation.tags.map((tag, i) => (
              <span key={i} className="px-2 py-0.5 text-xs bg-gray-600/50 text-gray-400 rounded">
                <Tag className="w-3 h-3 inline mr-1" />
                {tag}
              </span>
            ))}
          </div>

          {/* File Location */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => onFileOpen?.(violation.file, violation.line)}
              className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 hover:underline"
            >
              <FileCode className="w-4 h-4" />
              <span className="font-mono">{violation.file}</span>
              <span className="text-gray-500">Line {violation.line}{violation.endLine && violation.endLine !== violation.line ? `-${violation.endLine}` : ''}, Col {violation.column}</span>
            </button>
            <CopyButton text={`${violation.file}:${violation.line}`} />
          </div>

          {/* Message */}
          <p className="text-sm text-gray-300">{violation.message}</p>

          {/* Code Snippet */}
          <div className="relative">
            <div className="absolute top-2 right-2 flex items-center gap-1">
              <CopyButton text={violation.codeSnippet} />
            </div>
            <pre className="p-3 bg-gray-900 rounded text-xs overflow-x-auto font-mono border border-gray-700">
              <code className="text-gray-300">{violation.codeSnippet}</code>
            </pre>
          </div>

          {/* Code Examples (Bad/Good) */}
          {violation.codeExample && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-400">Code Example:</span>
                <button
                  onClick={() => setShowGoodExample(!showGoodExample)}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Show {showGoodExample ? 'Bad' : 'Good'} Example
                </button>
              </div>
              <div className="relative">
                <div className={`absolute top-2 left-2 px-2 py-0.5 text-[10px] rounded ${showGoodExample ? 'bg-green-500/30 text-green-400' : 'bg-red-500/30 text-red-400'}`}>
                  {showGoodExample ? '✓ GOOD' : '✗ BAD'}
                </div>
                <pre className={`p-3 pt-8 rounded text-xs overflow-x-auto font-mono border ${showGoodExample ? 'bg-green-900/20 border-green-700/50' : 'bg-red-900/20 border-red-700/50'}`}>
                  <code className="text-gray-300">
                    {showGoodExample ? violation.codeExample.good : violation.codeExample.bad}
                  </code>
                </pre>
              </div>
            </div>
          )}

          {/* Regulations */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-gray-400 flex items-center gap-1">
              <Scale className="w-3 h-3" />
              Applicable Regulations:
            </span>
            <div className="flex flex-wrap gap-2">
              {violation.regulations.map((reg, i) => (
                <RegulationBadge key={i} regulation={reg} expanded />
              ))}
            </div>
          </div>

          {/* Recommendation */}
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-xs font-medium text-blue-400">Recommendation:</span>
                <p className="text-sm text-blue-300 mt-1">{violation.recommendation}</p>
              </div>
            </div>
          </div>

          {/* Suggested Fix */}
          {violation.suggestedFix && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex items-start justify-between">
                <span className="text-xs font-medium text-green-400 flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  Suggested Fix:
                </span>
                <CopyButton text={violation.suggestedFix} />
              </div>
              <pre className="mt-2 p-2 bg-gray-900/50 rounded text-xs overflow-x-auto font-mono">
                <code className="text-green-300">{violation.suggestedFix}</code>
              </pre>
            </div>
          )}

          {/* Timestamp */}
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Detected: {new Date(violation.timestamp).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
};

// PHI type descriptions for user understanding
const PHI_TYPE_INFO: Record<string, { label: string; description: string; icon: React.ReactNode }> = {
  ssn: { label: 'Social Security', description: 'Social Security Numbers - Direct identifier', icon: <Fingerprint className="w-4 h-4" /> },
  name: { label: 'Names', description: 'Patient names, first/last/full names', icon: <Users className="w-4 h-4" /> },
  address: { label: 'Address', description: 'Street address, city, zip code', icon: <Building className="w-4 h-4" /> },
  dates: { label: 'Dates', description: 'Birth dates, admission/discharge dates', icon: <Clock className="w-4 h-4" /> },
  phone: { label: 'Phone', description: 'Phone numbers, fax numbers', icon: <Network className="w-4 h-4" /> },
  email: { label: 'Email', description: 'Email addresses', icon: <FileText className="w-4 h-4" /> },
  mrn: { label: 'Medical Record #', description: 'Medical Record Numbers', icon: <FileCode className="w-4 h-4" /> },
  diagnosis: { label: 'Diagnosis', description: 'ICD codes, conditions, diagnoses', icon: <Stethoscope className="w-4 h-4" /> },
  medication: { label: 'Medications', description: 'Prescriptions, drug names', icon: <HeartPulse className="w-4 h-4" /> },
  insurance: { label: 'Insurance', description: 'Policy numbers, insurance IDs', icon: <Scale className="w-4 h-4" /> },
  biometric: { label: 'Biometric', description: 'Fingerprints, face IDs', icon: <Fingerprint className="w-4 h-4" /> },
  device: { label: 'Device IDs', description: 'IP addresses, device serials', icon: <Server className="w-4 h-4" /> },
  provider_notes: { label: 'Other PHI', description: 'Other protected health information', icon: <FileWarning className="w-4 h-4" /> },
};

const SENSITIVITY_INFO = {
  standard: {
    label: 'Standard PHI',
    description: 'Basic identifiers that require protection',
    examples: 'Names, addresses, phone numbers',
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
  },
  sensitive: {
    label: 'Sensitive PHI',
    description: 'High-risk data requiring extra protection',
    examples: 'SSN, DOB, medical record numbers',
    bg: 'bg-orange-500/20',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
  },
  highly_sensitive: {
    label: 'Highly Sensitive',
    description: 'Most restricted data with special handling',
    examples: 'Mental health, substance abuse, HIV status',
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    border: 'border-red-500/30',
  },
};

const PHIFieldCard: React.FC<{ field: PHIField; onFileOpen?: (file: string, line: number) => void; compact?: boolean }> = ({ field, onFileOpen, compact }) => {
  const config = SENSITIVITY_INFO[field.sensitivity];
  const typeInfo = PHI_TYPE_INFO[field.type] || PHI_TYPE_INFO.provider_notes;

  if (compact) {
    return (
      <button
        onClick={() => onFileOpen?.(field.file, field.line)}
        className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${config.bg} ${config.text} hover:opacity-80 transition-opacity`}
      >
        {typeInfo.icon}
        <span className="font-mono">{field.name}</span>
        <span className="text-gray-500">:{field.line}</span>
      </button>
    );
  }

  return (
    <div className={`p-3 rounded-lg border ${config.border} ${config.bg}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={config.text}>{typeInfo.icon}</span>
          <span className={`font-mono font-medium ${config.text}`}>{field.name}</span>
        </div>
        <span className={`px-2 py-0.5 text-[10px] rounded ${config.bg} ${config.text} border ${config.border}`}>
          {config.label.toUpperCase()}
        </span>
      </div>
      <div className="space-y-1 text-xs">
        <div className="flex items-center gap-2 text-gray-400">
          <Tag className="w-3 h-3" />
          {typeInfo.label}
        </div>
        <button
          onClick={() => onFileOpen?.(field.file, field.line)}
          className="flex items-center gap-2 text-blue-400 hover:text-blue-300"
        >
          <FileCode className="w-3 h-3" />
          {field.file.split(/[/\\]/).pop()}:{field.line}
        </button>
        {field.deIdentificationMethod && (
          <div className="flex items-center gap-2 text-green-400">
            <Lock className="w-3 h-3" />
            Protected: {field.deIdentificationMethod}
          </div>
        )}
      </div>
    </div>
  );
};

const AuditRequirementCard: React.FC<{ req: AuditRequirement; onFileOpen?: (file: string, line: number) => void }> = ({ req, onFileOpen }) => {
  return (
    <div className={`p-3 rounded-lg border ${req.implemented ? 'border-green-500/30 bg-green-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {req.implemented ? (
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          ) : (
            <XCircle className="w-4 h-4 text-red-400" />
          )}
          <span className="font-mono text-sm font-medium text-gray-200">{req.eventType}</span>
        </div>
        <span className={`px-2 py-0.5 text-[10px] rounded ${req.implemented ? 'bg-green-500/30 text-green-400' : 'bg-red-500/30 text-red-400'}`}>
          {req.implemented ? 'IMPLEMENTED' : 'MISSING'}
        </span>
      </div>
      <p className="text-xs text-gray-400 mb-2">{req.description}</p>
      <button
        onClick={() => onFileOpen?.(req.file, req.line)}
        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mb-2"
      >
        <FileCode className="w-3 h-3" />
        {req.file.split('/').pop()}:{req.line}
      </button>
      <div className="flex flex-wrap gap-1">
        {req.requiredFields.map((field, i) => (
          <span
            key={i}
            className={`px-1.5 py-0.5 text-[10px] rounded font-mono ${
              req.missingFields?.includes(field)
                ? 'bg-red-500/30 text-red-400 line-through'
                : 'bg-gray-700 text-gray-300'
            }`}
          >
            {field}
          </span>
        ))}
      </div>
    </div>
  );
};

const RecommendationCard: React.FC<{ rec: ComplianceRecommendation }> = ({ rec }) => {
  const [expanded, setExpanded] = useState(false);

  const effortConfig = {
    low: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
    medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    high: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  };

  const config = effortConfig[rec.effort];

  return (
    <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 flex items-center justify-center bg-purple-500/20 text-purple-400 rounded-full text-sm font-bold">
            {rec.priority}
          </span>
          <h4 className="font-medium text-gray-200">{rec.title}</h4>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-xs rounded ${config.bg} ${config.text} ${config.border}`}>
            {rec.effort.toUpperCase()} EFFORT
          </span>
          {rec.estimatedTime && (
            <span className="px-2 py-0.5 text-xs bg-gray-700 text-gray-400 rounded">
              ~{rec.estimatedTime}
            </span>
          )}
        </div>
      </div>

      <p className="text-sm text-gray-400 mb-3">{rec.description}</p>

      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mb-2"
      >
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {expanded ? 'Hide' : 'Show'} Steps ({rec.steps.length})
      </button>

      {expanded && (
        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-300 mb-3 pl-2">
          {rec.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{rec.affectedFiles.length} file{rec.affectedFiles.length !== 1 ? 's' : ''} affected</span>
        <div className="flex items-center gap-1">
          {rec.regulations.slice(0, 2).map((reg, i) => (
            <span key={i} className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 rounded">
              {reg}
            </span>
          ))}
          {rec.regulations.length > 2 && (
            <span className="text-gray-500">+{rec.regulations.length - 2}</span>
          )}
        </div>
      </div>
    </div>
  );
};

const RegulatoryCoverageCard: React.FC<{ coverage: RegulatoryCoverage }> = ({ coverage }) => {
  const [expanded, setExpanded] = useState(false);

  const statusConfig = {
    compliant: { color: 'text-green-400', bg: 'bg-green-500', icon: CheckCircle2 },
    partial: { color: 'text-yellow-400', bg: 'bg-yellow-500', icon: AlertCircle },
    'non-compliant': { color: 'text-red-400', bg: 'bg-red-500', icon: XCircle },
  };

  const config = statusConfig[coverage.status];
  const Icon = config.icon;
  const RegIcon = REGULATION_ICONS[coverage.regulation] || Shield;

  return (
    <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <RegIcon className={`w-5 h-5 ${config.color}`} />
          <div>
            <h4 className="font-medium text-gray-200">{coverage.regulation}</h4>
            <span className="text-xs text-gray-500">{coverage.fullName}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${config.color}`} />
          <span className={`text-lg font-bold ${config.color}`}>{coverage.coveragePercentage}%</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full ${config.bg} transition-all duration-500`}
          style={{ width: `${coverage.coveragePercentage}%` }}
        />
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 w-full justify-between"
      >
        <span>{expanded ? 'Hide' : 'Show'} Section Details ({coverage.details.length})</span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {coverage.details.map((detail, i) => {
            const detailStatus = {
              met: { color: 'text-green-400', bg: 'bg-green-500/20' },
              partial: { color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
              unmet: { color: 'text-red-400', bg: 'bg-red-500/20' },
              not_applicable: { color: 'text-gray-500', bg: 'bg-gray-500/20' },
            };
            const dConfig = detailStatus[detail.status];

            return (
              <div key={i} className={`p-2 rounded ${dConfig.bg}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">{detail.section}</span>
                  <div className="flex items-center gap-2">
                    {detail.issues > 0 && (
                      <span className="text-xs text-red-400">{detail.issues} issue{detail.issues !== 1 ? 's' : ''}</span>
                    )}
                    <span className={`px-2 py-0.5 text-[10px] rounded ${dConfig.color} ${dConfig.bg}`}>
                      {detail.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-gray-500">{detail.title}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-2 text-xs text-gray-500">
        Last updated: {new Date(coverage.lastUpdated).toLocaleString()}
      </div>
    </div>
  );
};

const AnnotationPreview: React.FC<{ annotation: ComplianceAnnotation; onFileOpen?: (file: string, line: number) => void }> = ({ annotation, onFileOpen }) => {
  return (
    <div className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg font-mono text-xs">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => onFileOpen?.(annotation.file, annotation.line)}
          className="text-blue-400 hover:text-blue-300"
        >
          {annotation.file.split('/').pop()}:{annotation.line}
        </button>
        <CopyButton text={annotation.comment} />
      </div>
      <pre className="text-green-400 whitespace-pre-wrap">{annotation.comment}</pre>
      <div className="mt-2 flex flex-wrap gap-1">
        {annotation.dataClassification && (
          <span className="px-1.5 py-0.5 text-[10px] bg-purple-500/20 text-purple-400 rounded">
            {annotation.dataClassification}
          </span>
        )}
        {annotation.auditType && (
          <span className="px-1.5 py-0.5 text-[10px] bg-blue-500/20 text-blue-400 rounded">
            {annotation.auditType}
          </span>
        )}
        {annotation.phiFields?.map((field, i) => (
          <span key={i} className="px-1.5 py-0.5 text-[10px] bg-yellow-500/20 text-yellow-400 rounded">
            {field}
          </span>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ComplianceTab: React.FC<ComplianceTabProps> = ({
  projectId,
  projectPath,
  onViolationClick,
  onFileOpen,
}) => {
  // State
  const [scanResult, setScanResult] = useState<ComplianceScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'overview' | 'violations' | 'autofix' | 'phi' | 'audit' | 'coverage' | 'recommendations' | 'annotations'>('overview');
  const [selectedViolations, setSelectedViolations] = useState<Set<string>>(new Set());
  const [fixPreviews, setFixPreviews] = useState<any[]>([]);
  const [applyingFixes, setApplyingFixes] = useState(false);
  const [fixResult, setFixResult] = useState<{ success: boolean; applied: number; failed: number; errors: string[] } | null>(null);
  const [expandedViolations, setExpandedViolations] = useState<Set<string>>(new Set());
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Fetch scan results
  const runScan = useCallback(async () => {
    // Don't scan if no project path provided
    if (!projectPath && !projectId) {
      setError('No project path or ID provided for compliance scan');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/compliance/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath: projectPath || undefined,
          projectId: projectId || undefined,
          outputFormat: 'full',
          includeAnnotations: true,
          includeRecommendations: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || `Scan failed with status ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Scan failed');
      }

      // Transform API response to our internal type
      setScanResult(transformApiResponse(result));
    } catch (err) {
      console.error('Compliance scan error:', err);
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setLoading(false);
    }
  }, [projectPath, projectId]);

  useEffect(() => {
    // Run real compliance scan on mount
    runScan();
  }, [runScan]);

  // Computed values
  const filteredViolations = useMemo(() => {
    if (!scanResult) return [];

    return scanResult.violations.filter(v => {
      if (severityFilter !== 'all' && v.severity !== severityFilter) return false;
      if (categoryFilter !== 'all' && v.category !== categoryFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          v.rule.toLowerCase().includes(query) ||
          v.file.toLowerCase().includes(query) ||
          v.message.toLowerCase().includes(query) ||
          v.ruleId.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [scanResult, severityFilter, categoryFilter, searchQuery]);

  const categories = useMemo(() => {
    if (!scanResult) return [];
    return [...new Set(scanResult.violations.map(v => v.category))];
  }, [scanResult]);

  // Handlers
  const toggleViolation = (id: string) => {
    setExpandedViolations(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportReport = (format: 'json' | 'html' | 'markdown') => {
    if (!scanResult) return;

    let content: string;
    let mimeType: string;
    let ext: string;

    switch (format) {
      case 'html':
        content = generateHTMLExport(scanResult);
        mimeType = 'text/html';
        ext = 'html';
        break;
      case 'markdown':
        content = generateMarkdownExport(scanResult);
        mimeType = 'text/markdown';
        ext = 'md';
        break;
      default:
        content = JSON.stringify(scanResult, null, 2);
        mimeType = 'application/json';
        ext = 'json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-report-${scanResult.metadata.scanId}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Render loading state
  if (loading && !scanResult) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-3" />
          <p className="text-gray-400">Scanning for compliance violations...</p>
          <p className="text-xs text-gray-500 mt-1">Checking HIPAA, HITECH, and HITRUST requirements</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error && !scanResult) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <div className="text-center max-w-md">
          <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-400 font-medium mb-2">Compliance Scan Failed</p>
          <p className="text-gray-400 text-sm mb-4">{error}</p>
          <button
            onClick={runScan}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm"
          >
            {loading ? 'Retrying...' : 'Retry Scan'}
          </button>
        </div>
      </div>
    );
  }

  if (!scanResult) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <Shield className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No compliance data available</p>
          <button
            onClick={runScan}
            className="mt-3 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm"
          >
            Run Compliance Scan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-purple-400" />
          <div>
            <h2 className="font-semibold">Healthcare Compliance</h2>
            <span className="text-xs text-gray-500">
              {scanResult.metadata.configuredRegulations.join(', ')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <div className="relative group">
            <button className="p-2 hover:bg-gray-700 rounded transition-colors" title="Export Report">
              <Download className="w-4 h-4" />
            </button>
            <div className="absolute right-0 top-full mt-1 w-32 bg-gray-800 border border-gray-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button onClick={() => exportReport('json')} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2">
                <FileJson className="w-4 h-4" /> JSON
              </button>
              <button onClick={() => exportReport('html')} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2">
                <FileType className="w-4 h-4" /> HTML
              </button>
              <button onClick={() => exportReport('markdown')} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Markdown
              </button>
            </div>
          </div>
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

      {/* Summary Bar */}
      <div className="px-4 py-4 border-b border-gray-700 bg-gray-800/50 flex-shrink-0">
        <div className="flex items-center gap-6">
          {/* Score */}
          <ScoreGauge
            score={scanResult.summary.complianceScore}
            previousScore={scanResult.summary.previousScore}
            size="md"
          />

          {/* Stats Grid */}
          <div className="flex-1 grid grid-cols-5 gap-3">
            {(['critical', 'high', 'medium', 'low'] as ComplianceSeverity[]).map(sev => {
              const config = SEVERITY_CONFIG[sev];
              const count = scanResult.summary.bySeverity[sev];
              return (
                <button
                  key={sev}
                  onClick={() => { setActiveSection('violations'); setSeverityFilter(sev); }}
                  className={`p-3 rounded-lg border ${config.border} ${config.bg} hover:opacity-80 transition-opacity text-center`}
                >
                  <div className={`text-2xl font-bold ${config.color}`}>{count}</div>
                  <div className="text-xs text-gray-400 capitalize">{sev}</div>
                </button>
              );
            })}
            <div className="p-3 rounded-lg border border-purple-500/30 bg-purple-500/10 text-center">
              <div className="text-2xl font-bold text-purple-400">{scanResult.summary.phiFieldsDetected}</div>
              <div className="text-xs text-gray-400">PHI Fields</div>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 flex-wrap">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(scanResult.metadata.timestamp).toLocaleString()}
          </span>
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {scanResult.metadata.duration}ms
          </span>
          <span className="flex items-center gap-1">
            <FileCode className="w-3 h-3" />
            {scanResult.metadata.filesScanned} files ({scanResult.metadata.linesOfCode.toLocaleString()} LOC)
          </span>
          <span className="flex items-center gap-1">
            <GitBranch className="w-3 h-3" />
            {scanResult.metadata.scanType} scan
          </span>
          <span className="flex items-center gap-1">
            <Activity className="w-3 h-3" />
            Triggered: {scanResult.metadata.triggeredBy.replace('_', ' ')}
          </span>
          <span className="px-2 py-0.5 bg-gray-700 rounded font-mono">
            ID: {scanResult.metadata.scanId}
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="px-4 border-b border-gray-700 flex-shrink-0 overflow-x-auto">
        <div className="flex gap-1">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'violations', label: 'Violations', icon: AlertTriangle, count: scanResult.summary.totalViolations },
            { id: 'autofix', label: 'Auto-Fix', icon: Wrench, count: scanResult.violations.filter(v => v.autoFixAvailable).length },
            { id: 'phi', label: 'PHI Fields', icon: Eye, count: scanResult.phiFields.length },
            { id: 'audit', label: 'Audit Trail', icon: History, count: scanResult.auditRequirements.filter(a => !a.implemented).length },
            { id: 'coverage', label: 'Regulations', icon: Scale },
            { id: 'recommendations', label: 'Recommendations', icon: Zap, count: scanResult.recommendations.length },
            { id: 'annotations', label: 'Annotations', icon: Code2, count: scanResult.annotations.length },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id as any)}
                className={`flex items-center gap-2 px-3 py-2 text-sm border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-purple-400 text-purple-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`px-1.5 py-0.5 text-xs rounded ${isActive ? 'bg-purple-500/30' : 'bg-gray-700'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Overview Section */}
        {activeSection === 'overview' && (
          <div className="space-y-6">
            {/* Category Breakdown */}
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                <PieChart className="w-4 h-4" />
                Violations by Category
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(scanResult.summary.byCategory).map(([cat, count]) => {
                  const Icon = CATEGORY_ICONS[cat] || FileCode;
                  return (
                    <button
                      key={cat}
                      onClick={() => { setActiveSection('violations'); setCategoryFilter(cat); }}
                      className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-purple-500/50 transition-colors text-left"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Icon className="w-4 h-4 text-purple-400" />
                        <span className="text-lg font-bold text-gray-200">{count}</span>
                      </div>
                      <span className="text-xs text-gray-400 capitalize">{cat.replace(/_/g, ' ')}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Regulatory Status */}
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                <Scale className="w-4 h-4" />
                Regulatory Compliance Status
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {scanResult.regulatoryCoverage.map((coverage, i) => (
                  <RegulatoryCoverageCard key={i} coverage={coverage} />
                ))}
              </div>
            </div>

            {/* Top Recommendations */}
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Priority Recommendations
              </h3>
              <div className="space-y-3">
                {scanResult.recommendations.slice(0, 3).map((rec, i) => (
                  <RecommendationCard key={i} rec={rec} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Violations Section */}
        {activeSection === 'violations' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px] relative">
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
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <div className="flex items-center gap-1 border border-gray-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-purple-600' : 'hover:bg-gray-700'}`}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-purple-600' : 'hover:bg-gray-700'}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Results count */}
            <div className="text-sm text-gray-500">
              Showing {filteredViolations.length} of {scanResult.violations.length} violations
            </div>

            {/* Violation list */}
            <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-2'}>
              {filteredViolations.length === 0 ? (
                <div className="text-center py-8 text-gray-500 col-span-2">
                  {scanResult.violations.length === 0 ? (
                    <div className="flex flex-col items-center gap-2">
                      <ShieldCheck className="w-12 h-12 text-green-400" />
                      <p className="text-green-400 font-medium">No compliance violations found!</p>
                      <p className="text-sm">Your code meets all configured compliance requirements.</p>
                    </div>
                  ) : (
                    <p>No violations match your filter criteria</p>
                  )}
                </div>
              ) : (
                filteredViolations.map(violation => (
                  <ViolationCard
                    key={violation.id}
                    violation={violation}
                    expanded={expandedViolations.has(violation.id)}
                    onToggle={() => toggleViolation(violation.id)}
                    onFileOpen={onFileOpen}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* Auto-Fix Section */}
        {activeSection === 'autofix' && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-300">
                  Auto-Fix Available ({scanResult.violations.filter(v => v.autoFixAvailable).length} issues)
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Select violations to preview and apply automatic fixes
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const fixableIds = scanResult.violations
                      .filter(v => v.autoFixAvailable)
                      .map(v => v.id);
                    setSelectedViolations(new Set(fixableIds));
                  }}
                  className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded"
                >
                  Select All
                </button>
                <button
                  onClick={() => setSelectedViolations(new Set())}
                  className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded"
                >
                  Clear
                </button>
                <button
                  onClick={async () => {
                    if (selectedViolations.size === 0) return;
                    const selected = scanResult.violations.filter(v => selectedViolations.has(v.id));
                    try {
                      const response = await fetch('/api/compliance/fix', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          action: 'preview',
                          violations: selected,
                          projectPath: projectPath,
                        }),
                      });
                      const data = await response.json();
                      if (data.success) {
                        setFixPreviews(data.fixes);
                      }
                    } catch (err) {
                      console.error('Failed to generate fix previews:', err);
                    }
                  }}
                  disabled={selectedViolations.size === 0}
                  className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" /> Preview Fixes
                </button>
              </div>
            </div>

            {/* Fix Result Banner */}
            {fixResult && (
              <div className={`p-3 rounded-lg ${fixResult.success ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {fixResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                    <span className={fixResult.success ? 'text-green-400' : 'text-red-400'}>
                      {fixResult.applied} fixes applied, {fixResult.failed} failed
                    </span>
                  </div>
                  <button onClick={() => { setFixResult(null); runScan(); }} className="text-xs text-gray-400 hover:text-gray-200">
                    Re-scan
                  </button>
                </div>
                {fixResult.errors.length > 0 && (
                  <div className="mt-2 text-xs text-red-400">
                    {fixResult.errors.map((e, i) => <div key={i}>• {e}</div>)}
                  </div>
                )}
              </div>
            )}

            {/* Fixable Violations List */}
            <div className="space-y-2">
              {scanResult.violations.filter(v => v.autoFixAvailable).length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Wrench className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No auto-fixable violations found</p>
                  <p className="text-xs mt-1">All current issues require manual remediation</p>
                </div>
              ) : (
                scanResult.violations
                  .filter(v => v.autoFixAvailable)
                  .map(violation => (
                    <div
                      key={violation.id}
                      className={`p-3 bg-gray-800/50 border rounded-lg cursor-pointer transition-colors ${
                        selectedViolations.has(violation.id)
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                      onClick={() => {
                        setSelectedViolations(prev => {
                          const next = new Set(prev);
                          if (next.has(violation.id)) next.delete(violation.id);
                          else next.add(violation.id);
                          return next;
                        });
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {selectedViolations.has(violation.id) ? (
                            <CheckSquare className="w-5 h-5 text-purple-400" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <SeverityBadge severity={violation.severity} />
                            <span className="text-sm font-medium text-gray-200">{violation.rule}</span>
                          </div>
                          <div className="text-xs text-gray-400 mb-2">
                            {violation.file.split('/').pop()}:{violation.line}
                          </div>
                          <code className="block text-xs bg-gray-900 p-2 rounded text-gray-300 overflow-x-auto">
                            {violation.codeSnippet}
                          </code>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>

            {/* Fix Previews */}
            {fixPreviews.length > 0 && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-300">Fix Preview</h4>
                  <button
                    onClick={async () => {
                      setApplyingFixes(true);
                      try {
                        const selected = scanResult.violations.filter(v => selectedViolations.has(v.id));
                        const response = await fetch('/api/compliance/fix', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            action: 'apply',
                            violations: selected,
                            projectPath: projectPath,
                            options: { backup: true },
                          }),
                        });
                        const data = await response.json();
                        setFixResult({
                          success: data.success,
                          applied: data.fixesApplied,
                          failed: data.fixesFailed,
                          errors: data.errors || [],
                        });
                        setFixPreviews([]);
                        setSelectedViolations(new Set());
                      } catch (err) {
                        setFixResult({
                          success: false,
                          applied: 0,
                          failed: selectedViolations.size,
                          errors: [err instanceof Error ? err.message : 'Unknown error'],
                        });
                      } finally {
                        setApplyingFixes(false);
                      }
                    }}
                    disabled={applyingFixes}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded flex items-center gap-2"
                  >
                    {applyingFixes ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <PlayCircle className="w-4 h-4" />
                    )}
                    Apply {fixPreviews.length} Fixes
                  </button>
                </div>

                {fixPreviews.map((fix, i) => (
                  <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-gray-700/50 flex items-center justify-between">
                      <span className="text-sm text-gray-300">{fix.file.split('/').pop()}</span>
                      {fix.requiresReview && (
                        <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded">
                          Requires Review
                        </span>
                      )}
                    </div>
                    <div className="p-3 space-y-2">
                      <div>
                        <div className="text-xs text-red-400 mb-1">- Original:</div>
                        <code className="block text-xs bg-red-950/30 p-2 rounded text-red-300">
                          {fix.originalCode}
                        </code>
                      </div>
                      <div>
                        <div className="text-xs text-green-400 mb-1">+ Fixed:</div>
                        <code className="block text-xs bg-green-950/30 p-2 rounded text-green-300 whitespace-pre-wrap">
                          {fix.fixedCode}
                        </code>
                      </div>
                      <div className="text-xs text-gray-400 mt-2">
                        {fix.explanation}
                      </div>
                      {fix.reviewNotes && (
                        <div className="text-xs text-yellow-400 mt-1">
                          ⚠️ {fix.reviewNotes}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PHI Fields Section */}
        {activeSection === 'phi' && (
          <div className="space-y-6">
            {scanResult.phiFields.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No PHI Fields Detected</p>
                <p className="text-sm max-w-md mx-auto">
                  The scanner did not find any PHI-related field names (like ssn, patientId, firstName, etc.)
                  in the scanned code. This could mean the code doesn't handle PHI, or uses different naming conventions.
                </p>
              </div>
            ) : (
              <>
                {/* What is PHI - Educational Banner */}
                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-blue-400 mb-1">What is PHI?</h4>
                      <p className="text-xs text-gray-400">
                        Protected Health Information (PHI) includes any data that can identify a patient and relates to their health.
                        Under HIPAA, PHI must be encrypted, access-controlled, and audit-logged. The scanner detects field names
                        that commonly store PHI to help you ensure proper handling.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-4 gap-4">
                  {/* Total Count */}
                  <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                    <div className="text-2xl font-bold text-white">{scanResult.phiFields.length}</div>
                    <div className="text-xs text-gray-400">Total PHI Fields</div>
                  </div>

                  {/* By Sensitivity */}
                  {(['standard', 'sensitive', 'highly_sensitive'] as const).map(level => {
                    const count = scanResult.phiFields.filter(f => f.sensitivity === level).length;
                    const info = SENSITIVITY_INFO[level];
                    return (
                      <div key={level} className={`p-4 rounded-lg ${info.bg} border ${info.border}`}>
                        <div className={`text-2xl font-bold ${info.text}`}>{count}</div>
                        <div className={`text-xs ${info.text} opacity-80`}>{info.label}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Sensitivity Level Explanations */}
                <div className="grid grid-cols-3 gap-3">
                  {(['standard', 'sensitive', 'highly_sensitive'] as const).map(level => {
                    const info = SENSITIVITY_INFO[level];
                    return (
                      <div key={level} className={`p-3 rounded-lg border ${info.border} bg-gray-800/30`}>
                        <div className={`text-sm font-medium ${info.text} mb-1`}>{info.label}</div>
                        <p className="text-xs text-gray-400 mb-2">{info.description}</p>
                        <p className="text-xs text-gray-500">e.g., {info.examples}</p>
                      </div>
                    );
                  })}
                </div>

                {/* PHI Fields Grouped by File */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <FileCode className="w-4 h-4" />
                    PHI Fields by File
                  </h3>
                  {Object.entries(
                    scanResult.phiFields.reduce((acc, field) => {
                      const fileName = field.file.split(/[/\\]/).pop() || field.file;
                      if (!acc[fileName]) acc[fileName] = { file: field.file, fields: [] };
                      acc[fileName].fields.push(field);
                      return acc;
                    }, {} as Record<string, { file: string; fields: PHIField[] }>)
                  ).map(([fileName, { file, fields }]) => (
                    <div key={fileName} className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                      <div className="flex items-center justify-between mb-3">
                        <button
                          onClick={() => onFileOpen?.(file, fields[0]?.line || 1)}
                          className="flex items-center gap-2 text-sm font-medium text-blue-400 hover:text-blue-300"
                        >
                          <FileCode className="w-4 h-4" />
                          {fileName}
                        </button>
                        <span className="text-xs text-gray-500">{fields.length} field{fields.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {fields.map((field, i) => (
                          <PHIFieldCard key={i} field={field} onFileOpen={onFileOpen} compact />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* PHI Types Breakdown */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    PHI Types Found
                  </h3>
                  <div className="grid grid-cols-4 gap-3">
                    {Object.entries(
                      scanResult.phiFields.reduce((acc, field) => {
                        acc[field.type] = (acc[field.type] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)
                    )
                      .sort((a, b) => b[1] - a[1])
                      .map(([type, count]) => {
                        const info = PHI_TYPE_INFO[type] || PHI_TYPE_INFO.provider_notes;
                        return (
                          <div key={type} className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-purple-400">{info.icon}</span>
                              <span className="text-sm font-medium text-gray-300">{info.label}</span>
                            </div>
                            <div className="text-xl font-bold text-white">{count}</div>
                            <p className="text-xs text-gray-500 mt-1">{info.description}</p>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Audit Trail Section */}
        {activeSection === 'audit' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-300">
                Audit Trail Requirements
              </h3>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  {scanResult.auditRequirements.filter(a => a.implemented).length} Implemented
                </span>
                <span className="flex items-center gap-1">
                  <XCircle className="w-4 h-4 text-red-400" />
                  {scanResult.auditRequirements.filter(a => !a.implemented).length} Missing
                </span>
              </div>
            </div>
            {scanResult.auditRequirements.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No Audit Requirements Analyzed</p>
                <p className="text-sm max-w-md mx-auto">
                  The scanner checks for audit logging implementations across your codebase.
                  No audit requirements were found in the scanned files.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {scanResult.auditRequirements.map((req, i) => (
                  <AuditRequirementCard key={i} req={req} onFileOpen={onFileOpen} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Regulatory Coverage Section */}
        {activeSection === 'coverage' && (
          <div className="space-y-4">
            {scanResult.regulatoryCoverage.map((coverage, i) => (
              <RegulatoryCoverageCard key={i} coverage={coverage} />
            ))}
          </div>
        )}

        {/* Recommendations Section */}
        {activeSection === 'recommendations' && (
          <div className="space-y-4">
            {scanResult.recommendations.map((rec, i) => (
              <RecommendationCard key={i} rec={rec} />
            ))}
          </div>
        )}

        {/* Annotations Section */}
        {activeSection === 'annotations' && (
          <div className="space-y-6">
            {scanResult.annotations.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Code2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No Annotations Generated</p>
                <p className="text-sm max-w-md mx-auto">
                  The scanner didn't generate any compliance annotations. This could mean no PHI fields
                  were detected, or the code doesn't require compliance documentation.
                </p>
              </div>
            ) : (
              <>
                {/* What are Annotations - Educational Banner */}
                <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
                  <div className="flex items-start gap-3">
                    <Code2 className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-purple-400 mb-1">What are Compliance Annotations?</h4>
                      <p className="text-xs text-gray-400">
                        Annotations are code comments that document PHI handling for auditors and developers.
                        They identify data classification, audit requirements, and HIPAA sections that apply.
                        Adding these to your code helps demonstrate compliance during audits.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                    <div className="text-2xl font-bold text-white">{scanResult.annotations.length}</div>
                    <div className="text-xs text-gray-400">Total Annotations</div>
                  </div>
                  <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                    <div className="text-2xl font-bold text-purple-400">
                      {new Set(scanResult.annotations.map(a => a.file)).size}
                    </div>
                    <div className="text-xs text-gray-400">Files Affected</div>
                  </div>
                  <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                    <div className="text-2xl font-bold text-yellow-400">
                      {scanResult.annotations.filter(a => a.dataClassification === 'phi').length}
                    </div>
                    <div className="text-xs text-gray-400">PHI Locations</div>
                  </div>
                  <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                    <div className="text-2xl font-bold text-blue-400">
                      {scanResult.annotations.filter(a => a.auditType).length}
                    </div>
                    <div className="text-xs text-gray-400">Audit Points</div>
                  </div>
                </div>

                {/* Data Classification Legend */}
                <div className="p-4 rounded-lg bg-gray-800/30 border border-gray-700">
                  <h4 className="text-sm font-medium text-gray-300 mb-3">Data Classifications</h4>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { key: 'phi', label: 'PHI', desc: 'Protected Health Info', color: 'yellow' },
                      { key: 'pii', label: 'PII', desc: 'Personal Identifiable', color: 'orange' },
                      { key: 'restricted_phi', label: 'Restricted PHI', desc: 'Highly Sensitive', color: 'red' },
                      { key: 'confidential', label: 'Confidential', desc: 'Internal Only', color: 'purple' },
                      { key: 'internal', label: 'Internal', desc: 'Business Data', color: 'blue' },
                    ].map(c => (
                      <div key={c.key} className="flex items-center gap-2 text-xs">
                        <span className={`w-3 h-3 rounded bg-${c.color}-500/40`} />
                        <span className="text-gray-300">{c.label}</span>
                        <span className="text-gray-500">({c.desc})</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Annotations Grouped by File */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      <FileCode className="w-4 h-4" />
                      Annotations by File
                    </h3>
                    <button
                      className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 rounded-lg flex items-center gap-2"
                    >
                      <Copy className="w-3 h-3" />
                      Copy All Annotations
                    </button>
                  </div>

                  {Object.entries(
                    scanResult.annotations.reduce((acc, annotation) => {
                      const fileName = annotation.file.split(/[/\\]/).pop() || annotation.file;
                      if (!acc[fileName]) acc[fileName] = { file: annotation.file, annotations: [] };
                      acc[fileName].annotations.push(annotation);
                      return acc;
                    }, {} as Record<string, { file: string; annotations: ComplianceAnnotation[] }>)
                  ).map(([fileName, { file, annotations }]) => (
                    <div key={fileName} className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                      <div className="flex items-center justify-between mb-3">
                        <button
                          onClick={() => onFileOpen?.(file, annotations[0]?.line || 1)}
                          className="flex items-center gap-2 text-sm font-medium text-blue-400 hover:text-blue-300"
                        >
                          <FileCode className="w-4 h-4" />
                          {fileName}
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">
                            {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
                          </span>
                          <CopyButton text={annotations.map(a => a.comment).join('\n\n')} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        {annotations.map((annotation, i) => (
                          <div key={i} className="p-3 rounded bg-gray-900/50 border border-gray-700/50">
                            <div className="flex items-center justify-between mb-2">
                              <button
                                onClick={() => onFileOpen?.(annotation.file, annotation.line)}
                                className="text-xs text-gray-500 hover:text-gray-300"
                              >
                                Line {annotation.line}
                              </button>
                              <div className="flex items-center gap-1">
                                {annotation.dataClassification && (
                                  <span className={`px-1.5 py-0.5 text-[10px] rounded ${
                                    annotation.dataClassification === 'phi' ? 'bg-yellow-500/20 text-yellow-400' :
                                    annotation.dataClassification === 'pii' ? 'bg-orange-500/20 text-orange-400' :
                                    annotation.dataClassification === 'restricted_phi' ? 'bg-red-500/20 text-red-400' :
                                    'bg-purple-500/20 text-purple-400'
                                  }`}>
                                    {annotation.dataClassification.toUpperCase()}
                                  </span>
                                )}
                                {annotation.auditType && (
                                  <span className="px-1.5 py-0.5 text-[10px] bg-blue-500/20 text-blue-400 rounded">
                                    {annotation.auditType}
                                  </span>
                                )}
                              </div>
                            </div>
                            <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap bg-gray-900/50 p-2 rounded">
                              {annotation.comment}
                            </pre>
                            {annotation.phiFields && annotation.phiFields.length > 0 && (
                              <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                                <Eye className="w-3 h-3" />
                                PHI fields: {annotation.phiFields.join(', ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function transformApiResponse(apiResponse: any): ComplianceScanResult {
  // Transform the API response to match our internal type
  // The API returns a flat structure, we need to map it to our nested structure

  const violations: ComplianceViolation[] = (apiResponse.violations || []).map((v: any, index: number) => ({
    id: v.id || `violation-${index}`,
    severity: v.severity || 'medium',
    rule: v.rule || v.ruleName || 'Unknown Rule',
    ruleId: v.ruleId || `rule-${index}`,
    category: v.category || 'phi_exposure',
    file: v.file || 'unknown',
    line: v.line || 0,
    column: v.column || 0,
    endLine: v.endLine,
    endColumn: v.endColumn,
    message: v.message || '',
    codeSnippet: v.codeSnippet || '',
    regulations: Array.isArray(v.regulations)
      ? v.regulations.map((r: any) => typeof r === 'string'
        ? { regulation: r.split(' ')[0] || 'HIPAA', section: r.split(' ')[1] || '', title: '', description: '', requirement: 'required' as const }
        : r)
      : [],
    recommendation: v.recommendation || '',
    autoFixAvailable: v.autoFixAvailable || false,
    suggestedFix: v.suggestedFix,
    codeExample: v.codeExample,
    tags: v.tags || [],
    timestamp: v.timestamp || new Date().toISOString(),
  }));

  const annotations: ComplianceAnnotation[] = (apiResponse.annotations || []).map((a: any) => ({
    file: a.file || '',
    line: a.line || 0,
    comment: a.comment || '',
    regulations: a.regulations || [],
    dataClassification: a.dataClassification,
    auditType: a.auditType,
    phiFields: a.phiFields,
  }));

  const recommendations: ComplianceRecommendation[] = (apiResponse.recommendations || []).map((r: any, index: number) => ({
    priority: r.priority || index + 1,
    title: r.title || 'Recommendation',
    description: r.description || '',
    effort: r.effort || 'medium',
    affectedFiles: Array.isArray(r.affectedFiles) ? r.affectedFiles : [],
    steps: r.steps || [],
    regulations: r.regulations || [],
    estimatedTime: r.estimatedTime,
    category: r.category || 'general',
  }));

  const regulatoryCoverage: RegulatoryCoverage[] = (apiResponse.regulatoryCoverage || []).map((rc: any) => ({
    regulation: rc.regulation || 'HIPAA',
    fullName: rc.fullName || getRegulationFullName(rc.regulation),
    coveragePercentage: rc.coveragePercentage || 0,
    status: rc.status || (rc.coveragePercentage >= 90 ? 'compliant' : rc.coveragePercentage >= 50 ? 'partial' : 'non-compliant'),
    lastUpdated: rc.lastUpdated || new Date().toISOString(),
    details: (rc.details || []).map((d: any) => ({
      section: d.section || '',
      title: d.title || '',
      status: d.status || 'unmet',
      issues: d.issues || 0,
      findings: d.findings || [],
    })),
  }));

  // Build the summary with proper bySeverity structure
  const bySeverity: Record<ComplianceSeverity, number> = {
    critical: apiResponse.summary?.critical || apiResponse.summary?.bySeverity?.critical || 0,
    high: apiResponse.summary?.high || apiResponse.summary?.bySeverity?.high || 0,
    medium: apiResponse.summary?.medium || apiResponse.summary?.bySeverity?.medium || 0,
    low: apiResponse.summary?.low || apiResponse.summary?.bySeverity?.low || 0,
    info: apiResponse.summary?.info || apiResponse.summary?.bySeverity?.info || 0,
  };

  // Build byCategory from violations
  const byCategory: Record<string, number> = {};
  violations.forEach(v => {
    byCategory[v.category] = (byCategory[v.category] || 0) + 1;
  });

  // Build byRegulation from violations
  const byRegulation: Record<string, number> = {};
  violations.forEach(v => {
    v.regulations.forEach(r => {
      const regName = typeof r === 'string' ? r : r.regulation;
      byRegulation[regName] = (byRegulation[regName] || 0) + 1;
    });
  });

  return {
    success: apiResponse.success !== false,
    metadata: {
      scanId: apiResponse.scanId || `scan-${Date.now()}`,
      projectId: apiResponse.projectId || 'unknown',
      projectName: apiResponse.projectName || 'Project',
      timestamp: apiResponse.timestamp || new Date().toISOString(),
      duration: apiResponse.duration || 0,
      filesScanned: apiResponse.summary?.totalFiles || 0,
      filesSkipped: apiResponse.summary?.filesSkipped || 0,
      linesOfCode: apiResponse.summary?.linesOfCode || 0,
      scanType: apiResponse.scanType || 'full',
      triggeredBy: apiResponse.triggeredBy || 'manual',
      configuredRegulations: apiResponse.configuredRegulations || ['HIPAA'],
      minSeverity: apiResponse.minSeverity || 'low',
    },
    summary: {
      complianceScore: apiResponse.complianceScore || apiResponse.summary?.complianceScore || 100,
      previousScore: apiResponse.previousScore,
      trend: apiResponse.trend || 'stable',
      totalViolations: apiResponse.summary?.totalViolations || violations.length,
      bySeverity,
      byCategory,
      byRegulation,
      phiFieldsDetected: apiResponse.summary?.phiFieldsDetected || 0,
      auditGaps: apiResponse.summary?.auditGaps || 0,
    },
    violations,
    annotations,
    phiFields: apiResponse.phiFields || [],
    auditRequirements: apiResponse.auditRequirements || [],
    recommendations,
    regulatoryCoverage,
  };
}

function getRegulationFullName(regulation: string): string {
  const names: Record<string, string> = {
    'HIPAA': 'Health Insurance Portability and Accountability Act',
    'HITECH': 'Health Information Technology for Economic and Clinical Health Act',
    'HITRUST': 'HITRUST Common Security Framework',
    'FDA_21_CFR_11': 'FDA 21 CFR Part 11 - Electronic Records',
  };
  return names[regulation] || regulation;
}

function generateHTMLExport(result: ComplianceScanResult): string {
  return `<!DOCTYPE html>
<html><head><title>Compliance Report</title></head>
<body><h1>Compliance Report</h1><pre>${JSON.stringify(result, null, 2)}</pre></body>
</html>`;
}

function generateMarkdownExport(result: ComplianceScanResult): string {
  return `# Compliance Report\n\nScore: ${result.summary.complianceScore}/100\n\n## Violations\n\n${
    result.violations.map(v => `- [${v.severity}] ${v.rule} (${v.file}:${v.line})`).join('\n')
  }`;
}

export default ComplianceTab;
