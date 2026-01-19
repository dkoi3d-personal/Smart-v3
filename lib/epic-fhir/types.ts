/**
 * Epic FHIR R4 Type Definitions
 * Based on HL7 FHIR R4 spec used by Epic
 */

// Core FHIR types
export interface FHIRResource {
  resourceType: string;
  id?: string;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
    source?: string;
    profile?: string[];
  };
}

export interface FHIRBundle<T = FHIRResource> {
  resourceType: 'Bundle';
  id?: string;
  type: 'searchset' | 'collection' | 'document' | 'message' | 'transaction' | 'transaction-response' | 'batch' | 'batch-response' | 'history';
  total?: number;
  link?: Array<{
    relation: string;
    url: string;
  }>;
  entry?: Array<{
    fullUrl?: string;
    resource?: T;
    search?: {
      mode?: 'match' | 'include' | 'outcome';
      score?: number;
    };
  }>;
}

// Human Name
export interface HumanName {
  use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
  period?: Period;
}

// Address
export interface Address {
  use?: 'home' | 'work' | 'temp' | 'old' | 'billing';
  type?: 'postal' | 'physical' | 'both';
  text?: string;
  line?: string[];
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  period?: Period;
}

// Contact Point (phone, email, etc.)
export interface ContactPoint {
  system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  value?: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
  rank?: number;
  period?: Period;
}

// Period
export interface Period {
  start?: string;
  end?: string;
}

// Identifier
export interface Identifier {
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  type?: CodeableConcept;
  system?: string;
  value?: string;
  period?: Period;
  assigner?: Reference;
}

// Reference
export interface Reference {
  reference?: string;
  type?: string;
  identifier?: Identifier;
  display?: string;
}

// CodeableConcept
export interface CodeableConcept {
  coding?: Coding[];
  text?: string;
}

// Coding
export interface Coding {
  system?: string;
  version?: string;
  code?: string;
  display?: string;
  userSelected?: boolean;
}

// Quantity
export interface Quantity {
  value?: number;
  comparator?: '<' | '<=' | '>=' | '>';
  unit?: string;
  system?: string;
  code?: string;
}

// Annotation
export interface Annotation {
  authorReference?: Reference;
  authorString?: string;
  time?: string;
  text: string;
}

// ========================================
// Patient Resource
// ========================================
export interface Patient extends FHIRResource {
  resourceType: 'Patient';
  identifier?: Identifier[];
  active?: boolean;
  name?: HumanName[];
  telecom?: ContactPoint[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  deceasedBoolean?: boolean;
  deceasedDateTime?: string;
  address?: Address[];
  maritalStatus?: CodeableConcept;
  multipleBirthBoolean?: boolean;
  multipleBirthInteger?: number;
  photo?: Attachment[];
  contact?: PatientContact[];
  communication?: PatientCommunication[];
  generalPractitioner?: Reference[];
  managingOrganization?: Reference;
  link?: PatientLink[];
}

export interface Attachment {
  contentType?: string;
  language?: string;
  data?: string;
  url?: string;
  size?: number;
  hash?: string;
  title?: string;
  creation?: string;
}

export interface PatientContact {
  relationship?: CodeableConcept[];
  name?: HumanName;
  telecom?: ContactPoint[];
  address?: Address;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  organization?: Reference;
  period?: Period;
}

export interface PatientCommunication {
  language: CodeableConcept;
  preferred?: boolean;
}

export interface PatientLink {
  other: Reference;
  type: 'replaced-by' | 'replaces' | 'refer' | 'seealso';
}

// ========================================
// Observation Resource
// ========================================
export interface Observation extends FHIRResource {
  resourceType: 'Observation';
  identifier?: Identifier[];
  basedOn?: Reference[];
  partOf?: Reference[];
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: CodeableConcept[];
  code: CodeableConcept;
  subject?: Reference;
  focus?: Reference[];
  encounter?: Reference;
  effectiveDateTime?: string;
  effectivePeriod?: Period;
  effectiveTiming?: any;
  effectiveInstant?: string;
  issued?: string;
  performer?: Reference[];
  valueQuantity?: Quantity;
  valueCodeableConcept?: CodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueRange?: { low?: Quantity; high?: Quantity };
  valueRatio?: { numerator?: Quantity; denominator?: Quantity };
  valueSampledData?: any;
  valueTime?: string;
  valueDateTime?: string;
  valuePeriod?: Period;
  dataAbsentReason?: CodeableConcept;
  interpretation?: CodeableConcept[];
  note?: Annotation[];
  bodySite?: CodeableConcept;
  method?: CodeableConcept;
  specimen?: Reference;
  device?: Reference;
  referenceRange?: ObservationReferenceRange[];
  hasMember?: Reference[];
  derivedFrom?: Reference[];
  component?: ObservationComponent[];
}

export interface ObservationReferenceRange {
  low?: Quantity;
  high?: Quantity;
  type?: CodeableConcept;
  appliesTo?: CodeableConcept[];
  age?: { low?: Quantity; high?: Quantity };
  text?: string;
}

export interface ObservationComponent {
  code: CodeableConcept;
  valueQuantity?: Quantity;
  valueCodeableConcept?: CodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueRange?: { low?: Quantity; high?: Quantity };
  valueRatio?: { numerator?: Quantity; denominator?: Quantity };
  valueSampledData?: any;
  valueTime?: string;
  valueDateTime?: string;
  valuePeriod?: Period;
  dataAbsentReason?: CodeableConcept;
  interpretation?: CodeableConcept[];
  referenceRange?: ObservationReferenceRange[];
}

// ========================================
// Condition Resource
// ========================================
export interface Condition extends FHIRResource {
  resourceType: 'Condition';
  identifier?: Identifier[];
  clinicalStatus?: CodeableConcept;
  verificationStatus?: CodeableConcept;
  category?: CodeableConcept[];
  severity?: CodeableConcept;
  code?: CodeableConcept;
  bodySite?: CodeableConcept[];
  subject: Reference;
  encounter?: Reference;
  onsetDateTime?: string;
  onsetAge?: Quantity;
  onsetPeriod?: Period;
  onsetRange?: { low?: Quantity; high?: Quantity };
  onsetString?: string;
  abatementDateTime?: string;
  abatementAge?: Quantity;
  abatementPeriod?: Period;
  abatementRange?: { low?: Quantity; high?: Quantity };
  abatementString?: string;
  recordedDate?: string;
  recorder?: Reference;
  asserter?: Reference;
  stage?: ConditionStage[];
  evidence?: ConditionEvidence[];
  note?: Annotation[];
}

export interface ConditionStage {
  summary?: CodeableConcept;
  assessment?: Reference[];
  type?: CodeableConcept;
}

export interface ConditionEvidence {
  code?: CodeableConcept[];
  detail?: Reference[];
}

// ========================================
// MedicationRequest Resource
// ========================================
export interface MedicationRequest extends FHIRResource {
  resourceType: 'MedicationRequest';
  identifier?: Identifier[];
  status: 'active' | 'on-hold' | 'cancelled' | 'completed' | 'entered-in-error' | 'stopped' | 'draft' | 'unknown';
  statusReason?: CodeableConcept;
  intent: 'proposal' | 'plan' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
  category?: CodeableConcept[];
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  doNotPerform?: boolean;
  reportedBoolean?: boolean;
  reportedReference?: Reference;
  medicationCodeableConcept?: CodeableConcept;
  medicationReference?: Reference;
  subject: Reference;
  encounter?: Reference;
  supportingInformation?: Reference[];
  authoredOn?: string;
  requester?: Reference;
  performer?: Reference;
  performerType?: CodeableConcept;
  recorder?: Reference;
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  instantiatesCanonical?: string[];
  instantiatesUri?: string[];
  basedOn?: Reference[];
  groupIdentifier?: Identifier;
  courseOfTherapyType?: CodeableConcept;
  insurance?: Reference[];
  note?: Annotation[];
  dosageInstruction?: Dosage[];
  dispenseRequest?: MedicationRequestDispenseRequest;
  substitution?: MedicationRequestSubstitution;
  priorPrescription?: Reference;
  detectedIssue?: Reference[];
  eventHistory?: Reference[];
}

export interface Dosage {
  sequence?: number;
  text?: string;
  additionalInstruction?: CodeableConcept[];
  patientInstruction?: string;
  timing?: any;
  asNeededBoolean?: boolean;
  asNeededCodeableConcept?: CodeableConcept;
  site?: CodeableConcept;
  route?: CodeableConcept;
  method?: CodeableConcept;
  doseAndRate?: DosageDoseAndRate[];
  maxDosePerPeriod?: { numerator?: Quantity; denominator?: Quantity };
  maxDosePerAdministration?: Quantity;
  maxDosePerLifetime?: Quantity;
}

export interface DosageDoseAndRate {
  type?: CodeableConcept;
  doseRange?: { low?: Quantity; high?: Quantity };
  doseQuantity?: Quantity;
  rateRatio?: { numerator?: Quantity; denominator?: Quantity };
  rateRange?: { low?: Quantity; high?: Quantity };
  rateQuantity?: Quantity;
}

export interface MedicationRequestDispenseRequest {
  initialFill?: { quantity?: Quantity; duration?: any };
  dispenseInterval?: any;
  validityPeriod?: Period;
  numberOfRepeatsAllowed?: number;
  quantity?: Quantity;
  expectedSupplyDuration?: any;
  performer?: Reference;
}

export interface MedicationRequestSubstitution {
  allowedBoolean?: boolean;
  allowedCodeableConcept?: CodeableConcept;
  reason?: CodeableConcept;
}

// ========================================
// AllergyIntolerance Resource
// ========================================
export interface AllergyIntolerance extends FHIRResource {
  resourceType: 'AllergyIntolerance';
  identifier?: Identifier[];
  clinicalStatus?: CodeableConcept;
  verificationStatus?: CodeableConcept;
  type?: 'allergy' | 'intolerance';
  category?: ('food' | 'medication' | 'environment' | 'biologic')[];
  criticality?: 'low' | 'high' | 'unable-to-assess';
  code?: CodeableConcept;
  patient: Reference;
  encounter?: Reference;
  onsetDateTime?: string;
  onsetAge?: Quantity;
  onsetPeriod?: Period;
  onsetRange?: { low?: Quantity; high?: Quantity };
  onsetString?: string;
  recordedDate?: string;
  recorder?: Reference;
  asserter?: Reference;
  lastOccurrence?: string;
  note?: Annotation[];
  reaction?: AllergyIntoleranceReaction[];
}

export interface AllergyIntoleranceReaction {
  substance?: CodeableConcept;
  manifestation: CodeableConcept[];
  description?: string;
  onset?: string;
  severity?: 'mild' | 'moderate' | 'severe';
  exposureRoute?: CodeableConcept;
  note?: Annotation[];
}

// ========================================
// Encounter Resource
// ========================================
export interface Encounter extends FHIRResource {
  resourceType: 'Encounter';
  identifier?: Identifier[];
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';
  statusHistory?: EncounterStatusHistory[];
  class: Coding;
  classHistory?: EncounterClassHistory[];
  type?: CodeableConcept[];
  serviceType?: CodeableConcept;
  priority?: CodeableConcept;
  subject?: Reference;
  episodeOfCare?: Reference[];
  basedOn?: Reference[];
  participant?: EncounterParticipant[];
  appointment?: Reference[];
  period?: Period;
  length?: any;
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  diagnosis?: EncounterDiagnosis[];
  account?: Reference[];
  hospitalization?: EncounterHospitalization;
  location?: EncounterLocation[];
  serviceProvider?: Reference;
  partOf?: Reference;
}

export interface EncounterStatusHistory {
  status: string;
  period: Period;
}

export interface EncounterClassHistory {
  class: Coding;
  period: Period;
}

export interface EncounterParticipant {
  type?: CodeableConcept[];
  period?: Period;
  individual?: Reference;
}

export interface EncounterDiagnosis {
  condition: Reference;
  use?: CodeableConcept;
  rank?: number;
}

export interface EncounterHospitalization {
  preAdmissionIdentifier?: Identifier;
  origin?: Reference;
  admitSource?: CodeableConcept;
  reAdmission?: CodeableConcept;
  dietPreference?: CodeableConcept[];
  specialCourtesy?: CodeableConcept[];
  specialArrangement?: CodeableConcept[];
  destination?: Reference;
  dischargeDisposition?: CodeableConcept;
}

export interface EncounterLocation {
  location: Reference;
  status?: 'planned' | 'active' | 'reserved' | 'completed';
  physicalType?: CodeableConcept;
  period?: Period;
}

// ========================================
// DiagnosticReport Resource
// ========================================
export interface DiagnosticReport extends FHIRResource {
  resourceType: 'DiagnosticReport';
  identifier?: Identifier[];
  basedOn?: Reference[];
  status: 'registered' | 'partial' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'appended' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: CodeableConcept[];
  code: CodeableConcept;
  subject?: Reference;
  encounter?: Reference;
  effectiveDateTime?: string;
  effectivePeriod?: Period;
  issued?: string;
  performer?: Reference[];
  resultsInterpreter?: Reference[];
  specimen?: Reference[];
  result?: Reference[];
  imagingStudy?: Reference[];
  media?: DiagnosticReportMedia[];
  conclusion?: string;
  conclusionCode?: CodeableConcept[];
  presentedForm?: Attachment[];
}

export interface DiagnosticReportMedia {
  comment?: string;
  link: Reference;
}

// ========================================
// Procedure Resource
// ========================================
export interface Procedure extends FHIRResource {
  resourceType: 'Procedure';
  identifier?: Identifier[];
  instantiatesCanonical?: string[];
  instantiatesUri?: string[];
  basedOn?: Reference[];
  partOf?: Reference[];
  status: 'preparation' | 'in-progress' | 'not-done' | 'on-hold' | 'stopped' | 'completed' | 'entered-in-error' | 'unknown';
  statusReason?: CodeableConcept;
  category?: CodeableConcept;
  code?: CodeableConcept;
  subject: Reference;
  encounter?: Reference;
  performedDateTime?: string;
  performedPeriod?: Period;
  performedString?: string;
  performedAge?: Quantity;
  performedRange?: { low?: Quantity; high?: Quantity };
  recorder?: Reference;
  asserter?: Reference;
  performer?: ProcedurePerformer[];
  location?: Reference;
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  bodySite?: CodeableConcept[];
  outcome?: CodeableConcept;
  report?: Reference[];
  complication?: CodeableConcept[];
  complicationDetail?: Reference[];
  followUp?: CodeableConcept[];
  note?: Annotation[];
  focalDevice?: ProcedureFocalDevice[];
  usedReference?: Reference[];
  usedCode?: CodeableConcept[];
}

export interface ProcedurePerformer {
  function?: CodeableConcept;
  actor: Reference;
  onBehalfOf?: Reference;
}

export interface ProcedureFocalDevice {
  action?: CodeableConcept;
  manipulated: Reference;
}

// ========================================
// Immunization Resource
// ========================================
export interface Immunization extends FHIRResource {
  resourceType: 'Immunization';
  identifier?: Identifier[];
  status: 'completed' | 'entered-in-error' | 'not-done';
  statusReason?: CodeableConcept;
  vaccineCode: CodeableConcept;
  patient: Reference;
  encounter?: Reference;
  occurrenceDateTime?: string;
  occurrenceString?: string;
  recorded?: string;
  primarySource?: boolean;
  reportOrigin?: CodeableConcept;
  location?: Reference;
  manufacturer?: Reference;
  lotNumber?: string;
  expirationDate?: string;
  site?: CodeableConcept;
  route?: CodeableConcept;
  doseQuantity?: Quantity;
  performer?: ImmunizationPerformer[];
  note?: Annotation[];
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  isSubpotent?: boolean;
  subpotentReason?: CodeableConcept[];
  education?: ImmunizationEducation[];
  programEligibility?: CodeableConcept[];
  fundingSource?: CodeableConcept;
  reaction?: ImmunizationReaction[];
  protocolApplied?: ImmunizationProtocolApplied[];
}

export interface ImmunizationPerformer {
  function?: CodeableConcept;
  actor: Reference;
}

export interface ImmunizationEducation {
  documentType?: string;
  reference?: string;
  publicationDate?: string;
  presentationDate?: string;
}

export interface ImmunizationReaction {
  date?: string;
  detail?: Reference;
  reported?: boolean;
}

export interface ImmunizationProtocolApplied {
  series?: string;
  authority?: Reference;
  targetDisease?: CodeableConcept[];
  doseNumberPositiveInt?: number;
  doseNumberString?: string;
  seriesDosesPositiveInt?: number;
  seriesDosesString?: string;
}

// ========================================
// Coverage Resource (Billing)
// ========================================
export interface Coverage extends FHIRResource {
  resourceType: 'Coverage';
  identifier?: Identifier[];
  status: 'active' | 'cancelled' | 'draft' | 'entered-in-error';
  type?: CodeableConcept;
  policyHolder?: Reference;
  subscriber?: Reference;
  subscriberId?: string;
  beneficiary: Reference;
  dependent?: string;
  relationship?: CodeableConcept;
  period?: Period;
  payor: Reference[];
  class?: CoverageClass[];
  order?: number;
  network?: string;
  costToBeneficiary?: CoverageCostToBeneficiary[];
  subrogation?: boolean;
  contract?: Reference[];
}

export interface CoverageClass {
  type: CodeableConcept;
  value: string;
  name?: string;
}

export interface CoverageCostToBeneficiary {
  type?: CodeableConcept;
  valueQuantity?: Quantity;
  valueMoney?: Money;
  exception?: CoverageException[];
}

export interface CoverageException {
  type: CodeableConcept;
  period?: Period;
}

export interface Money {
  value?: number;
  currency?: string;
}

// ========================================
// ExplanationOfBenefit Resource (Billing)
// ========================================
export interface ExplanationOfBenefit extends FHIRResource {
  resourceType: 'ExplanationOfBenefit';
  identifier?: Identifier[];
  status: 'active' | 'cancelled' | 'draft' | 'entered-in-error';
  type: CodeableConcept;
  subType?: CodeableConcept;
  use: 'claim' | 'preauthorization' | 'predetermination';
  patient: Reference;
  billablePeriod?: Period;
  created: string;
  enterer?: Reference;
  insurer: Reference;
  provider: Reference;
  priority?: CodeableConcept;
  fundsReserveRequested?: CodeableConcept;
  fundsReserve?: CodeableConcept;
  related?: EOBRelated[];
  prescription?: Reference;
  originalPrescription?: Reference;
  payee?: EOBPayee;
  referral?: Reference;
  facility?: Reference;
  claim?: Reference;
  claimResponse?: Reference;
  outcome: 'queued' | 'complete' | 'error' | 'partial';
  disposition?: string;
  preAuthRef?: string[];
  preAuthRefPeriod?: Period[];
  careTeam?: EOBCareTeam[];
  supportingInfo?: EOBSupportingInfo[];
  diagnosis?: EOBDiagnosis[];
  procedure?: EOBProcedure[];
  precedence?: number;
  insurance: EOBInsurance[];
  accident?: EOBAccident;
  item?: EOBItem[];
  addItem?: EOBAddItem[];
  adjudication?: EOBAdjudication[];
  total?: EOBTotal[];
  payment?: EOBPayment;
  formCode?: CodeableConcept;
  form?: Attachment;
  processNote?: EOBProcessNote[];
  benefitPeriod?: Period;
  benefitBalance?: EOBBenefitBalance[];
}

export interface EOBRelated {
  claim?: Reference;
  relationship?: CodeableConcept;
  reference?: Identifier;
}

export interface EOBPayee {
  type?: CodeableConcept;
  party?: Reference;
}

export interface EOBCareTeam {
  sequence: number;
  provider: Reference;
  responsible?: boolean;
  role?: CodeableConcept;
  qualification?: CodeableConcept;
}

export interface EOBSupportingInfo {
  sequence: number;
  category: CodeableConcept;
  code?: CodeableConcept;
  timingDate?: string;
  timingPeriod?: Period;
  valueBoolean?: boolean;
  valueString?: string;
  valueQuantity?: Quantity;
  valueAttachment?: Attachment;
  valueReference?: Reference;
  reason?: Coding;
}

export interface EOBDiagnosis {
  sequence: number;
  diagnosisCodeableConcept?: CodeableConcept;
  diagnosisReference?: Reference;
  type?: CodeableConcept[];
  onAdmission?: CodeableConcept;
  packageCode?: CodeableConcept;
}

export interface EOBProcedure {
  sequence: number;
  type?: CodeableConcept[];
  date?: string;
  procedureCodeableConcept?: CodeableConcept;
  procedureReference?: Reference;
  udi?: Reference[];
}

export interface EOBInsurance {
  focal: boolean;
  coverage: Reference;
  preAuthRef?: string[];
}

export interface EOBAccident {
  date?: string;
  type?: CodeableConcept;
  locationAddress?: Address;
  locationReference?: Reference;
}

export interface EOBItem {
  sequence: number;
  careTeamSequence?: number[];
  diagnosisSequence?: number[];
  procedureSequence?: number[];
  informationSequence?: number[];
  revenue?: CodeableConcept;
  category?: CodeableConcept;
  productOrService: CodeableConcept;
  modifier?: CodeableConcept[];
  programCode?: CodeableConcept[];
  servicedDate?: string;
  servicedPeriod?: Period;
  locationCodeableConcept?: CodeableConcept;
  locationAddress?: Address;
  locationReference?: Reference;
  quantity?: Quantity;
  unitPrice?: Money;
  factor?: number;
  net?: Money;
  udi?: Reference[];
  bodySite?: CodeableConcept;
  subSite?: CodeableConcept[];
  encounter?: Reference[];
  noteNumber?: number[];
  adjudication?: EOBAdjudication[];
  detail?: EOBItemDetail[];
}

export interface EOBItemDetail {
  sequence: number;
  revenue?: CodeableConcept;
  category?: CodeableConcept;
  productOrService: CodeableConcept;
  modifier?: CodeableConcept[];
  programCode?: CodeableConcept[];
  quantity?: Quantity;
  unitPrice?: Money;
  factor?: number;
  net?: Money;
  udi?: Reference[];
  noteNumber?: number[];
  adjudication?: EOBAdjudication[];
  subDetail?: EOBItemSubDetail[];
}

export interface EOBItemSubDetail {
  sequence: number;
  revenue?: CodeableConcept;
  category?: CodeableConcept;
  productOrService: CodeableConcept;
  modifier?: CodeableConcept[];
  programCode?: CodeableConcept[];
  quantity?: Quantity;
  unitPrice?: Money;
  factor?: number;
  net?: Money;
  udi?: Reference[];
  noteNumber?: number[];
  adjudication?: EOBAdjudication[];
}

export interface EOBAddItem {
  itemSequence?: number[];
  detailSequence?: number[];
  subDetailSequence?: number[];
  provider?: Reference[];
  productOrService: CodeableConcept;
  modifier?: CodeableConcept[];
  programCode?: CodeableConcept[];
  servicedDate?: string;
  servicedPeriod?: Period;
  locationCodeableConcept?: CodeableConcept;
  locationAddress?: Address;
  locationReference?: Reference;
  quantity?: Quantity;
  unitPrice?: Money;
  factor?: number;
  net?: Money;
  bodySite?: CodeableConcept;
  subSite?: CodeableConcept[];
  noteNumber?: number[];
  adjudication?: EOBAdjudication[];
  detail?: EOBAddItemDetail[];
}

export interface EOBAddItemDetail {
  productOrService: CodeableConcept;
  modifier?: CodeableConcept[];
  quantity?: Quantity;
  unitPrice?: Money;
  factor?: number;
  net?: Money;
  noteNumber?: number[];
  adjudication?: EOBAdjudication[];
  subDetail?: EOBAddItemSubDetail[];
}

export interface EOBAddItemSubDetail {
  productOrService: CodeableConcept;
  modifier?: CodeableConcept[];
  quantity?: Quantity;
  unitPrice?: Money;
  factor?: number;
  net?: Money;
  noteNumber?: number[];
  adjudication?: EOBAdjudication[];
}

export interface EOBAdjudication {
  category: CodeableConcept;
  reason?: CodeableConcept;
  amount?: Money;
  value?: number;
}

export interface EOBTotal {
  category: CodeableConcept;
  amount: Money;
}

export interface EOBPayment {
  type?: CodeableConcept;
  adjustment?: Money;
  adjustmentReason?: CodeableConcept;
  date?: string;
  amount?: Money;
  identifier?: Identifier;
}

export interface EOBProcessNote {
  number?: number;
  type?: 'display' | 'print' | 'printoper';
  text?: string;
  language?: CodeableConcept;
}

export interface EOBBenefitBalance {
  category: CodeableConcept;
  excluded?: boolean;
  name?: string;
  description?: string;
  network?: CodeableConcept;
  unit?: CodeableConcept;
  term?: CodeableConcept;
  financial?: EOBBenefitBalanceFinancial[];
}

export interface EOBBenefitBalanceFinancial {
  type: CodeableConcept;
  allowedUnsignedInt?: number;
  allowedString?: string;
  allowedMoney?: Money;
  usedUnsignedInt?: number;
  usedMoney?: Money;
}

// ========================================
// API Response Types
// ========================================
export interface EpicAPIError {
  error: string;
  details?: string;
  status?: number;
}

export interface EpicConnectionStatus {
  configured: boolean;
  connected: boolean;
  environment: 'sandbox' | 'production';
  clientId: string | null;
  endpoints: {
    fhirBaseUrl: string;
  };
  tokenInfo: {
    expiresAt: string;
    patientId?: string;
  } | null;
  sandbox?: {
    testPatients: Array<{
      name: string;
      fhirId: string;
      mychartUser: string;
      mychartPass: string;
    }>;
  };
}
