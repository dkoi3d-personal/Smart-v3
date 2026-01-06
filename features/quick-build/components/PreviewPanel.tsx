'use client';

import { RefObject } from 'react';
import {
  Monitor,
  RotateCw,
  ExternalLink,
  Square,
  Loader2,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BuildPhase } from '../types';

interface PreviewPanelProps {
  previewUrl: string | null;
  previewLoading: boolean;
  previewError: string | null;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  buildPhase: BuildPhase | null;
  onRefresh: () => void;
  onOpenExternal: () => void;
  onStop: () => void;
  onRetry: () => void;
}

export function PreviewPanel({
  previewUrl,
  previewLoading,
  previewError,
  iframeRef,
  buildPhase,
  onRefresh,
  onOpenExternal,
  onStop,
  onRetry,
}: PreviewPanelProps) {
  return (
    <Card className="h-full min-h-[500px] flex flex-col">
      <CardHeader className="py-3 flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Monitor className="h-4 w-4" />
          Live Preview
        </CardTitle>
        {previewUrl && (
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh}>
              <RotateCw className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOpenExternal}>
              <ExternalLink className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onStop}>
              <Square className="h-3 w-3" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 p-0">
        {previewLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p>Starting preview server...</p>
            <p className="text-xs mt-2">This may take a moment</p>
          </div>
        ) : previewError ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4">
            <XCircle className="h-8 w-8 text-red-500 mb-4" />
            <p className="text-red-500 font-medium">Preview Error</p>
            <p className="text-xs mt-2 text-center">{previewError}</p>
            <Button variant="outline" className="mt-4" onClick={onRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        ) : previewUrl ? (
          <iframe
            ref={iframeRef}
            src={previewUrl}
            className="w-full h-full border-0 rounded-b-lg"
            title="App Preview"
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <Monitor className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-center">
              {buildPhase === 'complete'
                ? 'Click "Launch Preview" to see your app'
                : 'Build your app to see the live preview'}
            </p>
            <p className="text-xs mt-2 text-center max-w-xs">
              The preview will appear here automatically after a successful build
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
