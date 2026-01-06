'use client';

import { useState } from 'react';
import { Heart, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EpicCapabilitiesExplorer } from '@/components/epic/EpicCapabilitiesExplorer';

interface EpicExplorerSectionProps {
  onSelectIdea: (prompt: string) => void;
}

export function EpicExplorerSection({ onSelectIdea }: EpicExplorerSectionProps) {
  const [showExplorer, setShowExplorer] = useState(false);

  const handleSelectIdea = (idea: string, resources: string[]) => {
    const prompt = `Create a ${idea.toLowerCase()} app using Epic FHIR APIs. Use the ${resources.join(', ')} resource${resources.length > 1 ? 's' : ''} to build a clean, user-friendly interface.`;
    onSelectIdea(prompt);
    setShowExplorer(false);
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setShowExplorer(!showExplorer)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="p-2 rounded-lg bg-red-500/20">
          <Heart className="h-4 w-4 text-red-500" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-sm flex items-center gap-2">
            Epic Healthcare API Explorer
            <Badge variant="outline" className="text-xs">
              59 APIs
            </Badge>
          </h4>
          <p className="text-xs text-muted-foreground">
            Browse available Epic FHIR capabilities and get app ideas
          </p>
        </div>
        {showExplorer ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {showExplorer && (
        <div className="border-t p-4 max-h-[500px] overflow-y-auto bg-muted/20">
          <EpicCapabilitiesExplorer compact onSelectIdea={handleSelectIdea} />
        </div>
      )}
    </div>
  );
}
