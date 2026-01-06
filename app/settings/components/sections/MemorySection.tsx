'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Brain,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Code,
  Lightbulb,
  BookOpen,
  Shield,
  Trash2,
  Database,
  TrendingUp,
} from 'lucide-react';

interface Stats {
  total: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  topTags: Array<{ tag: string; count: number }>;
  recentCount: number;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  'gotcha': <AlertTriangle className="h-4 w-4" />,
  'pattern': <Code className="h-4 w-4" />,
  'workaround': <Lightbulb className="h-4 w-4" />,
  'best-practice': <BookOpen className="h-4 w-4" />,
  'error-solution': <Shield className="h-4 w-4" />,
};

const TYPE_COLORS: Record<string, string> = {
  'gotcha': 'bg-amber-500',
  'pattern': 'bg-blue-500',
  'anti-pattern': 'bg-red-500',
  'library-issue': 'bg-orange-500',
  'workaround': 'bg-purple-500',
  'best-practice': 'bg-green-500',
  'error-solution': 'bg-cyan-500',
  'config': 'bg-gray-500',
};

export function MemorySection() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/learnings/stats');
      const data = await response.json();
      if (data.total !== undefined) {
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear ALL learnings? This cannot be undone.')) return;

    setClearing(true);
    try {
      await fetch('/api/learnings/clear', { method: 'DELETE' });
      await fetchStats();
    } catch (error) {
      console.error('Failed to clear learnings:', error);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-500" />
            Agent Memory
          </h2>
          <p className="text-muted-foreground mt-1">
            Cross-project knowledge and learnings database
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchStats} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link href="/learnings">
            <Button>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Full View
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Database className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats?.total || 0}</div>
                <div className="text-sm text-muted-foreground">Total Learnings</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats?.recentCount || 0}</div>
                <div className="text-sm text-muted-foreground">Last 7 Days</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats?.bySeverity?.critical || 0}</div>
                <div className="text-sm text-muted-foreground">Critical Issues</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Brain className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats?.topTags?.length || 0}</div>
                <div className="text-sm text-muted-foreground">Unique Tags</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Types Distribution */}
      {stats && stats.byType && Object.keys(stats.byType).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Learnings by Type</CardTitle>
            <CardDescription>Distribution of knowledge across categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byType).map(([type, count]) => (
                <Badge
                  key={type}
                  variant="secondary"
                  className="px-3 py-1.5"
                >
                  {TYPE_ICONS[type] || <Code className="h-4 w-4" />}
                  <span className="ml-1.5 capitalize">{type.replace('-', ' ')}</span>
                  <span className="ml-2 font-bold text-primary">{count}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Tags */}
      {stats && stats.topTags && stats.topTags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Popular Tags</CardTitle>
            <CardDescription>Most frequently used knowledge tags</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.topTags.slice(0, 15).map(({ tag, count }) => (
                <Badge key={tag} variant="outline" className="px-3 py-1.5">
                  {tag}
                  <span className="ml-2 text-muted-foreground">({count})</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* About Memory */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About Agent Memory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Agent Memory is a cross-project knowledge base that helps AI agents learn from past experiences.
            As agents work on projects, they automatically capture:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Error Solutions</strong> - How to fix common errors</li>
            <li><strong>Patterns</strong> - Successful code patterns</li>
            <li><strong>Gotchas</strong> - Tricky issues to watch out for</li>
            <li><strong>Best Practices</strong> - Recommended approaches</li>
            <li><strong>Workarounds</strong> - Temporary fixes for known issues</li>
          </ul>
          <p>
            This knowledge is automatically applied to future projects, helping agents avoid
            repeating mistakes and follow proven patterns.
          </p>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-500/50">
        <CardHeader>
          <CardTitle className="text-lg text-red-500">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Clear All Learnings</p>
              <p className="text-sm text-muted-foreground">
                Delete all learnings from the database. This cannot be undone.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={handleClearAll}
              disabled={clearing || !stats?.total}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {clearing ? 'Clearing...' : 'Clear All'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
