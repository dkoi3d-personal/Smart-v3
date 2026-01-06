// Healthcare OCR Type Definitions

export interface OCRRequest {
  image: string;  // base64 encoded
  prompt?: string;
  mode: 'document' | 'prescription' | 'lab-report' | 'insurance' | 'general';
}

export interface OCRResponse {
  text: string;
  confidence?: number;
  processingTime: number;
  model: string;
  structuredData?: HealthcareData;
}

export interface HealthcareData {
  documentType?: string;
  patientInfo?: PatientInfo;
  medications?: Medication[];
  diagnoses?: Diagnosis[];
  labResults?: LabResult[];
  insuranceInfo?: InsuranceInfo;
  dates?: DateInfo[];
  providers?: Provider[];
  rawText: string;
}

export interface PatientInfo {
  name?: string;
  dateOfBirth?: string;
  patientId?: string;
  mrn?: string;
  address?: string;
  phone?: string;
}

export interface Medication {
  name: string;
  dosage?: string;
  frequency?: string;
  quantity?: string;
  refills?: string;
  prescriber?: string;
  date?: string;
  ndc?: string;
}

export interface Diagnosis {
  code?: string;
  description: string;
  date?: string;
  type?: 'primary' | 'secondary' | 'admission' | 'discharge';
}

export interface LabResult {
  testName: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  flag?: 'normal' | 'high' | 'low' | 'critical';
  date?: string;
  loincCode?: string;
}

export interface InsuranceInfo {
  provider?: string;
  memberId?: string;
  groupNumber?: string;
  planType?: string;
  effectiveDate?: string;
  copay?: string;
}

export interface DateInfo {
  type: string;
  date: string;
}

export interface Provider {
  name: string;
  role?: string;
  npi?: string;
  facility?: string;
  specialty?: string;
}

export interface OllamaStatus {
  available: boolean;
  models: string[];
  ocrCapable: boolean;
  gpuEnabled?: boolean;
  error?: string;
}
