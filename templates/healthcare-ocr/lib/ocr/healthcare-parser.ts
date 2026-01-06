// Healthcare Data Parser - extracts structured data from OCR text

import type { HealthcareData, Medication, LabResult, PatientInfo, Diagnosis } from './types';

export function parseHealthcareText(text: string, documentType?: string): HealthcareData {
  const result: HealthcareData = {
    rawText: text,
    documentType: documentType || detectDocumentType(text),
  };

  // Extract patient information
  result.patientInfo = extractPatientInfo(text);

  // Extract medications
  result.medications = extractMedications(text);

  // Extract lab results
  result.labResults = extractLabResults(text);

  // Extract diagnoses
  result.diagnoses = extractDiagnoses(text);

  // Extract dates
  result.dates = extractDates(text);

  // Extract providers
  result.providers = extractProviders(text);

  return result;
}

function detectDocumentType(text: string): string {
  const lower = text.toLowerCase();

  if (lower.includes('prescription') || lower.includes('rx') || lower.includes('dispense')) {
    return 'Prescription';
  }
  if (lower.includes('lab result') || lower.includes('laboratory') || lower.includes('specimen')) {
    return 'Lab Report';
  }
  if (lower.includes('insurance') || lower.includes('member id') || lower.includes('group number')) {
    return 'Insurance Card';
  }
  if (lower.includes('discharge') || lower.includes('summary')) {
    return 'Discharge Summary';
  }
  if (lower.includes('radiology') || lower.includes('x-ray') || lower.includes('mri') || lower.includes('ct scan')) {
    return 'Radiology Report';
  }
  if (lower.includes('pathology') || lower.includes('biopsy')) {
    return 'Pathology Report';
  }
  if (lower.includes('progress note') || lower.includes('office visit')) {
    return 'Progress Note';
  }
  if (lower.includes('operative') || lower.includes('surgery')) {
    return 'Operative Report';
  }

  return 'Medical Document';
}

function extractPatientInfo(text: string): PatientInfo | undefined {
  const info: PatientInfo = {};

  // Patient name patterns
  const namePatterns = [
    /patient[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
    /name[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
    /patient name[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
  ];

  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match) {
      info.name = match[1].trim();
      break;
    }
  }

  // Date of birth
  const dobPatterns = [
    /(?:dob|date of birth|birth date)[:\s]+([\d\/\-]+)/i,
    /(?:dob|date of birth)[:\s]+(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
  ];

  for (const pattern of dobPatterns) {
    const match = text.match(pattern);
    if (match) {
      info.dateOfBirth = match[1].trim();
      break;
    }
  }

  // Patient ID / MRN
  const idPatterns = [
    /(?:mrn|medical record|patient id|id)[:#\s]+([A-Z0-9\-]+)/i,
    /(?:mrn|medical record number)[:\s]+([\d]+)/i,
  ];

  for (const pattern of idPatterns) {
    const match = text.match(pattern);
    if (match) {
      info.patientId = match[1].trim();
      break;
    }
  }

  return Object.keys(info).length > 0 ? info : undefined;
}

function extractMedications(text: string): Medication[] {
  const medications: Medication[] = [];
  const lines = text.split('\n');

  // Common medication patterns
  const medPatterns = [
    // Drug name followed by dosage
    /([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g|units?))/gi,
    // Rx pattern
    /Rx[:\s]+([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g))/gi,
  ];

  for (const line of lines) {
    for (const pattern of medPatterns) {
      pattern.lastIndex = 0; // Reset regex
      const match = pattern.exec(line);
      if (match) {
        const med: Medication = {
          name: match[1].trim(),
          dosage: match[2].trim(),
        };

        // Try to extract frequency
        const freqMatch = line.match(/(?:take|give)?\s*(\d+)\s*(?:time[s]?)?\s*(?:daily|per day|bid|tid|qid|prn|as needed)/i);
        if (freqMatch) {
          med.frequency = freqMatch[0].trim();
        }

        // Try to extract quantity
        const qtyMatch = line.match(/(?:qty|quantity|#)[:\s]*(\d+)/i);
        if (qtyMatch) {
          med.quantity = qtyMatch[1];
        }

        // Try to extract refills
        const refillMatch = line.match(/(?:refill[s]?)[:\s]*(\d+)/i);
        if (refillMatch) {
          med.refills = refillMatch[1];
        }

        medications.push(med);
        break;
      }
    }
  }

  return medications;
}

function extractLabResults(text: string): LabResult[] {
  const results: LabResult[] = [];
  const lines = text.split('\n');

  // Common lab test patterns
  const labPatterns = [
    // Test: value unit (reference)
    /([A-Za-z\s]+)[:\s]+([\d\.]+)\s*([A-Za-z\/]+)?\s*(?:\(([^)]+)\))?/,
    // Test value unit flag
    /([A-Za-z\s]{3,})\s+([\d\.]+)\s*([A-Za-z\/]+)?\s*(H|L|HH|LL|\*)?/,
  ];

  const commonLabTests = [
    'glucose', 'hemoglobin', 'hematocrit', 'wbc', 'rbc', 'platelets',
    'sodium', 'potassium', 'chloride', 'co2', 'bun', 'creatinine',
    'calcium', 'protein', 'albumin', 'bilirubin', 'ast', 'alt',
    'alkaline', 'cholesterol', 'triglycerides', 'hdl', 'ldl', 'a1c',
    'tsh', 't3', 't4', 'psa', 'inr', 'pt', 'ptt', 'egfr',
  ];

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Check if line contains a known lab test
    const hasLabTest = commonLabTests.some(test => lower.includes(test));
    if (!hasLabTest) continue;

    for (const pattern of labPatterns) {
      const match = line.match(pattern);
      if (match) {
        const result: LabResult = {
          testName: match[1].trim(),
          value: match[2],
          unit: match[3]?.trim(),
          referenceRange: match[4]?.trim(),
        };

        // Determine flag
        if (match[4]) {
          const flag = match[4].toUpperCase();
          if (flag === 'H' || flag === 'HH') result.flag = 'high';
          else if (flag === 'L' || flag === 'LL') result.flag = 'low';
          else if (flag.includes('CRITICAL')) result.flag = 'critical';
        }

        results.push(result);
        break;
      }
    }
  }

  return results;
}

function extractDiagnoses(text: string): Diagnosis[] {
  const diagnoses: Diagnosis[] = [];

  // ICD-10 code pattern
  const icdPattern = /([A-Z]\d{2}(?:\.\d{1,4})?)\s*[-:]?\s*([^\n]+)/g;

  let match;
  while ((match = icdPattern.exec(text)) !== null) {
    diagnoses.push({
      code: match[1],
      description: match[2].trim(),
    });
  }

  // Also look for "Diagnosis:" sections
  const diagSection = text.match(/(?:diagnosis|diagnoses|impression)[:\s]+([^\n]+(?:\n[^\n]+)*)/i);
  if (diagSection) {
    const lines = diagSection[1].split('\n').filter(l => l.trim());
    for (const line of lines) {
      if (!diagnoses.find(d => line.includes(d.description))) {
        diagnoses.push({ description: line.trim() });
      }
    }
  }

  return diagnoses;
}

function extractDates(text: string): { type: string; date: string }[] {
  const dates: { type: string; date: string }[] = [];

  const datePatterns = [
    { type: 'Date of Service', pattern: /(?:date of service|dos|service date)[:\s]+([\d\/\-]+)/i },
    { type: 'Collection Date', pattern: /(?:collection date|collected)[:\s]+([\d\/\-]+)/i },
    { type: 'Report Date', pattern: /(?:report date|reported)[:\s]+([\d\/\-]+)/i },
    { type: 'Admission Date', pattern: /(?:admission date|admitted)[:\s]+([\d\/\-]+)/i },
    { type: 'Discharge Date', pattern: /(?:discharge date|discharged)[:\s]+([\d\/\-]+)/i },
    { type: 'Date Written', pattern: /(?:date written|written)[:\s]+([\d\/\-]+)/i },
    { type: 'Effective Date', pattern: /(?:effective date|effective)[:\s]+([\d\/\-]+)/i },
  ];

  for (const { type, pattern } of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      dates.push({ type, date: match[1].trim() });
    }
  }

  return dates;
}

function extractProviders(text: string): { name: string; role?: string; npi?: string }[] {
  const providers: { name: string; role?: string; npi?: string }[] = [];

  const providerPatterns = [
    { role: 'Ordering Physician', pattern: /(?:ordering physician|ordered by)[:\s]+(?:dr\.?\s*)?([A-Za-z\s,]+)/i },
    { role: 'Attending Physician', pattern: /(?:attending physician|attending)[:\s]+(?:dr\.?\s*)?([A-Za-z\s,]+)/i },
    { role: 'Prescriber', pattern: /(?:prescriber|prescribed by)[:\s]+(?:dr\.?\s*)?([A-Za-z\s,]+)/i },
    { role: 'Provider', pattern: /(?:provider|physician)[:\s]+(?:dr\.?\s*)?([A-Za-z\s,]+)/i },
    { role: 'Referring Physician', pattern: /(?:referring physician|referred by)[:\s]+(?:dr\.?\s*)?([A-Za-z\s,]+)/i },
  ];

  for (const { role, pattern } of providerPatterns) {
    const match = text.match(pattern);
    if (match) {
      const name = match[1].trim().replace(/,.*$/, ''); // Remove credentials after comma
      if (!providers.find(p => p.name === name)) {
        const provider: { name: string; role?: string; npi?: string } = { name, role };

        // Look for NPI near the provider
        const npiMatch = text.match(new RegExp(`${name}[^]*?npi[:#\\s]*(\\d{10})`, 'i'));
        if (npiMatch) {
          provider.npi = npiMatch[1];
        }

        providers.push(provider);
      }
    }
  }

  return providers;
}
