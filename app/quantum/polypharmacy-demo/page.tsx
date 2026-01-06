'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  Play,
  ChevronLeft,
  Pill,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  Loader2,
  Zap,
  Brain,
  BarChart3,
  Atom,
  Heart,
  Droplets,
  Shield,
  FileText,
  Users,
  TrendingUp,
  AlertCircle,
  Info,
  Sparkles,
  Gauge,
  RotateCcw,
} from 'lucide-react';

// Types
interface PlacedGate {
  id: string;
  gate: string;
  qubit: number;
  column: number;
  controlQubits?: number[];
  params?: { theta?: number };
  reason?: string;
}

interface DrugInteraction {
  drugs: number[];
  severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
  riskType: 'bleeding' | 'cardiac' | 'renal' | 'metabolic' | 'cns';
  description: string;
  clinicalNote: string;
  gateSequence: string[]; // What quantum gates to apply
}

interface PatientScenario {
  id: string;
  name: string;
  age: number;
  weight: number;
  description: string;
  medications: number[];
  conditions: string[];
  renalFunction: 'normal' | 'mild' | 'moderate' | 'severe';
  hepaticFunction: 'normal' | 'mild' | 'moderate' | 'severe';
}

// 12-Qubit Drug Class Definitions
const DRUG_CLASSES: {
  id: number;
  name: string;
  shortName: string;
  examples: string[];
  color: string;
  icon: typeof Pill;
  description: string;
  halfLife: string;
  cyp450: string[];
}[] = [
  {
    id: 0,
    name: 'Anticoagulant',
    shortName: 'AC',
    examples: ['Warfarin', 'Apixaban', 'Rivaroxaban', 'Enoxaparin'],
    color: 'bg-red-500',
    icon: Droplets,
    description: 'Blood thinners - prevent clots',
    halfLife: '20-60h (warfarin)',
    cyp450: ['CYP2C9', 'CYP3A4'],
  },
  {
    id: 1,
    name: 'NSAID/Antiplatelet',
    shortName: 'NSAID',
    examples: ['Aspirin', 'Ibuprofen', 'Naproxen', 'Clopidogrel'],
    color: 'bg-orange-500',
    icon: Pill,
    description: 'Pain/inflammation - affects platelets',
    halfLife: '2-4h (ibuprofen)',
    cyp450: ['CYP2C9'],
  },
  {
    id: 2,
    name: 'Beta Blocker',
    shortName: 'BB',
    examples: ['Metoprolol', 'Atenolol', 'Carvedilol', 'Propranolol'],
    color: 'bg-blue-500',
    icon: Heart,
    description: 'Heart rate/BP control',
    halfLife: '3-7h',
    cyp450: ['CYP2D6'],
  },
  {
    id: 3,
    name: 'ACE-i/ARB',
    shortName: 'ACEi',
    examples: ['Lisinopril', 'Losartan', 'Valsartan', 'Enalapril'],
    color: 'bg-indigo-500',
    icon: Activity,
    description: 'Blood pressure - kidney protective',
    halfLife: '12h',
    cyp450: ['CYP2C9', 'CYP3A4'],
  },
  {
    id: 4,
    name: 'Statin',
    shortName: 'STAT',
    examples: ['Atorvastatin', 'Simvastatin', 'Rosuvastatin', 'Pravastatin'],
    color: 'bg-yellow-500',
    icon: TrendingUp,
    description: 'Cholesterol lowering',
    halfLife: '14h (atorvastatin)',
    cyp450: ['CYP3A4'],
  },
  {
    id: 5,
    name: 'Antidiabetic',
    shortName: 'DM',
    examples: ['Metformin', 'Glipizide', 'Insulin', 'Empagliflozin'],
    color: 'bg-green-500',
    icon: Activity,
    description: 'Blood sugar control',
    halfLife: '6h (metformin)',
    cyp450: [],
  },
  {
    id: 6,
    name: 'PPI',
    shortName: 'PPI',
    examples: ['Omeprazole', 'Pantoprazole', 'Esomeprazole', 'Lansoprazole'],
    color: 'bg-purple-500',
    icon: Shield,
    description: 'Stomach acid reducers',
    halfLife: '1-2h',
    cyp450: ['CYP2C19', 'CYP3A4'],
  },
  {
    id: 7,
    name: 'SSRI/SNRI',
    shortName: 'SSRI',
    examples: ['Sertraline', 'Fluoxetine', 'Duloxetine', 'Venlafaxine'],
    color: 'bg-pink-500',
    icon: Brain,
    description: 'Antidepressants',
    halfLife: '26h (sertraline)',
    cyp450: ['CYP2D6', 'CYP3A4'],
  },
  {
    id: 8,
    name: 'Fluoroquinolone',
    shortName: 'FQ',
    examples: ['Ciprofloxacin', 'Levofloxacin', 'Moxifloxacin'],
    color: 'bg-cyan-500',
    icon: Zap,
    description: 'Antibiotics - QT prolongation risk',
    halfLife: '4h (cipro)',
    cyp450: ['CYP1A2'],
  },
  {
    id: 9,
    name: 'Corticosteroid',
    shortName: 'STER',
    examples: ['Prednisone', 'Dexamethasone', 'Methylprednisolone', 'Hydrocortisone'],
    color: 'bg-amber-500',
    icon: Sparkles,
    description: 'Anti-inflammatory steroids',
    halfLife: '3h (prednisone)',
    cyp450: ['CYP3A4'],
  },
  {
    id: 10,
    name: 'Opioid',
    shortName: 'OPI',
    examples: ['Oxycodone', 'Hydrocodone', 'Morphine', 'Tramadol', 'Fentanyl'],
    color: 'bg-rose-600',
    icon: AlertTriangle,
    description: 'Pain management - CNS/respiratory depression',
    halfLife: '3-4h (oxycodone)',
    cyp450: ['CYP3A4', 'CYP2D6'],
  },
  {
    id: 11,
    name: 'Benzodiazepine',
    shortName: 'BZD',
    examples: ['Lorazepam', 'Alprazolam', 'Diazepam', 'Clonazepam'],
    color: 'bg-violet-500',
    icon: Brain,
    description: 'Anxiety/sleep - CNS depression',
    halfLife: '12h (lorazepam)',
    cyp450: ['CYP3A4'],
  },
];

// Evidence-based drug interactions with quantum gate mappings
const DRUG_INTERACTIONS: DrugInteraction[] = [
  // === BLEEDING RISK INTERACTIONS ===
  {
    drugs: [0, 1],
    severity: 'major',
    riskType: 'bleeding',
    description: 'Anticoagulant + NSAID: Major bleeding risk (4-6x increased)',
    clinicalNote: 'GI bleeding risk dramatically increased. Mandatory PPI gastroprotection. Consider alternative analgesic.',
    gateSequence: ['cx', 'ry', 'rz'],
  },
  {
    drugs: [0, 7],
    severity: 'moderate',
    riskType: 'bleeding',
    description: 'Anticoagulant + SSRI: Increased bleeding (2-3x)',
    clinicalNote: 'SSRIs inhibit platelet serotonin uptake. Monitor for bruising, GI bleeding.',
    gateSequence: ['cx', 'ry'],
  },
  {
    drugs: [1, 7],
    severity: 'moderate',
    riskType: 'bleeding',
    description: 'NSAID + SSRI: Synergistic GI bleeding risk',
    clinicalNote: 'Both affect platelet function via different mechanisms. Add PPI.',
    gateSequence: ['cx', 'ry'],
  },
  {
    drugs: [0, 9],
    severity: 'moderate',
    riskType: 'bleeding',
    description: 'Anticoagulant + Steroid: GI ulcer + bleeding risk',
    clinicalNote: 'Steroids cause GI ulceration. Combine with PPI for protection.',
    gateSequence: ['cx', 'ry'],
  },
  {
    drugs: [0, 1, 7],
    severity: 'contraindicated',
    riskType: 'bleeding',
    description: 'CRITICAL: Triple therapy (Anticoag + NSAID + SSRI)',
    clinicalNote: 'Extremely high bleeding risk. Must discontinue at least one agent. Mandatory specialist review.',
    gateSequence: ['ccx', 'ry', 'ry', 'rz'],
  },
  {
    drugs: [0, 1, 9],
    severity: 'contraindicated',
    riskType: 'bleeding',
    description: 'CRITICAL: Anticoag + NSAID + Steroid',
    clinicalNote: 'Triple GI risk. Life-threatening bleeding possible. Urgent medication review.',
    gateSequence: ['ccx', 'ry', 'ry', 'rz'],
  },
  // === CARDIAC/QT RISK INTERACTIONS ===
  {
    drugs: [2, 8],
    severity: 'moderate',
    riskType: 'cardiac',
    description: 'Beta Blocker + Fluoroquinolone: QT prolongation',
    clinicalNote: 'Additive QT effects. Monitor ECG. Consider alternative antibiotic.',
    gateSequence: ['cx', 'rz'],
  },
  {
    drugs: [7, 8],
    severity: 'major',
    riskType: 'cardiac',
    description: 'SSRI + Fluoroquinolone: Significant QT prolongation',
    clinicalNote: 'High Torsades de Pointes risk. Avoid combination. Use alternative antibiotic.',
    gateSequence: ['cx', 'ry', 'rz'],
  },
  {
    drugs: [2, 7, 8],
    severity: 'contraindicated',
    riskType: 'cardiac',
    description: 'CRITICAL: BB + SSRI + Fluoroquinolone: Severe QT risk',
    clinicalNote: 'Multiple QT-prolonging agents. High arrhythmia risk. Mandatory ECG monitoring or change regimen.',
    gateSequence: ['ccx', 'ry', 'ry', 'rz', 'rz'],
  },
  {
    drugs: [7, 10],
    severity: 'major',
    riskType: 'cardiac',
    description: 'SSRI + Opioid (esp. Tramadol): Serotonin syndrome',
    clinicalNote: 'Tramadol has serotonergic activity. Watch for hyperthermia, agitation, tremor.',
    gateSequence: ['cx', 'ry', 'rz'],
  },
  // === CNS DEPRESSION INTERACTIONS ===
  {
    drugs: [10, 11],
    severity: 'contraindicated',
    riskType: 'cns',
    description: 'CRITICAL: Opioid + Benzodiazepine - FDA Black Box Warning',
    clinicalNote: 'Concurrent use dramatically increases overdose death risk. Avoid if possible. If necessary, use lowest doses.',
    gateSequence: ['cx', 'ry', 'ry', 'rz', 'h'],
  },
  {
    drugs: [7, 11],
    severity: 'moderate',
    riskType: 'cns',
    description: 'SSRI + Benzodiazepine: Enhanced sedation',
    clinicalNote: 'Increased CNS depression. Monitor for excessive sedation, fall risk.',
    gateSequence: ['cx', 'ry'],
  },
  {
    drugs: [10, 11, 7],
    severity: 'contraindicated',
    riskType: 'cns',
    description: 'CRITICAL: Opioid + Benzo + SSRI: Maximum CNS risk',
    clinicalNote: 'Triple CNS depressant effect. Respiratory failure risk. Immediate medication review required.',
    gateSequence: ['ccx', 'ry', 'ry', 'ry', 'rz', 'h'],
  },
  // === RENAL RISK INTERACTIONS ===
  {
    drugs: [1, 3],
    severity: 'major',
    riskType: 'renal',
    description: 'NSAID + ACE-i/ARB: Acute kidney injury risk',
    clinicalNote: 'NSAIDs block prostaglandins needed for renal perfusion with ACE-i. Monitor creatinine.',
    gateSequence: ['cx', 'ry', 'rz'],
  },
  {
    drugs: [1, 3, 5],
    severity: 'contraindicated',
    riskType: 'renal',
    description: 'CRITICAL: "Triple Whammy" - NSAID + ACE-i + Diuretic/DM',
    clinicalNote: 'High AKI risk especially in elderly or dehydrated. Avoid combination.',
    gateSequence: ['ccx', 'ry', 'ry', 'rz'],
  },
  {
    drugs: [5, 8],
    severity: 'moderate',
    riskType: 'renal',
    description: 'Metformin + Fluoroquinolone: Dysglycemia risk',
    clinicalNote: 'Fluoroquinolones can cause both hypo- and hyperglycemia. Monitor blood glucose closely.',
    gateSequence: ['cx', 'ry'],
  },
  // === METABOLIC INTERACTIONS ===
  {
    drugs: [4, 8],
    severity: 'major',
    riskType: 'metabolic',
    description: 'Statin + Fluoroquinolone: Rhabdomyolysis risk',
    clinicalNote: 'CYP3A4 inhibition increases statin levels. Watch for muscle pain, dark urine.',
    gateSequence: ['cx', 'ry', 'rz'],
  },
  {
    drugs: [5, 9],
    severity: 'moderate',
    riskType: 'metabolic',
    description: 'Antidiabetic + Steroid: Hyperglycemia',
    clinicalNote: 'Steroids cause insulin resistance. May need 2-3x insulin dose increase.',
    gateSequence: ['cx', 'ry'],
  },
  {
    drugs: [0, 6],
    severity: 'minor',
    riskType: 'metabolic',
    description: 'Warfarin + PPI: Altered INR',
    clinicalNote: 'PPIs may slightly increase warfarin effect. Monitor INR for first 2 weeks.',
    gateSequence: ['cx'],
  },
  {
    drugs: [4, 6],
    severity: 'minor',
    riskType: 'metabolic',
    description: 'Statin + PPI: Possible increased statin exposure',
    clinicalNote: 'CYP2C19 inhibition. Usually not clinically significant but monitor.',
    gateSequence: ['cx'],
  },
  {
    drugs: [6, 7],
    severity: 'moderate',
    riskType: 'metabolic',
    description: 'PPI + SSRI: Increased SSRI levels',
    clinicalNote: 'CYP2C19 inhibition (omeprazole). May increase sertraline/citalopram levels.',
    gateSequence: ['cx', 'ry'],
  },
  // === COMPLEX MULTI-DRUG INTERACTIONS ===
  {
    drugs: [0, 1, 3, 9],
    severity: 'contraindicated',
    riskType: 'renal',
    description: 'CRITICAL: Quad therapy - AC + NSAID + ACE-i + Steroid',
    clinicalNote: 'Maximum bleeding AND renal risk. Life-threatening. Immediate intervention.',
    gateSequence: ['ccx', 'cx', 'ry', 'ry', 'ry', 'rz', 'rz'],
  },
  {
    drugs: [2, 3, 5],
    severity: 'moderate',
    riskType: 'metabolic',
    description: 'BB + ACE-i + Antidiabetic: Hypoglycemia masking',
    clinicalNote: 'Beta blockers mask hypoglycemia symptoms. Educate patient on alternative warning signs.',
    gateSequence: ['ccx', 'ry'],
  },
  {
    drugs: [4, 7, 8],
    severity: 'major',
    riskType: 'metabolic',
    description: 'Statin + SSRI + Fluoroquinolone: CYP450 overload',
    clinicalNote: 'Multiple CYP3A4 interactions. High rhabdomyolysis and QT risk.',
    gateSequence: ['ccx', 'ry', 'ry', 'rz'],
  },
];

// Complex realistic patient scenarios using all 12 qubits
const PATIENT_SCENARIOS: PatientScenario[] = [
  {
    id: 'healthy-minimal',
    name: 'Healthy Adult (Baseline)',
    age: 35,
    weight: 75,
    description: 'Young adult with controlled hypertension only',
    medications: [3],
    conditions: ['Essential Hypertension'],
    renalFunction: 'normal',
    hepaticFunction: 'normal',
  },
  {
    id: 'post-mi-stent',
    name: 'Post-MI with Stent (DAPT)',
    age: 58,
    weight: 82,
    description: 'Recent MI, drug-eluting stent, on dual antiplatelet therapy',
    medications: [0, 1, 2, 3, 4, 6],
    conditions: ['STEMI', 'PCI with DES', 'Hyperlipidemia', 'HTN', 'GERD'],
    renalFunction: 'mild',
    hepaticFunction: 'normal',
  },
  {
    id: 'afib-elderly',
    name: 'Elderly A-Fib + Arthritis',
    age: 78,
    weight: 68,
    description: 'Anticoagulated for A-fib, chronic arthritis pain, depression',
    medications: [0, 1, 6, 7, 9],
    conditions: ['Atrial Fibrillation', 'Osteoarthritis', 'Major Depression', 'GERD'],
    renalFunction: 'moderate',
    hepaticFunction: 'normal',
  },
  {
    id: 'diabetic-ckd',
    name: 'Diabetic with CKD Stage 3',
    age: 67,
    weight: 95,
    description: 'Type 2 DM, chronic kidney disease, HTN, hyperlipidemia',
    medications: [3, 4, 5, 6],
    conditions: ['Type 2 Diabetes', 'CKD Stage 3b', 'Hypertension', 'Dyslipidemia'],
    renalFunction: 'moderate',
    hepaticFunction: 'normal',
  },
  {
    id: 'uti-elderly',
    name: 'Elderly UTI + Polypharmacy',
    age: 82,
    weight: 62,
    description: 'UTI requiring fluoroquinolone in patient on multiple cardiac meds',
    medications: [2, 3, 4, 7, 8],
    conditions: ['UTI', 'CHF', 'A-Fib', 'Depression', 'Hyperlipidemia'],
    renalFunction: 'mild',
    hepaticFunction: 'normal',
  },
  {
    id: 'chronic-pain',
    name: 'Chronic Pain + Anxiety',
    age: 45,
    weight: 78,
    description: 'Chronic pain syndrome, anxiety, insomnia - high-risk regimen',
    medications: [7, 10, 11],
    conditions: ['Chronic Pain Syndrome', 'Generalized Anxiety', 'Insomnia'],
    renalFunction: 'normal',
    hepaticFunction: 'normal',
  },
  {
    id: 'complex-elderly',
    name: 'Complex Geriatric (8 meds)',
    age: 84,
    weight: 58,
    description: 'Frail elderly on anticoagulation, pain meds, psych meds',
    medications: [0, 1, 2, 3, 6, 7, 9, 11],
    conditions: ['A-Fib', 'CHF', 'Osteoarthritis', 'Depression', 'Insomnia', 'GERD'],
    renalFunction: 'moderate',
    hepaticFunction: 'mild',
  },
  {
    id: 'max-polypharmacy',
    name: 'Maximum Polypharmacy (10 meds)',
    age: 76,
    weight: 71,
    description: 'Post-surgical patient with pain, infection, multiple comorbidities',
    medications: [0, 1, 2, 3, 4, 5, 6, 8, 9, 10],
    conditions: ['Post-op day 3', 'A-Fib', 'T2DM', 'HTN', 'Hyperlipidemia', 'Surgical site pain', 'Prophylactic antibiotics'],
    renalFunction: 'mild',
    hepaticFunction: 'mild',
  },
  {
    id: 'nightmare-scenario',
    name: 'High-Risk Full Panel (ALL 12)',
    age: 72,
    weight: 65,
    description: 'Extreme case study - all 12 drug classes active. Educational worst-case.',
    medications: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    conditions: ['A-Fib', 'Post-MI', 'T2DM', 'CKD', 'Depression', 'Anxiety', 'Chronic Pain', 'Infection', 'Arthritis', 'GERD'],
    renalFunction: 'moderate',
    hepaticFunction: 'moderate',
  },
];

// Gate definitions
const GATE_INFO: Record<string, { name: string; symbol: string; color: string; description: string }> = {
  x: { name: 'Drug Active', symbol: 'X', color: 'bg-red-500', description: 'Encodes drug presence (|0⟩→|1⟩)' },
  h: { name: 'Hadamard', symbol: 'H', color: 'bg-blue-500', description: 'Creates superposition of outcomes' },
  cx: { name: 'CNOT', symbol: 'CX', color: 'bg-indigo-500', description: 'Two-drug interaction entanglement' },
  ccx: { name: 'Toffoli', symbol: 'CCX', color: 'bg-amber-500', description: 'Three-drug interaction gate' },
  ry: { name: 'Y-Rotation', symbol: 'Ry', color: 'bg-purple-500', description: 'Risk amplitude encoding' },
  rz: { name: 'Z-Rotation', symbol: 'Rz', color: 'bg-teal-500', description: 'Phase encoding for severity' },
  swap: { name: 'SWAP', symbol: 'SW', color: 'bg-lime-500', description: 'Risk correlation transfer' },
  s: { name: 'S Gate', symbol: 'S', color: 'bg-cyan-500', description: 'π/2 phase shift' },
  t: { name: 'T Gate', symbol: 'T', color: 'bg-emerald-500', description: 'π/4 phase shift' },
};

const NUM_QUBITS = 12;

export default function PolypharmacyDemo() {
  // State
  const [selectedMedications, setSelectedMedications] = useState<number[]>([]);
  const [gates, setGates] = useState<PlacedGate[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [riskResults, setRiskResults] = useState<{
    bleeding: number;
    cardiac: number;
    renal: number;
    cns: number;
    metabolic: number;
    overall: number;
    interactions: DrugInteraction[];
    recommendations: string[];
    circuitDepth: number;
    entanglementCount: number;
  } | null>(null);
  const [measurementResults, setMeasurementResults] = useState<Record<string, number>>({});
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [shots, setShots] = useState(2048);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Toggle medication selection
  const toggleMedication = (drugId: number) => {
    setSelectedMedications((prev) =>
      prev.includes(drugId) ? prev.filter((id) => id !== drugId) : [...prev, drugId]
    );
    setAnalysisComplete(false);
    setRiskResults(null);
    setActiveScenario(null);
  };

  // Load a preset scenario
  const loadScenario = (scenario: PatientScenario) => {
    setSelectedMedications(scenario.medications);
    setActiveScenario(scenario.id);
    setAnalysisComplete(false);
    setRiskResults(null);
  };

  // Build sophisticated quantum circuit
  const buildCircuit = useCallback(() => {
    const newGates: PlacedGate[] = [];
    let column = 0;

    // ===== PHASE 1: Initial State Preparation =====
    // Apply X gates for active medications
    selectedMedications.forEach((drugId) => {
      newGates.push({
        id: `x-${drugId}-${column}`,
        gate: 'x',
        qubit: drugId,
        column,
        reason: `Activate ${DRUG_CLASSES[drugId].name}`,
      });
    });
    if (selectedMedications.length > 0) column++;

    // ===== PHASE 2: Superposition Layer =====
    // Add Hadamard gates to create superposition for outcome exploration
    // Apply H to qubits adjacent to active drugs to explore interaction space
    const adjacentQubits = new Set<number>();
    selectedMedications.forEach((drugId) => {
      if (drugId > 0 && !selectedMedications.includes(drugId - 1)) adjacentQubits.add(drugId - 1);
      if (drugId < 11 && !selectedMedications.includes(drugId + 1)) adjacentQubits.add(drugId + 1);
    });

    // Also add H to some active qubits to explore partial activation states
    if (selectedMedications.length >= 4) {
      selectedMedications.slice(0, Math.floor(selectedMedications.length / 2)).forEach((drugId) => {
        newGates.push({
          id: `h-${drugId}-${column}`,
          gate: 'h',
          qubit: drugId,
          column,
          reason: `Superposition: explore ${DRUG_CLASSES[drugId].shortName} interaction space`,
        });
      });
      column++;
    }

    // ===== PHASE 3: Interaction Encoding =====
    const activeInteractions = DRUG_INTERACTIONS.filter((interaction) =>
      interaction.drugs.every((drug) => selectedMedications.includes(drug))
    );

    // Group interactions by type for structured circuit building
    const interactionsByType = {
      twoBody: activeInteractions.filter((i) => i.drugs.length === 2),
      threeBody: activeInteractions.filter((i) => i.drugs.length >= 3),
    };

    // Apply two-body interactions (CX gates with rotations)
    interactionsByType.twoBody.forEach((interaction) => {
      // CX gate for entanglement
      newGates.push({
        id: `cx-${interaction.drugs.join('-')}-${column}`,
        gate: 'cx',
        qubit: interaction.drugs[0],
        column,
        controlQubits: [interaction.drugs[1]],
        reason: interaction.description,
      });
      column++;

      // Ry rotation based on severity
      const severityAngle =
        interaction.severity === 'contraindicated' ? Math.PI * 0.45 :
        interaction.severity === 'major' ? Math.PI * 0.35 :
        interaction.severity === 'moderate' ? Math.PI * 0.25 :
        Math.PI * 0.1;

      newGates.push({
        id: `ry-${interaction.drugs.join('-')}-${column}`,
        gate: 'ry',
        qubit: interaction.drugs[0],
        column,
        params: { theta: severityAngle },
        reason: `Risk amplitude: ${interaction.severity}`,
      });

      // Rz for phase encoding of risk type
      const phaseAngle =
        interaction.riskType === 'bleeding' ? Math.PI / 4 :
        interaction.riskType === 'cardiac' ? Math.PI / 3 :
        interaction.riskType === 'cns' ? Math.PI / 2 :
        interaction.riskType === 'renal' ? Math.PI / 5 :
        Math.PI / 6;

      newGates.push({
        id: `rz-${interaction.drugs.join('-')}-${column}`,
        gate: 'rz',
        qubit: interaction.drugs[1],
        column,
        params: { theta: phaseAngle },
        reason: `Phase encode: ${interaction.riskType} risk`,
      });
      column++;
    });

    // Apply three-body interactions (CCX/Toffoli gates)
    interactionsByType.threeBody.forEach((interaction) => {
      // CCX (Toffoli) gate for triple interactions
      newGates.push({
        id: `ccx-${interaction.drugs.join('-')}-${column}`,
        gate: 'ccx',
        qubit: interaction.drugs[0],
        column,
        controlQubits: [interaction.drugs[1], interaction.drugs[2]],
        reason: interaction.description,
      });
      column++;

      // Strong rotations for critical interactions
      const severityAngle =
        interaction.severity === 'contraindicated' ? Math.PI * 0.5 : Math.PI * 0.4;

      newGates.push({
        id: `ry-triple-${interaction.drugs.join('-')}-${column}`,
        gate: 'ry',
        qubit: interaction.drugs[0],
        column,
        params: { theta: severityAngle },
        reason: `CRITICAL risk amplification`,
      });

      newGates.push({
        id: `ry-triple2-${interaction.drugs.join('-')}-${column}`,
        gate: 'ry',
        qubit: interaction.drugs[1],
        column,
        params: { theta: severityAngle * 0.8 },
        reason: `Secondary risk amplification`,
      });
      column++;

      // Additional entanglement for severe interactions
      if (interaction.severity === 'contraindicated' && interaction.drugs.length >= 3) {
        newGates.push({
          id: `cx-cascade-${interaction.drugs.join('-')}-${column}`,
          gate: 'cx',
          qubit: interaction.drugs[1],
          column,
          controlQubits: [interaction.drugs[2]],
          reason: `Risk correlation cascade`,
        });
        column++;
      }
    });

    // ===== PHASE 4: Risk Correlation Layer =====
    // Add entanglement between risk-related drug pairs
    const riskPairs: [number, number][] = [
      [0, 1],   // Anticoag - NSAID (bleeding)
      [10, 11], // Opioid - Benzo (CNS)
      [7, 8],   // SSRI - FQ (cardiac)
      [1, 3],   // NSAID - ACE-i (renal)
    ];

    riskPairs.forEach(([q1, q2]) => {
      if (selectedMedications.includes(q1) && selectedMedications.includes(q2)) {
        // Check if we already have interaction gates for this pair
        const alreadyConnected = activeInteractions.some(
          (i) => i.drugs.includes(q1) && i.drugs.includes(q2)
        );
        if (!alreadyConnected) {
          newGates.push({
            id: `cx-corr-${q1}-${q2}-${column}`,
            gate: 'cx',
            qubit: q1,
            column,
            controlQubits: [q2],
            reason: `Risk correlation: ${DRUG_CLASSES[q1].shortName}-${DRUG_CLASSES[q2].shortName}`,
          });
        }
      }
    });
    if (selectedMedications.length >= 4) column++;

    // ===== PHASE 5: Final Interference Layer =====
    // Add final Hadamard gates to create interference patterns
    if (selectedMedications.length >= 3) {
      // Apply H to last few active qubits
      const lastActive = selectedMedications.slice(-2);
      lastActive.forEach((drugId) => {
        newGates.push({
          id: `h-final-${drugId}-${column}`,
          gate: 'h',
          qubit: drugId,
          column,
          reason: `Final superposition for measurement`,
        });
      });
      column++;
    }

    // ===== PHASE 6: Phase Kickback Layer =====
    // Add S and T gates for fine-grained phase control
    if (activeInteractions.some((i) => i.severity === 'contraindicated')) {
      const criticalDrugs = activeInteractions
        .filter((i) => i.severity === 'contraindicated')
        .flatMap((i) => i.drugs);

      const uniqueCritical = [...new Set(criticalDrugs)].slice(0, 3);
      uniqueCritical.forEach((drugId) => {
        newGates.push({
          id: `s-${drugId}-${column}`,
          gate: 's',
          qubit: drugId,
          column,
          reason: `Critical phase adjustment`,
        });
      });
      column++;
    }

    setGates(newGates);
    return newGates;
  }, [selectedMedications]);

  // Run quantum simulation
  const runAnalysis = async () => {
    if (selectedMedications.length === 0) return;

    setIsAnalyzing(true);
    setAnalysisComplete(false);

    // Build the circuit
    const circuitGates = buildCircuit();

    // Delay for effect
    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      // Prepare gates for API
      const gateList = circuitGates
        .sort((a, b) => a.column - b.column)
        .map((g) => ({
          gate: g.gate,
          qubit: g.qubit,
          targetQubit: g.controlQubits?.[0],
          control2: g.controlQubits?.[1],
          params: g.params?.theta ? [g.params.theta] : undefined,
        }));

      // Try Qiskit backend first
      const qiskitUrl = process.env.NEXT_PUBLIC_QISKIT_BACKEND_URL || 'http://localhost:5001';
      let simulationSuccess = false;
      let measurements: Record<string, number> = {};

      try {
        const response = await fetch(`${qiskitUrl}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ numQubits: NUM_QUBITS, gates: gateList, shots }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            measurements = data.results.measurements || data.results.counts || {};
            simulationSuccess = true;
          }
        }
      } catch {
        // Qiskit not available
      }

      if (!simulationSuccess) {
        // Fallback to JS simulator
        const { SimpleQuantumCircuit } = await import('@/lib/quantum-sim');
        const circuit = new SimpleQuantumCircuit(NUM_QUBITS);

        for (const placedGate of circuitGates.sort((a, b) => a.column - b.column)) {
          if (placedGate.gate === 'x') {
            circuit.addGate('x', placedGate.qubit);
          } else if (placedGate.gate === 'h') {
            circuit.addGate('h', placedGate.qubit);
          } else if (placedGate.gate === 's') {
            circuit.addGate('s', placedGate.qubit);
          } else if (placedGate.gate === 't') {
            circuit.addGate('t', placedGate.qubit);
          } else if (placedGate.gate === 'cx' && placedGate.controlQubits) {
            circuit.addGate('cx', placedGate.qubit, placedGate.controlQubits);
          } else if (placedGate.gate === 'ccx' && placedGate.controlQubits && placedGate.controlQubits.length >= 2) {
            circuit.addGate('ccx', placedGate.qubit, placedGate.controlQubits);
          } else if (placedGate.gate === 'ry' && placedGate.params?.theta) {
            circuit.addGate('ry', placedGate.qubit, undefined, { theta: placedGate.params.theta });
          } else if (placedGate.gate === 'rz' && placedGate.params?.theta) {
            circuit.addGate('rz', placedGate.qubit, undefined, { theta: placedGate.params.theta });
          }
        }

        const result = circuit.runWithMeasurements(shots);
        measurements = result.measurements;
      }

      setMeasurementResults(measurements);

      // Calculate risk scores based on measurement outcomes
      const activeInteractions = DRUG_INTERACTIONS.filter((interaction) =>
        interaction.drugs.every((drug) => selectedMedications.includes(drug))
      );

      // Analyze measurement distribution for risk calculation
      const totalMeasurements = Object.values(measurements).reduce((a, b) => a + b, 0);

      // Calculate "excited" state probability for risk estimation
      let excitedCount = 0;
      let highRiskPatterns = 0;

      Object.entries(measurements).forEach(([state, count]) => {
        // Count number of 1s in the state
        const ones = state.split('').filter((c) => c === '1').length;
        excitedCount += ones * count;

        // Check for high-risk patterns (many active qubits)
        if (ones >= Math.floor(selectedMedications.length * 0.7)) {
          highRiskPatterns += count;
        }
      });

      const avgExcitation = excitedCount / (totalMeasurements * NUM_QUBITS);
      const highRiskProbability = highRiskPatterns / totalMeasurements;

      // Calculate risk by type with quantum-informed adjustments
      const riskByType = {
        bleeding: 0,
        cardiac: 0,
        renal: 0,
        cns: 0,
        metabolic: 0,
      };

      activeInteractions.forEach((interaction) => {
        const baseSeverity =
          interaction.severity === 'contraindicated' ? 45 :
          interaction.severity === 'major' ? 30 :
          interaction.severity === 'moderate' ? 18 :
          8;

        // Quantum adjustment based on measurement distribution
        const quantumFactor = 1 + (highRiskProbability * 0.3) + (avgExcitation * 0.2);
        riskByType[interaction.riskType] += baseSeverity * quantumFactor;
      });

      // Add baseline risk for polypharmacy
      const polypharmacyBonus = Math.min(20, selectedMedications.length * 2);
      Object.keys(riskByType).forEach((key) => {
        riskByType[key as keyof typeof riskByType] += polypharmacyBonus * 0.3;
      });

      // Cap individual risks at 95%
      Object.keys(riskByType).forEach((key) => {
        riskByType[key as keyof typeof riskByType] = Math.min(95, Math.round(riskByType[key as keyof typeof riskByType]));
      });

      // Calculate overall risk
      const maxRisk = Math.max(...Object.values(riskByType));
      const avgRisk = Object.values(riskByType).reduce((a, b) => a + b, 0) / 5;
      const overallRisk = Math.min(98, Math.round(
        maxRisk * 0.5 +
        avgRisk * 0.3 +
        polypharmacyBonus +
        (highRiskProbability * 15)
      ));

      // Generate detailed recommendations
      const recommendations: string[] = [];

      if (riskByType.bleeding >= 40) {
        recommendations.push('🚨 HIGH BLEEDING RISK: Mandatory GI prophylaxis with PPI');
        recommendations.push('• Order baseline CBC, PT/INR if on anticoagulants');
        recommendations.push('• Educate patient on bleeding signs: black stools, bruising, dizziness');
      } else if (riskByType.bleeding >= 20) {
        recommendations.push('⚠️ MODERATE BLEEDING RISK: Consider PPI gastroprotection');
        recommendations.push('• Monitor for GI symptoms');
      }

      if (riskByType.cardiac >= 35) {
        recommendations.push('🚨 HIGH CARDIAC RISK: Order baseline ECG for QT assessment');
        recommendations.push('• Avoid additional QT-prolonging medications');
        recommendations.push('• Consider cardiology consult if QTc > 450ms');
      } else if (riskByType.cardiac >= 20) {
        recommendations.push('⚠️ MODERATE CARDIAC RISK: Monitor for palpitations, syncope');
      }

      if (riskByType.renal >= 35) {
        recommendations.push('🚨 HIGH RENAL RISK: Check BMP within 48-72 hours');
        recommendations.push('• Ensure adequate hydration');
        recommendations.push('• Consider nephrology consult if eGFR declining');
      } else if (riskByType.renal >= 20) {
        recommendations.push('⚠️ MODERATE RENAL RISK: Monitor creatinine and electrolytes');
      }

      if (riskByType.cns >= 40) {
        recommendations.push('🚨 HIGH CNS DEPRESSION RISK: FDA Black Box Warning applies');
        recommendations.push('• Prescribe naloxone for opioid reversal');
        recommendations.push('• Implement fall precautions');
        recommendations.push('• Consider sleep study if apnea suspected');
      } else if (riskByType.cns >= 20) {
        recommendations.push('⚠️ MODERATE CNS RISK: Warn about drowsiness, avoid driving');
      }

      if (riskByType.metabolic >= 30) {
        recommendations.push('⚠️ METABOLIC INTERACTION RISK:');
        if (selectedMedications.includes(4) && selectedMedications.includes(8)) {
          recommendations.push('• Monitor for muscle pain (rhabdomyolysis)');
          recommendations.push('• Check CK if symptoms develop');
        }
        if (selectedMedications.includes(5) && selectedMedications.includes(9)) {
          recommendations.push('• Anticipate hyperglycemia - may need insulin adjustment');
        }
      }

      // Polypharmacy warning
      if (selectedMedications.length >= 6) {
        recommendations.push(`📋 POLYPHARMACY ALERT: ${selectedMedications.length} medications active`);
        recommendations.push('• Schedule comprehensive medication review');
        recommendations.push('• Assess for deprescribing opportunities');
      }

      if (recommendations.length === 0) {
        recommendations.push('✅ No major interactions detected');
        recommendations.push('• Continue routine monitoring');
        recommendations.push('• Review medications at next visit');
      }

      // Calculate circuit metrics
      const circuitDepth = Math.max(...circuitGates.map((g) => g.column)) + 1;
      const entanglementCount = circuitGates.filter((g) => ['cx', 'ccx', 'swap'].includes(g.gate)).length;

      setRiskResults({
        bleeding: riskByType.bleeding,
        cardiac: riskByType.cardiac,
        renal: riskByType.renal,
        cns: riskByType.cns,
        metabolic: riskByType.metabolic,
        overall: overallRisk,
        interactions: activeInteractions,
        recommendations,
        circuitDepth,
        entanglementCount,
      });

      setAnalysisComplete(true);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Clear all
  const clearAll = () => {
    setSelectedMedications([]);
    setGates([]);
    setRiskResults(null);
    setMeasurementResults({});
    setAnalysisComplete(false);
    setActiveScenario(null);
  };

  // Risk color helpers
  const getRiskColor = (risk: number) => {
    if (risk >= 60) return 'text-red-400';
    if (risk >= 40) return 'text-orange-400';
    if (risk >= 20) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getRiskBg = (risk: number) => {
    if (risk >= 60) return 'from-red-500 to-red-600';
    if (risk >= 40) return 'from-orange-500 to-orange-600';
    if (risk >= 20) return 'from-yellow-500 to-yellow-600';
    return 'from-green-500 to-green-600';
  };

  const getRiskLabel = (risk: number) => {
    if (risk >= 70) return 'CRITICAL';
    if (risk >= 50) return 'HIGH';
    if (risk >= 30) return 'MODERATE';
    if (risk >= 15) return 'LOW-MOD';
    return 'LOW';
  };

  // Get circuit columns for visualization
  const maxColumn = gates.length > 0 ? Math.max(...gates.map((g) => g.column)) + 1 : 8;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-4 max-w-[1600px]">
        {/* Header */}
        <header className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Link href="/quantum">
              <Button variant="ghost" size="sm" className="text-white/60 hover:text-white">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </Link>
            <div className="h-6 w-px bg-white/20" />
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500">
                <Pill className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Quantum Polypharmacy Risk Analyzer</h1>
                <p className="text-xs text-white/50">12-Qubit Drug Interaction Analysis • {shots.toLocaleString()} Shots</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-purple-500/50 text-purple-300">
              <Atom className="h-3 w-3 mr-1" />
              {selectedMedications.length}/12 Meds
            </Badge>
            <Badge variant="outline" className="border-cyan-500/50 text-cyan-300">
              <Zap className="h-3 w-3 mr-1" />
              {gates.length} Gates
            </Badge>
            {riskResults && (
              <Badge variant="outline" className="border-indigo-500/50 text-indigo-300">
                Depth: {riskResults.circuitDepth} | Entanglement: {riskResults.entanglementCount}
              </Badge>
            )}
            <Link href="/quantum/claims-demo">
              <Badge variant="outline" className="border-blue-500/50 text-blue-300 cursor-pointer hover:bg-blue-500/10">
                <Activity className="h-3 w-3 mr-1" />
                Claims Demo
              </Badge>
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-4">
          {/* Left Panel - Medication Selection */}
          <div className="col-span-3 space-y-3">
            <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Pill className="h-4 w-4 text-purple-400" />
                  Drug Classes (12 Qubits)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[320px] pr-2">
                  <div className="space-y-1">
                    {DRUG_CLASSES.map((drug) => (
                      <TooltipProvider key={drug.id}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                'flex items-center gap-2 p-1.5 rounded cursor-pointer transition-all',
                                selectedMedications.includes(drug.id)
                                  ? 'bg-white/10 border border-white/20'
                                  : 'hover:bg-white/5 border border-transparent'
                              )}
                              onClick={() => toggleMedication(drug.id)}
                            >
                              <Checkbox
                                checked={selectedMedications.includes(drug.id)}
                                className="data-[state=checked]:bg-purple-500 h-4 w-4"
                              />
                              <div className={cn('w-7 h-7 rounded flex items-center justify-center text-white text-[10px] font-bold', drug.color)}>
                                {drug.shortName}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-white truncate">{drug.name}</p>
                                <p className="text-[10px] text-white/40 truncate">q[{drug.id}] • {drug.examples[0]}</p>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <p className="font-semibold">{drug.name}</p>
                            <p className="text-xs text-muted-foreground">{drug.description}</p>
                            <p className="text-xs mt-1">Examples: {drug.examples.join(', ')}</p>
                            <p className="text-xs mt-1">Half-life: {drug.halfLife}</p>
                            {drug.cyp450.length > 0 && (
                              <p className="text-xs">CYP450: {drug.cyp450.join(', ')}</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                </ScrollArea>

                {/* Shots Control */}
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-white/50 flex items-center gap-1">
                      <Gauge className="h-3 w-3" />
                      Measurement Shots
                    </span>
                    <Input
                      type="number"
                      value={shots}
                      onChange={(e) => setShots(Math.max(100, Math.min(10000, parseInt(e.target.value) || 1024)))}
                      className="w-20 h-6 text-xs bg-white/5 border-white/10 text-white text-right"
                    />
                  </div>
                  <Slider
                    value={[shots]}
                    min={100}
                    max={10000}
                    step={100}
                    onValueChange={([v]) => setShots(v)}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-white/30 mt-1">
                    <span>100</span>
                    <span>10,000</span>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <Button
                    className="flex-1 bg-gradient-to-r from-purple-500 to-cyan-500 text-white text-sm h-9"
                    onClick={runAnalysis}
                    disabled={selectedMedications.length === 0 || isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-1" />
                        Analyze
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/20 text-white hover:bg-white/10 h-9"
                    onClick={clearAll}
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Preset Scenarios */}
            <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-cyan-400" />
                  Clinical Scenarios
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-1">
                    {PATIENT_SCENARIOS.map((scenario) => (
                      <button
                        key={scenario.id}
                        className={cn(
                          'w-full p-2 rounded text-left transition-all',
                          activeScenario === scenario.id
                            ? 'bg-purple-500/20 border border-purple-500/50'
                            : 'bg-white/5 hover:bg-white/10 border border-transparent'
                        )}
                        onClick={() => loadScenario(scenario)}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-white truncate">{scenario.name}</p>
                          <Badge variant="outline" className="text-[10px] border-white/20 text-white/60">
                            {scenario.medications.length} meds
                          </Badge>
                        </div>
                        <p className="text-[10px] text-white/40 mt-0.5 line-clamp-1">
                          {scenario.age}yo • {scenario.conditions.slice(0, 2).join(', ')}
                        </p>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Center Panel - Circuit & Results */}
          <div className="col-span-6 space-y-3">
            {/* Risk Dashboard */}
            {riskResults && (
              <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-purple-400" />
                      <span className="text-sm font-medium text-white">Risk Assessment</span>
                    </div>
                    <Badge className={cn('text-white bg-gradient-to-r', getRiskBg(riskResults.overall))}>
                      {getRiskLabel(riskResults.overall)}: {riskResults.overall}%
                    </Badge>
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                    {[
                      { label: 'Bleeding', value: riskResults.bleeding, icon: Droplets },
                      { label: 'Cardiac', value: riskResults.cardiac, icon: Heart },
                      { label: 'Renal', value: riskResults.renal, icon: Activity },
                      { label: 'CNS', value: riskResults.cns, icon: Brain },
                      { label: 'Metabolic', value: riskResults.metabolic, icon: Zap },
                    ].map((risk) => (
                      <div key={risk.label} className="text-center">
                        <div className="flex justify-center mb-1">
                          <risk.icon className={cn('h-4 w-4', getRiskColor(risk.value))} />
                        </div>
                        <div className="text-[10px] text-white/50">{risk.label}</div>
                        <div className={cn('text-lg font-bold', getRiskColor(risk.value))}>
                          {risk.value}%
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
                          <div
                            className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-500', getRiskBg(risk.value))}
                            style={{ width: `${risk.value}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quantum Circuit */}
            <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Atom className="h-4 w-4 text-cyan-400" />
                    Quantum Circuit ({NUM_QUBITS} Qubits × {maxColumn} Depth)
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-white/50 h-6"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                  >
                    {showAdvanced ? 'Simple View' : 'Advanced View'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative overflow-x-auto">
                  <div className="space-y-0.5 min-w-[700px]">
                    {DRUG_CLASSES.map((drug) => {
                      const isActive = selectedMedications.includes(drug.id);
                      const gatesOnQubit = gates.filter((g) => g.qubit === drug.id);

                      return (
                        <div key={drug.id} className="flex items-center gap-1 group">
                          {/* Qubit label */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    'w-16 flex items-center gap-1 flex-shrink-0 transition-opacity cursor-help',
                                    isActive ? 'opacity-100' : 'opacity-30'
                                  )}
                                >
                                  <div className={cn('w-5 h-5 rounded text-[8px] font-bold flex items-center justify-center text-white', drug.color)}>
                                    {drug.shortName}
                                  </div>
                                  <span className="text-[10px] text-white/60">q[{drug.id}]</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                <p className="font-semibold">{drug.name}</p>
                                <p className="text-xs text-muted-foreground">{drug.description}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {/* Wire and gates */}
                          <div className="flex-1 flex items-center relative">
                            {/* Background wire */}
                            <div
                              className={cn(
                                'absolute inset-y-0 left-0 right-0 flex items-center transition-opacity',
                                isActive ? 'opacity-100' : 'opacity-20'
                              )}
                            >
                              <div className="w-full h-[2px] bg-gradient-to-r from-cyan-500/40 via-purple-500/40 to-cyan-500/40" />
                            </div>

                            {/* Gates */}
                            <div className="flex gap-0.5 relative z-10">
                              {Array.from({ length: Math.max(maxColumn, 10) }).map((_, col) => {
                                const gateAtPosition = gatesOnQubit.find((g) => g.column === col);
                                const isControl = gates.some(
                                  (g) => g.column === col && g.controlQubits?.includes(drug.id)
                                );
                                const controlGate = gates.find(
                                  (g) => g.column === col && g.controlQubits?.includes(drug.id)
                                );

                                return (
                                  <TooltipProvider key={col}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div
                                          className={cn(
                                            'w-7 h-7 rounded flex items-center justify-center flex-shrink-0 transition-all',
                                            gateAtPosition
                                              ? GATE_INFO[gateAtPosition.gate]?.color || 'bg-gray-500'
                                              : isControl
                                              ? 'bg-indigo-500/40 border border-indigo-400/50'
                                              : 'border border-white/5'
                                          )}
                                        >
                                          {gateAtPosition && (
                                            <span className="text-white text-[9px] font-bold">
                                              {GATE_INFO[gateAtPosition.gate]?.symbol || gateAtPosition.gate.toUpperCase()}
                                            </span>
                                          )}
                                          {isControl && !gateAtPosition && (
                                            <div className="w-2 h-2 rounded-full bg-indigo-400" />
                                          )}
                                        </div>
                                      </TooltipTrigger>
                                      {(gateAtPosition || isControl) && (
                                        <TooltipContent>
                                          <p className="font-semibold">
                                            {gateAtPosition
                                              ? GATE_INFO[gateAtPosition.gate]?.name
                                              : `Control for ${controlGate?.gate.toUpperCase()}`}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            {gateAtPosition?.reason || controlGate?.reason}
                                          </p>
                                          {showAdvanced && gateAtPosition?.params?.theta && (
                                            <p className="text-xs mt-1">
                                              θ = {(gateAtPosition.params.theta / Math.PI).toFixed(3)}π
                                            </p>
                                          )}
                                        </TooltipContent>
                                      )}
                                    </Tooltip>
                                  </TooltipProvider>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Empty state */}
                {selectedMedications.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-6">
                    <Pill className="h-10 w-10 text-white/20 mb-2" />
                    <p className="text-white/40 text-sm">Select medications or choose a scenario</p>
                  </div>
                )}

                {/* Gate legend */}
                {gates.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(GATE_INFO).map(([key, info]) => {
                        const count = gates.filter((g) => g.gate === key).length;
                        if (count === 0) return null;
                        return (
                          <Badge key={key} variant="outline" className="text-[10px] border-white/20">
                            <div className={cn('w-2 h-2 rounded mr-1', info.color)} />
                            {info.symbol}: {count}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Measurement Results */}
            {Object.keys(measurementResults).length > 0 && (
              <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-purple-400" />
                    Measurement Distribution ({shots.toLocaleString()} shots)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5">
                    {Object.entries(measurementResults)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 10)
                      .map(([state, count]) => {
                        const probability = (count / shots) * 100;
                        const ones = state.split('').filter((c) => c === '1').length;
                        return (
                          <div key={state} className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-white/60 w-28 truncate">
                              |{state.slice(-12)}⟩
                            </span>
                            <span className="text-[10px] text-white/40 w-8">{ones}↑</span>
                            <div className="flex-1 h-4 bg-white/5 rounded overflow-hidden">
                              <div
                                className={cn(
                                  'h-full transition-all duration-500',
                                  ones >= 8 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                                  ones >= 5 ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
                                  'bg-gradient-to-r from-purple-500 to-cyan-500'
                                )}
                                style={{ width: `${probability}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-white/60 w-14 text-right font-mono">
                              {probability.toFixed(2)}%
                            </span>
                            <span className="text-[10px] text-white/40 w-12 text-right">
                              ({count})
                            </span>
                          </div>
                        );
                      })}
                  </div>
                  {Object.keys(measurementResults).length > 10 && (
                    <p className="text-[10px] text-white/30 mt-2 text-center">
                      Showing top 10 of {Object.keys(measurementResults).length} unique outcomes
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Panel - Interactions & Recommendations */}
          <div className="col-span-3 space-y-3">
            {/* Active Interactions */}
            <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-400" />
                  Drug Interactions ({riskResults?.interactions.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[240px]">
                  {riskResults && riskResults.interactions.length > 0 ? (
                    <div className="space-y-2">
                      {riskResults.interactions
                        .sort((a, b) => {
                          const severityOrder = { contraindicated: 0, major: 1, moderate: 2, minor: 3 };
                          return severityOrder[a.severity] - severityOrder[b.severity];
                        })
                        .map((interaction, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              'p-2 rounded-lg border',
                              interaction.severity === 'contraindicated'
                                ? 'bg-red-500/10 border-red-500/30'
                                : interaction.severity === 'major'
                                ? 'bg-orange-500/10 border-orange-500/30'
                                : interaction.severity === 'moderate'
                                ? 'bg-yellow-500/10 border-yellow-500/30'
                                : 'bg-blue-500/10 border-blue-500/30'
                            )}
                          >
                            <div className="flex items-start gap-2">
                              {interaction.severity === 'contraindicated' ? (
                                <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                              ) : interaction.severity === 'major' ? (
                                <AlertTriangle className="h-3.5 w-3.5 text-orange-400 flex-shrink-0 mt-0.5" />
                              ) : (
                                <AlertCircle className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] text-white leading-tight">{interaction.description}</p>
                                <p className="text-[10px] text-white/50 mt-1 leading-tight">{interaction.clinicalNote}</p>
                                <div className="flex items-center gap-1 mt-1.5">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      'text-[9px] px-1 py-0',
                                      interaction.severity === 'contraindicated'
                                        ? 'border-red-500/50 text-red-300'
                                        : interaction.severity === 'major'
                                        ? 'border-orange-500/50 text-orange-300'
                                        : 'border-yellow-500/50 text-yellow-300'
                                    )}
                                  >
                                    {interaction.severity.toUpperCase()}
                                  </Badge>
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 border-white/20 text-white/50">
                                    {interaction.riskType}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : riskResults ? (
                    <div className="flex flex-col items-center justify-center py-6">
                      <CheckCircle className="h-8 w-8 text-green-400 mb-2" />
                      <p className="text-green-400 text-sm">No interactions detected</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6">
                      <Info className="h-8 w-8 text-white/20 mb-2" />
                      <p className="text-white/40 text-xs">Run analysis to see interactions</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Clinical Recommendations */}
            <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-green-400" />
                  Clinical Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[220px]">
                  {riskResults ? (
                    <div className="space-y-1.5">
                      {riskResults.recommendations.map((rec, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            'p-2 rounded text-[11px] leading-tight',
                            rec.includes('🚨') || rec.includes('CRITICAL')
                              ? 'bg-red-500/10 text-red-300'
                              : rec.includes('⚠️') || rec.includes('HIGH') || rec.includes('MODERATE')
                              ? 'bg-orange-500/10 text-orange-300'
                              : rec.includes('✅')
                              ? 'bg-green-500/10 text-green-300'
                              : rec.startsWith('•')
                              ? 'bg-white/5 text-white/70 ml-2'
                              : 'bg-white/5 text-white/70'
                          )}
                        >
                          {rec}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6">
                      <Shield className="h-8 w-8 text-white/20 mb-2" />
                      <p className="text-white/40 text-xs">Recommendations appear after analysis</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Info */}
            <Card className="bg-gradient-to-br from-purple-500/10 to-cyan-500/10 border-purple-500/20">
              <CardContent className="pt-3 pb-3">
                <div className="flex items-start gap-2">
                  <Atom className="h-4 w-4 text-purple-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-white">Quantum Analysis</p>
                    <p className="text-[10px] text-white/50 mt-1 leading-relaxed">
                      Uses 12 qubits to model drug interactions via superposition and entanglement.
                      CX gates encode pairwise interactions, CCX for triple interactions,
                      and rotation gates weight severity. Measurement distribution reflects risk probability.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
