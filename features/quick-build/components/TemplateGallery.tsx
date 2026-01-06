'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Rocket, Heart, Check, AlertCircle } from 'lucide-react';
import { QUICK_BUILD_TEMPLATES, type QuickBuildTemplate } from '../data/templates';
import { getTotalApiCount } from '../data/epic-api-catalog';
import { CategoryFilter, type FilterCategory } from './CategoryFilter';
import { TemplateCard } from './TemplateCard';

interface TemplateGalleryProps {
  onSelectTemplate: (template: QuickBuildTemplate) => void;
  selectedTemplateId?: string | null;
  epicConnected?: boolean;
}

export function TemplateGallery({ onSelectTemplate, selectedTemplateId, epicConnected }: TemplateGalleryProps) {
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');

  const filteredTemplates = useMemo(() => {
    if (filterCategory === 'all') {
      return QUICK_BUILD_TEMPLATES;
    }
    return QUICK_BUILD_TEMPLATES.filter(t => t.category === filterCategory);
  }, [filterCategory]);

  const apiCount = getTotalApiCount();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
            <Rocket className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Quick Build</h1>
            <p className="text-sm text-muted-foreground">Epic App Factory</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-muted-foreground">
            Build healthcare apps in minutes with Epic FHIR APIs.{' '}
            <span className="inline-flex items-center gap-1 text-primary font-medium">
              <Heart className="h-3.5 w-3.5" />
              {apiCount} APIs available
            </span>
          </p>
          {epicConnected ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
              <Check className="h-3 w-3" />
              Live API Access
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <AlertCircle className="h-3 w-3" />
              Mock Data Mode
            </span>
          )}
        </div>
      </div>

      {/* Category Filter */}
      <div className="mb-6">
        <CategoryFilter
          selected={filterCategory}
          onChange={setFilterCategory}
        />
      </div>

      {/* Template Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTemplates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              onSelect={onSelectTemplate}
              selected={selectedTemplateId === template.id}
            />
          ))}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <p className="text-lg font-medium mb-2">No templates in this category</p>
            <p className="text-sm">Try selecting a different category or use Custom Build</p>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="mt-6 pt-4 border-t text-center text-sm text-muted-foreground">
        Select a template to configure and add more Epic APIs, or choose{' '}
        <button
          onClick={() => {
            const customTemplate = QUICK_BUILD_TEMPLATES.find(t => t.isCustom);
            if (customTemplate) onSelectTemplate(customTemplate);
          }}
          className="text-primary hover:underline font-medium"
        >
          Custom Build
        </button>{' '}
        to start from scratch
      </div>
    </div>
  );
}

export default TemplateGallery;
