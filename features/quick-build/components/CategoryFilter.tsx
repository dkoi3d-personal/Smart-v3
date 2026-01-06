'use client';

import { cn } from '@/lib/utils';
import { LayoutGrid, Sparkles } from 'lucide-react';
import { API_CATEGORIES, type EpicApiCategory } from '../data/epic-api-catalog';

export type FilterCategory = EpicApiCategory | 'all' | 'custom';

interface CategoryFilterProps {
  selected: FilterCategory;
  onChange: (category: FilterCategory) => void;
  showCustom?: boolean;
}

const COLOR_MAP: Record<string, string> = {
  blue: 'data-[selected=true]:bg-blue-500 data-[selected=true]:text-white data-[selected=true]:border-blue-500',
  purple: 'data-[selected=true]:bg-purple-500 data-[selected=true]:text-white data-[selected=true]:border-purple-500',
  green: 'data-[selected=true]:bg-green-500 data-[selected=true]:text-white data-[selected=true]:border-green-500',
  cyan: 'data-[selected=true]:bg-cyan-500 data-[selected=true]:text-white data-[selected=true]:border-cyan-500',
  indigo: 'data-[selected=true]:bg-indigo-500 data-[selected=true]:text-white data-[selected=true]:border-indigo-500',
  pink: 'data-[selected=true]:bg-pink-500 data-[selected=true]:text-white data-[selected=true]:border-pink-500',
  emerald: 'data-[selected=true]:bg-emerald-500 data-[selected=true]:text-white data-[selected=true]:border-emerald-500',
  slate: 'data-[selected=true]:bg-slate-500 data-[selected=true]:text-white data-[selected=true]:border-slate-500',
  amber: 'data-[selected=true]:bg-amber-500 data-[selected=true]:text-white data-[selected=true]:border-amber-500',
};

export function CategoryFilter({ selected, onChange, showCustom = true }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {/* All Templates */}
      <button
        onClick={() => onChange('all')}
        data-selected={selected === 'all'}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-all',
          'hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
          'data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground data-[selected=true]:border-primary'
        )}
      >
        <LayoutGrid className="h-4 w-4" />
        All
      </button>

      {/* Category Filters */}
      {API_CATEGORIES.map(category => {
        const Icon = category.icon;
        return (
          <button
            key={category.id}
            onClick={() => onChange(category.id)}
            data-selected={selected === category.id}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-all',
              'hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
              COLOR_MAP[category.color] || COLOR_MAP.blue
            )}
          >
            <Icon className="h-4 w-4" />
            {category.name}
          </button>
        );
      })}

      {/* Custom */}
      {showCustom && (
        <button
          onClick={() => onChange('custom')}
          data-selected={selected === 'custom'}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-all',
            'hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
            COLOR_MAP.amber
          )}
        >
          <Sparkles className="h-4 w-4" />
          Custom
        </button>
      )}
    </div>
  );
}

export default CategoryFilter;
