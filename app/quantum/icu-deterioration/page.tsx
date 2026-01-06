'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  HeartPulse,
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
  Thermometer,
  Droplets,
  Timer,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  RotateCcw,
  Gauge,
  Users,
  FileText,
  Shield,
  BellRing,
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

interface VitalInteraction {
  vitals: number[];
  severity: 'watch' | 'warning' | 'critical' | 'emergent';
  syndrome: string;
  description: string;
  intervention: string;
}

interface PatientScenario {
  id: string;
  name: string;
  diagnosis: string;
  icuDay: number;
  vitals: number[];
  vitalValues: Record<number, number>;
  description: string;
}

// 12-Qubit Vital Sign / Lab Abnormality Definitions
const VITAL_PARAMETERS: {
  id: number;
  name: string;
  shortName: string;
  unit: string;
  normalRange: string;
  description: string;
  color: string;
  icon: typeof Heart;
  thresholds: { low: number; high: number; critLow: number; critHigh: number };
}[] = [
  {
    id: 0,
    name: 'Heart Rate',
    shortName: 'HR',
    unit: 'bpm',
    normalRange: '60-100',
    description: 'Pulse rate - tachycardia or bradycardia',
    color: 'bg-red-500',
    icon: Heart,
    thresholds: { low: 50, high: 110, critLow: 40, critHigh: 130 },
  },
  {
    id: 1,
    name: 'Blood Pressure',
    shortName: 'MAP',
    unit: 'mmHg',
    normalRange: '65-100 MAP',
    description: 'Mean arterial pressure - hypotension critical',
    color: 'bg-rose-500',
    icon: Activity,
    thresholds: { low: 65, high: 110, critLow: 55, critHigh: 130 },
  },
  {
    id: 2,
    name: 'Respiratory Rate',
    shortName: 'RR',
    unit: '/min',
    normalRange: '12-20',
    description: 'Breathing rate - respiratory distress indicator',
    color: 'bg-cyan-500',
    icon: Wind,
    thresholds: { low: 10, high: 24, critLow: 8, critHigh: 30 },
  },
  {
    id: 3,
    name: 'Oxygen Saturation',
    shortName: 'SpO2',
    unit: '%',
    normalRange: '94-100',
    description: 'Blood oxygen level',
    color: 'bg-blue-500',
    icon: Droplets,
    thresholds: { low: 94, high: 100, critLow: 88, critHigh: 100 },
  },
  {
    id: 4,
    name: 'Temperature',
    shortName: 'Temp',
    unit: '°C',
    normalRange: '36.5-37.5',
    description: 'Core body temperature - fever/hypothermia',
    color: 'bg-orange-500',
    icon: Thermometer,
    thresholds: { low: 36, high: 38, critLow: 35, critHigh: 39 },
  },
  {
    id: 5,
    name: 'Mental Status (GCS)',
    shortName: 'GCS',
    unit: '/15',
    normalRange: '15',
    description: 'Glasgow Coma Scale - neurologic status',
    color: 'bg-purple-500',
    icon: Brain,
    thresholds: { low: 14, high: 15, critLow: 8, critHigh: 15 },
  },
  {
    id: 6,
    name: 'Urine Output',
    shortName: 'UOP',
    unit: 'mL/hr',
    normalRange: '>30',
    description: 'Hourly urine output - kidney perfusion marker',
    color: 'bg-yellow-500',
    icon: Droplets,
    thresholds: { low: 30, high: 200, critLow: 10, critHigh: 300 },
  },
  {
    id: 7,
    name: 'Lactate',
    shortName: 'Lac',
    unit: 'mmol/L',
    normalRange: '<2.0',
    description: 'Serum lactate - tissue perfusion marker',
    color: 'bg-pink-500',
    icon: TrendingUp,
    thresholds: { low: 0, high: 2, critLow: 0, critHigh: 4 },
  },
  {
    id: 8,
    name: 'WBC Count',
    shortName: 'WBC',
    unit: 'K/uL',
    normalRange: '4-11',
    description: 'White blood cell count - infection/inflammation',
    color: 'bg-green-500',
    icon: Shield,
    thresholds: { low: 4, high: 12, critLow: 2, critHigh: 20 },
  },
  {
    id: 9,
    name: 'Creatinine',
    shortName: 'Cr',
    unit: 'mg/dL',
    normalRange: '0.7-1.3',
    description: 'Serum creatinine - kidney function',
    color: 'bg-amber-500',
    icon: Activity,
    thresholds: { low: 0.5, high: 1.5, critLow: 0.3, critHigh: 3.0 },
  },
  {
    id: 10,
    name: 'Arterial pH',
    shortName: 'pH',
    unit: '',
    normalRange: '7.35-7.45',
    description: 'Blood acidity - acidosis/alkalosis',
    color: 'bg-indigo-500',
    icon: Gauge,
    thresholds: { low: 7.35, high: 7.45, critLow: 7.2, critHigh: 7.55 },
  },
  {
    id: 11,
    name: 'Vasopressor Need',
    shortName: 'Vaso',
    unit: 'mcg/kg/min',
    normalRange: '0',
    description: 'Vasopressor requirement - circulatory failure',
    color: 'bg-red-600',
    icon: Zap,
    thresholds: { low: 0, high: 0.1, critLow: 0, critHigh: 0.3 },
  },
];

// Syndrome patterns based on vital combinations
const VITAL_INTERACTIONS: VitalInteraction[] = [
  // Sepsis patterns
  {
    vitals: [0, 2, 4],
    severity: 'critical',
    syndrome: 'SIRS/Sepsis',
    description: 'Tachycardia + Tachypnea + Fever: SIRS criteria met',
    intervention: 'Blood cultures, lactate, consider antibiotics. Evaluate for source.',
  },
  {
    vitals: [1, 7, 11],
    severity: 'emergent',
    syndrome: 'Septic Shock',
    description: 'Hypotension + Elevated Lactate + Vasopressors: Septic shock',
    intervention: 'EMERGENT: Aggressive fluid resuscitation, broad-spectrum abx, source control.',
  },
  {
    vitals: [0, 1, 7, 8],
    severity: 'emergent',
    syndrome: 'Severe Sepsis',
    description: 'Full sepsis constellation with leukocytosis',
    intervention: 'Activate sepsis bundle. 30mL/kg crystalloid. Hour-1 bundle.',
  },
  // Respiratory failure
  {
    vitals: [2, 3],
    severity: 'critical',
    syndrome: 'Respiratory Distress',
    description: 'Tachypnea + Hypoxemia: Respiratory failure',
    intervention: 'Increase O2, consider BiPAP/HFNC, ABG, CXR stat.',
  },
  {
    vitals: [2, 3, 10],
    severity: 'emergent',
    syndrome: 'Respiratory Failure + Acidosis',
    description: 'Hypoxemia + Acidosis: Impending respiratory arrest',
    intervention: 'EMERGENT: Prepare for intubation, call anesthesia/RT.',
  },
  // Cardiogenic shock
  {
    vitals: [0, 1, 6],
    severity: 'critical',
    syndrome: 'Cardiogenic Shock',
    description: 'Tachycardia + Hypotension + Low UOP: Pump failure',
    intervention: 'Echo stat, consider inotropes, cardiology consult urgent.',
  },
  {
    vitals: [0, 1, 7, 11],
    severity: 'emergent',
    syndrome: 'Severe Cardiogenic Shock',
    description: 'Shock with elevated lactate requiring pressors',
    intervention: 'EMERGENT: Mechanical support consideration, cath lab alert.',
  },
  // AKI
  {
    vitals: [6, 9],
    severity: 'warning',
    syndrome: 'Acute Kidney Injury',
    description: 'Oliguria + Rising Creatinine: AKI developing',
    intervention: 'Hold nephrotoxins, optimize volume, consider diuretics if euvolemic.',
  },
  {
    vitals: [6, 9, 10],
    severity: 'critical',
    syndrome: 'Severe AKI with Acidosis',
    description: 'AKI with metabolic acidosis',
    intervention: 'Nephrology consult, RRT evaluation, bicarbonate consideration.',
  },
  // Neurologic
  {
    vitals: [5],
    severity: 'warning',
    syndrome: 'Altered Mental Status',
    description: 'GCS decline: Neurologic change',
    intervention: 'Neuro exam, glucose check, consider CT head, evaluate for delirium.',
  },
  {
    vitals: [0, 1, 5],
    severity: 'critical',
    syndrome: 'Cushing Response',
    description: 'Bradycardia + Hypertension + GCS decline: ICP concern',
    intervention: 'EMERGENT: Neurosurgery consult, head CT, ICP management.',
  },
  // Bleeding/Hemorrhage
  {
    vitals: [0, 1],
    severity: 'critical',
    syndrome: 'Hemorrhagic Shock',
    description: 'Tachycardia + Hypotension: Consider bleeding',
    intervention: 'Type & screen, consider massive transfusion protocol, find source.',
  },
  // Multi-organ dysfunction
  {
    vitals: [1, 6, 7, 9],
    severity: 'emergent',
    syndrome: 'Multi-Organ Dysfunction',
    description: 'Hypotension + Oliguria + Lactate + Cr: MODS',
    intervention: 'EMERGENT: Goals of care discussion, aggressive support, family meeting.',
  },
  {
    vitals: [0, 1, 2, 3, 5, 7],
    severity: 'emergent',
    syndrome: 'Impending Arrest',
    description: 'Multiple deranged vitals: Pre-arrest state',
    intervention: 'CODE BLUE preparation, escalate to senior, call rapid response.',
  },
  // Metabolic
  {
    vitals: [7, 10],
    severity: 'critical',
    syndrome: 'Severe Metabolic Acidosis',
    description: 'Elevated lactate with acidemia',
    intervention: 'Identify cause (Type A vs B), optimize perfusion, consider bicarb.',
  },
  // Infection
  {
    vitals: [4, 8],
    severity: 'warning',
    syndrome: 'Infectious Process',
    description: 'Fever + Leukocytosis: Infection likely',
    intervention: 'Pan-culture, imaging as appropriate, consider antibiotics.',
  },
];

// Patient scenarios
const ICU_SCENARIOS: PatientScenario[] = [
  {
    id: 'stable-postop',
    name: 'Stable Post-Op Day 1',
    diagnosis: 'Post Colectomy',
    icuDay: 1,
    vitals: [],
    vitalValues: { 0: 78, 1: 75, 2: 16, 3: 97, 4: 37.0, 5: 15, 6: 45, 7: 1.2, 8: 9, 9: 1.0, 10: 7.40, 11: 0 },
    description: 'Routine post-op monitoring, stable vitals',
  },
  {
    id: 'early-sepsis',
    name: 'Early Sepsis - UTI Source',
    diagnosis: 'Urosepsis',
    icuDay: 2,
    vitals: [0, 2, 4, 8],
    vitalValues: { 0: 115, 1: 68, 2: 26, 3: 94, 4: 38.8, 5: 14, 6: 25, 7: 2.8, 8: 18, 9: 1.4, 10: 7.36, 11: 0 },
    description: 'SIRS criteria met, UTI suspected',
  },
  {
    id: 'septic-shock',
    name: 'Septic Shock - Pneumonia',
    diagnosis: 'Severe CAP',
    icuDay: 3,
    vitals: [0, 1, 2, 4, 7, 8, 11],
    vitalValues: { 0: 128, 1: 58, 2: 32, 3: 91, 4: 39.2, 5: 13, 6: 15, 7: 5.4, 8: 22, 9: 2.1, 10: 7.28, 11: 0.2 },
    description: 'Refractory hypotension requiring vasopressors',
  },
  {
    id: 'ards',
    name: 'ARDS - COVID-19',
    diagnosis: 'COVID-19 ARDS',
    icuDay: 7,
    vitals: [2, 3, 10],
    vitalValues: { 0: 102, 1: 72, 2: 34, 3: 86, 4: 37.5, 5: 11, 6: 30, 7: 2.2, 8: 12, 9: 1.3, 10: 7.32, 11: 0 },
    description: 'Intubated, P/F ratio 95, severe hypoxemia',
  },
  {
    id: 'cardiogenic',
    name: 'Cardiogenic Shock - STEMI',
    diagnosis: 'Anterior STEMI',
    icuDay: 1,
    vitals: [0, 1, 6, 7, 11],
    vitalValues: { 0: 118, 1: 55, 2: 24, 3: 93, 4: 36.8, 5: 14, 6: 12, 7: 4.8, 8: 11, 9: 1.8, 10: 7.30, 11: 0.15 },
    description: 'Post-cath, EF 20%, on norepinephrine',
  },
  {
    id: 'aki-ckd',
    name: 'AKI on CKD - Dehydration',
    diagnosis: 'AKI Stage 3',
    icuDay: 2,
    vitals: [6, 9, 10],
    vitalValues: { 0: 88, 1: 70, 2: 18, 3: 96, 4: 37.2, 5: 15, 6: 8, 7: 1.8, 8: 7, 9: 4.2, 10: 7.28, 11: 0 },
    description: 'Oliguric, creatinine trending up from baseline 2.0',
  },
  {
    id: 'gi-bleed',
    name: 'Upper GI Bleed',
    diagnosis: 'Variceal Bleed',
    icuDay: 1,
    vitals: [0, 1],
    vitalValues: { 0: 125, 1: 58, 2: 22, 3: 95, 4: 36.5, 5: 14, 6: 20, 7: 3.2, 8: 10, 9: 1.1, 10: 7.35, 11: 0 },
    description: 'Hematemesis, Hgb 6.8, transfusing',
  },
  {
    id: 'altered-mental',
    name: 'ICU Delirium',
    diagnosis: 'Post-op Delirium',
    icuDay: 4,
    vitals: [5],
    vitalValues: { 0: 95, 1: 78, 2: 18, 3: 97, 4: 37.1, 5: 12, 6: 40, 7: 1.0, 8: 8, 9: 0.9, 10: 7.42, 11: 0 },
    description: 'Fluctuating mental status, CAM-ICU positive',
  },
  {
    id: 'mods',
    name: 'Multi-Organ Failure',
    diagnosis: 'Necrotizing Pancreatitis',
    icuDay: 10,
    vitals: [0, 1, 2, 3, 6, 7, 9, 10, 11],
    vitalValues: { 0: 135, 1: 52, 2: 36, 3: 88, 4: 38.5, 5: 10, 6: 5, 7: 8.2, 8: 25, 9: 5.1, 10: 7.18, 11: 0.4 },
    description: 'Progressive organ failure, CRRT initiated',
  },
  {
    id: 'pre-arrest',
    name: 'Pre-Arrest State',
    diagnosis: 'Massive PE',
    icuDay: 1,
    vitals: [0, 1, 2, 3, 5, 7, 10, 11],
    vitalValues: { 0: 145, 1: 48, 2: 40, 3: 78, 4: 36.0, 5: 8, 6: 0, 7: 9.5, 8: 14, 9: 2.8, 10: 7.12, 11: 0.5 },
    description: 'EMERGENT: Obstructive shock, tPA consideration',
  },
];

// Gate definitions
const GATE_INFO: Record<string, { name: string; symbol: string; color: string }> = {
  x: { name: 'Abnormal', symbol: 'X', color: 'bg-red-500' },
  h: { name: 'Hadamard', symbol: 'H', color: 'bg-blue-500' },
  cx: { name: 'Interaction', symbol: 'CX', color: 'bg-indigo-500' },
  ccx: { name: 'Syndrome', symbol: 'CCX', color: 'bg-amber-500' },
  ry: { name: 'Severity', symbol: 'Ry', color: 'bg-purple-500' },
  rz: { name: 'Phase', symbol: 'Rz', color: 'bg-teal-500' },
  s: { name: 'Critical', symbol: 'S', color: 'bg-red-600' },
};

const NUM_QUBITS = 12;

export default function ICUDeteriorationDemo() {
  const [selectedVitals, setSelectedVitals] = useState<number[]>([]);
  const [gates, setGates] = useState<PlacedGate[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<{
    deteriorationRisk: number;
    sepsisRisk: number;
    respiratoryRisk: number;
    cardiacRisk: number;
    renalRisk: number;
    mortalityRisk: number;
    syndromes: VitalInteraction[];
    recommendations: string[];
    newsScore: number;
    riskLevel: string;
    circuitDepth: number;
  } | null>(null);
  const [measurementResults, setMeasurementResults] = useState<Record<string, number>>({});
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [shots, setShots] = useState(2048);

  const toggleVital = (vitalId: number) => {
    setSelectedVitals((prev) =>
      prev.includes(vitalId) ? prev.filter((id) => id !== vitalId) : [...prev, vitalId]
    );
    setResults(null);
    setActiveScenario(null);
  };

  const loadScenario = (scenario: PatientScenario) => {
    setSelectedVitals(scenario.vitals);
    setActiveScenario(scenario.id);
    setResults(null);
  };

  const buildCircuit = useCallback(() => {
    const newGates: PlacedGate[] = [];
    let column = 0;

    // Phase 1: X gates for abnormal vitals
    selectedVitals.forEach((vitalId) => {
      newGates.push({
        id: `x-${vitalId}-${column}`,
        gate: 'x',
        qubit: vitalId,
        column,
        reason: `${VITAL_PARAMETERS[vitalId].name} abnormal`,
      });
    });
    if (selectedVitals.length > 0) column++;

    // Phase 2: Superposition for outcome exploration
    if (selectedVitals.length >= 3) {
      selectedVitals.slice(0, Math.min(4, selectedVitals.length)).forEach((vitalId) => {
        newGates.push({
          id: `h-${vitalId}-${column}`,
          gate: 'h',
          qubit: vitalId,
          column,
          reason: `Explore ${VITAL_PARAMETERS[vitalId].shortName} outcomes`,
        });
      });
      column++;
    }

    // Phase 3: Syndrome interactions
    const activeSyndromes = VITAL_INTERACTIONS.filter((interaction) =>
      interaction.vitals.every((v) => selectedVitals.includes(v))
    );

    const twoVital = activeSyndromes.filter((s) => s.vitals.length === 2);
    const threeVital = activeSyndromes.filter((s) => s.vitals.length >= 3);

    twoVital.forEach((syndrome) => {
      newGates.push({
        id: `cx-${syndrome.vitals.join('-')}-${column}`,
        gate: 'cx',
        qubit: syndrome.vitals[0],
        column,
        controlQubits: [syndrome.vitals[1]],
        reason: syndrome.syndrome,
      });
      column++;

      const severityAngle =
        syndrome.severity === 'emergent' ? Math.PI * 0.5 :
        syndrome.severity === 'critical' ? Math.PI * 0.4 :
        syndrome.severity === 'warning' ? Math.PI * 0.25 :
        Math.PI * 0.1;

      newGates.push({
        id: `ry-${syndrome.vitals.join('-')}-${column}`,
        gate: 'ry',
        qubit: syndrome.vitals[0],
        column,
        params: { theta: severityAngle },
        reason: `${syndrome.severity} severity`,
      });
      column++;
    });

    threeVital.forEach((syndrome) => {
      if (syndrome.vitals.length >= 3) {
        newGates.push({
          id: `ccx-${syndrome.vitals.join('-')}-${column}`,
          gate: 'ccx',
          qubit: syndrome.vitals[0],
          column,
          controlQubits: [syndrome.vitals[1], syndrome.vitals[2]],
          reason: syndrome.syndrome,
        });
        column++;

        const severityAngle = syndrome.severity === 'emergent' ? Math.PI * 0.5 : Math.PI * 0.4;

        newGates.push({
          id: `ry-syndrome-${syndrome.vitals.join('-')}-${column}`,
          gate: 'ry',
          qubit: syndrome.vitals[0],
          column,
          params: { theta: severityAngle },
          reason: `Syndrome amplification`,
        });

        if (syndrome.severity === 'emergent') {
          newGates.push({
            id: `s-${syndrome.vitals.join('-')}-${column}`,
            gate: 's',
            qubit: syndrome.vitals[1],
            column,
            reason: 'EMERGENT phase shift',
          });
        }
        column++;
      }
    });

    // Phase 4: Cross-system correlations
    const correlations: [number, number][] = [
      [0, 1],   // HR-BP
      [2, 3],   // RR-SpO2
      [6, 9],   // UOP-Cr
      [7, 10],  // Lactate-pH
      [1, 11],  // BP-Vasopressors
    ];

    correlations.forEach(([v1, v2]) => {
      if (selectedVitals.includes(v1) && selectedVitals.includes(v2)) {
        const alreadyConnected = activeSyndromes.some(
          (s) => s.vitals.includes(v1) && s.vitals.includes(v2)
        );
        if (!alreadyConnected) {
          newGates.push({
            id: `cx-corr-${v1}-${v2}-${column}`,
            gate: 'cx',
            qubit: v1,
            column,
            controlQubits: [v2],
            reason: `${VITAL_PARAMETERS[v1].shortName}-${VITAL_PARAMETERS[v2].shortName} correlation`,
          });
        }
      }
    });
    if (selectedVitals.length >= 3) column++;

    // Phase 5: Final interference
    if (selectedVitals.length >= 2) {
      selectedVitals.slice(-2).forEach((vitalId) => {
        newGates.push({
          id: `h-final-${vitalId}-${column}`,
          gate: 'h',
          qubit: vitalId,
          column,
          reason: 'Final measurement prep',
        });
      });
    }

    setGates(newGates);
    return newGates;
  }, [selectedVitals]);

  const runAnalysis = async () => {
    setIsAnalyzing(true);

    const circuitGates = buildCircuit();
    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      const gateList = circuitGates.sort((a, b) => a.column - b.column).map((g) => ({
        gate: g.gate,
        qubit: g.qubit,
        targetQubit: g.controlQubits?.[0],
        control2: g.controlQubits?.[1],
        params: g.params?.theta ? [g.params.theta] : undefined,
      }));

      // Try Qiskit
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
        // Fallback
      }

      if (!simulationSuccess) {
        const { SimpleQuantumCircuit } = await import('@/lib/quantum-sim');
        const circuit = new SimpleQuantumCircuit(NUM_QUBITS);

        for (const placedGate of circuitGates.sort((a, b) => a.column - b.column)) {
          if (placedGate.gate === 'x') circuit.addGate('x', placedGate.qubit);
          else if (placedGate.gate === 'h') circuit.addGate('h', placedGate.qubit);
          else if (placedGate.gate === 's') circuit.addGate('s', placedGate.qubit);
          else if (placedGate.gate === 'cx' && placedGate.controlQubits)
            circuit.addGate('cx', placedGate.qubit, placedGate.controlQubits);
          else if (placedGate.gate === 'ccx' && placedGate.controlQubits && placedGate.controlQubits.length >= 2)
            circuit.addGate('ccx', placedGate.qubit, placedGate.controlQubits);
          else if (placedGate.gate === 'ry' && placedGate.params?.theta)
            circuit.addGate('ry', placedGate.qubit, undefined, { theta: placedGate.params.theta });
        }

        const result = circuit.runWithMeasurements(shots);
        measurements = result.measurements;
      }

      setMeasurementResults(measurements);

      // Calculate outcomes
      const activeSyndromes = VITAL_INTERACTIONS.filter((s) =>
        s.vitals.every((v) => selectedVitals.includes(v))
      );

      const totalMeasurements = Object.values(measurements).reduce((a, b) => a + b, 0);
      let highRiskCount = 0;

      Object.entries(measurements).forEach(([state, count]) => {
        const ones = state.split('').filter((c) => c === '1').length;
        if (ones >= Math.floor(selectedVitals.length * 0.6)) highRiskCount += count;
      });

      const highRiskProb = highRiskCount / totalMeasurements;

      // Risk calculations
      const risks = {
        sepsis: 0,
        respiratory: 0,
        cardiac: 0,
        renal: 0,
        mortality: 0,
      };

      activeSyndromes.forEach((syndrome) => {
        const baseSeverity =
          syndrome.severity === 'emergent' ? 30 :
          syndrome.severity === 'critical' ? 20 :
          syndrome.severity === 'warning' ? 10 :
          5;

        const quantumFactor = 1 + (highRiskProb * 0.4);

        if (syndrome.syndrome.toLowerCase().includes('sepsis') || syndrome.syndrome.toLowerCase().includes('infection')) {
          risks.sepsis += baseSeverity * quantumFactor;
        }
        if (syndrome.syndrome.toLowerCase().includes('respiratory') || syndrome.syndrome.toLowerCase().includes('ards')) {
          risks.respiratory += baseSeverity * quantumFactor;
        }
        if (syndrome.syndrome.toLowerCase().includes('cardiac') || syndrome.syndrome.toLowerCase().includes('shock')) {
          risks.cardiac += baseSeverity * quantumFactor;
        }
        if (syndrome.syndrome.toLowerCase().includes('renal') || syndrome.syndrome.toLowerCase().includes('aki')) {
          risks.renal += baseSeverity * quantumFactor;
        }
        if (syndrome.severity === 'emergent' || syndrome.syndrome.toLowerCase().includes('arrest') || syndrome.syndrome.toLowerCase().includes('mods')) {
          risks.mortality += baseSeverity * quantumFactor * 1.5;
        }
      });

      // Individual vital contributions
      selectedVitals.forEach((vitalId) => {
        if ([0, 1, 11].includes(vitalId)) risks.cardiac += 5;
        if ([2, 3].includes(vitalId)) risks.respiratory += 5;
        if ([6, 9].includes(vitalId)) risks.renal += 5;
        if ([4, 8].includes(vitalId)) risks.sepsis += 5;
      });

      // Cap at 95
      Object.keys(risks).forEach((key) => {
        risks[key as keyof typeof risks] = Math.min(95, Math.round(risks[key as keyof typeof risks]));
      });

      // Overall deterioration risk
      const maxRisk = Math.max(...Object.values(risks));
      const avgRisk = Object.values(risks).reduce((a, b) => a + b, 0) / 5;
      const deteriorationRisk = Math.min(98, Math.round(
        maxRisk * 0.4 + avgRisk * 0.3 + selectedVitals.length * 5 + highRiskProb * 25
      ));

      // NEWS-like score (simplified)
      const newsScore = Math.min(20, Math.round(selectedVitals.length * 2 + activeSyndromes.length * 2));

      // Risk level
      let riskLevel = 'Low';
      if (deteriorationRisk >= 70 || activeSyndromes.some((s) => s.severity === 'emergent')) riskLevel = 'EMERGENT';
      else if (deteriorationRisk >= 50) riskLevel = 'Critical';
      else if (deteriorationRisk >= 30) riskLevel = 'High';
      else if (deteriorationRisk >= 15) riskLevel = 'Moderate';

      // Recommendations
      const recommendations: string[] = [];

      if (riskLevel === 'EMERGENT') {
        recommendations.push('🚨 EMERGENT: Immediate attending notification');
        recommendations.push('• Call rapid response/code team');
        recommendations.push('• Prepare for potential resuscitation');
      }

      activeSyndromes.forEach((syndrome) => {
        if (syndrome.severity === 'emergent' || syndrome.severity === 'critical') {
          recommendations.push(`⚠️ ${syndrome.syndrome}:`);
          recommendations.push(`• ${syndrome.intervention}`);
        }
      });

      if (risks.sepsis >= 30) {
        recommendations.push('🦠 SEPSIS CONCERN:');
        recommendations.push('• Blood cultures x2, lactate, procalcitonin');
        recommendations.push('• Broad-spectrum antibiotics within 1 hour');
      }

      if (risks.respiratory >= 30) {
        recommendations.push('🫁 RESPIRATORY CONCERN:');
        recommendations.push('• ABG, CXR stat');
        recommendations.push('• Escalate respiratory support');
      }

      if (risks.cardiac >= 30) {
        recommendations.push('🫀 CARDIAC CONCERN:');
        recommendations.push('• 12-lead ECG, troponin');
        recommendations.push('• Echo if new hypotension');
      }

      if (risks.renal >= 30) {
        recommendations.push('💧 RENAL CONCERN:');
        recommendations.push('• Assess volume status');
        recommendations.push('• Hold nephrotoxins, optimize perfusion');
      }

      if (recommendations.length === 0) {
        recommendations.push('✅ Patient appears stable');
        recommendations.push('• Continue routine monitoring');
        recommendations.push('• Reassess in 4 hours');
      }

      const circuitDepth = circuitGates.length > 0 ? Math.max(...circuitGates.map((g) => g.column)) + 1 : 0;

      setResults({
        deteriorationRisk,
        sepsisRisk: risks.sepsis,
        respiratoryRisk: risks.respiratory,
        cardiacRisk: risks.cardiac,
        renalRisk: risks.renal,
        mortalityRisk: risks.mortality,
        syndromes: activeSyndromes,
        recommendations,
        newsScore,
        riskLevel,
        circuitDepth,
      });
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearAll = () => {
    setSelectedVitals([]);
    setGates([]);
    setResults(null);
    setMeasurementResults({});
    setActiveScenario(null);
  };

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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-red-950/20 to-slate-950">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
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
              <div className="p-2 rounded-lg bg-gradient-to-br from-red-500 to-orange-500">
                <HeartPulse className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">ICU Deterioration Predictor</h1>
                <p className="text-xs text-white/50">12-Qubit Early Warning System • {shots.toLocaleString()} Shots</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-red-500/50 text-red-300">
              <Atom className="h-3 w-3 mr-1" />
              {selectedVitals.length}/12 Abnormal
            </Badge>
            {results && (
              <Badge className={cn(
                'text-white',
                results.riskLevel === 'EMERGENT' ? 'bg-red-600 animate-pulse' :
                results.riskLevel === 'Critical' ? 'bg-red-500' :
                results.riskLevel === 'High' ? 'bg-orange-500' :
                'bg-green-500'
              )}>
                {results.riskLevel}: {results.deteriorationRisk}%
              </Badge>
            )}
            <Link href="/quantum/surgical-risk">
              <Badge variant="outline" className="border-blue-500/50 text-blue-300 cursor-pointer hover:bg-blue-500/10">
                Surgical Risk
              </Badge>
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-4">
          {/* Left Panel - Vital Signs */}
          <div className="col-span-3 space-y-3">
            <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4 text-red-400" />
                  Vital Sign Abnormalities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[320px] pr-2">
                  <div className="space-y-1">
                    {VITAL_PARAMETERS.map((vital) => (
                      <TooltipProvider key={vital.id}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                'flex items-center gap-2 p-1.5 rounded cursor-pointer transition-all',
                                selectedVitals.includes(vital.id)
                                  ? 'bg-red-500/20 border border-red-500/40'
                                  : 'hover:bg-white/5 border border-transparent'
                              )}
                              onClick={() => toggleVital(vital.id)}
                            >
                              <div className={cn('w-6 h-6 rounded flex items-center justify-center text-white text-[9px] font-bold', vital.color)}>
                                {vital.shortName}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-white truncate">{vital.name}</p>
                                <p className="text-[10px] text-white/40">q[{vital.id}] • {vital.normalRange} {vital.unit}</p>
                              </div>
                              {selectedVitals.includes(vital.id) && (
                                <AlertCircle className="h-3 w-3 text-red-400" />
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p className="font-semibold">{vital.name}</p>
                            <p className="text-xs text-muted-foreground">{vital.description}</p>
                            <p className="text-xs mt-1">Normal: {vital.normalRange} {vital.unit}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                </ScrollArea>

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
                    className="flex-1 bg-gradient-to-r from-red-500 to-orange-500 text-white text-sm h-9"
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

            {/* Patient Scenarios */}
            <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-orange-400" />
                  ICU Scenarios
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[180px]">
                  <div className="space-y-1">
                    {ICU_SCENARIOS.map((scenario) => (
                      <button
                        key={scenario.id}
                        className={cn(
                          'w-full p-2 rounded text-left transition-all',
                          activeScenario === scenario.id
                            ? 'bg-red-500/20 border border-red-500/50'
                            : 'bg-white/5 hover:bg-white/10 border border-transparent'
                        )}
                        onClick={() => loadScenario(scenario)}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-white truncate">{scenario.name}</p>
                          <Badge variant="outline" className="text-[10px] border-white/20">
                            {scenario.vitals.length} abnl
                          </Badge>
                        </div>
                        <p className="text-[10px] text-white/40 truncate">{scenario.diagnosis}</p>
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
            {results && (
              <Card className={cn(
                'border backdrop-blur-sm',
                results.riskLevel === 'EMERGENT' ? 'bg-red-500/20 border-red-500/50' : 'bg-black/40 border-white/10'
              )}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {results.riskLevel === 'EMERGENT' && <BellRing className="h-5 w-5 text-red-400 animate-pulse" />}
                      <span className="text-sm font-medium text-white">Deterioration Risk Assessment</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-white/20">
                        NEWS: {results.newsScore}
                      </Badge>
                      <Badge className={cn('bg-gradient-to-r', getRiskBg(results.deteriorationRisk))}>
                        {results.riskLevel}: {results.deteriorationRisk}%
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-6 gap-2">
                    {[
                      { label: 'Deterioration', value: results.deteriorationRisk, icon: TrendingDown },
                      { label: 'Sepsis', value: results.sepsisRisk, icon: Thermometer },
                      { label: 'Respiratory', value: results.respiratoryRisk, icon: Wind },
                      { label: 'Cardiac', value: results.cardiacRisk, icon: Heart },
                      { label: 'Renal', value: results.renalRisk, icon: Droplets },
                      { label: 'Mortality', value: results.mortalityRisk, icon: XCircle },
                    ].map((risk) => (
                      <div key={risk.label} className="text-center">
                        <risk.icon className={cn('h-4 w-4 mx-auto mb-1', getRiskColor(risk.value))} />
                        <div className="text-[9px] text-white/50">{risk.label}</div>
                        <div className={cn('text-sm font-bold', getRiskColor(risk.value))}>{risk.value}%</div>
                        <div className="h-1 bg-white/10 rounded-full mt-1">
                          <div className={cn('h-full rounded-full bg-gradient-to-r', getRiskBg(risk.value))} style={{ width: `${risk.value}%` }} />
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
                    {VITAL_PARAMETERS.map((vital) => {
                      const isAbnormal = selectedVitals.includes(vital.id);
                      const gatesOnQubit = gates.filter((g) => g.qubit === vital.id);

                      return (
                        <div key={vital.id} className="flex items-center gap-1">
                          <div className={cn('w-16 flex items-center gap-1 flex-shrink-0', isAbnormal ? 'opacity-100' : 'opacity-30')}>
                            <div className={cn('w-5 h-5 rounded text-[8px] font-bold flex items-center justify-center text-white', vital.color)}>
                              {vital.shortName}
                            </div>
                            <span className="text-[10px] text-white/60">q[{vital.id}]</span>
                          </div>

                          <div className="flex-1 flex items-center relative">
                            <div className={cn('absolute inset-y-0 left-0 right-0 flex items-center', isAbnormal ? 'opacity-100' : 'opacity-20')}>
                              <div className="w-full h-[2px] bg-gradient-to-r from-red-500/40 via-orange-500/40 to-red-500/40" />
                            </div>

                            <div className="flex gap-0.5 relative z-10">
                              {Array.from({ length: Math.max(maxColumn, 10) }).map((_, col) => {
                                const gateAtPosition = gatesOnQubit.find((g) => g.column === col);
                                const isControl = gates.some((g) => g.column === col && g.controlQubits?.includes(vital.id));

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
                                          {isControl && !gateAtPosition && <div className="w-2 h-2 rounded-full bg-indigo-400" />}
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
                    <BarChart3 className="h-4 w-4 text-red-400" />
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
                                  'bg-gradient-to-r from-green-500 to-green-600'
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
            {/* Syndromes */}
            <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-400" />
                  Detected Syndromes ({results?.syndromes.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[220px]">
                  {results && results.syndromes.length > 0 ? (
                    <div className="space-y-2">
                      {results.syndromes
                        .sort((a, b) => {
                          const order = { emergent: 0, critical: 1, warning: 2, watch: 3 };
                          return order[a.severity] - order[b.severity];
                        })
                        .map((syndrome, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              'p-2 rounded-lg border',
                              syndrome.severity === 'emergent' ? 'bg-red-500/20 border-red-500/50 animate-pulse' :
                              syndrome.severity === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                              'bg-orange-500/10 border-orange-500/30'
                            )}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              {syndrome.severity === 'emergent' && <BellRing className="h-3 w-3 text-red-400" />}
                              <p className="text-xs font-bold text-white">{syndrome.syndrome}</p>
                            </div>
                            <p className="text-[10px] text-white/70">{syndrome.description}</p>
                            <p className="text-[10px] text-white/50 mt-1">{syndrome.intervention}</p>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6">
                      <CheckCircle className="h-8 w-8 text-green-400 mb-2" />
                      <p className="text-green-400 text-sm">No acute syndromes</p>
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
                  Clinical Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[220px]">
                  {results ? (
                    <div className="space-y-1">
                      {results.recommendations.map((rec, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            'p-2 rounded text-[11px]',
                            rec.includes('🚨') ? 'bg-red-500/20 text-red-300 font-bold' :
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
