'use client';

import { useState, useRef, useCallback } from 'react';
import type { BuildProgress, DatabaseConfig, QuickBuildState } from '../types';

interface UseQuickBuildOptions {
  onBuildComplete?: (projectId: string) => void;
  onBuildError?: (error: string) => void;
}

export function useQuickBuild(options: UseQuickBuildOptions = {}) {
  const [state, setState] = useState<QuickBuildState>({
    requirements: '',
    projectId: null,
    building: false,
    progress: null,
    logs: [],
    databaseConfig: null,
  });

  const buildStartedRef = useRef(false);

  const addLog = useCallback((message: string) => {
    setState(prev => ({
      ...prev,
      logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] ${message}`],
    }));
  }, []);

  const setRequirements = useCallback((requirements: string) => {
    setState(prev => ({ ...prev, requirements }));
  }, []);

  const setDatabaseConfig = useCallback((config: DatabaseConfig | null) => {
    setState(prev => ({ ...prev, databaseConfig: config }));
  }, []);

  const setProjectId = useCallback((projectId: string | null) => {
    setState(prev => ({ ...prev, projectId }));
  }, []);

  const startBuild = useCallback(async (
    projectId: string,
    requirements: string,
    dbConfig?: DatabaseConfig | null
  ) => {
    setState(prev => ({
      ...prev,
      building: true,
      progress: null,
      logs: [],
      projectId,
    }));

    addLog(`Starting build process for ${projectId}...`);
    if (dbConfig && dbConfig.provider !== 'none') {
      addLog(`Database: ${dbConfig.provider} with ${dbConfig.schemaTemplate} schema`);
    }

    try {
      const response = await fetch('/api/simple-build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          requirements: requirements.trim(),
          database: dbConfig && dbConfig.provider !== 'none' ? dbConfig : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start build');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buildComplete = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)) as BuildProgress & { done?: boolean };

              if (data.done) {
                addLog('Build process completed');
                continue;
              }

              setState(prev => ({ ...prev, progress: data }));
              addLog(data.message);

              if (data.filesCreated) {
                data.filesCreated.forEach((f: string) => addLog(`  Created: ${f}`));
              }

              if (data.error) {
                addLog(`ERROR: ${data.error}`);
              }

              if (data.phase === 'complete') {
                buildComplete = true;
                addLog('Build phase complete');
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      if (buildComplete) {
        options.onBuildComplete?.(projectId);
      }

      return buildComplete;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        progress: {
          phase: 'error',
          message: 'Build failed',
          error: errorMessage,
        },
      }));
      addLog(`ERROR: ${errorMessage}`);
      options.onBuildError?.(errorMessage);
      return false;
    } finally {
      setState(prev => ({ ...prev, building: false }));
    }
  }, [addLog, options]);

  const attemptFix = useCallback(async () => {
    const { projectId, progress } = state;
    if (!projectId || !progress?.error) return false;

    setState(prev => ({ ...prev, building: true }));
    addLog('Attempting to fix the error...');

    try {
      const response = await fetch('/api/simple-build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          action: 'fix',
          error: progress.error,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start fix');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let fixSuccessful = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)) as BuildProgress & { done?: boolean };

              if (data.done) continue;

              setState(prev => ({ ...prev, progress: data }));
              addLog(data.message);

              if (data.error) {
                addLog(`ERROR: ${data.error}`);
              }

              if (data.phase === 'complete') {
                fixSuccessful = true;
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      return fixSuccessful;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Fix failed: ${errorMessage}`);
      return false;
    } finally {
      setState(prev => ({ ...prev, building: false }));
    }
  }, [state, addLog]);

  const reset = useCallback(() => {
    setState({
      requirements: '',
      projectId: null,
      building: false,
      progress: null,
      logs: [],
      databaseConfig: null,
    });
    buildStartedRef.current = false;
  }, []);

  return {
    ...state,
    buildStartedRef,
    setRequirements,
    setDatabaseConfig,
    setProjectId,
    startBuild,
    attemptFix,
    addLog,
    reset,
  };
}
