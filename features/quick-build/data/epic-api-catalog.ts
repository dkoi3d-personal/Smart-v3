/**
 * Epic FHIR API Catalog
 *
 * Comprehensive definitions of all available Epic APIs
 * including what components/hooks get generated for each.
 */

import type { LucideIcon } from 'lucide-react';
import {
  Users,
  Heart,
  Pill,
  Activity,
  Syringe,
  Stethoscope,
  ImageIcon,
  Calendar,
  Target,
  MessageSquare,
  CreditCard,
  Building2,
} from 'lucide-react';

export interface EpicApiDefinition {
  id: string;
  resourceType: string;
  category: EpicApiCategory;
  subcategory?: string; // e.g., 'vitals' vs 'labs' for Observation
  displayName: string;
  description: string;
  icon: LucideIcon;
  color: string;

  // What we auto-generate
  components: GeneratedComponent[];
  hooks: GeneratedHook[];

  // Capabilities
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canSearch: boolean;

  // Dependencies
  requires?: string[]; // Other API IDs that are required
  enhancedBy?: string[]; // Other APIs that work well together

  // Epic-specific
  exampleQueries: string[];
  sandboxTestData: boolean;
}

export interface GeneratedComponent {
  name: string;
  description: string;
  props?: string[];
}

export interface GeneratedHook {
  name: string;
  description: string;
  returns?: string;
}

export type EpicApiCategory =
  | 'patient'
  | 'clinical'
  | 'medications'
  | 'scheduling'
  | 'documents'
  | 'care'
  | 'billing'
  | 'providers';

export interface CategoryInfo {
  id: EpicApiCategory;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

export const API_CATEGORIES: CategoryInfo[] = [
  {
    id: 'patient',
    name: 'Patient',
    description: 'Patient demographics and identity',
    icon: Users,
    color: 'blue',
  },
  {
    id: 'clinical',
    name: 'Clinical',
    description: 'Conditions, vitals, labs, and observations',
    icon: Activity,
    color: 'purple',
  },
  {
    id: 'medications',
    name: 'Medications',
    description: 'Prescriptions, allergies, and drug info',
    icon: Pill,
    color: 'green',
  },
  {
    id: 'scheduling',
    name: 'Scheduling',
    description: 'Appointments and encounters',
    icon: Calendar,
    color: 'cyan',
  },
  {
    id: 'documents',
    name: 'Documents',
    description: 'Clinical notes, reports, and images',
    icon: ImageIcon,
    color: 'indigo',
  },
  {
    id: 'care',
    name: 'Care Plans',
    description: 'Care plans, goals, and teams',
    icon: Target,
    color: 'pink',
  },
  {
    id: 'billing',
    name: 'Billing',
    description: 'Insurance and claims',
    icon: CreditCard,
    color: 'emerald',
  },
  {
    id: 'providers',
    name: 'Providers',
    description: 'Practitioners and organizations',
    icon: Building2,
    color: 'slate',
  },
];

export const EPIC_API_CATALOG: EpicApiDefinition[] = [
  // ===== PATIENT CATEGORY =====
  {
    id: 'patient',
    resourceType: 'Patient',
    category: 'patient',
    displayName: 'Patient Demographics',
    description: 'Patient identity, contact info, demographics, and preferences',
    icon: Users,
    color: 'blue',
    components: [
      { name: 'PatientBanner', description: 'Header banner with patient name, photo, DOB, MRN' },
      { name: 'PatientCard', description: 'Compact patient info card' },
      { name: 'PatientSearch', description: 'Search patients by name, MRN, DOB' },
      { name: 'PatientDemographics', description: 'Full demographics display' },
    ],
    hooks: [
      { name: 'usePatient', description: 'Fetch single patient by ID', returns: 'Patient' },
      { name: 'usePatientSearch', description: 'Search patients with debouncing', returns: 'Patient[]' },
    ],
    canRead: true,
    canCreate: true,
    canUpdate: false,
    canSearch: true,
    exampleQueries: ['Get patient by ID', 'Search patients by name', 'Get patient contact info'],
    sandboxTestData: true,
  },
  {
    id: 'related-person',
    resourceType: 'RelatedPerson',
    category: 'patient',
    displayName: 'Related People',
    description: 'Family members, caregivers, emergency contacts',
    icon: Users,
    color: 'blue',
    components: [
      { name: 'RelatedPersonList', description: 'List of related people' },
      { name: 'EmergencyContactCard', description: 'Emergency contact display' },
    ],
    hooks: [
      { name: 'useRelatedPersons', description: 'Fetch related people', returns: 'RelatedPerson[]' },
    ],
    canRead: true,
    canCreate: false,
    canUpdate: false,
    canSearch: true,
    requires: ['patient'],
    exampleQueries: ['Get emergency contacts', 'List family members'],
    sandboxTestData: true,
  },

  // ===== CLINICAL CATEGORY =====
  {
    id: 'observation-vitals',
    resourceType: 'Observation',
    category: 'clinical',
    subcategory: 'vitals',
    displayName: 'Vital Signs',
    description: 'Blood pressure, heart rate, temperature, weight, O2 saturation',
    icon: Activity,
    color: 'purple',
    components: [
      { name: 'VitalSignsChart', description: 'Line chart showing vital sign trends' },
      { name: 'VitalSignsCard', description: 'Current vitals display card' },
      { name: 'BloodPressureDisplay', description: 'BP-specific component with ranges' },
    ],
    hooks: [
      { name: 'useVitalSigns', description: 'Fetch vital signs', returns: 'Observation[]' },
    ],
    canRead: true,
    canCreate: true,
    canUpdate: true,
    canSearch: true,
    requires: ['patient'],
    exampleQueries: ['Get vital signs', 'Get BP history', 'Get weight over time'],
    sandboxTestData: true,
  },
  {
    id: 'observation-labs',
    resourceType: 'Observation',
    category: 'clinical',
    subcategory: 'labs',
    displayName: 'Lab Results',
    description: 'CBC, BMP, lipid panels, urinalysis, glucose',
    icon: Activity,
    color: 'purple',
    components: [
      { name: 'LabResultsPanel', description: 'Table of lab results with reference ranges' },
      { name: 'LabTrendChart', description: 'Line chart for lab value trends' },
      { name: 'AbnormalLabAlert', description: 'Highlight abnormal values' },
    ],
    hooks: [
      { name: 'useLabResults', description: 'Fetch lab results', returns: 'Observation[]' },
    ],
    canRead: true,
    canCreate: true,
    canUpdate: true,
    canSearch: true,
    requires: ['patient'],
    enhancedBy: ['diagnostic-report'],
    exampleQueries: ['Get CBC results', 'Get glucose readings', 'View lipid panel'],
    sandboxTestData: true,
  },
  {
    id: 'condition',
    resourceType: 'Condition',
    category: 'clinical',
    displayName: 'Conditions',
    description: 'Active diagnoses, resolved conditions, and problem list items',
    icon: Heart,
    color: 'red',
    components: [
      { name: 'ConditionsList', description: 'List of active/resolved conditions' },
      { name: 'ProblemList', description: 'Problem list display' },
      { name: 'ConditionBadge', description: 'Compact condition indicator' },
    ],
    hooks: [
      { name: 'useConditions', description: 'Fetch patient conditions', returns: 'Condition[]' },
    ],
    canRead: true,
    canCreate: true,
    canUpdate: false,
    canSearch: true,
    requires: ['patient'],
    exampleQueries: ['Get active conditions', 'View problem list', 'Get chronic conditions'],
    sandboxTestData: true,
  },
  {
    id: 'diagnostic-report',
    resourceType: 'DiagnosticReport',
    category: 'clinical',
    displayName: 'Diagnostic Reports',
    description: 'Lab panels, pathology reports, radiology reports',
    icon: Activity,
    color: 'purple',
    components: [
      { name: 'DiagnosticReportViewer', description: 'Full report viewer' },
      { name: 'ReportSummaryCard', description: 'Report summary card' },
    ],
    hooks: [
      { name: 'useDiagnosticReports', description: 'Fetch diagnostic reports', returns: 'DiagnosticReport[]' },
    ],
    canRead: true,
    canCreate: false,
    canUpdate: true,
    canSearch: true,
    requires: ['patient'],
    enhancedBy: ['observation-labs'],
    exampleQueries: ['Get lab panels', 'View pathology reports', 'Get radiology reports'],
    sandboxTestData: true,
  },
  {
    id: 'procedure',
    resourceType: 'Procedure',
    category: 'clinical',
    displayName: 'Procedures',
    description: 'Surgeries, treatments, and clinical procedures performed',
    icon: Stethoscope,
    color: 'orange',
    components: [
      { name: 'ProcedureHistory', description: 'Timeline of procedures' },
      { name: 'ProcedureCard', description: 'Single procedure display' },
    ],
    hooks: [
      { name: 'useProcedures', description: 'Fetch procedures', returns: 'Procedure[]' },
    ],
    canRead: true,
    canCreate: true,
    canUpdate: true,
    canSearch: true,
    requires: ['patient'],
    exampleQueries: ['Get surgical history', 'View recent procedures'],
    sandboxTestData: true,
  },
  {
    id: 'immunization',
    resourceType: 'Immunization',
    category: 'clinical',
    displayName: 'Immunizations',
    description: 'Vaccines administered, dates, lot numbers',
    icon: Syringe,
    color: 'teal',
    components: [
      { name: 'ImmunizationRecord', description: 'Full immunization history' },
      { name: 'VaccineCard', description: 'Single vaccine display' },
      { name: 'ImmunizationTimeline', description: 'Visual timeline of vaccines' },
    ],
    hooks: [
      { name: 'useImmunizations', description: 'Fetch immunizations', returns: 'Immunization[]' },
    ],
    canRead: true,
    canCreate: false,
    canUpdate: false,
    canSearch: true,
    requires: ['patient'],
    exampleQueries: ['Get vaccination history', 'Check COVID vaccine status', 'View flu shot records'],
    sandboxTestData: true,
  },

  // ===== MEDICATIONS CATEGORY =====
  {
    id: 'medication-request',
    resourceType: 'MedicationRequest',
    category: 'medications',
    displayName: 'Medications',
    description: 'Active prescriptions and medication orders',
    icon: Pill,
    color: 'green',
    components: [
      { name: 'MedicationList', description: 'List of active medications' },
      { name: 'MedicationCard', description: 'Single medication with dosage' },
      { name: 'HighRiskMedicationAlert', description: 'Alert for high-risk meds' },
      { name: 'DrugInteractionWarning', description: 'Drug interaction alerts' },
    ],
    hooks: [
      { name: 'useMedications', description: 'Fetch medications', returns: 'MedicationRequest[]' },
    ],
    canRead: true,
    canCreate: false,
    canUpdate: false,
    canSearch: true,
    requires: ['patient'],
    enhancedBy: ['allergy-intolerance'],
    exampleQueries: ['Get active prescriptions', 'View medication history', 'Get dosage instructions'],
    sandboxTestData: true,
  },
  {
    id: 'allergy-intolerance',
    resourceType: 'AllergyIntolerance',
    category: 'medications',
    displayName: 'Allergies',
    description: 'Drug allergies, food allergies, environmental allergies',
    icon: Heart,
    color: 'red',
    components: [
      { name: 'AllergyList', description: 'List of allergies with severity' },
      { name: 'AllergyBadge', description: 'Compact allergy indicator' },
      { name: 'AllergySeverityIcon', description: 'Visual severity indicator' },
    ],
    hooks: [
      { name: 'useAllergies', description: 'Fetch allergies', returns: 'AllergyIntolerance[]' },
    ],
    canRead: true,
    canCreate: true,
    canUpdate: false,
    canSearch: true,
    requires: ['patient'],
    enhancedBy: ['medication-request'],
    exampleQueries: ['Get all allergies', 'Check drug allergies', 'View allergy reactions'],
    sandboxTestData: true,
  },
  {
    id: 'medication-dispense',
    resourceType: 'MedicationDispense',
    category: 'medications',
    displayName: 'Pharmacy Dispense',
    description: 'Pharmacy dispensing records and fill history',
    icon: Pill,
    color: 'green',
    components: [
      { name: 'DispenseHistory', description: 'Fill history list' },
      { name: 'RefillTracker', description: 'Track refills and due dates' },
    ],
    hooks: [
      { name: 'useMedicationDispense', description: 'Fetch dispense records', returns: 'MedicationDispense[]' },
    ],
    canRead: true,
    canCreate: false,
    canUpdate: false,
    canSearch: true,
    requires: ['patient', 'medication-request'],
    exampleQueries: ['Get dispensing history', 'Check last fill date'],
    sandboxTestData: true,
  },

  // ===== SCHEDULING CATEGORY =====
  {
    id: 'appointment',
    resourceType: 'Appointment',
    category: 'scheduling',
    displayName: 'Appointments',
    description: 'Scheduled and past appointments',
    icon: Calendar,
    color: 'cyan',
    components: [
      { name: 'AppointmentList', description: 'List of upcoming/past appointments' },
      { name: 'AppointmentCard', description: 'Single appointment details' },
      { name: 'AppointmentCalendar', description: 'Calendar view of appointments' },
    ],
    hooks: [
      { name: 'useAppointments', description: 'Fetch appointments', returns: 'Appointment[]' },
    ],
    canRead: true,
    canCreate: false,
    canUpdate: false,
    canSearch: true,
    requires: ['patient'],
    enhancedBy: ['practitioner', 'location'],
    exampleQueries: ['Get upcoming appointments', 'View past appointments', 'Check appointment status'],
    sandboxTestData: true,
  },
  {
    id: 'encounter',
    resourceType: 'Encounter',
    category: 'scheduling',
    displayName: 'Encounters',
    description: 'Office visits, hospital stays, ER visits, telehealth',
    icon: Calendar,
    color: 'cyan',
    components: [
      { name: 'EncounterHistory', description: 'Timeline of encounters' },
      { name: 'EncounterSummary', description: 'Visit summary card' },
      { name: 'VisitDetails', description: 'Full visit details' },
    ],
    hooks: [
      { name: 'useEncounters', description: 'Fetch encounters', returns: 'Encounter[]' },
    ],
    canRead: true,
    canCreate: false,
    canUpdate: false,
    canSearch: true,
    requires: ['patient'],
    exampleQueries: ['Get visit history', 'View hospitalizations', 'Check ER visits'],
    sandboxTestData: true,
  },
  {
    id: 'schedule',
    resourceType: 'Schedule',
    category: 'scheduling',
    displayName: 'Schedules',
    description: 'Provider schedules and availability',
    icon: Calendar,
    color: 'cyan',
    components: [
      { name: 'ScheduleViewer', description: 'View provider schedules' },
    ],
    hooks: [
      { name: 'useSchedule', description: 'Fetch schedules', returns: 'Schedule[]' },
    ],
    canRead: true,
    canCreate: false,
    canUpdate: false,
    canSearch: true,
    enhancedBy: ['slot', 'practitioner'],
    exampleQueries: ['Get provider schedule', 'View availability'],
    sandboxTestData: true,
  },
  {
    id: 'slot',
    resourceType: 'Slot',
    category: 'scheduling',
    displayName: 'Available Slots',
    description: 'Available appointment slots for booking',
    icon: Calendar,
    color: 'cyan',
    components: [
      { name: 'SlotPicker', description: 'Select available time slots' },
      { name: 'AvailabilityGrid', description: 'Grid view of available slots' },
    ],
    hooks: [
      { name: 'useAvailableSlots', description: 'Fetch available slots', returns: 'Slot[]' },
    ],
    canRead: true,
    canCreate: false,
    canUpdate: false,
    canSearch: true,
    requires: ['schedule'],
    exampleQueries: ['Get available slots', 'Find open appointments'],
    sandboxTestData: true,
  },

  // ===== DOCUMENTS CATEGORY =====
  {
    id: 'document-reference',
    resourceType: 'DocumentReference',
    category: 'documents',
    displayName: 'Documents',
    description: 'Clinical notes, discharge summaries, consent forms, PDFs',
    icon: ImageIcon,
    color: 'indigo',
    components: [
      { name: 'DocumentList', description: 'List of documents' },
      { name: 'DocumentViewer', description: 'View document content' },
      { name: 'DocumentUpload', description: 'Upload new documents' },
    ],
    hooks: [
      { name: 'useDocuments', description: 'Fetch documents', returns: 'DocumentReference[]' },
    ],
    canRead: true,
    canCreate: true,
    canUpdate: true,
    canSearch: true,
    requires: ['patient'],
    exampleQueries: ['Get clinical notes', 'View discharge summaries', 'Get consent documents'],
    sandboxTestData: true,
  },
  {
    id: 'imaging-study',
    resourceType: 'ImagingStudy',
    category: 'documents',
    displayName: 'Imaging Studies',
    description: 'X-rays, CT scans, MRIs, ultrasounds',
    icon: ImageIcon,
    color: 'indigo',
    components: [
      { name: 'ImagingStudyList', description: 'List of imaging studies' },
      { name: 'ImagingViewer', description: 'DICOM image viewer link' },
    ],
    hooks: [
      { name: 'useImagingStudies', description: 'Fetch imaging studies', returns: 'ImagingStudy[]' },
    ],
    canRead: true,
    canCreate: false,
    canUpdate: false,
    canSearch: true,
    requires: ['patient'],
    exampleQueries: ['Get imaging studies', 'View X-ray records', 'Check MRI history'],
    sandboxTestData: true,
  },

  // ===== CARE PLANS CATEGORY =====
  {
    id: 'care-plan',
    resourceType: 'CarePlan',
    category: 'care',
    displayName: 'Care Plans',
    description: 'Treatment plans, care protocols, wellness plans',
    icon: Target,
    color: 'pink',
    components: [
      { name: 'CarePlanViewer', description: 'Full care plan display' },
      { name: 'CarePlanCard', description: 'Care plan summary card' },
      { name: 'ActivityChecklist', description: 'Care plan activities' },
    ],
    hooks: [
      { name: 'useCarePlan', description: 'Fetch care plans', returns: 'CarePlan[]' },
    ],
    canRead: true,
    canCreate: false,
    canUpdate: false,
    canSearch: true,
    requires: ['patient'],
    enhancedBy: ['goal', 'care-team'],
    exampleQueries: ['Get active care plans', 'View treatment protocols'],
    sandboxTestData: true,
  },
  {
    id: 'goal',
    resourceType: 'Goal',
    category: 'care',
    displayName: 'Goals',
    description: 'Patient health goals and targets',
    icon: Target,
    color: 'pink',
    components: [
      { name: 'GoalsList', description: 'List of health goals' },
      { name: 'GoalProgressCard', description: 'Goal with progress indicator' },
    ],
    hooks: [
      { name: 'useGoals', description: 'Fetch goals', returns: 'Goal[]' },
    ],
    canRead: true,
    canCreate: false,
    canUpdate: false,
    canSearch: true,
    requires: ['patient'],
    enhancedBy: ['care-plan'],
    exampleQueries: ['Get health goals', 'View goal progress'],
    sandboxTestData: true,
  },
  {
    id: 'care-team',
    resourceType: 'CareTeam',
    category: 'care',
    displayName: 'Care Team',
    description: 'Healthcare providers involved in patient care',
    icon: Users,
    color: 'pink',
    components: [
      { name: 'CareTeamList', description: 'List of care team members' },
      { name: 'CareTeamCard', description: 'Care team summary' },
    ],
    hooks: [
      { name: 'useCareTeam', description: 'Fetch care team', returns: 'CareTeam' },
    ],
    canRead: true,
    canCreate: false,
    canUpdate: false,
    canSearch: true,
    requires: ['patient'],
    enhancedBy: ['practitioner'],
    exampleQueries: ['Get care team members', 'View primary care provider'],
    sandboxTestData: true,
  },

  // ===== BILLING CATEGORY =====
  {
    id: 'coverage',
    resourceType: 'Coverage',
    category: 'billing',
    displayName: 'Insurance Coverage',
    description: 'Insurance plans, member IDs, coverage details',
    icon: CreditCard,
    color: 'emerald',
    components: [
      { name: 'InsuranceCard', description: 'Insurance card display' },
      { name: 'CoverageDetails', description: 'Full coverage information' },
    ],
    hooks: [
      { name: 'useCoverage', description: 'Fetch coverage', returns: 'Coverage[]' },
    ],
    canRead: true,
    canCreate: false,
    canUpdate: false,
    canSearch: true,
    requires: ['patient'],
    exampleQueries: ['Get insurance info', 'View coverage details'],
    sandboxTestData: true,
  },
  {
    id: 'explanation-of-benefit',
    resourceType: 'ExplanationOfBenefit',
    category: 'billing',
    displayName: 'Explanation of Benefits',
    description: 'EOB statements showing what insurance paid',
    icon: CreditCard,
    color: 'emerald',
    components: [
      { name: 'EOBViewer', description: 'EOB statement viewer' },
      { name: 'PaymentBreakdown', description: 'Cost breakdown display' },
    ],
    hooks: [
      { name: 'useEOB', description: 'Fetch EOB', returns: 'ExplanationOfBenefit[]' },
    ],
    canRead: true,
    canCreate: false,
    canUpdate: false,
    canSearch: true,
    requires: ['patient'],
    exampleQueries: ['Get EOB statements', 'View payment breakdown'],
    sandboxTestData: true,
  },

  // ===== PROVIDERS CATEGORY =====
  {
    id: 'practitioner',
    resourceType: 'Practitioner',
    category: 'providers',
    displayName: 'Practitioners',
    description: 'Doctors, nurses, and other healthcare providers',
    icon: Building2,
    color: 'slate',
    components: [
      { name: 'PractitionerCard', description: 'Provider info card' },
      { name: 'ProviderDirectory', description: 'Searchable provider list' },
    ],
    hooks: [
      { name: 'usePractitioner', description: 'Fetch practitioner', returns: 'Practitioner' },
    ],
    canRead: true,
    canCreate: false,
    canUpdate: false,
    canSearch: true,
    exampleQueries: ['Get provider details', 'Search by specialty'],
    sandboxTestData: true,
  },
  {
    id: 'organization',
    resourceType: 'Organization',
    category: 'providers',
    displayName: 'Organizations',
    description: 'Hospitals, clinics, insurance companies',
    icon: Building2,
    color: 'slate',
    components: [
      { name: 'OrganizationCard', description: 'Organization info card' },
      { name: 'FacilityDirectory', description: 'Facility list' },
    ],
    hooks: [
      { name: 'useOrganization', description: 'Fetch organization', returns: 'Organization' },
    ],
    canRead: true,
    canCreate: false,
    canUpdate: false,
    canSearch: true,
    exampleQueries: ['Get organization details', 'View facility info'],
    sandboxTestData: true,
  },
  {
    id: 'location',
    resourceType: 'Location',
    category: 'providers',
    displayName: 'Locations',
    description: 'Physical locations, rooms, buildings',
    icon: Building2,
    color: 'slate',
    components: [
      { name: 'LocationCard', description: 'Location with address and map link' },
      { name: 'LocationFinder', description: 'Find nearby locations' },
    ],
    hooks: [
      { name: 'useLocation', description: 'Fetch location', returns: 'Location' },
    ],
    canRead: true,
    canCreate: false,
    canUpdate: false,
    canSearch: true,
    exampleQueries: ['Get location details', 'View address and hours'],
    sandboxTestData: true,
  },
];

// Helper functions
export function getApiById(id: string): EpicApiDefinition | undefined {
  return EPIC_API_CATALOG.find(api => api.id === id);
}

export function getApisByCategory(category: EpicApiCategory): EpicApiDefinition[] {
  return EPIC_API_CATALOG.filter(api => api.category === category);
}

export function getApiDependencies(apiId: string): EpicApiDefinition[] {
  const api = getApiById(apiId);
  if (!api?.requires) return [];
  return api.requires.map(id => getApiById(id)).filter(Boolean) as EpicApiDefinition[];
}

export function resolveAllDependencies(apiIds: string[]): string[] {
  const resolved = new Set<string>();
  const toProcess = [...apiIds];

  while (toProcess.length > 0) {
    const current = toProcess.pop()!;
    if (resolved.has(current)) continue;

    resolved.add(current);
    const api = getApiById(current);
    if (api?.requires) {
      toProcess.push(...api.requires);
    }
  }

  return Array.from(resolved);
}

export function getTotalApiCount(): number {
  return EPIC_API_CATALOG.length;
}
