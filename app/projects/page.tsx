'use client';

import { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Play,
  Pause,
  Square,
  Trash2,
  Eye,
  Home,
  RefreshCw,
  Code,
  TestTube,
  Shield,
  Cloud,
  Bot,
  MessageSquare,
  LayoutGrid,
  List,
  Search,
  ShieldCheck,
  Lock,
  Briefcase,
  GitBranch,
  GitPullRequest,
  Clock,
  Folder,
  FolderOpen,
  Plus,
  FileText,
  Rocket,
  Settings,
  AlertCircle,
  CheckCircle,
  X,
  Layers,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMultiProjectStore, ProjectSummary } from '@/stores/multi-project-store';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { AgentType } from '@/lib/agents/types';

const AGENT_ICONS: Record<AgentType, React.ReactNode> = {
  supervisor: <Bot className="h-3 w-3" />,
  research: <Search className="h-3 w-3" />,
  product_owner: <MessageSquare className="h-3 w-3" />,
  coder: <Code className="h-3 w-3" />,
  tester: <TestTube className="h-3 w-3" />,
  security: <Shield className="h-3 w-3" />,
  infrastructure: <Cloud className="h-3 w-3" />,
  architecture: <FileText className="h-3 w-3" />,
};

const AGENT_NAMES: Record<AgentType, string> = {
  supervisor: 'Supervisor',
  research: 'Research',
  product_owner: 'Product Owner',
  coder: 'Coder',
  tester: 'Tester',
  security: 'Security',
  infrastructure: 'Infrastructure',
  architecture: 'Architecture',
};

// Status helper functions (module level for use in both ProjectsPage and ProjectCard)
const getStatusColor = (status: string) => {
  switch (status) {
    case 'idle': return 'bg-gray-600 text-white';
    case 'planning': return 'bg-blue-600 text-white';
    case 'developing': return 'bg-purple-600 text-white';
    case 'building': return 'bg-purple-600 text-white';
    case 'testing': return 'bg-yellow-600 text-white';
    case 'deploying': return 'bg-orange-600 text-white';
    case 'completed': return 'bg-green-600 text-white';
    case 'error': return 'bg-red-600 text-white';
    case 'failed': return 'bg-red-600 text-white';
    case 'paused': return 'bg-gray-500 text-white';
    default: return 'bg-gray-600 text-white';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'idle': return 'Ready';
    case 'planning': return 'Planning';
    case 'developing': return 'Coding';
    case 'building': return 'Building';
    case 'testing': return 'Testing';
    case 'deploying': return 'Deploying';
    case 'completed': return 'Done';
    case 'error': return 'Error';
    case 'failed': return 'Failed';
    case 'paused': return 'Paused';
    default: return status;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'idle': return <Clock className="h-3 w-3" />;
    case 'planning': return <MessageSquare className="h-3 w-3" />;
    case 'developing': return <Code className="h-3 w-3" />;
    case 'building': return <Code className="h-3 w-3" />;
    case 'testing': return <TestTube className="h-3 w-3" />;
    case 'deploying': return <Cloud className="h-3 w-3" />;
    case 'completed': return <CheckCircle className="h-3 w-3" />;
    case 'error': return <AlertCircle className="h-3 w-3" />;
    case 'failed': return <AlertCircle className="h-3 w-3" />;
    case 'paused': return <Pause className="h-3 w-3" />;
    default: return null;
  }
};

export default function ProjectsPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [buildTypeFilter, setBuildTypeFilter] = useState<'all' | 'quick' | 'complex'>('all');
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneUrl, setCloneUrl] = useState('');
  const [cloneBranch, setCloneBranch] = useState('');
  const [cloneProjectName, setCloneProjectName] = useState('');
  const [isCloning, setIsCloning] = useState(false);

  // New Project modal state
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectMode, setNewProjectMode] = useState<'blank' | 'github'>('blank');
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  // Coding directory configuration state
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [codingDirectory, setCodingDirectory] = useState<string | null>(null);
  const [defaultDirectory, setDefaultDirectory] = useState<string>('');
  const [directoryExists, setDirectoryExists] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);
  const [newDirectoryPath, setNewDirectoryPath] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  const {
    projects,
    isLoadingProjects,
    refreshAllProjects,
    updateProject,
    updateProjectAgent,
    removeProject,
  } = useMultiProjectStore();

  // Connect to WebSocket for real-time updates across all projects
  const { connected, on, off } = useWebSocket({ autoConnect: true });

  // Load coding directory configuration
  const loadCodingDirectoryConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/config/coding-directory');
      const data = await response.json();
      setCodingDirectory(data.codingDirectory);
      setDefaultDirectory(data.defaultDirectory);
      setDirectoryExists(data.directoryExists);
      setIsConfigured(data.isConfigured);
      setNewDirectoryPath(data.activeDirectory);
    } catch (error) {
      console.error('Failed to load coding directory config:', error);
    }
  }, []);

  // Save coding directory configuration
  const saveCodingDirectoryConfig = async () => {
    if (!newDirectoryPath) return;

    setIsSavingConfig(true);
    setConfigError(null);

    try {
      const response = await fetch('/api/config/coding-directory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codingDirectory: newDirectoryPath }),
      });

      const data = await response.json();

      if (response.ok) {
        setCodingDirectory(data.codingDirectory);
        setIsConfigured(true);
        setDirectoryExists(true);
        setShowConfigModal(false);
        // Refresh projects to scan the new directory
        refreshAllProjects();
      } else {
        setConfigError(data.error || 'Failed to save configuration');
      }
    } catch (error) {
      setConfigError('Failed to save configuration');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Fetch projects and config on mount
  useEffect(() => {
    loadCodingDirectoryConfig();
    refreshAllProjects();
    // Poll every 30 seconds instead of 3 seconds to reduce load
    // Real-time updates come via WebSocket, polling is just a fallback
    const interval = setInterval(refreshAllProjects, 30000);
    return () => clearInterval(interval);
  }, [refreshAllProjects, loadCodingDirectoryConfig]);

  // Listen to WebSocket events for all projects
  useEffect(() => {
    if (!connected) return;

    const handleAgentStatus = (data: any) => {
      if (data.projectId) {
        updateProjectAgent(data.projectId, data.type, data.status, data.currentTask);

        // Update project status based on agent
        const statusMap: Record<AgentType, string> = {
          research: 'planning',
          supervisor: 'planning',
          product_owner: 'planning',
          coder: 'developing',
          tester: 'testing',
          security: 'testing',
          infrastructure: 'deploying',
          architecture: 'documenting',
        };

        if (data.status === 'working' || data.status === 'thinking') {
          updateProject(data.projectId, {
            status: statusMap[data.type as AgentType] as any || 'developing'
          });
        }
      }
    };

    const handleWorkflowCompleted = (data: any) => {
      if (data.projectId) {
        updateProject(data.projectId, { status: 'completed', progress: 100 });
      }
    };

    const handleWorkflowError = (data: any) => {
      if (data.projectId) {
        updateProject(data.projectId, { status: 'error' });
      }
    };

    on('agent:status', handleAgentStatus);
    on('workflow:completed', handleWorkflowCompleted);
    on('workflow:error', handleWorkflowError);

    return () => {
      off('agent:status', handleAgentStatus);
      off('workflow:completed', handleWorkflowCompleted);
      off('workflow:error', handleWorkflowError);
    };
  }, [connected, on, off, updateProject, updateProjectAgent]);

  const handlePause = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/workflow/${projectId}/pause`, { method: 'POST' });
      if (response.ok) {
        updateProject(projectId, { status: 'paused' });
      }
    } catch (error) {
      console.error('Failed to pause project:', error);
    }
  };

  const handleResume = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/workflow/${projectId}/resume`, { method: 'POST' });
      if (response.ok) {
        updateProject(projectId, { status: 'developing' });
      }
    } catch (error) {
      console.error('Failed to resume project:', error);
    }
  };

  const handleStop = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to stop this workflow?')) return;

    try {
      const response = await fetch(`/api/workflow/${projectId}/stop`, { method: 'POST' });
      const data = await response.json();

      if (response.ok) {
        // Update local state immediately
        updateProject(projectId, { status: 'idle', activeAgent: undefined });
        console.log(`[Stop] Success:`, data);
      } else {
        console.error(`[Stop] Failed:`, data);
        alert(`Failed to stop project: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to stop project:', error);
      alert(`Failed to stop project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDelete = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project? This will remove all files from disk. This cannot be undone.')) return;

    try {
      console.log(`[Delete] Deleting project: ${projectId}`);
      const response = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      const data = await response.json();

      if (response.ok) {
        console.log(`[Delete] Success:`, data);
        // Remove from local state immediately
        removeProject(projectId);
        // Small delay then force refresh to get server state
        setTimeout(() => {
          refreshAllProjects();
        }, 500);
      } else {
        console.error(`[Delete] Failed:`, data);
        alert(`Failed to delete project: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert(`Failed to delete project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCreateNewProject = async () => {
    if (!newProjectName.trim()) return;

    setIsCreatingProject(true);
    try {
      // Generate a project ID based on the name
      const projectId = `${newProjectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;

      // Create project via API
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          name: newProjectName.trim(),
          requirements: '',
          buildType: 'complex',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setShowNewProjectModal(false);
        setNewProjectName('');
        setNewProjectMode('blank');
        refreshAllProjects();
        // Navigate to the new project
        router.push(`/build/${data.projectId || projectId}`);
      } else {
        const error = await response.json();
        alert(`Failed to create project: ${error.error || error.message}`);
      }
    } catch (error: unknown) {
      console.error('Failed to create project:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to create project: ${message}`);
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleCloneRepo = async () => {
    if (!cloneUrl) return;

    setIsCloning(true);
    try {
      const response = await fetch('/api/git/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl: cloneUrl,
          branch: cloneBranch || undefined,
          projectName: cloneProjectName || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setShowCloneModal(false);
        setCloneUrl('');
        setCloneBranch('');
        setCloneProjectName('');
        refreshAllProjects();
        // Navigate to the new project
        router.push(`/build/${data.projectId}`);
      } else {
        const error = await response.json();
        const errorMessage = error.details
          ? `${error.error || error.message}\n\nDetails: ${error.details}`
          : (error.error || error.message);
        alert(`Failed to clone:\n${errorMessage}`);
      }
    } catch (error: unknown) {
      console.error('Failed to clone repository:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to clone: ${message}`);
    } finally {
      setIsCloning(false);
    }
  };

  const handlePullProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch('/api/git/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      if (response.ok) {
        refreshAllProjects();
      } else {
        const error = await response.json();
        alert(`Failed to pull: ${error.message || error.error}`);
      }
    } catch (error: any) {
      console.error('Failed to pull:', error);
    }
  };

  const isActive = useCallback((status: string) =>
    ['planning', 'developing', 'building', 'testing', 'deploying'].includes(status), []);

  const isStopped = useCallback((status: string) =>
    ['idle', 'error', 'completed'].includes(status), []);

  // Memoize projects array to avoid repeated Array.from conversions
  const projectsArray = useMemo(() => Array.from(projects.values()), [projects]);

  // Filter projects (memoized to avoid recomputing on every render)
  const filteredProjects = useMemo(() => {
    return projectsArray.filter((project) => {
      const matchesSearch = searchQuery === '' ||
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.requirements.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' && isActive(project.status)) ||
        (statusFilter === 'completed' && project.status === 'completed') ||
        (statusFilter === 'idle' && (project.status === 'idle' || project.status === 'paused'));

      const matchesBuildType = buildTypeFilter === 'all' ||
        project.buildType === buildTypeFilter ||
        // Fallback for projects without buildType - treat as quick builds
        (buildTypeFilter === 'quick' && !project.buildType);

      return matchesSearch && matchesStatus && matchesBuildType;
    }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [projectsArray, searchQuery, statusFilter, buildTypeFilter, isActive]);

  // Count by build type (memoized)
  const quickBuildCount = useMemo(() => projectsArray.filter(p => p.buildType === 'quick' || !p.buildType).length, [projectsArray]);
  const complexBuildCount = useMemo(() => projectsArray.filter(p => p.buildType === 'complex').length, [projectsArray]);

  // Count active projects (memoized)
  const activeCount = useMemo(() => projectsArray.filter(p => isActive(p.status)).length, [projectsArray, isActive]);
  const completedCount = useMemo(() => projectsArray.filter(p => p.status === 'completed').length, [projectsArray]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Ochsner AI Branding */}
              <div className="flex items-center gap-3 pr-4 border-r border-border/50">
                <img src="/smartcycle-logo.svg" alt="Ochsner AI" className="h-10 w-10" />
                <div className="flex flex-col">
                  <span className="text-base font-bold text-slate-700 dark:text-slate-200 leading-tight">Employers</span>
                  <span className="text-base font-bold text-slate-700 dark:text-slate-200 leading-tight">AI</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-8 w-8 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold">Ochsner AI Studio Projects</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {projects.size} total &bull; {activeCount} active &bull; {completedCount} completed
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-xs text-muted-foreground">
                  {connected ? 'Live' : 'Offline'}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => refreshAllProjects()}
                disabled={isLoadingProjects}
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingProjects ? 'animate-spin' : ''}`} />
              </Button>
              <Link href="/">
                <Button variant="outline" size="icon" className="h-8 w-8" title="Home">
                  <Home className="h-4 w-4" />
                </Button>
              </Link>
              <Button onClick={() => router.push('/quick-build')} className="bg-green-600 hover:bg-green-700">
                <Rocket className="h-4 w-4 mr-2" />
                Quick Build
              </Button>
              <Button onClick={() => setShowNewProjectModal(true)} className="bg-green-600 hover:bg-green-700">
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </div>
          </div>

          {/* Build Type Tabs */}
          <div className="flex items-center gap-1 mt-4 border-b">
            <button
              onClick={() => setBuildTypeFilter('all')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                buildTypeFilter === 'all'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              All Projects ({projectsArray.length})
            </button>
            <button
              onClick={() => setBuildTypeFilter('quick')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                buildTypeFilter === 'quick'
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Rocket className="h-4 w-4" />
              Quick Builds ({quickBuildCount})
            </button>
            <button
              onClick={() => setBuildTypeFilter('complex')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                buildTypeFilter === 'complex'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="h-4 w-4" />
              Complex Builds ({complexBuildCount})
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 mt-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background border rounded-md text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-background border rounded-md text-sm"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="idle">Idle/Paused</option>
              </select>
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-r-none"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        {/* Coding Directory Configuration Banner */}
        {(!isConfigured || !directoryExists) && (
          <Card className={`mb-4 border-2 ${!directoryExists ? 'border-amber-500 bg-amber-50 dark:bg-amber-950' : 'border-blue-500 bg-blue-50 dark:bg-blue-950'}`}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {!directoryExists ? (
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                  ) : (
                    <FolderOpen className="h-5 w-5 text-blue-600" />
                  )}
                  <div>
                    <h3 className="font-medium">
                      {!directoryExists
                        ? 'Coding Directory Not Found'
                        : 'Configure Your Coding Directory'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {!directoryExists
                        ? `The configured directory doesn't exist on this machine. Please update it.`
                        : `Set the path to your coding projects folder to discover and manage your projects.`}
                    </p>
                    {(codingDirectory || defaultDirectory) && (
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        Current: {codingDirectory || defaultDirectory}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  onClick={() => setShowConfigModal(true)}
                  variant={!directoryExists ? 'default' : 'outline'}
                  className={!directoryExists ? 'bg-amber-600 hover:bg-amber-700' : ''}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Configure
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Configured Directory Info (when properly configured) */}
        {isConfigured && directoryExists && (
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Folder className="h-4 w-4" />
              <span className="font-mono">{codingDirectory}</span>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowConfigModal(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        )}

        {isLoadingProjects && projects.size === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading projects...
          </div>
        ) : filteredProjects.length === 0 ? (
          <Card className="border-2 border-blue-200 dark:border-blue-900">
            <CardContent className="py-12 text-center">
              {searchQuery || statusFilter !== 'all' ? (
                <p className="text-muted-foreground">No projects match your filters. Try adjusting your search.</p>
              ) : (
                <>
                  <Briefcase className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Build Your First App</h3>
                  <p className="text-muted-foreground mb-4">
                    Ochsner AI Studio agents will build secure, compliant applications automatically.
                  </p>
                  <Button onClick={() => router.push('/')} className="bg-blue-600 hover:bg-blue-700">
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Create New App
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.projectId}
                project={project}
                onView={() => router.push(`/build/${project.projectId}`)}
                onUAT={(e) => { e.stopPropagation(); router.push(`/uat/${project.projectId}`); }}
                onPause={(e) => handlePause(project.projectId, e)}
                onResume={(e) => handleResume(project.projectId, e)}
                onStop={(e) => handleStop(project.projectId, e)}
                onDelete={(e) => handleDelete(project.projectId, e)}
                onPull={(e) => handlePullProject(project.projectId, e)}
                isActive={isActive}
                isStopped={isStopped}
                getStatusColor={getStatusColor}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredProjects.map((project) => (
              <ProjectListItem
                key={project.projectId}
                project={project}
                onView={() => router.push(`/build/${project.projectId}`)}
                onUAT={(e) => { e.stopPropagation(); router.push(`/uat/${project.projectId}`); }}
                onPause={(e) => handlePause(project.projectId, e)}
                onResume={(e) => handleResume(project.projectId, e)}
                onStop={(e) => handleStop(project.projectId, e)}
                onDelete={(e) => handleDelete(project.projectId, e)}
                onPull={(e) => handlePullProject(project.projectId, e)}
                isActive={isActive}
                isStopped={isStopped}
                getStatusColor={getStatusColor}
              />
            ))}
          </div>
        )}

      </main>

      {/* Clone Repository Modal */}
      {showCloneModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Clone Git Repository
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Repository URL *
                </label>
                <input
                  type="text"
                  placeholder="https://github.com/username/repo.git"
                  value={cloneUrl}
                  onChange={(e) => setCloneUrl(e.target.value)}
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
                  value={cloneBranch}
                  onChange={(e) => setCloneBranch(e.target.value)}
                  className="w-full px-3 py-2 bg-background border rounded-md text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Project Name (optional)
                </label>
                <input
                  type="text"
                  placeholder="Auto-detect from URL"
                  value={cloneProjectName}
                  onChange={(e) => setCloneProjectName(e.target.value)}
                  className="w-full px-3 py-2 bg-background border rounded-md text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowCloneModal(false)}
                  className="flex-1"
                  disabled={isCloning}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCloneRepo}
                  className="flex-1"
                  disabled={!cloneUrl || isCloning}
                >
                  {isCloning ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Cloning...
                    </>
                  ) : (
                    <>
                      <GitPullRequest className="h-4 w-4 mr-2" />
                      Clone
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-green-600" />
                  New Project
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowNewProjectModal(false);
                    setNewProjectName('');
                    setNewProjectMode('blank');
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
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    newProjectMode === 'blank'
                      ? 'border-green-500 bg-green-50 dark:bg-green-950'
                      : 'border-border hover:border-green-300'
                  }`}
                >
                  <Folder className={`h-6 w-6 mb-2 ${newProjectMode === 'blank' ? 'text-green-600' : 'text-muted-foreground'}`} />
                  <div className="font-medium">Blank Project</div>
                  <div className="text-xs text-muted-foreground">Start from scratch</div>
                </button>
                <button
                  onClick={() => setNewProjectMode('github')}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    newProjectMode === 'github'
                      ? 'border-green-500 bg-green-50 dark:bg-green-950'
                      : 'border-border hover:border-green-300'
                  }`}
                >
                  <GitBranch className={`h-6 w-6 mb-2 ${newProjectMode === 'github' ? 'text-green-600' : 'text-muted-foreground'}`} />
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

              {/* GitHub fields (shown when github mode is selected) */}
              {newProjectMode === 'github' && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Repository URL *
                    </label>
                    <input
                      type="text"
                      placeholder="https://github.com/username/repo.git"
                      value={cloneUrl}
                      onChange={(e) => setCloneUrl(e.target.value)}
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
                      value={cloneBranch}
                      onChange={(e) => setCloneBranch(e.target.value)}
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
                    setCloneUrl('');
                    setCloneBranch('');
                  }}
                  className="flex-1"
                  disabled={isCreatingProject || isCloning}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (newProjectMode === 'github') {
                      // Use existing clone handler but with the project name
                      setCloneProjectName(newProjectName);
                      setShowNewProjectModal(false);
                      handleCloneRepo();
                    } else {
                      handleCreateNewProject();
                    }
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={
                    !newProjectName.trim() ||
                    (newProjectMode === 'github' && !cloneUrl) ||
                    isCreatingProject ||
                    isCloning
                  }
                >
                  {isCreatingProject || isCloning ? (
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

      {/* Coding Directory Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg mx-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  Configure Coding Directory
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowConfigModal(false);
                    setConfigError(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Set the path to the directory containing your coding projects.
                The platform will scan this directory to discover and display your projects.
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">
                  Directory Path
                </label>
                <input
                  type="text"
                  placeholder={defaultDirectory || '~/coding/projects'}
                  value={newDirectoryPath}
                  onChange={(e) => {
                    setNewDirectoryPath(e.target.value);
                    setConfigError(null);
                  }}
                  className="w-full px-3 py-2 bg-background border rounded-md text-sm font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use an absolute path or ~ for your home directory
                </p>
              </div>

              {configError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950 p-3 rounded-md">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {configError}
                </div>
              )}

              <div className="bg-muted/50 p-3 rounded-md text-sm">
                <p className="font-medium mb-1">What happens when you save:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>The platform will scan this directory for projects</li>
                  <li>Previous project list will be cleared</li>
                  <li>Projects in subdirectories will be discovered</li>
                </ul>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowConfigModal(false);
                    setConfigError(null);
                    setNewDirectoryPath(codingDirectory || defaultDirectory);
                  }}
                  className="flex-1"
                  disabled={isSavingConfig}
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveCodingDirectoryConfig}
                  className="flex-1"
                  disabled={!newDirectoryPath || isSavingConfig}
                >
                  {isSavingConfig ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Save & Scan
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

interface ProjectCardProps {
  project: ProjectSummary;
  onView: () => void;
  onUAT: (e: React.MouseEvent) => void;
  onPause: (e: React.MouseEvent) => void;
  onResume: (e: React.MouseEvent) => void;
  onStop: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onPull: (e: React.MouseEvent) => void;
  isActive: (status: string) => boolean;
  isStopped: (status: string) => boolean;
  getStatusColor: (status: string) => string;
}

const ProjectCard = memo(function ProjectCard({
  project,
  onView,
  onUAT,
  onPause,
  onResume,
  onStop,
  onDelete,
  onPull,
  isActive,
  isStopped,
  getStatusColor,
}: ProjectCardProps) {
  return (
    <Card
      className={`cursor-pointer hover:shadow-lg transition-all group h-full flex flex-col ${
        isActive(project.status) ? 'border-primary/50 shadow-md' : ''
      }`}
      onClick={onView}
    >
      <CardHeader className="pb-2 space-y-2">
        {/* Title row */}
        <div className="space-y-1">
          <CardTitle className="text-base leading-tight break-words">{project.name}</CardTitle>
          <p className="text-xs text-muted-foreground/60 font-mono">
            {project.projectId.substring(0, 8)}...
          </p>
        </div>
        {/* Badges row - wrap on smaller cards */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Build type badge */}
          <Badge variant="outline" className={`text-xs shrink-0 ${
            project.buildType === 'complex'
              ? 'border-purple-500 text-purple-500'
              : 'border-green-500 text-green-500'
          }`}>
            {project.buildType === 'complex' ? 'Complex' : 'Quick'}
          </Badge>
          {/* Status badge */}
          <Badge className={`${getStatusColor(project.status)} flex items-center gap-1 shrink-0`}>
            {getStatusIcon(project.status)}
            {getStatusLabel(project.status)}
          </Badge>
          {/* Session Status */}
          {project.session && (
            <Badge
              variant="outline"
              className={`text-xs shrink-0 ${
                project.session.status === 'active'
                  ? 'border-green-500 text-green-600'
                  : project.session.status === 'paused'
                  ? 'border-yellow-500 text-yellow-600'
                  : 'border-gray-400 text-gray-500'
              }`}
            >
              <Clock className="h-3 w-3 mr-1" />
              {project.session.status}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {project.requirements || 'No requirements set'}
        </p>

        {/* Git Info */}
        {project.git?.isGitRepo && (
          <div className="flex items-center gap-2 mb-3 p-2 bg-muted/30 rounded-md text-xs">
            <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">{project.git.currentBranch}</span>
            {project.git.hasUncommittedChanges && (
              <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">
                Modified
              </Badge>
            )}
            {(project.git.ahead ?? 0) > 0 && (
              <span className="text-green-600">+{project.git.ahead}</span>
            )}
            {(project.git.behind ?? 0) > 0 && (
              <span className="text-red-600">-{project.git.behind}</span>
            )}
          </div>
        )}

        {/* Active Agent */}
        {project.activeAgent && (
          <div className="flex items-center gap-2 mb-3 p-2 bg-muted/50 rounded-md">
            {AGENT_ICONS[project.activeAgent.type]}
            <span className="text-xs font-medium">
              {AGENT_NAMES[project.activeAgent.type]}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {project.activeAgent.task}
            </span>
          </div>
        )}

        {/* Progress Bar */}
        {isActive(project.status) && (
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{project.progress}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all"
                style={{ width: `${project.progress}%` }}
              />
            </div>
          </div>
        )}


        {/* Footer - pushed to bottom */}
        <div className="flex items-center justify-between pt-2 border-t mt-auto">
          <span className="text-xs text-muted-foreground">
            {new Date(project.updatedAt).toLocaleDateString()}
          </span>
          <div
            className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onView} title="View project">
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-orange-600 hover:text-orange-700 hover:bg-orange-50" onClick={onUAT} title="UAT Testing">
              <TestTube className="h-3.5 w-3.5" />
            </Button>
            {/* Git Pull button */}
            {project.git?.isGitRepo && (
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onPull} title="Pull latest">
                <GitPullRequest className="h-3.5 w-3.5" />
              </Button>
            )}
            {isActive(project.status) && (
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onPause}>
                <Pause className="h-3.5 w-3.5" />
              </Button>
            )}
            {project.status === 'paused' && (
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onResume}>
                <Play className="h-3.5 w-3.5" />
              </Button>
            )}
            {(isActive(project.status) || project.status === 'paused') && (
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onStop}>
                <Square className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

const ProjectListItem = memo(function ProjectListItem({
  project,
  onView,
  onUAT,
  onPause,
  onResume,
  onStop,
  onDelete,
  onPull,
  isActive,
  isStopped,
  getStatusColor,
}: ProjectCardProps) {
  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-all ${
        isActive(project.status) ? 'border-primary/50' : ''
      }`}
      onClick={onView}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Status indicator */}
          <div className={`w-2 h-12 rounded-full ${getStatusColor(project.status).split(' ')[0]}`} />

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <h3 className="font-medium break-words">{project.name}</h3>
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Build type badge */}
                <Badge variant="outline" className={`text-xs shrink-0 ${
                  project.buildType === 'complex'
                    ? 'border-purple-500 text-purple-500'
                    : 'border-green-500 text-green-500'
                }`}>
                  {project.buildType === 'complex' ? 'Complex' : 'Quick'}
                </Badge>
                <Badge className={`${getStatusColor(project.status)} text-xs flex items-center gap-1 shrink-0`}>
                  {getStatusIcon(project.status)}
                  {getStatusLabel(project.status)}
                </Badge>
                {/* Session indicator */}
                {project.session && (
                  <Badge
                    variant="outline"
                    className={`text-xs shrink-0 ${
                      project.session.status === 'active'
                        ? 'border-green-500 text-green-600'
                        : project.session.status === 'paused'
                        ? 'border-yellow-500 text-yellow-600'
                        : 'border-gray-400 text-gray-500'
                    }`}
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    {project.session.status}
                  </Badge>
                )}
                {project.activeAgent && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    {AGENT_ICONS[project.activeAgent.type]}
                    <span>{AGENT_NAMES[project.activeAgent.type]}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm text-muted-foreground truncate">
                {project.requirements}
              </p>
              {/* Git branch indicator */}
              {project.git?.isGitRepo && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <GitBranch className="h-3 w-3" />
                  <span>{project.git.currentBranch}</span>
                  {project.git.hasUncommittedChanges && (
                    <span className="text-yellow-600">*</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Progress */}
          {isActive(project.status) && (
            <div className="w-32">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Progress</span>
                <span>{project.progress}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Timestamp */}
          <div className="text-xs text-muted-foreground whitespace-nowrap">
            {new Date(project.updatedAt).toLocaleString()}
          </div>

          {/* Actions */}
          <div
            className="flex gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onView} title="View project">
              <Eye className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50" onClick={onUAT} title="UAT Testing">
              <TestTube className="h-4 w-4" />
            </Button>
            {/* Git Pull button */}
            {project.git?.isGitRepo && (
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onPull} title="Pull latest">
                <GitPullRequest className="h-4 w-4" />
              </Button>
            )}
            {isActive(project.status) && (
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onPause}>
                <Pause className="h-4 w-4" />
              </Button>
            )}
            {project.status === 'paused' && (
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onResume}>
                <Play className="h-4 w-4" />
              </Button>
            )}
            {isStopped(project.status) && project.status !== 'idle' && (
              <Button size="icon" variant="default" className="h-8 w-8" onClick={onResume}>
                <Play className="h-4 w-4" />
              </Button>
            )}
            {(isActive(project.status) || project.status === 'paused') && (
              <Button size="icon" variant="destructive" className="h-8 w-8" onClick={onStop}>
                <Square className="h-4 w-4" />
              </Button>
            )}
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
