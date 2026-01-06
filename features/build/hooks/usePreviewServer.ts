'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { PreviewStatus } from '../types';
import { PREVIEW_POLL_INTERVAL, PREVIEW_MAX_RETRIES } from '../constants';

export interface UsePreviewServerOptions {
  projectId: string;
  onLog?: (message: string, type?: 'info' | 'error' | 'success') => void;
}

export interface UsePreviewServerReturn {
  previewUrl: string | null;
  previewKey: number;
  previewStatus: PreviewStatus;
  previewError: string | null;
  startDevServer: () => Promise<void>;
  stopDevServer: () => Promise<void>;
  refreshPreview: () => void;
  setPreviewKey: React.Dispatch<React.SetStateAction<number>>;
  // Expose setters for pages that need direct control
  setPreviewUrl: React.Dispatch<React.SetStateAction<string | null>>;
  setPreviewStatus: React.Dispatch<React.SetStateAction<PreviewStatus>>;
  setPreviewError: React.Dispatch<React.SetStateAction<string | null>>;
}

export function usePreviewServer({
  projectId,
  onLog,
}: UsePreviewServerOptions): UsePreviewServerReturn {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('idle');
  const [previewError, setPreviewError] = useState<string | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const startDevServer = useCallback(async () => {
    if (!projectId) return;

    setPreviewStatus('starting');
    setPreviewError(null);
    retryCountRef.current = 0;
    onLog?.('Starting dev server...', 'info');

    try {
      const response = await fetch('/api/preview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start dev server');
      }

      const data = await response.json();

      // Poll for server to be ready
      const pollForReady = () => {
        pollIntervalRef.current = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/preview/status?projectId=${projectId}`);
            const statusData = await statusRes.json();

            if (statusData.status === 'ready' && statusData.url) {
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
              }
              setPreviewUrl(statusData.url);
              setPreviewStatus('ready');
              setPreviewKey(k => k + 1);
              onLog?.(`Dev server ready at ${statusData.url}`, 'success');
            } else if (statusData.status === 'error') {
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
              }
              setPreviewStatus('error');
              setPreviewError(statusData.error || 'Server failed to start');
              onLog?.(statusData.error || 'Server failed to start', 'error');
            } else {
              retryCountRef.current++;
              if (retryCountRef.current > PREVIEW_MAX_RETRIES) {
                if (pollIntervalRef.current) {
                  clearInterval(pollIntervalRef.current);
                }
                setPreviewStatus('error');
                setPreviewError('Server took too long to start');
                onLog?.('Server took too long to start', 'error');
              } else {
                setPreviewError(`Retrying... (${retryCountRef.current}/${PREVIEW_MAX_RETRIES})`);
              }
            }
          } catch (err) {
            console.error('Error polling preview status:', err);
          }
        }, PREVIEW_POLL_INTERVAL);
      };

      pollForReady();
    } catch (err) {
      setPreviewStatus('error');
      const errorMessage = err instanceof Error ? err.message : 'Failed to start dev server';
      setPreviewError(errorMessage);
      onLog?.(errorMessage, 'error');
    }
  }, [projectId, onLog]);

  const stopDevServer = useCallback(async () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    try {
      await fetch('/api/preview/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      setPreviewStatus('stopped');
      setPreviewUrl(null);
      onLog?.('Dev server stopped', 'info');
    } catch (err) {
      console.error('Error stopping dev server:', err);
    }
  }, [projectId, onLog]);

  const refreshPreview = useCallback(() => {
    setPreviewKey(k => k + 1);
  }, []);

  return {
    previewUrl,
    previewKey,
    previewStatus,
    previewError,
    startDevServer,
    stopDevServer,
    refreshPreview,
    setPreviewKey,
    // Expose setters for pages that need direct control
    setPreviewUrl,
    setPreviewStatus,
    setPreviewError,
  };
}
