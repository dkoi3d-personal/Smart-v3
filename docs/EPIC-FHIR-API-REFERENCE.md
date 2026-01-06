# Epic FHIR R4 API Reference

> **Last Updated**: December 2024
> **Epic Sandbox**: https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
> **Authentication**: Backend Services OAuth 2.0 (JWT)

---

## Quick Start

### Authentication
The platform uses Backend Services OAuth 2.0 with JWT client assertion. Authentication is automatic - the system will refresh tokens as needed.

### API Proxy
All Epic FHIR requests go through our proxy at `/api/epic/fhir/[resource]`

```typescript
// Example: Get a patient
const response = await fetch('/api/epic/fhir/Patient/erXuFYUfucBZaryVksYEcMg3');
const patient = await response.json();

// Example: Search conditions
const conditions = await fetch('/api/epic/fhir/Condition?patient=erXuFYUfucBZaryVksYEcMg3');
```

---

## Test Patients

| Name | FHIR ID | DOB | Gender | Use Case |
|------|---------|-----|--------|----------|
| **Camila Lopez** | `erXuFYUfucBZaryVksYEcMg3` | 1987-09-12 | Female | Full clinical data (9 conditions, meds, labs, allergies) |
| **Theodore Mychart** | `e63wRTbPfr1p8UW81d8Seiw3` | 1948-07-07 | Male | Portal/MyChart testing, elderly patient |
| **Derrick Lin** | `eq081-VQEgP8drUUqCWzHfw3` | 1973-06-03 | Male | Basic demographics, bilingual (English/Chinese) |

---

## Available FHIR Resources (59 Total)

### Patient Administration

| Resource | Operations | Description |
|----------|------------|-------------|
| **Patient** | create, read, search | Demographics, identifiers, contacts |
| **Practitioner** | read, search | Healthcare providers |
| **PractitionerRole** | read, search | Provider roles and specialties |
| **Organization** | read, search | Healthcare organizations |
| **Location** | read, search | Physical locations, rooms |
| **Endpoint** | read, search | Technical endpoints for connectivity |
| **RelatedPerson** | read, search | Patient contacts, guardians, caregivers |
| **Group** | read, search | Patient groups, cohorts |

### Clinical - Conditions & History

| Resource | Operations | Description |
|----------|------------|-------------|
| **Condition** | create, read, search | Diagnoses, problems, health concerns |
| **Procedure** | create, read, search, update | Clinical procedures performed |
| **FamilyMemberHistory** | read, search | Family health history |
| **AdverseEvent** | read, search | Adverse events, reactions |
| **Flag** | read, search | Patient alerts, warnings |

### Clinical - Medications

| Resource | Operations | Description |
|----------|------------|-------------|
| **AllergyIntolerance** | create, read, search | Allergies and intolerances |
| **Medication** | read, search | Medication definitions |
| **MedicationRequest** | read, search | Prescriptions, medication orders |
| **MedicationAdministration** | read, search | Medication given records |
| **MedicationDispense** | read, search | Pharmacy dispensing records |
| **Immunization** | read, search | Vaccination records |
| **ImmunizationRecommendation** | read, search | Recommended vaccines |

### Clinical - Observations & Results

| Resource | Operations | Description |
|----------|------------|-------------|
| **Observation** | create, read, search, update | Vitals, labs, assessments, social history |
| **DiagnosticReport** | read, search, update | Lab reports, imaging reports |
| **Specimen** | read, search | Lab specimens |
| **Media** | read, search | Images, videos, audio |
| **BodyStructure** | create, read, search, update | Anatomical structures |

### Clinical - Care Management

| Resource | Operations | Description |
|----------|------------|-------------|
| **CarePlan** | read, search | Care plans and goals |
| **CareTeam** | read, search | Care team members |
| **Goal** | read, search | Patient goals |
| **ServiceRequest** | create, read, search, update | Orders, referrals |
| **NutritionOrder** | read, search | Diet orders |
| **DeviceRequest** | read, search | Medical device orders |
| **DeviceUseStatement** | read, search | Device usage records |
| **Device** | read, search | Medical devices |
| **Communication** | create, read, search | Clinical communications |

### Encounters & Scheduling

| Resource | Operations | Description |
|----------|------------|-------------|
| **Encounter** | read, search | Patient visits, admissions |
| **EpisodeOfCare** | read, search | Care episodes |
| **Appointment** | read, search | Scheduled appointments |

### Documents & Forms

| Resource | Operations | Description |
|----------|------------|-------------|
| **DocumentReference** | create, read, search, update | Clinical documents, notes |
| **Binary** | read, search | Raw document content |
| **Questionnaire** | read, search | Form definitions |
| **QuestionnaireResponse** | create, read, search | Completed forms |
| **Consent** | read, search | Patient consents |
| **Contract** | read, search | Healthcare contracts |
| **List** | read, search | Clinical lists |

### Financial & Coverage

| Resource | Operations | Description |
|----------|------------|-------------|
| **Coverage** | read, search | Insurance coverage |
| **Account** | read, search | Patient accounts |
| **Claim** | read, search | Healthcare claims |
| **ExplanationOfBenefit** | read, search | EOB documents |

### Research & Quality

| Resource | Operations | Description |
|----------|------------|-------------|
| **ResearchStudy** | read, search | Clinical trials |
| **ResearchSubject** | read, search | Study participants |
| **Measure** | read, search | Quality measures |
| **MeasureReport** | read, search | Quality reports |
| **ImagingStudy** | read, search | DICOM imaging studies |

### Workflow & Tasks

| Resource | Operations | Description |
|----------|------------|-------------|
| **Task** | read, search, update | Workflow tasks |
| **RequestGroup** | read, search | Grouped requests |

### Terminology

| Resource | Operations | Description |
|----------|------------|-------------|
| **ValueSet** | read | Code value sets |
| **ConceptMap** | create, read | Code mappings |
| **Substance** | read, search | Substances (medications, allergens) |
| **Provenance** | read | Resource provenance/history |

---

## Common Search Parameters

### Patient Searches
```
GET /api/epic/fhir/Patient?family=Lopez
GET /api/epic/fhir/Patient?given=Camila
GET /api/epic/fhir/Patient?birthdate=1987-09-12
GET /api/epic/fhir/Patient?identifier=MRN|12345
```

### Clinical Data by Patient
```
GET /api/epic/fhir/Condition?patient={patientId}
GET /api/epic/fhir/MedicationRequest?patient={patientId}
GET /api/epic/fhir/Observation?patient={patientId}&category=vital-signs
GET /api/epic/fhir/Observation?patient={patientId}&category=laboratory
GET /api/epic/fhir/AllergyIntolerance?patient={patientId}
GET /api/epic/fhir/Immunization?patient={patientId}
GET /api/epic/fhir/Procedure?patient={patientId}
GET /api/epic/fhir/DiagnosticReport?patient={patientId}
GET /api/epic/fhir/DocumentReference?patient={patientId}
GET /api/epic/fhir/Encounter?patient={patientId}
GET /api/epic/fhir/CarePlan?patient={patientId}
```

### Date Filtering
```
GET /api/epic/fhir/Observation?patient={id}&date=ge2024-01-01
GET /api/epic/fhir/Encounter?patient={id}&date=ge2024-01-01&date=le2024-12-31
```

### Observation Categories
```
vital-signs       - Blood pressure, heart rate, temperature, etc.
laboratory        - Lab results
social-history    - Smoking status, alcohol use, etc.
survey            - Patient-reported outcomes
imaging           - Imaging observations
procedure         - Procedure-related observations
exam              - Physical exam findings
```

---

## Code Examples

### Fetch Patient Demographics
```typescript
async function getPatient(patientId: string) {
  const response = await fetch(`/api/epic/fhir/Patient/${patientId}`);
  if (!response.ok) throw new Error('Failed to fetch patient');
  return response.json();
}
```

### Fetch All Conditions for Patient
```typescript
async function getConditions(patientId: string) {
  const response = await fetch(`/api/epic/fhir/Condition?patient=${patientId}`);
  if (!response.ok) throw new Error('Failed to fetch conditions');
  const bundle = await response.json();
  return bundle.entry?.map((e: any) => e.resource) || [];
}
```

### Fetch Medications
```typescript
async function getMedications(patientId: string) {
  const response = await fetch(`/api/epic/fhir/MedicationRequest?patient=${patientId}`);
  if (!response.ok) throw new Error('Failed to fetch medications');
  const bundle = await response.json();
  return bundle.entry?.map((e: any) => e.resource) || [];
}
```

### Fetch Vital Signs
```typescript
async function getVitalSigns(patientId: string) {
  const response = await fetch(
    `/api/epic/fhir/Observation?patient=${patientId}&category=vital-signs`
  );
  if (!response.ok) throw new Error('Failed to fetch vitals');
  const bundle = await response.json();
  return bundle.entry?.map((e: any) => e.resource) || [];
}
```

### Fetch Lab Results
```typescript
async function getLabResults(patientId: string) {
  const response = await fetch(
    `/api/epic/fhir/Observation?patient=${patientId}&category=laboratory`
  );
  if (!response.ok) throw new Error('Failed to fetch labs');
  const bundle = await response.json();
  return bundle.entry?.map((e: any) => e.resource) || [];
}
```

### Comprehensive Patient Summary
```typescript
async function getPatientSummary(patientId: string) {
  const [patient, conditions, medications, allergies, vitals] = await Promise.all([
    fetch(`/api/epic/fhir/Patient/${patientId}`).then(r => r.json()),
    fetch(`/api/epic/fhir/Condition?patient=${patientId}`).then(r => r.json()),
    fetch(`/api/epic/fhir/MedicationRequest?patient=${patientId}`).then(r => r.json()),
    fetch(`/api/epic/fhir/AllergyIntolerance?patient=${patientId}`).then(r => r.json()),
    fetch(`/api/epic/fhir/Observation?patient=${patientId}&category=vital-signs`).then(r => r.json()),
  ]);

  return {
    patient,
    conditions: conditions.entry?.map((e: any) => e.resource) || [],
    medications: medications.entry?.map((e: any) => e.resource) || [],
    allergies: allergies.entry?.map((e: any) => e.resource) || [],
    vitals: vitals.entry?.map((e: any) => e.resource) || [],
  };
}
```

---

## Write Operations

Some resources support create/update operations:

### Create Observation
```typescript
async function createObservation(observation: any) {
  const response = await fetch('/api/epic/fhir/Observation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/fhir+json' },
    body: JSON.stringify(observation),
  });
  return response.json();
}
```

### Resources Supporting Create
- AllergyIntolerance
- BodyStructure
- Communication
- ConceptMap
- Condition
- DocumentReference
- Observation
- Patient
- Procedure
- QuestionnaireResponse
- ServiceRequest

### Resources Supporting Update
- BodyStructure
- DiagnosticReport
- DocumentReference
- Observation
- Procedure
- ServiceRequest
- Task

---

## Error Handling

### Common HTTP Status Codes
| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Process response |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Check request format |
| 401 | Unauthorized | Token expired, will auto-refresh |
| 403 | Forbidden | Missing scopes or permissions |
| 404 | Not Found | Resource doesn't exist |
| 422 | Unprocessable | Validation error |

### Error Response Structure
```json
{
  "resourceType": "OperationOutcome",
  "issue": [{
    "severity": "error",
    "code": "not-found",
    "diagnostics": "Patient not found"
  }]
}
```

---

## SMART Scopes

The platform uses system-level scopes for Backend Services:

```
system/Patient.read
system/Condition.read
system/MedicationRequest.read
system/Observation.read
system/AllergyIntolerance.read
system/Immunization.read
system/Procedure.read
system/DiagnosticReport.read
system/DocumentReference.read
system/Encounter.read
system/CarePlan.read
system/CareTeam.read
system/Goal.read
system/Coverage.read
... (all 59 resources)
```

---

## Rate Limits & Best Practices

1. **Bundle requests** when fetching multiple resources for the same patient
2. **Use _include** to fetch related resources in one call
3. **Implement caching** for static data (practitioners, organizations)
4. **Handle pagination** for large result sets (use `bundle.link` for next page)
5. **Retry with backoff** for 429 (rate limit) or 503 (service unavailable)

---

## Useful Links

- [Epic FHIR Documentation](https://fhir.epic.com/)
- [HL7 FHIR R4 Specification](https://hl7.org/fhir/R4/)
- [US Core Implementation Guide](https://www.hl7.org/fhir/us/core/)
- [SMART on FHIR](https://docs.smarthealthit.org/)

---

*This documentation is auto-generated from the Epic FHIR CapabilityStatement*
