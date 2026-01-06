/**
 * Epic FHIR React Hooks
 * Easy-to-use hooks for fetching Epic healthcare data
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  epicClient,
  formatPatientName,
  calculateAge,
  extractBundleResources,
} from './client';
import type {
  Patient,
  Observation,
  Condition,
  MedicationRequest,
  AllergyIntolerance,
  Encounter,
  DiagnosticReport,
  Immunization,
  EpicConnectionStatus,
  FHIRBundle,
} from './types';

// ========================================
// Generic Hook Types
// ========================================

interface UseEpicQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface UseEpicBundleResult<T> extends UseEpicQueryResult<T[]> {
  total: number;
  bundle: FHIRBundle<T> | null;
}

// ========================================
// Connection Status Hook
// ========================================

export function useEpicConnection(): UseEpicQueryResult<EpicConnectionStatus> & {
  isConnected: boolean;
  setToken: (token: string, patientId?: string) => Promise<void>;
  disconnect: () => Promise<void>;
} {
  const [data, setData] = useState<EpicConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await epicClient.getStatus();
      setData(status);
    } catch (err: any) {
      setError(err.error || err.message || 'Failed to get Epic status');
    } finally {
      setLoading(false);
    }
  }, []);

  const setToken = useCallback(async (token: string, patientId?: string) => {
    setLoading(true);
    setError(null);
    try {
      await epicClient.setToken(token, patientId);
      await refetch();
    } catch (err: any) {
      setError(err.error || err.message || 'Failed to set token');
      setLoading(false);
    }
  }, [refetch]);

  const disconnect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await epicClient.disconnect();
      await refetch();
    } catch (err: any) {
      setError(err.error || err.message || 'Failed to disconnect');
      setLoading(false);
    }
  }, [refetch]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    data,
    loading,
    error,
    refetch,
    isConnected: data?.connected ?? false,
    setToken,
    disconnect,
  };
}

// ========================================
// Patient Hooks
// ========================================

export interface PatientData extends Patient {
  displayName: string;
  age: number | null;
}

export function usePatient(patientId: string | null): UseEpicQueryResult<PatientData> {
  const [data, setData] = useState<PatientData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!patientId) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const patient = await epicClient.getPatient(patientId);
      setData({
        ...patient,
        displayName: formatPatientName(patient),
        age: patient.birthDate ? calculateAge(patient.birthDate) : null,
      });
    } catch (err: any) {
      setError(err.error || err.message || 'Failed to fetch patient');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

/**
 * Search patients by name
 * Note: Epic Backend Services apps may not support patient search by name.
 * If you get a 403 error, use sandbox patient IDs directly instead.
 */
export function usePatientSearch(searchTerm: string): UseEpicBundleResult<Patient> & {
  patients: PatientData[];
} {
  const [bundle, setBundle] = useState<FHIRBundle<Patient> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!searchTerm || searchTerm.length < 2) {
      setBundle(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await epicClient.searchPatients({ name: searchTerm, _count: 20 });
      setBundle(result);
    } catch (err: any) {
      const msg = err.error || err.message || '';
      // Check for Epic scope/permission errors
      if (msg.includes('403') || msg.includes('forbidden') || msg.toLowerCase().includes('scope')) {
        setError('Patient search not available. Backend Services apps cannot search by name. Use sandbox patient IDs instead.');
      } else {
        setError(msg || 'Failed to search patients');
      }
      setBundle(null);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    const debounce = setTimeout(refetch, 300);
    return () => clearTimeout(debounce);
  }, [refetch]);

  const patients = bundle ? extractBundleResources(bundle).map(p => ({
    ...p,
    displayName: formatPatientName(p),
    age: p.birthDate ? calculateAge(p.birthDate) : null,
  })) : [];

  return {
    data: patients,
    bundle,
    loading,
    error,
    refetch,
    total: bundle?.total ?? 0,
    patients,
  };
}

// ========================================
// Observation Hooks (Vitals, Labs)
// ========================================

export function useVitalSigns(patientId: string | null, count: number = 10): UseEpicBundleResult<Observation> {
  const [bundle, setBundle] = useState<FHIRBundle<Observation> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!patientId) {
      setBundle(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await epicClient.getVitalSigns(patientId, count);
      setBundle(result);
    } catch (err: any) {
      setError(err.error || err.message || 'Failed to fetch vital signs');
      setBundle(null);
    } finally {
      setLoading(false);
    }
  }, [patientId, count]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    data: bundle ? extractBundleResources(bundle) : [],
    bundle,
    loading,
    error,
    refetch,
    total: bundle?.total ?? 0,
  };
}

export function useLabResults(patientId: string | null, count: number = 20): UseEpicBundleResult<Observation> {
  const [bundle, setBundle] = useState<FHIRBundle<Observation> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!patientId) {
      setBundle(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await epicClient.getLabResults(patientId, count);
      setBundle(result);
    } catch (err: any) {
      setError(err.error || err.message || 'Failed to fetch lab results');
      setBundle(null);
    } finally {
      setLoading(false);
    }
  }, [patientId, count]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    data: bundle ? extractBundleResources(bundle) : [],
    bundle,
    loading,
    error,
    refetch,
    total: bundle?.total ?? 0,
  };
}

// ========================================
// Condition Hooks
// ========================================

export function useConditions(patientId: string | null, activeOnly: boolean = false): UseEpicBundleResult<Condition> {
  const [bundle, setBundle] = useState<FHIRBundle<Condition> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!patientId) {
      setBundle(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = activeOnly
        ? await epicClient.getActiveConditions(patientId)
        : await epicClient.getConditions(patientId);
      setBundle(result);
    } catch (err: any) {
      setError(err.error || err.message || 'Failed to fetch conditions');
      setBundle(null);
    } finally {
      setLoading(false);
    }
  }, [patientId, activeOnly]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    data: bundle ? extractBundleResources(bundle) : [],
    bundle,
    loading,
    error,
    refetch,
    total: bundle?.total ?? 0,
  };
}

// ========================================
// Medication Hooks
// ========================================

export function useMedications(patientId: string | null, activeOnly: boolean = true): UseEpicBundleResult<MedicationRequest> {
  const [bundle, setBundle] = useState<FHIRBundle<MedicationRequest> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!patientId) {
      setBundle(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = activeOnly
        ? await epicClient.getActiveMedications(patientId)
        : await epicClient.getMedicationRequests(patientId);
      setBundle(result);
    } catch (err: any) {
      setError(err.error || err.message || 'Failed to fetch medications');
      setBundle(null);
    } finally {
      setLoading(false);
    }
  }, [patientId, activeOnly]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    data: bundle ? extractBundleResources(bundle) : [],
    bundle,
    loading,
    error,
    refetch,
    total: bundle?.total ?? 0,
  };
}

// ========================================
// Allergy Hooks
// ========================================

export function useAllergies(patientId: string | null): UseEpicBundleResult<AllergyIntolerance> {
  const [bundle, setBundle] = useState<FHIRBundle<AllergyIntolerance> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!patientId) {
      setBundle(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await epicClient.getAllergies(patientId);
      setBundle(result);
    } catch (err: any) {
      setError(err.error || err.message || 'Failed to fetch allergies');
      setBundle(null);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    data: bundle ? extractBundleResources(bundle) : [],
    bundle,
    loading,
    error,
    refetch,
    total: bundle?.total ?? 0,
  };
}

// ========================================
// Encounter Hooks
// ========================================

export function useEncounters(patientId: string | null, count: number = 10): UseEpicBundleResult<Encounter> {
  const [bundle, setBundle] = useState<FHIRBundle<Encounter> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!patientId) {
      setBundle(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await epicClient.getEncounters(patientId, { _count: count });
      setBundle(result);
    } catch (err: any) {
      setError(err.error || err.message || 'Failed to fetch encounters');
      setBundle(null);
    } finally {
      setLoading(false);
    }
  }, [patientId, count]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    data: bundle ? extractBundleResources(bundle) : [],
    bundle,
    loading,
    error,
    refetch,
    total: bundle?.total ?? 0,
  };
}

// ========================================
// Immunization Hooks
// ========================================

export function useImmunizations(patientId: string | null): UseEpicBundleResult<Immunization> {
  const [bundle, setBundle] = useState<FHIRBundle<Immunization> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!patientId) {
      setBundle(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await epicClient.getImmunizations(patientId);
      setBundle(result);
    } catch (err: any) {
      setError(err.error || err.message || 'Failed to fetch immunizations');
      setBundle(null);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    data: bundle ? extractBundleResources(bundle) : [],
    bundle,
    loading,
    error,
    refetch,
    total: bundle?.total ?? 0,
  };
}

// ========================================
// Comprehensive Patient Summary Hook
// ========================================

export interface PatientSummary {
  patient: PatientData | null;
  conditions: Condition[];
  medications: MedicationRequest[];
  allergies: AllergyIntolerance[];
  vitalSigns: Observation[];
  recentEncounters: Encounter[];
  immunizations: Immunization[];
}

export function usePatientSummary(patientId: string | null): {
  data: PatientSummary;
  loading: boolean;
  errors: Record<string, string | null>;
  refetch: () => void;
} {
  const patient = usePatient(patientId);
  const conditions = useConditions(patientId, true);
  const medications = useMedications(patientId, true);
  const allergies = useAllergies(patientId);
  const vitalSigns = useVitalSigns(patientId, 5);
  const encounters = useEncounters(patientId, 5);
  const immunizations = useImmunizations(patientId);

  const loading = patient.loading || conditions.loading || medications.loading ||
    allergies.loading || vitalSigns.loading || encounters.loading || immunizations.loading;

  const errors = {
    patient: patient.error,
    conditions: conditions.error,
    medications: medications.error,
    allergies: allergies.error,
    vitalSigns: vitalSigns.error,
    encounters: encounters.error,
    immunizations: immunizations.error,
  };

  const refetch = useCallback(() => {
    patient.refetch();
    conditions.refetch();
    medications.refetch();
    allergies.refetch();
    vitalSigns.refetch();
    encounters.refetch();
    immunizations.refetch();
  }, [patient, conditions, medications, allergies, vitalSigns, encounters, immunizations]);

  return {
    data: {
      patient: patient.data,
      conditions: conditions.data || [],
      medications: medications.data || [],
      allergies: allergies.data || [],
      vitalSigns: vitalSigns.data || [],
      recentEncounters: encounters.data || [],
      immunizations: immunizations.data || [],
    },
    loading,
    errors,
    refetch,
  };
}
