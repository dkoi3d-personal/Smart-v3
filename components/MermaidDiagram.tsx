'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { AlertCircle, Loader2, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MermaidDiagramProps {
  content: string;
  className?: string;
}

export function MermaidDiagram({ content, className }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastContentRef = useRef<string>(''); // Track last rendered content
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mermaidReady, setMermaidReady] = useState(false);

  // Initialize mermaid only on client side
  useEffect(() => {
    const initMermaid = async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'loose',
          suppressErrorRendering: true, // Don't show error in diagram
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: 'basis',
          },
          sequence: {
            useMaxWidth: true,
            showSequenceNumbers: true,
          },
          er: {
            useMaxWidth: true,
            layoutDirection: 'TB', // Top to bottom layout
            minEntityWidth: 100,
            minEntityHeight: 50,
          },
        });
        setMermaidReady(true);
      } catch (err) {
        console.error('Failed to initialize mermaid:', err);
        setError('Failed to load diagram renderer');
        setLoading(false);
      }
    };

    initMermaid();
  }, []);

  // Render diagram when mermaid is ready and content changes
  useEffect(() => {
    if (!mermaidReady || !content) {
      if (!content) {
        setLoading(false);
        setError('No diagram content provided');
      }
      return;
    }

    // Skip if content hasn't changed and we already have a rendered SVG
    if (content === lastContentRef.current && svg) {
      setLoading(false);
      return;
    }

    let isCancelled = false;

    const renderDiagram = async () => {
      // Only show loading and clear old SVG if content actually changed
      if (content !== lastContentRef.current) {
        setLoading(true);
        setError(null);
        setSvg('');
      }

      try {
        const mermaid = (await import('mermaid')).default;

        // Clean content - remove any markdown code block markers
        let cleanContent = content.trim();
        if (cleanContent.startsWith('```mermaid')) {
          cleanContent = cleanContent.replace(/^```mermaid\n?/, '').replace(/\n?```$/, '');
        } else if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }

        // Validate that content looks like valid mermaid
        if (!cleanContent || cleanContent.length < 5) {
          if (!isCancelled) {
            setError('No valid diagram content');
            setLoading(false);
          }
          return;
        }

        console.log('Rendering mermaid diagram:', cleanContent.substring(0, 100));

        // Generate unique ID for this diagram
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Render the diagram
        const { svg: renderedSvg } = await mermaid.render(id, cleanContent);

        if (!isCancelled) {
          lastContentRef.current = content; // Save successful content
          setSvg(renderedSvg);
          setLoading(false);
        }
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        if (!isCancelled) {
          const errorMsg = err instanceof Error ? err.message : 'Failed to render diagram';
          setError(errorMsg);
          setLoading(false);
        }
      }
    };

    renderDiagram();

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, mermaidReady]); // Don't include svg to avoid render loops

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const handleResetZoom = () => setZoom(100);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center p-8 min-h-[200px]', className)}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Rendering diagram...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('p-4 bg-destructive/10 rounded-lg', className)}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span className="font-medium">Failed to render diagram</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setError(null);
              setLoading(true);
              setSvg('');
            }}
          >
            Retry
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <div className="text-xs">
          <p className="text-muted-foreground mb-2">Diagram source code:</p>
          <pre className="bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
            {content}
          </pre>
        </div>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className={cn('p-4 text-center text-muted-foreground', className)}>
        No diagram to display
      </div>
    );
  }

  return (
    <>
      {/* Fullscreen overlay */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-8"
          onClick={toggleFullscreen}
        >
          <div
            className="max-w-full max-h-full overflow-auto bg-white dark:bg-gray-900 rounded-lg shadow-xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleZoomOut}>
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium w-16 text-center">{zoom}%</span>
                <Button variant="outline" size="sm" onClick={handleZoomIn}>
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleResetZoom}>
                  Reset
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={toggleFullscreen}>
                Close
              </Button>
            </div>
            <div
              className="mermaid-container overflow-auto"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        </div>
      )}

      {/* Normal view */}
      <div className={cn('relative', className)}>
        {/* Toolbar */}
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-md p-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs font-medium w-10 text-center">{zoom}%</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleFullscreen}>
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Diagram */}
        <div
          ref={containerRef}
          className="mermaid-container overflow-auto p-4 bg-white dark:bg-gray-900 rounded-lg min-h-[200px]"
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </>
  );
}

export default MermaidDiagram;
