'use client';

import { Rocket, Home, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuickBuildHeaderProps {
  onHome: () => void;
  onProjects: () => void;
}

export function QuickBuildHeader({ onHome, onProjects }: QuickBuildHeaderProps) {
  return (
    <div className="flex items-center gap-4 mb-8">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={onHome} title="Home">
          <Home className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={onProjects}>
          <FolderOpen className="h-4 w-4 mr-2" />
          Projects
        </Button>
      </div>
      <div className="border-l pl-4">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Rocket className="h-8 w-8 text-primary" />
          Quick Build
        </h1>
        <p className="text-muted-foreground">
          Describe your app and we&apos;ll build it in seconds
        </p>
      </div>
    </div>
  );
}
