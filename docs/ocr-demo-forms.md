# Healthcare Forms for OCR Demo

## Top Picks for Demonstrating OCR Functionality

### 1. CMS-1500 (Health Insurance Claim Form) - RECOMMENDED
- Industry standard billing form used millions of times daily
- Highly structured with 33 numbered boxes
- Contains: Patient info, diagnoses (ICD-10), procedures (CPT), insurance details
- Shows OCR can handle: boxes, checkboxes, dates, codes, handwriting
- Easy to find blank templates online
- Real business value: $3+ trillion in claims use this form annually

**Fields to Extract:**
- Box 1: Insurance type (Medicare, Medicaid, etc.)
- Box 2: Patient name
- Box 3: Patient DOB, Sex
- Box 5: Patient address
- Box 9: Other insured's name
- Box 11: Insured's policy/group number
- Box 21: Diagnosis codes (ICD-10)
- Box 24: Service lines (Date, CPT code, charges)
- Box 31: Physician signature
- Box 33: Billing provider info

### 2. Insurance Card (Front & Back)
- Everyone recognizes it
- Extracts: Member ID, Group #, Plan name, Copays, PBM info
- Quick demo - just snap a photo
- Shows real-world "check-in kiosk" use case

**Fields to Extract:**
- Member name
- Member ID
- Group number
- Plan name
- PCP copay
- Specialist copay
- ER copay
- Rx BIN/PCN/Group
- Customer service phone

### 3. Prescription/Rx Form
- Drug name, strength, dosage, quantity, refills, prescriber DEA#
- Can demo medication reconciliation workflow
- Shows OCR handling handwritten physician notes

**Fields to Extract:**
- Patient name
- Date written
- Drug name
- Strength (e.g., 10mg)
- Quantity
- Directions (SIG)
- Refills
- Prescriber name
- DEA number
- NPI

### 4. Patient Intake Form
- Demographics, emergency contact, medical history checkboxes
- Relatable - everyone has filled one out
- Shows form-to-database workflow

**Fields to Extract:**
- Full name
- Date of birth
- SSN (last 4)
- Address
- Phone numbers
- Emergency contact
- Primary care physician
- Insurance info
- Allergies
- Current medications
- Medical history checkboxes

### 5. Superbill/Encounter Form
- Clinic checkout form with diagnosis/procedure checkboxes
- Common CPT/ICD codes pre-printed
- Shows charge capture automation

**Fields to Extract:**
- Patient name
- Date of service
- Provider name
- Checked diagnosis codes
- Checked procedure codes
- Follow-up instructions

---

## Implementation Notes

### Using OpenAI Vision for OCR
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function extractFormData(imageUrl: string, formType: string) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{
      role: "user",
      content: [
        {
          type: "text",
          text: `Extract all fields from this ${formType} form. Return as JSON with field names and values.`
        },
        { type: "image_url", image_url: { url: imageUrl } }
      ]
    }],
    max_tokens: 4096,
  });
  return JSON.parse(response.choices[0].message.content || '{}');
}
```

### Sample CMS-1500 Sources
- CMS.gov official blank form: https://www.cms.gov/Medicare/CMS-Forms/CMS-Forms/CMS-Forms-Items/CMS012949
- Search "CMS-1500 sample filled" for examples with data

### Demo Flow
1. User uploads/photographs form
2. OCR extracts fields to JSON
3. Display extracted data in structured UI
4. Allow user to verify/correct
5. Save to patient record or claims system
