'use client';

import { useState, useCallback, useRef } from 'react';
import type {
  QuickBuildStep,
  QuickBuildConfig,
  BuildProgress,
  TemplateSelectionState,
} from '../types';
import type { QuickBuildTemplate } from '../data/templates';
import { getTemplateById } from '../data/templates';

interface UseTemplateSelectionReturn {
  // State
  step: QuickBuildStep;
  selectedTemplate: QuickBuildTemplate | null;
  config: QuickBuildConfig | null;
  creating: boolean;

  // Actions
  selectTemplate: (template: QuickBuildTemplate) => void;
  goBack: () => void;
  createProject: (config: QuickBuildConfig) => Promise<string | null>;
  reset: () => void;
}

export function useTemplateSelection(): UseTemplateSelectionReturn {
  const [step, setStep] = useState<QuickBuildStep>('gallery');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [config, setConfig] = useState<QuickBuildConfig | null>(null);
  const [creating, setCreating] = useState(false);

  const selectedTemplate = selectedTemplateId ? getTemplateById(selectedTemplateId) || null : null;

  const selectTemplate = useCallback((template: QuickBuildTemplate) => {
    setSelectedTemplateId(template.id);
    setStep('configure');
  }, []);

  const goBack = useCallback(() => {
    if (step === 'configure') {
      setStep('gallery');
      setSelectedTemplateId(null);
      setConfig(null);
    }
  }, [step]);

  /**
   * Create a Quick Build project and return the project ID.
   * The actual build happens on the /quick-build/[projectId] page.
   */
  const createProject = useCallback(async (buildConfig: QuickBuildConfig): Promise<string | null> => {
    if (creating) return null;
    setCreating(true);
    setConfig(buildConfig);

    try {
      const response = await fetch('/api/quick-build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: buildConfig.templateId,
          templateConfig: buildConfig,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create project: ${response.statusText}`);
      }

      const data = await response.json();
      return data.projectId;
    } catch (error) {
      console.error('Failed to create Quick Build project:', error);
      return null;
    } finally {
      setCreating(false);
    }
  }, [creating]);

  const reset = useCallback(() => {
    setStep('gallery');
    setSelectedTemplateId(null);
    setConfig(null);
    setCreating(false);
  }, []);

  return {
    step,
    selectedTemplate,
    config,
    creating,
    selectTemplate,
    goBack,
    createProject,
    reset,
  };
}

export default useTemplateSelection;
