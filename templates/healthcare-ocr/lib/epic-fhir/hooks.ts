'use client';

import { useState, useEffect, useCallback } from 'react';
import * as api from './client';
import type { Patient, Observation, MedicationRequest, AllergyIntolerance, Condition, DocumentReference } from './types';

export function useEpicConnection() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.checkEpicConnection()
      .then(status => {
        setConnected(status.connected);
        if (!status.connected && status.error) {
          setError(status.error);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return { connected, loading, error };
}

export function usePatient(patientId: string | null) {
  const [data, setData] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!patientId) { setData(null); return; }
    setLoading(true);
    setError(null);
    try {
      const patient = await api.getPatient(patientId);
      setData(patient);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to fetch patient';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, error, refetch };
}

export function useVitalSigns(patientId: string | null) {
  const [data, setData] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) { setData([]); return; }
    setLoading(true);
    api.getObservations(patientId, 'vital-signs')
      .then(bundle => setData(api.extractResources(bundle)))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false));
  }, [patientId]);

  return { data, loading, error };
}

export function useLabResults(patientId: string | null) {
  const [data, setData] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) { setData([]); return; }
    setLoading(true);
    api.getObservations(patientId, 'laboratory')
      .then(bundle => setData(api.extractResources(bundle)))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false));
  }, [patientId]);

  return { data, loading, error };
}

export function useMedications(patientId: string | null) {
  const [data, setData] = useState<MedicationRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) { setData([]); return; }
    setLoading(true);
    api.getMedications(patientId, 'active')
      .then(bundle => setData(api.extractResources(bundle)))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false));
  }, [patientId]);

  return { data, loading, error };
}

export function useAllergies(patientId: string | null) {
  const [data, setData] = useState<AllergyIntolerance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) { setData([]); return; }
    setLoading(true);
    api.getAllergies(patientId)
      .then(bundle => setData(api.extractResources(bundle)))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false));
  }, [patientId]);

  return { data, loading, error };
}

export function useConditions(patientId: string | null) {
  const [data, setData] = useState<Condition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) { setData([]); return; }
    setLoading(true);
    api.getConditions(patientId, 'active')
      .then(bundle => setData(api.extractResources(bundle)))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false));
  }, [patientId]);

  return { data, loading, error };
}

export function useDocuments(patientId: string | null) {
  const [data, setData] = useState<DocumentReference[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) { setData([]); return; }
    setLoading(true);
    api.getDocuments(patientId)
      .then(bundle => setData(api.extractResources(bundle)))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false));
  }, [patientId]);

  return { data, loading, error };
}
