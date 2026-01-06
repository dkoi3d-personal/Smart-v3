// Epic FHIR R4 Type Definitions

export interface Patient {
  resourceType: 'Patient';
  id?: string;
  name?: Array<{
    use?: string;
    text?: string;
    family?: string;
    given?: string[];
  }>;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  telecom?: Array<{
    system?: string;
    value?: string;
    use?: string;
  }>;
  address?: Array<{
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
  }>;
  active?: boolean;
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: { text?: string };
  }>;
}

export interface Observation {
  resourceType: 'Observation';
  id?: string;
  status: string;
  code: { coding?: Array<{ code?: string; display?: string; system?: string }>; text?: string };
  valueQuantity?: { value?: number; unit?: string };
  valueString?: string;
  effectiveDateTime?: string;
  component?: Array<{
    code: { coding?: Array<{ code?: string; display?: string }> };
    valueQuantity?: { value?: number; unit?: string };
  }>;
  interpretation?: Array<{ coding?: Array<{ code?: string; display?: string }> }>;
  referenceRange?: Array<{ low?: { value: number; unit: string }; high?: { value: number; unit: string }; text?: string }>;
}

export interface MedicationRequest {
  resourceType: 'MedicationRequest';
  id?: string;
  status: string;
  intent?: string;
  medicationCodeableConcept?: { coding?: Array<{ display?: string; code?: string }>; text?: string };
  medicationReference?: { display?: string; reference?: string };
  dosageInstruction?: Array<{
    text?: string;
    patientInstruction?: string;
    route?: { text?: string };
    timing?: { repeat?: { frequency?: number; period?: number; periodUnit?: string } };
    doseAndRate?: Array<{ doseQuantity?: { value?: number; unit?: string } }>;
  }>;
  authoredOn?: string;
  requester?: { display?: string; reference?: string };
  dispenseRequest?: { quantity?: { value?: number; unit?: string }; numberOfRepeatsAllowed?: number };
}

export interface AllergyIntolerance {
  resourceType: 'AllergyIntolerance';
  id?: string;
  code?: { coding?: Array<{ display?: string; code?: string }>; text?: string };
  criticality?: 'low' | 'high' | 'unable-to-assess';
  category?: string[];
  clinicalStatus?: { coding?: Array<{ code?: string }> };
  verificationStatus?: { coding?: Array<{ code?: string }> };
  reaction?: Array<{
    manifestation: Array<{ text?: string; coding?: Array<{ display?: string }> }>;
    severity?: string;
  }>;
  onsetDateTime?: string;
  recordedDate?: string;
}

export interface Condition {
  resourceType: 'Condition';
  id?: string;
  code?: { coding?: Array<{ display?: string; code?: string; system?: string }>; text?: string };
  clinicalStatus?: { coding?: Array<{ code?: string }>; text?: string };
  verificationStatus?: { coding?: Array<{ code?: string }> };
  severity?: { text?: string; coding?: Array<{ display?: string }> };
  onsetDateTime?: string;
  recordedDate?: string;
  category?: Array<{ text?: string; coding?: Array<{ display?: string }> }>;
}

export interface DocumentReference {
  resourceType: 'DocumentReference';
  id?: string;
  status: string;
  type?: { coding?: Array<{ display?: string; code?: string }>; text?: string };
  category?: Array<{ coding?: Array<{ display?: string }> }>;
  subject?: { reference?: string };
  date?: string;
  author?: Array<{ display?: string; reference?: string }>;
  content?: Array<{
    attachment?: {
      contentType?: string;
      url?: string;
      data?: string;
      title?: string;
    };
  }>;
  description?: string;
}

export interface FHIRBundle<T> {
  resourceType: 'Bundle';
  type?: string;
  total?: number;
  entry?: Array<{ resource?: T; fullUrl?: string }>;
  link?: Array<{ relation?: string; url?: string }>;
}

export interface EpicConnectionStatus {
  connected: boolean;
  baseUrl?: string;
  tokenExpiry?: string;
  error?: string;
  hint?: string;
}
