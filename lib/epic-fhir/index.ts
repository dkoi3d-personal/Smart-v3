/**
 * Epic FHIR Library
 * Complete toolkit for building healthcare apps with Epic's FHIR R4 APIs
 */

// Client
export { EpicFHIRClient, epicClient } from './client';

// Utility functions
export {
  formatPatientName,
  calculateAge,
  formatFHIRDate,
  getCodeableConceptDisplay,
  extractBundleResources,
} from './client';

// React Hooks
export {
  useEpicConnection,
  usePatient,
  usePatientSearch,
  useVitalSigns,
  useLabResults,
  useConditions,
  useMedications,
  useAllergies,
  useEncounters,
  useImmunizations,
  usePatientSummary,
} from './hooks';

// Types
export type {
  // Core FHIR
  FHIRResource,
  FHIRBundle,
  HumanName,
  Address,
  ContactPoint,
  Period,
  Identifier,
  Reference,
  CodeableConcept,
  Coding,
  Quantity,
  Annotation,
  Attachment,

  // Resources
  Patient,
  PatientContact,
  PatientCommunication,
  PatientLink,
  Observation,
  ObservationReferenceRange,
  ObservationComponent,
  Condition,
  ConditionStage,
  ConditionEvidence,
  MedicationRequest,
  Dosage,
  DosageDoseAndRate,
  MedicationRequestDispenseRequest,
  MedicationRequestSubstitution,
  AllergyIntolerance,
  AllergyIntoleranceReaction,
  Encounter,
  EncounterStatusHistory,
  EncounterClassHistory,
  EncounterParticipant,
  EncounterDiagnosis,
  EncounterHospitalization,
  EncounterLocation,
  DiagnosticReport,
  DiagnosticReportMedia,
  Procedure,
  ProcedurePerformer,
  ProcedureFocalDevice,
  Immunization,
  ImmunizationPerformer,
  ImmunizationEducation,
  ImmunizationReaction,
  ImmunizationProtocolApplied,

  // API Types
  EpicAPIError,
  EpicConnectionStatus,
} from './types';

// Hook result types
export type { PatientData, PatientSummary } from './hooks';
