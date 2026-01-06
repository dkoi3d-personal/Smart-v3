'use client';

/**
 * IteratePage - Page component for completed projects in iterate mode
 *
 * This is the main page wrapper for iterate mode that:
 * - Renders tabs with Plan first (for iterating on completed builds)
 * - Composes existing tab components
 * - Handles metrics display
 *
 * Each tab is imported from the tabs/ folder as its own micro-component.
 */

import React from 'react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';

// Import tab components
import { ArchitecturePanel } from '@/components/panels/ArchitecturePanel';
import {
  SecurityTab,
  TestingTab,
  BuildTab,
  DevelopmentTab,
  ComplianceTab,
  DeployTab,
  AuditTab,
  SettingsTab,
  UATTab,
} from '@/features/build/components/tabs';
import type { QuickSettings } from '@/features/build/types';
import { ProjectWorkspace } from '@/features/build/components/workspace';

// Types
import type {
  Epic,
  Task,
  AgentMessage,
  ResearchSuggestion,
  BuildLog,
  BuildMetrics,
  SecurityMetrics,
  TestingMetrics,
  TreeNode,
  BuildPhase,
  MainTab,
  PreviewStatus,
  ConnectionStatus,
  IterationState,
  OverviewMode,
} from '@/features/build/types';

// Note: Tab navigation and metrics have been moved to the unified BuildPageHeader and BuildTab components

export interface IteratePageProps {
  // Core identifiers
  projectId: string;
  projectName: string;
  projectDirectory?: string;

  // Build state
  phase: BuildPhase;
  tasks: Task[];
  epics: Epic[];
  buildMetrics: BuildMetrics;
  testingMetrics: TestingMetrics;
  securityMetrics: SecurityMetrics | null;

  // Iteration state
  iterationState: IterationState | null;
  overviewMode: OverviewMode;
  isIterating: boolean;
  isFixing: boolean;
  isStreaming: boolean;
  userPrompt: string;
  iterationRequest: string | null;
  /** Current iteration ID - stories are filtered by this in iterate mode */
  currentIterationId?: string;

  // Research state
  isResearching: boolean;
  researchSuggestions: ResearchSuggestion[];

  // UI state
  mainTab: MainTab;
  taskBoardView: 'kanban' | 'epics';
  expandedEpics: Set<string>;
  selectedFile: string | null;
  hasCheckpoint: boolean;

  // Development tab state
  tree: TreeNode[];
  fileContents: Map<string, string>;
  currentFileContent: string;
  previewStatus: PreviewStatus;
  previewUrl: string | null;
  previewKey: number;
  previewError: string | null;
  hasPackageJson: boolean;
  firstHtmlFile?: string;

  // Agent state
  agentStatuses: Map<string, string>;
  agentMessages: AgentMessage[];
  buildLogs: BuildLog[];
  error: string | null;
  connectionStatus: ConnectionStatus;
  deploymentUrl: string | null;

  // Healthcare settings (optional)
  healthcareSettings?: {
    complianceLevel?: 'hipaa' | 'hipaa-hitrust' | 'basic';
    appType?: 'patient-facing' | 'clinical' | 'administrative' | 'analytics';
    dataTypes?: string[];
  } | null;

  // Database config (optional)
  databaseConfig?: {
    provider: string;
    schemaTemplate: string;
  } | null;

  // Git settings
  gitRepoUrl: string;
  gitBranch: string;
  isCloningRepo: boolean;
  gitCloneError: string | null;
  quickSettings: QuickSettings;
  onGitRepoUrlChange: (url: string) => void;
  onGitBranchChange: (branch: string) => void;
  onIsCloningChange: (isCloning: boolean) => void;
  onQuickSettingsChange: (settings: QuickSettings) => void;
  onGitCloneErrorChange: (error: string | null) => void;

  // Callbacks
  onMainTabChange: (tab: MainTab) => void;
  onTaskBoardViewChange: (view: 'kanban' | 'epics') => void;
  onExpandedEpicsChange: (epics: Set<string>) => void;
  onPhaseChange: (phase: BuildPhase) => void;
  onUserPromptChange: (prompt: string) => void;
  onSelectedStoryChange: (task: Task | null) => void;
  onShowEpicExplorerChange: (show: boolean) => void;
  onOverviewModeChange: (mode: OverviewMode) => void;
  onSecurityMetricsChange: (metrics: SecurityMetrics) => void;
  onPreviewKeyChange: (key: number) => void;
  onDeploymentUrlChange: (url: string) => void;

  // Actions
  onResume: () => void;
  onPause: () => void;
  onStop: () => void;
  onSendIteration: (request: string) => Promise<void>;
  onSendFigmaIteration: (figmaUrl: string, context: string) => Promise<void>;
  onRunResearch: () => Promise<void>;
  onAddSuggestionToBacklog: (suggestion: ResearchSuggestion) => void;
  onRunFixer: (mode: 'build' | 'custom', command?: string) => Promise<void>;
  onFetchFiles: () => Promise<void>;
  onStartDevServer: () => Promise<void>;
  onStopDevServer: () => void;
  onAddLog: (type: 'info' | 'error' | 'success', message: string) => void;

  // Render helpers
  renderTaskCard: (task: Task, showEpic?: boolean) => React.ReactNode;
  renderTreeNode: (node: TreeNode, level?: number) => React.ReactNode;

  // Refs
  buildLogRef: React.RefObject<HTMLDivElement | null>;
  terminalRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

/**
 * IteratePage - Main page component for iterate mode
 */
export function IteratePage(props: IteratePageProps) {
  const {
    // Core identifiers
    projectId,
    projectName,
    projectDirectory,

    // Build state
    phase,
    tasks,
    epics,
    buildMetrics,
    testingMetrics,
    securityMetrics,

    // Iteration state
    iterationState,
    overviewMode,
    isIterating,
    isFixing,
    isStreaming,
    userPrompt,
    iterationRequest,
    currentIterationId,

    // Research state
    isResearching,
    researchSuggestions,

    // UI state
    mainTab,
    taskBoardView,
    expandedEpics,
    selectedFile,
    hasCheckpoint,

    // Development tab state
    tree,
    fileContents,
    currentFileContent,
    previewStatus,
    previewUrl,
    previewKey,
    previewError,
    hasPackageJson,
    firstHtmlFile,

    // Agent state
    agentStatuses,
    agentMessages,
    buildLogs,
    error,
    connectionStatus,
    deploymentUrl,

    // Healthcare and database config
    healthcareSettings,
    databaseConfig,

    // Git settings
    gitRepoUrl,
    gitBranch,
    isCloningRepo,
    gitCloneError,
    quickSettings,
    onGitRepoUrlChange,
    onGitBranchChange,
    onIsCloningChange,
    onQuickSettingsChange,
    onGitCloneErrorChange,

    // Callbacks
    onMainTabChange,
    onTaskBoardViewChange,
    onExpandedEpicsChange,
    onPhaseChange,
    onUserPromptChange,
    onSelectedStoryChange,
    onShowEpicExplorerChange,
    onOverviewModeChange,
    onSecurityMetricsChange,
    onPreviewKeyChange,
    onDeploymentUrlChange,

    // Actions
    onResume,
    onPause,
    onStop,
    onSendIteration,
    onSendFigmaIteration,
    onRunResearch,
    onAddSuggestionToBacklog,
    onRunFixer,
    onFetchFiles,
    onStartDevServer,
    onStopDevServer,
    onAddLog,

    // Render helpers
    renderTaskCard,
    renderTreeNode,

    // Refs
    buildLogRef,
    terminalRefs,
  } = props;

  return (
    <Tabs
      value={mainTab}
      onValueChange={(v) => onMainTabChange(v as MainTab)}
      className="h-full flex flex-col"
    >
      {/* Plan Tab - Iteration Planning (First for iterate mode) */}
      <TabsContent value="plan" className="flex-1 m-0 overflow-hidden">
        <ProjectWorkspace
          projectId={projectId}
          projectDir={projectDirectory || ''}
          projectName={projectName || projectId}
          tasks={tasks}
          epics={epics}
          iterationState={iterationState}
          buildMetrics={buildMetrics}
          testingMetrics={testingMetrics}
          securityMetrics={securityMetrics}
          isBuilding={isIterating || isStreaming}
          userPrompt={userPrompt}
          researchSuggestions={researchSuggestions}
          isResearching={isResearching}
          onUserPromptChange={onUserPromptChange}
          onStartBuild={(req) => onSendIteration(req)}
          onStartFigmaBuild={onSendFigmaIteration}
          onRunResearch={onRunResearch}
          onAddSuggestionToBacklog={onAddSuggestionToBacklog}
          onShowEpicExplorer={() => onShowEpicExplorerChange(true)}
          onSelectStory={onSelectedStoryChange}
          lastBuildPrompt={iterationRequest || undefined}
        />
      </TabsContent>

      {/* Build Tab - Kanban Board */}
      <TabsContent value="build" className="flex-1 m-0 overflow-hidden">
        <BuildTab
          projectId={projectId}
          taskBoardView={taskBoardView}
          expandedEpics={expandedEpics}
          onTaskBoardViewChange={onTaskBoardViewChange}
          onExpandedEpicsChange={onExpandedEpicsChange}
          onPhaseChange={onPhaseChange}
          onUserPromptChange={onUserPromptChange}
          onSelectedStoryChange={onSelectedStoryChange}
          onOverviewModeChange={onOverviewModeChange}
          onResume={onResume}
          onPause={onPause}
          onStop={onStop}
          renderTaskCard={renderTaskCard}
          isIterateMode={true}
          currentIterationId={currentIterationId}
        />
      </TabsContent>

      {/* Development Tab */}
      <TabsContent value="development" className="flex-1 m-0 overflow-hidden">
        <DevelopmentTab
          projectId={projectId}
          projectName={projectName}
          tree={tree}
          selectedFile={selectedFile}
          currentFileContent={currentFileContent}
          onFetchFiles={onFetchFiles}
          renderTreeNode={renderTreeNode}
          previewStatus={previewStatus}
          previewUrl={previewUrl}
          previewKey={previewKey}
          previewError={previewError}
          hasPackageJson={hasPackageJson}
          firstHtmlFile={firstHtmlFile}
          onStartDevServer={onStartDevServer}
          onStopDevServer={onStopDevServer}
          onPreviewKeyChange={onPreviewKeyChange}
          buildLogRef={buildLogRef}
          onRunFixer={onRunFixer}
          onResumeFromCheckpoint={onResume}
          terminalRef={(el) => {
            if (el) terminalRefs.current.set('main', el);
          }}
        />
      </TabsContent>

      {/* Testing Tab */}
      <TabsContent value="testing" className="flex-1 m-0 overflow-hidden">
        <TestingTab
          terminalRef={(el) => {
            if (el) terminalRefs.current.set('tester', el);
          }}
        />
      </TabsContent>

      {/* Security Tab */}
      <TabsContent value="security" className="flex-1 m-0 overflow-hidden">
        <SecurityTab
          projectId={projectId}
          onSecurityMetricsChange={onSecurityMetricsChange}
          onAddLog={onAddLog}
          terminalRef={(el) => {
            if (el) terminalRefs.current.set('security', el);
          }}
        />
      </TabsContent>

      {/* Compliance Tab */}
      <TabsContent value="compliance" className="flex-1 m-0 overflow-hidden">
        <ComplianceTab
          projectId={projectId}
          projectPath={projectDirectory}
          onFileOpen={(file, line) => {
            console.log(`Open file: ${file}:${line}`);
            onMainTabChange('development');
          }}
        />
      </TabsContent>

      {/* Architecture Tab */}
      <TabsContent value="architecture" className="flex-1 m-0 overflow-hidden">
        <Card className="h-full border-2">
          <ArchitecturePanel projectId={projectId} projectPath={projectDirectory} />
        </Card>
      </TabsContent>

      {/* Deploy Tab */}
      <TabsContent value="deploy" className="flex-1 m-0 overflow-hidden">
        <Card className="h-full border-2 bg-gradient-to-br from-background to-orange-950/10">
          <DeployTab
            projectId={projectId}
            projectName={projectName || projectId}
            projectDirectory={projectDirectory || ''}
            buildStatus={phase}
            initialDeploymentUrl={deploymentUrl}
            healthcareSettings={healthcareSettings}
            databaseConfig={databaseConfig}
            onDeployComplete={(url) => {
              onDeploymentUrlChange(url);
              fetch('/api/projects', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, deploymentUrl: url }),
              }).catch(console.error);
            }}
          />
        </Card>
      </TabsContent>

      {/* Audit Tab */}
      <TabsContent value="audit" className="flex-1 m-0 overflow-auto">
        <AuditTab projectId={projectId} />
      </TabsContent>

      {/* UAT Tab - User Acceptance Testing */}
      <TabsContent value="uat" className="flex-1 m-0 overflow-hidden">
        <UATTab projectId={projectId} />
      </TabsContent>

      {/* Settings Tab */}
      <TabsContent value="settings" className="flex-1 m-0 overflow-auto">
        <SettingsTab
          projectId={projectId}
          projectName={projectName}
          gitRepoUrl={gitRepoUrl}
          gitBranch={gitBranch}
          isCloningRepo={isCloningRepo}
          gitCloneError={gitCloneError}
          quickSettings={quickSettings}
          onGitRepoUrlChange={onGitRepoUrlChange}
          onGitBranchChange={onGitBranchChange}
          onIsCloningChange={onIsCloningChange}
          onQuickSettingsChange={onQuickSettingsChange}
          onGitCloneErrorChange={onGitCloneErrorChange}
        />
      </TabsContent>
    </Tabs>
  );
}

export default IteratePage;
