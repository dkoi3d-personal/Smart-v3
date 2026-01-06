'use client';

import { useState, useEffect } from 'react';
import { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Monitor, Smartphone, Tablet, RefreshCw, ExternalLink, Terminal, ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/stores/project-store';
import { useWebSocket } from '@/hooks/useWebSocket';

type DeviceSize = 'desktop' | 'tablet' | 'mobile';
type PreviewStatus = 'idle' | 'installing' | 'building' | 'starting' | 'ready' | 'error';

interface BuildLog {
  id: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  timestamp: Date;
}

export function LivePreview() {
  const { project } = useProjectStore();
  const { connected, on, off } = useWebSocket();
  const [device, setDevice] = useState<DeviceSize>('desktop');
  const [refreshKey, setRefreshKey] = useState(0);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [devServerPort, setDevServerPort] = useState<number | null>(null);
  const [buildLogs, setBuildLogs] = useState<BuildLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [useDevServer, setUseDevServer] = useState(false);

  const deviceSizes = {
    desktop: 'w-full',
    tablet: 'w-[768px] mx-auto',
    mobile: 'w-[375px] mx-auto',
  };

  const statusConfig = {
    idle: { label: 'Idle', color: 'bg-gray-500', icon: AlertCircle },
    installing: { label: 'Installing Dependencies', color: 'bg-blue-500', icon: Loader2 },
    building: { label: 'Building', color: 'bg-blue-500', icon: Loader2 },
    starting: { label: 'Starting Server', color: 'bg-yellow-500', icon: Loader2 },
    ready: { label: 'Ready', color: 'bg-green-500', icon: CheckCircle2 },
    error: { label: 'Error', color: 'bg-red-500', icon: XCircle },
  };

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const addBuildLog = (type: BuildLog['type'], message: string) => {
    const log: BuildLog = {
      id: `log-${Date.now()}-${Math.random()}`,
      type,
      message,
      timestamp: new Date(),
    };
    setBuildLogs((prev) => [...prev, log]);
  };

  // WebSocket listeners for preview events
  useEffect(() => {
    if (!connected) return;

    const handlePreviewStatus = (data: any) => {
      console.log('📺 Preview status:', data);
      setPreviewStatus(data.status);
      if (data.message) {
        addBuildLog(data.status === 'error' ? 'error' : 'info', data.message);
      }
    };

    const handlePreviewReady = (data: any) => {
      console.log('✅ Preview ready:', data);
      setPreviewStatus('ready');
      setPreviewUrl(data.url);
      setDevServerPort(data.port);
      setUseDevServer(true);
      addBuildLog('success', `✓ Development server ready on port ${data.port}`);
    };

    const handlePreviewError = (data: any) => {
      console.log('❌ Preview error:', data);
      setPreviewStatus('error');
      addBuildLog('error', data.error || 'Failed to start preview');
    };

    const handleBuildLog = (data: any) => {
      console.log('📝 Build log:', data);
      addBuildLog(data.type || 'info', data.message);
    };

    on('preview:status', handlePreviewStatus);
    on('preview:ready', handlePreviewReady);
    on('preview:error', handlePreviewError);
    on('preview:log', handleBuildLog);

    return () => {
      off('preview:status', handlePreviewStatus);
      off('preview:ready', handlePreviewReady);
      off('preview:error', handlePreviewError);
      off('preview:log', handleBuildLog);
    };
  }, [connected, on, off]);

  // Reset preview state when project changes
  useEffect(() => {
    if (project?.projectId) {
      setPreviewStatus('idle');
      setPreviewUrl(null);
      setDevServerPort(null);
      setUseDevServer(false);
      setBuildLogs([]);
    }
  }, [project?.projectId]);

  // Check if project has files to preview
  const hasFiles = project && Array.from(project.codeFiles?.values() || []).length > 0;

  // Determine preview source
  const getPreviewSrc = () => {
    if (useDevServer && previewUrl) {
      return previewUrl; // http://localhost:PORT
    }
    // Fallback to static file serving - but ONLY if files exist
    if (project?.projectId && hasFiles) {
      return `/api/preview/${project.projectId}?file=index.html`;
    }
    return null;
  };

  const previewSrc = getPreviewSrc();

  // Determine if we should show iframe
  const shouldShowIframe = previewSrc && (useDevServer || hasFiles);

  const StatusIcon = statusConfig[previewStatus].icon;

  const openInBrowser = () => {
    if (previewSrc) {
      window.open(previewSrc, '_blank');
    }
  };

  return (
    <>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Live Preview
            <Badge
              variant="outline"
              className={cn(
                'text-white border-0 font-semibold',
                statusConfig[previewStatus].color
              )}
            >
              <StatusIcon className={cn(
                'h-3 w-3 mr-1',
                (previewStatus === 'installing' || previewStatus === 'building' || previewStatus === 'starting') && 'animate-spin'
              )} />
              {statusConfig[previewStatus].label}
            </Badge>
            {devServerPort && (
              <Badge variant="secondary" className="text-xs font-mono">
                :{devServerPort}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            {previewSrc && (
              <Button
                size="sm"
                variant="ghost"
                onClick={openInBrowser}
                className="h-7 px-2 text-xs"
                title="Open in new tab"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Open
              </Button>
            )}
            <Button
              size="sm"
              variant={device === 'desktop' ? 'default' : 'ghost'}
              onClick={() => setDevice('desktop')}
              className="h-7 w-7 p-0"
              title="Desktop view"
            >
              <Monitor className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant={device === 'tablet' ? 'default' : 'ghost'}
              onClick={() => setDevice('tablet')}
              className="h-7 w-7 p-0"
              title="Tablet view"
            >
              <Tablet className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant={device === 'mobile' ? 'default' : 'ghost'}
              onClick={() => setDevice('mobile')}
              className="h-7 w-7 p-0"
              title="Mobile view"
            >
              <Smartphone className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRefresh}
              className="h-7 w-7 p-0"
              title="Refresh preview"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col gap-2 min-h-0">
        {/* Main Preview Area */}
        <div className="flex-1 overflow-hidden bg-muted rounded-lg min-h-0">
          <div className={cn('h-full bg-background border-2 border-border rounded-lg overflow-auto', deviceSizes[device])}>
            {shouldShowIframe ? (
              <iframe
                key={refreshKey}
                src={previewSrc}
                className="w-full h-full border-0"
                title="Live Preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                <div className="text-center px-6">
                  <Monitor className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium mb-1">
                    {previewStatus === 'installing' && 'Installing dependencies...'}
                    {previewStatus === 'building' && 'Building your application...'}
                    {previewStatus === 'starting' && 'Starting development server...'}
                    {previewStatus === 'error' && 'Failed to start preview'}
                    {previewStatus === 'idle' && !project && 'Preview will appear here'}
                    {previewStatus === 'idle' && project && !hasFiles && 'Generating code...'}
                    {previewStatus === 'idle' && project && hasFiles && 'Preparing preview...'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {!project && 'Start building to see your app live'}
                    {project && !hasFiles && 'Waiting for agents to create files...'}
                    {project && hasFiles && previewStatus === 'idle' && 'Development server will start when ready'}
                    {previewStatus === 'error' && 'Check console logs below for details'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Build Logs Panel (Collapsible) */}
        {buildLogs.length > 0 && (
          <Collapsible open={showLogs} onOpenChange={setShowLogs}>
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <Terminal className="h-3 w-3" />
                  <span>Console & Build Logs</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {buildLogs.length}
                  </Badge>
                </div>
                {showLogs ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="border-2 border-border rounded-lg bg-black/90 text-white">
                <ScrollArea className="h-48">
                  <div className="p-3 space-y-1 font-mono text-[11px]">
                    {buildLogs.map((log) => (
                      <div
                        key={log.id}
                        className={cn(
                          'flex items-start gap-2',
                          log.type === 'error' && 'text-red-400',
                          log.type === 'success' && 'text-green-400',
                          log.type === 'warning' && 'text-yellow-400',
                          log.type === 'info' && 'text-gray-300'
                        )}
                      >
                        <span className="text-gray-500 flex-shrink-0">
                          [{log.timestamp.toLocaleTimeString()}]
                        </span>
                        <span className="flex-1 break-all">{log.message}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </>
  );
}
