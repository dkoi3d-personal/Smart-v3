'use client';

import { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { useProjectStore } from '@/stores/project-store';
import { cn, getSeverityColor } from '@/lib/utils';

export function SecurityScanner() {
  const { project } = useProjectStore();
  const security = project?.securityReport;

  const severityIcons = {
    critical: AlertCircle,
    high: AlertTriangle,
    medium: AlertTriangle,
    low: Info,
    info: Info,
  };

  const getSeverityCount = (severity: string) => {
    return security?.vulnerabilities.filter((v) => v.severity === severity).length || 0;
  };

  return (
    <>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security Scanner
          </CardTitle>
          {security && (
            <Badge
              variant={security.grade === 'A' || security.grade === 'B' ? 'default' : 'destructive'}
            >
              Grade {security.grade}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col gap-2 min-h-0">
        {security ? (
          <>
            {/* Severity Summary */}
            <div className="grid grid-cols-2 gap-1 text-xs">
              {(['critical', 'high', 'medium', 'low'] as const).map((severity) => {
                const count = getSeverityCount(severity);
                const Icon = severityIcons[severity];

                return (
                  <div
                    key={severity}
                    className={cn('flex items-center gap-1 p-1.5 rounded border', getSeverityColor(severity))}
                  >
                    <Icon className="h-3 w-3" />
                    <span className="font-medium">{count}</span>
                    <span className="capitalize">{severity}</span>
                  </div>
                );
              })}
            </div>

            {/* Score */}
            <div className="flex items-center justify-between p-2 bg-muted rounded">
              <span className="text-xs text-muted-foreground">Security Score</span>
              <span className="text-lg font-bold">{security.score}/100</span>
            </div>

            {/* Vulnerabilities List */}
            <ScrollArea className="flex-1">
              <div className="space-y-1">
                {security.vulnerabilities.length === 0 ? (
                  <div className="text-xs text-center text-muted-foreground py-4">
                    No vulnerabilities found
                  </div>
                ) : (
                  security.vulnerabilities.map((vuln) => {
                    const Icon = severityIcons[vuln.severity];

                    return (
                      <div
                        key={vuln.id}
                        className={cn('p-2 rounded border text-xs', getSeverityColor(vuln.severity))}
                      >
                        <div className="flex items-start gap-2">
                          <Icon className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{vuln.title}</p>
                            <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2">
                              {vuln.description}
                            </p>
                            {vuln.file && (
                              <p className="text-xs mt-1 font-mono">
                                {vuln.file}:{vuln.line}
                              </p>
                            )}
                            {vuln.autoFixAvailable && (
                              <Badge variant="outline" className="mt-1">
                                Auto-fix available
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
            No scan performed yet
          </div>
        )}
      </CardContent>
    </>
  );
}
