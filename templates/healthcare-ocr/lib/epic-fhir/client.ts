// Epic FHIR API Client

import type {
  Patient,
  Observation,
  MedicationRequest,
  AllergyIntolerance,
  Condition,
  DocumentReference,
  FHIRBundle,
  EpicConnectionStatus,
} from './types';

const API_BASE = '/api/epic';

export async function checkEpicConnection(): Promise<EpicConnectionStatus> {
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) {
      return { connected: false, error: `Failed with status ${res.status}` };
    }
    return res.json();
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return { connected: false, error: message };
  }
}

export async function getPatient(patientId: string): Promise<Patient> {
  const res = await fetch(`${API_BASE}/fhir/Patient/${patientId}`);
  if (!res.ok) throw new Error('Failed to fetch patient');
  return res.json();
}

export async function searchPatients(params: {
  name?: string;
  identifier?: string;
  birthdate?: string;
}): Promise<FHIRBundle<Patient>> {
  const searchParams = new URLSearchParams();
  if (params.name) searchParams.set('name', params.name);
  if (params.identifier) searchParams.set('identifier', params.identifier);
  if (params.birthdate) searchParams.set('birthdate', params.birthdate);

  const res = await fetch(`${API_BASE}/fhir/Patient?${searchParams}`);
  if (!res.ok) throw new Error('Failed to search patients');
  return res.json();
}

export async function getObservations(patientId: string, category?: string): Promise<FHIRBundle<Observation>> {
  const params = new URLSearchParams({ patient: patientId, _count: '50' });
  if (category) params.set('category', category);
  const res = await fetch(`${API_BASE}/fhir/Observation?${params}`);
  if (!res.ok) throw new Error('Failed to fetch observations');
  return res.json();
}

export async function getMedications(patientId: string, status?: string): Promise<FHIRBundle<MedicationRequest>> {
  const params = new URLSearchParams({ patient: patientId });
  if (status) params.set('status', status);
  const res = await fetch(`${API_BASE}/fhir/MedicationRequest?${params}`);
  if (!res.ok) throw new Error('Failed to fetch medications');
  return res.json();
}

export async function getAllergies(patientId: string): Promise<FHIRBundle<AllergyIntolerance>> {
  const res = await fetch(`${API_BASE}/fhir/AllergyIntolerance?patient=${patientId}`);
  if (!res.ok) throw new Error('Failed to fetch allergies');
  return res.json();
}

export async function getConditions(patientId: string, clinicalStatus?: string): Promise<FHIRBundle<Condition>> {
  const params = new URLSearchParams({ patient: patientId });
  if (clinicalStatus) params.set('clinical-status', clinicalStatus);
  const res = await fetch(`${API_BASE}/fhir/Condition?${params}`);
  if (!res.ok) throw new Error('Failed to fetch conditions');
  return res.json();
}

export async function getDocuments(patientId: string): Promise<FHIRBundle<DocumentReference>> {
  const res = await fetch(`${API_BASE}/fhir/DocumentReference?patient=${patientId}&_count=20`);
  if (!res.ok) throw new Error('Failed to fetch documents');
  return res.json();
}

// Utility functions
export function formatPatientName(patient: Patient): string {
  if (!patient.name?.[0]) return 'Unknown Patient';
  const name = patient.name[0];
  if (name.text) return name.text;
  return [name.given?.join(' '), name.family].filter(Boolean).join(' ') || 'Unknown';
}

export function calculateAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function extractResources<T>(bundle: FHIRBundle<T>): T[] {
  return bundle.entry?.filter(e => e.resource).map(e => e.resource as T) || [];
}

export function getMRN(patient: Patient): string | undefined {
  return patient.identifier?.find(id =>
    id.type?.text?.toLowerCase().includes('mrn') ||
    id.system?.toLowerCase().includes('mrn')
  )?.value;
}

export function formatDate(dateString: string | undefined): string {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString();
  } catch {
    return dateString;
  }
}
