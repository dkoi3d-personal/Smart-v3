'use client';

import type { HealthcareData } from '@/lib/ocr';
import { cn } from '@/lib/utils';

interface Props {
  data: HealthcareData | null;
  loading?: boolean;
}

export function HealthcareDataCard({ data, loading }: Props) {
  if (loading) {
    return <div className="animate-pulse bg-gray-100 dark:bg-gray-800 rounded-xl h-48"></div>;
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Document Type */}
      {data.documentType && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Document Type</span>
          <p className="text-lg font-semibold">{data.documentType}</p>
        </div>
      )}

      {/* Patient Info */}
      {data.patientInfo && Object.keys(data.patientInfo).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <span>👤</span> Patient Information
          </h4>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            {data.patientInfo.name && (
              <>
                <dt className="text-gray-500">Name</dt>
                <dd className="font-medium">{data.patientInfo.name}</dd>
              </>
            )}
            {data.patientInfo.dateOfBirth && (
              <>
                <dt className="text-gray-500">DOB</dt>
                <dd className="font-medium">{data.patientInfo.dateOfBirth}</dd>
              </>
            )}
            {data.patientInfo.patientId && (
              <>
                <dt className="text-gray-500">MRN/ID</dt>
                <dd className="font-medium">{data.patientInfo.patientId}</dd>
              </>
            )}
          </dl>
        </div>
      )}

      {/* Medications */}
      {data.medications && data.medications.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <span>💊</span> Medications
            <span className="ml-auto bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs px-2 py-0.5 rounded-full">
              {data.medications.length}
            </span>
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {data.medications.map((med, i) => (
              <div key={i} className="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="font-medium">{med.name}</p>
                <p className="text-sm text-gray-500">
                  {[med.dosage, med.frequency, med.quantity && `Qty: ${med.quantity}`].filter(Boolean).join(' • ')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lab Results */}
      {data.labResults && data.labResults.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <span>🔬</span> Lab Results
            <span className="ml-auto bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-xs px-2 py-0.5 rounded-full">
              {data.labResults.length}
            </span>
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {data.labResults.map((result, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="text-sm">{result.testName}</span>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "font-medium",
                    result.flag === 'high' && "text-red-600",
                    result.flag === 'low' && "text-blue-600",
                    result.flag === 'critical' && "text-red-600 font-bold"
                  )}>
                    {result.value} {result.unit}
                  </span>
                  {result.flag && result.flag !== 'normal' && (
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded",
                      result.flag === 'high' && "bg-red-100 text-red-700",
                      result.flag === 'low' && "bg-blue-100 text-blue-700",
                      result.flag === 'critical' && "bg-red-200 text-red-800"
                    )}>
                      {result.flag.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diagnoses */}
      {data.diagnoses && data.diagnoses.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <span>🏥</span> Diagnoses
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {data.diagnoses.map((dx, i) => (
              <div key={i} className="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="font-medium">{dx.description}</p>
                {dx.code && <p className="text-xs text-gray-500">Code: {dx.code}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Providers */}
      {data.providers && data.providers.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <span>👨‍⚕️</span> Providers
          </h4>
          <div className="space-y-2">
            {data.providers.map((provider, i) => (
              <div key={i} className="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="font-medium">{provider.name}</p>
                <p className="text-xs text-gray-500">
                  {[provider.role, provider.npi && `NPI: ${provider.npi}`].filter(Boolean).join(' • ')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dates */}
      {data.dates && data.dates.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <span>📅</span> Dates
          </h4>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            {data.dates.map((d, i) => (
              <div key={i}>
                <dt className="text-gray-500">{d.type}</dt>
                <dd className="font-medium">{d.date}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
