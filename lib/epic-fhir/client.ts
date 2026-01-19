/**
 * Epic FHIR API Client
 * Handles all communication with Epic's FHIR R4 APIs
 */

import type {
  Patient,
  Observation,
  Condition,
  MedicationRequest,
  AllergyIntolerance,
  Encounter,
  DiagnosticReport,
  Procedure,
  Immunization,
  Coverage,
  ExplanationOfBenefit,
  FHIRBundle,
  EpicConnectionStatus,
  EpicAPIError,
} from './types';

const INTERNAL_API_BASE = '/api/epic';

/**
 * Epic FHIR Client - Server-side proxy approach
 * All requests go through our API routes which handle auth
 */
export class EpicFHIRClient {
  private baseUrl: string;

  constructor(baseUrl: string = INTERNAL_API_BASE) {
    this.baseUrl = baseUrl;
  }

  /**
   * Check connection status
   */
  async getStatus(): Promise<EpicConnectionStatus> {
    const response = await fetch(this.baseUrl);
    if (!response.ok) {
      throw await this.handleError(response);
    }
    return response.json();
  }

  /**
   * Set Bearer token manually (from Try It)
   */
  async setToken(token: string, patientId?: string): Promise<{ success: boolean }> {
    const response = await fetch(this.baseUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, patientId }),
    });
    if (!response.ok) {
      throw await this.handleError(response);
    }
    return response.json();
  }

  /**
   * Disconnect (clear token)
   */
  async disconnect(): Promise<{ success: boolean }> {
    const response = await fetch(this.baseUrl, { method: 'DELETE' });
    if (!response.ok) {
      throw await this.handleError(response);
    }
    return response.json();
  }

  // ========================================
  // Patient APIs
  // ========================================

  /**
   * Get patient by FHIR ID
   */
  async getPatient(patientId: string): Promise<Patient> {
    const response = await fetch(`${this.baseUrl}/patient/${patientId}`);
    if (!response.ok) {
      throw await this.handleError(response);
    }
    return response.json();
  }

  /**
   * Search patients
   */
  async searchPatients(params: {
    name?: string;
    family?: string;
    given?: string;
    birthdate?: string;
    gender?: string;
    identifier?: string;
    _count?: number;
  } = {}): Promise<FHIRBundle<Patient>> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    });

    const response = await fetch(`${this.baseUrl}/fhir/Patient?${searchParams}`);
    if (!response.ok) {
      throw await this.handleError(response);
    }
    return response.json();
  }

  // ========================================
  // Observation APIs (Vitals, Labs, etc.)
  // ========================================

  /**
   * Get observations for a patient
   */
  async getObservations(patientId: string, params: {
    category?: 'vital-signs' | 'laboratory' | 'social-history' | 'imaging';
    code?: string;
    date?: string;
    _count?: number;
  } = {}): Promise<FHIRBundle<Observation>> {
    const searchParams = new URLSearchParams({ patient: patientId });
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    });

    const response = await fetch(`${this.baseUrl}/fhir/Observation?${searchParams}`);
    if (!response.ok) {
      throw await this.handleError(response);
    }
    return response.json();
  }

  /**
   * Get vital signs for a patient
   */
  async getVitalSigns(patientId: string, count: number = 10): Promise<FHIRBundle<Observation>> {
    return this.getObservations(patientId, { category: 'vital-signs', _count: count });
  }

  /**
   * Get lab results for a patient
   */
  async getLabResults(patientId: string, count: number = 20): Promise<FHIRBundle<Observation>> {
    return this.getObservations(patientId, { category: 'laboratory', _count: count });
  }

  // ========================================
  // Condition APIs (Problems/Diagnoses)
  // ========================================

  /**
   * Get conditions for a patient
   */
  async getConditions(patientId: string, params: {
    'clinical-status'?: 'active' | 'recurrence' | 'relapse' | 'inactive' | 'remission' | 'resolved';
    category?: string;
    code?: string;
    _count?: number;
  } = {}): Promise<FHIRBundle<Condition>> {
    const searchParams = new URLSearchParams({ patient: patientId });
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    });

    const response = await fetch(`${this.baseUrl}/fhir/Condition?${searchParams}`);
    if (!response.ok) {
      throw await this.handleError(response);
    }
    return response.json();
  }

  /**
   * Get active conditions for a patient
   */
  async getActiveConditions(patientId: string): Promise<FHIRBundle<Condition>> {
    return this.getConditions(patientId, { 'clinical-status': 'active' });
  }

  // ========================================
  // Medication APIs
  // ========================================

  /**
   * Get medication requests for a patient
   */
  async getMedicationRequests(patientId: string, params: {
    status?: 'active' | 'on-hold' | 'cancelled' | 'completed' | 'stopped';
    intent?: string;
    _count?: number;
  } = {}): Promise<FHIRBundle<MedicationRequest>> {
    const searchParams = new URLSearchParams({ patient: patientId });
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    });

    const response = await fetch(`${this.baseUrl}/fhir/MedicationRequest?${searchParams}`);
    if (!response.ok) {
      throw await this.handleError(response);
    }
    return response.json();
  }

  /**
   * Get active medications for a patient
   */
  async getActiveMedications(patientId: string): Promise<FHIRBundle<MedicationRequest>> {
    return this.getMedicationRequests(patientId, { status: 'active' });
  }

  // ========================================
  // Allergy APIs
  // ========================================

  /**
   * Get allergies for a patient
   */
  async getAllergies(patientId: string, params: {
    'clinical-status'?: 'active' | 'inactive' | 'resolved';
    criticality?: 'low' | 'high' | 'unable-to-assess';
    _count?: number;
  } = {}): Promise<FHIRBundle<AllergyIntolerance>> {
    const searchParams = new URLSearchParams({ patient: patientId });
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    });

    const response = await fetch(`${this.baseUrl}/fhir/AllergyIntolerance?${searchParams}`);
    if (!response.ok) {
      throw await this.handleError(response);
    }
    return response.json();
  }

  // ========================================
  // Encounter APIs
  // ========================================

  /**
   * Get encounters for a patient
   */
  async getEncounters(patientId: string, params: {
    status?: 'planned' | 'arrived' | 'in-progress' | 'finished' | 'cancelled';
    date?: string;
    type?: string;
    _count?: number;
  } = {}): Promise<FHIRBundle<Encounter>> {
    const searchParams = new URLSearchParams({ patient: patientId });
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    });

    const response = await fetch(`${this.baseUrl}/fhir/Encounter?${searchParams}`);
    if (!response.ok) {
      throw await this.handleError(response);
    }
    return response.json();
  }

  // ========================================
  // Diagnostic Report APIs
  // ========================================

  /**
   * Get diagnostic reports for a patient
   */
  async getDiagnosticReports(patientId: string, params: {
    category?: string;
    code?: string;
    date?: string;
    status?: string;
    _count?: number;
  } = {}): Promise<FHIRBundle<DiagnosticReport>> {
    const searchParams = new URLSearchParams({ patient: patientId });
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    });

    const response = await fetch(`${this.baseUrl}/fhir/DiagnosticReport?${searchParams}`);
    if (!response.ok) {
      throw await this.handleError(response);
    }
    return response.json();
  }

  // ========================================
  // Procedure APIs
  // ========================================

  /**
   * Get procedures for a patient
   */
  async getProcedures(patientId: string, params: {
    status?: 'preparation' | 'in-progress' | 'completed';
    date?: string;
    code?: string;
    _count?: number;
  } = {}): Promise<FHIRBundle<Procedure>> {
    const searchParams = new URLSearchParams({ patient: patientId });
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    });

    const response = await fetch(`${this.baseUrl}/fhir/Procedure?${searchParams}`);
    if (!response.ok) {
      throw await this.handleError(response);
    }
    return response.json();
  }

  // ========================================
  // Immunization APIs
  // ========================================

  /**
   * Get immunizations for a patient
   */
  async getImmunizations(patientId: string, params: {
    status?: 'completed' | 'entered-in-error' | 'not-done';
    date?: string;
    _count?: number;
  } = {}): Promise<FHIRBundle<Immunization>> {
    const searchParams = new URLSearchParams({ patient: patientId });
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    });

    const response = await fetch(`${this.baseUrl}/fhir/Immunization?${searchParams}`);
    if (!response.ok) {
      throw await this.handleError(response);
    }
    return response.json();
  }

  // ========================================
  // Billing APIs (Coverage, EOB)
  // NOTE: These only work in production - Epic sandbox has no billing data
  // ========================================

  /**
   * Get insurance coverage for a patient
   * WARNING: Epic sandbox does NOT have coverage test data
   */
  async getCoverage(patientId: string, params: {
    status?: 'active' | 'cancelled' | 'draft';
    _count?: number;
  } = {}): Promise<FHIRBundle<Coverage>> {
    const searchParams = new URLSearchParams({ patient: patientId });
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    });

    const response = await fetch(`${this.baseUrl}/fhir/Coverage?${searchParams}`);
    if (!response.ok) {
      throw await this.handleError(response);
    }
    return response.json();
  }

  /**
   * Get active insurance coverage for a patient
   * WARNING: Epic sandbox does NOT have coverage test data
   */
  async getActiveCoverage(patientId: string): Promise<FHIRBundle<Coverage>> {
    return this.getCoverage(patientId, { status: 'active' });
  }

  /**
   * Get Explanation of Benefits for a patient
   * WARNING: Epic sandbox does NOT have EOB test data
   */
  async getExplanationOfBenefits(patientId: string, params: {
    status?: 'active' | 'cancelled' | 'draft';
    created?: string;
    _count?: number;
  } = {}): Promise<FHIRBundle<ExplanationOfBenefit>> {
    const searchParams = new URLSearchParams({ patient: patientId });
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    });

    const response = await fetch(`${this.baseUrl}/fhir/ExplanationOfBenefit?${searchParams}`);
    if (!response.ok) {
      throw await this.handleError(response);
    }
    return response.json();
  }

  // ========================================
  // Generic FHIR Query
  // ========================================

  /**
   * Execute a generic FHIR query
   * Useful for resources not covered by specific methods
   */
  async query<T>(resourceType: string, params: Record<string, string> = {}): Promise<FHIRBundle<T>> {
    const searchParams = new URLSearchParams(params);
    const response = await fetch(`${this.baseUrl}/fhir/${resourceType}?${searchParams}`);
    if (!response.ok) {
      throw await this.handleError(response);
    }
    return response.json();
  }

  /**
   * Get a specific resource by ID
   */
  async getResource<T>(resourceType: string, id: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}/fhir/${resourceType}/${id}`);
    if (!response.ok) {
      throw await this.handleError(response);
    }
    return response.json();
  }

  // ========================================
  // Error Handling
  // ========================================

  private async handleError(response: Response): Promise<EpicAPIError> {
    let details: string | undefined;
    try {
      const data = await response.json();
      details = data.error || data.details || JSON.stringify(data);
    } catch {
      details = await response.text();
    }

    return {
      error: `Epic API Error: ${response.status} ${response.statusText}`,
      details,
      status: response.status,
    };
  }
}

// Default client instance
export const epicClient = new EpicFHIRClient();

// ========================================
// Utility Functions
// ========================================

/**
 * Extract patient name as a readable string
 */
export function formatPatientName(patient: Patient): string {
  if (!patient.name || patient.name.length === 0) {
    return 'Unknown Patient';
  }

  const name = patient.name[0];
  if (name.text) return name.text;

  const parts: string[] = [];
  if (name.prefix) parts.push(...name.prefix);
  if (name.given) parts.push(...name.given);
  if (name.family) parts.push(name.family);
  if (name.suffix) parts.push(...name.suffix);

  return parts.join(' ') || 'Unknown Patient';
}

/**
 * Calculate age from birthdate
 */
export function calculateAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

/**
 * Format FHIR date/datetime to readable string
 */
export function formatFHIRDate(dateString: string | undefined, includeTime: boolean = false): string {
  if (!dateString) return 'Unknown';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  if (includeTime) {
    return date.toLocaleString();
  }
  return date.toLocaleDateString();
}

/**
 * Get display text from CodeableConcept
 */
export function getCodeableConceptDisplay(concept: { text?: string; coding?: Array<{ display?: string; code?: string }> } | undefined): string {
  if (!concept) return 'Unknown';
  if (concept.text) return concept.text;
  if (concept.coding && concept.coding.length > 0) {
    return concept.coding[0].display || concept.coding[0].code || 'Unknown';
  }
  return 'Unknown';
}

/**
 * Extract resources from a FHIR Bundle
 */
export function extractBundleResources<T>(bundle: FHIRBundle<T>): T[] {
  if (!bundle.entry) return [];
  return bundle.entry
    .filter(entry => entry.resource)
    .map(entry => entry.resource as T);
}
