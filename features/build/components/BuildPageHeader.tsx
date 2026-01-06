'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Code2,
  Shield,
  Stethoscope,
  BookOpen,
  Rocket,
  FileText,
  LayoutGrid,
  ClipboardList,
  Settings,
  Loader2,
  Wrench,
  Home,
  Globe,
  ExternalLink,
  Wifi,
  WifiOff,
  Edit3,
  Target,
  FolderOpen,
  Check,
  Plus,
  X,
  GitBranch,
  Folder,
  RefreshCw,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { BuildPhase, MainTab } from '../types';
import { AGENT_COLORS, AGENT_ICONS } from '../constants';

interface Project {
  projectId: string;
  config?: {
    name?: string;
  };
  requirements?: string;
  buildType?: 'quick' | 'complex';
}

interface BuildPageHeaderProps {
  // Project info
  projectId: string;
  projectName: string;
  phase: BuildPhase;
  deploymentUrl: string | null;

  // Tab state
  mainTab: MainTab;
  onMainTabChange: (tab: MainTab) => void;
  isIterateMode: boolean;

  // Agent state
  agentStatuses: Map<string, string>;

  // Connection state
  wsConnected: boolean;

  // Status indicators
  isIterating: boolean;
  isResearching: boolean;
  isFixing: boolean;

  // Callbacks
  onShowProjectContext?: () => void;
}

// Primary tabs - main workflow (Plan → Build → Code → UAT → Deploy)
const PRIMARY_TABS = [
  { id: 'plan', label: 'Plan', icon: ClipboardList, color: 'text-violet-400' },
  { id: 'build', label: 'Build', icon: LayoutGrid, color: 'text-green-400' },
  { id: 'development', label: 'Code', icon: Code2, color: 'text-cyan-400' },
  { id: 'uat', label: 'UAT', icon: Target, color: 'text-orange-400' },
  { id: 'deploy', label: 'Deploy', icon: Rocket, color: 'text-amber-400' },
] as const;

// Secondary tabs - supporting views
const SECONDARY_TABS = [
  { id: 'testing', label: 'Testing', icon: Wrench, color: 'text-yellow-400' },
  { id: 'security', label: 'Security', icon: Shield, color: 'text-red-400' },
  { id: 'compliance', label: 'Compliance', icon: Stethoscope, color: 'text-purple-400' },
  { id: 'architecture', label: 'Arch', icon: BookOpen, color: 'text-indigo-400' },
  { id: 'audit', label: 'Audit', icon: FileText, color: 'text-teal-400' },
] as const;

export function BuildPageHeader({
  projectId,
  projectName,
  phase,
  deploymentUrl,
  mainTab,
  onMainTabChange,
  isIterateMode,
  agentStatuses,
  wsConnected,
  isIterating,
  isResearching,
  isFixing,
  onShowProjectContext,
}: BuildPageHeaderProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  // New Project Modal state
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectMode, setNewProjectMode] = useState<'blank' | 'github'>('blank');
  const [githubUrl, setGithubUrl] = useState('');
  const [githubBranch, setGithubBranch] = useState('');


  // Create a new scaffolded project
  const handleCreateNewProject = async () => {
    if (isCreatingProject || !newProjectName.trim()) return;

    setIsCreatingProject(true);

    try {
      if (newProjectMode === 'github' && githubUrl) {
        // Clone from GitHub
        const response = await fetch('/api/git/clone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repoUrl: githubUrl,
            branch: githubBranch || undefined,
            projectName: newProjectName.trim(),
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to clone repository');
        }

        const data = await response.json();
        setShowNewProjectModal(false);
        setNewProjectName('');
        setGithubUrl('');
        setGithubBranch('');
        setNewProjectMode('blank');
        router.push(`/build/${data.projectId}?tab=plan`);
      } else {
        // Create blank project
        // Generate a project ID from name (slug format)
        const newProjectId = newProjectName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') + '-' + Date.now().toString(36);

        // Create the project
        const createRes = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: newProjectId,
            requirements: '',
            config: {
              name: newProjectName.trim(),
              description: '',
              techStack: ['next.js', 'typescript', 'tailwind'],
            },
            buildType: 'complex',
          }),
        });

        if (!createRes.ok) throw new Error('Failed to create project');

        // Run scaffold
        const scaffoldRes = await fetch(`/api/projects/${newProjectId}/scaffold`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: newProjectId }),
        });

        if (!scaffoldRes.ok) throw new Error('Failed to scaffold project');

        setShowNewProjectModal(false);
        setNewProjectName('');
        setNewProjectMode('blank');

        // Navigate to the new project
        router.push(`/build/${newProjectId}?tab=plan`);
      }
    } catch (error) {
      console.error('Failed to create project:', error);
      alert(`Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCreatingProject(false);
    }
  };

  // Fetch projects
  useEffect(() => {
    async function fetchProjects() {
      try {
        const response = await fetch('/api/projects');
        if (response.ok) {
          const data = await response.json();
          setProjects(data.projects || []);
        }
      } catch (error) {
        console.error('Failed to fetch projects:', error);
      } finally {
        setProjectsLoaded(true);
      }
    }
    fetchProjects();
  }, []);

  // Filter valid projects - only show complex builds in dropdown
  const validProjects = projects.filter(p =>
    p.projectId &&
    p.projectId !== 'undefined' &&
    p.buildType === 'complex'
  );
  // Current project lookup from all projects (for displaying name)
  const currentProject = projects.find(p => p.projectId === projectId);

  // Display name - show "Loading..." until projects are loaded, avoid showing UUIDs
  // Helper to extract name from requirements (first markdown heading or repo name from clone URL)
  const extractNameFromRequirements = (requirements: string | undefined): string | null => {
    if (!requirements) return null;
    // Try markdown heading first
    const headingMatch = requirements.match(/^#\s+(.+)$/m);
    if (headingMatch) return headingMatch[1].trim();
    // Try extracting repo name from clone URL
    const cloneMatch = requirements.match(/[Cc]loned from .+\/([^\/\s]+?)(?:\.git)?(?:\s|$)/);
    if (cloneMatch) return cloneMatch[1].replace(/-/g, ' ');
    return null;
  };

  const rawDisplayName = currentProject?.config?.name || projectName || '';
  // Only match actual UUIDs (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
  const isUuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(rawDisplayName);
  const extractedName = isUuid ? extractNameFromRequirements(currentProject?.requirements) : null;
  const displayName = !projectsLoaded ? 'Loading...' : (extractedName || (rawDisplayName && !isUuid ? rawDisplayName : 'Unnamed Project'));

  const handleProjectSelect = (selectedProjectId: string) => {
    setShowProjectSelector(false);
    if (selectedProjectId !== projectId) {
      router.push(`/build/${selectedProjectId}?tab=plan`);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    if (!showProjectSelector) return;
    const handleClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-header-project-selector]')) {
        setShowProjectSelector(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showProjectSelector]);

  return (
    <>
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 gap-4">
        {/* Left: Logo & Project */}
        <div className="flex items-center gap-3 min-w-[200px]">
          {/* Plus Icon - Create New Project */}
          <button
            onClick={() => setShowNewProjectModal(true)}
            disabled={isCreatingProject}
            className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-500/20 hover:bg-green-500/30 transition-colors disabled:opacity-50"
            title="Create New Project"
          >
            {isCreatingProject ? (
              <Loader2 className="h-4 w-4 text-green-400 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 text-green-400" />
            )}
          </button>

          {/* Folder Icon - Triggers Project Selector */}
          <button
            onClick={() => setShowProjectSelector(!showProjectSelector)}
            className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 border border-indigo-500/20 hover:bg-indigo-500/30 transition-colors"
            title="Switch Project"
          >
            <FolderOpen className="h-4 w-4 text-indigo-400" />
          </button>

          {/* Project Name - Shows Context when clicked, or dropdown when folder clicked */}
          <div className="relative" data-header-project-selector>
            {showProjectSelector ? (
              <>
                <button
                  onClick={() => setShowProjectSelector(false)}
                  className="flex items-center gap-2 px-2 py-1 rounded-lg bg-muted/50 transition-colors relative overflow-visible"
                >
                  <span className="font-semibold text-sm truncate max-w-[160px]">
                    {displayName}
                  </span>
                  <Check className="h-3 w-3 text-indigo-400" />
                </button>

                {/* Dropdown */}
                <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg max-h-64 w-56 overflow-y-auto">
                  {validProjects.length === 0 ? (
                    <div className="p-3 text-center text-xs text-muted-foreground">
                      <Loader2 className="h-4 w-4 mx-auto mb-1 animate-spin" />
                      Loading...
                    </div>
                  ) : (
                    validProjects.map((project) => {
                      // Get display name - prefer config.name, but check if it's a UUID
                      const rawName = project.config?.name || '';
                      const isUuidName = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(rawName);
                      const extractedProjectName = isUuidName ? extractNameFromRequirements(project.requirements) : null;
                      const displayProjectName = extractedProjectName || (rawName && !isUuidName ? rawName : 'Unnamed Project');

                      return (
                        <button
                          key={project.projectId}
                          onClick={() => handleProjectSelect(project.projectId)}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors text-sm",
                            project.projectId === projectId && "bg-indigo-500/10"
                          )}
                        >
                          <span className="font-medium truncate flex-1">
                            {displayProjectName}
                          </span>
                          {project.projectId === projectId && (
                            <Check className="h-3 w-3 text-indigo-400 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <button
                onClick={onShowProjectContext}
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <span className="font-semibold text-sm truncate max-w-[160px]">
                  {displayName}
                </span>
              </button>
            )}
          </div>

          {/* Deployment Link */}
          {deploymentUrl && (
            <a
              href={deploymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors text-xs font-medium"
            >
              <Globe className="h-3 w-3" />
              <span className="hidden sm:inline">Live</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>

        {/* Center: Tab Navigation */}
        <nav className="flex-1 flex justify-center">
          <div className="flex items-center gap-2">
            {/* Primary tabs - main workflow */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/40 border border-border/30">
              {PRIMARY_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = mainTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => onMainTabChange(tab.id as MainTab)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                    )}
                  >
                    <Icon className={cn("h-3.5 w-3.5", tab.color)} />
                    <span className="hidden lg:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Separator */}
            <div className="h-6 w-px bg-border/50" />

            {/* Secondary tabs - supporting views */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/30 border border-border/20">
              {SECONDARY_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = mainTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => onMainTabChange(tab.id as MainTab)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                    )}
                  >
                    <Icon className={cn("h-3.5 w-3.5", tab.color)} />
                    <span className="hidden xl:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Right: Agent Status + Actions */}
        <div className="flex items-center gap-3 min-w-[280px] justify-end">
          {/* Status Badges */}
          <div className="flex items-center gap-1.5">
            {isResearching && (
              <Badge variant="outline" className="border-cyan-500/50 text-cyan-400 text-[10px] h-6 animate-pulse">
                <Target className="h-3 w-3 mr-1 animate-spin" />
                Research
              </Badge>
            )}
            {isFixing && (
              <Badge variant="outline" className="border-amber-500/50 text-amber-400 text-[10px] h-6 animate-pulse">
                <Wrench className="h-3 w-3 mr-1 animate-spin" />
                Fixing
              </Badge>
            )}
            {isIterating && (
              <Badge variant="outline" className="border-blue-500/50 text-blue-400 text-[10px] h-6 animate-pulse">
                <Edit3 className="h-3 w-3 mr-1 animate-spin" />
                Iterating
              </Badge>
            )}
          </div>

          {/* Agent Status Indicators */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/30 border border-border/30">
            {(['product_owner', 'coder', 'tester', 'security'] as const).map(role => {
              const status = agentStatuses.get(role);
              const Icon = AGENT_ICONS[role];
              const colorClass = AGENT_COLORS[role];
              const isWorking = status === 'working';

              // Get parallel agent counts
              const parallelCount = role === 'coder'
                ? Array.from(agentStatuses.entries()).filter(([key]) => key.startsWith('coder-') && agentStatuses.get(key) === 'working').length
                : role === 'tester'
                ? Array.from(agentStatuses.entries()).filter(([key]) => key.startsWith('tester-') && agentStatuses.get(key) === 'working').length
                : 0;

              return (
                <Tooltip key={role}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "flex items-center gap-1 px-1.5 py-0.5 rounded transition-all duration-200",
                        isWorking ? "bg-primary/10" : "opacity-40 hover:opacity-70"
                      )}
                    >
                      <Icon className={cn("h-3.5 w-3.5", colorClass, isWorking && "animate-pulse")} />
                      {parallelCount > 0 && (
                        <span className="text-[10px] font-mono font-bold text-primary">{parallelCount}</span>
                      )}
                      {isWorking && <Loader2 className="h-2.5 w-2.5 animate-spin text-primary" />}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <span className="capitalize font-medium">{role.replace('_', ' ')}</span>
                    <span className="text-muted-foreground ml-1">
                      {status || 'idle'}
                      {parallelCount > 0 && ` (${parallelCount} active)`}
                    </span>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* Connection Status */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs",
                wsConnected ? "text-green-500" : "text-red-500"
              )}>
                {wsConnected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {wsConnected ? 'Connected' : 'Disconnected'}
            </TooltipContent>
          </Tooltip>

          {/* Settings & Home */}
          <div className="flex items-center gap-2">
            {/* Settings */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onMainTabChange('settings')}
              className="h-8 w-8"
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
            </Button>

            {/* Home */}
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="h-8 w-8"
            >
              <Link href="/">
                <Home className="h-4 w-4 text-muted-foreground" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </header>

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <Card className="w-full max-w-md mx-4 bg-background">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-green-500" />
                  New Project
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowNewProjectModal(false);
                    setNewProjectName('');
                    setNewProjectMode('blank');
                    setGithubUrl('');
                    setGithubBranch('');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Mode Selection */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setNewProjectMode('blank')}
                  className={cn(
                    "p-4 rounded-lg border-2 text-left transition-all",
                    newProjectMode === 'blank'
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-border hover:border-green-500/50'
                  )}
                >
                  <Folder className={cn("h-6 w-6 mb-2", newProjectMode === 'blank' ? 'text-green-500' : 'text-muted-foreground')} />
                  <div className="font-medium">Blank Project</div>
                  <div className="text-xs text-muted-foreground">Start from scratch</div>
                </button>
                <button
                  onClick={() => setNewProjectMode('github')}
                  className={cn(
                    "p-4 rounded-lg border-2 text-left transition-all",
                    newProjectMode === 'github'
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-border hover:border-green-500/50'
                  )}
                >
                  <GitBranch className={cn("h-6 w-6 mb-2", newProjectMode === 'github' ? 'text-green-500' : 'text-muted-foreground')} />
                  <div className="font-medium">GitHub Import</div>
                  <div className="text-xs text-muted-foreground">Clone from repository</div>
                </button>
              </div>

              {/* Project Name */}
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Project Name *
                </label>
                <input
                  type="text"
                  placeholder="My Awesome Project"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full px-3 py-2 bg-background border rounded-md text-sm"
                  autoFocus
                />
              </div>

              {/* GitHub fields */}
              {newProjectMode === 'github' && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Repository URL *
                    </label>
                    <input
                      type="text"
                      placeholder="https://github.com/username/repo.git"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      className="w-full px-3 py-2 bg-background border rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Branch (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="main"
                      value={githubBranch}
                      onChange={(e) => setGithubBranch(e.target.value)}
                      className="w-full px-3 py-2 bg-background border rounded-md text-sm"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowNewProjectModal(false);
                    setNewProjectName('');
                    setNewProjectMode('blank');
                    setGithubUrl('');
                    setGithubBranch('');
                  }}
                  className="flex-1"
                  disabled={isCreatingProject}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateNewProject}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={
                    !newProjectName.trim() ||
                    (newProjectMode === 'github' && !githubUrl) ||
                    isCreatingProject
                  }
                >
                  {isCreatingProject ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Project
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

export default BuildPageHeader;
