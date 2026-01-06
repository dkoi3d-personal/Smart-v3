/**
 * AllergiesList Component
 * Displays patient allergies from Epic FHIR
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';
import { getCodeableConceptDisplay, formatFHIRDate, type AllergyIntolerance } from '@/lib/epic-fhir';
import { cn } from '@/lib/utils';

interface AllergiesListProps {
  allergies: AllergyIntolerance[];
  loading?: boolean;
  error?: string | null;
  maxHeight?: string;
  className?: string;
}

export function AllergiesList({
  allergies,
  loading = false,
  error = null,
  maxHeight = '400px',
  className,
}: AllergiesListProps) {
  const criticalityColors: Record<string, string> = {
    high: 'bg-red-100 text-red-700 border-red-200',
    low: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'unable-to-assess': 'bg-gray-100 text-gray-600 border-gray-200',
  };

  const categoryColors: Record<string, string> = {
    food: 'bg-orange-100 text-orange-700',
    medication: 'bg-purple-100 text-purple-700',
    environment: 'bg-green-100 text-green-700',
    biologic: 'bg-blue-100 text-blue-700',
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          Allergies
          {!loading && allergies.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {allergies.length}
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
        ) : allergies.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No known allergies</p>
          </div>
        ) : (
          <ScrollArea style={{ maxHeight }}>
            <div className="space-y-3">
              {allergies.map((allergy, index) => {
                const name = allergy.code
                  ? getCodeableConceptDisplay(allergy.code)
                  : 'Unknown Allergen';

                const clinicalStatus = allergy.clinicalStatus?.coding?.[0]?.code;
                const categories = allergy.category || [];

                // Get reactions
                const reactions = allergy.reaction?.flatMap(r =>
                  r.manifestation.map(m => getCodeableConceptDisplay(m))
                ) || [];

                return (
                  <div
                    key={allergy.id || index}
                    className={cn(
                      'p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors',
                      allergy.criticality === 'high' && 'border-red-300 bg-red-50/50'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{name}</p>
                          {allergy.criticality === 'high' && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {categories.map((cat, i) => (
                            <Badge
                              key={i}
                              className={cn('text-xs', categoryColors[cat] || 'bg-gray-100 text-gray-700')}
                            >
                              {cat}
                            </Badge>
                          ))}
                        </div>
                        {reactions.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Reactions: {reactions.join(', ')}
                          </p>
                        )}
                        {allergy.onsetDateTime && (
                          <p className="text-xs text-muted-foreground">
                            Onset: {formatFHIRDate(allergy.onsetDateTime)}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 items-end shrink-0">
                        {allergy.criticality && (
                          <Badge
                            className={cn(
                              'text-xs',
                              criticalityColors[allergy.criticality] || 'bg-gray-100 text-gray-600'
                            )}
                          >
                            {allergy.criticality}
                          </Badge>
                        )}
                        {clinicalStatus && clinicalStatus !== 'active' && (
                          <Badge variant="outline" className="text-xs">
                            {clinicalStatus}
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
