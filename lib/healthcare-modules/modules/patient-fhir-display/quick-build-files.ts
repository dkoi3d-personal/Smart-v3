/**
 * Patient FHIR Display - Quick Build Files
 *
 * Simplified, ready-to-run components for instant deployment.
 * These files are copied directly without modification.
 */

import { ModuleFile } from '../../types';

// =============================================================================
// UTILITY: cn helper
// =============================================================================

const utilsContent = `import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`;

// =============================================================================
// COMPONENT: PatientBanner
// =============================================================================

const patientBannerContent = `'use client';

import { usePatient } from '@/lib/epic-fhir';
import { cn } from '@/lib/utils';

interface PatientBannerProps {
  patientId: string | null;
  className?: string;
}

export function PatientBanner({ patientId, className }: PatientBannerProps) {
  const { data: patient, loading, error } = usePatient(patientId);

  if (!patientId) {
    return (
      <div className={cn('bg-gray-100 rounded-lg p-4 text-gray-500', className)}>
        Select a patient to view their information
      </div>
    );
  }

  if (loading) {
    return (
      <div className={cn('bg-white rounded-lg p-4 shadow animate-pulse', className)}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gray-200 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-6 bg-gray-200 rounded w-48" />
            <div className="h-4 bg-gray-200 rounded w-32" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className={cn('bg-red-50 border border-red-200 rounded-lg p-4 text-red-700', className)}>
        {error || 'Patient not found'}
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-lg p-4 shadow', className)}>
      <div className="flex items-center gap-4">
        {/* Patient Photo/Avatar */}
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xl font-bold">
          {patient.displayName.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </div>

        {/* Patient Info */}
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-gray-900">
            {patient.displayName}
          </h2>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 mt-1">
            <span>
              <span className="text-gray-400">DOB:</span>{' '}
              {patient.birthDate ? new Date(patient.birthDate).toLocaleDateString() : 'Unknown'}
            </span>
            {patient.age !== null && (
              <span>
                <span className="text-gray-400">Age:</span> {patient.age} years
              </span>
            )}
            <span>
              <span className="text-gray-400">Gender:</span>{' '}
              {patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : 'Unknown'}
            </span>
            {patient.identifier?.[0]?.value && (
              <span>
                <span className="text-gray-400">MRN:</span> {patient.identifier[0].value}
              </span>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div className="hidden sm:block">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            Active
          </span>
        </div>
      </div>
    </div>
  );
}

export default PatientBanner;
`;

// =============================================================================
// COMPONENT: PatientSearch
// =============================================================================

const patientSearchContent = `'use client';

import { useState } from 'react';
import { usePatientSearch, type PatientData } from '@/lib/epic-fhir';
import { cn } from '@/lib/utils';

interface PatientSearchProps {
  onSelect: (patientId: string) => void;
  placeholder?: string;
  className?: string;
}

export function PatientSearch({
  onSelect,
  placeholder = 'Search patients by name...',
  className,
}: PatientSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { patients, loading, error } = usePatientSearch(searchTerm);

  const handleSelect = (patient: PatientData) => {
    onSelect(patient.id || '');
    setSearchTerm(patient.displayName);
    setIsOpen(false);
  };

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          aria-label="Search patients"
          aria-expanded={isOpen && patients.length > 0}
          aria-haspopup="listbox"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && searchTerm.length >= 2 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {error ? (
            <div className="p-3 text-sm text-red-600">{error}</div>
          ) : patients.length === 0 && !loading ? (
            <div className="p-3 text-sm text-gray-500">No patients found</div>
          ) : (
            <ul role="listbox">
              {patients.map((patient) => (
                <li
                  key={patient.id}
                  role="option"
                  onClick={() => handleSelect(patient)}
                  className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                >
                  <div className="font-medium text-gray-900">
                    {patient.displayName}
                  </div>
                  <div className="text-sm text-gray-500">
                    {patient.birthDate && (
                      <span>DOB: {new Date(patient.birthDate).toLocaleDateString()}</span>
                    )}
                    {patient.gender && (
                      <span className="ml-2">• {patient.gender}</span>
                    )}
                    {patient.identifier?.[0]?.value && (
                      <span className="ml-2">• MRN: {patient.identifier[0].value}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Click outside handler */}
      {isOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

export default PatientSearch;
`;

// =============================================================================
// COMPONENT: PatientCard
// =============================================================================

const patientCardContent = `'use client';

import { usePatient } from '@/lib/epic-fhir';
import { cn } from '@/lib/utils';

interface PatientCardProps {
  patientId: string;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}

export function PatientCard({
  patientId,
  onClick,
  selected = false,
  className,
}: PatientCardProps) {
  const { data: patient, loading, error } = usePatient(patientId);

  if (loading) {
    return (
      <div className={cn('bg-white rounded-lg p-4 border animate-pulse', className)}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-200 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-32" />
            <div className="h-3 bg-gray-200 rounded w-24" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className={cn('bg-red-50 rounded-lg p-4 border border-red-200 text-red-600 text-sm', className)}>
        {error || 'Failed to load patient'}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-lg p-4 border transition-all',
        onClick && 'cursor-pointer hover:shadow-md hover:border-blue-300',
        selected && 'border-blue-500 ring-2 ring-blue-200',
        className
      )}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium text-sm">
          {patient.displayName.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">
            {patient.displayName}
          </h3>
          <p className="text-sm text-gray-500">
            {patient.birthDate && new Date(patient.birthDate).toLocaleDateString()}
            {patient.age !== null && \` (\${patient.age}y)\`}
          </p>
        </div>

        {/* MRN */}
        {patient.identifier?.[0]?.value && (
          <div className="text-xs text-gray-400">
            {patient.identifier[0].value}
          </div>
        )}
      </div>
    </div>
  );
}

export default PatientCard;
`;

// =============================================================================
// COMPONENT: PatientDemographics
// =============================================================================

const patientDemographicsContent = `'use client';

import { usePatient } from '@/lib/epic-fhir';
import { cn } from '@/lib/utils';

interface PatientDemographicsProps {
  patientId: string | null;
  className?: string;
}

export function PatientDemographics({ patientId, className }: PatientDemographicsProps) {
  const { data: patient, loading, error } = usePatient(patientId);

  if (!patientId) {
    return null;
  }

  if (loading) {
    return (
      <div className={cn('bg-white rounded-lg p-6 shadow animate-pulse', className)}>
        <div className="h-6 bg-gray-200 rounded w-32 mb-4" />
        <div className="grid grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 bg-gray-200 rounded w-16" />
              <div className="h-4 bg-gray-200 rounded w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className={cn('bg-red-50 rounded-lg p-4 text-red-700', className)}>
        {error || 'Failed to load patient demographics'}
      </div>
    );
  }

  const address = patient.address?.[0];
  const phone = patient.telecom?.find(t => t.system === 'phone');
  const email = patient.telecom?.find(t => t.system === 'email');

  return (
    <div className={cn('bg-white rounded-lg p-6 shadow', className)}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Demographics</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DemoField label="Full Name" value={patient.displayName} />
        <DemoField
          label="Date of Birth"
          value={patient.birthDate ? new Date(patient.birthDate).toLocaleDateString() : undefined}
        />
        <DemoField label="Age" value={patient.age !== null ? \`\${patient.age} years\` : undefined} />
        <DemoField
          label="Gender"
          value={patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : undefined}
        />
        <DemoField label="MRN" value={patient.identifier?.[0]?.value} />
        <DemoField label="Phone" value={phone?.value} />
        <DemoField label="Email" value={email?.value} />
        <DemoField
          label="Address"
          value={address ? [
            address.line?.join(', '),
            address.city,
            address.state,
            address.postalCode,
          ].filter(Boolean).join(', ') : undefined}
        />
        <DemoField
          label="Language"
          value={patient.communication?.[0]?.language?.text ||
            patient.communication?.[0]?.language?.coding?.[0]?.display}
        />
        <DemoField
          label="Marital Status"
          value={patient.maritalStatus?.text ||
            patient.maritalStatus?.coding?.[0]?.display}
        />
      </div>
    </div>
  );
}

function DemoField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-gray-900">{value || '—'}</dd>
    </div>
  );
}

export default PatientDemographics;
`;

// =============================================================================
// INDEX FILE
// =============================================================================

const indexContent = `export { PatientBanner } from './PatientBanner';
export { PatientSearch } from './PatientSearch';
export { PatientCard } from './PatientCard';
export { PatientDemographics } from './PatientDemographics';
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
    path: 'components/patient/PatientBanner.tsx',
    type: 'component',
    content: patientBannerContent,
  },
  {
    path: 'components/patient/PatientSearch.tsx',
    type: 'component',
    content: patientSearchContent,
  },
  {
    path: 'components/patient/PatientCard.tsx',
    type: 'component',
    content: patientCardContent,
  },
  {
    path: 'components/patient/PatientDemographics.tsx',
    type: 'component',
    content: patientDemographicsContent,
  },
  {
    path: 'components/patient/index.ts',
    type: 'component',
    content: indexContent,
  },
];
