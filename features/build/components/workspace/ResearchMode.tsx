'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search,
  Send,
  X,
  FileCode,
  FolderTree,
  Loader2,
  MessageSquare,
  Bot,
  User,
  Sparkles,
  Copy,
  Check,
  BookOpen,
  Zap,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  Shield,
  TestTube,
  Database,
  Palette,
  Server,
  Plug,
  Rocket,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ResearchMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  referencedFiles?: string[];
  suggestedBuild?: {
    title: string;
    description: string;
    estimatedStories: number;
  };
}

interface Insight {
  id: string;
  text: string;
  type: 'finding' | 'todo' | 'question';
}

interface FeatureSuggestion {
  id: string;
  title: string;
  description: string;
  category: 'feature' | 'security' | 'testing' | 'performance' | 'accessibility' | 'infrastructure' | 'ux' | 'data' | 'integration';
  priority: 'high' | 'medium' | 'low';
  rationale?: string;
  status: 'pending' | 'accepted' | 'rejected';
}

const CATEGORY_CONFIG: Record<FeatureSuggestion['category'], { icon: typeof Sparkles; color: string; bgColor: string; label: string }> = {
  feature: { icon: Sparkles, color: 'text-violet-400', bgColor: 'bg-violet-500/15', label: 'Feature' },
  security: { icon: Shield, color: 'text-red-400', bgColor: 'bg-red-500/15', label: 'Security' },
  testing: { icon: TestTube, color: 'text-green-400', bgColor: 'bg-green-500/15', label: 'Testing' },
  performance: { icon: Zap, color: 'text-amber-400', bgColor: 'bg-amber-500/15', label: 'Performance' },
  accessibility: { icon: Palette, color: 'text-pink-400', bgColor: 'bg-pink-500/15', label: 'Accessibility' },
  infrastructure: { icon: Server, color: 'text-teal-400', bgColor: 'bg-teal-500/15', label: 'Infrastructure' },
  ux: { icon: Palette, color: 'text-blue-400', bgColor: 'bg-blue-500/15', label: 'UX' },
  data: { icon: Database, color: 'text-orange-400', bgColor: 'bg-orange-500/15', label: 'Data' },
  integration: { icon: Plug, color: 'text-indigo-400', bgColor: 'bg-indigo-500/15', label: 'Integration' },
};

const PRIORITY_STYLES = {
  high: 'border-red-500/30 bg-red-500/10',
  medium: 'border-amber-500/30 bg-amber-500/10',
  low: 'border-green-500/30 bg-green-500/10',
};

interface ResearchModeProps {
  projectDir: string;
  projectId: string;
  onClose: () => void;
  onStartBuild: (requirements: string) => void;
  isLoading?: boolean;
}

// Storage key for persisting research state
function getStorageKey(projectDir: string): string {
  // Create a consistent key from the project directory
  const safePath = projectDir.replace(/[^a-zA-Z0-9]/g, '_').slice(-50);
  return `research_state_${safePath}`;
}

interface PersistedState {
  messages: Array<Omit<ResearchMessage, 'timestamp'> & { timestamp: string }>;
  referencedFiles: string[];
  insights: Insight[];
  featureSuggestions: FeatureSuggestion[];
}

export function ResearchMode({
  projectDir,
  projectId,
  onClose,
  onStartBuild,
  isLoading = false,
}: ResearchModeProps) {
  const [messages, setMessages] = useState<ResearchMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [referencedFiles, setReferencedFiles] = useState<string[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [newInsight, setNewInsight] = useState('');
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [filesExpanded, setFilesExpanded] = useState(true);
  const [insightsExpanded, setInsightsExpanded] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [featureSuggestions, setFeatureSuggestions] = useState<FeatureSuggestion[]>([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [activeTab, setActiveTab] = useState<'explore' | 'features'>('explore');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load persisted state on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(getStorageKey(projectDir));
      if (stored) {
        const parsed: PersistedState = JSON.parse(stored);
        // Restore messages with proper Date objects
        if (parsed.messages && parsed.messages.length > 0) {
          setMessages(parsed.messages.map(m => ({
            ...m,
            timestamp: new Date(m.timestamp),
          })));
        }
        if (parsed.referencedFiles) {
          setReferencedFiles(parsed.referencedFiles);
        }
        if (parsed.insights) {
          setInsights(parsed.insights);
        }
        if (parsed.featureSuggestions) {
          setFeatureSuggestions(parsed.featureSuggestions);
        }
      }
    } catch (error) {
      console.error('[ResearchMode] Failed to load persisted state:', error);
    }
    setIsLoaded(true);
  }, [projectDir]);

  // Persist state when it changes
  useEffect(() => {
    // Don't save until we've loaded (to avoid overwriting with empty state)
    if (!isLoaded) return;

    try {
      const state: PersistedState = {
        messages: messages.map(m => ({
          ...m,
          timestamp: m.timestamp.toISOString(),
        })),
        referencedFiles,
        insights,
        featureSuggestions,
      };
      localStorage.setItem(getStorageKey(projectDir), JSON.stringify(state));
    } catch (error) {
      console.error('[ResearchMode] Failed to persist state:', error);
    }
  }, [messages, referencedFiles, insights, featureSuggestions, projectDir, isLoaded]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isResearching) return;

    const userMessage: ResearchMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsResearching(true);

    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectDir,
          question: userMessage.content,
          previousMessages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Research request failed');
      }

      const data = await response.json();

      const assistantMessage: ResearchMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.answer || 'I analyzed the codebase but couldn\'t find a clear answer. Could you rephrase your question?',
        timestamp: new Date(),
        referencedFiles: data.referencedFiles || [],
        suggestedBuild: data.suggestedBuild,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Update referenced files
      if (data.referencedFiles) {
        setReferencedFiles(prev => {
          const newFiles = data.referencedFiles.filter((f: string) => !prev.includes(f));
          return [...prev, ...newFiles];
        });
      }

      // Auto-add key findings as insights
      if (data.notes && data.notes.length > 0) {
        const newInsights: Insight[] = data.notes.slice(0, 2).map((note: string, idx: number) => ({
          id: `insight-${Date.now()}-${idx}`,
          text: note,
          type: 'finding' as const,
        }));
        setInsights(prev => [...prev, ...newInsights]);
      }
    } catch {
      const errorMessage: ResearchMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error while researching. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsResearching(false);
    }
  }, [inputValue, isResearching, projectDir, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleBuildFromSuggestion = (suggestion: ResearchMessage['suggestedBuild']) => {
    if (suggestion) {
      onStartBuild(suggestion.description);
    }
  };

  const copyFilePath = async (path: string) => {
    await navigator.clipboard.writeText(path);
    setCopiedFile(path);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  const addInsight = () => {
    if (!newInsight.trim()) return;
    setInsights(prev => [...prev, {
      id: `insight-${Date.now()}`,
      text: newInsight.trim(),
      type: 'todo',
    }]);
    setNewInsight('');
  };

  const removeInsight = (id: string) => {
    setInsights(prev => prev.filter(i => i.id !== id));
  };

  const buildFromInsights = () => {
    const todoInsights = insights.filter(i => i.type === 'todo' || i.type === 'finding');
    if (todoInsights.length === 0) return;

    const requirements = todoInsights.map(i => `- ${i.text}`).join('\n');
    onStartBuild(`Based on research findings:\n\n${requirements}`);
  };

  // Fetch feature suggestions from the research API
  const fetchFeatureSuggestions = useCallback(async () => {
    if (isFetchingSuggestions) return;

    setIsFetchingSuggestions(true);
    setFeatureSuggestions([]); // Clear existing suggestions

    try {
      const response = await fetch('/api/v2/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          requirements: 'Analyze the current project and suggest new features, improvements, and enhancements.',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch suggestions');
      }

      // Handle SSE stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: suggestion')) {
            // Next line should be the data
            continue;
          }
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.title && data.description) {
                const suggestion: FeatureSuggestion = {
                  id: data.id || `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  title: data.title,
                  description: data.description,
                  category: data.category || 'feature',
                  priority: data.priority || 'medium',
                  rationale: data.rationale,
                  status: 'pending',
                };
                setFeatureSuggestions(prev => {
                  // Avoid duplicates
                  if (prev.some(s => s.title === suggestion.title)) return prev;
                  return [...prev, suggestion];
                });
              }
            } catch {
              // Ignore parsing errors
            }
          }
        }
      }
    } catch (error) {
      console.error('[ResearchMode] Failed to fetch suggestions:', error);
    } finally {
      setIsFetchingSuggestions(false);
    }
  }, [projectId, isFetchingSuggestions]);

  const acceptSuggestion = (suggestion: FeatureSuggestion) => {
    // Mark as accepted and start build
    setFeatureSuggestions(prev =>
      prev.map(s => s.id === suggestion.id ? { ...s, status: 'accepted' as const } : s)
    );
    onStartBuild(`${suggestion.title}\n\n${suggestion.description}${suggestion.rationale ? `\n\nRationale: ${suggestion.rationale}` : ''}`);
  };

  const rejectSuggestion = (suggestion: FeatureSuggestion) => {
    setFeatureSuggestions(prev =>
      prev.map(s => s.id === suggestion.id ? { ...s, status: 'rejected' as const } : s)
    );
  };

  const pendingSuggestions = featureSuggestions.filter(s => s.status === 'pending');

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Header - Full Width */}
      <div className="border-b border-border/50 bg-gradient-to-r from-cyan-950/30 to-teal-950/20 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Search className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold">Research Mode</h1>
                <p className="text-[11px] text-muted-foreground">
                  {projectDir.split(/[/\\]/).pop()}
                </p>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('explore')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                  activeTab === 'explore'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Search className="h-3.5 w-3.5" />
                Explore Codebase
              </button>
              <button
                onClick={() => setActiveTab('features')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                  activeTab === 'features'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Lightbulb className="h-3.5 w-3.5" />
                Suggest Features
                {pendingSuggestions.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] h-5 px-1.5">
                    {pendingSuggestions.length}
                  </Badge>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'explore' && insights.length > 0 && (
              <Button
                size="sm"
                onClick={buildFromInsights}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
              >
                <Zap className="h-3.5 w-3.5 mr-1.5" />
                Build from Insights ({insights.length})
              </Button>
            )}
            {activeTab === 'explore' && messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMessages([]);
                  setReferencedFiles([]);
                  setInsights([]);
                }}
                className="hover:bg-amber-500/20 hover:text-amber-400"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
            {activeTab === 'features' && featureSuggestions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFeatureSuggestions([])}
                className="hover:bg-amber-500/20 hover:text-amber-400"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="hover:bg-red-500/20 hover:text-red-400"
            >
              <X className="h-4 w-4 mr-1" />
              Exit
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content - Full Width */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Area - Takes remaining space */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Explore Codebase Tab */}
          {activeTab === 'explore' && (
            <>
              {/* Messages */}
              <ScrollArea className="flex-1 p-6">
                <div className="max-w-4xl mx-auto space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/10 flex items-center justify-center mx-auto mb-6">
                        <MessageSquare className="h-10 w-10 text-cyan-400" />
                      </div>
                      <h2 className="text-xl font-semibold mb-3">Ask anything about your codebase</h2>
                      <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-8">
                        I&apos;ll analyze your project structure, read relevant files, and help you understand what exists before making changes.
                      </p>
                      <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
                        {[
                          'What API routes do I have?',
                          'How is authentication implemented?',
                          'Show me the database schema',
                          'What components are in the UI?',
                          'How is state management handled?',
                          'What testing patterns are used?',
                        ].map((suggestion) => (
                          <Button
                            key={suggestion}
                            variant="outline"
                            size="sm"
                            className="text-xs border-cyan-500/30 hover:bg-cyan-500/10 hover:border-cyan-500/50"
                            onClick={() => setInputValue(suggestion)}
                          >
                            {suggestion}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex gap-3',
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {message.role === 'assistant' && (
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-teal-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                        <Bot className="h-4 w-4 text-cyan-400" />
                      </div>
                    )}
                    <div
                      className={cn(
                        'rounded-xl p-4',
                        message.role === 'user'
                          ? 'bg-indigo-600 text-white max-w-[70%]'
                          : 'bg-muted/50 border border-border/50 max-w-[85%]'
                      )}
                    >
                      <div className="text-sm whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none">
                        {message.content}
                      </div>

                      {/* Referenced Files */}
                      {message.referencedFiles && message.referencedFiles.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/30">
                          <p className="text-[10px] text-muted-foreground mb-2">Files analyzed:</p>
                          <div className="flex flex-wrap gap-1">
                            {message.referencedFiles.slice(0, 6).map((file) => (
                              <Badge
                                key={file}
                                variant="outline"
                                className="text-[10px] font-mono cursor-pointer hover:bg-cyan-500/10"
                                onClick={() => copyFilePath(file)}
                              >
                                <FileCode className="h-3 w-3 mr-1" />
                                {file.split('/').pop()}
                              </Badge>
                            ))}
                            {message.referencedFiles.length > 6 && (
                              <Badge variant="outline" className="text-[10px]">
                                +{message.referencedFiles.length - 6} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Suggested Build */}
                      {message.suggestedBuild && (
                        <Card className="mt-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/5 border-indigo-500/30">
                          <CardContent className="p-3">
                            <div className="flex items-start gap-2 mb-2">
                              <Sparkles className="h-4 w-4 text-indigo-400 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-sm font-semibold">{message.suggestedBuild.title}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {message.suggestedBuild.description}
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleBuildFromSuggestion(message.suggestedBuild)}
                              className="w-full mt-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                            >
                              <Sparkles className="h-3.5 w-3.5 mr-1" />
                              Build This
                            </Button>
                          </CardContent>
                        </Card>
                      )}

                      <p className="text-[10px] text-muted-foreground/50 mt-2">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                    {message.role === 'user' && (
                      <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-1">
                        <User className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                ))
              )}

              {isResearching && (
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-teal-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div className="bg-muted/50 border border-border/50 rounded-xl p-4">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                      <span className="text-sm text-muted-foreground">Analyzing codebase...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t border-border/50 p-4 bg-muted/20">
            <div className="max-w-4xl mx-auto flex gap-2">
              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your codebase... (Enter to send, Shift+Enter for new line)"
                className="min-h-[50px] max-h-[120px] resize-none bg-background/50 border-border/50"
                disabled={isResearching || isLoading}
              />
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || isResearching || isLoading}
                className="h-auto px-4 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700"
              >
                {isResearching ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
            </>
          )}

          {/* Suggest Features Tab */}
          {activeTab === 'features' && (
            <ScrollArea className="flex-1 p-6">
              <div className="max-w-5xl mx-auto">
                {/* Empty State / Generate Button */}
                {featureSuggestions.length === 0 && !isFetchingSuggestions ? (
                  <div className="text-center py-16">
                    <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 flex items-center justify-center mx-auto mb-6">
                      <Lightbulb className="h-10 w-10 text-violet-400" />
                    </div>
                    <h2 className="text-xl font-semibold mb-3">Discover New Features</h2>
                    <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-8">
                      I&apos;ll analyze your project and suggest features, improvements, and enhancements you could build next.
                    </p>
                    <Button
                      size="lg"
                      onClick={fetchFeatureSuggestions}
                      className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                    >
                      <Rocket className="h-4 w-4 mr-2" />
                      Generate Feature Suggestions
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Header with Refresh */}
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-lg font-semibold">Feature Suggestions</h2>
                        <p className="text-sm text-muted-foreground">
                          Click on a suggestion to start building it
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchFeatureSuggestions}
                        disabled={isFetchingSuggestions}
                      >
                        {isFetchingSuggestions ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Rocket className="h-4 w-4 mr-1" />
                        )}
                        {isFetchingSuggestions ? 'Analyzing...' : 'Refresh'}
                      </Button>
                    </div>

                    {/* Loading State */}
                    {isFetchingSuggestions && featureSuggestions.length === 0 && (
                      <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                          <Loader2 className="h-8 w-8 animate-spin text-violet-400 mx-auto mb-4" />
                          <p className="text-sm text-muted-foreground">Analyzing your codebase for opportunities...</p>
                        </div>
                      </div>
                    )}

                    {/* Suggestion Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {pendingSuggestions.map((suggestion) => {
                        const config = CATEGORY_CONFIG[suggestion.category] || CATEGORY_CONFIG.feature;
                        const IconComponent = config.icon;

                        return (
                          <Card
                            key={suggestion.id}
                            className={cn(
                              "relative overflow-hidden transition-all hover:shadow-lg cursor-pointer group",
                              "border-2",
                              PRIORITY_STYLES[suggestion.priority]
                            )}
                            onClick={() => acceptSuggestion(suggestion)}
                          >
                            <CardContent className="p-4">
                              {/* Category & Priority */}
                              <div className="flex items-center gap-2 mb-3">
                                <div className={cn("p-1.5 rounded-md", config.bgColor)}>
                                  <IconComponent className={cn("h-3.5 w-3.5", config.color)} />
                                </div>
                                <Badge variant="outline" className="text-[10px]">
                                  {config.label}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] ml-auto",
                                    suggestion.priority === 'high' && "border-red-500/50 text-red-400",
                                    suggestion.priority === 'medium' && "border-amber-500/50 text-amber-400",
                                    suggestion.priority === 'low' && "border-green-500/50 text-green-400"
                                  )}
                                >
                                  {suggestion.priority}
                                </Badge>
                              </div>

                              {/* Title & Description */}
                              <h3 className="font-semibold text-sm mb-2 group-hover:text-primary transition-colors">
                                {suggestion.title}
                              </h3>
                              <p className="text-xs text-muted-foreground line-clamp-3 mb-3">
                                {suggestion.description}
                              </p>

                              {/* Actions */}
                              <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                                <Button
                                  size="sm"
                                  className="flex-1 h-7 text-xs bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    acceptSuggestion(suggestion);
                                  }}
                                >
                                  <Zap className="h-3 w-3 mr-1" />
                                  Build This
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 hover:bg-red-500/20 hover:text-red-400"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    rejectSuggestion(suggestion);
                                  }}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    {/* Rejected suggestions (collapsed) */}
                    {featureSuggestions.filter(s => s.status === 'rejected').length > 0 && (
                      <div className="mt-6 pt-6 border-t border-border/50">
                        <p className="text-xs text-muted-foreground mb-2">
                          {featureSuggestions.filter(s => s.status === 'rejected').length} dismissed suggestions
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Side Panel - Only show for explore tab */}
        {activeTab === 'explore' && (
        <div className="w-80 border-l border-border/50 flex flex-col bg-muted/5">
          {/* Files Analyzed */}
          <div className="border-b border-border/50">
            <button
              onClick={() => setFilesExpanded(!filesExpanded)}
              className="w-full p-3 flex items-center justify-between hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-center gap-2">
                <FolderTree className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-medium">Files Analyzed</span>
                {referencedFiles.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-5">
                    {referencedFiles.length}
                  </Badge>
                )}
              </div>
              {filesExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {filesExpanded && (
              <ScrollArea className="max-h-64">
                <div className="p-2 space-y-0.5">
                  {referencedFiles.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4 px-2">
                      Files will appear here as you explore
                    </p>
                  ) : (
                    referencedFiles.map((file) => (
                      <div
                        key={file}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer group"
                        onClick={() => copyFilePath(file)}
                      >
                        <FileCode className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                        <span className="text-xs truncate flex-1 font-mono text-muted-foreground group-hover:text-foreground">
                          {file}
                        </span>
                        {copiedFile === file ? (
                          <Check className="h-3 w-3 text-green-400" />
                        ) : (
                          <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Insights / Notes */}
          <div className="flex-1 flex flex-col min-h-0">
            <button
              onClick={() => setInsightsExpanded(!insightsExpanded)}
              className="w-full p-3 flex items-center justify-between hover:bg-muted/20 transition-colors border-b border-border/50"
            >
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-medium">Insights & Notes</span>
                {insights.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-5">
                    {insights.length}
                  </Badge>
                )}
              </div>
              {insightsExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {insightsExpanded && (
              <div className="flex-1 flex flex-col min-h-0">
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-2">
                    {insights.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4 px-2">
                        Add notes about what you discover. Key findings from research will also appear here.
                      </p>
                    ) : (
                      insights.map((insight) => (
                        <div
                          key={insight.id}
                          className={cn(
                            "flex items-start gap-2 p-2 rounded-lg text-xs group",
                            insight.type === 'finding' && "bg-cyan-500/10 border border-cyan-500/20",
                            insight.type === 'todo' && "bg-amber-500/10 border border-amber-500/20",
                            insight.type === 'question' && "bg-purple-500/10 border border-purple-500/20"
                          )}
                        >
                          <span className="flex-1">{insight.text}</span>
                          <button
                            onClick={() => removeInsight(insight.id)}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-opacity"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
                {/* Add new insight */}
                <div className="p-2 border-t border-border/50">
                  <div className="flex gap-1">
                    <Input
                      value={newInsight}
                      onChange={(e) => setNewInsight(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addInsight()}
                      placeholder="Add a note..."
                      className="h-8 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={addInsight}
                      disabled={!newInsight.trim()}
                      className="h-8 w-8 p-0"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="p-3 border-t border-border/50 space-y-2">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Quick Questions</p>
            <div className="space-y-1">
              {[
                'Project structure overview',
                'Find unused code',
                'Security concerns',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => setInputValue(q)}
                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                >
                  → {q}
                </button>
              ))}
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
