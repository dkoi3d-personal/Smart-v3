/**
 * MedicationsList Component
 * Displays a list of medications from Epic FHIR
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pill, AlertCircle, Loader2 } from 'lucide-react';
import { getCodeableConceptDisplay, type MedicationRequest } from '@/lib/epic-fhir';
import { cn } from '@/lib/utils';

interface MedicationsListProps {
  medications: MedicationRequest[];
  loading?: boolean;
  error?: string | null;
  maxHeight?: string;
  className?: string;
}

export function MedicationsList({
  medications,
  loading = false,
  error = null,
  maxHeight = '400px',
  className,
}: MedicationsListProps) {
  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700 border-green-200',
    'on-hold': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    cancelled: 'bg-gray-100 text-gray-700 border-gray-200',
    completed: 'bg-blue-100 text-blue-700 border-blue-200',
    stopped: 'bg-red-100 text-red-700 border-red-200',
    draft: 'bg-gray-100 text-gray-500 border-gray-200',
    unknown: 'bg-gray-100 text-gray-500 border-gray-200',
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Pill className="h-5 w-5 text-blue-500" />
          Medications
          {!loading && medications.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {medications.length}
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
        ) : medications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Pill className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No medications on record</p>
          </div>
        ) : (
          <ScrollArea style={{ maxHeight }}>
            <div className="space-y-3">
              {medications.map((med, index) => {
                const name = med.medicationReference?.display ||
                  (med.medicationCodeableConcept ? getCodeableConceptDisplay(med.medicationCodeableConcept) : null) ||
                  'Unknown Medication';

                const dosageText = med.dosageInstruction?.[0]?.text ||
                  med.dosageInstruction?.[0]?.patientInstruction;

                const route = med.dosageInstruction?.[0]?.route
                  ? getCodeableConceptDisplay(med.dosageInstruction[0].route)
                  : null;

                return (
                  <div
                    key={med.id || index}
                    className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{name}</p>
                        {dosageText && (
                          <p className="text-xs text-muted-foreground mt-1">{dosageText}</p>
                        )}
                        {route && (
                          <p className="text-xs text-muted-foreground">Route: {route}</p>
                        )}
                        {med.authoredOn && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Prescribed: {new Date(med.authoredOn).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <Badge
                        className={cn(
                          'text-xs shrink-0',
                          statusColors[med.status] || statusColors.unknown
                        )}
                      >
                        {med.status}
                      </Badge>
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
