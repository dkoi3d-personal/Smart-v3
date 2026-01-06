/**
 * ConditionsList Component
 * Displays patient conditions/diagnoses from Epic FHIR
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Stethoscope, AlertCircle, Loader2 } from 'lucide-react';
import { getCodeableConceptDisplay, formatFHIRDate, type Condition } from '@/lib/epic-fhir';
import { cn } from '@/lib/utils';

interface ConditionsListProps {
  conditions: Condition[];
  loading?: boolean;
  error?: string | null;
  maxHeight?: string;
  className?: string;
}

export function ConditionsList({
  conditions,
  loading = false,
  error = null,
  maxHeight = '400px',
  className,
}: ConditionsListProps) {
  const statusColors: Record<string, string> = {
    active: 'bg-red-100 text-red-700 border-red-200',
    recurrence: 'bg-orange-100 text-orange-700 border-orange-200',
    relapse: 'bg-orange-100 text-orange-700 border-orange-200',
    inactive: 'bg-gray-100 text-gray-600 border-gray-200',
    remission: 'bg-green-100 text-green-700 border-green-200',
    resolved: 'bg-blue-100 text-blue-700 border-blue-200',
  };

  const severityColors: Record<string, string> = {
    severe: 'bg-red-500 text-white',
    moderate: 'bg-yellow-500 text-white',
    mild: 'bg-green-500 text-white',
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-red-500" />
          Conditions
          {!loading && conditions.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {conditions.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-600 py-4">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">{error}</span>
          </div>
        ) : conditions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Stethoscope className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No conditions on record</p>
          </div>
        ) : (
          <ScrollArea style={{ maxHeight }}>
            <div className="space-y-3">
              {conditions.map((condition, index) => {
                const name = condition.code
                  ? getCodeableConceptDisplay(condition.code)
                  : 'Unknown Condition';

                const clinicalStatus = condition.clinicalStatus?.coding?.[0]?.code ||
                  condition.clinicalStatus?.text;

                const severity = condition.severity
                  ? getCodeableConceptDisplay(condition.severity).toLowerCase()
                  : null;

                const category = condition.category?.[0]
                  ? getCodeableConceptDisplay(condition.category[0])
                  : null;

                const onset = condition.onsetDateTime || condition.onsetString;

                return (
                  <div
                    key={condition.id || index}
                    className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{name}</p>
                        {category && (
                          <p className="text-xs text-muted-foreground mt-1">{category}</p>
                        )}
                        {onset && (
                          <p className="text-xs text-muted-foreground">
                            Onset: {formatFHIRDate(onset)}
                          </p>
                        )}
                        {condition.note?.[0]?.text && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {condition.note[0].text}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 items-end shrink-0">
                        {clinicalStatus && (
                          <Badge
                            className={cn(
                              'text-xs',
                              statusColors[clinicalStatus] || 'bg-gray-100 text-gray-600'
                            )}
                          >
                            {clinicalStatus}
                          </Badge>
                        )}
                        {severity && (
                          <Badge
                            className={cn(
                              'text-xs',
                              severityColors[severity] || 'bg-gray-500 text-white'
                            )}
                          >
                            {severity}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
