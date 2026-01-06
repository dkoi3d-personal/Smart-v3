'use client';

import { useState } from 'react';
import { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Shield,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  Clock,
  TrendingUp,
  Package,
  Key,
  Code2,
  RefreshCw,
  ChevronRight,
  Zap,
  Heart,
  Lock,
  FileCheck,
  ShieldCheck,
  Database,
  Eye,
  UserCheck,
} from 'lucide-react';
import { useProjectStore } from '@/stores/project-store';
import { cn } from '@/lib/utils';

// Grade color mapping
const gradeColors: Record<string, string> = {
  A: 'bg-green-500 text-white',
  B: 'bg-green-400 text-white',
  C: 'bg-yellow-500 text-white',
  D: 'bg-orange-500 text-white',
  F: 'bg-red-500 text-white',
};

// Risk level colors
const riskColors: Record<string, string> = {
  minimal: 'text-green-500 bg-green-500/10 border-green-500/30',
  low: 'text-green-400 bg-green-400/10 border-green-400/30',
  medium: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30',
  high: 'text-orange-500 bg-orange-500/10 border-orange-500/30',
  critical: 'text-red-500 bg-red-500/10 border-red-500/30',
};

// Severity styling
const severityConfig = {
  critical: {
    icon: AlertOctagon,
    color: 'text-red-500',
    bg: 'bg-red-500/10 border-red-500/30',
  },
  high: {
    icon: AlertCircle,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10 border-orange-500/30',
  },
  medium: {
    icon: AlertTriangle,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10 border-yellow-500/30',
  },
  low: {
    icon: Info,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10 border-blue-400/30',
  },
  info: {
    icon: Info,
    color: 'text-gray-400',
    bg: 'bg-gray-400/10 border-gray-400/30',
  },
};

// OWASP status icons
const owaspStatusIcons = {
  pass: { icon: CheckCircle2, color: 'text-green-500' },
  fail: { icon: XCircle, color: 'text-red-500' },
  warning: { icon: AlertTriangle, color: 'text-yellow-500' },
  unknown: { icon: Info, color: 'text-gray-400' },
};

// HIPAA compliance categories for healthcare
const hipaaCategories = [
  { id: 'phi-encryption', name: 'PHI Encryption', icon: Lock, description: 'Patient data encrypted at rest and in transit' },
  { id: 'access-control', name: 'Access Controls', icon: UserCheck, description: 'Role-based access to patient records' },
  { id: 'audit-logging', name: 'Audit Logging', icon: FileCheck, description: 'All PHI access is logged and traceable' },
  { id: 'data-integrity', name: 'Data Integrity', icon: Database, description: 'Patient data protected from unauthorized modification' },
  { id: 'transmission-security', name: 'Transmission Security', icon: ShieldCheck, description: 'Secure communication channels for PHI' },
  { id: 'minimum-necessary', name: 'Minimum Necessary', icon: Eye, description: 'Only required PHI is exposed in APIs' },
];

export function DevSecOpsDashboard() {
  const { project, setSecurityReport } = useProjectStore();
  const security = project?.securityReport;
  const [isScanning, setIsScanning] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [scanError, setScanError] = useState<string | null>(null);

  // Handle scan trigger - calls actual security scan API
  const handleScan = async () => {
    if (!project?.projectId) {
      setScanError('No project selected');
      return;
    }

    setIsScanning(true);
    setScanError(null);

    try {
      const response = await fetch('/api/security/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.projectId,
          scanType: 'comprehensive'
        }),
      });

      if (!response.ok) {
        throw new Error('Security scan failed');
      }

      const result = await response.json();
      if (result.report) {
        setSecurityReport(result.report);
      }
    } catch (error) {
      console.error('Security scan error:', error);
      setScanError(error instanceof Error ? error.message : 'Scan failed');
    } finally {
      setIsScanning(false);
    }
  };

  // Calculate HIPAA compliance score from vulnerabilities
  const getHipaaStatus = (categoryId: string): 'pass' | 'warning' | 'fail' | 'unknown' => {
    if (!security?.vulnerabilities) return 'unknown';

    const hipaaVulns = security.vulnerabilities.filter(v =>
      v.category?.toLowerCase().includes('phi') ||
      v.category?.toLowerCase().includes('hipaa') ||
      v.category?.toLowerCase().includes('encryption') ||
      v.category?.toLowerCase().includes('auth') ||
      v.description?.toLowerCase().includes('patient') ||
      v.description?.toLowerCase().includes('health')
    );

    if (hipaaVulns.length === 0) return 'pass';
    if (hipaaVulns.some(v => v.severity === 'critical' || v.severity === 'high')) return 'fail';
    if (hipaaVulns.some(v => v.severity === 'medium')) return 'warning';
    return 'pass';
  };

  // Calculate score ring color
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'stroke-green-500';
    if (score >= 80) return 'stroke-green-400';
    if (score >= 70) return 'stroke-yellow-500';
    if (score >= 60) return 'stroke-orange-500';
    return 'stroke-red-500';
  };

  // Score circle component
  const ScoreCircle = ({ score, size = 120 }: { score: number; size?: number }) => {
    const radius = (size - 12) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    return (
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/30"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn('transition-all duration-500', getScoreColor(score))}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold">{score}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>
    );
  };

  if (!security) {
    return (
      <>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-500" />
              Healthcare Security
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
          <div className="relative">
            <Shield className="h-12 w-12 text-blue-500/30" />
            <Heart className="h-5 w-5 text-red-500 absolute -bottom-1 -right-1" />
          </div>
          <div>
            <p className="text-sm font-medium">HIPAA Security Scan Required</p>
            <p className="text-xs text-muted-foreground mt-1">
              Scan your healthcare application for PHI vulnerabilities
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full max-w-[200px]">
            <Button
              size="sm"
              onClick={handleScan}
              disabled={isScanning || !project?.projectId}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              {isScanning ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Scanning PHI...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3 w-3" />
                  Run HIPAA Scan
                </>
              )}
            </Button>
            {scanError && (
              <p className="text-xs text-red-500">{scanError}</p>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground mt-2 space-y-1">
            <p>Checks for:</p>
            <div className="flex flex-wrap gap-1 justify-center">
              <Badge variant="outline" className="text-[9px]">PHI Encryption</Badge>
              <Badge variant="outline" className="text-[9px]">Access Control</Badge>
              <Badge variant="outline" className="text-[9px]">Audit Logs</Badge>
              <Badge variant="outline" className="text-[9px]">Data Integrity</Badge>
            </div>
          </div>
        </CardContent>
      </>
    );
  }

  return (
    <>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Heart className="h-4 w-4 text-red-500" />
            Healthcare Security
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={cn('text-xs font-bold', gradeColors[security.grade])}>
              {security.grade}
            </Badge>
            <Badge variant="outline" className={cn('text-xs', riskColors[security.riskLevel || 'medium'])}>
              {security.riskLevel || 'Unknown'}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={handleScan}
              disabled={isScanning}
              title="Run Security Scan"
            >
              <RefreshCw className={cn('h-3 w-3', isScanning && 'animate-spin')} />
            </Button>
          </div>
        </div>
        {scanError && (
          <p className="text-xs text-red-500 mt-1">{scanError}</p>
        )}
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden flex flex-col gap-3 min-h-0 pt-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-4 h-8">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="findings" className="text-xs">
              Findings
              {security.vulnerabilities.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-4 w-4 p-0 text-[9px] flex items-center justify-center">
                  {security.vulnerabilities.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="hipaa" className="text-xs">HIPAA</TabsTrigger>
            <TabsTrigger value="actions" className="text-xs">Actions</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="flex-1 mt-2 space-y-3 overflow-auto">
            {/* Score and Risk */}
            <div className="flex items-center justify-between gap-4">
              <ScoreCircle score={security.score} size={100} />
              <div className="flex-1 space-y-2">
                <div className={cn('p-2 rounded border text-center', riskColors[security.riskLevel || 'medium'])}>
                  <p className="text-[10px] uppercase tracking-wide opacity-70">Risk Level</p>
                  <p className="font-bold capitalize">{security.riskLevel || 'Unknown'}</p>
                </div>
                {security.scanDuration && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground justify-center">
                    <Clock className="h-3 w-3" />
                    {(security.scanDuration / 1000).toFixed(1)}s scan
                  </div>
                )}
              </div>
            </div>

            {/* Findings Summary */}
            <div className="grid grid-cols-2 gap-1.5">
              {(['critical', 'high', 'medium', 'low'] as const).map((severity) => {
                const config = severityConfig[severity];
                const Icon = config.icon;
                const count = security.summary?.[`${severity}Findings` as keyof typeof security.summary] ||
                              security.vulnerabilities.filter((v) => v.severity === severity).length;

                return (
                  <div
                    key={severity}
                    className={cn('flex items-center gap-1.5 p-2 rounded border', config.bg)}
                  >
                    <Icon className={cn('h-3.5 w-3.5', config.color)} />
                    <span className="font-bold">{count}</span>
                    <span className="text-xs capitalize">{severity}</span>
                  </div>
                );
              })}
            </div>

            {/* Breakdown Scores */}
            {security.breakdown && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Scan Breakdown</p>
                <div className="space-y-1.5">
                  {[
                    { label: 'SAST', score: security.breakdown.sast, icon: Code2 },
                    { label: 'Secrets', score: security.breakdown.secrets, icon: Key },
                    { label: 'Dependencies', score: security.breakdown.dependencies, icon: Package },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <item.icon className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs w-20">{item.label}</span>
                      <Progress value={item.score} className="flex-1 h-1.5" />
                      <span className="text-xs font-mono w-8 text-right">{item.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Auto-fixable */}
            {security.summary?.fixableFindings > 0 && (
              <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/30 rounded text-xs">
                <Zap className="h-3.5 w-3.5 text-green-500" />
                <span className="text-green-500 font-medium">
                  {security.summary.fixableFindings} auto-fixable issues
                </span>
              </div>
            )}
          </TabsContent>

          {/* HIPAA Tab */}
          <TabsContent value="hipaa" className="flex-1 mt-2 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="space-y-3">
                {/* HIPAA Header */}
                <div className="flex items-center gap-2 p-2 bg-blue-500/10 border border-blue-500/30 rounded">
                  <ShieldCheck className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-xs font-medium">HIPAA Security Rule Compliance</p>
                    <p className="text-[10px] text-muted-foreground">45 CFR Parts 160, 162, and 164</p>
                  </div>
                </div>

                {/* PHI Protection Status */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">PHI Protection Checklist</p>
                  {hipaaCategories.map((cat) => {
                    const status = getHipaaStatus(cat.id);
                    const statusConfig = owaspStatusIcons[status];
                    const StatusIcon = statusConfig.icon;
                    const CategoryIcon = cat.icon;

                    return (
                      <div
                        key={cat.id}
                        className={cn(
                          'flex items-center gap-2 p-2 rounded border text-xs',
                          status === 'pass' && 'bg-green-500/5 border-green-500/20',
                          status === 'fail' && 'bg-red-500/10 border-red-500/30',
                          status === 'warning' && 'bg-yellow-500/10 border-yellow-500/30',
                          status === 'unknown' && 'bg-muted/30 border-muted'
                        )}
                      >
                        <CategoryIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{cat.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{cat.description}</p>
                        </div>
                        <StatusIcon className={cn('h-4 w-4 flex-shrink-0', statusConfig.color)} />
                      </div>
                    );
                  })}
                </div>

                {/* PHI-related vulnerabilities */}
                {security.vulnerabilities.filter(v =>
                  v.category?.toLowerCase().includes('phi') ||
                  v.description?.toLowerCase().includes('patient') ||
                  v.description?.toLowerCase().includes('health') ||
                  v.category?.toLowerCase().includes('hipaa')
                ).length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-red-500 flex items-center gap-1">
                      <AlertOctagon className="h-3.5 w-3.5" />
                      PHI Security Issues Found
                    </p>
                    {security.vulnerabilities
                      .filter(v =>
                        v.category?.toLowerCase().includes('phi') ||
                        v.description?.toLowerCase().includes('patient') ||
                        v.description?.toLowerCase().includes('health') ||
                        v.category?.toLowerCase().includes('hipaa')
                      )
                      .slice(0, 5)
                      .map((vuln) => {
                        const config = severityConfig[vuln.severity] || severityConfig.info;
                        const Icon = config.icon;
                        return (
                          <div key={vuln.id} className={cn('p-2 rounded border text-xs', config.bg)}>
                            <div className="flex items-start gap-2">
                              <Icon className={cn('h-3 w-3 mt-0.5 flex-shrink-0', config.color)} />
                              <div>
                                <p className="font-medium">{vuln.title}</p>
                                <p className="text-[10px] text-muted-foreground">{vuln.file}:{vuln.line}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Findings Tab */}
          <TabsContent value="findings" className="flex-1 mt-2 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="space-y-1.5">
                {security.vulnerabilities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
                    <p className="text-sm font-medium">No Vulnerabilities Found</p>
                    <p className="text-xs text-muted-foreground">Your code looks secure!</p>
                  </div>
                ) : (
                  security.vulnerabilities.map((vuln) => {
                    const config = severityConfig[vuln.severity] || severityConfig.info;
                    const Icon = config.icon;

                    return (
                      <div
                        key={vuln.id}
                        className={cn('p-2 rounded border', config.bg)}
                      >
                        <div className="flex items-start gap-2">
                          <Icon className={cn('h-3.5 w-3.5 mt-0.5 flex-shrink-0', config.color)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{vuln.title}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                              {vuln.description}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {vuln.file && (
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  {vuln.file}:{vuln.line}
                                </span>
                              )}
                              {vuln.category && (
                                <Badge variant="outline" className="h-4 text-[9px]">
                                  {vuln.category}
                                </Badge>
                              )}
                              {vuln.cwe && (
                                <Badge variant="outline" className="h-4 text-[9px]">
                                  {vuln.cwe}
                                </Badge>
                              )}
                              {vuln.autoFixAvailable && (
                                <Badge className="h-4 text-[9px] bg-green-500/20 text-green-500 border-green-500/30">
                                  Auto-fix
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Actions Tab */}
          <TabsContent value="actions" className="flex-1 mt-2 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Recommended Actions</p>
                {security.recommendations && security.recommendations.length > 0 ? (
                  security.recommendations.map((rec, idx) => {
                    const priorityConfig = {
                      critical: { color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/30' },
                      high: { color: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/30' },
                      medium: { color: 'text-yellow-500', bg: 'bg-yellow-500/10 border-yellow-500/30' },
                      low: { color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/30' },
                    }[rec.priority];

                    const effortBadge = {
                      low: 'Quick Fix',
                      medium: 'Moderate',
                      high: 'Complex',
                    }[rec.effort];

                    return (
                      <div
                        key={idx}
                        className={cn('p-2.5 rounded border', priorityConfig.bg)}
                      >
                        <div className="flex items-start gap-2">
                          <ChevronRight className={cn('h-3.5 w-3.5 mt-0.5', priorityConfig.color)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-xs font-medium">{rec.title}</p>
                              <Badge variant="outline" className="h-4 text-[9px] capitalize">
                                {effortBadge}
                              </Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground">{rec.description}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <TrendingUp className="h-8 w-8 text-green-500 mb-2" />
                    <p className="text-sm font-medium">All Good!</p>
                    <p className="text-xs text-muted-foreground">No critical actions needed</p>
                  </div>
                )}

                {/* Categories breakdown if available */}
                {security.categories && security.categories.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Findings by Category</p>
                    <div className="space-y-1">
                      {security.categories.map((cat, idx) => {
                        const config = severityConfig[cat.severity];
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-1.5 rounded bg-muted/30"
                          >
                            <span className="text-xs">{cat.name}</span>
                            <Badge variant="outline" className={cn('h-5 text-[10px]', config.color)}>
                              {cat.count}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </>
  );
}
