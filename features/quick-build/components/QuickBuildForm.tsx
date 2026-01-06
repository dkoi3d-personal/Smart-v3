'use client';

import { Rocket, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { EXAMPLE_PROMPTS } from '../constants';

interface QuickBuildFormProps {
  requirements: string;
  onRequirementsChange: (value: string) => void;
  onBuild: () => void;
  building: boolean;
  disabled?: boolean;
  children?: React.ReactNode; // For Epic explorer and other extras
}

export function QuickBuildForm({
  requirements,
  onRequirementsChange,
  onBuild,
  building,
  disabled,
  children,
}: QuickBuildFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>What do you want to build?</CardTitle>
        <CardDescription>
          Describe your app in plain English. Keep it simple for best results.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="Example: Create a simple todo list app where I can add and remove tasks..."
          value={requirements}
          onChange={(e) => onRequirementsChange(e.target.value)}
          rows={4}
          disabled={building}
          className="text-lg"
        />

        {/* Example prompts - only show when not building */}
        {!building && !disabled && (
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((example, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                onClick={() => onRequirementsChange(example.prompt)}
              >
                {example.title}
              </Button>
            ))}
          </div>
        )}

        {/* Slot for additional content like Epic explorer */}
        {!building && !disabled && children}

        <Button
          onClick={onBuild}
          disabled={building || !requirements.trim()}
          size="lg"
          className="w-full"
        >
          {building ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Building...
            </>
          ) : (
            <>
              <Rocket className="h-5 w-5 mr-2" />
              Build App
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
