'use client';

import * as React from 'react';
import { Sparkles, Loader2, Undo2 } from 'lucide-react';
import { Textarea } from './textarea';
import { Button } from './button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip';
import { cn } from '@/lib/utils';
import { useAIEnhance } from '@/hooks/useAIEnhance';

export interface AITextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** The controlled value */
  value: string;
  /** Called when value changes */
  onValueChange: (value: string) => void;
  /** Optional context for AI enhancement */
  aiContext?: string;
  /** Show character/word count */
  showCount?: boolean;
  /** Show keyboard shortcut hint */
  showShortcut?: boolean;
  /** Keyboard shortcut label */
  shortcutLabel?: string;
  /** Custom class for the wrapper */
  wrapperClassName?: string;
  /** Border color class for the textarea */
  borderColorClass?: string;
  /** Accent color class for buttons */
  accentColorClass?: string;
}

/**
 * AI-enhanced Textarea with enhance button, character count, and keyboard hints
 *
 * @example
 * ```tsx
 * <AITextarea
 *   value={prompt}
 *   onValueChange={setPrompt}
 *   aiContext="React TypeScript project"
 *   placeholder="Describe what you want to build..."
 *   showCount
 *   showShortcut
 *   shortcutLabel="to build"
 * />
 * ```
 */
export function AITextarea({
  value,
  onValueChange,
  aiContext,
  showCount = true,
  showShortcut = true,
  shortcutLabel = 'to submit',
  wrapperClassName,
  borderColorClass = 'border-indigo-500/30 focus:ring-indigo-500/50',
  accentColorClass = 'text-indigo-400 hover:text-indigo-300',
  className,
  disabled,
  ...props
}: AITextareaProps) {
  const [previousValue, setPreviousValue] = React.useState<string | null>(null);

  const { enhance, isEnhancing, error } = useAIEnhance({
    context: aiContext,
    onSuccess: (enhanced, original) => {
      setPreviousValue(original);
      onValueChange(enhanced);
    },
  });

  const handleEnhance = React.useCallback(async () => {
    if (!value.trim() || isEnhancing || disabled) return;
    await enhance(value);
  }, [value, isEnhancing, disabled, enhance]);

  const handleUndo = React.useCallback(() => {
    if (previousValue !== null) {
      onValueChange(previousValue);
      setPreviousValue(null);
    }
  }, [previousValue, onValueChange]);

  const charCount = value.length;
  const wordCount = value.split(/\s+/).filter(Boolean).length;

  return (
    <div className={cn('relative', wrapperClassName)}>
      <Textarea
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn(
          'bg-background/50 placeholder:text-muted-foreground/40 resize-none pb-12 pr-14',
          borderColorClass,
          className
        )}
        disabled={disabled || isEnhancing}
        {...props}
      />

      {/* AI Enhance button - top right corner */}
      <div className="absolute top-2 right-2 flex items-center gap-1">
        {previousValue !== null && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleUndo}
                  disabled={disabled}
                  className="h-8 w-8 rounded-lg bg-muted/50 hover:bg-muted border border-border/50"
                >
                  <Undo2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Undo enhancement</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleEnhance}
                disabled={disabled || isEnhancing || !value.trim()}
                className={cn(
                  'h-8 w-8 rounded-lg transition-all',
                  isEnhancing
                    ? 'bg-indigo-500/20 border-indigo-500/50'
                    : 'bg-gradient-to-br from-indigo-500/10 to-purple-500/10 hover:from-indigo-500/20 hover:to-purple-500/20 border border-indigo-500/30 hover:border-indigo-500/50',
                  !value.trim() && 'opacity-50 cursor-not-allowed'
                )}
              >
                {isEnhancing ? (
                  <Loader2 className="h-3.5 w-3.5 text-indigo-400 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>{isEnhancing ? 'Enhancing...' : 'AI Enhance'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Bottom bar */}
      <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[10px] text-muted-foreground">
        {showCount && (
          <div className="flex items-center gap-3">
            <span>{charCount} chars</span>
            <span className="text-muted-foreground/50">|</span>
            <span>{wordCount} words</span>
            {error && (
              <>
                <span className="text-muted-foreground/50">|</span>
                <span className="text-red-400">{error}</span>
              </>
            )}
          </div>
        )}
        {showShortcut && (
          <div className="flex items-center gap-1 opacity-60">
            <kbd className="px-1.5 py-0.5 rounded bg-muted/50 border border-border/50 font-mono text-[9px]">
              Ctrl
            </kbd>
            <span>+</span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted/50 border border-border/50 font-mono text-[9px]">
              Enter
            </kbd>
            <span className="ml-1">{shortcutLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}
