/**
 * VitalSignsCard Component
 * Displays vital signs observations from Epic FHIR
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Heart, Thermometer, Wind, Scale, Ruler, AlertCircle, Loader2 } from 'lucide-react';
import { getCodeableConceptDisplay, formatFHIRDate, type Observation } from '@/lib/epic-fhir';
import { cn } from '@/lib/utils';

interface VitalSignsCardProps {
  vitals: Observation[];
  loading?: boolean;
  error?: string | null;
  className?: string;
}

// LOINC codes for common vitals
const VITAL_CODES: Record<string, { name: string; icon: typeof Heart; unit: string; color: string }> = {
  '8867-4': { name: 'Heart Rate', icon: Heart, unit: 'bpm', color: 'text-red-500' },
  '9279-1': { name: 'Respiratory Rate', icon: Wind, unit: '/min', color: 'text-blue-500' },
  '8310-5': { name: 'Body Temperature', icon: Thermometer, unit: '°F', color: 'text-orange-500' },
  '85354-9': { name: 'Blood Pressure', icon: Activity, unit: 'mmHg', color: 'text-purple-500' },
  '8480-6': { name: 'Systolic BP', icon: Activity, unit: 'mmHg', color: 'text-purple-500' },
  '8462-4': { name: 'Diastolic BP', icon: Activity, unit: 'mmHg', color: 'text-purple-600' },
  '29463-7': { name: 'Body Weight', icon: Scale, unit: 'kg', color: 'text-green-500' },
  '8302-2': { name: 'Body Height', icon: Ruler, unit: 'cm', color: 'text-teal-500' },
  '59408-5': { name: 'SpO2', icon: Wind, unit: '%', color: 'text-cyan-500' },
  '39156-5': { name: 'BMI', icon: Scale, unit: 'kg/m²', color: 'text-amber-500' },
};

function getVitalInfo(observation: Observation) {
  const code = observation.code.coding?.[0]?.code;
  const display = getCodeableConceptDisplay(observation.code);

  if (code && VITAL_CODES[code]) {
    return { ...VITAL_CODES[code], display };
  }

  // Fallback based on display text
  const displayLower = display.toLowerCase();
  if (displayLower.includes('heart') || displayLower.includes('pulse')) {
    return { ...VITAL_CODES['8867-4'], display };
  }
  if (displayLower.includes('respiratory') || displayLower.includes('breathing')) {
    return { ...VITAL_CODES['9279-1'], display };
  }
  if (displayLower.includes('temperature')) {
    return { ...VITAL_CODES['8310-5'], display };
  }
  if (displayLower.includes('blood pressure') || displayLower.includes('bp')) {
    return { ...VITAL_CODES['85354-9'], display };
  }
  if (displayLower.includes('weight')) {
    return { ...VITAL_CODES['29463-7'], display };
  }
  if (displayLower.includes('height')) {
    return { ...VITAL_CODES['8302-2'], display };
  }
  if (displayLower.includes('oxygen') || displayLower.includes('spo2')) {
    return { ...VITAL_CODES['59408-5'], display };
  }
  if (displayLower.includes('bmi')) {
    return { ...VITAL_CODES['39156-5'], display };
  }

  return { name: display, icon: Activity, unit: '', color: 'text-gray-500', display };
}

function formatVitalValue(observation: Observation): string {
  if (observation.valueQuantity) {
    const value = observation.valueQuantity.value;
    const unit = observation.valueQuantity.unit || '';
    return `${value} ${unit}`.trim();
  }

  if (observation.valueString) {
    return observation.valueString;
  }

  // Handle blood pressure with components
  if (observation.component) {
    const systolic = observation.component.find(c =>
      c.code.coding?.some(coding => coding.code === '8480-6')
    );
    const diastolic = observation.component.find(c =>
      c.code.coding?.some(coding => coding.code === '8462-4')
    );

    if (systolic?.valueQuantity?.value && diastolic?.valueQuantity?.value) {
      return `${systolic.valueQuantity.value}/${diastolic.valueQuantity.value} mmHg`;
    }
  }

  return 'N/A';
}

export function VitalSignsCard({
  vitals,
  loading = false,
  error = null,
  className,
}: VitalSignsCardProps) {
  // Group vitals by type, keeping only the most recent
  const latestVitals = vitals.reduce((acc, vital) => {
    const info = getVitalInfo(vital);
    const existingIndex = acc.findIndex(v => getVitalInfo(v).name === info.name);

    if (existingIndex === -1) {
      acc.push(vital);
    } else {
      // Keep the more recent one
      const existingDate = acc[existingIndex].effectiveDateTime || '';
      const newDate = vital.effectiveDateTime || '';
      if (newDate > existingDate) {
        acc[existingIndex] = vital;
      }
    }
    return acc;
  }, [] as Observation[]);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5 text-green-500" />
          Vital Signs
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
        ) : latestVitals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No vital signs recorded</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {latestVitals.map((vital, index) => {
              const info = getVitalInfo(vital);
              const Icon = info.icon;
              const value = formatVitalValue(vital);
              const date = vital.effectiveDateTime;

              return (
                <div
                  key={vital.id || index}
                  className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={cn('h-4 w-4', info.color)} />
                    <span className="text-xs font-medium text-muted-foreground truncate">
                      {info.name}
                    </span>
                  </div>
                  <p className="text-lg font-bold">{value}</p>
                  {date && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatFHIRDate(date, true)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
