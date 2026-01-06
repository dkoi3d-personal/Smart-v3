'use client';

import { useState } from 'react';
import { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  TestTube, CheckCircle, XCircle, Circle, Clock, FileCode, Loader2,
  ChevronRight, ChevronDown, Folder, FolderOpen, File, ListTree, LayoutList
} from 'lucide-react';
import { useProjectStore } from '@/stores/project-store';
import { useAgentStore } from '@/stores/agent-store';
import { cn, formatPercent, formatDuration } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type ViewMode = 'summary' | 'stories' | 'files';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  passed?: number;
  failed?: number;
  status?: 'passed' | 'failed' | 'mixed';
}

function buildFileTree(files: string[]): FileNode[] {
  const root: FileNode[] = [];

  for (const filePath of files) {
    const parts = filePath.split('/').filter(p => p);
    let current = root;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = i === parts.length - 1;

      let node = current.find(n => n.name === part);
      if (!node) {
        node = {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'folder',
          children: isFile ? undefined : [],
        };
        current.push(node);
      }

      if (!isFile && node.children) {
        current = node.children;
      }
    }
  }

  return root;
}

function FileTreeNode({ node, depth = 0 }: { node: FileNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isFolder = node.type === 'folder';
  const hasChildren = isFolder && node.children && node.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 py-0.5 px-1 rounded hover:bg-muted/50 cursor-pointer text-xs",
          depth > 0 && "ml-3"
        )}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />
        ) : (
          <span className="w-3" />
        )}
        {isFolder ? (
          expanded ? <FolderOpen className="h-3 w-3 text-amber-500" /> : <Folder className="h-3 w-3 text-amber-500" />
        ) : (
          <File className="h-3 w-3 text-blue-500" />
        )}
        <span className="truncate flex-1">{node.name}</span>
        {node.type === 'file' && (
          <CheckCircle className="h-3 w-3 text-green-500" />
        )}
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children!.map((child, i) => (
            <FileTreeNode key={child.path + i} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TestRunner() {
  const { project, testSuites, stories } = useProjectStore();
  const { agents } = useAgentStore();
  const testResults = project?.testResults;
  const [viewMode, setViewMode] = useState<ViewMode>('summary');

  // Get tester agent status
  const agentsArray = Array.from(agents.values());
  const testerAgent = agentsArray.find(a => a.type === 'tester');
  const isTestingInProgress = testerAgent?.status === 'working' || testerAgent?.status === 'thinking';

  // Convert testSuites Map to array with story info
  const storyTestResults = Array.from(testSuites.entries()).map(([storyId, suite]) => {
    const story = stories.find(s => s.id === storyId);
    return {
      storyId,
      storyTitle: story?.title || suite.name || storyId,
      suite,
    };
  });

  // Build test file tree from test files in project
  const testFiles = project?.testResults?.tests?.map(t => t.file).filter(Boolean) || [];
  const fileTree = buildFileTree(testFiles as string[]);

  // Calculate totals
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let totalDuration = 0;

  if (testResults) {
    totalPassed = testResults.passed || 0;
    totalFailed = testResults.failed || 0;
    totalSkipped = testResults.skipped || 0;
    totalDuration = testResults.totalDuration || 0;
  }

  const totalTests = totalPassed + totalFailed + totalSkipped;
  const passRate = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;

  return (
    <>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium flex items-center gap-2">
          <TestTube className="h-3 w-3" />
          Tests
          {totalTests > 0 && (
            <div className="ml-auto flex items-center gap-1">
              <Badge variant="outline" className="text-[10px] h-5 bg-green-50 dark:bg-green-950 text-green-600 border-green-300">
                {totalPassed}
              </Badge>
              {totalFailed > 0 && (
                <Badge variant="outline" className="text-[10px] h-5 bg-red-50 dark:bg-red-950 text-red-600 border-red-300">
                  {totalFailed}
                </Badge>
              )}
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col gap-2 min-h-0 pt-0">
        {/* Testing in Progress */}
        {isTestingInProgress && (
          <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
              <span className="text-blue-900 dark:text-blue-100 font-medium text-xs">
                Running Tests...
              </span>
            </div>
            {totalTests > 0 && (
              <div className="flex items-center gap-2 mt-1 text-[10px]">
                <span className="text-green-600">{totalPassed} passed</span>
                <span className="text-red-600">{totalFailed} failed</span>
              </div>
            )}
          </div>
        )}

        {totalTests > 0 ? (
          <>
            {/* View Mode Tabs */}
            <div className="flex gap-1 border-b border-border pb-1">
              <Button
                variant={viewMode === 'summary' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => setViewMode('summary')}
              >
                Summary
              </Button>
              <Button
                variant={viewMode === 'stories' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => setViewMode('stories')}
              >
                <LayoutList className="h-3 w-3 mr-1" />
                Stories ({storyTestResults.length})
              </Button>
              <Button
                variant={viewMode === 'files' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => setViewMode('files')}
              >
                <ListTree className="h-3 w-3 mr-1" />
                Files
              </Button>
            </div>

            {/* Summary View */}
            {viewMode === 'summary' && (
              <div className="space-y-2">
                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-medium">{totalPassed}/{totalTests} passing</span>
                    <span className={totalFailed === 0 ? "text-green-600" : "text-red-600"}>
                      {formatPercent(passRate)}
                    </span>
                  </div>
                  <Progress
                    value={passRate}
                    className={cn("h-1.5", totalFailed === 0 ? "[&>div]:bg-green-500" : "[&>div]:bg-red-500")}
                  />
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-1 text-[10px]">
                  <div className="flex flex-col items-center p-1.5 bg-green-50 dark:bg-green-950 rounded">
                    <CheckCircle className="h-3 w-3 text-green-600 mb-0.5" />
                    <span className="font-bold text-green-600">{totalPassed}</span>
                    <span className="text-muted-foreground">Passed</span>
                  </div>
                  <div className="flex flex-col items-center p-1.5 bg-red-50 dark:bg-red-950 rounded">
                    <XCircle className="h-3 w-3 text-red-600 mb-0.5" />
                    <span className="font-bold text-red-600">{totalFailed}</span>
                    <span className="text-muted-foreground">Failed</span>
                  </div>
                  <div className="flex flex-col items-center p-1.5 bg-gray-50 dark:bg-gray-950 rounded">
                    <Circle className="h-3 w-3 text-gray-600 mb-0.5" />
                    <span className="font-bold text-gray-600">{totalSkipped}</span>
                    <span className="text-muted-foreground">Skipped</span>
                  </div>
                </div>

                {/* Coverage */}
                {testResults?.coverage && testResults.coverage.lines > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-medium text-muted-foreground">Coverage</div>
                    <div className="grid grid-cols-2 gap-1 text-[10px]">
                      <div className="flex justify-between p-1 bg-muted/50 rounded">
                        <span className="text-muted-foreground">Lines</span>
                        <span className="font-medium">{formatPercent(testResults.coverage.lines)}</span>
                      </div>
                      <div className="flex justify-between p-1 bg-muted/50 rounded">
                        <span className="text-muted-foreground">Functions</span>
                        <span className="font-medium">{formatPercent(testResults.coverage.functions)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Duration */}
                {totalDuration > 0 && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Completed in {formatDuration(totalDuration)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Per-Story View */}
            {viewMode === 'stories' && (
              <ScrollArea className="flex-1">
                <div className="space-y-1.5 pr-2">
                  {storyTestResults.length > 0 ? (
                    storyTestResults.map(({ storyId, storyTitle, suite }) => {
                      const suiteTotal = suite.passed + suite.failed + (suite.skipped || 0);
                      const suitePassRate = suiteTotal > 0 ? (suite.passed / suiteTotal) * 100 : 0;
                      const allPassed = suite.failed === 0;

                      return (
                        <div
                          key={storyId}
                          className={cn(
                            "p-2 rounded border text-xs",
                            allPassed
                              ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900"
                              : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              {allPassed ? (
                                <CheckCircle className="h-3 w-3 text-green-600 shrink-0" />
                              ) : (
                                <XCircle className="h-3 w-3 text-red-600 shrink-0" />
                              )}
                              <span className="font-medium truncate">{storyTitle}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Badge variant="outline" className="text-[9px] h-4 px-1 bg-green-100 dark:bg-green-900">
                                {suite.passed}
                              </Badge>
                              {suite.failed > 0 && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1 bg-red-100 dark:bg-red-900">
                                  {suite.failed}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Progress
                            value={suitePassRate}
                            className={cn("h-1", allPassed ? "[&>div]:bg-green-500" : "[&>div]:bg-red-500")}
                          />
                          <div className="flex items-center justify-between mt-1 text-[9px] text-muted-foreground">
                            <span>{formatPercent(suitePassRate)} passing</span>
                            {suite.totalDuration > 0 && (
                              <span className="flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" />
                                {formatDuration(suite.totalDuration)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-[10px] text-muted-foreground text-center py-4">
                      No per-story breakdown available
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}

            {/* File Tree View */}
            {viewMode === 'files' && (
              <ScrollArea className="flex-1">
                <div className="pr-2">
                  {fileTree.length > 0 ? (
                    fileTree.map((node, i) => (
                      <FileTreeNode key={node.path + i} node={node} />
                    ))
                  ) : (
                    <div className="text-[10px] text-muted-foreground text-center py-4">
                      <FileCode className="h-6 w-6 mx-auto mb-1 opacity-30" />
                      <p>No test files detected</p>
                      <p className="mt-1">Test files will appear here after tests run</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[10px] text-muted-foreground">
            <div className="text-center">
              <TestTube className="h-6 w-6 mx-auto mb-1 opacity-30" />
              <p>No tests run yet</p>
            </div>
          </div>
        )}
      </CardContent>
    </>
  );
}
