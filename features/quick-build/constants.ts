import type { ExamplePrompt } from './types';

export const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    title: 'OCR Scanner',
    description: 'Document text extraction',
    prompt:
      'Create an OCR document scanner app that extracts text from images using local AI. Include drag-and-drop upload, image preview, and copy-to-clipboard for extracted text.',
  },
  {
    title: 'Medical OCR',
    description: 'Clinical document scanner',
    prompt:
      'Create a medical document scanner with OCR that can scan prescriptions, lab results, and clinical notes. Link scanned documents to Epic patient records and show allergies/medications context.',
  },
  {
    title: 'Patient Dashboard',
    description: 'Epic FHIR healthcare',
    prompt:
      'Create a patient dashboard using Epic FHIR APIs. Show patient demographics, vital signs, active medications, allergies, and conditions in a clean clinical interface.',
  },
  {
    title: 'Medication Tracker',
    description: 'Epic medications',
    prompt:
      'Create a medication tracker app using Epic FHIR API. List active medications with dosage instructions, allow searching by patient, and highlight any high-risk medications.',
  },
  {
    title: 'Allergy Checker',
    description: 'Epic allergies',
    prompt:
      'Create an allergy checker app using Epic FHIR API. Show patient allergies with criticality levels, highlight high-risk allergies prominently, and show reaction details.',
  },
  {
    title: 'Patient Lookup',
    description: 'Epic patient search',
    prompt:
      'Create a patient lookup tool using Epic FHIR API. Search for patients and display their demographics, contact info, and basic health summary.',
  },
  {
    title: 'Todo App',
    description: 'Task management',
    prompt:
      'Create a simple todo list app where I can add tasks, mark them complete, and delete them. Store tasks in local state (no database needed).',
  },
  {
    title: 'Calculator',
    description: 'Basic calculator',
    prompt:
      'Create a calculator app with basic operations (add, subtract, multiply, divide) and a clean UI.',
  },
];
