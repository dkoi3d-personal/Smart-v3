'use client';

import { useState } from 'react';
import {
  TestTube, LayoutGrid, Loader2, Zap, TrendingDown,
  CheckCircle, XCircle, Circle, AlertTriangle, ChevronDown, ChevronRight,
  FileCode
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { TestingMetrics, AgentMessage, FileTestResult } from '../../types';
import {
  useTestingMetrics,
  useAgentMessages,
  useAgentStatuses,
} from '../../stores/useBuildPageStore';

interface TestingTabProps {
  terminalRef?: (el: HTMLDivElement | null) => void;
}

type ViewMode = 'results' | 'files' | 'failures';

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function FileTreeNode({
  file,
  depth = 0,
  expanded,
  onToggle,
}: {
  file: FileTestResult;
  depth?: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasTests = file.tests && file.tests.length > 0;
  const fileName = file.path.split('/').pop() || file.path;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1.5 py-1 px-2 rounded hover:bg-muted/50 cursor-pointer text-xs',
          depth > 0 && 'ml-3'
        )}
        onClick={onToggle}
      >
        {hasTests ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )
        ) : (
          <span className="w-3" />
        )}
        <FileCode className="h-3 w-3 text-blue-500" />
        <span className="truncate flex-1 font-mono">{fileName}</span>
        <div className="flex items-center gap-1">
          {file.passed > 0 && (
            <Badge variant="outline" className="text-[9px] h-4 px-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
              {file.passed}
            </Badge>
          )}
          {file.failed > 0 && (
            <Badge variant="outline" className="text-[9px] h-4 px-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300">
              {file.failed}
            </Badge>
          )}
        </div>
        {file.status === 'passed' && <CheckCircle className="h-3 w-3 text-green-500" />}
        {file.status === 'failed' && <XCircle className="h-3 w-3 text-red-500" />}
        {file.status === 'mixed' && <AlertTriangle className="h-3 w-3 text-yellow-500" />}
      </div>
      {expanded && hasTests && (
        <div className="ml-6 border-l border-muted pl-2">
          {file.tests.map((test, idx) => (
            <div
              key={`${test.id}-${idx}`}
              className={cn(
                'flex items-center gap-1.5 py-0.5 px-2 text-[10px]',
                test.status === 'failed' && 'text-red-600 dark:text-red-400'
              )}
            >
              {test.status === 'passed' && <CheckCircle className="h-2.5 w-2.5 text-green-500" />}
              {test.status === 'failed' && <XCircle className="h-2.5 w-2.5 text-red-500" />}
              {test.status === 'skipped' && <Circle className="h-2.5 w-2.5 text-gray-400" />}
              <span className="truncate flex-1">{test.name}</span>
              <span className="text-muted-foreground">{formatDuration(test.duration)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TestingTab({
  terminalRef,
}: TestingTabProps) {
  // Get state from store selectors
  const testingMetrics = useTestingMetrics();
  const agentMessages = useAgentMessages();
  const agentStatuses = useAgentStatuses();

  const testerMessages = agentMessages.filter((m) => m.agentRole === 'tester');
  const [viewMode, setViewMode] = useState<ViewMode>('results');
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const toggleFile = (path: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const hasData = testingMetrics.totalTests > 0;
  const hasCoverageBreakdown = testingMetrics.coverageBreakdown !== undefined;
  const hasPerformance = testingMetrics.performance !== undefined;
  const hasFailures = (testingMetrics.failedTestDetails?.length || 0) > 0;
  const hasFileResults = (testingMetrics.fileResults?.length || 0) > 0;

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Top Row - 3 Metric Cards */}
      <div className="grid grid-cols-3 gap-3 flex-shrink-0">
        {/* Test Results Card */}
        <Card className="border-2 border-green-700 bg-green-950/30">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-xs font-bold text-green-400 flex items-center gap-2">
              <TestTube className="h-3.5 w-3.5" />
              TEST RESULTS
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="flex items-center gap-4 mb-3">
              <div
                className={cn(
                  'text-4xl font-black',
                  testingMetrics.passRate >= 90
                    ? 'text-green-400'
                    : testingMetrics.passRate >= 70
                    ? 'text-yellow-400'
                    : testingMetrics.passRate > 0
                    ? 'text-red-400'
                    : 'text-gray-500'
                )}
              >
                {hasData ? `${testingMetrics.passRate.toFixed(0)}%` : '--'}
              </div>
              <div className="flex-1">
                <div className="text-lg font-bold text-white">
                  {testingMetrics.passed}/{testingMetrics.totalTests} tests
                </div>
                <div className="text-sm text-gray-400">{testingMetrics.storiesTested} stories tested</div>
                {testingMetrics.duration > 0 && (
                  <div className="text-xs text-gray-500">
                    Duration: {formatDuration(testingMetrics.duration)}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-green-900/50 rounded p-2">
                <div className="text-xl font-bold text-green-400">{testingMetrics.passed}</div>
                <div className="text-xs text-gray-400">PASSED</div>
              </div>
              <div className="bg-red-900/50 rounded p-2">
                <div className="text-xl font-bold text-red-400">{testingMetrics.failed}</div>
                <div className="text-xs text-gray-400">FAILED</div>
              </div>
              <div className="bg-gray-800 rounded p-2">
                <div className="text-xl font-bold text-gray-400">{testingMetrics.skipped}</div>
                <div className="text-xs text-gray-400">SKIPPED</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coverage Card with Breakdown */}
        <Card className="border-2 border-blue-700 bg-blue-950/30">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-xs font-bold text-blue-400 flex items-center gap-2">
              <LayoutGrid className="h-3.5 w-3.5" />
              COVERAGE
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            {hasCoverageBreakdown ? (
              <div className="space-y-2">
                {/* Coverage breakdown grid */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Lines', value: testingMetrics.coverageBreakdown!.lines },
                    { label: 'Statements', value: testingMetrics.coverageBreakdown!.statements },
                    { label: 'Functions', value: testingMetrics.coverageBreakdown!.functions },
                    { label: 'Branches', value: testingMetrics.coverageBreakdown!.branches },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-blue-900/30 rounded p-2">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-gray-400">{label}</span>
                        <span className={cn(
                          'text-sm font-bold',
                          value >= 80 ? 'text-green-400' : value >= 60 ? 'text-yellow-400' : 'text-red-400'
                        )}>
                          {value}%
                        </span>
                      </div>
                      <Progress
                        value={value}
                        className={cn(
                          'h-1',
                          value >= 80 ? '[&>div]:bg-green-500' : value >= 60 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-red-500'
                        )}
                      />
                    </div>
                  ))}
                </div>
                <div className="text-xs text-center text-gray-500">
                  {testingMetrics.coverageBreakdown!.lines >= 80
                    ? 'Excellent coverage'
                    : testingMetrics.coverageBreakdown!.lines >= 60
                    ? 'Good coverage'
                    : 'Needs improvement'}
                </div>
              </div>
            ) : (
              <div className="text-center mb-3">
                <div className="text-4xl font-black text-blue-400">
                  {testingMetrics.coverage !== undefined ? `${testingMetrics.coverage}%` : '--'}
                </div>
                <div className="text-sm text-gray-400">Code Coverage</div>
                <div className="h-2 bg-gray-800 rounded-full mt-2 mb-2">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      testingMetrics.coverage && testingMetrics.coverage >= 80
                        ? 'bg-green-500'
                        : testingMetrics.coverage && testingMetrics.coverage >= 60
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    )}
                    style={{ width: `${testingMetrics.coverage || 0}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500">
                  {testingMetrics.coverage !== undefined
                    ? testingMetrics.coverage >= 80
                      ? 'Excellent'
                      : testingMetrics.coverage >= 60
                      ? 'Good'
                      : 'Needs Improvement'
                    : 'No coverage data'}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Card */}
        <Card className="border-2 border-purple-700 bg-purple-950/30">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-xs font-bold text-purple-400 flex items-center gap-2">
              <Zap className="h-3.5 w-3.5" />
              PERFORMANCE
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            {hasPerformance ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-purple-900/30 rounded p-2 text-center">
                    <div className="text-lg font-bold text-purple-300">
                      {formatDuration(testingMetrics.performance!.averageDuration)}
                    </div>
                    <div className="text-[10px] text-gray-400">Avg Duration</div>
                  </div>
                  <div className="bg-purple-900/30 rounded p-2 text-center">
                    <div className="text-lg font-bold text-purple-300">
                      {testingMetrics.performance!.testsPerSecond.toFixed(1)}
                    </div>
                    <div className="text-[10px] text-gray-400">Tests/sec</div>
                  </div>
                </div>
                {testingMetrics.performance!.slowestTests.length > 0 && (
                  <div className="bg-purple-900/20 rounded p-2">
                    <div className="text-[10px] text-gray-400 mb-1 flex items-center gap-1">
                      <TrendingDown className="h-3 w-3" /> Slowest Tests
                    </div>
                    {testingMetrics.performance!.slowestTests.slice(0, 3).map((t, i) => (
                      <div key={i} className="flex justify-between text-[10px] py-0.5">
                        <span className="truncate flex-1 text-gray-300">{t.name}</span>
                        <span className="text-purple-300 ml-2">{formatDuration(t.duration)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center">
                <div className="text-4xl font-black text-purple-400">
                  {testingMetrics.duration > 0 ? formatDuration(testingMetrics.duration) : '--'}
                </div>
                <div className="text-sm text-gray-400">Total Duration</div>
                <div className="text-xs text-gray-500 mt-2">
                  {hasData ? `${testingMetrics.totalTests} tests run` : 'No performance data yet'}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Middle Section - View Toggle + Content */}
      <div className="flex-1 flex flex-col overflow-hidden border-2 border-gray-700 rounded bg-gray-900/50">
        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-700 bg-gray-800/50">
          <button
            onClick={() => setViewMode('results')}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded transition-colors',
              viewMode === 'results'
                ? 'bg-green-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            )}
          >
            <TestTube className="h-3 w-3 inline mr-1" />
            Agent Output
          </button>
          <button
            onClick={() => setViewMode('files')}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded transition-colors',
              viewMode === 'files'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            )}
          >
            <FileCode className="h-3 w-3 inline mr-1" />
            Test Files ({testingMetrics.fileResults?.length || 0})
          </button>
          <button
            onClick={() => setViewMode('failures')}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded transition-colors',
              viewMode === 'failures'
                ? 'bg-red-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700',
              hasFailures && viewMode !== 'failures' && 'animate-pulse'
            )}
          >
            <XCircle className="h-3 w-3 inline mr-1" />
            Failures ({testingMetrics.failedTestDetails?.length || 0})
          </button>
          <div className="ml-auto flex items-center gap-2">
            {agentStatuses.get('tester') === 'working' && (
              <div className="flex items-center gap-1 text-xs text-green-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                Running...
              </div>
            )}
            {hasData && (
              <Badge variant="outline" className="text-xs border-green-700 text-green-400">
                {testingMetrics.passed}/{testingMetrics.totalTests} passing
              </Badge>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {viewMode === 'results' && (
            <ScrollArea className="h-full">
              <div className="p-4 font-mono text-sm leading-relaxed" ref={terminalRef}>
                {testerMessages.length === 0 ? (
                  <div className="text-gray-600">
                    <span className="text-green-500">$</span> Waiting for test execution...
                  </div>
                ) : (
                  testerMessages.map((msg) => (
                    <div key={msg.id} className="mb-3">
                      {msg.type === 'action' && msg.toolName && (
                        <span className="text-yellow-400 font-bold">[{msg.toolName}] </span>
                      )}
                      <span
                        className={
                          msg.type === 'error'
                            ? 'text-red-400'
                            : msg.type === 'result'
                            ? 'text-cyan-400 whitespace-pre-wrap'
                            : msg.type === 'thinking'
                            ? 'text-gray-500 italic'
                            : 'text-green-400 whitespace-pre-wrap'
                        }
                      >
                        {msg.content}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          )}

          {viewMode === 'files' && (
            <ScrollArea className="h-full">
              <div className="p-3">
                {hasFileResults ? (
                  <div className="space-y-1">
                    {testingMetrics.fileResults!.map((file) => (
                      <FileTreeNode
                        key={file.path}
                        file={file}
                        expanded={expandedFiles.has(file.path)}
                        onToggle={() => toggleFile(file.path)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <FileCode className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No test files detected yet</p>
                    <p className="text-xs mt-1">Test files will appear here after tests run</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          {viewMode === 'failures' && (
            <ScrollArea className="h-full">
              <div className="p-3">
                {hasFailures ? (
                  <div className="space-y-3">
                    {testingMetrics.failedTestDetails!.map((failure, idx) => (
                      <div
                        key={idx}
                        className="bg-red-950/30 border border-red-800 rounded p-3"
                      >
                        <div className="flex items-start gap-2">
                          <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-red-300 text-sm">{failure.name}</div>
                            <div className="text-xs text-gray-500 font-mono mt-0.5">{failure.file}</div>
                            <div className="mt-2 p-2 bg-gray-900 rounded text-xs font-mono text-red-400 whitespace-pre-wrap overflow-x-auto">
                              {failure.error}
                            </div>
                            {failure.stackTrace && (
                              <details className="mt-2">
                                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                                  Stack trace
                                </summary>
                                <pre className="mt-1 p-2 bg-gray-900 rounded text-[10px] font-mono text-gray-400 overflow-x-auto whitespace-pre-wrap">
                                  {failure.stackTrace}
                                </pre>
                              </details>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500 opacity-50" />
                    <p className="text-sm text-green-400">No test failures!</p>
                    <p className="text-xs mt-1">All tests are passing</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}
