'use client';

import { RefObject, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  Terminal,
  FolderTree,
  FileCode,
  Code2,
  RefreshCw,
  Loader2,
  AlertCircle,
  Wrench,
  Bot,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// Dynamically import Monaco to avoid SSR issues
const MonacoEditor = dynamic(() => import('@monaco-editor/react').then(mod => mod.default), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

// Get Monaco language from file extension
function getMonacoLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    php: 'php',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'scss',
    less: 'less',
    json: 'json',
    md: 'markdown',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    txt: 'plaintext',
    prisma: 'prisma',
    graphql: 'graphql',
    gql: 'graphql',
    env: 'ini',
    dockerfile: 'dockerfile',
    toml: 'ini',
    ini: 'ini',
    conf: 'ini',
  };
  return languageMap[ext] || 'plaintext';
}
import type {
  Task,
  AgentMessage,
  BuildLog,
  BuildMetrics,
  BuildPhase,
  TreeNode,
  AgentRole,
} from '../../types';
import {
  useTasks,
  usePhase,
  useBuildMetrics,
  useIsIterating,
  useIsFixing,
  useIsStreaming,
  useAgentStatuses,
  useAgentMessages,
  useBuildLogs,
  useError,
  useConnectionStatus,
  useFileContents,
} from '../../stores/useBuildPageStore';

// Agent visual configuration
const AGENT_ICONS: Record<AgentRole, React.ComponentType<{ className?: string }>> = {
  coordinator: Bot,
  coder: Code2,
  tester: Terminal,
  security: AlertCircle,
  product_owner: FileCode,
  fixer: Wrench,
  researcher: FolderTree,
};

const AGENT_COLORS: Record<AgentRole, string> = {
  coordinator: 'text-purple-400',
  coder: 'text-blue-400',
  tester: 'text-yellow-400',
  security: 'text-red-400',
  product_owner: 'text-emerald-400',
  fixer: 'text-orange-400',
  researcher: 'text-cyan-400',
};

type PreviewStatus = 'idle' | 'starting' | 'ready' | 'error' | 'stopped';

interface DevelopmentTabProps {
  projectId: string;
  projectName: string | null | undefined;
  // File tree (from useFileTree hook)
  tree: TreeNode[];
  selectedFile: string | null;
  currentFileContent: string | null | undefined;
  onFetchFiles: () => void;
  renderTreeNode: (node: TreeNode) => React.ReactNode;
  // Preview (from usePreviewServer hook)
  previewStatus: PreviewStatus;
  previewUrl: string | null;
  previewKey: number;
  previewError: string | null;
  hasPackageJson: boolean;
  firstHtmlFile: string | null | undefined;
  onStartDevServer: () => void;
  onStopDevServer: () => void;
  onPreviewKeyChange: (key: number) => void;
  // Refs
  buildLogRef: RefObject<HTMLDivElement | null>;
  // Actions
  onRunFixer: (mode: 'build' | 'custom', command?: string) => Promise<void>;
  onResumeFromCheckpoint: () => void;
  terminalRef?: (el: HTMLDivElement | null) => void;
}

export function DevelopmentTab({
  projectId,
  projectName,
  tree,
  selectedFile,
  currentFileContent,
  onFetchFiles,
  renderTreeNode,
  previewStatus,
  previewUrl,
  previewKey,
  previewError,
  hasPackageJson,
  firstHtmlFile,
  onStartDevServer,
  onStopDevServer,
  onPreviewKeyChange,
  buildLogRef,
  onRunFixer,
  onResumeFromCheckpoint,
  terminalRef,
}: DevelopmentTabProps) {
  // Get state from store selectors
  const phase = usePhase();
  const tasks = useTasks();
  const buildMetrics = useBuildMetrics();
  const isIterating = useIsIterating();
  const isFixing = useIsFixing();
  const isStreaming = useIsStreaming();
  const agentStatuses = useAgentStatuses();
  const agentMessages = useAgentMessages();
  const buildLogs = useBuildLogs();
  const error = useError();
  const connectionStatus = useConnectionStatus();
  const fileContents = useFileContents();
  return (
    <div className="h-full flex gap-4">
      {/* Left sidebar - File Tree */}
      <div className="w-64 flex-shrink-0 flex flex-col overflow-hidden">
        <Card className="flex-1 flex flex-col bg-gradient-to-br from-background to-muted/20 border border-border/50 shadow-lg overflow-hidden">
          <CardHeader className="pb-2 flex-shrink-0 border-b border-border/40">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/10 flex items-center justify-center">
                  <FolderTree className="h-3.5 w-3.5 text-amber-400" />
                </div>
                <div>
                  <span className="font-semibold">Files</span>
                  <Badge className="ml-2 h-5 px-1.5 text-[10px] bg-muted text-muted-foreground border-0">{fileContents.size}</Badge>
                </div>
              </div>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg hover:bg-muted/50" onClick={onFetchFiles}>
                <RefreshCw className="h-3 w-3" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              {tree.length === 0 ? (
                <div className="p-4 text-xs text-muted-foreground text-center">
                  <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-2">
                    <FileCode className="h-5 w-5 opacity-40" />
                  </div>
                  <p className="opacity-60">No files yet</p>
                </div>
              ) : (
                <div className="py-1">{tree.map(node => renderTreeNode(node))}</div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Center - Code Editor (expanded) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Card className="flex-1 flex flex-col border border-border/50 shadow-lg overflow-hidden">
          <CardHeader className="py-2 px-3 flex-shrink-0 border-b border-border/40 bg-[#1e1e1e]">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="h-4 w-4 text-blue-400" />
                <span className="truncate font-mono text-xs text-gray-300">
                  {selectedFile || 'No file selected'}
                </span>
                {selectedFile && (
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-[#2d2d2d] border-[#3d3d3d] text-gray-400">
                    {getMonacoLanguage(selectedFile)}
                  </Badge>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            {currentFileContent && currentFileContent.length > 0 ? (
              <MonacoEditor
                height="100%"
                language={selectedFile ? getMonacoLanguage(selectedFile) : 'plaintext'}
                value={currentFileContent}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  minimap: { enabled: true, scale: 0.75 },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  automaticLayout: true,
                  padding: { top: 12, bottom: 12 },
                  folding: true,
                  renderLineHighlight: 'line',
                  scrollbar: {
                    verticalScrollbarSize: 10,
                    horizontalScrollbarSize: 10,
                  },
                  cursorStyle: 'line',
                  cursorBlinking: 'smooth',
                }}
              />
            ) : selectedFile ? (
              <div className="flex items-center justify-center h-full bg-[#1e1e1e] text-muted-foreground">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin opacity-50" />
                  <p className="opacity-60">Loading file...</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full bg-[#1e1e1e] text-muted-foreground">
                <div className="text-center">
                  <Code2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-lg opacity-60">
                    {fileContents.size > 0 ? 'Select a file from the tree' : 'Waiting for files...'}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right sidebar - Agent Log + Build Output */}
      <div className="w-96 flex-shrink-0 flex flex-col gap-4 overflow-hidden">
        {/* Agent Log - Modern Terminal Style */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden rounded-xl border border-border/50 shadow-lg bg-[#0d1117]">
          {/* Terminal header - macOS style */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/80 bg-gradient-to-r from-gray-900 to-gray-900/95">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full bg-red-500/80" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
              <div className="h-3 w-3 rounded-full bg-green-500/80" />
            </div>
            <div className="flex items-center gap-2 flex-1">
              <Terminal className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-400">Agent Log</span>
            </div>
            <div className="flex items-center gap-1">
              {(['product_owner', 'coder', 'tester', 'security'] as const).map(role => {
                const status = agentStatuses.get(role);
                const isWorking = status === 'working';
                const Icon = AGENT_ICONS[role];
                const colorClass = AGENT_COLORS[role];
                return (
                  <div key={role} className={cn(
                    'p-1.5 rounded-md transition-all duration-200',
                    isWorking ? 'bg-gray-800 ring-1 ring-gray-700' : 'hover:bg-gray-800/50'
                  )}>
                    <Icon className={cn('h-3 w-3', colorClass, isWorking && 'animate-pulse')} />
                  </div>
                );
              })}
            </div>
          </div>
          {/* Terminal body - unified log */}
          <div
            className="flex-1 min-h-0 overflow-y-auto"
            ref={terminalRef}
          >
            <div className="p-4 font-mono text-xs leading-relaxed">
              {agentMessages.length === 0 ? (
                <div className="text-gray-500 flex items-center gap-2">
                  <span className="text-emerald-500">$</span>
                  <span>Waiting for agents to start...</span>
                  {isStreaming && <span className="text-emerald-400 animate-pulse">_</span>}
                </div>
              ) : (
                // Dedupe messages by ID before rendering
                [...new Map(agentMessages.map(m => [m.id, m])).values()].map((msg, index) => {
                  const Icon = AGENT_ICONS[msg.agentRole] || Bot;
                  const colorClass = AGENT_COLORS[msg.agentRole] || 'text-gray-400';
                  // Build role name with instance number for parallel agents (e.g., "CODE1", "TEST2")
                  const baseRoleName = msg.agentRole === 'product_owner' ? 'PO' :
                                   msg.agentRole === 'coordinator' ? 'COORD' :
                                   msg.agentName.toUpperCase().slice(0, 4);
                  const roleName = msg.instanceNumber
                    ? `${baseRoleName}${msg.instanceNumber}`
                    : baseRoleName;
                  return (
                    <div key={`${msg.id}-${index}`} className="mb-2">
                      <div className="flex items-start gap-2">
                        <span className={cn('font-bold flex-shrink-0', colorClass)}>
                          [{roleName}]
                        </span>
                        <div className="flex-1 min-w-0">
                          {msg.type === 'action' && msg.toolName && (
                            <span className="text-yellow-400 mr-1">{`<${msg.toolName}>`}</span>
                          )}
                          {msg.type === 'error' ? (
                            <span className="text-red-400">{msg.content}</span>
                          ) : msg.type === 'result' ? (
                            <span className="text-cyan-400 whitespace-pre-wrap break-words">{msg.content}</span>
                          ) : msg.type === 'thinking' ? (
                            <span className="text-gray-500 italic">{msg.content}</span>
                          ) : (
                            <span className="text-green-400 whitespace-pre-wrap break-words">{msg.content}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {isStreaming && agentMessages.length > 0 && (
                <div className="text-green-400">
                  <span className="animate-pulse">_</span>
                </div>
              )}
            </div>
          </div>
          {/* Terminal footer with status */}
          <div className="flex items-center gap-3 px-4 py-2 border-t border-gray-800/80 bg-gradient-to-r from-gray-900/95 to-gray-900 text-[10px] text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/60"></span>
              {agentMessages.length} messages
            </span>
            <span className="ml-auto font-medium">
              {phase === 'building' ? (
                <span className="text-blue-400 flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Building
                </span>
              ) : phase === 'completed' ? (
                <span className="text-emerald-400">Complete</span>
              ) : (
                <span className="text-gray-400">{phase}</span>
              )}
            </span>
          </div>
        </div>

        {/* Build Output - Modern Card */}
        <Card className="h-1/3 flex flex-col bg-gradient-to-br from-background to-muted/20 border border-border/50 shadow-lg overflow-hidden rounded-xl">
          <CardHeader className="pb-2 flex-shrink-0 border-b border-border/40">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-slate-500/20 to-gray-500/10 flex items-center justify-center">
                  <Terminal className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <span className="font-semibold">Build Output</span>
                {buildLogs.length > 0 && (
                  <Badge className="h-5 px-1.5 text-[10px] bg-muted text-muted-foreground border-0">{buildLogs.length}</Badge>
                )}
              </div>
              {isStreaming && (
                <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-1">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-[10px] font-medium text-emerald-400">Live</span>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 min-h-0">
            <div
              ref={buildLogRef}
              className="h-full overflow-y-auto p-3 font-mono text-[10px] bg-[#0d1117] text-gray-100 scroll-smooth"
            >
              {buildLogs.length === 0 ? (
                <div className="text-gray-500 text-center py-4">
                  <Terminal className="h-6 w-6 mx-auto mb-2 opacity-30" />
                  <p className="text-[10px]">Build output will appear here</p>
                </div>
              ) : (
                buildLogs.map((log) => (
                  <div
                    key={log.id}
                    className={cn(
                      'py-0.5 border-b border-gray-800 last:border-0',
                      log.type === 'error' && 'bg-red-900/20',
                      log.type === 'success' && 'bg-green-900/10'
                    )}
                  >
                    <div className="flex items-start gap-1">
                      <span className={cn(
                        'flex-shrink-0 text-[9px]',
                        log.type === 'info' && 'text-blue-400',
                        log.type === 'success' && 'text-green-400',
                        log.type === 'warning' && 'text-yellow-400',
                        log.type === 'error' && 'text-red-400',
                        log.type === 'command' && 'text-purple-400',
                        log.type === 'tool' && 'text-cyan-400',
                        log.type === 'file' && 'text-orange-400',
                      )}>
                        {log.type === 'info' && '[I]'}
                        {log.type === 'success' && '[✓]'}
                        {log.type === 'warning' && '[!]'}
                        {log.type === 'error' && '[X]'}
                        {log.type === 'command' && '[$]'}
                        {log.type === 'tool' && '[T]'}
                        {log.type === 'file' && '[F]'}
                      </span>
                      <span className="text-gray-300 flex-1 min-w-0 truncate">
                        {log.message}
                      </span>
                    </div>
                    {log.detail && (
                      <div className="ml-4 text-[9px] text-gray-500 truncate" title={log.detail}>
                        {log.detail}
                      </div>
                    )}
                  </div>
                ))
              )}
              {isStreaming && buildLogs.length > 0 && (
                <div className="py-2 text-green-400 flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Building...</span>
                </div>
              )}
              {error && (
                <div className={`py-2 px-2 rounded mt-2 ${
                  connectionStatus === 'reconnecting'
                    ? 'text-yellow-400 bg-yellow-900/20'
                    : 'text-red-400 bg-red-900/20'
                }`}>
                  <div className="flex items-center gap-2">
                    {connectionStatus === 'reconnecting' ? (
                      <>
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        <span>{error}</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3 w-3" />
                        <span><span className="font-bold">Error:</span> {error}</span>
                      </>
                    )}
                  </div>
                  {connectionStatus === 'disconnected' && phase !== 'error' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={onResumeFromCheckpoint}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Try Resume
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
