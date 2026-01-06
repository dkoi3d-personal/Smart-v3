'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Stethoscope,
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
  Wind,
  Shield,
  FileText,
  Users,
  AlertCircle,
  Gauge,
  RotateCcw,
  Syringe,
  Bone,
  Timer,
  Thermometer,
  Droplets,
  CircleDot,
  TrendingUp,
  Cigarette,
  Scale,
  Clock,
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

interface RiskInteraction {
  factors: number[];
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  outcomeType: 'mortality' | 'cardiac' | 'pulmonary' | 'infection' | 'vte' | 'renal' | 'readmission';
  description: string;
  clinicalNote: string;
}

interface SurgicalCase {
  id: string;
  name: string;
  procedure: string;
  procedureCategory: string;
  complexity: 'minor' | 'moderate' | 'major' | 'complex';
  riskFactors: number[];
  patientAge: number;
  bmi: number;
  asaClass: number;
  description: string;
}

// 12-Qubit Risk Factor Definitions (based on ACS NSQIP)
const RISK_FACTORS: {
  id: number;
  name: string;
  shortName: string;
  description: string;
  color: string;
  icon: typeof Heart;
  levels: string[];
  weight: number;
}[] = [
  {
    id: 0,
    name: 'Age Risk',
    shortName: 'AGE',
    description: 'Patient age ≥65 years (increased perioperative risk)',
    color: 'bg-slate-500',
    icon: Clock,
    levels: ['<65', '65-74', '75-84', '≥85'],
    weight: 1.5,
  },
  {
    id: 1,
    name: 'BMI/Obesity',
    shortName: 'BMI',
    description: 'Body Mass Index ≥30 (wound healing, airway, DVT risk)',
    color: 'bg-amber-500',
    icon: Scale,
    levels: ['Normal', 'Overweight', 'Obese', 'Morbidly Obese'],
    weight: 1.2,
  },
  {
    id: 2,
    name: 'ASA Class',
    shortName: 'ASA',
    description: 'ASA Physical Status Classification ≥3',
    color: 'bg-purple-500',
    icon: Stethoscope,
    levels: ['ASA 1-2', 'ASA 3', 'ASA 4', 'ASA 5'],
    weight: 2.0,
  },
  {
    id: 3,
    name: 'Cardiac History',
    shortName: 'CARD',
    description: 'CHF, MI within 6mo, arrhythmia, valvular disease',
    color: 'bg-red-500',
    icon: Heart,
    levels: ['None', 'Controlled', 'Active', 'Severe'],
    weight: 2.5,
  },
  {
    id: 4,
    name: 'Pulmonary Disease',
    shortName: 'PULM',
    description: 'COPD, asthma, OSA, ventilator dependent',
    color: 'bg-cyan-500',
    icon: Wind,
    levels: ['None', 'Mild', 'Moderate', 'Severe'],
    weight: 1.8,
  },
  {
    id: 5,
    name: 'Diabetes',
    shortName: 'DM',
    description: 'Diabetes mellitus (wound healing, infection risk)',
    color: 'bg-green-500',
    icon: Activity,
    levels: ['None', 'Diet-controlled', 'Oral meds', 'Insulin'],
    weight: 1.4,
  },
  {
    id: 6,
    name: 'Renal Dysfunction',
    shortName: 'RENAL',
    description: 'CKD, dialysis, acute kidney injury',
    color: 'bg-yellow-500',
    icon: Droplets,
    levels: ['Normal', 'CKD 2-3', 'CKD 4-5', 'Dialysis'],
    weight: 2.2,
  },
  {
    id: 7,
    name: 'Steroid/Immunosuppression',
    shortName: 'IMMUN',
    description: 'Chronic steroid use, immunosuppressant therapy',
    color: 'bg-orange-500',
    icon: Shield,
    levels: ['None', 'Low-dose', 'High-dose', 'Transplant'],
    weight: 1.6,
  },
  {
    id: 8,
    name: 'Bleeding Risk',
    shortName: 'BLEED',
    description: 'Anticoagulation, coagulopathy, thrombocytopenia',
    color: 'bg-rose-500',
    icon: Droplets,
    levels: ['Normal', 'On AC', 'Coagulopathy', 'Severe'],
    weight: 1.9,
  },
  {
    id: 9,
    name: 'Smoking Status',
    shortName: 'SMOKE',
    description: 'Current smoker (wound healing, pulmonary complications)',
    color: 'bg-gray-500',
    icon: Cigarette,
    levels: ['Never', 'Former', 'Current', 'Heavy'],
    weight: 1.3,
  },
  {
    id: 10,
    name: 'Emergency Surgery',
    shortName: 'EMERG',
    description: 'Emergent vs elective (less time to optimize)',
    color: 'bg-red-600',
    icon: Timer,
    levels: ['Elective', 'Urgent', 'Emergent', 'Salvage'],
    weight: 2.8,
  },
  {
    id: 11,
    name: 'Procedure Complexity',
    shortName: 'PROC',
    description: 'Surgical complexity and expected duration',
    color: 'bg-indigo-500',
    icon: Syringe,
    levels: ['Minor', 'Moderate', 'Major', 'Complex'],
    weight: 2.0,
  },
];

// Risk factor interactions that compound surgical risk
const RISK_INTERACTIONS: RiskInteraction[] = [
  // Cardiac complications
  {
    factors: [2, 3],
    severity: 'major',
    outcomeType: 'cardiac',
    description: 'High ASA + Cardiac History: Major cardiac event risk',
    clinicalNote: 'Consider cardiology clearance. May need stress testing or echo.',
  },
  {
    factors: [3, 10],
    severity: 'critical',
    outcomeType: 'cardiac',
    description: 'Cardiac History + Emergency: Perioperative MI risk very high',
    clinicalNote: 'No time for optimization. Maximize intraop monitoring. Have pressors ready.',
  },
  {
    factors: [0, 3],
    severity: 'major',
    outcomeType: 'cardiac',
    description: 'Elderly + Cardiac: Age-related cardiac reserve diminished',
    clinicalNote: 'Lower threshold for ICU admission. Careful fluid management.',
  },
  {
    factors: [3, 6],
    severity: 'major',
    outcomeType: 'cardiac',
    description: 'Cardiac + Renal: Cardiorenal syndrome risk',
    clinicalNote: 'Fluid balance critical. Avoid nephrotoxins. Monitor UOP closely.',
  },
  // Pulmonary complications
  {
    factors: [4, 9],
    severity: 'major',
    outcomeType: 'pulmonary',
    description: 'Pulmonary Disease + Smoking: High pneumonia/reintubation risk',
    clinicalNote: 'Aggressive pulmonary toilet. Consider preop pulmonary rehab if elective.',
  },
  {
    factors: [1, 4],
    severity: 'moderate',
    outcomeType: 'pulmonary',
    description: 'Obesity + Pulmonary: Difficult airway, atelectasis risk',
    clinicalNote: 'Anesthesia aware. Post-op CPAP. Early mobilization.',
  },
  {
    factors: [0, 4],
    severity: 'major',
    outcomeType: 'pulmonary',
    description: 'Elderly + Pulmonary: Prolonged ventilation risk',
    clinicalNote: 'May need ICU for close respiratory monitoring post-op.',
  },
  {
    factors: [4, 11],
    severity: 'major',
    outcomeType: 'pulmonary',
    description: 'Pulmonary + Complex Surgery: Extended anesthesia risk',
    clinicalNote: 'Lung-protective ventilation. Consider regional if feasible.',
  },
  // Infection/SSI
  {
    factors: [5, 7],
    severity: 'major',
    outcomeType: 'infection',
    description: 'Diabetes + Immunosuppression: SSI risk very high',
    clinicalNote: 'Tight glucose control. Extended antibiotic prophylaxis. Close wound monitoring.',
  },
  {
    factors: [1, 5],
    severity: 'moderate',
    outcomeType: 'infection',
    description: 'Obesity + Diabetes: Wound healing impaired',
    clinicalNote: 'Perioperative glucose <180. Consider wound VAC if high-risk incision.',
  },
  {
    factors: [7, 11],
    severity: 'major',
    outcomeType: 'infection',
    description: 'Immunosuppressed + Major Surgery: Opportunistic infection risk',
    clinicalNote: 'Extended prophylaxis. Low threshold for infection workup post-op.',
  },
  {
    factors: [9, 11],
    severity: 'moderate',
    outcomeType: 'infection',
    description: 'Smoking + Complex Surgery: Wound complications',
    clinicalNote: 'Strongly encourage smoking cessation 4+ weeks pre-op if possible.',
  },
  // VTE risk
  {
    factors: [1, 11],
    severity: 'major',
    outcomeType: 'vte',
    description: 'Obesity + Major Surgery: High DVT/PE risk',
    clinicalNote: 'Extended chemoprophylaxis. SCDs intraop. Early ambulation.',
  },
  {
    factors: [3, 11],
    severity: 'moderate',
    outcomeType: 'vte',
    description: 'Cardiac + Major Surgery: Venous stasis risk',
    clinicalNote: 'Balance anticoagulation vs bleeding risk. Consider IVC filter if contraindicated.',
  },
  // Renal complications
  {
    factors: [6, 11],
    severity: 'major',
    outcomeType: 'renal',
    description: 'CKD + Major Surgery: AKI risk elevated',
    clinicalNote: 'Avoid nephrotoxins. Careful with contrast. Monitor creatinine daily.',
  },
  {
    factors: [5, 6],
    severity: 'major',
    outcomeType: 'renal',
    description: 'Diabetes + CKD: Diabetic nephropathy progression risk',
    clinicalNote: 'Hold metformin. Careful contrast use. Tight glucose and BP control.',
  },
  {
    factors: [3, 6, 11],
    severity: 'critical',
    outcomeType: 'renal',
    description: 'Cardiac + Renal + Major Surgery: Multi-organ stress',
    clinicalNote: 'High ICU admission threshold. Swan-Ganz consideration. Nephrology consult.',
  },
  // Mortality risk combinations
  {
    factors: [2, 10],
    severity: 'critical',
    outcomeType: 'mortality',
    description: 'High ASA + Emergency: Mortality risk significantly elevated',
    clinicalNote: 'Goals of care discussion. Family at bedside. ICU bed reserved.',
  },
  {
    factors: [0, 2, 10],
    severity: 'critical',
    outcomeType: 'mortality',
    description: 'Elderly + High ASA + Emergency: Very high mortality',
    clinicalNote: 'Palliative care consult if appropriate. Realistic expectations with family.',
  },
  {
    factors: [3, 4, 6],
    severity: 'critical',
    outcomeType: 'mortality',
    description: 'Cardiac + Pulmonary + Renal: Multi-organ dysfunction baseline',
    clinicalNote: 'Multi-disciplinary pre-op planning. Consider if surgery is appropriate.',
  },
  // Readmission risk
  {
    factors: [0, 5],
    severity: 'moderate',
    outcomeType: 'readmission',
    description: 'Elderly + Diabetes: 30-day readmission risk elevated',
    clinicalNote: 'Ensure discharge planning early. Home health referral. Clear follow-up.',
  },
  {
    factors: [2, 7],
    severity: 'moderate',
    outcomeType: 'readmission',
    description: 'High ASA + Immunosuppressed: Post-discharge complications',
    clinicalNote: 'Low threshold for ED return. Clear warning signs education.',
  },
];

// Surgical case scenarios
const SURGICAL_CASES: SurgicalCase[] = [
  {
    id: 'healthy-lap-chole',
    name: 'Healthy Adult - Lap Chole',
    procedure: 'Laparoscopic Cholecystectomy',
    procedureCategory: 'General Surgery',
    complexity: 'minor',
    riskFactors: [],
    patientAge: 42,
    bmi: 26,
    asaClass: 1,
    description: 'Healthy 42yo, symptomatic gallstones, elective surgery',
  },
  {
    id: 'elderly-hip',
    name: 'Elderly Hip Fracture',
    procedure: 'Hip Hemiarthroplasty',
    procedureCategory: 'Orthopedics',
    complexity: 'major',
    riskFactors: [0, 2, 8, 10],
    patientAge: 82,
    bmi: 22,
    asaClass: 3,
    description: '82yo fall, hip fracture, on warfarin, urgent surgery needed',
  },
  {
    id: 'cardiac-cabg',
    name: 'Diabetic CABG Patient',
    procedure: 'Coronary Artery Bypass Graft',
    procedureCategory: 'Cardiac Surgery',
    complexity: 'complex',
    riskFactors: [0, 2, 3, 5, 6, 11],
    patientAge: 68,
    bmi: 31,
    asaClass: 4,
    description: '68yo diabetic, 3-vessel CAD, CKD stage 3, elective CABG',
  },
  {
    id: 'obese-bariatric',
    name: 'Morbidly Obese - Bariatric',
    procedure: 'Laparoscopic Gastric Bypass',
    procedureCategory: 'Bariatric Surgery',
    complexity: 'major',
    riskFactors: [1, 2, 4, 5, 11],
    patientAge: 45,
    bmi: 52,
    asaClass: 3,
    description: '45yo BMI 52, OSA on CPAP, T2DM, elective gastric bypass',
  },
  {
    id: 'transplant-kidney',
    name: 'Renal Transplant Recipient',
    procedure: 'Kidney Transplant',
    procedureCategory: 'Transplant Surgery',
    complexity: 'complex',
    riskFactors: [2, 5, 6, 7, 11],
    patientAge: 55,
    bmi: 28,
    asaClass: 3,
    description: '55yo ESRD on dialysis, diabetic, receiving living donor kidney',
  },
  {
    id: 'trauma-laparotomy',
    name: 'Trauma - Emergent Laparotomy',
    procedure: 'Exploratory Laparotomy',
    procedureCategory: 'Trauma Surgery',
    complexity: 'complex',
    riskFactors: [8, 10, 11],
    patientAge: 34,
    bmi: 25,
    asaClass: 4,
    description: '34yo MVA, hemodynamically unstable, free fluid on FAST',
  },
  {
    id: 'lung-cancer',
    name: 'Lung Cancer - Lobectomy',
    procedure: 'Video-Assisted Thoracoscopic Lobectomy',
    procedureCategory: 'Thoracic Surgery',
    complexity: 'major',
    riskFactors: [0, 2, 4, 9, 11],
    patientAge: 71,
    bmi: 24,
    asaClass: 3,
    description: '71yo 40 pack-year smoker, COPD, stage 1A lung cancer',
  },
  {
    id: 'complex-spine',
    name: 'Complex Spine Fusion',
    procedure: 'Multi-level Lumbar Fusion',
    procedureCategory: 'Spine Surgery',
    complexity: 'complex',
    riskFactors: [0, 1, 2, 5, 8, 11],
    patientAge: 67,
    bmi: 34,
    asaClass: 3,
    description: '67yo obese diabetic, on aspirin, L2-S1 fusion for stenosis',
  },
  {
    id: 'high-risk-aaa',
    name: 'High-Risk AAA Repair',
    procedure: 'Open Abdominal Aortic Aneurysm Repair',
    procedureCategory: 'Vascular Surgery',
    complexity: 'complex',
    riskFactors: [0, 2, 3, 4, 6, 8, 9, 11],
    patientAge: 76,
    bmi: 27,
    asaClass: 4,
    description: '76yo 7cm AAA, CHF, COPD, CKD, on anticoagulation',
  },
  {
    id: 'worst-case',
    name: 'Maximum Risk Profile',
    procedure: 'Emergent Laparotomy',
    procedureCategory: 'General Surgery',
    complexity: 'complex',
    riskFactors: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    patientAge: 84,
    bmi: 38,
    asaClass: 5,
    description: 'Educational worst-case: all 12 risk factors active',
  },
];

// Gate definitions
const GATE_INFO: Record<string, { name: string; symbol: string; color: string; description: string }> = {
  x: { name: 'Risk Active', symbol: 'X', color: 'bg-red-500', description: 'Risk factor present' },
  h: { name: 'Hadamard', symbol: 'H', color: 'bg-blue-500', description: 'Outcome superposition' },
  cx: { name: 'CNOT', symbol: 'CX', color: 'bg-indigo-500', description: 'Risk factor interaction' },
  ccx: { name: 'Toffoli', symbol: 'CCX', color: 'bg-amber-500', description: 'Multi-factor synergy' },
  ry: { name: 'Y-Rotation', symbol: 'Ry', color: 'bg-purple-500', description: 'Risk amplitude' },
  rz: { name: 'Z-Rotation', symbol: 'Rz', color: 'bg-teal-500', description: 'Severity phase' },
  s: { name: 'S Gate', symbol: 'S', color: 'bg-cyan-500', description: 'Critical adjustment' },
};

const NUM_QUBITS = 12;

export default function SurgicalRiskDemo() {
  // State
  const [selectedRiskFactors, setSelectedRiskFactors] = useState<number[]>([]);
  const [gates, setGates] = useState<PlacedGate[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [riskResults, setRiskResults] = useState<{
    mortality: number;
    cardiac: number;
    pulmonary: number;
    infection: number;
    vte: number;
    renal: number;
    readmission: number;
    overall: number;
    interactions: RiskInteraction[];
    recommendations: string[];
    riskClass: string;
    circuitDepth: number;
    entanglementCount: number;
  } | null>(null);
  const [measurementResults, setMeasurementResults] = useState<Record<string, number>>({});
  const [activeCase, setActiveCase] = useState<string | null>(null);
  const [shots, setShots] = useState(2048);
  const [patientAge, setPatientAge] = useState(50);
  const [patientBMI, setPatientBMI] = useState(25);
  const [asaClass, setAsaClass] = useState(2);
  const [isEmergency, setIsEmergency] = useState(false);

  // Toggle risk factor
  const toggleRiskFactor = (factorId: number) => {
    setSelectedRiskFactors((prev) =>
      prev.includes(factorId) ? prev.filter((id) => id !== factorId) : [...prev, factorId]
    );
    setRiskResults(null);
    setActiveCase(null);
  };

  // Load surgical case
  const loadCase = (surgical: SurgicalCase) => {
    setSelectedRiskFactors(surgical.riskFactors);
    setPatientAge(surgical.patientAge);
    setPatientBMI(surgical.bmi);
    setAsaClass(surgical.asaClass);
    setIsEmergency(surgical.riskFactors.includes(10));
    setActiveCase(surgical.id);
    setRiskResults(null);
  };

  // Build quantum circuit
  const buildCircuit = useCallback(() => {
    const newGates: PlacedGate[] = [];
    let column = 0;

    // Auto-add derived risk factors based on patient data
    const derivedFactors = [...selectedRiskFactors];

    // Age risk
    if (patientAge >= 65 && !derivedFactors.includes(0)) derivedFactors.push(0);
    // BMI risk
    if (patientBMI >= 30 && !derivedFactors.includes(1)) derivedFactors.push(1);
    // ASA risk
    if (asaClass >= 3 && !derivedFactors.includes(2)) derivedFactors.push(2);
    // Emergency
    if (isEmergency && !derivedFactors.includes(10)) derivedFactors.push(10);

    // Phase 1: Initial state - X gates for active risk factors
    derivedFactors.forEach((factorId) => {
      newGates.push({
        id: `x-${factorId}-${column}`,
        gate: 'x',
        qubit: factorId,
        column,
        reason: `${RISK_FACTORS[factorId].name} present`,
      });
    });
    if (derivedFactors.length > 0) column++;

    // Phase 2: Superposition for outcome exploration
    if (derivedFactors.length >= 3) {
      derivedFactors.slice(0, Math.min(4, derivedFactors.length)).forEach((factorId) => {
        newGates.push({
          id: `h-${factorId}-${column}`,
          gate: 'h',
          qubit: factorId,
          column,
          reason: `Explore ${RISK_FACTORS[factorId].shortName} outcome space`,
        });
      });
      column++;
    }

    // Phase 3: Risk interactions
    const activeInteractions = RISK_INTERACTIONS.filter((interaction) =>
      interaction.factors.every((f) => derivedFactors.includes(f))
    );

    // Two-factor interactions
    const twoFactor = activeInteractions.filter((i) => i.factors.length === 2);
    const threeFactor = activeInteractions.filter((i) => i.factors.length >= 3);

    twoFactor.forEach((interaction) => {
      newGates.push({
        id: `cx-${interaction.factors.join('-')}-${column}`,
        gate: 'cx',
        qubit: interaction.factors[0],
        column,
        controlQubits: [interaction.factors[1]],
        reason: interaction.description,
      });
      column++;

      const severityAngle =
        interaction.severity === 'critical' ? Math.PI * 0.5 :
        interaction.severity === 'major' ? Math.PI * 0.35 :
        interaction.severity === 'moderate' ? Math.PI * 0.25 :
        Math.PI * 0.1;

      newGates.push({
        id: `ry-${interaction.factors.join('-')}-${column}`,
        gate: 'ry',
        qubit: interaction.factors[0],
        column,
        params: { theta: severityAngle },
        reason: `Risk weight: ${interaction.severity}`,
      });
      column++;
    });

    // Three-factor interactions
    threeFactor.forEach((interaction) => {
      newGates.push({
        id: `ccx-${interaction.factors.join('-')}-${column}`,
        gate: 'ccx',
        qubit: interaction.factors[0],
        column,
        controlQubits: [interaction.factors[1], interaction.factors[2]],
        reason: interaction.description,
      });
      column++;

      const severityAngle = interaction.severity === 'critical' ? Math.PI * 0.5 : Math.PI * 0.4;

      newGates.push({
        id: `ry-triple-${interaction.factors.join('-')}-${column}`,
        gate: 'ry',
        qubit: interaction.factors[0],
        column,
        params: { theta: severityAngle },
        reason: 'Critical synergy amplification',
      });

      newGates.push({
        id: `rz-triple-${interaction.factors.join('-')}-${column}`,
        gate: 'rz',
        qubit: interaction.factors[1],
        column,
        params: { theta: Math.PI / 3 },
        reason: 'Outcome phase encoding',
      });
      column++;
    });

    // Phase 4: Outcome correlation layer
    const outcomeCorrelations: [number, number][] = [
      [3, 4],   // Cardiac-Pulmonary
      [5, 6],   // Diabetes-Renal
      [0, 3],   // Age-Cardiac
      [7, 5],   // Immunosuppression-Diabetes
    ];

    outcomeCorrelations.forEach(([q1, q2]) => {
      if (derivedFactors.includes(q1) && derivedFactors.includes(q2)) {
        const alreadyConnected = activeInteractions.some(
          (i) => i.factors.includes(q1) && i.factors.includes(q2)
        );
        if (!alreadyConnected) {
          newGates.push({
            id: `cx-corr-${q1}-${q2}-${column}`,
            gate: 'cx',
            qubit: q1,
            column,
            controlQubits: [q2],
            reason: `${RISK_FACTORS[q1].shortName}-${RISK_FACTORS[q2].shortName} correlation`,
          });
        }
      }
    });
    if (derivedFactors.length >= 4) column++;

    // Phase 5: Final interference
    if (derivedFactors.length >= 3) {
      const lastFactors = derivedFactors.slice(-2);
      lastFactors.forEach((factorId) => {
        newGates.push({
          id: `h-final-${factorId}-${column}`,
          gate: 'h',
          qubit: factorId,
          column,
          reason: 'Final measurement preparation',
        });
      });
      column++;
    }

    // Phase 6: Critical phase adjustments
    if (activeInteractions.some((i) => i.severity === 'critical')) {
      const criticalFactors = activeInteractions
        .filter((i) => i.severity === 'critical')
        .flatMap((i) => i.factors);

      [...new Set(criticalFactors)].slice(0, 3).forEach((factorId) => {
        newGates.push({
          id: `s-${factorId}-${column}`,
          gate: 's',
          qubit: factorId,
          column,
          reason: 'Critical risk phase shift',
        });
      });
    }

    setGates(newGates);
    return { gates: newGates, derivedFactors };
  }, [selectedRiskFactors, patientAge, patientBMI, asaClass, isEmergency]);

  // Run analysis
  const runAnalysis = async () => {
    setIsAnalyzing(true);

    const { gates: circuitGates, derivedFactors } = buildCircuit();

    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      const gateList = circuitGates
        .sort((a, b) => a.column - b.column)
        .map((g) => ({
          gate: g.gate,
          qubit: g.qubit,
          targetQubit: g.controlQubits?.[0],
          control2: g.controlQubits?.[1],
          params: g.params?.theta ? [g.params.theta] : undefined,
        }));

      // Try Qiskit backend
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
        // Fallback to JS
      }

      if (!simulationSuccess) {
        const { SimpleQuantumCircuit } = await import('@/lib/quantum-sim');
        const circuit = new SimpleQuantumCircuit(NUM_QUBITS);

        for (const placedGate of circuitGates.sort((a, b) => a.column - b.column)) {
          if (placedGate.gate === 'x') {
            circuit.addGate('x', placedGate.qubit);
          } else if (placedGate.gate === 'h') {
            circuit.addGate('h', placedGate.qubit);
          } else if (placedGate.gate === 's') {
            circuit.addGate('s', placedGate.qubit);
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

      // Calculate outcomes
      const activeInteractions = RISK_INTERACTIONS.filter((interaction) =>
        interaction.factors.every((f) => derivedFactors.includes(f))
      );

      const totalMeasurements = Object.values(measurements).reduce((a, b) => a + b, 0);
      let highRiskPatterns = 0;

      Object.entries(measurements).forEach(([state, count]) => {
        const ones = state.split('').filter((c) => c === '1').length;
        if (ones >= Math.floor(derivedFactors.length * 0.6)) {
          highRiskPatterns += count;
        }
      });

      const highRiskProbability = highRiskPatterns / totalMeasurements;

      // Calculate outcome-specific risks
      const outcomes = {
        mortality: 0,
        cardiac: 0,
        pulmonary: 0,
        infection: 0,
        vte: 0,
        renal: 0,
        readmission: 0,
      };

      activeInteractions.forEach((interaction) => {
        const baseSeverity =
          interaction.severity === 'critical' ? 25 :
          interaction.severity === 'major' ? 15 :
          interaction.severity === 'moderate' ? 8 :
          3;

        const quantumFactor = 1 + (highRiskProbability * 0.4);
        outcomes[interaction.outcomeType] += baseSeverity * quantumFactor;
      });

      // Add baseline risk from individual factors
      derivedFactors.forEach((factorId) => {
        const factor = RISK_FACTORS[factorId];
        const baselineAdd = factor.weight * 2;

        if ([3].includes(factorId)) outcomes.cardiac += baselineAdd;
        if ([4, 9].includes(factorId)) outcomes.pulmonary += baselineAdd;
        if ([5, 7].includes(factorId)) outcomes.infection += baselineAdd;
        if ([1, 11].includes(factorId)) outcomes.vte += baselineAdd;
        if ([6].includes(factorId)) outcomes.renal += baselineAdd;
        if ([0, 2].includes(factorId)) outcomes.mortality += baselineAdd * 0.5;
        if ([0, 5].includes(factorId)) outcomes.readmission += baselineAdd;
      });

      // Emergency multiplier
      if (derivedFactors.includes(10)) {
        Object.keys(outcomes).forEach((key) => {
          outcomes[key as keyof typeof outcomes] *= 1.5;
        });
      }

      // Cap at 95%
      Object.keys(outcomes).forEach((key) => {
        outcomes[key as keyof typeof outcomes] = Math.min(95, Math.round(outcomes[key as keyof typeof outcomes]));
      });

      // Overall risk
      const maxOutcome = Math.max(...Object.values(outcomes));
      const avgOutcome = Object.values(outcomes).reduce((a, b) => a + b, 0) / 7;
      const overall = Math.min(98, Math.round(
        maxOutcome * 0.4 +
        avgOutcome * 0.3 +
        derivedFactors.length * 3 +
        highRiskProbability * 20
      ));

      // Risk class
      let riskClass = 'Low';
      if (overall >= 70) riskClass = 'Prohibitive';
      else if (overall >= 50) riskClass = 'High';
      else if (overall >= 30) riskClass = 'Intermediate';
      else if (overall >= 15) riskClass = 'Low-Intermediate';

      // Recommendations
      const recommendations: string[] = [];

      if (outcomes.mortality >= 20) {
        recommendations.push('🚨 HIGH MORTALITY RISK: Goals of care discussion recommended');
        recommendations.push('• Consider palliative care consult');
        recommendations.push('• Ensure family understands risks');
      }

      if (outcomes.cardiac >= 25) {
        recommendations.push('🫀 CARDIAC RISK ELEVATED:');
        recommendations.push('• Cardiology clearance recommended');
        recommendations.push('• Consider preop stress testing or echo');
        recommendations.push('• Plan for ICU admission');
      }

      if (outcomes.pulmonary >= 25) {
        recommendations.push('🫁 PULMONARY RISK ELEVATED:');
        recommendations.push('• Consider pulmonary function tests');
        recommendations.push('• Plan aggressive pulmonary toilet');
        recommendations.push('• Anesthesia aware of airway concerns');
      }

      if (outcomes.infection >= 30) {
        recommendations.push('🦠 INFECTION RISK ELEVATED:');
        recommendations.push('• Optimize glucose control perioperatively');
        recommendations.push('• Extended antibiotic prophylaxis');
        recommendations.push('• Close wound surveillance');
      }

      if (outcomes.vte >= 25) {
        recommendations.push('🩸 VTE RISK ELEVATED:');
        recommendations.push('• Extended chemoprophylaxis post-op');
        recommendations.push('• SCDs intraoperatively');
        recommendations.push('• Early mobilization protocol');
      }

      if (outcomes.renal >= 25) {
        recommendations.push('💧 RENAL RISK ELEVATED:');
        recommendations.push('• Avoid nephrotoxic medications');
        recommendations.push('• Careful with IV contrast');
        recommendations.push('• Daily creatinine monitoring');
      }

      if (derivedFactors.includes(10)) {
        recommendations.push('⚡ EMERGENCY SURGERY:');
        recommendations.push('• Limited time for optimization');
        recommendations.push('• ICU bed reserved');
        recommendations.push('• Blood products on standby');
      }

      if (recommendations.length === 0) {
        recommendations.push('✅ Standard perioperative precautions');
        recommendations.push('• Routine preop labs and testing');
        recommendations.push('• Standard anesthesia protocols');
      }

      const circuitDepth = Math.max(...circuitGates.map((g) => g.column)) + 1;
      const entanglementCount = circuitGates.filter((g) => ['cx', 'ccx'].includes(g.gate)).length;

      setRiskResults({
        mortality: outcomes.mortality,
        cardiac: outcomes.cardiac,
        pulmonary: outcomes.pulmonary,
        infection: outcomes.infection,
        vte: outcomes.vte,
        renal: outcomes.renal,
        readmission: outcomes.readmission,
        overall,
        interactions: activeInteractions,
        recommendations,
        riskClass,
        circuitDepth,
        entanglementCount,
      });
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Clear
  const clearAll = () => {
    setSelectedRiskFactors([]);
    setGates([]);
    setRiskResults(null);
    setMeasurementResults({});
    setActiveCase(null);
    setPatientAge(50);
    setPatientBMI(25);
    setAsaClass(2);
    setIsEmergency(false);
  };

  // Risk helpers
  const getRiskColor = (risk: number) => {
    if (risk >= 50) return 'text-red-400';
    if (risk >= 30) return 'text-orange-400';
    if (risk >= 15) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getRiskBg = (risk: number) => {
    if (risk >= 50) return 'from-red-500 to-red-600';
    if (risk >= 30) return 'from-orange-500 to-orange-600';
    if (risk >= 15) return 'from-yellow-500 to-yellow-600';
    return 'from-green-500 to-green-600';
  };

  const maxColumn = gates.length > 0 ? Math.max(...gates.map((g) => g.column)) + 1 : 8;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
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
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
                <Syringe className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Quantum Surgical Risk Calculator</h1>
                <p className="text-xs text-white/50">12-Qubit NSQIP-Based Risk Analysis • {shots.toLocaleString()} Shots</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-blue-500/50 text-blue-300">
              <Atom className="h-3 w-3 mr-1" />
              {selectedRiskFactors.length}/12 Factors
            </Badge>
            {riskResults && (
              <Badge className={cn('bg-gradient-to-r', getRiskBg(riskResults.overall))}>
                {riskResults.riskClass}: {riskResults.overall}%
              </Badge>
            )}
            <Link href="/quantum/polypharmacy-demo">
              <Badge variant="outline" className="border-purple-500/50 text-purple-300 cursor-pointer hover:bg-purple-500/10">
                Drug Interactions
              </Badge>
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-4">
          {/* Left Panel */}
          <div className="col-span-3 space-y-3">
            {/* Patient Data */}
            <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-400" />
                  Patient Data
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs text-white/50">Age: {patientAge} years</label>
                  <Slider
                    value={[patientAge]}
                    min={18}
                    max={100}
                    onValueChange={([v]) => setPatientAge(v)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50">BMI: {patientBMI}</label>
                  <Slider
                    value={[patientBMI]}
                    min={15}
                    max={60}
                    onValueChange={([v]) => setPatientBMI(v)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50">ASA Class</label>
                  <Select value={asaClass.toString()} onValueChange={(v) => setAsaClass(parseInt(v))}>
                    <SelectTrigger className="mt-1 h-8 bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">ASA 1 - Healthy</SelectItem>
                      <SelectItem value="2">ASA 2 - Mild systemic</SelectItem>
                      <SelectItem value="3">ASA 3 - Severe systemic</SelectItem>
                      <SelectItem value="4">ASA 4 - Life-threatening</SelectItem>
                      <SelectItem value="5">ASA 5 - Moribund</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-white/50">Emergency Surgery</label>
                  <Switch checked={isEmergency} onCheckedChange={setIsEmergency} />
                </div>
              </CardContent>
            </Card>

            {/* Risk Factors */}
            <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-400" />
                  Risk Factors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[240px] pr-2">
                  <div className="space-y-1">
                    {RISK_FACTORS.map((factor) => (
                      <TooltipProvider key={factor.id}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                'flex items-center gap-2 p-1.5 rounded cursor-pointer transition-all',
                                selectedRiskFactors.includes(factor.id)
                                  ? 'bg-white/10 border border-white/20'
                                  : 'hover:bg-white/5 border border-transparent'
                              )}
                              onClick={() => toggleRiskFactor(factor.id)}
                            >
                              <div className={cn('w-6 h-6 rounded flex items-center justify-center text-white text-[9px] font-bold', factor.color)}>
                                {factor.shortName}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-white truncate">{factor.name}</p>
                                <p className="text-[10px] text-white/40">q[{factor.id}]</p>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p className="font-semibold">{factor.name}</p>
                            <p className="text-xs text-muted-foreground">{factor.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                </ScrollArea>

                {/* Shots */}
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white/50">Shots</span>
                    <Input
                      type="number"
                      value={shots}
                      onChange={(e) => setShots(Math.max(100, Math.min(10000, parseInt(e.target.value) || 1024)))}
                      className="w-20 h-6 text-xs bg-white/5 border-white/10 text-white text-right"
                    />
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <Button
                    className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm h-9"
                    onClick={runAnalysis}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                    Analyze
                  </Button>
                  <Button variant="outline" size="sm" className="border-white/20 text-white h-9" onClick={clearAll}>
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Surgical Cases */}
            <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Syringe className="h-4 w-4 text-cyan-400" />
                  Surgical Cases
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[160px]">
                  <div className="space-y-1">
                    {SURGICAL_CASES.map((surgical) => (
                      <button
                        key={surgical.id}
                        className={cn(
                          'w-full p-2 rounded text-left transition-all',
                          activeCase === surgical.id
                            ? 'bg-blue-500/20 border border-blue-500/50'
                            : 'bg-white/5 hover:bg-white/10 border border-transparent'
                        )}
                        onClick={() => loadCase(surgical)}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-white truncate">{surgical.name}</p>
                          <Badge variant="outline" className="text-[10px] border-white/20">
                            {surgical.riskFactors.length} factors
                          </Badge>
                        </div>
                        <p className="text-[10px] text-white/40 truncate">{surgical.procedure}</p>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Center Panel */}
          <div className="col-span-6 space-y-3">
            {/* Risk Dashboard */}
            {riskResults && (
              <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-white">Perioperative Risk Assessment</span>
                    <Badge className={cn('bg-gradient-to-r', getRiskBg(riskResults.overall))}>
                      {riskResults.riskClass}: {riskResults.overall}%
                    </Badge>
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {[
                      { label: 'Mortality', value: riskResults.mortality, icon: XCircle },
                      { label: 'Cardiac', value: riskResults.cardiac, icon: Heart },
                      { label: 'Pulmonary', value: riskResults.pulmonary, icon: Wind },
                      { label: 'Infection', value: riskResults.infection, icon: Thermometer },
                      { label: 'VTE', value: riskResults.vte, icon: Droplets },
                      { label: 'Renal', value: riskResults.renal, icon: Activity },
                      { label: 'Readmit', value: riskResults.readmission, icon: TrendingUp },
                    ].map((outcome) => (
                      <div key={outcome.label} className="text-center">
                        <outcome.icon className={cn('h-4 w-4 mx-auto mb-1', getRiskColor(outcome.value))} />
                        <div className="text-[9px] text-white/50">{outcome.label}</div>
                        <div className={cn('text-sm font-bold', getRiskColor(outcome.value))}>
                          {outcome.value}%
                        </div>
                        <div className="h-1 bg-white/10 rounded-full mt-1">
                          <div
                            className={cn('h-full rounded-full bg-gradient-to-r', getRiskBg(outcome.value))}
                            style={{ width: `${outcome.value}%` }}
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
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Atom className="h-4 w-4 text-cyan-400" />
                  Quantum Circuit ({NUM_QUBITS} Qubits × {maxColumn} Depth)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative overflow-x-auto">
                  <div className="space-y-0.5 min-w-[700px]">
                    {RISK_FACTORS.map((factor) => {
                      const isActive = selectedRiskFactors.includes(factor.id) ||
                        (factor.id === 0 && patientAge >= 65) ||
                        (factor.id === 1 && patientBMI >= 30) ||
                        (factor.id === 2 && asaClass >= 3) ||
                        (factor.id === 10 && isEmergency);
                      const gatesOnQubit = gates.filter((g) => g.qubit === factor.id);

                      return (
                        <div key={factor.id} className="flex items-center gap-1">
                          <div className={cn('w-16 flex items-center gap-1 flex-shrink-0', isActive ? 'opacity-100' : 'opacity-30')}>
                            <div className={cn('w-5 h-5 rounded text-[8px] font-bold flex items-center justify-center text-white', factor.color)}>
                              {factor.shortName}
                            </div>
                            <span className="text-[10px] text-white/60">q[{factor.id}]</span>
                          </div>

                          <div className="flex-1 flex items-center relative">
                            <div className={cn('absolute inset-y-0 left-0 right-0 flex items-center', isActive ? 'opacity-100' : 'opacity-20')}>
                              <div className="w-full h-[2px] bg-gradient-to-r from-blue-500/40 via-cyan-500/40 to-blue-500/40" />
                            </div>

                            <div className="flex gap-0.5 relative z-10">
                              {Array.from({ length: Math.max(maxColumn, 10) }).map((_, col) => {
                                const gateAtPosition = gatesOnQubit.find((g) => g.column === col);
                                const isControl = gates.some((g) => g.column === col && g.controlQubits?.includes(factor.id));

                                return (
                                  <TooltipProvider key={col}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div
                                          className={cn(
                                            'w-7 h-7 rounded flex items-center justify-center flex-shrink-0',
                                            gateAtPosition
                                              ? GATE_INFO[gateAtPosition.gate]?.color || 'bg-gray-500'
                                              : isControl
                                              ? 'bg-indigo-500/40 border border-indigo-400/50'
                                              : 'border border-white/5'
                                          )}
                                        >
                                          {gateAtPosition && (
                                            <span className="text-white text-[9px] font-bold">
                                              {GATE_INFO[gateAtPosition.gate]?.symbol}
                                            </span>
                                          )}
                                          {isControl && !gateAtPosition && (
                                            <div className="w-2 h-2 rounded-full bg-indigo-400" />
                                          )}
                                        </div>
                                      </TooltipTrigger>
                                      {gateAtPosition && (
                                        <TooltipContent>
                                          <p className="font-semibold">{GATE_INFO[gateAtPosition.gate]?.name}</p>
                                          <p className="text-xs text-muted-foreground">{gateAtPosition.reason}</p>
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
              </CardContent>
            </Card>

            {/* Measurements */}
            {Object.keys(measurementResults).length > 0 && (
              <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-400" />
                    Measurement Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {Object.entries(measurementResults)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 8)
                      .map(([state, count]) => {
                        const probability = (count / shots) * 100;
                        const ones = state.split('').filter((c) => c === '1').length;
                        return (
                          <div key={state} className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-white/60 w-28 truncate">|{state.slice(-12)}⟩</span>
                            <span className="text-[10px] text-white/40 w-6">{ones}↑</span>
                            <div className="flex-1 h-3 bg-white/5 rounded overflow-hidden">
                              <div
                                className={cn(
                                  'h-full',
                                  ones >= 7 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                                  ones >= 4 ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
                                  'bg-gradient-to-r from-blue-500 to-cyan-500'
                                )}
                                style={{ width: `${probability}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-white/60 w-14 text-right">{probability.toFixed(1)}%</span>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Panel */}
          <div className="col-span-3 space-y-3">
            {/* Risk Interactions */}
            <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-400" />
                  Risk Interactions ({riskResults?.interactions.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[220px]">
                  {riskResults && riskResults.interactions.length > 0 ? (
                    <div className="space-y-2">
                      {riskResults.interactions
                        .sort((a, b) => {
                          const order = { critical: 0, major: 1, moderate: 2, minor: 3 };
                          return order[a.severity] - order[b.severity];
                        })
                        .map((interaction, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              'p-2 rounded-lg border',
                              interaction.severity === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                              interaction.severity === 'major' ? 'bg-orange-500/10 border-orange-500/30' :
                              'bg-yellow-500/10 border-yellow-500/30'
                            )}
                          >
                            <p className="text-[11px] text-white">{interaction.description}</p>
                            <p className="text-[10px] text-white/50 mt-1">{interaction.clinicalNote}</p>
                            <div className="flex gap-1 mt-1">
                              <Badge variant="outline" className="text-[9px] px-1 py-0 border-white/20">
                                {interaction.severity}
                              </Badge>
                              <Badge variant="outline" className="text-[9px] px-1 py-0 border-white/20">
                                {interaction.outcomeType}
                              </Badge>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6">
                      <CheckCircle className="h-8 w-8 text-green-400 mb-2" />
                      <p className="text-green-400 text-sm">Low interaction risk</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Recommendations */}
            <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-green-400" />
                  Perioperative Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[220px]">
                  {riskResults ? (
                    <div className="space-y-1">
                      {riskResults.recommendations.map((rec, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            'p-2 rounded text-[11px]',
                            rec.includes('🚨') ? 'bg-red-500/10 text-red-300' :
                            rec.startsWith('•') ? 'bg-white/5 text-white/70 ml-2' :
                            rec.includes('✅') ? 'bg-green-500/10 text-green-300' :
                            'bg-orange-500/10 text-orange-300'
                          )}
                        >
                          {rec}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6">
                      <Shield className="h-8 w-8 text-white/20 mb-2" />
                      <p className="text-white/40 text-xs">Run analysis for recommendations</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
