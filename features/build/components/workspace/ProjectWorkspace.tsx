'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Sparkles,
  Search,
  Play,
  FileCode,
  Code2,
  TestTube,
  Shield,
  Clock,
  CheckCircle,
  Loader2,
  Heart,
  Lightbulb,
  Target,
  ChevronDown,
  ChevronRight,
  Figma,
  FileText,
  ExternalLink,
  AlertCircle,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AITextarea } from '@/components/ui/ai-textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { HistorySidebar } from './HistorySidebar';
import { ResearchMode } from './ResearchMode';
import type { Task, Epic, IterationState, ResearchSuggestion, BuildMetrics, TestingMetrics, SecurityMetrics } from '../../types';
import { formatDuration } from '@/lib/format-utils';

type WorkspaceState = 'idle' | 'research' | 'context-loading' | 'figma-extracting' | 'text-starting' | 'building';
type BuildSource = 'text' | 'figma';

// Launch messages for Figma progress bar (outside component to avoid re-creation)
const FIGMA_LAUNCH_MESSAGES = [
  'Connecting to Figma API...',
  'Downloading design frames...',
  'Extracting component hierarchy...',
  'Product Owner analyzing design patterns...',
  'Breaking design into user stories...',
  'Identifying acceptance criteria from layouts...',
  'Mapping components to features...',
  'Creating story point estimates...',
  'Defining technical requirements...',
  'Finalizing product backlog...',
  'Ready to build!'
];

// Launch messages for text build progress bar
const TEXT_LAUNCH_MESSAGES = [
  'Analyzing requirements...',
  'Decomposing into stories...',
  'Planning architecture...',
  'Preparing build agents...',
  'Starting build...'
];

interface ProjectWorkspaceProps {
  projectId: string;
  projectDir: string;
  projectName: string;
  tasks: Task[];
  epics: Epic[];
  iterationState: IterationState | null;
  buildMetrics: BuildMetrics;
  testingMetrics: TestingMetrics;
  securityMetrics: SecurityMetrics | null;
  isBuilding: boolean;
  userPrompt: string;
  researchSuggestions: ResearchSuggestion[];
  isResearching: boolean;
  onUserPromptChange: (prompt: string) => void;
  onStartBuild: (requirements: string) => void;
  onStartFigmaBuild?: (figmaUrl: string, context: string) => void;
  onRunResearch: () => void;
  onAddSuggestionToBacklog: (suggestion: ResearchSuggestion) => void;
  onShowEpicExplorer: () => void;
  onSelectStory: (story: Task | null) => void;
  lastBuildPrompt?: string;
  onShowProjectContext?: () => void;
}

export function ProjectWorkspace({
  projectId,
  projectDir,
  projectName,
  tasks,
  epics,
  iterationState,
  buildMetrics,
  testingMetrics,
  securityMetrics,
  isBuilding,
  userPrompt,
  researchSuggestions,
  isResearching,
  onUserPromptChange,
  onStartBuild,
  onStartFigmaBuild,
  onRunResearch,
  onAddSuggestionToBacklog,
  onShowEpicExplorer,
  onSelectStory,
  lastBuildPrompt,
  onShowProjectContext,
}: ProjectWorkspaceProps) {
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>('idle');
  const [pendingBuildPrompt, setPendingBuildPrompt] = useState('');
  const [selectedBuildNumber, setSelectedBuildNumber] = useState<number | undefined>();
  const [expandedLastBuild, setExpandedLastBuild] = useState(true);
  const [launchProgress, setLaunchProgress] = useState(0);
  const [launchMessage, setLaunchMessage] = useState('');

  // Git restore state
  const [isRestoring, setIsRestoring] = useState(false);
  const [currentCommitHash, setCurrentCommitHash] = useState<string | undefined>(
    iterationState?.iterations[iterationState.iterations.length - 1]?.commitHash ||
    iterationState?.originalCommitHash
  );

  // Sync currentCommitHash when iterationState loads asynchronously
  useEffect(() => {
    if (iterationState) {
      const latestCommit =
        iterationState.iterations[iterationState.iterations.length - 1]?.commitHash ||
        iterationState.originalCommitHash;
      if (latestCommit && latestCommit !== currentCommitHash) {
        setCurrentCommitHash(latestCommit);
      }
    }
  }, [iterationState, currentCommitHash]);

  // Figma state
  const [buildSource, setBuildSource] = useState<BuildSource>('text');
  const [figmaUrl, setFigmaUrl] = useState('');
  const [figmaContext, setFigmaContext] = useState('');
  const [figmaConfigured, setFigmaConfigured] = useState(false);
  const [figmaUser, setFigmaUser] = useState<{ email?: string } | null>(null);
  const [figmaError, setFigmaError] = useState<string | null>(null);
  const [isExtractingFigma, setIsExtractingFigma] = useState(false);

  // Document upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [contextDocuments, setContextDocuments] = useState<Array<{ name: string; text: string; size: number }>>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // Check Figma configuration on mount
  useEffect(() => {
    const checkFigmaStatus = async () => {
      try {
        const response = await fetch('/api/settings/figma');
        if (response.ok) {
          const data = await response.json();
          const isConfigured = data.configured || data.hasEnvToken;
          setFigmaConfigured(isConfigured);

          if (isConfigured) {
            const filesResponse = await fetch('/api/figma/files?type=status');
            if (filesResponse.ok) {
              const filesData = await filesResponse.json();
              setFigmaUser(filesData.user || null);
            }
          }
        }
      } catch {
        // Figma not configured, that's okay
      }
    };
    checkFigmaStatus();
  }, []);

  // Validate Figma URL format - accept any figma.com URL
  const isValidFigmaUrl = useCallback((url: string) => {
    return url.includes('figma.com/');
  }, []);

  // Get current metrics (use iteration state's original if available, otherwise use build metrics)
  const currentMetrics = iterationState?.originalBuildMetrics || {
    filesCreated: buildMetrics.filesCreated,
    filesModified: buildMetrics.filesModified || 0,
    linesOfCode: buildMetrics.linesOfCode,
    testsTotal: testingMetrics.totalTests,
    testsPassed: testingMetrics.passed,
    duration: buildMetrics.elapsedTime,
  };

  // Calculate total metrics including iterations
  const totalMetrics = {
    files: currentMetrics.filesCreated + (currentMetrics.filesModified || 0),
    loc: currentMetrics.linesOfCode || 0,
    tests: testingMetrics.totalTests || 0,
    coverage: testingMetrics.coverage || 0,
    securityGrade: securityMetrics?.grade || 'N/A',
    securityScore: securityMetrics?.score || 0,
  };

  // Add iterations metrics
  if (iterationState?.iterations) {
    iterationState.iterations.forEach(iteration => {
      totalMetrics.files += iteration.metricsAdded.filesCreated;
      totalMetrics.loc += iteration.metricsAdded.linesOfCode;
      totalMetrics.tests += iteration.metricsAdded.testsTotal;
    });
  }

  // Handle text-based build
  const handleStartBuild = useCallback(() => {
    console.log('[ProjectWorkspace] handleStartBuild called', { buildSource, userPrompt: userPrompt?.slice(0, 50), figmaUrl });
    if (buildSource === 'figma') {
      // Handle Figma build - show loading immediately
      if (!figmaUrl.trim()) {
        setFigmaError('Please enter a Figma URL');
        return;
      }
      if (!isValidFigmaUrl(figmaUrl)) {
        setFigmaError('Please enter a valid Figma URL');
        return;
      }
      setFigmaError(null);
      setWorkspaceState('figma-extracting');
    } else {
      // Handle text build - show loading state like Figma
      // Allow build if there's text OR uploaded documents
      if (!userPrompt.trim() && contextDocuments.length === 0) {
        console.log('[ProjectWorkspace] userPrompt is empty and no documents, returning early');
        return;
      }
      console.log('[ProjectWorkspace] Setting text-starting state');
      setWorkspaceState('text-starting');
    }
  }, [buildSource, figmaUrl, userPrompt, contextDocuments.length, isValidFigmaUrl]);

  // Handle restoring to a previous Git version
  const handleRestoreVersion = useCallback(async (commitHash: string) => {
    if (isRestoring || isBuilding) return;

    const confirmed = window.confirm(
      `This will create a new branch from commit ${commitHash.slice(0, 7)} and switch to it.\n\nAny uncommitted changes will need to be committed or stashed first.\n\nContinue?`
    );

    if (!confirmed) return;

    setIsRestoring(true);
    try {
      const response = await fetch('/api/v2/git/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectDir, commitHash }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to restore');
      }

      setCurrentCommitHash(data.commit.hash);
      alert(
        `Successfully restored to version ${data.commit.shortHash}\n\nNew branch created: ${data.branch}\n\nYou may need to refresh the page to see the restored state.`
      );

      // Reload the page to reflect the restored state
      window.location.reload();
    } catch (error) {
      alert(`Failed to restore: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRestoring(false);
    }
  }, [projectDir, isRestoring, isBuilding]);

  // Handle Figma extraction and build
  const handleFigmaBuild = useCallback(async () => {
    if (isExtractingFigma) return; // Prevent double-calls
    setIsExtractingFigma(true);
    setFigmaError(null);

    try {
      // Call the Figma build handler if provided
      if (onStartFigmaBuild) {
        // Parent handles the async extraction - don't await, just trigger
        // isExtractingFigma stays true until isBuilding becomes true (handled by useEffect)
        onStartFigmaBuild(figmaUrl, figmaContext || userPrompt);
        // Don't reset isExtractingFigma here - let the build start useEffect handle it
        return;
      } else {
        // Fallback: extract requirements from Figma and use regular build
        const extractResponse = await fetch('/api/figma/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ figmaUrl }),
        });

        if (!extractResponse.ok) {
          throw new Error('Failed to extract Figma design');
        }

        const { designContext } = await extractResponse.json();

        // Build requirements from Figma context
        const requirements = `
Build from Figma Design: ${designContext?.name || 'Untitled'}

${figmaContext || userPrompt ? `Additional Context: ${figmaContext || userPrompt}` : ''}

Design Requirements:
${designContext?.requirements || 'Implement the design as shown in the Figma file.'}
        `.trim();

        onStartBuild(requirements);
        setIsExtractingFigma(false);
      }
    } catch (error) {
      setFigmaError(error instanceof Error ? error.message : 'Failed to process Figma design');
      setWorkspaceState('idle');
      setIsExtractingFigma(false);
    }
  }, [figmaUrl, figmaContext, userPrompt, onStartBuild, onStartFigmaBuild, isExtractingFigma]);

  const handleContextComplete = useCallback(() => {
    setWorkspaceState('building');
    onStartBuild(pendingBuildPrompt);
    setPendingBuildPrompt('');
  }, [pendingBuildPrompt, onStartBuild]);

  const handleContextCancel = useCallback(() => {
    setWorkspaceState('idle');
    setPendingBuildPrompt('');
    setFigmaError(null);
  }, []);

  const handleResearchBuild = useCallback((requirements: string) => {
    setWorkspaceState('idle');
    onUserPromptChange(requirements);
    // After a brief delay, trigger context loading
    setTimeout(() => {
      setPendingBuildPrompt(requirements);
      setWorkspaceState('context-loading');
    }, 100);
  }, [onUserPromptChange]);

  // Handle document upload for requirements
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.doc') && !fileName.endsWith('.docx')) {
      alert('The older .doc format is not supported. Please save as .docx');
      return;
    }

    setIsProcessingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/extract-text', { method: 'POST', body: formData });

      if (!response.ok) {
        throw new Error('Failed to extract text from file');
      }

      const { text } = await response.json();

      if (text && text.trim()) {
        setContextDocuments(prev => [...prev, { name: file.name, text, size: file.size }]);
      }
    } catch (error) {
      console.error('File upload error:', error);
      alert('Failed to process file. Please try again.');
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [userPrompt, onUserPromptChange]);

  // Trigger Figma extraction when entering figma-extracting state
  useEffect(() => {
    if (workspaceState === 'figma-extracting' && !isExtractingFigma) {
      handleFigmaBuild();
    }
  }, [workspaceState, isExtractingFigma, handleFigmaBuild]);

  // Trigger text build when entering text-starting state (after brief loading animation)
  useEffect(() => {
    if (workspaceState === 'text-starting') {
      // Delay the actual build to show loading animation
      const timer = setTimeout(() => {
        console.log('[ProjectWorkspace] Text loading complete, calling onStartBuild');
        // Combine user prompt with any uploaded context documents
        let fullRequirements = userPrompt.trim();
        if (contextDocuments.length > 0) {
          const docsContent = contextDocuments
            .map(doc => `=== Document: ${doc.name} ===\n${doc.text}`)
            .join('\n\n');
          fullRequirements = fullRequirements
            ? `${fullRequirements}\n\n${docsContent}`
            : docsContent;
        }
        onStartBuild(fullRequirements);
      }, 1500); // Show loading for 1.5 seconds
      return () => clearTimeout(timer);
    }
  }, [workspaceState, userPrompt, contextDocuments, onStartBuild]);

  // Reset extracting/starting state when build actually starts (isBuilding becomes true)
  useEffect(() => {
    if (isBuilding && (workspaceState === 'figma-extracting' || workspaceState === 'text-starting')) {
      setWorkspaceState('idle');
      setIsExtractingFigma(false);
    }
  }, [isBuilding, workspaceState]);

  // Show loading state when preparing build (Figma or text)
  const isPreparingBuild = workspaceState === 'figma-extracting' || workspaceState === 'text-starting';
  const isFigmaPreparing = workspaceState === 'figma-extracting';

  // Animate progress and messages when preparing build
  useEffect(() => {
    if (!isPreparingBuild) {
      setLaunchProgress(0);
      setLaunchMessage('');
      return;
    }

    // Use appropriate messages based on build type
    const messages = isFigmaPreparing ? FIGMA_LAUNCH_MESSAGES : TEXT_LAUNCH_MESSAGES;

    // Set initial message
    setLaunchMessage(messages[0]);
    setLaunchProgress(5);

    // Message rotation with progress tied to message index
    let messageIndex = 0;
    const messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % messages.length;
      setLaunchMessage(messages[messageIndex]);
      // Progress is based on message position for accuracy
      const targetProgress = Math.min(90, Math.round((messageIndex / (messages.length - 1)) * 85) + 5);
      setLaunchProgress(targetProgress);
    }, 3500); // Slower rotation: 3.5 seconds per message

    // Smooth progress animation between message milestones
    const progressInterval = setInterval(() => {
      setLaunchProgress(prev => {
        const targetProgress = Math.min(90, Math.round((messageIndex / (messages.length - 1)) * 85) + 5);
        if (prev >= targetProgress - 2) return prev;
        return prev + 1;
      });
    }, 500);

    return () => {
      clearInterval(progressInterval);
      clearInterval(messageInterval);
    };
  }, [isPreparingBuild, isFigmaPreparing]);

  // If in research mode, show full-screen research interface
  if (workspaceState === 'research') {
    return (
      <ResearchMode
        projectId={projectId}
        projectDir={projectDir}
        onClose={() => setWorkspaceState('idle')}
        onStartBuild={handleResearchBuild}
      />
    );
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* History Sidebar - collapsible, controls its own width */}
      <div className="flex-shrink-0 overflow-hidden">
        <HistorySidebar
          projectId={projectId}
          projectDirectory={projectDir}
          isBuilding={isBuilding}
          currentBuildNumber={selectedBuildNumber}
          onSelectBuild={setSelectedBuildNumber}
          onNewBuild={() => {
            setSelectedBuildNumber(undefined);
            onUserPromptChange('');
          }}
          currentBuildMetrics={{
            filesCreated: buildMetrics.filesCreated,
            linesOfCode: buildMetrics.linesOfCode,
            elapsedTime: buildMetrics.elapsedTime,
          }}
          currentTestingMetrics={{
            totalTests: testingMetrics.totalTests,
          }}
          currentStoryCount={tasks.length}
          onRestoreVersion={handleRestoreVersion}
          onShowProjectContext={onShowProjectContext}
          defaultCollapsed={true}
        />
      </div>

      {/* Main Workspace */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-6 max-w-6xl mx-auto space-y-6">
            {/* Last Build Success Banner (if just completed) */}
            {lastBuildPrompt && !isBuilding && (
              <Card className="bg-gradient-to-r from-emerald-950/30 to-green-950/20 border-emerald-500/30">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-bold text-emerald-400">Build Complete!</h3>
                        <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                          Latest
                        </Badge>
                      </div>
                      <button
                        onClick={() => setExpandedLastBuild(!expandedLastBuild)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {expandedLastBuild ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        {`"${lastBuildPrompt.length > 60 ? lastBuildPrompt.slice(0, 60) + '...' : lastBuildPrompt}"`}
                      </button>
                      {expandedLastBuild && (
                        <div className="mt-3 flex items-center gap-4 text-xs">
                          <div className="flex items-center gap-1.5">
                            <FileCode className="h-3.5 w-3.5 text-blue-400" />
                            <span className="font-medium">+{buildMetrics.filesCreated}</span>
                            <span className="text-muted-foreground">files</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Code2 className="h-3.5 w-3.5 text-purple-400" />
                            <span className="font-medium">+{buildMetrics.linesOfCode.toLocaleString()}</span>
                            <span className="text-muted-foreground">LOC</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <TestTube className="h-3.5 w-3.5 text-green-400" />
                            <span className="font-medium">{testingMetrics.passRate}%</span>
                            <span className="text-muted-foreground">pass</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-amber-400" />
                            <span className="font-medium">{formatDuration(buildMetrics.elapsedTime)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Main Build Prompt Card */}
            <Card className="bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border-indigo-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3">
                  <div className={cn(
                    "h-12 w-12 rounded-xl flex items-center justify-center shadow-lg",
                    buildSource === 'figma'
                      ? "bg-gradient-to-br from-purple-500 to-pink-600 shadow-purple-500/20"
                      : "bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/20"
                  )}>
                    {buildSource === 'figma' ? (
                      <Figma className="h-6 w-6 text-white" />
                    ) : (
                      <Sparkles className="h-6 w-6 text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <span className="text-xl font-bold">What would you like to build?</span>
                    <p className="text-sm text-muted-foreground font-normal mt-0.5">
                      {buildSource === 'figma'
                        ? 'Import from Figma design file'
                        : 'Describe new features, improvements, or changes'}
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Source toggle */}
                <div className="flex gap-2 p-1 bg-muted/30 rounded-lg w-fit">
                  <Button
                    variant={buildSource === 'text' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setBuildSource('text')}
                    className={cn(
                      "h-8 px-4",
                      buildSource === 'text'
                        ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    disabled={isBuilding}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Text
                  </Button>
                  <Button
                    variant={buildSource === 'figma' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setBuildSource('figma')}
                    className={cn(
                      "h-8 px-4",
                      buildSource === 'figma'
                        ? "bg-purple-600 hover:bg-purple-700 text-white"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    disabled={isBuilding || !figmaConfigured}
                  >
                    <Figma className="h-4 w-4 mr-2" />
                    Figma
                    {!figmaConfigured && (
                      <span className="ml-1 text-[10px] opacity-60">(Not configured)</span>
                    )}
                  </Button>
                </div>

                {/* Figma source UI */}
                {buildSource === 'figma' ? (
                  <div className="space-y-4">
                    {/* Figma URL input */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        Figma Design URL
                      </label>
                      <div className="relative">
                        <Input
                          value={figmaUrl}
                          onChange={(e) => {
                            setFigmaUrl(e.target.value);
                            setFigmaError(null);
                          }}
                          placeholder="https://www.figma.com/design/xxxxx/..."
                          className={cn(
                            "pl-10 bg-background/50",
                            figmaError
                              ? "border-red-500/50 focus:ring-red-500/50"
                              : "border-purple-500/30 focus:ring-purple-500/50"
                          )}
                          disabled={isBuilding}
                        />
                        <Figma className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-400" />
                        {figmaUrl && isValidFigmaUrl(figmaUrl) && (
                          <a
                            href={figmaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 hover:text-purple-300"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                      {figmaError && (
                        <div className="flex items-center gap-1.5 text-xs text-red-400">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {figmaError}
                        </div>
                      )}
                    </div>

                    {/* Additional context for Figma */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        Additional Context (optional)
                      </label>
                      <Textarea
                        value={figmaContext}
                        onChange={(e) => setFigmaContext(e.target.value)}
                        placeholder={"Focus on the dashboard components...\nUse the existing color scheme...\nImplement responsive design..."}
                        className="min-h-[100px] text-sm bg-background/50 border-purple-500/30 placeholder:text-muted-foreground/40 resize-none focus:ring-purple-500/50"
                        disabled={isBuilding}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Text source UI - AI-enhanced textarea */}
                    <AITextarea
                      value={userPrompt}
                      onValueChange={onUserPromptChange}
                      placeholder={"Add dark mode support with a toggle in the header...\n\nImplement user profile page with avatar upload...\n\nAdd real-time notifications using WebSocket...\n\nIntegrate payment processing with Stripe...\n\nAdd email notifications for user actions..."}
                      className="min-h-[280px] text-sm"
                      aiContext={`Project: ${projectName}`}
                      shortcutLabel="to build"
                      disabled={isBuilding}
                    />

                    {/* Document upload */}
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isBuilding || isProcessingFile}
                        className="h-8 text-xs border-indigo-500/30 hover:bg-indigo-500/10"
                      >
                        {isProcessingFile ? (
                          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-1.5" />
                        )}
                        Upload Doc
                      </Button>
                      <span className="text-xs text-muted-foreground">PDF, DOCX, MD, TXT</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.md,.pdf,.docx"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </div>

                    {/* Display uploaded documents */}
                    {contextDocuments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {contextDocuments.map((doc, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-indigo-500/20 border border-indigo-500/30 text-xs"
                          >
                            <FileText className="h-3.5 w-3.5 text-indigo-400" />
                            <span className="text-indigo-300 font-medium">{doc.name}</span>
                            <span className="text-indigo-400/60">({(doc.size / 1024).toFixed(1)}KB)</span>
                            <button
                              onClick={() => setContextDocuments(prev => prev.filter((_, i) => i !== index))}
                              className="ml-0.5 text-indigo-400 hover:text-indigo-300"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Quick suggestion chips - categorized */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Features</span>
                        <div className="flex-1 h-px bg-border/50" />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {['Add dark mode', 'Add search', 'Add auth', 'Add notifications', 'Add file upload'].map(suggestion => (
                          <Button
                            key={suggestion}
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-indigo-500/30 hover:bg-indigo-500/10 hover:border-indigo-500/50"
                            onClick={() => onUserPromptChange(userPrompt + (userPrompt ? '\n' : '') + suggestion)}
                            disabled={isBuilding}
                          >
                            {suggestion}
                          </Button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Improvements</span>
                        <div className="flex-1 h-px bg-border/50" />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {['Improve mobile layout', 'Optimize performance', 'Add error handling', 'Improve accessibility', 'Add loading states'].map(suggestion => (
                          <Button
                            key={suggestion}
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-500/50 text-emerald-400"
                            onClick={() => onUserPromptChange(userPrompt + (userPrompt ? '\n' : '') + suggestion)}
                            disabled={isBuilding}
                          >
                            {suggestion}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Action buttons */}
                <div className="flex gap-3 pt-2">
                  {isPreparingBuild ? (
                    /* Build preparation progress bar - different styling for Figma vs Text */
                    <div className={cn(
                      "flex-1 rounded-lg p-4 border",
                      isFigmaPreparing
                        ? "bg-gradient-to-r from-purple-600/10 to-pink-600/10 border-purple-500/30"
                        : "bg-gradient-to-r from-indigo-600/10 to-purple-600/10 border-indigo-500/30"
                    )}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className={cn(
                          "h-10 w-10 rounded-lg flex items-center justify-center",
                          isFigmaPreparing ? "bg-purple-500/20" : "bg-indigo-500/20"
                        )}>
                          {isFigmaPreparing ? (
                            <Figma className="h-5 w-5 text-purple-400" />
                          ) : (
                            <Sparkles className="h-5 w-5 text-indigo-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={cn(
                            "text-sm font-semibold",
                            isFigmaPreparing ? "text-purple-300" : "text-indigo-300"
                          )}>
                            {launchMessage || (isFigmaPreparing ? 'Connecting to Figma...' : 'Preparing build...')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {isFigmaPreparing ? 'Extracting design from Figma' : 'Setting up build environment'}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleContextCancel}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </Button>
                      </div>
                      <Progress value={launchProgress} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-2 text-right">{launchProgress}%</p>
                    </div>
                  ) : (
                    /* Normal build button */
                    <Button
                      onClick={handleStartBuild}
                      disabled={isBuilding || (buildSource === 'text' ? (!userPrompt.trim() && contextDocuments.length === 0) : !figmaUrl.trim())}
                      className={cn(
                        "flex-1 text-white shadow-lg h-14 text-base font-semibold",
                        buildSource === 'figma'
                          ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-purple-500/20"
                          : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-indigo-500/20"
                      )}
                    >
                      {isBuilding ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin mr-2" />
                          Building...
                        </>
                      ) : buildSource === 'figma' ? (
                        <>
                          <Figma className="h-5 w-5 mr-2" />
                          Build from Figma
                        </>
                      ) : (
                        <>
                          <Play className="h-5 w-5 mr-2" />
                          Start Build
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setWorkspaceState('research')}
                    disabled={isBuilding || isPreparingBuild}
                    className="border-cyan-500/30 hover:bg-cyan-500/10 hover:border-cyan-500/50 h-14 px-6"
                  >
                    <Search className="h-5 w-5 mr-2" />
                    Research
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Research Suggestions (if available) */}
            {(researchSuggestions.length > 0 || isResearching) && (
              <Card className="bg-gradient-to-br from-cyan-500/10 to-teal-500/5 border-cyan-500/30">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Lightbulb className="h-4 w-4 text-yellow-400" />
                    AI Suggestions
                    {isResearching && (
                      <Badge variant="outline" className="ml-auto text-[10px] border-cyan-500/50 text-cyan-400 animate-pulse">
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Analyzing...
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isResearching && researchSuggestions.length === 0 ? (
                    <div className="flex items-center justify-center py-6 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      <span className="text-sm">Analyzing your project...</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {researchSuggestions.slice(0, 4).map((suggestion) => (
                        <div
                          key={suggestion.id}
                          className="bg-background/50 border border-border/50 rounded-lg p-3 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all cursor-pointer group"
                          onClick={() => !isBuilding && onAddSuggestionToBacklog(suggestion)}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[9px] px-1.5 py-0',
                                suggestion.priority === 'high' && 'border-red-500/50 text-red-400',
                                suggestion.priority === 'medium' && 'border-yellow-500/50 text-yellow-400',
                                suggestion.priority === 'low' && 'border-green-500/50 text-green-400'
                              )}
                            >
                              {suggestion.priority}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">{suggestion.category}</span>
                          </div>
                          <h4 className="text-sm font-medium group-hover:text-cyan-300 transition-colors">
                            {suggestion.title}
                          </h4>
                          <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{suggestion.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {!isResearching && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onRunResearch}
                      className="w-full mt-3 border-cyan-500/30 hover:bg-cyan-500/10"
                    >
                      <Target className="h-4 w-4 mr-2" />
                      {researchSuggestions.length > 0 ? 'Get More Suggestions' : 'Analyze Project'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
