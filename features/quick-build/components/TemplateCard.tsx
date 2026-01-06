'use client';

import { cn } from '@/lib/utils';
import { Clock, ArrowRight, Layers } from 'lucide-react';
import type { QuickBuildTemplate } from '../data/templates';
import { getApiById } from '../data/epic-api-catalog';

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; light: string; gradient: string }> = {
  blue: { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-400', light: 'bg-blue-500/10', gradient: 'from-blue-500 to-blue-600' },
  purple: { bg: 'bg-purple-500', border: 'border-purple-500', text: 'text-purple-400', light: 'bg-purple-500/10', gradient: 'from-purple-500 to-purple-600' },
  green: { bg: 'bg-green-500', border: 'border-green-500', text: 'text-green-400', light: 'bg-green-500/10', gradient: 'from-green-500 to-green-600' },
  red: { bg: 'bg-red-500', border: 'border-red-500', text: 'text-red-400', light: 'bg-red-500/10', gradient: 'from-red-500 to-red-600' },
  teal: { bg: 'bg-teal-500', border: 'border-teal-500', text: 'text-teal-400', light: 'bg-teal-500/10', gradient: 'from-teal-500 to-teal-600' },
  cyan: { bg: 'bg-cyan-500', border: 'border-cyan-500', text: 'text-cyan-400', light: 'bg-cyan-500/10', gradient: 'from-cyan-500 to-cyan-600' },
  indigo: { bg: 'bg-indigo-500', border: 'border-indigo-500', text: 'text-indigo-400', light: 'bg-indigo-500/10', gradient: 'from-indigo-500 to-indigo-600' },
  pink: { bg: 'bg-pink-500', border: 'border-pink-500', text: 'text-pink-400', light: 'bg-pink-500/10', gradient: 'from-pink-500 to-pink-600' },
  amber: { bg: 'bg-amber-500', border: 'border-amber-500', text: 'text-amber-400', light: 'bg-amber-500/10', gradient: 'from-amber-500 to-amber-600' },
  orange: { bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-400', light: 'bg-orange-500/10', gradient: 'from-orange-500 to-orange-600' },
  emerald: { bg: 'bg-emerald-500', border: 'border-emerald-500', text: 'text-emerald-400', light: 'bg-emerald-500/10', gradient: 'from-emerald-500 to-emerald-600' },
  slate: { bg: 'bg-slate-500', border: 'border-slate-500', text: 'text-slate-400', light: 'bg-slate-500/10', gradient: 'from-slate-500 to-slate-600' },
};

const CATEGORY_LABELS: Record<string, string> = {
  patient: 'Patient',
  clinical: 'Clinical',
  medications: 'Medications',
  scheduling: 'Scheduling',
  documents: 'Documents',
  care: 'Care Plans',
  custom: 'Custom',
};

interface TemplateCardProps {
  template: QuickBuildTemplate;
  onSelect: (template: QuickBuildTemplate) => void;
  selected?: boolean;
}

export function TemplateCard({ template, onSelect, selected }: TemplateCardProps) {
  const colors = COLOR_MAP[template.color] || COLOR_MAP.blue;
  const Icon = template.icon;
  const categoryLabel = CATEGORY_LABELS[template.category] || template.category;

  // Get display names for default APIs
  const apiDisplayNames = template.defaultEpicApis
    .slice(0, 3)
    .map(apiId => {
      const api = getApiById(apiId);
      return api?.resourceType || apiId;
    });

  const remainingApis = template.defaultEpicApis.length - 3;

  return (
    <button
      onClick={() => onSelect(template)}
      className={cn(
        'group relative flex flex-col rounded-xl border text-left transition-all duration-200 overflow-hidden',
        'hover:shadow-lg hover:scale-[1.02] hover:-translate-y-0.5',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        selected
          ? cn('border-primary shadow-md ring-2 ring-primary/20')
          : 'border-border hover:border-primary/50 bg-card'
      )}
    >
      {/* Colored top bar */}
      <div className={cn('h-1.5 w-full bg-gradient-to-r', colors.gradient)} />

      {/* Content */}
      <div className="flex flex-col p-4">
        {/* Header with icon and category */}
        <div className="flex items-start gap-3 mb-3">
          <div
            className={cn(
              'flex-shrink-0 p-3 rounded-xl text-white shadow-lg',
              'bg-gradient-to-br',
              colors.gradient
            )}
          >
            <Icon className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-base leading-tight">
                {template.name}
              </h3>
            </div>
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded',
              colors.light,
              colors.text
            )}>
              {categoryLabel}
            </span>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {template.description}
        </p>

        {/* Epic API Badges */}
        {!template.isCustom && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {apiDisplayNames.map((name, i) => (
              <span
                key={i}
                className={cn(
                  'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md',
                  'bg-muted text-muted-foreground'
                )}
              >
                {name}
              </span>
            ))}
            {remainingApis > 0 && (
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md',
                colors.light,
                colors.text
              )}>
                +{remainingApis}
              </span>
            )}
          </div>
        )}

        {/* Custom template message */}
        {template.isCustom && (
          <div className={cn('flex-1 p-3 rounded-lg mb-3 border border-dashed', colors.light)}>
            <p className="text-sm text-muted-foreground">
              Select your own Epic APIs and build exactly what you need
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/50">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              <span>{template.defaultEpicApis.length} APIs</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>{template.estimatedTime}</span>
            </span>
          </div>
          <div
            className={cn(
              'flex items-center gap-1 text-xs font-semibold transition-colors',
              colors.text,
              'group-hover:opacity-100 opacity-70'
            )}
          >
            <span>Configure</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>

      {/* Selected indicator */}
      {selected && (
        <div
          className={cn(
            'absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center',
            'bg-primary text-primary-foreground text-xs font-bold shadow-lg'
          )}
        >
          ✓
        </div>
      )}
    </button>
  );
}

export default TemplateCard;
