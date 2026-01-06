'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Loader2, FolderOpen, Shield, Briefcase, Lock, Sparkles } from 'lucide-react';
import { useProjectStore } from '@/stores/project-store';
import { useWebSocket } from '@/hooks/useWebSocket';

export function RequirementsPanel() {
  const router = useRouter();
  const { project, setRequirements, createProject, loadProject } = useProjectStore();
  const { socket } = useWebSocket();
  const [input, setInput] = useState(project?.requirements || '');
  const [projectName, setProjectName] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  // Check if this is an existing project (should be read-only)
  const isExistingProject = !!project?.projectId;

  // Update input when project changes
  useEffect(() => {
    if (project?.requirements) {
      setInput(project.requirements);
    }
    if (project?.config?.name) {
      setProjectName(project.config.name);
    }
  }, [project?.projectId, project?.requirements, project?.config?.name]);

  const handleAnalyze = async () => {
    if (!input.trim()) return;
    if (!projectName.trim()) {
      alert('Please enter a project name');
      return;
    }

    setAnalyzing(true);

    // Immediately add a status message so user knows something is happening
    const tempMessage = {
      id: `msg-init-${Date.now()}`,
      agentId: 'system',
      agentType: 'supervisor',
      content: '⏳ Initializing secure environment and connecting to Ochsner AI Studio agents...',
      timestamp: new Date(),
    };

    // Add to local store immediately for instant feedback
    if (project) {
      try {
        // We need to manually update the store since we're not getting this from WebSocket yet
        const event = new CustomEvent('agent-message-local', { detail: tempMessage });
        window.dispatchEvent(event);
      } catch (e) {
        console.log('Could not emit local message:', e);
      }
    }

    try {
      // Always use fast workflow with Ochsner AI Studio
      console.log('🚀 Starting fast workflow with Ochsner AI Studio');

      const response = await fetch('/api/workflow/start-fast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requirements: input,
          projectName: projectName.trim(),
          options: {
            skipDeploy: true, // Skip deployment for faster iteration
            maxParallelTasks: 3, // Allow parallel task execution
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start workflow');
      }

      const data = await response.json();
      console.log('Workflow started:', data);

      // Create or load the project
      if (data.projectId) {
        if (!project || project.projectId !== data.projectId) {
          // Create project with the projectId and project name from the backend
          createProject({
            name: data.projectName || projectName.trim(),
            description: input,
            techStack: [],
            requirements: input,
            targetPlatform: 'web',
            deployment: {
              provider: 'aws',
              region: 'us-east-1',
              environment: 'dev',
            },
          }, data.projectId); // Pass the backend projectId
        }
        setRequirements(input);

        // Set status to 'planning' immediately so buttons show up
        useProjectStore.getState().updateProjectStatus('planning');

        // Update project directory if available
        console.log('Project directory:', data.projectDirectory);

        // Navigate to the build page with the project ID and auto-start
        router.push(`/build/${data.projectId}?autoStart=true`);
      }
    } catch (error) {
      console.error('Error starting workflow:', error);
      alert('Failed to start workflow. Check console for details.');
    } finally {
      setAnalyzing(false);
    }
  };

  const detectFeatures = (text: string): string[] => {
    const features: string[] = [];
    const lower = text.toLowerCase();

    // Insurance/Workers' Comp specific features
    if (lower.includes('claim') || lower.includes('claims')) features.push('Claims Management');
    if (lower.includes('policy') || lower.includes('policies')) features.push('Policy Management');
    if (lower.includes('audit') || lower.includes('auditing')) features.push('Premium Audit');
    if (lower.includes('underwriting')) features.push('Underwriting');
    if (lower.includes('report') || lower.includes('reporting')) features.push('Reporting');
    if (lower.includes('dashboard')) features.push('Dashboard');
    if (lower.includes('document') || lower.includes('documentation')) features.push('Document Management');
    if (lower.includes('portal')) features.push('Agent Portal');

    // General features
    if (lower.includes('auth') || lower.includes('login')) features.push('Secure Auth');
    if (lower.includes('database') || lower.includes('data')) features.push('Encrypted DB');
    if (lower.includes('api')) features.push('Secure API');
    if (lower.includes('log')) features.push('Audit Logging');

    return features;
  };

  const estimateComplexity = (text: string): string => {
    const words = text.trim().split(/\s+/).length;
    if (words < 50) return 'Simple';
    if (words < 150) return 'Medium';
    return 'Complex';
  };

  const detectedFeatures = input ? detectFeatures(input) : [];
  const complexity = input ? estimateComplexity(input) : null;

  return (
    <>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-blue-600" />
            Project Requirements
          </CardTitle>
          {complexity && (
            <Badge variant={complexity === 'Simple' ? 'default' : complexity === 'Medium' ? 'secondary' : 'destructive'}>
              {complexity}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3 overflow-hidden min-h-0">
        {!isExistingProject && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <FolderOpen className="h-3 w-3" />
              Project Name
            </label>
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="claims-dashboard, policy-manager..."
              disabled={analyzing}
              className="text-sm"
            />
          </div>
        )}

        {/* Security Compliance Indicator */}
        {!isExistingProject && (
          <div className="flex items-center gap-2 p-2 bg-blue-500/10 rounded-md border border-blue-500/20">
            <Shield className="h-4 w-4 text-blue-500" />
            <div className="flex flex-col">
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                SOC 2 & NIST Compliant Development
              </span>
              <span className="text-[10px] text-muted-foreground">
                Ochsner AI Studio automatically enforces enterprise security standards
              </span>
            </div>
          </div>
        )}

        {isExistingProject && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <FolderOpen className="h-3 w-3" />
              Project: {project?.config?.name || project?.projectId}
            </label>
          </div>
        )}

        <div className="flex-1 flex flex-col gap-2 min-h-0">
          <label className="text-base font-semibold flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-blue-600" />
            {isExistingProject ? 'Project Requirements' : 'Describe Your Application'}
          </label>
          <Textarea
            placeholder={isExistingProject ? '' : "Describe your application in detail. For example:\n\n• Claims management dashboard\n• Policy tracking system\n• Premium audit workflow\n• Agent portal with reporting\n\nOchsner AI Studio will automatically implement secure, compliant controls."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 resize-none text-base leading-relaxed p-4 font-normal"
            disabled={analyzing || isExistingProject}
            readOnly={isExistingProject}
          />
        </div>

        {!isExistingProject && detectedFeatures.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {detectedFeatures.map((feature) => (
              <Badge key={feature} variant="outline" className="text-xs border-blue-300 text-blue-600">
                {feature}
              </Badge>
            ))}
          </div>
        )}

        {!isExistingProject && (
          <Button
            onClick={() => handleAnalyze()}
            disabled={!input.trim() || analyzing}
            className="w-full bg-blue-600 hover:bg-blue-700"
            size="sm"
          >
            {analyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Building...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Quick Build
              </>
            )}
          </Button>
        )}

        {isExistingProject && (
          <div className="text-sm text-muted-foreground text-center p-3 bg-muted rounded-md">
            Use the <strong>Start Workflow</strong> button in the header to begin or resume development.
          </div>
        )}
      </CardContent>
    </>
  );
}
