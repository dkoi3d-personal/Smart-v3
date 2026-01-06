'use client';

import { useState, useEffect, use, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Bug,
  ArrowLeft,
  CheckCircle,
  Clock,
  AlertTriangle,
  MessageSquare,
  Wand2,
  Send,
  Image,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import ReactMarkdown from 'react-markdown';

interface BugComment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  content: string;
  createdAt: string;
  isClaudeResponse?: boolean;
}

interface BugFixRequest {
  id: string;
  requestedBy: string;
  requestedAt: string;
  description: string;
  claudeResponse?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  completedAt?: string;
}

interface BugScreenshot {
  id: string;
  filename: string;
  path: string;
  capturedAt: string;
}

interface BugData {
  id: string;
  projectId: string;
  title: string;
  description: string;
  stepsToReproduce: string[];
  expectedBehavior: string;
  actualBehavior: string;
  severity: string;
  category: string;
  status: string;
  reportedBy: string;
  reportedByName: string;
  screenshots: BugScreenshot[];
  comments: BugComment[];
  fixRequests: BugFixRequest[];
  environment: {
    browser?: string;
    os?: string;
    screenSize?: string;
    url?: string;
  };
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

function BugDetailContent({ params }: { params: Promise<{ bugId: string }> }) {
  const { bugId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId') || '';

  const [bug, setBug] = useState<BugData | null>(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [fixDescription, setFixDescription] = useState('');
  const [requestingFix, setRequestingFix] = useState(false);
  const [addingComment, setAddingComment] = useState(false);
  const [showFixForm, setShowFixForm] = useState(false);

  // Load bug data
  useEffect(() => {
    async function loadBug() {
      try {
        const res = await fetch(`/api/bugs/${bugId}?projectId=${projectId}`);
        if (res.ok) {
          const data = await res.json();
          setBug(data);
        }
      } catch (error) {
        console.error('Failed to load bug:', error);
      } finally {
        setLoading(false);
      }
    }
    if (projectId) {
      loadBug();
    }
  }, [bugId, projectId]);

  // Request fix from Claude
  const handleRequestFix = async () => {
    if (!fixDescription.trim()) {
      alert('Please describe what you want Claude to fix');
      return;
    }

    setRequestingFix(true);

    try {
      const res = await fetch(`/api/bugs/${bugId}/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          requestedBy: 'uat_tester',
          description: fixDescription,
        }),
      });

      if (res.ok) {
        // Reload bug to get Claude's response
        const bugRes = await fetch(`/api/bugs/${bugId}?projectId=${projectId}`);
        if (bugRes.ok) {
          const data = await bugRes.json();
          setBug(data);
        }
        setFixDescription('');
        setShowFixForm(false);
      }
    } catch (error) {
      console.error('Failed to request fix:', error);
      alert('Failed to request fix. Please try again.');
    } finally {
      setRequestingFix(false);
    }
  };

  // Add comment
  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setAddingComment(true);

    try {
      const res = await fetch(`/api/bugs/${bugId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          action: 'comment',
          authorId: 'uat_tester',
          authorName: 'UAT Tester',
          authorRole: 'uat_tester',
          content: newComment,
        }),
      });

      if (res.ok) {
        // Reload bug
        const bugRes = await fetch(`/api/bugs/${bugId}?projectId=${projectId}`);
        if (bugRes.ok) {
          const data = await bugRes.json();
          setBug(data);
        }
        setNewComment('');
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setAddingComment(false);
    }
  };

  // Verify fix
  const handleVerify = async () => {
    try {
      const res = await fetch(`/api/bugs/${bugId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          action: 'verify',
          verifiedBy: 'uat_tester',
        }),
      });

      if (res.ok) {
        const bugRes = await fetch(`/api/bugs/${bugId}?projectId=${projectId}`);
        if (bugRes.ok) {
          const data = await bugRes.json();
          setBug(data);
        }
      }
    } catch (error) {
      console.error('Failed to verify:', error);
    }
  };

  // Close bug
  const handleClose = async () => {
    try {
      const res = await fetch(`/api/bugs/${bugId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          action: 'close',
          reason: 'Verified and closed by tester',
        }),
      });

      if (res.ok) {
        router.push('/uat');
      }
    } catch (error) {
      console.error('Failed to close:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open': return <Badge variant="destructive">Open</Badge>;
      case 'in_progress': return <Badge className="bg-blue-500">In Progress</Badge>;
      case 'fix_requested': return <Badge className="bg-purple-500">Fix Requested</Badge>;
      case 'fixed': return <Badge className="bg-green-500">Fixed</Badge>;
      case 'verified': return <Badge className="bg-emerald-600">Verified</Badge>;
      case 'closed': return <Badge variant="secondary">Closed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!bug) {
    return (
      <div className="container mx-auto p-6 text-center">
        <Bug className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Bug not found</h2>
        <Button className="mt-4" onClick={() => router.push('/uat')}>
          Back to UAT Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge className={getSeverityColor(bug.severity)}>
              {bug.severity.toUpperCase()}
            </Badge>
            {getStatusBadge(bug.status)}
            <Badge variant="outline">{bug.category}</Badge>
          </div>
          <h1 className="text-2xl font-bold">{bug.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reported by {bug.reportedByName} on {new Date(bug.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          {bug.status === 'fixed' && (
            <Button onClick={handleVerify} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="h-4 w-4 mr-2" />
              Verify Fix
            </Button>
          )}
          {bug.status === 'verified' && (
            <Button onClick={handleClose}>
              Close Bug
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => router.push(`/build/${projectId}`)}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View App
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{bug.description}</p>
            </CardContent>
          </Card>

          {/* Steps to Reproduce */}
          {bug.stepsToReproduce.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Steps to Reproduce</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal list-inside space-y-2">
                  {bug.stepsToReproduce.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {/* Expected vs Actual */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">Expected</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{bug.expectedBehavior || 'Not specified'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">Actual</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{bug.actualBehavior || 'Not specified'}</p>
              </CardContent>
            </Card>
          </div>

          {/* Screenshots */}
          {bug.screenshots.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="h-5 w-5" />
                  Screenshots
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {bug.screenshots.map(screenshot => (
                    <img
                      key={screenshot.id}
                      src={screenshot.path}
                      alt={screenshot.filename}
                      className="rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => window.open(screenshot.path, '_blank')}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Request Fix from Claude */}
          <Card className="border-purple-500/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-purple-500" />
                Ask Claude to Fix
              </CardTitle>
              <CardDescription>
                Describe what needs to be fixed and Claude will analyze the bug and suggest code changes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {showFixForm ? (
                <div className="space-y-4">
                  <Textarea
                    placeholder="Describe what you want Claude to fix. Be specific about the expected behavior..."
                    value={fixDescription}
                    onChange={(e) => setFixDescription(e.target.value)}
                    rows={4}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleRequestFix}
                      disabled={requestingFix}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {requestingFix ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Claude is analyzing...
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-4 w-4 mr-2" />
                          Request Fix
                        </>
                      )}
                    </Button>
                    <Button variant="outline" onClick={() => setShowFixForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setShowFixForm(true)}
                  className="w-full"
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  Ask Claude to Fix This Bug
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Comments & Claude Responses */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Discussion ({bug.comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {bug.comments.map(comment => (
                <div key={comment.id} className={`p-4 rounded-lg ${
                  comment.isClaudeResponse ? 'bg-purple-500/10 border border-purple-500/30' : 'bg-muted'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className={comment.isClaudeResponse ? 'bg-purple-500 text-white' : ''}>
                        {comment.isClaudeResponse ? 'AI' : comment.authorName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{comment.authorName}</span>
                    {comment.isClaudeResponse && (
                      <Badge variant="outline" className="text-purple-500 border-purple-500">
                        AI Response
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(comment.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {comment.isClaudeResponse ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{comment.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{comment.content}</p>
                  )}
                </div>
              ))}

              <Separator />

              {/* Add Comment */}
              <div className="space-y-2">
                <Textarea
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                />
                <Button
                  onClick={handleAddComment}
                  disabled={addingComment || !newComment.trim()}
                  size="sm"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {addingComment ? 'Sending...' : 'Send'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    Created: {new Date(bug.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    Updated: {new Date(bug.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                {bug.fixRequests.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-4 w-4 text-purple-500" />
                    <span className="text-sm">
                      {bug.fixRequests.length} fix request(s)
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Environment */}
          <Card>
            <CardHeader>
              <CardTitle>Environment</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {bug.environment.browser && (
                <div>
                  <span className="text-muted-foreground">Browser:</span>
                  <p className="truncate">{bug.environment.browser.slice(0, 50)}...</p>
                </div>
              )}
              {bug.environment.os && (
                <div>
                  <span className="text-muted-foreground">OS:</span>
                  <p>{bug.environment.os}</p>
                </div>
              )}
              {bug.environment.screenSize && (
                <div>
                  <span className="text-muted-foreground">Screen:</span>
                  <p>{bug.environment.screenSize}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          {bug.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {bug.tags.map(tag => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BugDetailPage({ params }: { params: Promise<{ bugId: string }> }) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>}>
      <BugDetailContent params={params} />
    </Suspense>
  );
}
