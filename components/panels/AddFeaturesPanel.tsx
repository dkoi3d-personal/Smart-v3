'use client';

import { useState } from 'react';
import { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Sparkles, Loader2, ListPlus } from 'lucide-react';
import { useProjectStore } from '@/stores/project-store';

export function AddFeaturesPanel() {
  const { project } = useProjectStore();
  const [featureInput, setFeatureInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [addedFeatures, setAddedFeatures] = useState<string[]>([]);

  const handleAddFeature = async () => {
    if (!featureInput.trim()) return;
    if (!project?.projectId) {
      alert('No active project');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/workflow/add-feature', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: project.projectId,
          feature: featureInput.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add feature');
      }

      const data = await response.json();
      console.log('Feature added:', data);

      // Track added features
      setAddedFeatures([...addedFeatures, featureInput.trim()]);
      setFeatureInput('');

      // Show success message
      alert('Feature added! The agents will prioritize it in the workflow.');
    } catch (error) {
      console.error('Error adding feature:', error);
      alert('Failed to add feature. Check console for details.');
    } finally {
      setSubmitting(false);
    }
  };

  const detectFeatureType = (text: string): string[] => {
    const types: string[] = [];
    const lower = text.toLowerCase();

    if (lower.includes('auth') || lower.includes('login')) types.push('Authentication');
    if (lower.includes('payment') || lower.includes('checkout')) types.push('Payments');
    if (lower.includes('notification') || lower.includes('email')) types.push('Notifications');
    if (lower.includes('search')) types.push('Search');
    if (lower.includes('export') || lower.includes('download')) types.push('Export');
    if (lower.includes('upload') || lower.includes('import')) types.push('Import');
    if (lower.includes('dashboard') || lower.includes('analytics')) types.push('Analytics');
    if (lower.includes('admin')) types.push('Admin');

    return types;
  };

  const detectedTypes = featureInput ? detectFeatureType(featureInput) : [];

  return (
    <>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ListPlus className="h-4 w-4" />
            Add Features
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {addedFeatures.length} added
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3 overflow-hidden min-h-0">
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          <label className="text-base font-semibold flex items-center gap-2">
            <Plus className="h-5 w-5" />
            What feature do you want to add?
          </label>
          <Textarea
            placeholder="Add a new feature or enhancement. For example: Add user profile editing with avatar upload, Add export to PDF functionality, Add dark mode support. The agents will analyze and integrate this into the project."
            value={featureInput}
            onChange={(e) => setFeatureInput(e.target.value)}
            className="flex-1 resize-none text-base leading-relaxed p-4 font-normal"
            disabled={submitting}
          />
        </div>

        {detectedTypes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {detectedTypes.map((type) => (
              <Badge key={type} variant="outline" className="text-xs">
                {type}
              </Badge>
            ))}
          </div>
        )}

        <Button
          onClick={handleAddFeature}
          disabled={!featureInput.trim() || submitting}
          className="w-full"
          size="sm"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Adding...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Add to Workflow
            </>
          )}
        </Button>

        {addedFeatures.length > 0 && (
          <div className="border-t pt-3 mt-2">
            <p className="text-xs font-medium text-muted-foreground mb-2">Recently Added Features:</p>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {addedFeatures.slice(-5).reverse().map((feature, index) => (
                <div key={index} className="text-xs bg-muted/50 p-2 rounded border border-border">
                  <p className="line-clamp-2">{feature}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted/30 rounded border border-border">
          💡 <strong>Tip:</strong> Features are analyzed by the research agent, broken into stories by the product owner, and prioritized in the development queue.
        </div>
      </CardContent>
    </>
  );
}
