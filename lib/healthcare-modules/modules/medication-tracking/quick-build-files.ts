/**
 * Medication Tracking - Quick Build Files
 *
 * Comprehensive medication tracking components with:
 * - Medication list with dosage instructions
 * - High-risk medication alerts (opioids, blood thinners, etc.)
 * - Drug interaction warnings
 * - Adherence tracking
 * - Refill reminders
 */

import { ModuleFile } from '../../types';

// =============================================================================
// TYPES: Medication Types
// =============================================================================

const medicationTypesContent = `/**
 * Medication Tracking Types
 */

export interface Medication {
  id: string;
  name: string;
  genericName?: string;
  brandName?: string;
  dosage: string;
  frequency: string;
  route: 'oral' | 'injection' | 'topical' | 'inhalation' | 'other';
  prescriber?: string;
  startDate?: string;
  endDate?: string;
  lastFilled?: string;
  refillsRemaining?: number;
  daysSupply?: number;
  instructions?: string;
  warnings?: string[];
  status: 'active' | 'discontinued' | 'on-hold' | 'completed';
  category?: MedicationCategory;
  isHighRisk?: boolean;
  highRiskReason?: string[];
}

export type MedicationCategory =
  | 'cardiovascular'
  | 'anticoagulant'
  | 'opioid'
  | 'antibiotic'
  | 'diabetes'
  | 'psychiatric'
  | 'respiratory'
  | 'gastrointestinal'
  | 'other';

export interface DrugInteraction {
  medication1: string;
  medication2: string;
  severity: 'severe' | 'moderate' | 'mild';
  description: string;
  recommendation: string;
}

export interface AdherenceRecord {
  medicationId: string;
  date: string;
  taken: boolean;
  takenAt?: string;
  notes?: string;
}

// High-risk medication keywords
export const HIGH_RISK_MEDICATIONS: Record<string, { category: string; reason: string }> = {
  // Opioids
  'oxycodone': { category: 'opioid', reason: 'Opioid - risk of addiction and overdose' },
  'hydrocodone': { category: 'opioid', reason: 'Opioid - risk of addiction and overdose' },
  'morphine': { category: 'opioid', reason: 'Opioid - risk of addiction and overdose' },
  'fentanyl': { category: 'opioid', reason: 'Opioid - high potency, overdose risk' },
  'tramadol': { category: 'opioid', reason: 'Opioid - risk of seizures and addiction' },
  'codeine': { category: 'opioid', reason: 'Opioid - risk of respiratory depression' },

  // Anticoagulants
  'warfarin': { category: 'anticoagulant', reason: 'Blood thinner - bleeding risk, requires monitoring' },
  'coumadin': { category: 'anticoagulant', reason: 'Blood thinner - bleeding risk, requires monitoring' },
  'heparin': { category: 'anticoagulant', reason: 'Blood thinner - bleeding risk' },
  'enoxaparin': { category: 'anticoagulant', reason: 'Blood thinner - bleeding risk' },
  'lovenox': { category: 'anticoagulant', reason: 'Blood thinner - bleeding risk' },
  'rivaroxaban': { category: 'anticoagulant', reason: 'Blood thinner - bleeding risk' },
  'xarelto': { category: 'anticoagulant', reason: 'Blood thinner - bleeding risk' },
  'apixaban': { category: 'anticoagulant', reason: 'Blood thinner - bleeding risk' },
  'eliquis': { category: 'anticoagulant', reason: 'Blood thinner - bleeding risk' },

  // Insulin
  'insulin': { category: 'diabetes', reason: 'High-alert medication - hypoglycemia risk' },
  'novolog': { category: 'diabetes', reason: 'Rapid-acting insulin - hypoglycemia risk' },
  'humalog': { category: 'diabetes', reason: 'Rapid-acting insulin - hypoglycemia risk' },
  'lantus': { category: 'diabetes', reason: 'Long-acting insulin - hypoglycemia risk' },

  // Chemotherapy
  'methotrexate': { category: 'other', reason: 'Immunosuppressant - requires monitoring' },

  // Digoxin
  'digoxin': { category: 'cardiovascular', reason: 'Narrow therapeutic window - toxicity risk' },

  // Lithium
  'lithium': { category: 'psychiatric', reason: 'Narrow therapeutic window - toxicity risk' },
};

// Common drug interactions
export const COMMON_INTERACTIONS: DrugInteraction[] = [
  {
    medication1: 'warfarin',
    medication2: 'aspirin',
    severity: 'severe',
    description: 'Increased risk of bleeding',
    recommendation: 'Monitor for signs of bleeding. Consider alternative pain reliever.',
  },
  {
    medication1: 'metformin',
    medication2: 'alcohol',
    severity: 'moderate',
    description: 'Increased risk of lactic acidosis',
    recommendation: 'Limit alcohol consumption while taking metformin.',
  },
  {
    medication1: 'ssri',
    medication2: 'nsaid',
    severity: 'moderate',
    description: 'Increased risk of GI bleeding',
    recommendation: 'Consider adding a proton pump inhibitor for GI protection.',
  },
  {
    medication1: 'ace inhibitor',
    medication2: 'potassium',
    severity: 'moderate',
    description: 'Risk of hyperkalemia',
    recommendation: 'Monitor potassium levels regularly.',
  },
  {
    medication1: 'statin',
    medication2: 'grapefruit',
    severity: 'moderate',
    description: 'Increased statin levels, risk of muscle damage',
    recommendation: 'Avoid grapefruit juice while on statin therapy.',
  },
];
`;

// =============================================================================
// HOOK: useMedications
// =============================================================================

const useMedicationsHookContent = `'use client';

import { useState, useEffect } from 'react';
import type { Medication, DrugInteraction } from './types';
import { HIGH_RISK_MEDICATIONS, COMMON_INTERACTIONS } from './types';

interface UseMedicationsResult {
  medications: Medication[];
  loading: boolean;
  error: string | null;
  highRiskMedications: Medication[];
  interactions: DrugInteraction[];
  refetch: () => void;
}

/**
 * Hook to fetch and manage patient medications
 */
export function useMedications(patientId: string | null): UseMedicationsResult {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMedications = async () => {
    if (!patientId) {
      setMedications([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(\`/api/epic/fhir/MedicationRequest?patient=\${patientId}&status=active\`);

      if (!response.ok) {
        throw new Error('Failed to fetch medications');
      }

      const data = await response.json();
      const entries = data.entry || [];

      const meds: Medication[] = entries.map((entry: any) => {
        const resource = entry.resource;
        const medicationName =
          resource.medicationCodeableConcept?.text ||
          resource.medicationCodeableConcept?.coding?.[0]?.display ||
          'Unknown Medication';

        const dosageInstruction = resource.dosageInstruction?.[0];

        // Check if high-risk
        const lowerName = medicationName.toLowerCase();
        const highRiskMatch = Object.entries(HIGH_RISK_MEDICATIONS).find(
          ([key]) => lowerName.includes(key)
        );

        return {
          id: resource.id || \`med-\${Math.random().toString(36).substr(2, 9)}\`,
          name: medicationName,
          dosage: dosageInstruction?.doseAndRate?.[0]?.doseQuantity?.value
            ? \`\${dosageInstruction.doseAndRate[0].doseQuantity.value} \${dosageInstruction.doseAndRate[0].doseQuantity.unit || ''}\`
            : dosageInstruction?.text || 'As directed',
          frequency: dosageInstruction?.timing?.code?.text ||
            dosageInstruction?.timing?.repeat?.frequency
              ? \`\${dosageInstruction.timing.repeat.frequency} times per \${dosageInstruction.timing.repeat.period} \${dosageInstruction.timing.repeat.periodUnit}\`
              : 'As prescribed',
          route: mapRoute(dosageInstruction?.route?.coding?.[0]?.code),
          prescriber: resource.requester?.display,
          startDate: resource.authoredOn,
          status: resource.status || 'active',
          instructions: dosageInstruction?.patientInstruction || dosageInstruction?.text,
          isHighRisk: !!highRiskMatch,
          highRiskReason: highRiskMatch ? [highRiskMatch[1].reason] : undefined,
          category: highRiskMatch ? highRiskMatch[1].category as any : 'other',
        };
      });

      setMedications(meds);
    } catch (err) {
      console.error('Error fetching medications:', err);
      setError(err instanceof Error ? err.message : 'Failed to load medications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedications();
  }, [patientId]);

  // Identify high-risk medications
  const highRiskMedications = medications.filter(m => m.isHighRisk);

  // Check for drug interactions
  const interactions = findInteractions(medications);

  return {
    medications,
    loading,
    error,
    highRiskMedications,
    interactions,
    refetch: fetchMedications,
  };
}

function mapRoute(code: string | undefined): Medication['route'] {
  switch (code) {
    case 'PO':
    case 'oral':
      return 'oral';
    case 'IV':
    case 'IM':
    case 'SC':
      return 'injection';
    case 'TOP':
      return 'topical';
    case 'INH':
      return 'inhalation';
    default:
      return 'other';
  }
}

function findInteractions(medications: Medication[]): DrugInteraction[] {
  const found: DrugInteraction[] = [];
  const medNames = medications.map(m => m.name.toLowerCase());

  for (const interaction of COMMON_INTERACTIONS) {
    const has1 = medNames.some(n => n.includes(interaction.medication1));
    const has2 = medNames.some(n => n.includes(interaction.medication2));

    if (has1 && has2) {
      found.push(interaction);
    }
  }

  return found;
}

export default useMedications;
`;

// =============================================================================
// COMPONENT: MedicationList
// =============================================================================

const medicationListContent = `'use client';

import { useState } from 'react';
import { useMedications } from './useMedications';
import { MedicationCard } from './MedicationCard';
import { HighRiskMedicationAlert } from './HighRiskMedicationAlert';
import { DrugInteractionWarning } from './DrugInteractionWarning';
import { cn } from '@/lib/utils';

interface MedicationListProps {
  patientId: string | null;
  className?: string;
  showHighRiskAlerts?: boolean;
  showInteractionWarnings?: boolean;
}

export function MedicationList({
  patientId,
  className,
  showHighRiskAlerts = true,
  showInteractionWarnings = true,
}: MedicationListProps) {
  const { medications, loading, error, highRiskMedications, interactions, refetch } = useMedications(patientId);
  const [filter, setFilter] = useState<'all' | 'high-risk'>('all');

  if (!patientId) {
    return (
      <div className={cn('bg-gray-50 rounded-lg p-6 text-center text-gray-500', className)}>
        Select a patient to view their medications
      </div>
    );
  }

  if (loading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center justify-between">
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
          <div className="h-8 bg-gray-200 rounded w-24 animate-pulse" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg p-4 shadow animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('bg-red-50 border border-red-200 rounded-lg p-4', className)}>
        <p className="text-red-700 font-medium">Failed to load medications</p>
        <p className="text-red-600 text-sm mt-1">{error}</p>
        <button
          onClick={refetch}
          className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const displayMedications = filter === 'high-risk' ? highRiskMedications : medications;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Medications</h2>
          <p className="text-sm text-gray-500">
            {medications.length} active medication{medications.length !== 1 ? 's' : ''}
            {highRiskMedications.length > 0 && (
              <span className="ml-2 text-amber-600 font-medium">
                ({highRiskMedications.length} high-risk)
              </span>
            )}
          </p>
        </div>

        {/* Filter Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              filter === 'all'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            All
          </button>
          <button
            onClick={() => setFilter('high-risk')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              filter === 'high-risk'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            High Risk ({highRiskMedications.length})
          </button>
        </div>
      </div>

      {/* Alerts Section */}
      {showHighRiskAlerts && highRiskMedications.length > 0 && filter === 'all' && (
        <HighRiskMedicationAlert medications={highRiskMedications} />
      )}

      {showInteractionWarnings && interactions.length > 0 && (
        <DrugInteractionWarning interactions={interactions} />
      )}

      {/* Medication Cards */}
      {displayMedications.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500">
          {filter === 'high-risk'
            ? 'No high-risk medications found'
            : 'No active medications found'}
        </div>
      ) : (
        <div className="grid gap-3">
          {displayMedications.map((medication) => (
            <MedicationCard key={medication.id} medication={medication} />
          ))}
        </div>
      )}
    </div>
  );
}

export default MedicationList;
`;

// =============================================================================
// COMPONENT: MedicationCard
// =============================================================================

const medicationCardContent = `'use client';

import { useState } from 'react';
import type { Medication } from './types';
import { cn } from '@/lib/utils';

interface MedicationCardProps {
  medication: Medication;
  onToggleAdherence?: (taken: boolean) => void;
  className?: string;
}

export function MedicationCard({ medication, onToggleAdherence, className }: MedicationCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'opioid':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'anticoagulant':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'diabetes':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'cardiovascular':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'psychiatric':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRouteIcon = (route: string) => {
    switch (route) {
      case 'oral':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        );
      case 'injection':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        );
      case 'topical':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
        );
      case 'inhalation':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        'bg-white rounded-lg border shadow-sm transition-all',
        medication.isHighRisk ? 'border-l-4 border-l-amber-500' : 'border-gray-200',
        className
      )}
    >
      {/* Main Content */}
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
            medication.isHighRisk ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
          )}>
            {getRouteIcon(medication.route)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900">{medication.name}</h3>
              {medication.isHighRisk && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                  High Risk
                </span>
              )}
              {medication.category && (
                <span className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
                  getCategoryColor(medication.category)
                )}>
                  {medication.category.charAt(0).toUpperCase() + medication.category.slice(1)}
                </span>
              )}
            </div>

            <div className="mt-1 text-sm text-gray-600">
              <span className="font-medium">{medication.dosage}</span>
              <span className="mx-1">•</span>
              <span>{medication.frequency}</span>
            </div>

            {medication.instructions && (
              <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                {medication.instructions}
              </p>
            )}
          </div>

          {/* Expand Icon */}
          <svg
            className={cn(
              'w-5 h-5 text-gray-400 transition-transform',
              expanded && 'rotate-180'
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-gray-100">
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {medication.prescriber && (
              <>
                <dt className="text-gray-500">Prescriber</dt>
                <dd className="text-gray-900">{medication.prescriber}</dd>
              </>
            )}
            {medication.startDate && (
              <>
                <dt className="text-gray-500">Start Date</dt>
                <dd className="text-gray-900">
                  {new Date(medication.startDate).toLocaleDateString()}
                </dd>
              </>
            )}
            {medication.lastFilled && (
              <>
                <dt className="text-gray-500">Last Filled</dt>
                <dd className="text-gray-900">
                  {new Date(medication.lastFilled).toLocaleDateString()}
                </dd>
              </>
            )}
            {medication.refillsRemaining !== undefined && (
              <>
                <dt className="text-gray-500">Refills Remaining</dt>
                <dd className="text-gray-900">{medication.refillsRemaining}</dd>
              </>
            )}
            <dt className="text-gray-500">Route</dt>
            <dd className="text-gray-900 capitalize">{medication.route}</dd>
            <dt className="text-gray-500">Status</dt>
            <dd className="text-gray-900 capitalize">{medication.status}</dd>
          </dl>

          {/* High Risk Warnings */}
          {medication.isHighRisk && medication.highRiskReason && (
            <div className="mt-3 p-3 bg-amber-50 rounded-lg">
              <p className="text-sm font-medium text-amber-800">High-Risk Medication Warning</p>
              <ul className="mt-1 text-sm text-amber-700 list-disc list-inside">
                {medication.highRiskReason.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Adherence Toggle */}
          {onToggleAdherence && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => onToggleAdherence(true)}
                className="flex-1 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-medium"
              >
                Mark as Taken
              </button>
              <button
                onClick={() => onToggleAdherence(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Skip
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MedicationCard;
`;

// =============================================================================
// COMPONENT: HighRiskMedicationAlert
// =============================================================================

const highRiskAlertContent = `'use client';

import type { Medication } from './types';
import { cn } from '@/lib/utils';

interface HighRiskMedicationAlertProps {
  medications: Medication[];
  className?: string;
  onDismiss?: () => void;
}

export function HighRiskMedicationAlert({
  medications,
  className,
  onDismiss
}: HighRiskMedicationAlertProps) {
  if (medications.length === 0) return null;

  const groupedByCategory = medications.reduce((acc, med) => {
    const category = med.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(med);
    return acc;
  }, {} as Record<string, Medication[]>);

  return (
    <div className={cn(
      'bg-amber-50 border border-amber-200 rounded-lg overflow-hidden',
      className
    )}>
      {/* Header */}
      <div className="bg-amber-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="font-semibold text-amber-800">
            High-Risk Medication Alert
          </span>
          <span className="bg-amber-200 text-amber-800 text-xs font-medium px-2 py-0.5 rounded-full">
            {medications.length}
          </span>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-amber-600 hover:text-amber-800"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <p className="text-sm text-amber-700 mb-3">
          This patient is taking medications that require careful monitoring and patient education.
        </p>

        {Object.entries(groupedByCategory).map(([category, meds]) => (
          <div key={category} className="mb-3 last:mb-0">
            <h4 className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">
              {category}
            </h4>
            <ul className="space-y-1">
              {meds.map((med) => (
                <li key={med.id} className="flex items-start gap-2 text-sm">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-amber-900">{med.name}</span>
                    {med.highRiskReason?.[0] && (
                      <span className="text-amber-700"> - {med.highRiskReason[0]}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Action Items */}
        <div className="mt-4 pt-3 border-t border-amber-200">
          <p className="text-xs font-medium text-amber-800 mb-2">Recommended Actions:</p>
          <ul className="text-xs text-amber-700 space-y-1">
            <li className="flex items-center gap-1.5">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Review for potential drug interactions
            </li>
            <li className="flex items-center gap-1.5">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Verify patient understands dosage instructions
            </li>
            <li className="flex items-center gap-1.5">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Document patient education provided
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default HighRiskMedicationAlert;
`;

// =============================================================================
// COMPONENT: DrugInteractionWarning
// =============================================================================

const drugInteractionWarningContent = `'use client';

import type { DrugInteraction } from './types';
import { cn } from '@/lib/utils';

interface DrugInteractionWarningProps {
  interactions: DrugInteraction[];
  className?: string;
}

export function DrugInteractionWarning({ interactions, className }: DrugInteractionWarningProps) {
  if (interactions.length === 0) return null;

  const getSeverityStyles = (severity: DrugInteraction['severity']) => {
    switch (severity) {
      case 'severe':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          icon: 'text-red-500',
          badge: 'bg-red-100 text-red-800',
          text: 'text-red-700',
        };
      case 'moderate':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-200',
          icon: 'text-orange-500',
          badge: 'bg-orange-100 text-orange-800',
          text: 'text-orange-700',
        };
      case 'mild':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          icon: 'text-yellow-500',
          badge: 'bg-yellow-100 text-yellow-800',
          text: 'text-yellow-700',
        };
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
        <h3 className="font-semibold text-gray-900">Drug Interactions Detected</h3>
        <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded-full">
          {interactions.length}
        </span>
      </div>

      {interactions.map((interaction, index) => {
        const styles = getSeverityStyles(interaction.severity);
        return (
          <div
            key={index}
            className={cn(
              'rounded-lg border p-4',
              styles.bg,
              styles.border
            )}
          >
            <div className="flex items-start gap-3">
              <svg className={cn('w-5 h-5 mt-0.5 flex-shrink-0', styles.icon)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900 capitalize">
                    {interaction.medication1}
                  </span>
                  <span className="text-gray-400">+</span>
                  <span className="font-medium text-gray-900 capitalize">
                    {interaction.medication2}
                  </span>
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded', styles.badge)}>
                    {interaction.severity.toUpperCase()}
                  </span>
                </div>
                <p className={cn('mt-1 text-sm', styles.text)}>
                  {interaction.description}
                </p>
                <div className="mt-2 p-2 bg-white/50 rounded text-sm">
                  <span className="font-medium text-gray-700">Recommendation: </span>
                  <span className="text-gray-600">{interaction.recommendation}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default DrugInteractionWarning;
`;

// =============================================================================
// COMPONENT: MedicationSummaryCard
// =============================================================================

const medicationSummaryCardContent = `'use client';

import { useMedications } from './useMedications';
import { cn } from '@/lib/utils';

interface MedicationSummaryCardProps {
  patientId: string | null;
  onClick?: () => void;
  className?: string;
}

/**
 * Compact summary card showing medication overview
 * Great for dashboards and patient summary views
 */
export function MedicationSummaryCard({ patientId, onClick, className }: MedicationSummaryCardProps) {
  const { medications, loading, error, highRiskMedications, interactions } = useMedications(patientId);

  if (!patientId) {
    return null;
  }

  if (loading) {
    return (
      <div className={cn('bg-white rounded-lg p-4 border animate-pulse', className)}>
        <div className="h-5 bg-gray-200 rounded w-32 mb-2" />
        <div className="h-8 bg-gray-200 rounded w-16" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('bg-red-50 rounded-lg p-4 border border-red-200', className)}>
        <p className="text-sm text-red-600">Failed to load medications</p>
      </div>
    );
  }

  const hasAlerts = highRiskMedications.length > 0 || interactions.length > 0;

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-lg p-4 border transition-all',
        onClick && 'cursor-pointer hover:shadow-md hover:border-blue-300',
        hasAlerts && 'border-l-4 border-l-amber-500',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-500">Active Medications</h3>
          <p className="text-2xl font-bold text-gray-900">{medications.length}</p>
        </div>
        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>
      </div>

      {/* Alerts */}
      {hasAlerts && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
          {highRiskMedications.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{highRiskMedications.length} high-risk medication{highRiskMedications.length !== 1 ? 's' : ''}</span>
            </div>
          )}
          {interactions.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <span>{interactions.length} drug interaction{interactions.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MedicationSummaryCard;
`;

// =============================================================================
// INDEX FILE
// =============================================================================

const indexContent = `export { MedicationList } from './MedicationList';
export { MedicationCard } from './MedicationCard';
export { HighRiskMedicationAlert } from './HighRiskMedicationAlert';
export { DrugInteractionWarning } from './DrugInteractionWarning';
export { MedicationSummaryCard } from './MedicationSummaryCard';
export { useMedications } from './useMedications';
export * from './types';
`;

// =============================================================================
// PAGE TEMPLATE
// =============================================================================

const pageTemplateContent = `'use client';

import { useState } from 'react';
import { PatientSearch, PatientBanner } from '@/components/patient';
import { MedicationList, MedicationSummaryCard } from '@/components/medications';

export default function MedicationTrackingPage() {
  const [patientId, setPatientId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 max-w-4xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Medication Tracking
        </h1>

        {/* Patient Search */}
        <div className="mb-6">
          <PatientSearch
            onSelect={setPatientId}
            placeholder="Search for a patient..."
            className="max-w-md"
          />
        </div>

        {patientId && (
          <div className="space-y-6">
            {/* Patient Banner */}
            <PatientBanner patientId={patientId} />

            {/* Medication Summary Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MedicationSummaryCard patientId={patientId} />
            </div>

            {/* Full Medication List */}
            <MedicationList
              patientId={patientId}
              showHighRiskAlerts={true}
              showInteractionWarnings={true}
            />
          </div>
        )}

        {!patientId && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-600 mb-2">
              Track Patient Medications
            </h2>
            <p className="text-gray-500 max-w-md mx-auto">
              Search for a patient to view their active medications, high-risk alerts,
              drug interactions, and dosage instructions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
`;

// =============================================================================
// UTILITY: cn helper (if not already present)
// =============================================================================

const utilsContent = `import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`;

// =============================================================================
// EXPORT FILES
// =============================================================================

export const quickBuildFiles: ModuleFile[] = [
  {
    path: 'lib/utils.ts',
    type: 'util',
    content: utilsContent,
  },
  {
    path: 'components/medications/types.ts',
    type: 'type',
    content: medicationTypesContent,
  },
  {
    path: 'components/medications/useMedications.ts',
    type: 'hook',
    content: useMedicationsHookContent,
  },
  {
    path: 'components/medications/MedicationList.tsx',
    type: 'component',
    content: medicationListContent,
  },
  {
    path: 'components/medications/MedicationCard.tsx',
    type: 'component',
    content: medicationCardContent,
  },
  {
    path: 'components/medications/HighRiskMedicationAlert.tsx',
    type: 'component',
    content: highRiskAlertContent,
  },
  {
    path: 'components/medications/DrugInteractionWarning.tsx',
    type: 'component',
    content: drugInteractionWarningContent,
  },
  {
    path: 'components/medications/MedicationSummaryCard.tsx',
    type: 'component',
    content: medicationSummaryCardContent,
  },
  {
    path: 'components/medications/index.ts',
    type: 'component',
    content: indexContent,
  },
  {
    path: 'app/page.tsx',
    type: 'component',
    content: pageTemplateContent,
  },
];
