'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  RefreshCw,
  Rocket,
  FileCode,
  Package,
  Wrench,
  Database,
  Sparkles,
} from 'lucide-react';
import { usePreview } from '@/features/quick-build';
import type { BuildProgress } from '@/features/quick-build/types';

interface ProjectData {
  projectId: string;
  templateId: string;
  templateConfig: any;
  status: 'pending' | 'building' | 'complete' | 'error';
  createdAt: string;
}

const PHASE_ICONS: Record<string, any> = {
  planning: Sparkles,
  creating: FileCode,
  integrations: Wrench,
  installing: Package,
  building: Wrench,
  database: Database,
  complete: CheckCircle2,
  error: XCircle,
};

const PHASE_COLORS: Record<string, string> = {
  planning: 'text-blue-500',
  creating: 'text-purple-500',
  integrations: 'text-cyan-500',
  installing: 'text-amber-500',
  building: 'text-orange-500',
  database: 'text-teal-500',
  complete: 'text-green-500',
  error: 'text-red-500',
};

export default function QuickBuildProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [progress, setProgress] = useState<BuildProgress | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const buildStartedRef = useRef(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Preview hook
  const preview = usePreview();

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Load project data
  useEffect(() => {
    async function loadProject() {
      try {
        const res = await fetch(`/api/quick-build/${projectId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('Project not found');
          } else {
            setError('Failed to load project');
          }
          setLoading(false);
          return;
        }
        const data = await res.json();
        setProjectData(data);

        // If project is already complete, show that
        if (data.status === 'complete') {
          setProgress({ phase: 'complete', message: 'Build complete!' });
        } else if (data.status === 'error') {
          setProgress({ phase: 'error', message: 'Build failed', error: data.error });
        }
      } catch (err) {
        setError('Failed to load project');
      } finally {
        setLoading(false);
      }
    }
    loadProject();
  }, [projectId]);

  // Start build
  const startBuild = useCallback(async () => {
    if (!projectData || buildStartedRef.current || building) return;

    buildStartedRef.current = true;
    setBuilding(true);
    setProgress({ phase: 'planning', message: 'Starting build...' });
    setLogs([]);

    // Update project status to building
    await fetch(`/api/quick-build/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'building' }),
    });
    setProjectData(prev => prev ? { ...prev, status: 'building' } : null);

    try {
      const response = await fetch('/api/simple-build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          templateConfig: projectData.templateConfig,
        }),
      });

      if (!response.ok) {
        throw new Error(`Build failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let filesCreated: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'progress') {
                if (data.progress.filesCreated) {
                  filesCreated = data.progress.filesCreated;
                }
                setProgress({ ...data.progress, filesCreated });
                if (data.progress.message) {
                  setLogs(prev => [...prev, data.progress.message]);
                }
              } else if (data.type === 'complete') {
                setProgress({
                  phase: 'complete',
                  message: 'Build complete!',
                  filesCreated,
                });
                // Update project status
                await fetch(`/api/quick-build/${projectId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: 'complete' }),
                });
              } else if (data.type === 'error') {
                setProgress({
                  phase: 'error',
                  message: 'Build failed',
                  error: data.error,
                  filesCreated,
                });
                setLogs(prev => [...prev, `Error: ${data.error}`]);
                // Update project status
                await fetch(`/api/quick-build/${projectId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: 'error', error: data.error }),
                });
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setProgress({
        phase: 'error',
        message: 'Build failed',
        error: errorMessage,
      });
      setLogs(prev => [...prev, `Error: ${errorMessage}`]);
    } finally {
      setBuilding(false);
    }
  }, [projectData, projectId]);

  // Don't auto-start - let user click Start Build for new projects

  // Auto-launch preview when build completes
  const previewStartedRef = useRef(false);
  useEffect(() => {
    if (progress?.phase === 'complete' && !preview.url && !preview.loading && !previewStartedRef.current) {
      previewStartedRef.current = true;
      preview.startPreview(projectId);
    }
  }, [progress?.phase, preview.url, preview.loading, projectId]);

  const handleLaunchPreview = () => {
    preview.startPreview(projectId);
  };

  const handleRetry = async () => {
    buildStartedRef.current = false;
    // Reset project status to pending
    await fetch(`/api/quick-build/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending' }),
    });
    setProjectData(prev => prev ? { ...prev, status: 'pending' } : null);
    startBuild();
  };

  const PhaseIcon = progress?.phase ? PHASE_ICONS[progress.phase] || Loader2 : Loader2;
  const phaseColor = progress?.phase ? PHASE_COLORS[progress.phase] || 'text-foreground' : 'text-foreground';

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h1 className="text-xl font-bold mb-2">Error</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => router.push('/quick-build')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Quick Build
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="px-4 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/quick-build')}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg font-bold truncate">
                {projectData?.templateConfig?.appName || 'Loading...'}
              </h1>
              {projectData?.templateId && (
                <p className="text-xs text-muted-foreground">
                  {projectData.templateId}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Full height layout */}
      <main className="h-[calc(100vh-73px)] p-4">
        <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Build Logs */}
          <div className="lg:col-span-1 flex flex-col rounded-xl border bg-card overflow-hidden">
            {/* Header - only show status when building or finished */}
            <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Build Logs</h3>
              {progress && (
                <div className="flex items-center gap-2">
                  <div className={cn('p-1 rounded', phaseColor)}>
                    {building ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <PhaseIcon className="h-4 w-4" />
                    )}
                  </div>
                  <span className="text-xs capitalize">{progress.phase}</span>
                </div>
              )}
            </div>

            {/* Logs */}
            <div className="flex-1 overflow-y-auto bg-slate-950 p-3 font-mono text-xs">
              {logs.length === 0 ? (
                <p className="text-slate-500">
                  {projectData?.status === 'pending' ? 'Click Start Build to begin...' : 'No logs yet...'}
                </p>
              ) : (
                logs.map((log, i) => (
                  <div
                    key={i}
                    className={cn(
                      'py-0.5 leading-relaxed',
                      log.includes('Error') || log.includes('error')
                        ? 'text-red-400'
                        : log.includes('✓') || log.includes('complete')
                        ? 'text-green-400'
                        : 'text-slate-300'
                    )}
                  >
                    {log}
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>

            {/* Error display */}
            {progress?.error && (
              <div className="p-3 border-t bg-destructive/10 text-destructive text-xs">
                {progress.error}
              </div>
            )}

            {/* Files Created footer */}
            {progress?.filesCreated && progress.filesCreated.length > 0 && (
              <div className="p-3 border-t bg-muted/20 max-h-32 overflow-y-auto">
                <p className="text-xs font-medium mb-1 text-muted-foreground">
                  {progress.filesCreated.length} files created
                </p>
                <div className="space-y-0.5">
                  {progress.filesCreated.slice(-5).map((file, i) => (
                    <div
                      key={i}
                      className="text-xs text-muted-foreground font-mono flex items-center gap-1.5 truncate"
                    >
                      <FileCode className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{file}</span>
                    </div>
                  ))}
                  {progress.filesCreated.length > 5 && (
                    <p className="text-xs text-muted-foreground">
                      +{progress.filesCreated.length - 5} more...
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Large Live Preview */}
          <div className="lg:col-span-2 flex flex-col rounded-xl border bg-card overflow-hidden">
            <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Live Preview</h3>
              {preview.url && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{preview.url}</span>
                  <a
                    href={preview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded hover:bg-muted transition-colors"
                    title="Open in new tab"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() => preview.refreshPreview()}
                    className="p-1.5 rounded hover:bg-muted transition-colors"
                    title="Refresh preview"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            <div className="flex-1 bg-muted/50 relative">
              {preview.loading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
                    <p className="text-sm text-muted-foreground">Starting preview server...</p>
                  </div>
                </div>
              ) : preview.url ? (
                <iframe
                  ref={preview.iframeRef}
                  src={preview.url}
                  className="w-full h-full border-0"
                  title="App Preview"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    {projectData?.status === 'pending' && !building ? (
                      <>
                        <Rocket className="h-16 w-16 mx-auto mb-6 text-primary/60" />
                        <h2 className="text-xl font-semibold mb-2">Ready to Build</h2>
                        <p className="text-muted-foreground mb-6 max-w-md">
                          Your project is configured and ready. Click below to start building.
                        </p>
                        <button
                          onClick={startBuild}
                          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-lg font-medium"
                        >
                          <Rocket className="h-5 w-5" />
                          Start Build
                        </button>
                      </>
                    ) : progress?.phase === 'complete' ? (
                      <>
                        <Rocket className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                        <p className="text-muted-foreground mb-4">Build complete! Ready to preview.</p>
                        <button
                          onClick={handleLaunchPreview}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          <Rocket className="h-4 w-4" />
                          Launch Preview
                        </button>
                      </>
                    ) : progress?.phase === 'error' ? (
                      <>
                        <XCircle className="h-12 w-12 mx-auto mb-4 text-destructive/50" />
                        <p className="text-muted-foreground mb-2">Build failed</p>
                        <button
                          onClick={handleRetry}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Retry Build
                        </button>
                      </>
                    ) : (
                      <>
                        <Loader2 className="h-12 w-12 mx-auto mb-4 text-primary animate-spin" />
                        <p className="text-muted-foreground">Building your app...</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">Preview will appear when ready</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
