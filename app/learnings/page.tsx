'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Brain,
  Search,
  Plus,
  ThumbsUp,
  ThumbsDown,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Info,
  AlertCircle,
  BookOpen,
  Lightbulb,
  Bug,
  Code,
  Shield,
  Settings,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  Tag,
  Sparkles,
} from 'lucide-react';
import PendingLearnings from '@/components/PendingLearnings';

// Types matching learning-store.ts
type LearningType = 'gotcha' | 'pattern' | 'anti-pattern' | 'library-issue' | 'workaround' | 'best-practice' | 'error-solution' | 'config';
type Severity = 'info' | 'warning' | 'critical';

interface Learning {
  id: number;
  type: LearningType;
  title: string;
  description: string;
  solution?: string;
  tags: string[];
  severity: Severity;
  projectName?: string;
  source?: string;
  createdAt: string;
  helpfulCount: number;
  notHelpfulCount: number;
}

interface Stats {
  total: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  topTags: Array<{ tag: string; count: number }>;
  recentCount: number;
}

const TYPE_ICONS: Record<LearningType, React.ReactNode> = {
  'gotcha': <AlertTriangle className="h-4 w-4" />,
  'pattern': <Code className="h-4 w-4" />,
  'anti-pattern': <X className="h-4 w-4" />,
  'library-issue': <Bug className="h-4 w-4" />,
  'workaround': <Lightbulb className="h-4 w-4" />,
  'best-practice': <BookOpen className="h-4 w-4" />,
  'error-solution': <Shield className="h-4 w-4" />,
  'config': <Settings className="h-4 w-4" />,
};

const TYPE_COLORS: Record<LearningType, string> = {
  'gotcha': 'bg-amber-500',
  'pattern': 'bg-blue-500',
  'anti-pattern': 'bg-red-500',
  'library-issue': 'bg-orange-500',
  'workaround': 'bg-purple-500',
  'best-practice': 'bg-green-500',
  'error-solution': 'bg-cyan-500',
  'config': 'bg-gray-500',
};

const SEVERITY_COLORS: Record<Severity, string> = {
  'info': 'bg-blue-500',
  'warning': 'bg-amber-500',
  'critical': 'bg-red-500',
};

const SEVERITY_ICONS: Record<Severity, React.ReactNode> = {
  'info': <Info className="h-3 w-3" />,
  'warning': <AlertTriangle className="h-3 w-3" />,
  'critical': <AlertCircle className="h-3 w-3" />,
};

export default function LearningsPage() {
  const [learnings, setLearnings] = useState<Learning[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<LearningType | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
  const [tagFilter, setTagFilter] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // New learning form state
  const [newLearning, setNewLearning] = useState({
    type: 'error-solution' as LearningType,
    title: '',
    description: '',
    solution: '',
    tags: '',
    severity: 'info' as Severity,
    projectName: '',
    source: 'manual',
  });

  // Fetch learnings
  const fetchLearnings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (severityFilter !== 'all') params.set('severity', severityFilter);
      if (tagFilter) params.set('tag', tagFilter);

      const response = await fetch(`/api/learnings?${params.toString()}`);
      const data = await response.json();
      // API returns { learnings, count, offset, limit } - no success field
      if (data.learnings) {
        setLearnings(data.learnings);
      }
    } catch (error) {
      console.error('Failed to fetch learnings:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, typeFilter, severityFilter, tagFilter]);

  // Fetch stats
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/learnings/stats');
      const data = await response.json();
      // API returns stats object directly - no success/stats wrapper
      if (data.total !== undefined) {
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  useEffect(() => {
    fetchLearnings();
    fetchStats();
  }, [fetchLearnings]);

  // Add new learning
  const handleAddLearning = async () => {
    if (!newLearning.title.trim() || !newLearning.description.trim()) return;

    try {
      const response = await fetch('/api/learnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newLearning,
          tags: newLearning.tags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      });

      const data = await response.json();
      // API returns { id, message, learning } on success
      if (data.id) {
        setShowAddForm(false);
        setNewLearning({
          type: 'error-solution',
          title: '',
          description: '',
          solution: '',
          tags: '',
          severity: 'info',
          projectName: '',
          source: 'manual',
        });
        fetchLearnings();
        fetchStats();
      }
    } catch (error) {
      console.error('Failed to add learning:', error);
    }
  };

  // Send feedback
  const handleFeedback = async (id: number, helpful: boolean) => {
    try {
      await fetch(`/api/learnings/${id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ helpful }),
      });
      fetchLearnings();
    } catch (error) {
      console.error('Failed to send feedback:', error);
    }
  };

  // Delete learning
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this learning?')) return;

    try {
      await fetch(`/api/learnings/${id}`, { method: 'DELETE' });
      fetchLearnings();
      fetchStats();
    } catch (error) {
      console.error('Failed to delete learning:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Brain className="h-6 w-6 text-purple-500" />
              <h1 className="text-xl font-bold">Agent Learning Memory</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { fetchLearnings(); fetchStats(); }}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={() => setShowAddForm(!showAddForm)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Learning
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-purple-500">{stats.total}</div>
                <div className="text-sm text-muted-foreground">Total Learnings</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-green-500">{stats.recentCount}</div>
                <div className="text-sm text-muted-foreground">Last 7 Days</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-amber-500">{stats.bySeverity?.critical || 0}</div>
                <div className="text-sm text-muted-foreground">Critical Issues</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-blue-500">{stats.topTags?.length || 0}</div>
                <div className="text-sm text-muted-foreground">Unique Tags</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Pending Learnings - Agent-detected learnings awaiting review */}
        <PendingLearnings
          className="mb-8"
          onLearningApproved={() => {
            fetchLearnings();
            fetchStats();
          }}
          autoRefresh={true}
          refreshInterval={15000}
        />

        {/* Type Distribution */}
        {stats && stats.byType && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Learnings by Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.byType).map(([type, count]) => (
                  <Badge
                    key={type}
                    variant="outline"
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => setTypeFilter(type as LearningType)}
                  >
                    {TYPE_ICONS[type as LearningType]}
                    <span className="ml-1">{type}</span>
                    <span className="ml-2 font-bold">{count}</span>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add Learning Form */}
        {showAddForm && (
          <Card className="mb-8 border-purple-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-purple-500" />
                Add New Learning
              </CardTitle>
              <CardDescription>
                Record a new learning that agents can use in future projects
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Type</label>
                  <Select
                    value={newLearning.type}
                    onValueChange={(v) => setNewLearning({ ...newLearning, type: v as LearningType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="error-solution">Error Solution</SelectItem>
                      <SelectItem value="gotcha">Gotcha</SelectItem>
                      <SelectItem value="pattern">Pattern</SelectItem>
                      <SelectItem value="anti-pattern">Anti-Pattern</SelectItem>
                      <SelectItem value="library-issue">Library Issue</SelectItem>
                      <SelectItem value="workaround">Workaround</SelectItem>
                      <SelectItem value="best-practice">Best Practice</SelectItem>
                      <SelectItem value="config">Config</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Severity</label>
                  <Select
                    value={newLearning.severity}
                    onValueChange={(v) => setNewLearning({ ...newLearning, severity: v as Severity })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Title</label>
                <Input
                  placeholder="Brief summary of the learning..."
                  value={newLearning.title}
                  onChange={(e) => setNewLearning({ ...newLearning, title: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <Textarea
                  placeholder="Detailed description of the issue or pattern..."
                  value={newLearning.description}
                  onChange={(e) => setNewLearning({ ...newLearning, description: e.target.value })}
                  className="min-h-[100px]"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Solution (optional)</label>
                <Textarea
                  placeholder="How to fix or handle this..."
                  value={newLearning.solution}
                  onChange={(e) => setNewLearning({ ...newLearning, solution: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Tags (comma-separated)</label>
                  <Input
                    placeholder="prisma, next, typescript..."
                    value={newLearning.tags}
                    onChange={(e) => setNewLearning({ ...newLearning, tags: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Project Name (optional)</label>
                  <Input
                    placeholder="Project where this was learned..."
                    value={newLearning.projectName}
                    onChange={(e) => setNewLearning({ ...newLearning, projectName: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleAddLearning} disabled={!newLearning.title || !newLearning.description}>
                  <Plus className="h-4 w-4 mr-2" />
                  Save Learning
                </Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[300px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search learnings..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as LearningType | 'all')}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="error-solution">Error Solution</SelectItem>
                  <SelectItem value="gotcha">Gotcha</SelectItem>
                  <SelectItem value="pattern">Pattern</SelectItem>
                  <SelectItem value="anti-pattern">Anti-Pattern</SelectItem>
                  <SelectItem value="library-issue">Library Issue</SelectItem>
                  <SelectItem value="workaround">Workaround</SelectItem>
                  <SelectItem value="best-practice">Best Practice</SelectItem>
                  <SelectItem value="config">Config</SelectItem>
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as Severity | 'all')}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Filter by tag..."
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="w-[150px]"
              />
              {(typeFilter !== 'all' || severityFilter !== 'all' || tagFilter || searchQuery) && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setTypeFilter('all');
                    setSeverityFilter('all');
                    setTagFilter('');
                    setSearchQuery('');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Learnings List */}
        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Loading learnings...</p>
          </div>
        ) : learnings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Learnings Found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || typeFilter !== 'all' || severityFilter !== 'all' || tagFilter
                  ? 'Try adjusting your filters'
                  : 'Start building projects and the agents will automatically capture learnings'}
              </p>
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Learning
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {learnings.map((learning) => (
              <Card key={learning.id} className="overflow-hidden">
                <div
                  className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(expandedId === learning.id ? null : learning.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={`${TYPE_COLORS[learning.type]} text-white`}>
                          {TYPE_ICONS[learning.type]}
                          <span className="ml-1">{learning.type}</span>
                        </Badge>
                        <Badge className={`${SEVERITY_COLORS[learning.severity]} text-white`}>
                          {SEVERITY_ICONS[learning.severity]}
                          <span className="ml-1">{learning.severity}</span>
                        </Badge>
                        {learning.projectName && (
                          <Badge variant="outline">{learning.projectName}</Badge>
                        )}
                      </div>
                      <h3 className="font-medium text-lg">{learning.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {learning.description}
                      </p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(learning.createdAt).toLocaleDateString()}
                        </span>
                        {learning.tags.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            {learning.tags.slice(0, 3).join(', ')}
                            {learning.tags.length > 3 && ` +${learning.tags.length - 3}`}
                          </span>
                        )}
                        <span className="flex items-center gap-2">
                          <ThumbsUp className="h-3 w-3" /> {learning.helpfulCount}
                          <ThumbsDown className="h-3 w-3 ml-2" /> {learning.notHelpfulCount}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {expandedId === learning.id ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded content */}
                {expandedId === learning.id && (
                  <div className="border-t p-4 bg-muted/20">
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium mb-2">Description</h4>
                        <p className="text-sm whitespace-pre-wrap">{learning.description}</p>
                      </div>

                      {learning.solution && (
                        <div>
                          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                            <Lightbulb className="h-4 w-4 text-amber-500" />
                            Solution
                          </h4>
                          <div className="bg-muted rounded-lg p-3">
                            <pre className="text-sm whitespace-pre-wrap font-mono">
                              {learning.solution}
                            </pre>
                          </div>
                        </div>
                      )}

                      {learning.tags.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Tags</h4>
                          <div className="flex flex-wrap gap-2">
                            {learning.tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="cursor-pointer hover:bg-muted"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTagFilter(tag);
                                }}
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-4 border-t">
                        <span className="text-sm text-muted-foreground mr-2">Was this helpful?</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFeedback(learning.id, true);
                          }}
                        >
                          <ThumbsUp className="h-4 w-4 mr-1" />
                          Helpful ({learning.helpfulCount})
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFeedback(learning.id, false);
                          }}
                        >
                          <ThumbsDown className="h-4 w-4 mr-1" />
                          Not Helpful ({learning.notHelpfulCount})
                        </Button>
                        <div className="flex-1" />
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(learning.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
