'use client';

/**
 * Design System Selector Component
 *
 * A dropdown selector for choosing a design system.
 * Used in build pages to select which design system agents should follow.
 */

import { useState, useEffect } from 'react';
import { Paintbrush, Check, ExternalLink } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface DesignSystemListItem {
  id: string;
  name: string;
  isDefault: boolean;
  isBuiltIn: boolean;
}

interface DesignSystemConfig {
  defaultDesignSystemId: string | null;
  projectOverrides: Record<string, string>;
}

interface DesignSystemSelectorProps {
  projectId: string;
  value?: string | null;
  onChange?: (designSystemId: string | null) => void;
  showLabel?: boolean;
  className?: string;
}

export function DesignSystemSelector({
  projectId,
  value,
  onChange,
  showLabel = true,
  className = '',
}: DesignSystemSelectorProps) {
  const [designSystems, setDesignSystems] = useState<DesignSystemListItem[]>([]);
  const [config, setConfig] = useState<DesignSystemConfig | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(value ?? null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch design systems and config
  useEffect(() => {
    async function fetchData() {
      try {
        const [dsResponse, configResponse] = await Promise.all([
          fetch('/api/design-systems'),
          fetch('/api/design-systems/config'),
        ]);

        if (dsResponse.ok) {
          const data = await dsResponse.json();
          setDesignSystems(data);
        }

        if (configResponse.ok) {
          const configData = await configResponse.json();
          setConfig(configData);

          // Set initial selection based on project override or default
          if (!value) {
            const projectOverride = configData.projectOverrides?.[projectId];
            const initialId = projectOverride ?? configData.defaultDesignSystemId;
            setSelectedId(initialId);
          }
        }
      } catch (error) {
        console.error('Failed to fetch design systems:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [projectId, value]);

  // Update selection when value prop changes
  useEffect(() => {
    if (value !== undefined) {
      setSelectedId(value);
    }
  }, [value]);

  // Handle selection change
  const handleChange = async (newValue: string) => {
    const actualValue = newValue === 'use-default' ? null : newValue;
    setSelectedId(actualValue);

    // Call onChange callback
    if (onChange) {
      onChange(actualValue);
    }

    // Save project override
    try {
      await fetch('/api/design-systems/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectOverride: {
            projectId,
            designSystemId: actualValue,
          },
        }),
      });
    } catch (error) {
      console.error('Failed to save design system preference:', error);
    }
  };

  // Get the effective design system (considering defaults)
  const effectiveId = selectedId ?? config?.defaultDesignSystemId ?? null;
  const effectiveDesignSystem = designSystems.find((ds) => ds.id === effectiveId);

  // Determine display value for the select
  const displayValue = selectedId ?? 'use-default';

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {showLabel && (
          <label className="text-sm font-medium flex items-center gap-2">
            <Paintbrush className="h-4 w-4" />
            Design System
          </label>
        )}
        <div className="h-8 w-40 bg-muted animate-pulse rounded-md" />
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium flex items-center gap-2">
            <Paintbrush className="h-4 w-4" />
            Design System
          </label>
          <Link href="/settings/design-systems">
            <Button variant="ghost" size="sm" className="h-6 text-xs">
              <ExternalLink className="h-3 w-3 mr-1" />
              Manage
            </Button>
          </Link>
        </div>
      )}

      <Select value={displayValue} onValueChange={handleChange}>
        <SelectTrigger className="h-8">
          <SelectValue>
            {selectedId === null ? (
              <span className="text-muted-foreground">
                Use Default
                {config?.defaultDesignSystemId && effectiveDesignSystem && (
                  <span className="text-foreground ml-1">
                    ({effectiveDesignSystem.name})
                  </span>
                )}
              </span>
            ) : (
              effectiveDesignSystem?.name || 'Select...'
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="use-default">
            <div className="flex items-center gap-2">
              <span>Use Default</span>
              {config?.defaultDesignSystemId && (
                <span className="text-xs text-muted-foreground">
                  ({designSystems.find((ds) => ds.id === config.defaultDesignSystemId)?.name})
                </span>
              )}
            </div>
          </SelectItem>
          {designSystems.map((ds) => (
            <SelectItem key={ds.id} value={ds.id}>
              <div className="flex items-center gap-2">
                <span>{ds.name}</span>
                {ds.isBuiltIn && (
                  <span className="text-xs text-muted-foreground">(Built-in)</span>
                )}
                {ds.isDefault && (
                  <Check className="h-3 w-3 text-green-500" />
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {effectiveDesignSystem && (
        <p className="text-xs text-muted-foreground">
          Agents will follow {effectiveDesignSystem.name} styling guidelines
        </p>
      )}
    </div>
  );
}
