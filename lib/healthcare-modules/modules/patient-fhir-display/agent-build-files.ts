/**
 * Patient FHIR Display - Agent Build Files
 *
 * Full-featured components with customization points for AI agents.
 * These files include markers for where customization should happen.
 */

import { ModuleFile } from '../../types';

// =============================================================================
// UTILITY: cn helper
// =============================================================================

const utilsContent = `import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility for merging Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date for display
 * CUSTOMIZATION: Adjust date format based on locale requirements
 */
export function formatDate(date: string | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString();
}

/**
 * Format a phone number for display
 * CUSTOMIZATION: Adjust format based on region
 */
export function formatPhone(phone: string | undefined): string {
  if (!phone) return '—';
  // Basic US format
  const cleaned = phone.replace(/\\D/g, '');
  if (cleaned.length === 10) {
    return \`(\${cleaned.slice(0, 3)}) \${cleaned.slice(3, 6)}-\${cleaned.slice(6)}\`;
  }
  return phone;
}
`;

// =============================================================================
// COMPONENT: PatientBanner (Full Version)
// =============================================================================

const patientBannerContent = `'use client';

import { usePatient } from '@/lib/epic-fhir';
import { cn, formatDate } from '@/lib/utils';

/**
 * Patient Banner Props
 * CUSTOMIZATION: Add additional props as needed
 */
interface PatientBannerProps {
  patientId: string | null;
  className?: string;
  /** Show action buttons (schedule, message, etc.) */
  showActions?: boolean;
  /** Callback when schedule button clicked */
  onSchedule?: () => void;
  /** Callback when message button clicked */
  onMessage?: () => void;
  /** Compact mode for smaller displays */
  compact?: boolean;
}

/**
 * Patient Banner Component
 *
 * Displays patient header with photo, demographics, and optional actions.
 *
 * CUSTOMIZATION POINTS:
 * 1. Colors: Update bg-* and text-* classes for your design system
 * 2. Layout: Adjust flex/grid structure for your layout needs
 * 3. Fields: Add/remove demographic fields displayed
 * 4. Actions: Add custom action buttons via showActions + callbacks
 */
export function PatientBanner({
  patientId,
  className,
  showActions = false,
  onSchedule,
  onMessage,
  compact = false,
}: PatientBannerProps) {
  const { data: patient, loading, error } = usePatient(patientId);

  // CUSTOMIZATION: Update empty state message
  if (!patientId) {
    return (
      <div className={cn(
        'rounded-lg p-4 text-center',
        'bg-gray-100 text-gray-500', // CUSTOMIZE: Empty state colors
        className
      )}>
        Select a patient to view their information
      </div>
    );
  }

  // CUSTOMIZATION: Update loading skeleton
  if (loading) {
    return (
      <div className={cn(
        'rounded-lg p-4 animate-pulse',
        'bg-white shadow', // CUSTOMIZE: Loading state background
        className
      )}>
        <div className="flex items-center gap-4">
          <div className={cn(
            'rounded-full bg-gray-200',
            compact ? 'w-12 h-12' : 'w-16 h-16'
          )} />
          <div className="flex-1 space-y-2">
            <div className="h-6 bg-gray-200 rounded w-48" />
            <div className="h-4 bg-gray-200 rounded w-32" />
          </div>
        </div>
      </div>
    );
  }

  // CUSTOMIZATION: Update error state
  if (error || !patient) {
    return (
      <div className={cn(
        'rounded-lg p-4',
        'bg-red-50 border border-red-200 text-red-700', // CUSTOMIZE: Error colors
        className
      )}>
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span>{error || 'Patient not found'}</span>
        </div>
      </div>
    );
  }

  // Extract identifier (MRN)
  const mrn = patient.identifier?.find(
    id => id.type?.coding?.some(c => c.code === 'MR')
  )?.value || patient.identifier?.[0]?.value;

  return (
    <div className={cn(
      'rounded-lg shadow',
      'bg-white', // CUSTOMIZE: Banner background
      compact ? 'p-3' : 'p-4',
      className
    )}>
      <div className="flex items-center gap-4">
        {/* Patient Photo/Avatar */}
        {/* CUSTOMIZATION: Replace with actual photo if available */}
        <div className={cn(
          'rounded-full flex items-center justify-center font-bold',
          'bg-blue-100 text-blue-600', // CUSTOMIZE: Avatar colors
          compact ? 'w-12 h-12 text-base' : 'w-16 h-16 text-xl'
        )}>
          {patient.displayName
            .split(' ')
            .map(n => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()}
        </div>

        {/* Patient Info */}
        <div className="flex-1 min-w-0">
          <h2 className={cn(
            'font-semibold text-gray-900 truncate',
            compact ? 'text-lg' : 'text-xl'
          )}>
            {patient.displayName}
          </h2>

          {/* Demographics Row */}
          {/* CUSTOMIZATION: Add/remove fields as needed */}
          <div className={cn(
            'flex flex-wrap gap-x-4 gap-y-1 text-gray-600',
            compact ? 'text-xs mt-0.5' : 'text-sm mt-1'
          )}>
            {patient.birthDate && (
              <span>
                <span className="text-gray-400">DOB:</span>{' '}
                {formatDate(patient.birthDate)}
              </span>
            )}

            {patient.age !== null && (
              <span>
                <span className="text-gray-400">Age:</span>{' '}
                {patient.age} years
              </span>
            )}

            {patient.gender && (
              <span>
                <span className="text-gray-400">Gender:</span>{' '}
                {patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}
              </span>
            )}

            {mrn && (
              <span>
                <span className="text-gray-400">MRN:</span>{' '}
                {mrn}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {/* CUSTOMIZATION: Add your own action buttons */}
        {showActions && (
          <div className="hidden sm:flex items-center gap-2">
            {onSchedule && (
              <button
                onClick={onSchedule}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  'bg-blue-600 text-white hover:bg-blue-700' // CUSTOMIZE: Button colors
                )}
              >
                Schedule
              </button>
            )}
            {onMessage && (
              <button
                onClick={onMessage}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  'bg-gray-100 text-gray-700 hover:bg-gray-200' // CUSTOMIZE: Secondary button
                )}
              >
                Message
              </button>
            )}
          </div>
        )}

        {/* Status Badge */}
        {/* CUSTOMIZATION: Show different statuses */}
        {!showActions && (
          <div className="hidden sm:block">
            <span className={cn(
              'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
              'bg-green-100 text-green-800' // CUSTOMIZE: Status badge colors
            )}>
              Active
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default PatientBanner;
`;

// =============================================================================
// COMPONENT: PatientSearch (Full Version)
// =============================================================================

const patientSearchContent = `'use client';

import { useState, useRef, useEffect } from 'react';
import { usePatientSearch, type PatientData } from '@/lib/epic-fhir';
import { cn, formatDate } from '@/lib/utils';

/**
 * Patient Search Props
 * CUSTOMIZATION: Add additional props as needed
 */
interface PatientSearchProps {
  /** Callback when a patient is selected */
  onSelect: (patientId: string, patient?: PatientData) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
  /** Label for accessibility */
  label?: string;
  /** Show label visually */
  showLabel?: boolean;
  /** Minimum characters before search */
  minChars?: number;
  /** Auto-focus on mount */
  autoFocus?: boolean;
}

/**
 * Patient Search Component
 *
 * Typeahead search for finding patients with FHIR API.
 *
 * CUSTOMIZATION POINTS:
 * 1. Search behavior: Adjust minChars, debounce timing
 * 2. Result display: Modify how results are rendered
 * 3. Keyboard navigation: Add arrow key support
 * 4. Styling: Update colors and layout
 */
export function PatientSearch({
  onSelect,
  placeholder = 'Search patients by name...',
  className,
  label = 'Patient Search',
  showLabel = false,
  minChars = 2,
  autoFocus = false,
}: PatientSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const { patients, loading, error } = usePatientSearch(
    searchTerm.length >= minChars ? searchTerm : ''
  );

  // Auto-focus if requested
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Reset highlight when results change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [patients]);

  const handleSelect = (patient: PatientData) => {
    onSelect(patient.id || '', patient);
    setSearchTerm(patient.displayName);
    setIsOpen(false);
  };

  // CUSTOMIZATION: Add keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || patients.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < patients.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleSelect(patients[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div className={cn('relative', className)}>
      {/* Label */}
      <label
        htmlFor="patient-search"
        className={cn(
          'block text-sm font-medium text-gray-700 mb-1',
          !showLabel && 'sr-only'
        )}
      >
        {label}
      </label>

      {/* Search Input */}
      <div className="relative">
        {/* Search Icon */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <input
          ref={inputRef}
          id="patient-search"
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            'w-full pl-10 pr-10 py-2 rounded-lg outline-none transition-all',
            'border border-gray-300', // CUSTOMIZE: Border color
            'focus:ring-2 focus:ring-blue-500 focus:border-blue-500', // CUSTOMIZE: Focus ring
            'placeholder:text-gray-400'
          )}
          aria-label={label}
          aria-expanded={isOpen && patients.length > 0}
          aria-haspopup="listbox"
          aria-controls="patient-search-results"
          aria-activedescendant={
            highlightedIndex >= 0 ? \`patient-option-\${highlightedIndex}\` : undefined
          }
          autoComplete="off"
        />

        {/* Loading Spinner */}
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className={cn(
              'w-5 h-5 border-2 rounded-full animate-spin',
              'border-blue-500 border-t-transparent' // CUSTOMIZE: Spinner color
            )} />
          </div>
        )}

        {/* Clear Button */}
        {searchTerm && !loading && (
          <button
            onClick={() => {
              setSearchTerm('');
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Clear search"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && searchTerm.length >= minChars && (
        <div className={cn(
          'absolute z-50 w-full mt-1 rounded-lg shadow-lg overflow-hidden',
          'bg-white border border-gray-200', // CUSTOMIZE: Dropdown background
          'max-h-64 overflow-y-auto'
        )}>
          {error ? (
            <div className="p-3 text-sm text-red-600">{error}</div>
          ) : patients.length === 0 && !loading ? (
            <div className="p-3 text-sm text-gray-500">
              No patients found matching "{searchTerm}"
            </div>
          ) : (
            <ul
              ref={listRef}
              id="patient-search-results"
              role="listbox"
              aria-label="Patient search results"
            >
              {patients.map((patient, index) => (
                <li
                  key={patient.id}
                  id={\`patient-option-\${index}\`}
                  role="option"
                  aria-selected={index === highlightedIndex}
                  onClick={() => handleSelect(patient)}
                  className={cn(
                    'p-3 cursor-pointer border-b border-gray-100 last:border-0 transition-colors',
                    index === highlightedIndex
                      ? 'bg-blue-50' // CUSTOMIZE: Highlight color
                      : 'hover:bg-gray-50'
                  )}
                >
                  {/* CUSTOMIZATION: Modify result item layout */}
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium',
                      'bg-blue-100 text-blue-600' // CUSTOMIZE: Avatar colors
                    )}>
                      {patient.displayName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {patient.displayName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {patient.birthDate && (
                          <span>DOB: {formatDate(patient.birthDate)}</span>
                        )}
                        {patient.gender && (
                          <span className="ml-2">• {patient.gender}</span>
                        )}
                        {patient.identifier?.[0]?.value && (
                          <span className="ml-2">• MRN: {patient.identifier[0].value}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export default PatientSearch;
`;

// =============================================================================
// COMPONENT: PatientCard (Full Version)
// =============================================================================

const patientCardContent = `'use client';

import { usePatient } from '@/lib/epic-fhir';
import { cn, formatDate } from '@/lib/utils';

/**
 * Patient Card Props
 * CUSTOMIZATION: Add additional props as needed
 */
interface PatientCardProps {
  patientId: string;
  /** Click handler */
  onClick?: () => void;
  /** Whether this card is selected */
  selected?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Show additional details */
  showDetails?: boolean;
}

/**
 * Patient Card Component
 *
 * Compact card view for patient lists.
 *
 * CUSTOMIZATION POINTS:
 * 1. Layout: Adjust for your list/grid needs
 * 2. Fields: Show more/fewer patient attributes
 * 3. Interaction: Add hover effects, selection styles
 */
export function PatientCard({
  patientId,
  onClick,
  selected = false,
  className,
  showDetails = false,
}: PatientCardProps) {
  const { data: patient, loading, error } = usePatient(patientId);

  if (loading) {
    return (
      <div className={cn(
        'rounded-lg p-4 border animate-pulse',
        'bg-white', // CUSTOMIZE: Loading background
        className
      )}>
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
      <div className={cn(
        'rounded-lg p-4 border text-sm',
        'bg-red-50 border-red-200 text-red-600', // CUSTOMIZE: Error colors
        className
      )}>
        {error || 'Failed to load patient'}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-lg p-4 border transition-all',
        'bg-white', // CUSTOMIZE: Card background
        onClick && 'cursor-pointer hover:shadow-md hover:border-blue-300',
        selected && 'border-blue-500 ring-2 ring-blue-200', // CUSTOMIZE: Selected state
        className
      )}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm',
          'bg-blue-100 text-blue-600' // CUSTOMIZE: Avatar colors
        )}>
          {patient.displayName.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">
            {patient.displayName}
          </h3>
          <p className="text-sm text-gray-500">
            {patient.birthDate && formatDate(patient.birthDate)}
            {patient.age !== null && \` (\${patient.age}y)\`}
          </p>
        </div>

        {/* MRN */}
        {patient.identifier?.[0]?.value && (
          <div className="text-xs text-gray-400 text-right">
            <div className="text-gray-300">MRN</div>
            <div>{patient.identifier[0].value}</div>
          </div>
        )}
      </div>

      {/* Additional Details */}
      {/* CUSTOMIZATION: Add more patient info */}
      {showDetails && (
        <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-sm">
          {patient.gender && (
            <div>
              <span className="text-gray-400">Gender: </span>
              <span className="text-gray-700">
                {patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}
              </span>
            </div>
          )}
          {patient.telecom?.find(t => t.system === 'phone') && (
            <div>
              <span className="text-gray-400">Phone: </span>
              <span className="text-gray-700">
                {patient.telecom.find(t => t.system === 'phone')?.value}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PatientCard;
`;

// =============================================================================
// INDEX FILE
// =============================================================================

const indexContent = `export { PatientBanner } from './PatientBanner';
export { PatientSearch } from './PatientSearch';
export { PatientCard } from './PatientCard';
`;

// =============================================================================
// EXPORT FILES
// =============================================================================

export const agentBuildFiles: ModuleFile[] = [
  {
    path: 'lib/utils.ts',
    type: 'util',
    content: utilsContent,
    customizationPoints: [
      { line: 14, description: 'Date format can be adjusted for locale', example: 'date.toLocaleDateString("en-GB")' },
      { line: 22, description: 'Phone format can be adjusted for region', example: 'Add international format support' },
    ],
  },
  {
    path: 'components/patient/PatientBanner.tsx',
    type: 'component',
    content: patientBannerContent,
    customizationPoints: [
      { line: 35, description: 'Empty state colors and message' },
      { line: 48, description: 'Loading skeleton styling' },
      { line: 67, description: 'Error state colors and icon' },
      { line: 87, description: 'Avatar colors - update for design system' },
      { line: 104, description: 'Demographics fields - add/remove as needed' },
      { line: 134, description: 'Action buttons - add custom actions' },
    ],
  },
  {
    path: 'components/patient/PatientSearch.tsx',
    type: 'component',
    content: patientSearchContent,
    customizationPoints: [
      { line: 73, description: 'Input border and focus ring colors' },
      { line: 85, description: 'Loading spinner colors' },
      { line: 115, description: 'Dropdown background and border' },
      { line: 131, description: 'Result item highlight color' },
      { line: 139, description: 'Avatar colors in results' },
    ],
  },
  {
    path: 'components/patient/PatientCard.tsx',
    type: 'component',
    content: patientCardContent,
    customizationPoints: [
      { line: 42, description: 'Card background and hover states' },
      { line: 44, description: 'Selected state ring color' },
      { line: 54, description: 'Avatar colors' },
      { line: 75, description: 'Additional details section - add more fields' },
    ],
  },
  {
    path: 'components/patient/index.ts',
    type: 'component',
    content: indexContent,
  },
];
