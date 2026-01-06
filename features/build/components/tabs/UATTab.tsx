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
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BugReport {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'analyzing' | 'fixing' | 'fixed' | 'verified' | 'rejected';
  steps: string;
  expected: string;
  actual: string;
  createdAt: string;
  fixPlan?: string;
  fixApplied?: boolean;
  assignedTo?: string;
  fixedBy?: string;
  fixedAt?: string;
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

type SidebarView = 'bugs' | 'tests' | 'tools' | 'ai';
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

  // Bug form
  const [bugTitle, setBugTitle] = useState('');
  const [bugDescription, setBugDescription] = useState('');
  const [bugSeverity, setBugSeverity] = useState<'critical' | 'high' | 'medium' | 'low'>('medium');
  const [bugSteps, setBugSteps] = useState('');
  const [bugExpected, setBugExpected] = useState('');
  const [bugActual, setBugActual] = useState('');

  // Fix state
  const [fixInstructions, setFixInstructions] = useState('');
  const [fixLogs, setFixLogs] = useState<string[]>([]);

  // Claude terminal
  const [claudeInput, setClaudeInput] = useState('');
  const [claudeOutput, setClaudeOutput] = useState<string[]>([]);
  const [isClaudeRunning, setIsClaudeRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

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
        setPreviewUrl(data.url);
        setPreviewStatus('ready');
        setBuildLogs(prev => [...prev, `Server ready at ${data.url}`]);
        setTimeout(() => setShowBuildLogs(false), 2000);
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
    setSeedStatus('');

    try {
      await fetch('/api/preview/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      await new Promise(r => setTimeout(r, 1000));

      setBuildLogs(prev => [...prev, 'Rebuilding local database...']);
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
      } catch (dbError: any) {
        setBuildLogs(prev => [...prev, `DB setup skipped: ${dbError.message}`]);
      }

      setBuildLogs(prev => [...prev, 'Building with latest changes...']);

      const response = await fetch('/api/preview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, forceRebuild: true }),
      });

      const data = await response.json();

      if (data.success) {
        setPreviewUrl(data.url);
        setPreviewStatus('ready');
        setBuildLogs(prev => [...prev, 'Rebuild complete!']);
        if (previewRef.current) {
          previewRef.current.src = data.url;
        }
        setTimeout(() => setShowBuildLogs(false), 2000);
      } else {
        setPreviewStatus('error');
        setBuildLogs(prev => [...prev, `Build failed: ${data.error}`]);
      }
    } catch (error) {
      setPreviewStatus('error');
      setBuildLogs(prev => [...prev, 'Rebuild failed']);
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

  // Submit bug report
  const submitBugReport = async () => {
    if (!bugTitle.trim() || !bugDescription.trim()) return;

    const newBug: BugReport = {
      id: `bug-${Date.now()}`,
      title: bugTitle,
      description: bugDescription,
      severity: bugSeverity,
      status: 'open',
      steps: bugSteps,
      expected: bugExpected,
      actual: bugActual,
      createdAt: new Date().toISOString(),
    };

    const updatedBugs = [...bugs, newBug];
    setBugs(updatedBugs);
    await saveBugsToProject(updatedBugs);

    setBugTitle('');
    setBugDescription('');
    setBugSeverity('medium');
    setBugSteps('');
    setBugExpected('');
    setBugActual('');
    setIsReportingBug(false);
    setSelectedBug(newBug);
  };

  // Request AI fix
  const requestFix = async (bug: BugReport) => {
    setIsFixing(true);
    setFixLogs(['Requesting AI fix...']);

    try {
      const response = await fetch('/api/uat/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          bugId: bug.id,
          bug: { title: bug.title, description: bug.description, steps: bug.steps, expected: bug.expected, actual: bug.actual },
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

  useEffect(() => {
    if (sidebarView === 'ai' && projectId) {
      loadSessionHistory();
    }
  }, [sidebarView, projectId, loadSessionHistory]);

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
    setSidebarView('ai');
  };

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
        <div className="w-[400px] border-l bg-card flex flex-col">
          {/* Sidebar Tabs */}
          <div className="flex border-b flex-shrink-0">
            {[
              { id: 'tools', icon: Monitor, label: 'Tools', color: 'text-purple-500' },
              { id: 'bugs', icon: Bug, label: 'Bugs', color: 'text-red-500', badge: bugs.length },
              { id: 'tests', icon: ClipboardList, label: 'Tests', color: 'text-blue-500' },
              { id: 'ai', icon: Terminal, label: 'AI', color: 'text-orange-500' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setSidebarView(tab.id as SidebarView);
                  if (tab.id === 'tests' && testCases.length === 0) loadTestCases();
                }}
                className={cn(
                  "flex-1 py-2.5 px-3 text-xs font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors",
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
                  <div className="p-3 space-y-3 overflow-y-auto">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">Report Bug</h3>
                      <Button variant="ghost" size="sm" onClick={() => setIsReportingBug(false)}><X className="h-4 w-4" /></Button>
                    </div>
                    <Input placeholder="Bug title..." value={bugTitle} onChange={(e) => setBugTitle(e.target.value)} />
                    <Textarea placeholder="What's wrong?" value={bugDescription} onChange={(e) => setBugDescription(e.target.value)} rows={2} />
                    <Button className="w-full" onClick={submitBugReport} disabled={!bugTitle || !bugDescription}>Submit Bug</Button>
                  </div>
                ) : (
                  <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                      {bugs.map((bug) => (
                        <button key={bug.id} onClick={() => setSelectedBug(bug)} className={cn("w-full p-2 rounded-lg border text-left hover:bg-muted/50", selectedBug?.id === bug.id && "border-orange-500 bg-orange-500/10")}>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(bug.status)}
                            <span className="text-sm font-medium truncate flex-1">{bug.title}</span>
                            <Badge className={cn("text-[10px] px-1", getSeverityColor(bug.severity))}>{bug.severity[0].toUpperCase()}</Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
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

            {/* AI Terminal View */}
            {sidebarView === 'ai' && (
              <div className="h-full flex flex-col">
                <div className="p-3 border-b bg-gradient-to-r from-orange-950/50 to-red-950/30 flex items-center justify-between">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-orange-500" />
                    <span className="text-orange-400">SmartCycleAI</span>
                  </h3>
                  <Button variant="ghost" size="sm" onClick={clearSessionHistory} disabled={claudeOutput.length === 0} className="h-7 px-2">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex-1 bg-[#0d1117] overflow-hidden relative">
                  <div ref={claudeOutputRef} className="absolute inset-0 overflow-y-auto p-3 font-mono text-xs text-gray-300 space-y-0.5">
                    {claudeOutput.length === 0 ? (
                      <div className="text-gray-500">Type a command to start...</div>
                    ) : claudeOutput.map((line, i) => (
                      <div key={i} className={cn('whitespace-pre-wrap', line.startsWith('>') ? 'text-yellow-400' : '')}>{line}</div>
                    ))}
                    {isClaudeRunning && <div className="flex items-center gap-2 text-orange-400 mt-2"><Loader2 className="h-3 w-3 animate-spin" />Working...</div>}
                  </div>
                </div>
                <div className="p-2 border-t border-orange-900/30 bg-[#161b22] flex gap-2">
                  <Input
                    value={claudeInput}
                    onChange={(e) => setClaudeInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runClaudeCommand()}
                    placeholder="Ask SmartCycleAI..."
                    className="font-mono text-xs bg-[#0d1117] border-orange-900/50"
                    disabled={isClaudeRunning}
                  />
                  <Button size="sm" onClick={runClaudeCommand} disabled={isClaudeRunning || !claudeInput.trim()} className="bg-orange-600 hover:bg-orange-700">
                    {isClaudeRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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
