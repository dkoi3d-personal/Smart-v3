'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Layers, Rocket, FileCode, Shield, TestTube, X } from 'lucide-react';

interface ComplexBuildContext {
  projectId: string;
  originalRequirements: string;
  generatedPrompt: string;
  filesCreated: string[];
  databaseConfig?: {
    provider: string;
    schemaTemplate: string;
  } | null;
}

interface ComplexBuildModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: ComplexBuildContext | null;
  onStartBuild: (prompt: string) => void;
}

export function ComplexBuildModal({
  open,
  onOpenChange,
  context,
  onStartBuild,
}: ComplexBuildModalProps) {
  const [prompt, setPrompt] = useState(context?.generatedPrompt || '');

  // Update prompt when context changes
  if (context?.generatedPrompt && prompt !== context.generatedPrompt && !prompt) {
    setPrompt(context.generatedPrompt);
  }

  const handleStartBuild = () => {
    onStartBuild(prompt);
    onOpenChange(false);
  };

  if (!context) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-purple-500" />
            Create Complex Build
          </DialogTitle>
          <DialogDescription>
            Transform your quick prototype into a production-ready application with full testing and security.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* What's included */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <FileCode className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Production Code</span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <TestTube className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Full Testing</span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <Shield className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium">Security Scan</span>
            </div>
          </div>

          {/* Files from quick build */}
          {context.filesCreated.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                Building on {context.filesCreated.length} files from quick build:
              </h4>
              <div className="flex flex-wrap gap-1 max-h-20 overflow-auto">
                {context.filesCreated.slice(0, 15).map((file, idx) => (
                  <Badge key={idx} variant="secondary" className="font-mono text-xs">
                    {file}
                  </Badge>
                ))}
                {context.filesCreated.length > 15 && (
                  <Badge variant="outline" className="text-xs">
                    +{context.filesCreated.length - 15} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Database info */}
          {context.databaseConfig && context.databaseConfig.provider !== 'none' && (
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <span className="text-sm">
                <strong>Database:</strong> {context.databaseConfig.provider} with {context.databaseConfig.schemaTemplate} schema
              </span>
            </div>
          )}

          {/* Editable prompt */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Build Requirements</h4>
              <span className="text-xs text-muted-foreground">Edit to customize what gets built</span>
            </div>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={12}
              className="font-mono text-sm"
              placeholder="Describe what you want to build..."
            />
          </div>

          {/* Agents info */}
          <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">
            <strong>This will run a multi-agent build with:</strong>
            <ul className="mt-1 ml-4 list-disc">
              <li>Product Owner - breaks down requirements into user stories</li>
              <li>Coder - implements each story with clean code</li>
              <li>Tester - writes and runs comprehensive tests</li>
              <li>Security - scans for vulnerabilities</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleStartBuild}
            disabled={!prompt.trim()}
            className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
          >
            <Rocket className="h-4 w-4 mr-2" />
            Start Complex Build
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
