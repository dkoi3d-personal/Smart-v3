# Epic FHIR Healthcare APIs Reference

Reference for Epic FHIR API integration. Read this only for healthcare projects.

## CRITICAL: Always Use Full URL

Your preview app runs on a DIFFERENT port than the platform!

```tsx
// CORRECT - always use full URL
const PLATFORM_URL = 'http://localhost:3000';
const res = await fetch(`${PLATFORM_URL}/api/epic/fhir/Patient/${patientId}`);

// WRONG - won't work from preview app
const res = await fetch(`/api/epic/fhir/Patient/${patientId}`);
```

---

## Base URL
```
http://localhost:3000/api/epic/fhir/{resource}
```

---

## Test Patient IDs
Use these for development:
- **Camila Lopez**: `erXuFYUfucBZaryVksYEcMg3`
- **Theodore Mychart**: `e63wRTbPfr1p8UW81d8Seiw3`
- **Derrick Lin**: `eq081-VQEgP8drUUqCWzHfw3`

---

## Available Resources

### Patient Information
| Resource | Operations | Description |
|----------|------------|-------------|
| Patient | Read/Create/Search | Demographics, contact |
| RelatedPerson | Read/Search | Family, caregivers |
| FamilyMemberHistory | Read/Search | Genetic history |

### Conditions & Allergies
| Resource | Operations | Description |
|----------|------------|-------------|
| Condition | Read/Create/Search | Diagnoses, problems |
| AllergyIntolerance | Read/Create/Search | Allergies |
| AdverseEvent | Read/Search | Side effects |

### Medications
| Resource | Operations | Description |
|----------|------------|-------------|
| MedicationRequest | Read/Search | Prescriptions |
| MedicationAdministration | Read/Search | MAR |
| MedicationDispense | Read/Search | Pharmacy fills |

**Note**: Use `medicationReference?.display` for medication names!

### Vitals & Labs
| Resource | Operations | Description |
|----------|------------|-------------|
| Observation | Read/Create/Update/Search | Vitals, labs |
| DiagnosticReport | Read/Update/Search | Lab panels |
| Specimen | Read/Search | Samples |

### Immunizations
| Resource | Operations | Description |
|----------|------------|-------------|
| Immunization | Read/Search | Vaccines given |
| ImmunizationRecommendation | Read/Search | Due vaccines |

### Procedures
| Resource | Operations | Description |
|----------|------------|-------------|
| Procedure | Read/Create/Update/Search | Surgeries |
| ServiceRequest | Read/Create/Update/Search | Orders |
| DeviceRequest | Read/Search | Equipment |

### Documents
| Resource | Operations | Description |
|----------|------------|-------------|
| ImagingStudy | Read/Search | X-rays, CT, MRI |
| DocumentReference | Read/Create/Update/Search | Clinical notes |
| Media | Read/Search | Photos, videos |

### Visits
| Resource | Operations | Description |
|----------|------------|-------------|
| Encounter | Read/Search | Visits, hospitalizations |
| Appointment | Read/Search | Scheduled appointments |
| EpisodeOfCare | Read/Search | Treatment episodes |

### Care Plans
| Resource | Operations | Description |
|----------|------------|-------------|
| CarePlan | Read/Search | Treatment plans |
| Goal | Read/Search | Health goals |
| CareTeam | Read/Search | Care providers |

### Communication
| Resource | Operations | Description |
|----------|------------|-------------|
| Communication | Read/Create/Search | Messages |
| Questionnaire | Read/Search | Forms |
| QuestionnaireResponse | Read/Create/Search | Form responses |

### Billing
| Resource | Operations | Description |
|----------|------------|-------------|
| Coverage | Read/Search | Insurance |
| Claim | Read/Search | Claims |
| ExplanationOfBenefit | Read/Search | EOBs |

### Providers
| Resource | Operations | Description |
|----------|------------|-------------|
| Practitioner | Read/Search | Doctors |
| Organization | Read/Search | Facilities |
| Location | Read/Search | Addresses |

---

## Usage Examples

### Fetch Patient Data
```tsx
const PLATFORM_URL = 'http://localhost:3000';

async function fetchPatient(patientId: string) {
  const res = await fetch(`${PLATFORM_URL}/api/epic/fhir/Patient/${patientId}`);
  if (!res.ok) throw new Error('Failed to fetch patient');
  return res.json();
}
```

### Check Epic Connection
```tsx
const checkEpicConnection = async () => {
  try {
    const res = await fetch('http://localhost:3000/api/epic');
    const data = await res.json();
    return data.connected === true;
  } catch {
    return false;
  }
};
```

### Fetch Medications
```tsx
async function fetchMedications(patientId: string) {
  const res = await fetch(
    `${PLATFORM_URL}/api/epic/fhir/MedicationRequest?patient=${patientId}`
  );
  const data = await res.json();
  return data.entry?.map((e: any) => ({
    id: e.resource.id,
    name: e.resource.medicationReference?.display || 'Unknown',
    status: e.resource.status,
  })) || [];
}
```
