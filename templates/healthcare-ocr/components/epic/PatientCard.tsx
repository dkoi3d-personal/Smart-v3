'use client';

import { formatPatientName, calculateAge, getMRN, type Patient } from '@/lib/epic-fhir';
import { cn } from '@/lib/utils';

interface Props {
  patient: Patient | null;
  loading?: boolean;
  error?: string | null;
  compact?: boolean;
}

export function PatientCard({ patient, loading, error, compact }: Props) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          <div className="flex-1">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-6 border border-red-200 dark:border-red-800">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border text-center">
        <p className="text-gray-500">No patient selected</p>
      </div>
    );
  }

  const name = formatPatientName(patient);
  const age = patient.birthDate ? calculateAge(patient.birthDate) : null;
  const mrn = getMRN(patient);

  if (compact) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
          {name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{name}</p>
          <p className="text-xs text-gray-500">
            {[patient.gender, age && `${age}y`, mrn && `MRN: ${mrn}`].filter(Boolean).join(' • ')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xl">
          {name.charAt(0)}
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-semibold">{name}</h3>
          <div className="flex flex-wrap gap-2 mt-2">
            {patient.gender && (
              <span className={cn(
                "px-2 py-0.5 rounded text-xs font-medium",
                patient.gender === 'male' ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300"
              )}>
                {patient.gender}
              </span>
            )}
            {age && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                {age} years old
              </span>
            )}
            {mrn && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                MRN: {mrn}
              </span>
            )}
          </div>
          {patient.birthDate && (
            <p className="text-sm text-gray-500 mt-2">DOB: {patient.birthDate}</p>
          )}
          {patient.telecom?.[0]?.value && (
            <p className="text-sm text-gray-500">Phone: {patient.telecom[0].value}</p>
          )}
        </div>
      </div>
    </div>
  );
}
