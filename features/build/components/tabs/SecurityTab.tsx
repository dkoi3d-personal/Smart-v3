'use client';

import { useState } from 'react';
import {
  Shield,
  AlertCircle,
  LayoutGrid,
  AlertTriangle,
  FileText,
  RefreshCw,
  Loader2,
  Play,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SecurityMetrics, AgentMessage } from '../../types';
import {
  useSecurityMetrics,
  useAgentMessages,
  useAgentStatuses,
  useBuildPageStore,
} from '../../stores/useBuildPageStore';

interface SecurityTabProps {
  projectId: string;
  onSecurityMetricsChange: (metrics: SecurityMetrics) => void;
  onAddLog: (type: 'info' | 'success' | 'error', message: string) => void;
  terminalRef?: (el: HTMLDivElement | null) => void;
}

export function SecurityTab({
  projectId,
  onSecurityMetricsChange,
  onAddLog,
  terminalRef,
}: SecurityTabProps) {
  // Get state from store selectors
  const securityMetrics = useSecurityMetrics();
  const agentMessages = useAgentMessages();
  const agentStatuses = useAgentStatuses();
  const [isScanning, setIsScanning] = useState(false);
  const securityMessages = agentMessages.filter((m) => m.agentRole === 'security');
  const hasRunScan = securityMetrics.findings.total > 0 || securityMessages.length > 0;

  const handleScan = async () => {
    setIsScanning(true);
    try {
      onAddLog('info', 'Starting manual security scan...');
      const response = await fetch('/api/security/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, scanType: 'full' }),
      });
      if (response.ok) {
        const result = await response.json();
        const report = result.report || result;

        const vulns = report.vulnerabilities || [];
        const criticalCount = vulns.filter((v: any) => v.severity === 'critical').length;
        const highCount = vulns.filter((v: any) => v.severity === 'high').length;
        const mediumCount = vulns.filter((v: any) => v.severity === 'medium').length;
        const lowCount = vulns.filter((v: any) => v.severity === 'low').length;

        onSecurityMetricsChange({
          score: report.score ?? 100,
          grade: report.grade ?? 'A',
          riskLevel: report.riskLevel ?? 'low',
          findings: {
            critical: criticalCount,
            high: highCount,
            medium: mediumCount,
            low: lowCount,
            total: vulns.length,
          },
          owasp: report.owaspCompliance || {},
          breakdown: report.breakdown || { sast: 100, secrets: 100, dependencies: 100 },
          vulnerabilities: vulns.map((v: any) => ({
            severity: v.severity,
            file: v.file || '',
            line: v.line,
            type: v.title || v.category,
            description: v.description,
            remediation: v.recommendation,
            owasp: v.owasp,
            cwe: v.cwe,
          })),
          summary: report.summary,
          recommendations: (report.recommendations || []).map((r: any) =>
            typeof r === 'string'
              ? r
              : `[${r.priority?.toUpperCase() || 'INFO'}] ${r.title}: ${r.description}`
          ),
          categories: Array.isArray(report.categories)
            ? report.categories.reduce(
                (acc: Record<string, number>, c: any) => {
                  acc[c.name] = c.count;
                  return acc;
                },
                {}
              )
            : report.categories || {},
          scanDuration: report.scanDuration,
        });

        onAddLog('success', `Security scan complete: Grade ${report.grade}, ${vulns.length} findings`);
      } else {
        onAddLog('error', 'Security scan failed');
      }
    } catch (error: any) {
      onAddLog('error', `Security scan error: ${error.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Manual Security Scan Button - shown prominently when no scan has run */}
      {!hasRunScan && (
        <Card className="border-2 border-red-700 bg-red-950/30">
          <CardContent className="py-6 text-center">
            <Shield className="h-12 w-12 text-red-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-2">Security Scan</h3>
            <p className="text-sm text-gray-400 mb-4 max-w-md mx-auto">
              Security scanning is manual. Run a scan to analyze your code for vulnerabilities,
              check dependencies, and verify OWASP compliance.
            </p>
            <Button
              onClick={handleScan}
              disabled={isScanning}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2"
            >
              {isScanning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Security Scan
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Top Row - Security Metrics */}
      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        {/* Security Score Card */}
        <Card className="border-2 border-red-700 bg-red-950/30">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-xs font-bold text-red-400 flex items-center gap-2">
              <Shield className="h-3.5 w-3.5" />
              SECURITY SCORE
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-5 px-2 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-900/50"
                onClick={handleScan}
                disabled={isScanning}
              >
                {isScanning ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                {isScanning ? 'Scanning...' : 'Scan'}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="flex items-center gap-4 mb-2">
              <div
                className={cn(
                  'text-4xl font-black',
                  securityMetrics.grade === 'A'
                    ? 'text-green-400'
                    : securityMetrics.grade === 'B'
                    ? 'text-blue-400'
                    : securityMetrics.grade === 'C'
                    ? 'text-yellow-400'
                    : 'text-red-400'
                )}
              >
                {securityMetrics.grade}
              </div>
              <div className="flex-1">
                <div className="text-xl font-bold text-white">{securityMetrics.score}/100</div>
                <div
                  className={cn(
                    'text-sm uppercase font-semibold',
                    securityMetrics.riskLevel === 'low' || securityMetrics.riskLevel === 'minimal'
                      ? 'text-green-400'
                      : securityMetrics.riskLevel === 'medium'
                      ? 'text-yellow-400'
                      : 'text-red-400'
                  )}
                >
                  {securityMetrics.riskLevel} risk
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Findings Summary Card */}
        <Card className="border-2 border-orange-700 bg-orange-950/30">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-xs font-bold text-orange-400 flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5" />
              FINDINGS
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-red-900/50 rounded p-2">
                <div className="text-lg font-bold text-red-400">{securityMetrics.findings.critical}</div>
                <div className="text-[9px] text-gray-400">CRITICAL</div>
              </div>
              <div className="bg-orange-900/50 rounded p-2">
                <div className="text-lg font-bold text-orange-400">{securityMetrics.findings.high}</div>
                <div className="text-[9px] text-gray-400">HIGH</div>
              </div>
              <div className="bg-yellow-900/50 rounded p-2">
                <div className="text-lg font-bold text-yellow-400">{securityMetrics.findings.medium}</div>
                <div className="text-[9px] text-gray-400">MEDIUM</div>
              </div>
              <div className="bg-blue-900/50 rounded p-2">
                <div className="text-lg font-bold text-blue-400">{securityMetrics.findings.low}</div>
                <div className="text-[9px] text-gray-400">LOW</div>
              </div>
            </div>
            <div className="text-center mt-2 text-sm text-gray-400">
              {securityMetrics.findings.total} total findings
            </div>
          </CardContent>
        </Card>

        {/* Scan Breakdown Card */}
        <Card className="border-2 border-cyan-700 bg-cyan-950/30">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-xs font-bold text-cyan-400 flex items-center gap-2">
              <LayoutGrid className="h-3.5 w-3.5" />
              SCAN BREAKDOWN
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="space-y-2">
              {[
                { label: 'SAST Analysis', value: securityMetrics.breakdown.sast },
                { label: 'Secret Detection', value: securityMetrics.breakdown.secrets },
                { label: 'Dependencies', value: securityMetrics.breakdown.dependencies },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">{label}</span>
                    <span className="text-cyan-400 font-bold">{value}%</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        value >= 80 ? 'bg-green-500' : value >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      )}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* OWASP Quick Status */}
        <Card className="border-2 border-purple-700 bg-purple-950/30">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-xs font-bold text-purple-400 flex items-center gap-2">
              <Shield className="h-3.5 w-3.5" />
              OWASP TOP 10
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="grid grid-cols-2 gap-1 max-h-28 overflow-y-auto">
              {securityMetrics.owasp &&
                Object.entries(securityMetrics.owasp).map(([id, data]) => (
                  <div
                    key={id}
                    className="flex items-center justify-between text-xs bg-gray-800/50 rounded px-1.5 py-0.5"
                  >
                    <span className="text-gray-400 truncate text-[10px]" title={data.name}>
                      {id.replace(':2021', '')}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[9px] px-1 h-4',
                        data.status === 'pass'
                          ? 'border-green-700 text-green-400'
                          : data.status === 'fail'
                          ? 'border-red-700 text-red-400'
                          : 'border-yellow-700 text-yellow-400'
                      )}
                    >
                      {data.status === 'pass' ? '✓' : data.status === 'fail' ? '✗' : '⚠'} {data.findings}
                    </Badge>
                  </div>
                ))}
              {(!securityMetrics.owasp || Object.keys(securityMetrics.owasp).length === 0) && (
                <div className="col-span-2 text-xs text-gray-500 text-center py-2">
                  Run a security scan to see OWASP compliance
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vulnerabilities List */}
      {securityMetrics.vulnerabilities && securityMetrics.vulnerabilities.length > 0 && (
        <Card className="border-2 border-red-700 bg-red-950/30 flex-shrink-0">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-xs font-bold text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5" />
              VULNERABILITIES ({securityMetrics.vulnerabilities.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {securityMetrics.vulnerabilities.slice(0, 10).map((vuln, i) => (
                <div key={i} className="flex items-start gap-2 text-xs bg-gray-800/50 rounded p-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[9px] px-1 shrink-0',
                      vuln.severity === 'critical'
                        ? 'border-red-500 text-red-400'
                        : vuln.severity === 'high'
                        ? 'border-orange-500 text-orange-400'
                        : vuln.severity === 'medium'
                        ? 'border-yellow-500 text-yellow-400'
                        : 'border-blue-500 text-blue-400'
                    )}
                  >
                    {vuln.severity.toUpperCase()}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-200 truncate">
                      {vuln.type || vuln.description?.slice(0, 50)}
                    </div>
                    <div className="text-gray-500 truncate">
                      {vuln.file}
                      {vuln.line ? `:${vuln.line}` : ''}
                    </div>
                  </div>
                  {vuln.owasp && <span className="text-[9px] text-purple-400">{vuln.owasp}</span>}
                </div>
              ))}
              {securityMetrics.vulnerabilities.length > 10 && (
                <div className="text-xs text-gray-500 text-center">
                  +{securityMetrics.vulnerabilities.length - 10} more vulnerabilities
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Summary & Recommendations */}
      {securityMetrics.recommendations && securityMetrics.recommendations.length > 0 && (
        <Card className="border-2 border-purple-700 bg-purple-950/30 flex-shrink-0">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-xs font-bold text-purple-400 flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" />
              SECURITY SUMMARY & RECOMMENDATIONS
              {securityMetrics.scanDuration && (
                <span className="ml-auto text-[10px] text-gray-500 font-normal">
                  Scan completed in {(securityMetrics.scanDuration / 1000).toFixed(1)}s
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="grid grid-cols-2 gap-4">
              {/* Categories breakdown */}
              {securityMetrics.categories && Object.keys(securityMetrics.categories).length > 0 && (
                <div>
                  <div className="text-xs text-gray-400 mb-2 font-semibold">Findings by Category:</div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(securityMetrics.categories).map(([cat, count]) => (
                      <span
                        key={cat}
                        className="px-2 py-1 text-xs bg-purple-900/50 text-purple-300 rounded"
                      >
                        {cat.replace(/_/g, ' ')}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {/* Recommendations */}
              <div>
                <div className="text-xs text-gray-400 mb-2 font-semibold">Recommendations:</div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {securityMetrics.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className="text-purple-400 mt-0.5">•</span>
                      <span className="text-gray-300">{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Agent Terminal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 rounded-t border-2 border-b-0 border-red-700 bg-red-950/50">
          <Shield className="h-4 w-4 text-red-400" />
          <span className="text-sm font-semibold text-red-400">Security Agent Output</span>
          {agentStatuses.get('security') === 'working' && (
            <Loader2 className="h-3 w-3 animate-spin text-red-400" />
          )}
          <div className="ml-auto flex items-center gap-2">
            {securityMetrics.findings.total > 0 && (
              <Badge
                variant="outline"
                className={cn(
                  'text-xs',
                  securityMetrics.findings.critical > 0
                    ? 'border-red-500 text-red-400'
                    : 'border-yellow-700 text-yellow-400'
                )}
              >
                {securityMetrics.findings.total} findings
              </Badge>
            )}
          </div>
        </div>
        <div
          className="flex-1 min-h-0 bg-gray-900 border-2 border-t-0 border-red-700 rounded-b overflow-y-auto"
          ref={terminalRef}
        >
          <div className="p-4 font-mono text-sm leading-relaxed">
            {securityMessages.length === 0 ? (
              <div className="text-gray-600">
                <span className="text-red-500">$</span> Waiting for security scan...
              </div>
            ) : (
              securityMessages.map((msg) => (
                <div key={msg.id} className="mb-3">
                  {msg.type === 'action' && msg.toolName && (
                    <span className="text-yellow-400 font-bold">[{msg.toolName}] </span>
                  )}
                  <span
                    className={
                      msg.type === 'error'
                        ? 'text-red-400'
                        : msg.type === 'result'
                        ? 'text-cyan-400 whitespace-pre-wrap'
                        : msg.type === 'thinking'
                        ? 'text-gray-500 italic'
                        : 'text-red-300 whitespace-pre-wrap'
                    }
                  >
                    {msg.content}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
