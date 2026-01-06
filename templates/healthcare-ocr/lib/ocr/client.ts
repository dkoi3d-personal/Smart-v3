// OCR Client - connects to main platform's Ollama API

const API_BASE = '/api/ocr';

export async function checkOllamaStatus(): Promise<{
  available: boolean;
  models: string[];
  ocrCapable: boolean;
  gpuEnabled?: boolean;
  error?: string;
}> {
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) throw new Error('Failed to check Ollama status');
    return res.json();
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return { available: false, models: [], ocrCapable: false, error: message };
  }
}

export async function performOCR(
  imageBase64: string,
  mode: string = 'document',
  customPrompt?: string
): Promise<{ text: string; processingTime: number; model: string; error?: string }> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: imageBase64,
      mode,
      prompt: customPrompt,
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'OCR request failed' }));
    throw new Error(error.error || 'OCR request failed');
  }

  return res.json();
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix if present
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function getOCRPromptForMode(mode: string): string {
  switch (mode) {
    case 'prescription':
      return `Extract all text from this prescription document. Identify and structure:
- Patient name and demographics
- Medication name, dosage, frequency, quantity, refills
- Prescriber name and credentials
- Date written and expiration
- Any special instructions
Format as clear, readable text.`;

    case 'lab-report':
      return `Extract all text from this lab report. Identify and structure:
- Patient name and identifiers
- Test names with results, units, and reference ranges
- Flag any abnormal values (High/Low)
- Collection and report dates
- Ordering physician
Format as clear, readable text.`;

    case 'insurance':
      return `Extract all text from this insurance card. Identify:
- Insurance company name
- Member ID and Group Number
- Plan type
- Subscriber name
- Effective dates
- Copay/Deductible information
- Contact numbers
Format as clear, readable text.`;

    default:
      return `Extract all text from this medical document. Preserve the structure and identify:
- Patient information
- Dates and times
- Diagnoses and conditions
- Medications
- Provider information
- Any important clinical data
Format as clear, readable text.`;
  }
}
