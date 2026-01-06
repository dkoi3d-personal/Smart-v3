'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Cpu,
  Check,
  ExternalLink,
  ScanText,
  ImageIcon,
  Code,
  MessageSquare,
  Brain,
  Sparkles,
} from 'lucide-react';
import { useSettings } from '../SettingsContext';
import { ServiceCard } from '../shared/ServiceCard';

// Platform icons
const AppleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
);

const WindowsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 12V6.75l6-1v6.5H3zm7 0V5.5l8-1.25V12h-8zm0 1h8v7.75l-8-1.25V13zm-7 0h6v6.25l-6-1V13z" />
  </svg>
);

const CAPABILITY_ICONS: Record<string, any> = {
  ocr: ScanText,
  vision: ImageIcon,
  code: Code,
  chat: MessageSquare,
  reasoning: Brain,
  embedding: Sparkles,
  grounding: ScanText,
};

export function LocalAISection() {
  const {
    mlxStatus,
    mlxLoading,
    loadMLXStatus,
    ollamaStatus,
    ollamaLoading,
    loadOllamaStatus,
  } = useSettings();

  const getMLXStatus = () => {
    if (mlxStatus?.mlxAvailable && mlxStatus.model.available) return 'success';
    if (mlxStatus?.mlxAvailable) return 'warning';
    return 'inactive';
  };

  const getOllamaStatus = () => {
    if (ollamaStatus?.deepseekOcrAvailable) return 'success';
    if (ollamaStatus?.ollamaAvailable) return 'warning';
    return 'inactive';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Local AI</h2>
        <p className="text-muted-foreground">
          Configure on-device AI for OCR and vision processing
        </p>
      </div>

      {/* MLX Card (macOS) */}
      <ServiceCard
        title="MLX Local AI"
        description="On-device OCR & Vision"
        icon={<Cpu className="h-5 w-5" />}
        status={getMLXStatus()}
        platformBadge="macOS"
        onRefresh={loadMLXStatus}
        loading={mlxLoading}
        externalLinkUrl="https://github.com/ml-explore/mlx-vlm"
      >
        {mlxStatus && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <AppleIcon className="h-4 w-4" />
                  <p className="text-sm font-medium">
                    {mlxStatus.mlxAvailable && mlxStatus.model.available
                      ? 'Ready'
                      : mlxStatus.mlxAvailable
                      ? 'Model Not Downloaded'
                      : 'Not Installed'}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {mlxStatus.mlxAvailable && mlxStatus.model.available
                    ? `${mlxStatus.model.name} • ~${mlxStatus.performance.approximate_tokens_per_second} tok/s`
                    : mlxStatus.error || 'Install mlx-vlm to enable'}
                </p>
              </div>
              {mlxStatus.mlxAvailable && mlxStatus.model.available && (
                <Badge className="bg-green-600 text-white text-xs">
                  <Check className="h-3 w-3 mr-1" />
                  Ready
                </Badge>
              )}
            </div>

            {/* Installation Instructions */}
            {!mlxStatus.mlxAvailable && (
              <div className="p-3 rounded-lg bg-muted/50 text-xs space-y-2">
                <p className="font-medium">Install MLX-VLM:</p>
                <code className="block p-2 bg-black/80 text-white rounded font-mono">
                  pip install mlx-vlm
                </code>
              </div>
            )}

            {/* Model Download Instructions */}
            {mlxStatus.mlxAvailable && !mlxStatus.model.available && (
              <div className="p-3 rounded-lg bg-muted/50 text-xs space-y-2">
                <p className="font-medium">Download the DeepSeek OCR model:</p>
                <code className="block p-2 bg-black/80 text-white rounded font-mono text-[10px]">
                  python -c "from mlx_vlm import load; load('mlx-community/DeepSeek-OCR-4bit')"
                </code>
              </div>
            )}

            {/* Capabilities */}
            {mlxStatus.mlxAvailable && mlxStatus.model.available && (
              <div className="flex gap-1.5 flex-wrap">
                {mlxStatus.capabilities.map((cap) => {
                  const CapIcon = CAPABILITY_ICONS[cap] || Sparkles;
                  return (
                    <Badge key={cap} variant="secondary" className="text-xs gap-1">
                      <CapIcon className="h-3 w-3" />
                      {cap}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </ServiceCard>

      {/* Ollama Card (Windows/Linux) */}
      <ServiceCard
        title="Ollama Local AI"
        description="DeepSeek OCR & Vision"
        icon={<Cpu className="h-5 w-5" />}
        status={getOllamaStatus()}
        platformBadge="Windows"
        onRefresh={loadOllamaStatus}
        loading={ollamaLoading}
        externalLinkUrl="https://ollama.ai"
      >
        {ollamaStatus && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <WindowsIcon className="h-4 w-4" />
                  <p className="text-sm font-medium">
                    {ollamaStatus.deepseekOcrAvailable
                      ? 'Ready'
                      : ollamaStatus.ollamaAvailable
                      ? 'Model Not Installed'
                      : 'Ollama Not Running'}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {ollamaStatus.deepseekOcrAvailable && ollamaStatus.deepseekModel
                    ? `${ollamaStatus.deepseekModel.displayName || ollamaStatus.deepseekModel.name} • ${ollamaStatus.deepseekModel.size}`
                    : ollamaStatus.ollamaAvailable
                    ? 'Pull deepseek-ocr model to enable OCR'
                    : ollamaStatus.error || 'Start Ollama service'}
                </p>
              </div>
              {ollamaStatus.deepseekOcrAvailable && (
                <Badge className="bg-green-600 text-white text-xs">
                  <Check className="h-3 w-3 mr-1" />
                  Ready
                </Badge>
              )}
            </div>

            {/* Installation Instructions */}
            {!ollamaStatus.ollamaAvailable && (
              <div className="p-3 rounded-lg bg-muted/50 text-xs space-y-2">
                <p className="font-medium">Install Ollama from ollama.ai, then start it:</p>
                <code className="block p-2 bg-black/80 text-white rounded font-mono">
                  ollama serve
                </code>
              </div>
            )}

            {/* Model Pull Instructions */}
            {ollamaStatus.ollamaAvailable && !ollamaStatus.deepseekOcrAvailable && (
              <div className="p-3 rounded-lg bg-muted/50 text-xs space-y-2">
                <p className="font-medium">Pull the DeepSeek OCR model:</p>
                <code className="block p-2 bg-black/80 text-white rounded font-mono">
                  ollama pull deepseek-ocr
                </code>
              </div>
            )}

            {/* Capabilities */}
            {ollamaStatus.deepseekOcrAvailable && ollamaStatus.capabilities.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {ollamaStatus.capabilities.map((cap) => {
                  const CapIcon = CAPABILITY_ICONS[cap] || Sparkles;
                  return (
                    <Badge key={cap} variant="secondary" className="text-xs gap-1">
                      <CapIcon className="h-3 w-3" />
                      {cap}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </ServiceCard>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About Local AI</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Local AI enables on-device processing for OCR (text extraction from images) and
            vision tasks. This provides:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Fast processing without API calls</li>
            <li>Privacy - data stays on your machine</li>
            <li>Works offline</li>
            <li>No usage costs</li>
          </ul>
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
            <p className="text-blue-700 dark:text-blue-300 text-xs">
              <span className="font-medium">Note:</span> Local AI requires a capable GPU. MLX
              works on Apple Silicon Macs. Ollama works on Windows/Linux with NVIDIA GPUs.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
