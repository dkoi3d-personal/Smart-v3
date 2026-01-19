'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Search,
  X,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Plus,
} from 'lucide-react';
import {
  EPIC_API_CATALOG,
  API_CATEGORIES,
  getApiById,
  getApiDependencies,
  type EpicApiDefinition,
  type EpicApiCategory,
} from '../data/epic-api-catalog';

interface EpicApiPickerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedApiIds: string[];
  requiredApiIds: string[]; // APIs that can't be removed
  onAddApis: (apiIds: string[]) => void;
}

const COLOR_MAP: Record<string, { bg: string; light: string; text: string }> = {
  blue: { bg: 'bg-blue-500', light: 'bg-blue-500/10', text: 'text-blue-400' },
  purple: { bg: 'bg-purple-500', light: 'bg-purple-500/10', text: 'text-purple-400' },
  green: { bg: 'bg-green-500', light: 'bg-green-500/10', text: 'text-green-400' },
  red: { bg: 'bg-red-500', light: 'bg-red-500/10', text: 'text-red-400' },
  teal: { bg: 'bg-teal-500', light: 'bg-teal-500/10', text: 'text-teal-400' },
  cyan: { bg: 'bg-cyan-500', light: 'bg-cyan-500/10', text: 'text-cyan-400' },
  indigo: { bg: 'bg-indigo-500', light: 'bg-indigo-500/10', text: 'text-indigo-400' },
  pink: { bg: 'bg-pink-500', light: 'bg-pink-500/10', text: 'text-pink-400' },
  emerald: { bg: 'bg-emerald-500', light: 'bg-emerald-500/10', text: 'text-emerald-400' },
  slate: { bg: 'bg-slate-500', light: 'bg-slate-500/10', text: 'text-slate-400' },
  orange: { bg: 'bg-orange-500', light: 'bg-orange-500/10', text: 'text-orange-400' },
};

export function EpicApiPicker({
  isOpen,
  onClose,
  selectedApiIds,
  requiredApiIds,
  onAddApis,
}: EpicApiPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<EpicApiCategory | 'all'>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['patient', 'clinical', 'medications'])
  );
  const [pendingSelections, setPendingSelections] = useState<Set<string>>(new Set());
  const [showDependencyWarning, setShowDependencyWarning] = useState<{
    api: EpicApiDefinition;
    dependencies: EpicApiDefinition[];
  } | null>(null);

  // Filter APIs based on search and category
  const filteredApis = useMemo(() => {
    let apis = EPIC_API_CATALOG;

    if (selectedCategory !== 'all') {
      apis = apis.filter(api => api.category === selectedCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      apis = apis.filter(
        api =>
          api.displayName.toLowerCase().includes(query) ||
          api.description.toLowerCase().includes(query) ||
          api.resourceType.toLowerCase().includes(query)
      );
    }

    return apis;
  }, [searchQuery, selectedCategory]);

  // Group APIs by category for display
  const apisByCategory = useMemo(() => {
    const grouped: Record<string, EpicApiDefinition[]> = {};
    filteredApis.forEach(api => {
      if (!grouped[api.category]) {
        grouped[api.category] = [];
      }
      grouped[api.category].push(api);
    });
    return grouped;
  }, [filteredApis]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleToggleApi = (api: EpicApiDefinition) => {
    const isSelected = selectedApiIds.includes(api.id) || pendingSelections.has(api.id);
    const isRequired = requiredApiIds.includes(api.id);

    if (isRequired) return; // Can't toggle required APIs

    if (isSelected) {
      // Deselect
      setPendingSelections(prev => {
        const next = new Set(prev);
        next.delete(api.id);
        return next;
      });
    } else {
      // Check for dependencies
      const deps = getApiDependencies(api.id);
      const missingDeps = deps.filter(
        dep => !selectedApiIds.includes(dep.id) && !pendingSelections.has(dep.id)
      );

      if (missingDeps.length > 0) {
        setShowDependencyWarning({ api, dependencies: missingDeps });
      } else {
        setPendingSelections(prev => new Set(prev).add(api.id));
      }
    }
  };

  const handleConfirmWithDependencies = () => {
    if (!showDependencyWarning) return;

    setPendingSelections(prev => {
      const next = new Set(prev);
      next.add(showDependencyWarning.api.id);
      showDependencyWarning.dependencies.forEach(dep => next.add(dep.id));
      return next;
    });
    setShowDependencyWarning(null);
  };

  const handleAddSelected = () => {
    const newApis = Array.from(pendingSelections);
    onAddApis(newApis);
    setPendingSelections(new Set());
    onClose();
  };

  if (!isOpen) return null;

  const totalSelected = selectedApiIds.length + pendingSelections.size;
  const newlySelected = pendingSelections.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-background rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-xl font-semibold">Add Epic FHIR APIs</h2>
            <p className="text-sm text-muted-foreground">
              Select APIs to include ({totalSelected}/{EPIC_API_CATALOG.length} selected)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                // Select all unselected APIs
                const unselected = EPIC_API_CATALOG
                  .filter(api => !selectedApiIds.includes(api.id) && !pendingSelections.has(api.id))
                  .map(api => api.id);
                setPendingSelections(prev => {
                  const next = new Set(prev);
                  unselected.forEach(id => next.add(id));
                  return next;
                });
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border hover:bg-muted transition-colors"
            >
              Select All
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search APIs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                selectedCategory === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              )}
            >
              All
            </button>
            {API_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                  selectedCategory === cat.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* API List */}
        <div className="flex-1 overflow-y-auto p-4">
          {Object.entries(apisByCategory).map(([categoryId, apis]) => {
            const category = API_CATEGORIES.find(c => c.id === categoryId);
            if (!category) return null;

            const colors = COLOR_MAP[category.color] || COLOR_MAP.blue;
            const Icon = category.icon;
            const isExpanded = expandedCategories.has(categoryId);

            return (
              <div key={categoryId} className="mb-4">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(categoryId)}
                  className={cn(
                    'w-full flex items-center gap-2 p-2 rounded-lg transition-colors',
                    'hover:bg-muted/50'
                  )}
                >
                  <div className={cn('p-1.5 rounded-md text-white', colors.bg)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-sm">{category.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({apis.length})
                  </span>
                  <div className="flex-1" />
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {/* APIs */}
                {isExpanded && (
                  <div className="mt-2 space-y-2 pl-2">
                    {apis.map(api => {
                      const isAlreadySelected = selectedApiIds.includes(api.id);
                      const isPending = pendingSelections.has(api.id);
                      const isRequired = requiredApiIds.includes(api.id);
                      const isSelected = isAlreadySelected || isPending;

                      return (
                        <div
                          key={api.id}
                          className={cn(
                            'flex items-start gap-3 p-3 rounded-lg border transition-all',
                            isSelected
                              ? 'border-primary/50 bg-primary/5'
                              : 'border-border hover:border-muted-foreground/30'
                          )}
                        >
                          {/* Checkbox */}
                          <button
                            onClick={() => handleToggleApi(api)}
                            disabled={isRequired || isAlreadySelected}
                            className={cn(
                              'flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                              isSelected
                                ? 'bg-primary border-primary text-primary-foreground'
                                : 'border-muted-foreground/30 hover:border-primary',
                              (isRequired || isAlreadySelected) && 'opacity-60 cursor-not-allowed'
                            )}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                          </button>

                          {/* API Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">
                                {api.displayName}
                              </span>
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                {api.resourceType}
                              </code>
                              {isAlreadySelected && (
                                <span className="text-xs text-primary font-medium">
                                  Included
                                </span>
                              )}
                              {isRequired && (
                                <span className="text-xs text-muted-foreground">
                                  Required
                                </span>
                              )}
                              {isPending && (
                                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                  <Plus className="h-3 w-3" />
                                  Adding
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">
                              {api.description}
                            </p>

                            {/* Generated components preview */}
                            <div className="text-xs text-muted-foreground">
                              <span className="font-medium">Generates: </span>
                              {api.components
                                .slice(0, 2)
                                .map(c => c.name)
                                .join(', ')}
                              {api.components.length > 2 && ` +${api.components.length - 2} more`}
                            </div>

                            {/* Dependencies warning */}
                            {api.requires && api.requires.length > 0 && (
                              <div className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Requires:{' '}
                                {api.requires
                                  .map(id => getApiById(id)?.displayName || id)
                                  .join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {filteredApis.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No APIs match your search</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-muted/30">
          <div className="text-sm text-muted-foreground">
            {totalSelected} APIs selected
            {newlySelected > 0 && (
              <span className="text-green-600 font-medium ml-2">
                (+{newlySelected} new)
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddSelected}
              disabled={newlySelected === 0}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                newlySelected > 0
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              Add {newlySelected} API{newlySelected !== 1 ? 's' : ''}
            </button>
          </div>
        </div>

        {/* Dependency Warning Modal */}
        {showDependencyWarning && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="bg-background rounded-lg shadow-xl p-6 max-w-md mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-full bg-amber-500/20 text-amber-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">Dependencies Required</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                <strong>{showDependencyWarning.api.displayName}</strong> requires
                the following API{showDependencyWarning.dependencies.length > 1 ? 's' : ''}:
              </p>
              <ul className="mb-4 space-y-1">
                {showDependencyWarning.dependencies.map(dep => (
                  <li
                    key={dep.id}
                    className="text-sm flex items-center gap-2 p-2 bg-muted rounded"
                  >
                    <Check className="h-4 w-4 text-green-500" />
                    {dep.displayName}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowDependencyWarning(null)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmWithDependencies}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Add All
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EpicApiPicker;
