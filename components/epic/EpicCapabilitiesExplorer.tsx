'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  Heart,
  Pill,
  Syringe,
  FileText,
  Calendar,
  Users,
  Building2,
  CreditCard,
  Activity,
  ClipboardList,
  AlertTriangle,
  Stethoscope,
  Baby,
  FlaskConical,
  ImageIcon,
  MessageSquare,
  Target,
  ScrollText,
  Shield,
  Sparkles,
  PenLine,
  Eye,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  Zap,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EpicResource {
  name: string;
  fhirType: string;
  description: string;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canSearch: boolean;
  exampleQueries: string[];
  appIdeas: string[];
}

interface EpicCategory {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  resources: EpicResource[];
}

const EPIC_CAPABILITIES: EpicCategory[] = [
  {
    id: 'patient-info',
    name: 'Patient Information',
    description: 'Core patient demographics, identity, and relationships',
    icon: Users,
    color: 'blue',
    resources: [
      {
        name: 'Patient Demographics',
        fhirType: 'Patient',
        description: 'Patient identity, contact info, demographics, and preferences',
        canRead: true,
        canCreate: true,
        canUpdate: false,
        canSearch: true,
        exampleQueries: [
          'Get patient by ID',
          'Search patients by name',
          'Get patient contact information',
          'View patient photo',
        ],
        appIdeas: [
          'Patient registration portal',
          'Patient lookup tool',
          'Demographics verification app',
        ],
      },
      {
        name: 'Related People',
        fhirType: 'RelatedPerson',
        description: 'Family members, caregivers, emergency contacts',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canSearch: true,
        exampleQueries: [
          'Get emergency contacts',
          'List family members',
          'Find patient caregivers',
        ],
        appIdeas: [
          'Family portal',
          'Caregiver communication app',
          'Emergency contact manager',
        ],
      },
      {
        name: 'Family History',
        fhirType: 'FamilyMemberHistory',
        description: 'Medical history of family members for genetic risk assessment',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canSearch: true,
        exampleQueries: [
          'Get family medical history',
          'View hereditary conditions',
          'Check family cancer history',
        ],
        appIdeas: [
          'Genetic risk calculator',
          'Family health tree visualizer',
          'Hereditary condition tracker',
        ],
      },
    ],
  },
  {
    id: 'conditions',
    name: 'Conditions & Problems',
    description: 'Diagnoses, health conditions, and problem lists',
    icon: Heart,
    color: 'red',
    resources: [
      {
        name: 'Conditions',
        fhirType: 'Condition',
        description: 'Active diagnoses, resolved conditions, and problem list items',
        canRead: true,
        canCreate: true,
        canUpdate: false,
        canSearch: true,
        exampleQueries: [
          'Get active conditions',
          'View problem list',
          'Search by diagnosis code (ICD-10)',
          'Get chronic conditions',
        ],
        appIdeas: [
          'Chronic disease management dashboard',
          'Problem list summary',
          'Condition timeline viewer',
          'Multi-condition care coordinator',
        ],
      },
      {
        name: 'Allergies',
        fhirType: 'AllergyIntolerance',
        description: 'Drug allergies, food allergies, environmental allergies',
        canRead: true,
        canCreate: true,
        canUpdate: false,
        canSearch: true,
        exampleQueries: [
          'Get all allergies',
          'Check drug allergies',
          'View allergy reactions',
          'Get food intolerances',
        ],
        appIdeas: [
          'Allergy alert system',
          'Drug interaction checker',
          'Food safety app for patients',
          'Emergency allergy card generator',
        ],
      },
      {
        name: 'Adverse Events',
        fhirType: 'AdverseEvent',
        description: 'Unexpected medical events, side effects, complications',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canSearch: true,
        exampleQueries: [
          'Get adverse events for patient',
          'View medication side effects',
          'Check procedure complications',
        ],
        appIdeas: [
          'Safety event tracker',
          'Side effect reporter',
          'Quality improvement dashboard',
        ],
      },
    ],
  },
  {
    id: 'medications',
    name: 'Medications',
    description: 'Prescriptions, dispensing, and medication administration',
    icon: Pill,
    color: 'green',
    resources: [
      {
        name: 'Medication Requests',
        fhirType: 'MedicationRequest',
        description: 'Active prescriptions and medication orders',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canSearch: true,
        exampleQueries: [
          'Get active prescriptions',
          'View medication history',
          'Check refill status',
          'Get dosage instructions',
        ],
        appIdeas: [
          'Medication list viewer',
          'Refill reminder app',
          'Prescription tracker',
          'Polypharmacy analyzer',
        ],
      },
      {
        name: 'Medication Administration',
        fhirType: 'MedicationAdministration',
        description: 'Record of medications actually given to patient',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canSearch: true,
        exampleQueries: [
          'View administered medications',
          'Check MAR (medication administration record)',
          'Get infusion history',
        ],
        appIdeas: [
          'Inpatient medication tracker',
          'MAR viewer',
          'Medication adherence monitor',
        ],
      },
      {
        name: 'Medication Dispense',
        fhirType: 'MedicationDispense',
        description: 'Pharmacy dispensing records and fill history',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canSearch: true,
        exampleQueries: [
          'Get dispensing history',
          'Check last fill date',
          'View pharmacy info',
        ],
        appIdeas: [
          'Pharmacy fill tracker',
          'Medication pickup reminder',
          'Insurance coverage checker',
        ],
      },
    ],
  },
  {
    id: 'vitals-labs',
    name: 'Vitals & Lab Results',
    description: 'Observations, vital signs, laboratory results, and measurements',
    icon: Activity,
    color: 'purple',
    resources: [
      {
        name: 'Observations',
        fhirType: 'Observation',
        description: 'Vital signs, lab results, social history, and clinical measurements',
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canSearch: true,
        exampleQueries: [
          'Get vital signs (BP, HR, temp, weight)',
          'View lab results',
          'Get smoking status',
          'Check BMI history',
          'Get glucose readings',
        ],
        appIdeas: [
          'Vital signs dashboard',
          'Lab results viewer with trends',
          'Blood pressure tracker',
          'Weight management app',
          'Diabetes glucose monitor',
          'Patient-reported outcomes app',
        ],
      },
      {
        name: 'Diagnostic Reports',
        fhirType: 'DiagnosticReport',
        description: 'Lab panels, pathology reports, radiology reports',
        canRead: true,
        canCreate: false,
        canUpdate: true,
        canSearch: true,
        exampleQueries: [
          'Get lab panels (CBC, CMP)',
          'View pathology reports',
          'Get radiology reports',
        ],
        appIdeas: [
          'Lab report interpreter',
          'Test result notification app',
          'Trending lab values viewer',
        ],
      },
      {
        name: 'Specimens',
        fhirType: 'Specimen',
        description: 'Blood, urine, tissue samples collected for testing',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canSearch: true,
        exampleQueries: [
          'Get specimen collection info',
          'View sample types',
          'Check collection dates',
        ],
        appIdeas: [
          'Specimen tracking system',
          'Lab collection scheduler',
        ],
      },
    ],
  },
  {
    id: 'immunizations',
    name: 'Immunizations',
    description: 'Vaccination records and immunization recommendations',
    icon: Syringe,
    color: 'teal',
    resources: [
      {
        name: 'Immunizations',
        fhirType: 'Immunization',
        description: 'Vaccines administered, dates, lot numbers',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canSearch: true,
        exampleQueries: [
          'Get vaccination history',
          'Check COVID vaccine status',
          'View flu shot records',
          'Get childhood immunizations',
        ],
        appIdeas: [
          'Vaccination record viewer',
          'Immunization passport',
          'Vaccine reminder app',
          'School/travel vaccine checker',
        ],
      },
      {
        name: 'Immunization Recommendations',
        fhirType: 'ImmunizationRecommendation',
        description: 'Recommended vaccines based on age, conditions, schedule',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canSearch: true,
        exampleQueries: [
          'Get recommended vaccines',
          'Check overdue immunizations',
          'View vaccination schedule',
        ],
        appIdeas: [
          'Vaccine scheduler',
          'Immunization gap finder',
          'Pediatric vaccine tracker',
        ],
      },
    ],
  },
  {
    id: 'procedures',
    name: 'Procedures & Services',
    description: 'Surgical procedures, clinical services, and service requests',
    icon: Stethoscope,
    color: 'orange',
    resources: [
      {
        name: 'Procedures',
        fhirType: 'Procedure',
        description: 'Surgeries, treatments, and clinical procedures performed',
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canSearch: true,
        exampleQueries: [
          'Get surgical history',
          'View recent procedures',
          'Check procedure outcomes',
        ],
        appIdeas: [
          'Surgical history timeline',
          'Procedure consent tracker',
          'Post-op care instructions app',
        ],
      },
      {
        name: 'Service Requests',
        fhirType: 'ServiceRequest',
        description: 'Orders for procedures, referrals, consultations',
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canSearch: true,
        exampleQueries: [
          'Get pending orders',
          'View referrals',
          'Check consultation requests',
        ],
        appIdeas: [
          'Referral tracker',
          'Order status viewer',
          'Consultation scheduler',
        ],
      },
      {
        name: 'Device Requests',
        fhirType: 'DeviceRequest',
        description: 'Orders for medical devices and equipment',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canSearch: true,
        exampleQueries: [
          'Get DME orders',
          'View device requests',
          'Check equipment orders',
        ],
        appIdeas: [
          'Medical equipment tracker',
          'DME order manager',
        ],
      },
    ],
  },
  {
    id: 'imaging',
    name: 'Imaging & Documents',
    description: 'Radiology images, clinical documents, and media',
    icon: ImageIcon,
    color: 'indigo',
    resources: [
      {
        name: 'Imaging Studies',
        fhirType: 'ImagingStudy',
        description: 'X-rays, CT scans, MRIs, ultrasounds',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canSearch: true,
        exampleQueries: [
          'Get imaging studies',
          'View X-ray records',
          'Check MRI history',
          'Get study links/DICOM',
        ],
        appIdeas: [
          'Imaging history viewer',
          'Radiology results app',
          'Image comparison tool',
        ],
      },
      {
        name: 'Documents',
        fhirType: 'DocumentReference',
        description: 'Clinical notes, discharge summaries, consent forms, PDFs',
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canSearch: true,
        exampleQueries: [
          'Get clinical notes',
          'View discharge summaries',
          'Get consent documents',
          'Upload patient documents',
        ],
        appIdeas: [
          'Document viewer/organizer',
          'Patient document upload portal',
          'Clinical note summarizer',
          'Consent form manager',
        ],
      },
      {
        name: 'Media',
        fhirType: 'Media',
        description: 'Photos, videos, audio recordings related to care',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canSearch: true,
        exampleQueries: [
          'Get wound photos',
          'View clinical images',
          'Access media attachments',
        ],
        appIdeas: [
          'Clinical photo viewer',
          'Wound healing tracker',
          'Before/after comparison tool',
        ],
      },
    ],
  },
  {
    id: 'encounters',
    name: 'Visits & Appointments',
    description: 'Encounters, appointments, and scheduling',
    icon: Calendar,
    color: 'cyan',
    resources: [
      {
        name: 'Encounters',
        fhirType: 'Encounter',
        description: 'Office visits, hospital stays, ER visits, telehealth',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canSearch: true,
        exampleQueries: [
          'Get visit history',
          'View hospitalizations',
          'Check ER visits',
          'Get encounter details',
        ],
        appIdeas: [
          'Visit history timeline',
          'Hospital stay tracker',
          'Care continuity viewer',
        ],
      },
      {
        name: 'Appointments',
        fhirType: 'Appointment',
        description: 'Scheduled and past appointments',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canSearch: true,
        exampleQueries: [
          'Get upcoming appointments',
          'View past appointments',
          'Check appointment status',
        ],
        appIdeas: [
          'Appointment reminder app',
          'Visit preparation checklist',
          'Scheduling overview calendar',
        ],
      },
      {
        name: 'Episode of Care',
        fhirType: 'EpisodeOfCare',
        description: 'Episodes grouping related encounters (e.g., pregnancy, cancer treatment)',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canSearch: true,
        exampleQueries: [
          'Get care episodes',
          'View pregnancy episodes',
          'Check oncology episodes',
        ],
        appIdeas: [
          'Treatment journey tracker',
          'Pregnancy care timeline',
          'Episode-based care viewer',
        ],
      },
    ],
  },
  {
    id: 'care-plans',
    name: 'Care Plans & Goals',
    description: 'Treatment plans, goals, and care coordination',
    icon: Target,
    color: 'pink',
    resources: [
      {
        name: 'Care Plans',
        fhirType: 'CarePlan',
        description: 'Treatment plans, care protocols, wellness plans',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canSearch: true,
        exampleQueries: [
          'Get active care plans',
          'View treatment protocols',
          'Check diabetes care plan',
        ],
        appIdeas: [
          'Care plan viewer',
          'Treatment checklist app',
          'Patient action item tracker',
        ],
      },
      {
        name: 'Goals',
        fhirType: 'Goal',
        description: 'Patient health goals and targets',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canSearch: true,
        exampleQueries: [
          'Get health goals',
          'View goal progress',
          'Check target values',
        ],
        appIdeas: [
          'Goal progress tracker',
          'Health achievement app',
          'Motivational dashboard',
        ],
      },
      {
        name: 'Care Team',
        fhirType: 'CareTeam',
        description: 'Healthcare providers involved in patient care',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canSearch: true,
        exampleQueries: [
          'Get care team members',
          'View primary care provider',
          'Check specialists on team',
        ],
        appIdeas: [
          'Care team directory',
          'Provider contact app',
          'Team communication hub',
        ],
      },
    ],
  },
  {
    id: 'communication',
    name: 'Communication',
    description: 'Messages, questionnaires, and patient engagement',
    icon: MessageSquare,
    color: 'yellow',
    resources: [
      {
        name: 'Communications',
        fhirType: 'Communication',
        description: 'Messages between patients and providers',
        canRead: true,
        canCreate: true,
        canUpdate: false,
        canSearch: true,
        exampleQueries: [
          'Get patient messages',
          'View provider communications',
          'Send secure message',
        ],
        appIdeas: [
          'Secure messaging app',
          'Patient inbox',
          'Care team chat',
        ],
      },
      {
        name: 'Questionnaires',
        fhirType: 'Questionnaire',
        description: 'Health assessments, intake forms, surveys',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canSearch: true,
        exampleQueries: [
          'Get available questionnaires',
          'View intake forms',
          'Check screening tools',
        ],
        appIdeas: [
          'Pre-visit questionnaire app',
          'Health assessment tool',
          'Symptom checker',
        ],
      },
      {
        name: 'Questionnaire Responses',
        fhirType: 'QuestionnaireResponse',
        description: 'Completed questionnaires and survey answers',
        canRead: true,
        canCreate: true,
        canUpdate: false,
        canSearch: true,
        exampleQueries: [
          'Submit questionnaire',
          'View past responses',
          'Get assessment scores',
        ],
        appIdeas: [
          'Survey completion app',
          'PRO submission tool',
          'Screening result viewer',
        ],
      },
    ],
  },
  {
    id: 'billing',
    name: 'Billing & Insurance',
    description: 'Coverage, claims, and financial information',
    icon: CreditCard,
    color: 'emerald',
    resources: [
      {
        name: 'Coverage',
        fhirType: 'Coverage',
        description: 'Insurance plans, member IDs, coverage details',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canSearch: true,
        exampleQueries: [
          'Get insurance info',
          'View coverage details',
          'Check member ID',
        ],
        appIdeas: [
          'Insurance card viewer',
          'Coverage verification app',
          'Benefits checker',
        ],
      },
      {
        name: 'Claims',
        fhirType: 'Claim',
        description: 'Submitted insurance claims',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canSearch: true,
        exampleQueries: [
          'Get submitted claims',
          'View claim status',
          'Check claim amounts',
        ],
        appIdeas: [
          'Claim status tracker',
          'Billing history viewer',
        ],
      },
      {
        name: 'Explanation of Benefits',
        fhirType: 'ExplanationOfBenefit',
        description: 'EOB statements showing what insurance paid',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canSearch: true,
        exampleQueries: [
          'Get EOB statements',
          'View payment breakdown',
          'Check patient responsibility',
        ],
        appIdeas: [
          'EOB viewer',
          'Cost breakdown app',
          'Payment history tracker',
        ],
      },
    ],
  },
  {
    id: 'providers',
    name: 'Providers & Organizations',
    description: 'Healthcare providers, facilities, and organizations',
    icon: Building2,
    color: 'slate',
    resources: [
      {
        name: 'Practitioners',
        fhirType: 'Practitioner',
        description: 'Doctors, nurses, and other healthcare providers',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canSearch: true,
        exampleQueries: [
          'Get provider details',
          'Search by specialty',
          'View credentials',
        ],
        appIdeas: [
          'Provider directory',
          'Specialist finder',
          'Provider profile viewer',
        ],
      },
      {
        name: 'Organizations',
        fhirType: 'Organization',
        description: 'Hospitals, clinics, insurance companies',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canSearch: true,
        exampleQueries: [
          'Get organization details',
          'View facility info',
          'Check department info',
        ],
        appIdeas: [
          'Facility finder',
          'Organization directory',
        ],
      },
      {
        name: 'Locations',
        fhirType: 'Location',
        description: 'Physical locations, rooms, buildings',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canSearch: true,
        exampleQueries: [
          'Get location details',
          'View address and hours',
          'Find nearby locations',
        ],
        appIdeas: [
          'Location finder with maps',
          'Facility wayfinding app',
        ],
      },
    ],
  },
];

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; light: string }> = {
  blue: { bg: 'bg-blue-500', text: 'text-blue-600', border: 'border-blue-500', light: 'bg-blue-50 dark:bg-blue-950/30' },
  red: { bg: 'bg-red-500', text: 'text-red-600', border: 'border-red-500', light: 'bg-red-50 dark:bg-red-950/30' },
  green: { bg: 'bg-green-500', text: 'text-green-600', border: 'border-green-500', light: 'bg-green-50 dark:bg-green-950/30' },
  purple: { bg: 'bg-purple-500', text: 'text-purple-600', border: 'border-purple-500', light: 'bg-purple-50 dark:bg-purple-950/30' },
  teal: { bg: 'bg-teal-500', text: 'text-teal-600', border: 'border-teal-500', light: 'bg-teal-50 dark:bg-teal-950/30' },
  orange: { bg: 'bg-orange-500', text: 'text-orange-600', border: 'border-orange-500', light: 'bg-orange-50 dark:bg-orange-950/30' },
  indigo: { bg: 'bg-indigo-500', text: 'text-indigo-600', border: 'border-indigo-500', light: 'bg-indigo-50 dark:bg-indigo-950/30' },
  cyan: { bg: 'bg-cyan-500', text: 'text-cyan-600', border: 'border-cyan-500', light: 'bg-cyan-50 dark:bg-cyan-950/30' },
  pink: { bg: 'bg-pink-500', text: 'text-pink-600', border: 'border-pink-500', light: 'bg-pink-50 dark:bg-pink-950/30' },
  yellow: { bg: 'bg-yellow-500', text: 'text-yellow-600', border: 'border-yellow-500', light: 'bg-yellow-50 dark:bg-yellow-950/30' },
  emerald: { bg: 'bg-emerald-500', text: 'text-emerald-600', border: 'border-emerald-500', light: 'bg-emerald-50 dark:bg-emerald-950/30' },
  slate: { bg: 'bg-slate-500', text: 'text-slate-600', border: 'border-slate-500', light: 'bg-slate-50 dark:bg-slate-950/30' },
};

interface Props {
  onSelectIdea?: (idea: string, resources: string[]) => void;
  compact?: boolean;
}

export function EpicCapabilitiesExplorer({ onSelectIdea, compact = false }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['patient-info', 'conditions', 'vitals-labs']));
  const [selectedCapability, setSelectedCapability] = useState<'all' | 'read' | 'write'>('all');

  const filteredCategories = useMemo(() => {
    if (!searchQuery && selectedCapability === 'all') return EPIC_CAPABILITIES;

    const query = searchQuery.toLowerCase();

    return EPIC_CAPABILITIES.map(category => {
      const filteredResources = category.resources.filter(resource => {
        // Filter by capability
        if (selectedCapability === 'write' && !resource.canCreate && !resource.canUpdate) return false;
        if (selectedCapability === 'read' && !resource.canRead) return false;

        // Filter by search query
        if (!query) return true;

        return (
          resource.name.toLowerCase().includes(query) ||
          resource.description.toLowerCase().includes(query) ||
          resource.fhirType.toLowerCase().includes(query) ||
          resource.appIdeas.some(idea => idea.toLowerCase().includes(query)) ||
          resource.exampleQueries.some(q => q.toLowerCase().includes(query))
        );
      });

      return { ...category, resources: filteredResources };
    }).filter(category => category.resources.length > 0);
  }, [searchQuery, selectedCapability]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleSelectIdea = (idea: string, category: EpicCategory, resource: EpicResource) => {
    if (onSelectIdea) {
      const resourceList = [resource.fhirType];
      // Add related resources based on the idea
      if (idea.toLowerCase().includes('patient')) resourceList.push('Patient');
      onSelectIdea(idea, [...new Set(resourceList)]);
    }
  };

  const totalResources = EPIC_CAPABILITIES.reduce((sum, cat) => sum + cat.resources.length, 0);
  const writableResources = EPIC_CAPABILITIES.reduce(
    (sum, cat) => sum + cat.resources.filter(r => r.canCreate || r.canUpdate).length,
    0
  );

  return (
    <div className={cn("flex flex-col", compact ? "h-full" : "")}>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Heart className="h-5 w-5 text-red-500" />
          <h2 className="text-lg font-semibold">Epic FHIR Capabilities</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Explore {totalResources} data types available from Epic EHR. {writableResources} support creating or updating data.
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search capabilities, app ideas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setSelectedCapability('all')}
            className={cn(
              "px-3 py-2 text-sm rounded-lg border transition-colors",
              selectedCapability === 'all'
                ? "bg-primary text-primary-foreground border-primary"
                : "hover:bg-muted"
            )}
          >
            All
          </button>
          <button
            onClick={() => setSelectedCapability('read')}
            className={cn(
              "px-3 py-2 text-sm rounded-lg border transition-colors flex items-center gap-1",
              selectedCapability === 'read'
                ? "bg-blue-600 text-white border-blue-600"
                : "hover:bg-muted"
            )}
          >
            <Eye className="h-3 w-3" />
            Read
          </button>
          <button
            onClick={() => setSelectedCapability('write')}
            className={cn(
              "px-3 py-2 text-sm rounded-lg border transition-colors flex items-center gap-1",
              selectedCapability === 'write'
                ? "bg-green-600 text-white border-green-600"
                : "hover:bg-muted"
            )}
          >
            <PenLine className="h-3 w-3" />
            Write
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className={cn("space-y-2 overflow-y-auto", compact ? "flex-1" : "")}>
        {filteredCategories.map((category) => {
          const colors = COLOR_MAP[category.color] || COLOR_MAP.blue;
          const Icon = category.icon;
          const isExpanded = expandedCategories.has(category.id);

          return (
            <div key={category.id} className="border rounded-lg overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 text-left transition-colors",
                  "hover:bg-muted/50",
                  isExpanded && colors.light
                )}
              >
                <div className={cn("p-2 rounded-lg", colors.bg, "text-white")}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm">{category.name}</h3>
                  <p className="text-xs text-muted-foreground truncate">{category.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{category.resources.length} types</span>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Resources */}
              {isExpanded && (
                <div className="border-t divide-y">
                  {category.resources.map((resource) => (
                    <div key={resource.fhirType} className="p-3 space-y-2">
                      {/* Resource Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-medium text-sm">{resource.name}</h4>
                          <p className="text-xs text-muted-foreground">{resource.description}</p>
                        </div>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">
                          {resource.fhirType}
                        </code>
                      </div>

                      {/* Capabilities */}
                      <div className="flex flex-wrap gap-1">
                        {resource.canRead && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                            <Eye className="h-3 w-3" /> Read
                          </span>
                        )}
                        {resource.canSearch && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                            <Search className="h-3 w-3" /> Search
                          </span>
                        )}
                        {resource.canCreate && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                            <PenLine className="h-3 w-3" /> Create
                          </span>
                        )}
                        {resource.canUpdate && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300">
                            <RefreshCw className="h-3 w-3" /> Update
                          </span>
                        )}
                      </div>

                      {/* Example Queries */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Example queries:</p>
                        <div className="flex flex-wrap gap-1">
                          {resource.exampleQueries.slice(0, 3).map((query, i) => (
                            <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded">
                              {query}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* App Ideas */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                          <Lightbulb className="h-3 w-3" /> App ideas:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {resource.appIdeas.map((idea, i) => (
                            <button
                              key={i}
                              onClick={() => handleSelectIdea(idea, category, resource)}
                              className={cn(
                                "text-xs px-2 py-1 rounded-lg border transition-colors",
                                "hover:bg-primary hover:text-primary-foreground hover:border-primary",
                                "flex items-center gap-1"
                              )}
                            >
                              <Zap className="h-3 w-3" />
                              {idea}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredCategories.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No capabilities match your search</p>
        </div>
      )}
    </div>
  );
}

export default EpicCapabilitiesExplorer;
