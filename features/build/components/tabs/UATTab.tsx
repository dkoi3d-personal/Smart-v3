'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bug,
  CheckCircle,
  Circle,
  ExternalLink,
  Loader2,
  Play,
  RefreshCw,
  Send,
  Terminal,
  Trash2,
  XCircle,
  AlertTriangle,
  CheckSquare,
  Database,
  ClipboardList,
  RotateCcw,
  X,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRight,
  Sparkles,
  Copy,
  Check,
  Plus,
  Smartphone,
  Monitor,
  Tablet,
  Video,
  PlayCircle,
  StopCircle,
  Workflow,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type BugCategory = 'ui' | 'functionality' | 'data' | 'navigation' | 'form' | 'performance' | 'other';
type BugReproducibility = 'always' | 'sometimes' | 'rarely' | 'once';

interface BugReport {
  id: string;
  title: string;
  description: string;
  category: BugCategory;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'analyzing' | 'fixing' | 'fixed' | 'verified' | 'rejected';
  affectedArea: string;
  stepsToReproduce: string[];
  expected: string;
  actual: string;
  errorMessages: string;
  reproducibility: BugReproducibility;
  createdAt: string;
  fixPlan?: string;
  fixApplied?: boolean;
  assignedTo?: string;
  fixedBy?: string;
  fixedAt?: string;
  // Legacy field for backward compat
  steps?: string;
}

interface TestCase {
  id: string;
  title: string;
  description: string;
  steps: string[];
  expectedResult: string;
  status: 'pending' | 'passed' | 'failed' | 'skipped';
  linkedBugId?: string;
  category: string;
}

interface SeededUser {
  email: string;
  password: string;
  role: string;
}

type SidebarView = 'bugs' | 'tests' | 'tools' | 'chat' | 'workflows';

interface UIWorkflow {
  id: string;
  name: string;
  description: string;
  steps: any[];
  createdAt: string;
  updatedAt: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  stats?: {
    runCount: number;
    passCount: number;
    failCount: number;
    passRate: number;
    avgDuration: number;
    lastRun?: {
      date: string;
      status: 'passed' | 'failed';
      duration: number;
      executionId: string;
    };
  };
}

interface WorkflowExecution {
  id: string;
  status: 'running' | 'passed' | 'failed' | 'stopped';
  summary?: {
    totalSteps: number;
    passed: number;
    failed: number;
  };
}

interface BatchExecution {
  id: string;
  status: 'running' | 'completed' | 'stopped';
  mode: 'all' | 'failed' | 'critical';
  summary?: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
}

interface BatchWorkflowResult {
  workflowId: string;
  workflowName: string;
  priority: string;
  status: 'passed' | 'failed' | 'skipped' | 'running';
  duration: number;
  error?: string;
}
type DeviceMode = 'desktop' | 'tablet' | 'mobile';

interface UATTabProps {
  projectId: string;
}

export function UATTab({ projectId }: UATTabProps) {
  // Project state
  const [projectName, setProjectName] = useState('');
  const [projectDir, setProjectDir] = useState('');

  // Preview state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'starting' | 'building' | 'ready' | 'error'>('idle');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarView, setSidebarView] = useState<SidebarView>('tools');

  // Build logs
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [showBuildLogs, setShowBuildLogs] = useState(false);

  // Bug state
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [selectedBug, setSelectedBug] = useState<BugReport | null>(null);
  const [isReportingBug, setIsReportingBug] = useState(false);
  const [isFixing, setIsFixing] = useState(false);

  // Bug form - structured fields
  const [bugTitle, setBugTitle] = useState('');
  const [bugCategory, setBugCategory] = useState<BugCategory>('functionality');
  const [bugSeverity, setBugSeverity] = useState<'critical' | 'high' | 'medium' | 'low'>('medium');
  const [bugAffectedArea, setBugAffectedArea] = useState('');
  const [bugStepsToReproduce, setBugStepsToReproduce] = useState<string[]>(['']);
  const [bugExpected, setBugExpected] = useState('');
  const [bugActual, setBugActual] = useState('');
  const [bugErrorMessages, setBugErrorMessages] = useState('');
  const [bugReproducibility, setBugReproducibility] = useState<BugReproducibility>('always');
  // Legacy field
  const [bugDescription, setBugDescription] = useState('');

  // Fix state
  const [fixInstructions, setFixInstructions] = useState('');
  const [fixLogs, setFixLogs] = useState<string[]>([]);

  // Claude terminal (with context)
  const [claudeInput, setClaudeInput] = useState('');
  const [claudeOutput, setClaudeOutput] = useState<string[]>([]);
  const [isClaudeRunning, setIsClaudeRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  // Claude chat (with session resume support)
  const [chatInput, setChatInput] = useState('');
  const [chatOutput, setChatOutput] = useState<string[]>([]);
  const [isChatRunning, setIsChatRunning] = useState(false);
  const [claudeSessionId, setClaudeSessionId] = useState<string | null>(null);
  const [canContinue, setCanContinue] = useState(false);
  const chatOutputRef = useRef<HTMLDivElement>(null);

  // Test Cases state
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [isLoadingTestCases, setIsLoadingTestCases] = useState(false);

  // Seeded Users state
  const [seededUsers, setSeededUsers] = useState<SeededUser[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Mock Data state
  const [mockDataSchemas, setMockDataSchemas] = useState<any[]>([]);
  const [mockDataConfig, setMockDataConfig] = useState<Record<string, number>>({});
  const [isLoadingSchemas, setIsLoadingSchemas] = useState(false);
  const [isSeedingData, setIsSeedingData] = useState(false);
  const [mockDataStatus, setMockDataStatus] = useState<string>('');
  const [mockDataPreview, setMockDataPreview] = useState<Record<string, any[]>>({});

  // Database state
  const [isSeedingDatabase, setIsSeedingDatabase] = useState(false);
  const [seedStatus, setSeedStatus] = useState<string>('');
  const [isRebuildingLocalDb, setIsRebuildingLocalDb] = useState(false);
  const [localDbLogs, setLocalDbLogs] = useState<string[]>([]);
  const [showLocalDbLogs, setShowLocalDbLogs] = useState(false);

  // Workflows state
  const [workflows, setWorkflows] = useState<UIWorkflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<UIWorkflow | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [recordingTask, setRecordingTask] = useState('');
  const [recordingLogs, setRecordingLogs] = useState<string[]>([]);
  const [executionResult, setExecutionResult] = useState<WorkflowExecution | null>(null);
  const [workflowScreenshot, setWorkflowScreenshot] = useState<string | null>(null);

  // Batch execution state
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchExecution | null>(null);
  const [batchProgress, setBatchProgress] = useState<BatchWorkflowResult[]>([]);
  const [currentBatchWorkflow, setCurrentBatchWorkflow] = useState<string | null>(null);
  const [workflowPriority, setWorkflowPriority] = useState<'critical' | 'high' | 'medium' | 'low'>('medium');


  // Container dimensions
  const [previewContainerHeight, setPreviewContainerHeight] = useState(800);

  const previewRef = useRef<HTMLIFrameElement>(null);
  const claudeOutputRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Load project info
  useEffect(() => {
    loadProject();
    loadBugs();
  }, [projectId]);

  const loadProject = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setProjectName(data.name || data.config?.name || projectId);
        setProjectDir(data.projectDirectory || '');
      }
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  };

  const loadBugs = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/bugs`);
      if (response.ok) {
        const data = await response.json();
        if (data.bugs && data.bugs.length > 0) {
          const normalizedBugs = data.bugs.map((bug: any) => ({
            ...bug,
            severity: normalizeSeverity(bug.severity),
            status: normalizeStatus(bug.status),
          }));
          setBugs(normalizedBugs);
        }
      }
    } catch (error) {
      console.error('Failed to load bugs:', error);
    }
  }, [projectId]);

  const normalizeSeverity = (severity: string): BugReport['severity'] => {
    const map: Record<string, BugReport['severity']> = {
      critical: 'critical', major: 'high', high: 'high',
      medium: 'medium', minor: 'low', low: 'low', cosmetic: 'low',
    };
    return map[severity?.toLowerCase()] || 'medium';
  };

  const normalizeStatus = (status: string): BugReport['status'] => {
    const map: Record<string, BugReport['status']> = {
      open: 'open', analyzing: 'analyzing', 'in-progress': 'fixing',
      fixing: 'fixing', fixed: 'fixed', verified: 'verified',
      rejected: 'rejected', 'wont-fix': 'rejected',
    };
    return map[status?.toLowerCase()] || 'open';
  };

  const saveBugsToProject = async (updatedBugs: BugReport[]) => {
    try {
      await fetch(`/api/projects/${projectId}/bugs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bugs: updatedBugs }),
      });
    } catch (error) {
      console.error('Failed to save bugs:', error);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Start preview
  const startPreview = async () => {
    setPreviewStatus('starting');
    setPreviewError(null);
    setBuildLogs(['Starting preview server...']);
    setShowBuildLogs(true);

    try {
      const response = await fetch('/api/preview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      const data = await response.json();

      if (data.success) {
        setBuildLogs(prev => [...prev, `Server ready at ${data.url}`]);
        // Small delay to let server fully initialize before showing iframe
        await new Promise(r => setTimeout(r, 1500));
        setPreviewUrl(data.url);
        setPreviewStatus('ready');
        setTimeout(() => setShowBuildLogs(false), 1000);
      } else {
        setPreviewError(data.error || 'Failed to start preview');
        setPreviewStatus('error');
        setBuildLogs(prev => [...prev, `Error: ${data.error}`]);
      }
    } catch (error) {
      setPreviewError('Failed to start preview server');
      setPreviewStatus('error');
    }
  };

  // Rebuild app
  const rebuildApp = async () => {
    setIsRebuilding(true);
    setBuildLogs(['Rebuilding application...']);
    setShowBuildLogs(true);
    setPreviewStatus('building');
    setPreviewUrl(null); // Clear URL so iframe doesn't show "refused"
    setSeedStatus('');

    try {
      setBuildLogs(prev => [...prev, 'Stopping preview server...']);
      await fetch('/api/preview/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      await new Promise(r => setTimeout(r, 500));

      setBuildLogs(prev => [...prev, 'Rebuilding local database...']);
      setBuildLogs(prev => [...prev, '  Running prisma generate...']);
      try {
        const dbResponse = await fetch('/api/uat/rebuild-local-db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId }),
        });
        const dbData = await dbResponse.json();

        if (dbData.success) {
          setBuildLogs(prev => [...prev, 'Database rebuilt and seeded!']);
          setSeedStatus('Local DB ready');
        } else if (dbData.error?.includes('No Prisma schema')) {
          setBuildLogs(prev => [...prev, 'No database schema found, skipping...']);
        } else {
          setBuildLogs(prev => [...prev, `DB warning: ${dbData.error || 'seed skipped'}`]);
        }
        // Show logs from the db rebuild
        if (dbData.logs?.length) {
          const relevantLogs = dbData.logs.slice(-5); // Last 5 logs
          relevantLogs.forEach((log: string) => {
            if (log.startsWith('===') || log.startsWith('✓') || log.includes('Error')) {
              setBuildLogs(prev => [...prev, `  ${log}`]);
            }
          });
        }
      } catch (dbError: any) {
        setBuildLogs(prev => [...prev, `DB setup skipped: ${dbError.message}`]);
      }

      setBuildLogs(prev => [...prev, 'Starting preview server...']);
      setBuildLogs(prev => [...prev, '  This may take a minute...']);

      const response = await fetch('/api/preview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, forceRebuild: true, forceDevMode: true }),
      });

      const data = await response.json();

      if (data.success) {
        setBuildLogs(prev => [...prev, `Server ready at ${data.url}`]);
        setBuildLogs(prev => [...prev, 'Rebuild complete!']);
        // Small delay to let server fully initialize
        await new Promise(r => setTimeout(r, 1500));
        setPreviewUrl(data.url);
        setPreviewStatus('ready');
        if (previewRef.current) {
          previewRef.current.src = data.url;
        }
        setTimeout(() => setShowBuildLogs(false), 1000);
      } else {
        setPreviewStatus('error');
        setPreviewError(data.error || 'Build failed');
        setBuildLogs(prev => [...prev, `Build failed: ${data.error}`]);
      }
    } catch (error: any) {
      setPreviewStatus('error');
      setPreviewError(error.message || 'Rebuild failed');
      setBuildLogs(prev => [...prev, `Rebuild failed: ${error.message || 'Unknown error'}`]);
    } finally {
      setIsRebuilding(false);
    }
  };

  // Start preview on mount
  const hasStartedRef = useRef(false);
  useEffect(() => {
    if (projectId && previewStatus === 'idle' && !hasStartedRef.current) {
      hasStartedRef.current = true;
      startPreview();
    }
  }, [projectId, previewStatus]);


  // Auto-scroll claude output
  useEffect(() => {
    if (claudeOutputRef.current) {
      claudeOutputRef.current.scrollTop = claudeOutputRef.current.scrollHeight;
    }
  }, [claudeOutput]);

  // Track container height
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setPreviewContainerHeight(entry.contentRect.height);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Helper functions for steps
  const addStep = () => setBugStepsToReproduce([...bugStepsToReproduce, '']);
  const removeStep = (index: number) => {
    if (bugStepsToReproduce.length > 1) {
      setBugStepsToReproduce(bugStepsToReproduce.filter((_, i) => i !== index));
    }
  };
  const updateStep = (index: number, value: string) => {
    const updated = [...bugStepsToReproduce];
    updated[index] = value;
    setBugStepsToReproduce(updated);
  };

  // Generate AI-friendly description from structured fields
  const generateBugDescription = (): string => {
    const steps = bugStepsToReproduce.filter(s => s.trim()).map((s, i) => `${i + 1}. ${s}`).join('\n');
    return `Category: ${bugCategory}
Affected Area: ${bugAffectedArea || 'Not specified'}
Reproducibility: ${bugReproducibility}

PROBLEM:
${bugActual}

EXPECTED:
${bugExpected}

STEPS TO REPRODUCE:
${steps || 'Not specified'}

${bugErrorMessages ? `ERROR MESSAGES:\n${bugErrorMessages}` : ''}`.trim();
  };

  // Submit bug report
  const submitBugReport = async () => {
    if (!bugTitle.trim() || !bugActual.trim()) return;

    const newBug: BugReport = {
      id: `bug-${Date.now()}`,
      title: bugTitle,
      description: generateBugDescription(),
      category: bugCategory,
      severity: bugSeverity,
      status: 'open',
      affectedArea: bugAffectedArea,
      stepsToReproduce: bugStepsToReproduce.filter(s => s.trim()),
      expected: bugExpected,
      actual: bugActual,
      errorMessages: bugErrorMessages,
      reproducibility: bugReproducibility,
      createdAt: new Date().toISOString(),
    };

    const updatedBugs = [...bugs, newBug];
    setBugs(updatedBugs);
    await saveBugsToProject(updatedBugs);

    // Reset form
    setBugTitle('');
    setBugCategory('functionality');
    setBugSeverity('medium');
    setBugAffectedArea('');
    setBugStepsToReproduce(['']);
    setBugExpected('');
    setBugActual('');
    setBugErrorMessages('');
    setBugReproducibility('always');
    setIsReportingBug(false);
    setSelectedBug(newBug);
  };

  // Request AI fix
  const requestFix = async (bug: BugReport) => {
    setIsFixing(true);
    setFixLogs(['Requesting AI fix...']);

    // Build structured bug data for AI
    const stepsText = bug.stepsToReproduce?.length
      ? bug.stepsToReproduce.map((s, i) => `${i + 1}. ${s}`).join('\n')
      : bug.steps || '';

    try {
      const response = await fetch('/api/uat/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          bugId: bug.id,
          bug: {
            title: bug.title,
            description: bug.description,
            category: bug.category || 'other',
            severity: bug.severity,
            affectedArea: bug.affectedArea || '',
            steps: stepsText,
            expected: bug.expected,
            actual: bug.actual,
            errorMessages: bug.errorMessages || '',
            reproducibility: bug.reproducibility || 'always',
          },
          additionalInstructions: fixInstructions,
        }),
      });

      const reader = response.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.log) setFixLogs(prev => [...prev, data.log]);
                if (data.status === 'complete' && data.success) {
                  const updatedBugs = bugs.map(b =>
                    b.id === bug.id ? { ...b, status: 'fixed' as const, fixApplied: true } : b
                  );
                  setBugs(updatedBugs);
                  await saveBugsToProject(updatedBugs);
                  setSelectedBug({ ...bug, status: 'fixed', fixApplied: true });
                  setFixLogs(prev => [...prev, 'Fix applied! Click Rebuild to test.']);
                }
              } catch {}
            }
          }
        }
      }
    } catch (error) {
      setFixLogs(prev => [...prev, 'Fix failed']);
    } finally {
      setIsFixing(false);
    }
  };

  const verifyFix = async (bug: BugReport) => {
    const updatedBugs = bugs.map(b => b.id === bug.id ? { ...b, status: 'verified' as const } : b);
    setBugs(updatedBugs);
    await saveBugsToProject(updatedBugs);
    setSelectedBug({ ...bug, status: 'verified' });
  };

  const rejectFix = async (bug: BugReport) => {
    const updatedBugs = bugs.map(b => b.id === bug.id ? { ...b, status: 'open' as const, fixApplied: false } : b);
    setBugs(updatedBugs);
    await saveBugsToProject(updatedBugs);
    setSelectedBug({ ...bug, status: 'open', fixApplied: false });
  };

  // Claude session
  const loadSessionHistory = useCallback(async () => {
    if (!projectId || sessionLoaded) return;
    try {
      const response = await fetch('/api/uat/claude?projectId=' + projectId);
      if (response.ok) {
        const data = await response.json();
        setSessionId(data.sessionId);
        if (data.messages && data.messages.length > 0) {
          const historyLines: string[] = [];
          for (const msg of data.messages) {
            if (msg.role === 'user') {
              historyLines.push('> ' + msg.content);
            } else {
              historyLines.push(...msg.content.split('\n'));
            }
          }
          setClaudeOutput(historyLines);
        }
        setSessionLoaded(true);
      }
    } catch (error) {
      console.error('Failed to load session history:', error);
    }
  }, [projectId, sessionLoaded]);

  const clearSessionHistory = async () => {
    if (!projectId) return;
    try {
      const response = await fetch('/api/uat/claude?projectId=' + projectId, { method: 'DELETE' });
      if (response.ok) {
        const data = await response.json();
        setSessionId(data.newSessionId);
        setClaudeOutput([]);
      }
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  };


  const runClaudeCommand = async () => {
    if (!claudeInput.trim() || isClaudeRunning) return;

    setIsClaudeRunning(true);
    setClaudeOutput(prev => [...prev, '> ' + claudeInput, 'Running...']);

    try {
      const response = await fetch('/api/uat/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, command: claudeInput }),
      });

      const reader = response.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.output) setClaudeOutput(prev => [...prev, data.output]);
                if (data.sessionId) setSessionId(data.sessionId);
              } catch {}
            }
          }
        }
      }
    } catch (error) {
      setClaudeOutput(prev => [...prev, 'Error running command']);
    } finally {
      setIsClaudeRunning(false);
      setClaudeInput('');
    }
  };

  // Chat command with session resume support
  const runChatCommand = async (continueSession = false) => {
    if (!chatInput.trim() || isChatRunning) return;

    setIsChatRunning(true);
    setCanContinue(false);
    setChatOutput(prev => [...prev, '> ' + chatInput]);

    try {
      const response = await fetch('/api/uat/claude-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          prompt: chatInput,
          claudeSessionId: continueSession ? claudeSessionId : undefined,
          continueSession,
        }),
      });

      const reader = response.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.output) setChatOutput(prev => [...prev, data.output]);
                if (data.claudeSessionId) setClaudeSessionId(data.claudeSessionId);
                if (data.status === 'complete' && data.canContinue) {
                  setCanContinue(true);
                }
              } catch {}
            }
          }
        }
      }
    } catch (error) {
      setChatOutput(prev => [...prev, 'Error running command']);
    } finally {
      setIsChatRunning(false);
      setChatInput('');
    }
  };

  // Continue the previous session
  const continueChat = () => {
    if (!claudeSessionId || isChatRunning) return;
    setChatInput('Continue where you left off');
    // Small delay to show input, then run
    setTimeout(() => runChatCommand(true), 100);
  };

  const clearChatOutput = () => {
    setChatOutput([]);
    setClaudeSessionId(null);
    setCanContinue(false);
  };

  // Auto-scroll chat output
  useEffect(() => {
    if (chatOutputRef.current) {
      chatOutputRef.current.scrollTop = chatOutputRef.current.scrollHeight;
    }
  }, [chatOutput]);

  // Test cases
  const loadTestCases = async () => {
    setIsLoadingTestCases(true);
    try {
      const response = await fetch(`/api/uat/test-cases?projectId=${projectId}`);
      const data = await response.json();
      if (data.success) setTestCases(data.testCases);
    } catch (error) {
      console.error('Failed to load test cases:', error);
    } finally {
      setIsLoadingTestCases(false);
    }
  };

  const updateTestCaseStatus = async (testCaseId: string, status: TestCase['status']) => {
    const updated = testCases.map(tc => tc.id === testCaseId ? { ...tc, status } : tc);
    setTestCases(updated);
    await fetch('/api/uat/test-cases', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, testCases: updated }),
    });
  };

  // Mock data
  const loadSchemas = async () => {
    setIsLoadingSchemas(true);
    setMockDataStatus('Scanning for schemas...');
    try {
      const response = await fetch(`/api/uat/mock-data?projectId=${projectId}`);
      const data = await response.json();
      if (data.success) {
        setMockDataSchemas(data.schemas);
        const defaults: Record<string, number> = {};
        data.schemas.forEach((s: any) => { defaults[s.name] = 10; });
        setMockDataConfig(defaults);
        setMockDataStatus(`Found ${data.schemas.length} schemas`);
      }
    } catch {
      setMockDataStatus('Failed to scan schemas');
    } finally {
      setIsLoadingSchemas(false);
    }
  };

  const seedMockData = async () => {
    if (mockDataSchemas.length === 0) return;
    setIsSeedingData(true);
    setMockDataStatus('Generating...');
    try {
      const response = await fetch('/api/uat/mock-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, schemas: mockDataSchemas, counts: mockDataConfig }),
      });
      const data = await response.json();
      if (data.success) {
        const totalRecords = Object.values(data.summary as Record<string, number>).reduce((a, b) => a + b, 0);
        setMockDataStatus(`Generated ${totalRecords} records`);
        setMockDataPreview(data.preview || {});

        const preview = data.preview || {};
        const userKey = Object.keys(preview).find(k =>
          k.toLowerCase() === 'user' || k.toLowerCase() === 'users' || k.toLowerCase() === 'account'
        );
        if (userKey && preview[userKey]) {
          const users = preview[userKey].map((u: any) => ({
            email: u.email || u.Email || '',
            password: u.password || u.Password || 'password123',
            role: u.role || u.Role || 'user',
          })).filter((u: SeededUser) => u.email);
          setSeededUsers(users);
        }
      } else {
        setMockDataStatus(`Error: ${data.error}`);
      }
    } catch {
      setMockDataStatus('Failed to generate data');
    } finally {
      setIsSeedingData(false);
    }
  };

  const rebuildLocalDb = async () => {
    setIsRebuildingLocalDb(true);
    setLocalDbLogs(['Starting local database rebuild...']);
    setShowLocalDbLogs(true);
    setSeedStatus('');

    try {
      const response = await fetch('/api/uat/rebuild-local-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      const data = await response.json();
      if (data.logs) setLocalDbLogs(data.logs);

      if (data.success) {
        setSeedStatus('Local DB rebuilt and seeded!');
        if (previewRef.current && previewUrl) {
          previewRef.current.src = previewUrl + '?t=' + Date.now();
        }
      } else {
        setSeedStatus(`Error: ${data.error}`);
      }
    } catch (error: any) {
      setSeedStatus(`Error: ${error.message}`);
      setLocalDbLogs(prev => [...prev, `Error: ${error.message}`]);
    } finally {
      setIsRebuildingLocalDb(false);
    }
  };

  const seedDatabase = async () => {
    if (Object.keys(mockDataPreview).length === 0) {
      setSeedStatus('Generate mock data first');
      return;
    }
    setIsSeedingDatabase(true);
    setSeedStatus('Seeding database...');
    try {
      const response = await fetch('/api/uat/seed-database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, clearExisting: true }),
      });
      const data = await response.json();
      if (data.success) {
        setSeedStatus(`Seeded ${data.totalRecords} records`);

        const userKey = Object.keys(mockDataPreview).find(k =>
          k.toLowerCase() === 'user' || k.toLowerCase() === 'users' || k.toLowerCase() === 'account'
        );
        if (userKey && mockDataPreview[userKey]) {
          const users = mockDataPreview[userKey].map((u: any) => ({
            email: u.email || u.Email || '',
            password: u.password || u.Password || 'password123',
            role: u.role || u.Role || 'user',
          })).filter((u: SeededUser) => u.email);
          setSeededUsers(users);
        }
      } else {
        setSeedStatus(`Error: ${data.error}`);
      }
    } catch {
      setSeedStatus('Failed to seed database');
    } finally {
      setIsSeedingDatabase(false);
    }
  };

  const handleFixBuildError = () => {
    const errorContext = buildLogs.filter(log =>
      log.includes('Error') || log.includes('failed') || log.includes('error')
    ).join('\n');

    const prompt = `Please fix this build error:\n\n${errorContext || previewError}\n\nAnalyze the error and fix the underlying issue in the code.`;

    setClaudeInput(prompt);
    setSidebarOpen(true);
    setSidebarView('chat');
  };

  // Workflow functions
  const loadWorkflows = async () => {
    try {
      const response = await fetch(`/api/uat/workflows?projectId=${projectId}`);
      const data = await response.json();
      if (data.success) {
        setWorkflows(data.workflows);
      }
    } catch (error) {
      console.error('Failed to load workflows:', error);
    }
  };

  const recordWorkflow = async () => {
    if (!recordingTask.trim() || !previewUrl) return;

    setIsRecording(true);
    setRecordingLogs(['Starting workflow recording...']);
    setWorkflowScreenshot(null);

    try {
      const response = await fetch('/api/uat/workflows/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          startUrl: previewUrl,
          task: recordingTask,
          priority: workflowPriority,
        }),
      });

      const reader = response.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              const eventType = line.slice(7);
              continue;
            }
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.text) setRecordingLogs(prev => [...prev, data.text]);
                if (data.screenshot) setWorkflowScreenshot(data.screenshot);
                if (data.workflow) {
                  // Save workflow to backend
                  fetch('/api/uat/workflows', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      projectId,
                      workflow: data.workflow,
                    }),
                  }).then(res => res.json()).then(saveResult => {
                    if (saveResult.success) {
                      setWorkflows(prev => [...prev, saveResult.workflow]);
                      setSelectedWorkflow(saveResult.workflow);
                      setRecordingLogs(prev => [...prev, `Workflow "${data.workflow.name}" saved with ${data.workflow.steps.length} steps`]);
                    } else {
                      setRecordingLogs(prev => [...prev, `Failed to save workflow: ${saveResult.error}`]);
                    }
                  }).catch(() => {
                    // Fallback to local state if save fails
                    setWorkflows(prev => [...prev, data.workflow]);
                    setSelectedWorkflow(data.workflow);
                    setRecordingLogs(prev => [...prev, `Workflow recorded locally (save failed)`]);
                  });
                }
                if (data.error) setRecordingLogs(prev => [...prev, `Error: ${data.error}`]);
              } catch {}
            }
          }
        }
      }
    } catch (error) {
      setRecordingLogs(prev => [...prev, 'Recording failed']);
    } finally {
      setIsRecording(false);
      setRecordingTask('');
    }
  };

  const executeWorkflow = async (workflow: UIWorkflow) => {
    if (!previewUrl) return;

    setIsExecuting(true);
    setExecutionResult(null);
    setRecordingLogs(['Executing workflow...']);
    setWorkflowScreenshot(null);

    try {
      const response = await fetch('/api/uat/workflows/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          workflowId: workflow.id,
          previewUrl,
          options: {
            screenshotEachStep: true,
            autoFix: true,
          },
        }),
      });

      const reader = response.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.status) setRecordingLogs(prev => [...prev, `Status: ${data.status}`]);
                if (data.screenshot) setWorkflowScreenshot(data.screenshot);
                if (data.execution) {
                  setExecutionResult(data.execution);
                  const { summary } = data.execution;
                  if (summary) {
                    setRecordingLogs(prev => [
                      ...prev,
                      `Execution complete: ${summary.passed}/${summary.totalSteps} passed, ${summary.failed} failed`
                    ]);
                  }
                  // Reload workflows to get updated stats
                  loadWorkflows();
                }
                if (data.error) setRecordingLogs(prev => [...prev, `Error: ${data.error}`]);
              } catch {}
            }
          }
        }
      }
    } catch (error) {
      setRecordingLogs(prev => [...prev, 'Execution failed']);
    } finally {
      setIsExecuting(false);
    }
  };

  const deleteWorkflow = async (workflowId: string) => {
    try {
      await fetch(`/api/uat/workflows?projectId=${projectId}&workflowId=${workflowId}`, {
        method: 'DELETE',
      });
      setWorkflows(prev => prev.filter(w => w.id !== workflowId));
      if (selectedWorkflow?.id === workflowId) {
        setSelectedWorkflow(null);
      }
    } catch (error) {
      console.error('Failed to delete workflow:', error);
    }
  };

  // Batch execution functions
  const runAllWorkflows = async (mode: 'all' | 'failed' | 'critical' = 'all') => {
    if (!previewUrl || isBatchRunning) return;

    setIsBatchRunning(true);
    setBatchResult(null);
    setBatchProgress([]);
    setCurrentBatchWorkflow(null);
    setRecordingLogs([`Starting ${mode} workflow regression test...`]);

    try {
      const response = await fetch('/api/uat/workflows/run-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          previewUrl,
          mode,
          autoFix: true,
        }),
      });

      const reader = response.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.totalWorkflows) {
                  setRecordingLogs(prev => [...prev, `Running ${data.totalWorkflows} workflows (${data.mode} mode)`]);
                }

                if (data.workflowName && data.index) {
                  setCurrentBatchWorkflow(data.workflowId);
                  setRecordingLogs(prev => [...prev, `[${data.index}/${data.total}] Running: ${data.workflowName}`]);
                }

                if (data.status && data.workflowId) {
                  const result: BatchWorkflowResult = {
                    workflowId: data.workflowId,
                    workflowName: data.workflowName || data.workflowId,
                    priority: data.priority || 'medium',
                    status: data.status,
                    duration: data.duration || 0,
                    error: data.error,
                  };
                  setBatchProgress(prev => {
                    const existing = prev.findIndex(p => p.workflowId === data.workflowId);
                    if (existing >= 0) {
                      const updated = [...prev];
                      updated[existing] = result;
                      return updated;
                    }
                    return [...prev, result];
                  });

                  if (data.status === 'passed' || data.status === 'failed') {
                    setRecordingLogs(prev => [
                      ...prev,
                      `  ${data.status === 'passed' ? '✅' : '❌'} ${data.workflowName}: ${data.status} (${Math.round(data.duration / 1000)}s)`
                    ]);
                  }
                }

                if (data.summary) {
                  setBatchResult({
                    id: data.batchId || `batch-${Date.now()}`,
                    status: 'completed',
                    mode,
                    summary: data.summary,
                  });
                  setRecordingLogs(prev => [
                    ...prev,
                    ``,
                    `=== REGRESSION COMPLETE ===`,
                    `Passed: ${data.summary.passed}/${data.summary.total}`,
                    `Failed: ${data.summary.failed}`,
                    `Pass Rate: ${data.passRate}%`,
                    `Duration: ${Math.round(data.summary.duration / 1000)}s`,
                  ]);
                  // Reload workflows to get updated stats
                  loadWorkflows();
                }

                if (data.error && !data.workflowId) {
                  setRecordingLogs(prev => [...prev, `Error: ${data.error}`]);
                }
              } catch {}
            }
          }
        }
      }
    } catch (error) {
      setRecordingLogs(prev => [...prev, 'Batch execution failed']);
    } finally {
      setIsBatchRunning(false);
      setCurrentBatchWorkflow(null);
    }
  };

  const getWorkflowStatusIcon = (workflow: UIWorkflow) => {
    if (!workflow.stats?.lastRun) return <Circle className="h-3 w-3 text-gray-400" />;
    if (workflow.stats.lastRun.status === 'passed') return <CheckCircle className="h-3 w-3 text-green-500" />;
    return <XCircle className="h-3 w-3 text-red-500" />;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-600 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const failedWorkflowCount = workflows.filter(w => w.stats?.lastRun?.status === 'failed').length;

  // Stats
  const openBugs = bugs.filter(b => b.status === 'open').length;
  const fixedBugs = bugs.filter(b => b.status === 'fixed' || b.status === 'verified').length;
  const testsPassed = testCases.filter(tc => tc.status === 'passed').length;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-600';
      case 'high': return 'bg-orange-600';
      case 'medium': return 'bg-yellow-600';
      case 'low': return 'bg-blue-600';
      default: return 'bg-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <Circle className="h-3 w-3 text-red-500" />;
      case 'fixing': return <Loader2 className="h-3 w-3 text-orange-500 animate-spin" />;
      case 'fixed': return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'verified': return <CheckSquare className="h-3 w-3 text-green-600" />;
      default: return <Circle className="h-3 w-3 text-gray-500" />;
    }
  };

  const DEVICE_DIMENSIONS = {
    mobile: { width: 390, height: 844, label: 'iPhone 14' },
    tablet: { width: 820, height: 1180, label: 'iPad Air' },
    desktop: { width: 0, height: 0, label: 'Desktop' },
  };

  return (
    <div className="h-full flex bg-background overflow-hidden">
      {/* Preview Area */}
      <div className={cn("flex-1 flex flex-col relative", isFullscreen && "fixed inset-0 z-50 bg-background")}>
        {/* Sidebar Toggle Button - when collapsed */}
        {!sidebarOpen && !isFullscreen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute top-4 right-4 z-10 p-2 bg-card border rounded-lg shadow-lg hover:bg-accent transition-colors"
            title="Open sidebar"
          >
            <PanelRight className="h-4 w-4" />
          </button>
        )}
        {/* Preview Content */}
        <div
          ref={previewContainerRef}
          className="flex-1 relative flex items-center justify-center bg-muted/30 overflow-auto p-4"
        >
          {previewStatus === 'ready' && previewUrl ? (
            <div className={cn(
              "transition-all duration-300 flex-shrink-0",
              deviceMode === 'desktop' ? 'w-full h-full' : '',
              deviceMode !== 'desktop' && "rounded-[2.5rem] border-[12px] border-gray-800 bg-gray-800 shadow-2xl overflow-hidden"
            )}>
              {deviceMode === 'mobile' && (
                <div className="h-8 bg-gray-800 flex items-center justify-center relative">
                  <div className="w-28 h-6 bg-black rounded-full" />
                </div>
              )}
              <div
                className={cn(
                  "bg-background overflow-hidden",
                  deviceMode === 'desktop' ? 'w-full h-full' : '',
                )}
                style={deviceMode !== 'desktop' ? {
                  width: DEVICE_DIMENSIONS[deviceMode].width,
                  height: deviceMode === 'mobile'
                    ? Math.min(DEVICE_DIMENSIONS[deviceMode].height - 52, previewContainerHeight - 100)
                    : Math.min(DEVICE_DIMENSIONS[deviceMode].height, previewContainerHeight - 80),
                } : undefined}
              >
                <iframe
                  ref={previewRef}
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title="App Preview"
                />
              </div>
              {deviceMode === 'mobile' && (
                <div className="h-6 bg-gray-800 flex items-center justify-center">
                  <div className="w-32 h-1.5 bg-gray-600 rounded-full" />
                </div>
              )}
            </div>
          ) : (
            <div className="text-center">
              {previewStatus === 'starting' || previewStatus === 'building' ? (
                <>
                  <Loader2 className="h-10 w-10 animate-spin mx-auto mb-3 text-orange-500" />
                  <p className="text-muted-foreground">
                    {previewStatus === 'building' ? 'Rebuilding...' : 'Starting preview...'}
                  </p>
                </>
              ) : previewStatus === 'error' ? (
                <>
                  <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-red-500" />
                  <p className="text-red-500 mb-3 max-w-md">{previewError}</p>
                  <div className="flex gap-2 justify-center">
                    <Button onClick={startPreview} variant="outline">
                      <RefreshCw className="h-4 w-4 mr-2" />Retry
                    </Button>
                    <Button onClick={handleFixBuildError} className="bg-orange-600 hover:bg-orange-700">
                      <Sparkles className="h-4 w-4 mr-2" />Fix with AI
                    </Button>
                  </div>
                </>
              ) : (
                <Button onClick={startPreview} size="lg">
                  <Play className="h-5 w-5 mr-2" />Start Preview
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Build Log Drawer */}
        {showBuildLogs && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/95 border-t max-h-48 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1 border-b border-white/10">
              <span className="text-xs text-white/70">Build Output</span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowBuildLogs(false)}>
                <X className="h-3 w-3 text-white/70" />
              </Button>
            </div>
            <ScrollArea className="h-36">
              <div className="p-2 font-mono text-xs space-y-0.5">
                {buildLogs.map((log, i) => (
                  <div key={i} className={cn(
                    log.includes('Error') || log.includes('failed') ? 'text-red-400' :
                    log.includes('complete') || log.includes('ready') ? 'text-green-400' : 'text-white/70'
                  )}>{log}</div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Sidebar */}
      {sidebarOpen && !isFullscreen && (
        <div className="relative w-[400px] border-l bg-card flex flex-col">
          {/* Collapse button on left edge */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-6 h-12 bg-card border rounded-l-md shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Close sidebar"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
          {/* Sidebar Tabs */}
          <div className="flex border-b flex-shrink-0">
            {[
              { id: 'tools', icon: Monitor, label: 'Tools', color: 'text-purple-500' },
              { id: 'workflows', icon: Workflow, label: 'Workflows', color: 'text-green-500', badge: workflows.length },
              { id: 'bugs', icon: Bug, label: 'Bugs', color: 'text-red-500', badge: bugs.length },
              { id: 'tests', icon: ClipboardList, label: 'Tests', color: 'text-blue-500' },
              { id: 'chat', icon: Terminal, label: 'Agent', color: 'text-orange-500' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setSidebarView(tab.id as SidebarView);
                  if (tab.id === 'tests' && testCases.length === 0) loadTestCases();
                  if (tab.id === 'workflows' && workflows.length === 0) loadWorkflows();
                }}
                className={cn(
                  "flex-1 py-2.5 px-2 text-xs font-medium flex items-center justify-center gap-1 border-b-2 transition-colors",
                  sidebarView === tab.id ? `border-current ${tab.color}` : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
                {tab.badge && tab.badge > 0 && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px]">{tab.badge}</Badge>
                )}
              </button>
            ))}
          </div>

          {/* Sidebar Content - abbreviated for brevity, includes all views */}
          <div className="flex-1 overflow-hidden">
            {/* Tools View */}
            {sidebarView === 'tools' && (
              <ScrollArea className="h-full">
                <div className="p-3 space-y-3">
                  {/* Preview Controls */}
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Preview Controls</div>
                    <div className="flex items-center gap-2">
                      {/* Device Mode Toggle */}
                      <div className="flex items-center border rounded-md bg-background flex-1">
                        <Button
                          variant={deviceMode === 'desktop' ? 'secondary' : 'ghost'}
                          size="sm"
                          className="h-8 px-3 rounded-r-none flex-1"
                          onClick={() => setDeviceMode('desktop')}
                        >
                          <Monitor className="h-3 w-3 mr-1" />
                          <span className="text-xs">Desktop</span>
                        </Button>
                        <Button
                          variant={deviceMode === 'tablet' ? 'secondary' : 'ghost'}
                          size="sm"
                          className="h-8 px-3 rounded-none border-x flex-1"
                          onClick={() => setDeviceMode('tablet')}
                        >
                          <Tablet className="h-3 w-3 mr-1" />
                          <span className="text-xs">Tablet</span>
                        </Button>
                        <Button
                          variant={deviceMode === 'mobile' ? 'secondary' : 'ghost'}
                          size="sm"
                          className="h-8 px-3 rounded-l-none flex-1"
                          onClick={() => setDeviceMode('mobile')}
                        >
                          <Smartphone className="h-3 w-3 mr-1" />
                          <span className="text-xs">Mobile</span>
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => { if (previewRef.current && previewUrl) previewRef.current.src = previewUrl + '?t=' + Date.now(); }} className="flex-1 text-xs">
                        <RefreshCw className="h-3 w-3 mr-1" />Refresh
                      </Button>
                      <Button size="sm" variant="outline" onClick={rebuildApp} disabled={isRebuilding} className="flex-1 text-xs">
                        {isRebuilding ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RotateCcw className="h-3 w-3 mr-1" />}
                        Rebuild
                      </Button>
                      {previewUrl && (
                        <Button size="sm" variant="outline" onClick={() => window.open(previewUrl, '_blank')} className="text-xs">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {seededUsers.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Test Credentials</div>
                      <div className="space-y-1">
                        {seededUsers.map((user, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs bg-muted/50 rounded p-2 group">
                            <Badge variant="outline" className="text-[10px] w-14 justify-center">{user.role}</Badge>
                            <code className="flex-1 font-mono text-[11px]">{user.email}</code>
                            <code className="font-mono text-[11px] text-muted-foreground">{user.password}</code>
                            <button onClick={() => copyToClipboard(`${user.email}\n${user.password}`, `user-${i}`)} className="opacity-0 group-hover:opacity-100">
                              {copiedId === `user-${i}` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Local Database</div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={rebuildLocalDb} disabled={isRebuildingLocalDb} className="flex-1 text-xs bg-purple-600 hover:bg-purple-700">
                        {isRebuildingLocalDb ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Database className="h-3 w-3 mr-1" />}
                        Rebuild Local DB
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowLocalDbLogs(!showLocalDbLogs)} disabled={localDbLogs.length === 0} className="text-xs">
                        {showLocalDbLogs ? 'Hide' : 'Logs'}
                      </Button>
                    </div>
                    {showLocalDbLogs && localDbLogs.length > 0 && (
                      <div className="bg-black/90 rounded p-2 max-h-32 overflow-y-auto">
                        {localDbLogs.map((log, i) => (
                          <div key={i} className={cn("text-[10px] font-mono", log.includes('Error') ? 'text-red-400' : log.includes('success') ? 'text-green-400' : 'text-white/70')}>{log}</div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </ScrollArea>
            )}

            {/* Workflows View */}
            {sidebarView === 'workflows' && (
              <div className="h-full flex flex-col">
                {/* Workflow Header */}
                <div className="p-3 border-b bg-gradient-to-r from-green-950/50 to-emerald-950/30">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Workflow className="h-4 w-4 text-green-500" />
                      <span className="text-green-400">UI Workflows</span>
                      {workflows.length > 0 && (
                        <Badge variant="secondary" className="text-[10px]">
                          {workflows.length}
                        </Badge>
                      )}
                    </h3>
                    <Button variant="ghost" size="sm" onClick={loadWorkflows} className="h-7 px-2">
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Batch Run Buttons */}
                  {workflows.length > 0 && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => runAllWorkflows('all')}
                        disabled={isBatchRunning || !previewUrl}
                        className="flex-1 text-xs bg-green-600 hover:bg-green-700"
                      >
                        {isBatchRunning ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <PlayCircle className="h-3 w-3 mr-1" />
                        )}
                        Run All
                      </Button>
                      {failedWorkflowCount > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => runAllWorkflows('failed')}
                          disabled={isBatchRunning || !previewUrl}
                          className="text-xs border-red-800 text-red-400 hover:bg-red-950"
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Run Failed ({failedWorkflowCount})
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-3 space-y-4">
                    {/* Batch Result Summary */}
                    {batchResult?.summary && (
                      <div className={cn(
                        "p-3 rounded-lg border",
                        batchResult.summary.failed === 0 ? 'bg-green-950/30 border-green-800' : 'bg-red-950/30 border-red-800'
                      )}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">
                            {batchResult.summary.failed === 0 ? '✅ All Tests Passed' : `❌ ${batchResult.summary.failed} Failed`}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {Math.round(batchResult.summary.duration / 1000)}s
                          </span>
                        </div>
                        <div className="flex gap-4 text-xs">
                          <span className="text-green-400">{batchResult.summary.passed} passed</span>
                          <span className="text-red-400">{batchResult.summary.failed} failed</span>
                          {batchResult.summary.skipped > 0 && (
                            <span className="text-gray-400">{batchResult.summary.skipped} skipped</span>
                          )}
                        </div>
                        <div className="mt-2 h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500"
                            style={{ width: `${(batchResult.summary.passed / batchResult.summary.total) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Record New Workflow */}
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Record New Workflow</div>
                      <div className="space-y-2">
                        <Textarea
                          value={recordingTask}
                          onChange={(e) => setRecordingTask(e.target.value)}
                          placeholder="Describe the test flow, e.g., 'Navigate to login, enter credentials, submit form, verify dashboard loads'"
                          rows={2}
                          className="text-xs"
                          disabled={isRecording || isBatchRunning || !previewUrl}
                        />
                        <div className="flex gap-2">
                          <select
                            value={workflowPriority}
                            onChange={(e) => setWorkflowPriority(e.target.value as any)}
                            className="h-8 px-2 rounded-md border bg-background text-xs"
                            disabled={isRecording || isBatchRunning}
                          >
                            <option value="critical">Critical</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                          <Button
                            size="sm"
                            onClick={recordWorkflow}
                            disabled={isRecording || isBatchRunning || !recordingTask.trim() || !previewUrl}
                            className="flex-1 bg-green-600 hover:bg-green-700"
                          >
                            {isRecording ? (
                              <>
                                <StopCircle className="h-3.5 w-3.5 mr-1 animate-pulse" />
                                Recording...
                              </>
                            ) : (
                              <>
                                <Video className="h-3.5 w-3.5 mr-1" />
                                Record
                              </>
                            )}
                          </Button>
                        </div>
                        {!previewUrl && (
                          <p className="text-[10px] text-muted-foreground text-center">Start preview first to record workflows</p>
                        )}
                      </div>
                    </div>

                    {/* Recording/Execution Logs */}
                    {recordingLogs.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">
                          {isRecording ? 'Recording Progress' : isExecuting ? 'Execution Progress' : 'Last Run'}
                        </div>
                        <div className="bg-black/90 rounded p-2 max-h-32 overflow-y-auto">
                          {recordingLogs.map((log, i) => (
                            <div key={i} className={cn(
                              "text-[10px] font-mono",
                              log.includes('Error') ? 'text-red-400' :
                              log.includes('passed') ? 'text-green-400' :
                              log.includes('failed') ? 'text-red-400' : 'text-white/70'
                            )}>{log}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Screenshot Preview */}
                    {workflowScreenshot && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Latest Screenshot</div>
                        <img
                          src={`data:image/png;base64,${workflowScreenshot}`}
                          alt="Workflow screenshot"
                          className="w-full rounded border"
                        />
                      </div>
                    )}

                    {/* Execution Result */}
                    {executionResult && (
                      <div className={cn(
                        "p-2 rounded border",
                        executionResult.status === 'passed' ? 'bg-green-950/30 border-green-800' :
                        executionResult.status === 'failed' ? 'bg-red-950/30 border-red-800' : 'bg-muted/30'
                      )}>
                        <div className="flex items-center gap-2 text-sm">
                          {executionResult.status === 'passed' ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className={executionResult.status === 'passed' ? 'text-green-400' : 'text-red-400'}>
                            {executionResult.status === 'passed' ? 'All tests passed' : 'Some tests failed'}
                          </span>
                        </div>
                        {executionResult.summary && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {executionResult.summary.passed}/{executionResult.summary.totalSteps} steps passed
                          </div>
                        )}
                      </div>
                    )}

                    {/* Saved Workflows */}
                    {workflows.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Saved Workflows ({workflows.length})</div>
                        <div className="space-y-1">
                          {workflows.map((workflow) => {
                            const batchStatus = batchProgress.find(bp => bp.workflowId === workflow.id);
                            const isRunningInBatch = currentBatchWorkflow === workflow.id;
                            const priorityColors = {
                              critical: 'bg-red-500/20 text-red-400 border-red-500/30',
                              high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
                              medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
                              low: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
                            };

                            return (
                              <div
                                key={workflow.id}
                                className={cn(
                                  "p-2 rounded-lg border hover:bg-muted/50 transition-colors",
                                  selectedWorkflow?.id === workflow.id && "border-green-500 bg-green-500/10",
                                  isRunningInBatch && "border-blue-500 bg-blue-500/10 animate-pulse",
                                  batchStatus?.status === 'passed' && !isRunningInBatch && "border-green-500/50",
                                  batchStatus?.status === 'failed' && !isRunningInBatch && "border-red-500/50"
                                )}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0" onClick={() => setSelectedWorkflow(workflow)}>
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-sm font-medium truncate cursor-pointer flex-1">{workflow.name}</span>
                                      <span className={cn(
                                        "text-[9px] px-1.5 py-0.5 rounded border font-medium uppercase",
                                        priorityColors[workflow.priority || 'medium']
                                      )}>
                                        {workflow.priority || 'medium'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                      <span>{workflow.steps.length} steps</span>
                                      {workflow.stats && workflow.stats.runCount > 0 && (
                                        <>
                                          <span className="text-muted-foreground/50">•</span>
                                          <span className={workflow.stats.passRate >= 80 ? 'text-green-400' : workflow.stats.passRate >= 50 ? 'text-yellow-400' : 'text-red-400'}>
                                            {workflow.stats.passRate}% pass
                                          </span>
                                          <span className="text-muted-foreground/50">•</span>
                                          <span>{workflow.stats.runCount} runs</span>
                                        </>
                                      )}
                                    </div>
                                    {/* Last run status */}
                                    {workflow.stats?.lastRun && (
                                      <div className="flex items-center gap-1 mt-1 text-[9px]">
                                        {workflow.stats.lastRun.status === 'passed' ? (
                                          <CheckCircle className="h-3 w-3 text-green-500" />
                                        ) : (
                                          <XCircle className="h-3 w-3 text-red-500" />
                                        )}
                                        <span className="text-muted-foreground">
                                          Last: {new Date(workflow.stats.lastRun.date).toLocaleDateString()}
                                        </span>
                                      </div>
                                    )}
                                    {/* Batch status indicator */}
                                    {batchStatus && (
                                      <div className="flex items-center gap-1 mt-1 text-[9px]">
                                        {batchStatus.status === 'running' && (
                                          <><Loader2 className="h-3 w-3 animate-spin text-blue-400" /><span className="text-blue-400">Running...</span></>
                                        )}
                                        {batchStatus.status === 'passed' && (
                                          <><CheckCircle className="h-3 w-3 text-green-500" /><span className="text-green-400">Passed ({Math.round(batchStatus.duration / 1000)}s)</span></>
                                        )}
                                        {batchStatus.status === 'failed' && (
                                          <><XCircle className="h-3 w-3 text-red-500" /><span className="text-red-400">{batchStatus.error || 'Failed'}</span></>
                                        )}
                                        {batchStatus.status === 'skipped' && (
                                          <><Circle className="h-3 w-3 text-gray-500" /><span className="text-gray-400">Skipped</span></>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => executeWorkflow(workflow)}
                                      disabled={isExecuting || isBatchRunning || !previewUrl}
                                      className="h-7 w-7 p-0"
                                    >
                                      {(isExecuting && selectedWorkflow?.id === workflow.id) || isRunningInBatch ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <PlayCircle className="h-3.5 w-3.5 text-green-500" />
                                      )}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => deleteWorkflow(workflow.id)}
                                      disabled={isBatchRunning}
                                      className="h-7 w-7 p-0 text-red-500 hover:text-red-400"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Selected Workflow Detail */}
                    {selectedWorkflow && (
                      <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-sm font-semibold">{selectedWorkflow.name}</h4>
                            {selectedWorkflow.description && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">{selectedWorkflow.description}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedWorkflow(null)}
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {/* Stats Grid */}
                        {selectedWorkflow.stats && selectedWorkflow.stats.runCount > 0 && (
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-2 rounded bg-background">
                              <div className="text-lg font-bold">{selectedWorkflow.stats.runCount}</div>
                              <div className="text-[9px] text-muted-foreground">Total Runs</div>
                            </div>
                            <div className="p-2 rounded bg-background">
                              <div className={cn(
                                "text-lg font-bold",
                                selectedWorkflow.stats.passRate >= 80 ? 'text-green-400' :
                                selectedWorkflow.stats.passRate >= 50 ? 'text-yellow-400' : 'text-red-400'
                              )}>
                                {selectedWorkflow.stats.passRate}%
                              </div>
                              <div className="text-[9px] text-muted-foreground">Pass Rate</div>
                            </div>
                            <div className="p-2 rounded bg-background">
                              <div className="text-lg font-bold">{Math.round(selectedWorkflow.stats.avgDuration / 1000)}s</div>
                              <div className="text-[9px] text-muted-foreground">Avg Duration</div>
                            </div>
                          </div>
                        )}

                        {/* Last Run */}
                        {selectedWorkflow.stats?.lastRun && (
                          <div className="text-xs p-2 rounded bg-background">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Last Run:</span>
                              <span className={selectedWorkflow.stats.lastRun.status === 'passed' ? 'text-green-400' : 'text-red-400'}>
                                {selectedWorkflow.stats.lastRun.status === 'passed' ? '✅ Passed' : '❌ Failed'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-1 text-muted-foreground">
                              <span>{new Date(selectedWorkflow.stats.lastRun.date).toLocaleString()}</span>
                              <span>{Math.round(selectedWorkflow.stats.lastRun.duration / 1000)}s</span>
                            </div>
                          </div>
                        )}

                        {/* Steps */}
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">Steps ({selectedWorkflow.steps.length})</div>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {selectedWorkflow.steps.map((step, i) => (
                              <div key={step.id || i} className="text-[10px] p-1.5 rounded bg-background flex items-center gap-2">
                                <span className="text-muted-foreground w-4">{i + 1}.</span>
                                <span className="font-mono text-blue-400">{step.action}</span>
                                {step.selector && (
                                  <span className="text-muted-foreground truncate">{step.selector}</span>
                                )}
                                {step.value && (
                                  <span className="text-green-400 truncate">"{step.value}"</span>
                                )}
                                {step.url && (
                                  <span className="text-purple-400 truncate">{step.url}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => executeWorkflow(selectedWorkflow)}
                            disabled={isExecuting || isBatchRunning || !previewUrl}
                            className="flex-1 text-xs bg-green-600 hover:bg-green-700"
                          >
                            {isExecuting ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <PlayCircle className="h-3 w-3 mr-1" />
                            )}
                            Run Workflow
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Empty State */}
                    {workflows.length === 0 && !isRecording && (
                      <div className="text-center py-6 text-muted-foreground">
                        <Workflow className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No workflows yet</p>
                        <p className="text-xs">Record your first UI test workflow above</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Bugs View */}
            {sidebarView === 'bugs' && (
              <div className="h-full flex flex-col">
                {bugs.length === 0 && !isReportingBug ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                    <CheckCircle className="h-12 w-12 text-green-500 mb-3" />
                    <p className="font-medium">No bugs yet!</p>
                    <p className="text-sm text-muted-foreground mb-4">Test the app and report any issues</p>
                    <Button onClick={() => setIsReportingBug(true)} className="gap-2">
                      <Bug className="h-4 w-4" />Report First Bug
                    </Button>
                  </div>
                ) : isReportingBug ? (
                  <ScrollArea className="flex-1">
                    <div className="p-3 space-y-4">
                      {/* Header */}
                      <div className="flex items-center justify-between sticky top-0 bg-card pb-2 -mt-1 pt-1 z-10">
                        <h3 className="font-semibold text-sm flex items-center gap-2">
                          <Bug className="h-4 w-4 text-red-500" />
                          Report Bug
                        </h3>
                        <Button variant="ghost" size="sm" onClick={() => setIsReportingBug(false)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Title */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Bug Title *</label>
                        <Input
                          placeholder="Brief summary of the issue..."
                          value={bugTitle}
                          onChange={(e) => setBugTitle(e.target.value)}
                        />
                      </div>

                      {/* Category & Severity Row */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
                          <select
                            value={bugCategory}
                            onChange={(e) => setBugCategory(e.target.value as BugCategory)}
                            className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                          >
                            <option value="ui">UI / Styling</option>
                            <option value="functionality">Functionality</option>
                            <option value="data">Data / API</option>
                            <option value="navigation">Navigation</option>
                            <option value="form">Form Validation</option>
                            <option value="performance">Performance</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Severity</label>
                          <select
                            value={bugSeverity}
                            onChange={(e) => setBugSeverity(e.target.value as 'critical' | 'high' | 'medium' | 'low')}
                            className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                          >
                            <option value="critical">Critical</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                        </div>
                      </div>

                      {/* Affected Area */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Affected Page/Component</label>
                        <Input
                          placeholder="e.g., Login page, Dashboard, User profile..."
                          value={bugAffectedArea}
                          onChange={(e) => setBugAffectedArea(e.target.value)}
                        />
                      </div>

                      {/* What Happened */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">What happened? *</label>
                        <Textarea
                          placeholder="Describe what went wrong..."
                          value={bugActual}
                          onChange={(e) => setBugActual(e.target.value)}
                          rows={2}
                        />
                      </div>

                      {/* Expected Behavior */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Expected behavior</label>
                        <Textarea
                          placeholder="What should have happened instead..."
                          value={bugExpected}
                          onChange={(e) => setBugExpected(e.target.value)}
                          rows={2}
                        />
                      </div>

                      {/* Steps to Reproduce */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Steps to Reproduce</label>
                        <div className="space-y-2">
                          {bugStepsToReproduce.map((step, index) => (
                            <div key={index} className="flex gap-2">
                              <span className="text-xs text-muted-foreground w-5 pt-2">{index + 1}.</span>
                              <Input
                                placeholder={index === 0 ? "Navigate to..." : index === 1 ? "Click/Enter..." : "Then..."}
                                value={step}
                                onChange={(e) => updateStep(index, e.target.value)}
                                className="flex-1"
                              />
                              {bugStepsToReproduce.length > 1 && (
                                <Button variant="ghost" size="sm" onClick={() => removeStep(index)} className="h-9 w-9 p-0">
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          ))}
                          <Button variant="outline" size="sm" onClick={addStep} className="w-full text-xs">
                            <Plus className="h-3 w-3 mr-1" /> Add Step
                          </Button>
                        </div>
                      </div>

                      {/* Error Messages */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Error Messages (if any)</label>
                        <Textarea
                          placeholder="Paste any console errors or error messages shown on screen..."
                          value={bugErrorMessages}
                          onChange={(e) => setBugErrorMessages(e.target.value)}
                          rows={2}
                          className="font-mono text-xs"
                        />
                      </div>

                      {/* Reproducibility */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">How often does this happen?</label>
                        <div className="flex gap-2 flex-wrap">
                          {(['always', 'sometimes', 'rarely', 'once'] as BugReproducibility[]).map((option) => (
                            <button
                              key={option}
                              onClick={() => setBugReproducibility(option)}
                              className={cn(
                                "px-3 py-1.5 rounded-md text-xs border transition-colors",
                                bugReproducibility === option
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background hover:bg-muted"
                              )}
                            >
                              {option.charAt(0).toUpperCase() + option.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Submit */}
                      <Button
                        className="w-full"
                        onClick={submitBugReport}
                        disabled={!bugTitle.trim() || !bugActual.trim()}
                      >
                        <Bug className="h-4 w-4 mr-2" />
                        Submit Bug Report
                      </Button>
                    </div>
                  </ScrollArea>
                ) : selectedBug ? (
                  /* Bug Detail View */
                  <div className="h-full flex flex-col">
                    {/* Bug Detail Header */}
                    <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedBug(null)} className="gap-1">
                        <X className="h-3 w-3" /> Back to list
                      </Button>
                      <Badge className={cn("text-[10px]", getSeverityColor(selectedBug.severity))}>
                        {selectedBug.severity}
                      </Badge>
                    </div>

                    <ScrollArea className="flex-1">
                      <div className="p-3 space-y-4">
                        {/* Title & Status */}
                        <div>
                          <div className="flex items-start gap-2">
                            {getStatusIcon(selectedBug.status)}
                            <div className="flex-1">
                              <h3 className="font-semibold text-sm">{selectedBug.title}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-[10px]">
                                  {selectedBug.category || 'other'}
                                </Badge>
                                {selectedBug.affectedArea && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {selectedBug.affectedArea}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Problem Description */}
                        <div className="space-y-1">
                          <h4 className="text-xs font-medium text-muted-foreground">What happened</h4>
                          <p className="text-sm bg-muted/50 p-2 rounded">{selectedBug.actual}</p>
                        </div>

                        {/* Expected */}
                        {selectedBug.expected && (
                          <div className="space-y-1">
                            <h4 className="text-xs font-medium text-muted-foreground">Expected</h4>
                            <p className="text-sm bg-muted/50 p-2 rounded">{selectedBug.expected}</p>
                          </div>
                        )}

                        {/* Steps */}
                        {selectedBug.stepsToReproduce && selectedBug.stepsToReproduce.length > 0 && (
                          <div className="space-y-1">
                            <h4 className="text-xs font-medium text-muted-foreground">Steps to Reproduce</h4>
                            <ol className="text-sm bg-muted/50 p-2 rounded space-y-1 list-decimal list-inside">
                              {selectedBug.stepsToReproduce.map((step, i) => (
                                <li key={i}>{step}</li>
                              ))}
                            </ol>
                          </div>
                        )}

                        {/* Error Messages */}
                        {selectedBug.errorMessages && (
                          <div className="space-y-1">
                            <h4 className="text-xs font-medium text-muted-foreground">Error Messages</h4>
                            <pre className="text-xs bg-red-950/30 text-red-300 p-2 rounded overflow-x-auto">
                              {selectedBug.errorMessages}
                            </pre>
                          </div>
                        )}

                        {/* Reproducibility */}
                        {selectedBug.reproducibility && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Reproducibility:</span>
                            <Badge variant="outline" className="text-[10px]">
                              {selectedBug.reproducibility}
                            </Badge>
                          </div>
                        )}

                        {/* Fix Logs */}
                        {isFixing && fixLogs.length > 0 && (
                          <div className="space-y-1">
                            <h4 className="text-xs font-medium text-orange-500 flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              AI Fix in Progress
                            </h4>
                            <div className="bg-black/90 rounded p-2 max-h-40 overflow-y-auto">
                              {fixLogs.map((log, i) => (
                                <div key={i} className="text-xs font-mono text-green-400">{log}</div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Fix Status */}
                        {selectedBug.status === 'fixed' && (
                          <div className="bg-green-950/30 border border-green-800 rounded p-2">
                            <div className="flex items-center gap-2 text-green-400 text-sm">
                              <CheckCircle className="h-4 w-4" />
                              Bug has been fixed
                            </div>
                            {selectedBug.fixedAt && (
                              <p className="text-xs text-green-400/70 mt-1">
                                Fixed {new Date(selectedBug.fixedAt).toLocaleString()}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </ScrollArea>

                    {/* Fix Button Footer */}
                    {selectedBug.status === 'open' && (
                      <div className="p-3 border-t bg-muted/30">
                        <Button
                          className="w-full bg-orange-600 hover:bg-orange-700"
                          onClick={() => requestFix(selectedBug)}
                          disabled={isFixing}
                        >
                          {isFixing ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Fixing...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 mr-2" />
                              Fix with AI
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Bug List View */
                  <div className="h-full flex flex-col">
                    {/* List Header */}
                    <div className="p-2 border-b flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{bugs.length} bug{bugs.length !== 1 ? 's' : ''}</span>
                      <Button variant="outline" size="sm" onClick={() => setIsReportingBug(true)} className="h-7 text-xs gap-1">
                        <Plus className="h-3 w-3" /> Report Bug
                      </Button>
                    </div>

                    <ScrollArea className="flex-1">
                      <div className="p-2 space-y-1">
                        {bugs.map((bug) => (
                          <button
                            key={bug.id}
                            onClick={() => setSelectedBug(bug)}
                            className="w-full p-2 rounded-lg border text-left hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-start gap-2">
                              {getStatusIcon(bug.status)}
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium line-clamp-1">{bug.title}</span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <Badge variant="outline" className="text-[9px] px-1 py-0">
                                    {bug.category || 'other'}
                                  </Badge>
                                  <Badge className={cn("text-[9px] px-1 py-0", getSeverityColor(bug.severity))}>
                                    {bug.severity[0].toUpperCase()}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}

            {/* Tests View */}
            {sidebarView === 'tests' && (
              <div className="h-full flex flex-col">
                <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Test Cases</h3>
                  <Button variant="ghost" size="sm" onClick={loadTestCases} disabled={isLoadingTestCases}>
                    {isLoadingTestCases ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  </Button>
                </div>
                {testCases.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-4">
                    <ClipboardList className="h-12 w-12 text-muted-foreground/30 mb-3" />
                    <Button onClick={loadTestCases} disabled={isLoadingTestCases}>Load Test Cases</Button>
                  </div>
                ) : (
                  <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                      {testCases.map(tc => (
                        <div key={tc.id} className={cn("p-2 rounded-lg border flex items-start gap-2", tc.status === 'passed' && "bg-green-500/10", tc.status === 'failed' && "bg-red-500/10")}>
                          <div className="flex flex-col gap-1 pt-0.5">
                            <button onClick={() => updateTestCaseStatus(tc.id, 'passed')}><CheckCircle className={cn("h-4 w-4", tc.status === 'passed' ? 'text-green-500' : 'text-muted-foreground/30')} /></button>
                            <button onClick={() => updateTestCaseStatus(tc.id, 'failed')}><XCircle className={cn("h-4 w-4", tc.status === 'failed' ? 'text-red-500' : 'text-muted-foreground/30')} /></button>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">{tc.title}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{tc.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}

            {/* Agent View - With session resume support */}
            {sidebarView === 'chat' && (
              <div className="h-full flex flex-col">
                <div className="p-3 border-b bg-gradient-to-r from-orange-950/50 to-red-950/30 flex items-center justify-between">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-orange-500" />
                    <span className="text-orange-400">Employers AI</span>
                    {claudeSessionId && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-orange-400/70 border-orange-900/50">
                        {claudeSessionId.slice(0, 8)}...
                      </Badge>
                    )}
                  </h3>
                  <div className="flex items-center gap-1">
                    {canContinue && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={continueChat}
                        disabled={isChatRunning}
                        className="h-7 px-2 text-green-400 hover:text-green-300 hover:bg-green-900/20"
                      >
                        <Play className="h-3.5 w-3.5 mr-1" />
                        Continue
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={clearChatOutput} disabled={chatOutput.length === 0} className="h-7 px-2">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 bg-[#0d1117] overflow-hidden relative">
                  <div ref={chatOutputRef} className="absolute inset-0 overflow-y-auto p-3 font-mono text-xs text-gray-300 space-y-0.5">
                    {chatOutput.length === 0 ? (
                      <div className="text-gray-500 text-center py-8">
                        <p className="text-lg mb-2">Bug exterminator on standby</p>
                        <p className="text-xs text-gray-600">Tell me what's broken and I'll handle it</p>
                      </div>
                    ) : chatOutput.map((line, i) => (
                      <div key={i} className={cn('whitespace-pre-wrap', line.startsWith('>') ? 'text-yellow-400' : '')}>{line}</div>
                    ))}
                    {isChatRunning && <div className="flex items-center gap-2 text-orange-400 mt-2"><Loader2 className="h-3 w-3 animate-spin" />Working...</div>}
                  </div>
                </div>
                <div className="p-2 border-t border-orange-900/30 bg-[#161b22] flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && runChatCommand(false)}
                    placeholder="Ask Employers AI..."
                    className="font-mono text-xs bg-[#0d1117] border-orange-900/50"
                    disabled={isChatRunning}
                  />
                  <Button size="sm" onClick={() => runChatCommand(false)} disabled={isChatRunning || !chatInput.trim()} className="bg-orange-600 hover:bg-orange-700">
                    {isChatRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

export default UATTab;
