'use client';

import { useState, useCallback } from 'react';

export type PreviewStatus = 'idle' | 'starting' | 'ready' | 'error' | 'stopped';

export interface UseBuildPreviewOptions {
  projectId: string;
  onLog?: (message: string) => void;
}

export function useBuildPreview({ projectId, onLog }: UseBuildPreviewOptions) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('idle');
  const [previewError, setPreviewError] = useState<string | null>(null);

  const log = useCallback(
    (message: string) => {
      onLog?.(message);
    },
    [onLog]
  );

  // Start preview server
  const startPreview = useCallback(async () => {
    setPreviewStatus('starting');
    setPreviewError(null);
    log('Starting preview server...');

    try {
      const response = await fetch('/api/preview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      const data = await response.json();

      if (data.success && data.url) {
        setPreviewUrl(data.url);
        setPreviewStatus('ready');
        setPreviewKey((k) => k + 1);
        log(`Preview ready at ${data.url}`);
        return data.url;
      } else {
        const error = data.error || 'Failed to start preview';
        setPreviewError(error);
        setPreviewStatus('error');
        log(`Preview error: ${error}`);
        return null;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setPreviewError(errorMessage);
      setPreviewStatus('error');
      log(`Preview error: ${errorMessage}`);
      return null;
    }
  }, [projectId, log]);

  // Stop preview server
  const stopPreview = useCallback(async () => {
    try {
      await fetch('/api/preview/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      setPreviewUrl(null);
      setPreviewStatus('stopped');
      log('Preview stopped');
    } catch (error) {
      console.error('Failed to stop preview:', error);
    }
  }, [projectId, log]);

  // Refresh preview
  const refreshPreview = useCallback(() => {
    setPreviewKey((k) => k + 1);
  }, []);

  // Open preview in new window
  const openInNewWindow = useCallback(() => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  }, [previewUrl]);

  return {
    previewUrl,
    previewKey,
    previewStatus,
    previewError,
    startPreview,
    stopPreview,
    refreshPreview,
    openInNewWindow,
    isReady: previewStatus === 'ready',
    isStarting: previewStatus === 'starting',
    isError: previewStatus === 'error',
  };
}
