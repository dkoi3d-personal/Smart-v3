'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Home, FolderOpen, Heart, AlertCircle, Check, Loader2 } from 'lucide-react';
import {
  TemplateGallery,
  TemplateConfigPanel,
  useTemplateSelection,
  useEpicStatus,
} from '@/features/quick-build';
import type { QuickBuildTemplate, QuickBuildConfig } from '@/features/quick-build';

export default function QuickBuildPage() {
  const router = useRouter();
  const [buildError, setBuildError] = useState<string | null>(null);

  // Epic connection status
  const { status: epicStatus, loading: epicLoading } = useEpicStatus();

  // Template selection state and actions
  const {
    step,
    selectedTemplate,
    creating,
    selectTemplate,
    goBack,
    createProject,
    reset,
  } = useTemplateSelection();

  const handleSelectTemplate = (template: QuickBuildTemplate) => {
    selectTemplate(template);
    setBuildError(null);
  };

  const handleBuild = async (buildConfig: QuickBuildConfig) => {
    setBuildError(null);

    // Stop ALL existing previews in background (don't block build start)
    fetch('/api/preview/stop-all', { method: 'POST' }).catch(() => {});

    // Create project and navigate to build page
    const projectId = await createProject(buildConfig);

    if (projectId) {
      // Navigate to the project build page
      router.push(`/quick-build/${projectId}`);
    } else {
      setBuildError('Failed to create project. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {step !== 'gallery' && (
              <button
                onClick={goBack}
                disabled={creating}
                className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <span className="font-semibold text-lg">Quick Build</span>
            {step !== 'gallery' && selectedTemplate && (
              <span className="text-muted-foreground text-sm hidden sm:inline">
                / {selectedTemplate.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Epic Connection Status */}
            {epicLoading ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="hidden sm:inline">Checking Epic...</span>
              </div>
            ) : epicStatus?.connected ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 text-sm">
                <Heart className="h-4 w-4" />
                <Check className="h-3 w-3" />
                <span className="hidden sm:inline">Epic Connected</span>
              </div>
            ) : (
              <button
                onClick={() => router.push('/settings?section=epic')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm hover:bg-amber-500/20 transition-colors"
              >
                <Heart className="h-4 w-4" />
                <AlertCircle className="h-3 w-3" />
                <span className="hidden sm:inline">Connect Epic</span>
              </button>
            )}
            <button
              onClick={() => router.push('/')}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              title="Home"
            >
              <Home className="h-5 w-5" />
            </button>
            <button
              onClick={() => router.push('/projects')}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              title="Projects"
            >
              <FolderOpen className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Error message */}
        {buildError && (
          <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
            {buildError}
          </div>
        )}

        {/* Step 1: Template Gallery */}
        {step === 'gallery' && (
          <TemplateGallery
            onSelectTemplate={handleSelectTemplate}
            selectedTemplateId={null}
            epicConnected={epicStatus?.connected ?? false}
          />
        )}

        {/* Step 2: Configure Template */}
        {step === 'configure' && selectedTemplate && (
          <TemplateConfigPanel
            template={selectedTemplate}
            onBack={goBack}
            onBuild={handleBuild}
            isCreating={creating}
          />
        )}
      </main>
    </div>
  );
}
