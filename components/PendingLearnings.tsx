'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Sparkles,
  Brain,
  ChevronDown,
  ChevronUp,
  Trash2,
  Bot,
  Code,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PendingLearning {
  pendingId: string;
  type: string;
  category: string;
  title: string;
  description: string;
  solution?: string;
  severity: 'info' | 'warning' | 'critical';
  tags: string[];
  source: string;
  confidence: number;
  status: 'pending' | 'approved' | 'rejected' | 'merged';
  detectedAt: string;
  sourceContext?: {
    agentId?: string;
    storyId?: string;
    projectId?: string;
    outputSnippet?: string;
  };
}

interface PendingLearningsStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  bySource: Record<string, number>;
  avgConfidence: number;
}

const SEVERITY_COLORS = {
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
};

const SEVERITY_ICONS = {
  info: <Eye className="h-3 w-3" />,
  warning: <AlertTriangle className="h-3 w-3" />,
  critical: <AlertTriangle className="h-3 w-3" />,
};

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  agent_output: <Bot className="h-4 w-4" />,
  error_extraction: <AlertTriangle className="h-4 w-4" />,
  pattern_detection: <Code className="h-4 w-4" />,
  manual: <Brain className="h-4 w-4" />,
};

interface PendingLearningsProps {
  className?: string;
  onLearningApproved?: () => void;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export default function PendingLearnings({
  className,
  onLearningApproved,
  autoRefresh = true,
  refreshInterval = 10000,
}: PendingLearningsProps) {
  const [learnings, setLearnings] = useState<PendingLearning[]>([]);
  const [stats, setStats] = useState<PendingLearningsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchPendingLearnings = useCallback(async () => {
    try {
      const response = await fetch('/api/learnings/pending?status=pending');
      if (response.ok) {
        const data = await response.json();
        setLearnings(data.learnings || []);
        setStats(data.stats || null);
      }
    } catch (error) {
      console.error('Failed to fetch pending learnings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingLearnings();

    if (autoRefresh) {
      const interval = setInterval(fetchPendingLearnings, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchPendingLearnings, autoRefresh, refreshInterval]);

  const handleApprove = async (pendingId: string) => {
    setProcessingId(pendingId);
    try {
      const response = await fetch(`/api/learnings/pending/${pendingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });

      if (response.ok) {
        setLearnings(prev => prev.filter(l => l.pendingId !== pendingId));
        onLearningApproved?.();
      }
    } catch (error) {
      console.error('Failed to approve learning:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (pendingId: string) => {
    setProcessingId(pendingId);
    try {
      const response = await fetch(`/api/learnings/pending/${pendingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      });

      if (response.ok) {
        setLearnings(prev => prev.filter(l => l.pendingId !== pendingId));
      }
    } catch (error) {
      console.error('Failed to reject learning:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Clear all pending learnings?')) return;

    try {
      const response = await fetch('/api/learnings/pending?status=pending', {
        method: 'DELETE',
      });
      if (response.ok) {
        setLearnings([]);
        fetchPendingLearnings();
      }
    } catch (error) {
      console.error('Failed to clear learnings:', error);
    }
  };

  const formatConfidence = (confidence: number) => {
    return `${Math.round(confidence * 100)}%`;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-500';
    if (confidence >= 0.5) return 'text-amber-500';
    return 'text-red-500';
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Loading pending learnings...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('border-amber-500/30', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-lg">Pending Learnings</CardTitle>
            {stats && stats.pending > 0 && (
              <Badge variant="secondary">{stats.pending} awaiting review</Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={fetchPendingLearnings}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            {learnings.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClearAll}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <CardDescription>
          AI-detected patterns and solutions from agent activity. Review and save the useful ones.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {learnings.length === 0 ? (
          <div className="text-center py-8">
            <Brain className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              No pending learnings detected yet.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Run agents to automatically capture error patterns and solutions.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {learnings.map((learning) => (
              <div
                key={learning.pendingId}
                className={cn(
                  'border rounded-lg overflow-hidden transition-colors',
                  expandedId === learning.pendingId ? 'border-amber-500/50' : 'border-border'
                )}
              >
                {/* Header */}
                <div
                  className="p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() =>
                    setExpandedId(expandedId === learning.pendingId ? null : learning.pendingId)
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge className={`${SEVERITY_COLORS[learning.severity]} text-white`}>
                          {SEVERITY_ICONS[learning.severity]}
                          <span className="ml-1">{learning.severity}</span>
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {learning.type}
                        </Badge>
                        <span
                          className={cn(
                            'text-xs font-medium',
                            getConfidenceColor(learning.confidence)
                          )}
                        >
                          {formatConfidence(learning.confidence)} confidence
                        </span>
                      </div>
                      <h4 className="font-medium text-sm truncate">{learning.title}</h4>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {SOURCE_ICONS[learning.source] || <Brain className="h-3 w-3" />}
                        <span>{learning.source.replace('_', ' ')}</span>
                        {learning.sourceContext?.projectId && (
                          <>
                            <span>|</span>
                            <span>{learning.sourceContext.projectId}</span>
                          </>
                        )}
                        <span>|</span>
                        <Clock className="h-3 w-3" />
                        <span>{new Date(learning.detectedAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {expandedId === learning.pendingId ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedId === learning.pendingId && (
                  <div className="border-t p-3 bg-muted/10">
                    <div className="space-y-3">
                      <div>
                        <h5 className="text-xs font-medium text-muted-foreground mb-1">
                          Description
                        </h5>
                        <p className="text-sm">{learning.description}</p>
                      </div>

                      {learning.solution && (
                        <div>
                          <h5 className="text-xs font-medium text-muted-foreground mb-1">
                            Solution
                          </h5>
                          <div className="bg-muted rounded p-2">
                            <pre className="text-xs whitespace-pre-wrap font-mono">
                              {learning.solution}
                            </pre>
                          </div>
                        </div>
                      )}

                      {learning.sourceContext?.outputSnippet && (
                        <div>
                          <h5 className="text-xs font-medium text-muted-foreground mb-1">
                            Source Output
                          </h5>
                          <div className="bg-muted rounded p-2 max-h-32 overflow-auto">
                            <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground">
                              {learning.sourceContext.outputSnippet}
                            </pre>
                          </div>
                        </div>
                      )}

                      {learning.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {learning.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-green-600 hover:bg-green-700"
                          disabled={processingId === learning.pendingId}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApprove(learning.pendingId);
                          }}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Save Learning
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={processingId === learning.pendingId}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReject(learning.pendingId);
                          }}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Dismiss
                        </Button>
                        {processingId === learning.pendingId && (
                          <RefreshCw className="h-4 w-4 animate-spin ml-2" />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Stats Summary */}
        {stats && stats.total > 0 && (
          <div className="mt-4 pt-3 border-t">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Avg confidence: {formatConfidence(stats.avgConfidence)}</span>
              {Object.entries(stats.bySource).map(([source, count]) => (
                <span key={source}>
                  {source.replace('_', ' ')}: {count}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
