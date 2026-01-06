'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  FileText,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Shield,
  Activity,
  Loader2,
  Zap,
  Brain,
  BarChart3,
  PieChart,
  Atom,
  ArrowRight,
  CircleDot,
  GitBranch,
  User,
  Building2,
  Stethoscope,
  Calendar,
  MapPin,
  History,
  CreditCard,
  HeartPulse,
} from 'lucide-react';

// Types
interface PlacedGate {
  id: string;
  gate: string;
  qubit: number;
  column: number;
  controlQubits?: number[];
  params?: { theta?: number };
  reason?: string; // Why this gate was added
}

interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'gate' | 'analysis' | 'result';
  message: string;
  details?: string;
}

// Realistic claim data structure - what a business user would recognize
interface ClaimScenario {
  id: string;
  // Claimant/Member Info
  memberName: string;
  memberId: string;
  memberSince: string;
  planType: string;
  memberState: string;
  // Claim Details
  serviceDate: string;
  submissionDate: string;
  claimNumber: string;
  totalCharged: number;
  // Provider Info
  providerName: string;
  providerNPI: string;
  providerNetwork: 'In-Network' | 'Out-of-Network' | 'Tier 1' | 'Tier 2';
  providerState: string;
  facilityType: string;
  // Clinical Info
  primaryDiagnosis: string;
  diagnosisCode: string;
  procedureCodes: string[];
  modifiers: string[];
  serviceType: string;
  // Risk Indicators (what the system analyzes) - 12 factors for 12 qubits
  riskIndicators: {
    claimAmountFlag: 'normal' | 'elevated' | 'high' | 'extreme';
    providerFlag: 'trusted' | 'new' | 'watch-list' | 'flagged';
    memberFlag: 'established' | 'new' | 'high-utilizer' | 'suspect';
    codingFlag: 'standard' | 'unusual' | 'upcoding-risk' | 'unbundling-risk';
    timingFlag: 'normal' | 'rush' | 'delayed' | 'suspicious';
    authFlag: 'approved' | 'pending' | 'not-required' | 'denied' | 'expired';
    // New factors for expanded 12-qubit analysis
    networkFlag: 'in-network' | 'out-of-network' | 'out-of-area';
    duplicateFlag: 'clear' | 'possible' | 'likely';
    frequencyFlag: 'normal' | 'elevated' | 'high' | 'excessive';
    geoFlag: 'local' | 'regional' | 'distant' | 'anomaly';
    modifierFlag: 'none' | 'valid' | 'questionable' | 'invalid';
    benefitFlag: 'within-limit' | 'near-limit' | 'at-limit' | 'over-limit';
  };
  // Pre-existing context
  relatedClaims: number;
  ytdSpend: number;
  remainingDeductible: number;
  annualBenefitLimit: number;
  usedBenefitAmount: number;
}

const CLAIM_SCENARIOS: ClaimScenario[] = [
  // ===== AUTO-PAY CANDIDATES (All green flags) =====
  {
    id: 'flu-shot',
    memberName: 'Maria Garcia',
    memberId: 'MBR-1122334',
    memberSince: '2018',
    planType: 'PPO Gold',
    memberState: 'CA',
    serviceDate: '2024-01-08',
    submissionDate: '2024-01-09',
    claimNumber: 'CLM-2024-00102',
    totalCharged: 45,
    providerName: 'CVS Pharmacy #4521',
    providerNPI: '1112223334',
    providerNetwork: 'In-Network',
    providerState: 'CA',
    facilityType: 'Retail Pharmacy',
    primaryDiagnosis: 'Influenza vaccination',
    diagnosisCode: 'Z23',
    procedureCodes: ['90686'],
    modifiers: [],
    serviceType: 'Preventive - Immunization',
    riskIndicators: {
      claimAmountFlag: 'normal',
      providerFlag: 'trusted',
      memberFlag: 'established',
      codingFlag: 'standard',
      timingFlag: 'normal',
      authFlag: 'not-required',
      networkFlag: 'in-network',
      duplicateFlag: 'clear',
      frequencyFlag: 'normal',
      geoFlag: 'local',
      modifierFlag: 'none',
      benefitFlag: 'within-limit',
    },
    relatedClaims: 0,
    ytdSpend: 890,
    remainingDeductible: 0,
    annualBenefitLimit: 100000,
    usedBenefitAmount: 890,
  },
  {
    id: 'routine-labs',
    memberName: 'David Thompson',
    memberId: 'MBR-5566778',
    memberSince: '2015',
    planType: 'PPO Platinum',
    memberState: 'TX',
    serviceDate: '2024-01-10',
    submissionDate: '2024-01-11',
    claimNumber: 'CLM-2024-00156',
    totalCharged: 125,
    providerName: 'Quest Diagnostics',
    providerNPI: '4445556667',
    providerNetwork: 'In-Network',
    providerState: 'TX',
    facilityType: 'Clinical Laboratory',
    primaryDiagnosis: 'Routine blood work',
    diagnosisCode: 'Z00.00',
    procedureCodes: ['80053', '85025'],
    modifiers: [],
    serviceType: 'Laboratory - Routine',
    riskIndicators: {
      claimAmountFlag: 'normal',
      providerFlag: 'trusted',
      memberFlag: 'established',
      codingFlag: 'standard',
      timingFlag: 'normal',
      authFlag: 'not-required',
      networkFlag: 'in-network',
      duplicateFlag: 'clear',
      frequencyFlag: 'normal',
      geoFlag: 'local',
      modifierFlag: 'none',
      benefitFlag: 'within-limit',
    },
    relatedClaims: 0,
    ytdSpend: 2100,
    remainingDeductible: 0,
    annualBenefitLimit: 150000,
    usedBenefitAmount: 2100,
  },
  {
    id: 'dental-cleaning',
    memberName: 'Jennifer Lee',
    memberId: 'MBR-8899001',
    memberSince: '2016',
    planType: 'PPO Gold + Dental',
    memberState: 'NY',
    serviceDate: '2024-01-12',
    submissionDate: '2024-01-12',
    claimNumber: 'CLM-2024-00203',
    totalCharged: 95,
    providerName: 'Bright Smile Dental',
    providerNPI: '7778889990',
    providerNetwork: 'In-Network',
    providerState: 'NY',
    facilityType: 'Dental Office',
    primaryDiagnosis: 'Dental prophylaxis',
    diagnosisCode: 'Z01.20',
    procedureCodes: ['D1110', 'D0120'],
    modifiers: [],
    serviceType: 'Dental - Preventive',
    riskIndicators: {
      claimAmountFlag: 'normal',
      providerFlag: 'trusted',
      memberFlag: 'established',
      codingFlag: 'standard',
      timingFlag: 'normal',
      authFlag: 'not-required',
      networkFlag: 'in-network',
      duplicateFlag: 'clear',
      frequencyFlag: 'normal',
      geoFlag: 'local',
      modifierFlag: 'none',
      benefitFlag: 'within-limit',
    },
    relatedClaims: 0,
    ytdSpend: 450,
    remainingDeductible: 0,
    annualBenefitLimit: 2000,
    usedBenefitAmount: 450,
  },
  // ===== MIXED SCENARIOS =====
  {
    id: 'wellness',
    memberName: 'Sarah Johnson',
    memberId: 'MBR-2847591',
    memberSince: '2019',
    planType: 'PPO Gold',
    memberState: 'FL',
    serviceDate: '2024-01-15',
    submissionDate: '2024-01-16',
    claimNumber: 'CLM-2024-00847',
    totalCharged: 385,
    providerName: 'Riverside Family Medicine',
    providerNPI: '1234567890',
    providerNetwork: 'In-Network',
    providerState: 'FL',
    facilityType: 'Primary Care Office',
    primaryDiagnosis: 'Annual Wellness Exam',
    diagnosisCode: 'Z00.00',
    procedureCodes: ['99395', '36415', '80053'],
    modifiers: [],
    serviceType: 'Preventive Care',
    riskIndicators: {
      claimAmountFlag: 'normal',
      providerFlag: 'trusted',
      memberFlag: 'established',
      codingFlag: 'standard',
      timingFlag: 'normal',
      authFlag: 'not-required',
      networkFlag: 'in-network',
      duplicateFlag: 'clear',
      frequencyFlag: 'normal',
      geoFlag: 'local',
      modifierFlag: 'none',
      benefitFlag: 'within-limit',
    },
    relatedClaims: 0,
    ytdSpend: 1250,
    remainingDeductible: 0,
    annualBenefitLimit: 100000,
    usedBenefitAmount: 1250,
  },
  {
    id: 'knee-surgery',
    memberName: 'Robert Martinez',
    memberId: 'MBR-1938274',
    memberSince: '2017',
    planType: 'PPO Platinum',
    memberState: 'AZ',
    serviceDate: '2024-01-10',
    submissionDate: '2024-01-12',
    claimNumber: 'CLM-2024-00721',
    totalCharged: 47500,
    providerName: 'Metro Orthopedic Center',
    providerNPI: '9876543210',
    providerNetwork: 'Tier 1',
    providerState: 'AZ',
    facilityType: 'Ambulatory Surgery Center',
    primaryDiagnosis: 'Osteoarthritis of knee',
    diagnosisCode: 'M17.11',
    procedureCodes: ['27447', '20610', '99213', '77002'],
    modifiers: ['LT', '59'],
    serviceType: 'Surgical - Orthopedic',
    riskIndicators: {
      claimAmountFlag: 'high',
      providerFlag: 'trusted',
      memberFlag: 'established',
      codingFlag: 'standard',
      timingFlag: 'normal',
      authFlag: 'approved',
      networkFlag: 'in-network',
      duplicateFlag: 'clear',
      frequencyFlag: 'normal',
      geoFlag: 'local',
      modifierFlag: 'valid',
      benefitFlag: 'within-limit',
    },
    relatedClaims: 3,
    ytdSpend: 52400,
    remainingDeductible: 0,
    annualBenefitLimit: 500000,
    usedBenefitAmount: 52400,
  },
  {
    id: 'er-visit',
    memberName: 'Michael Chen',
    memberId: 'MBR-4782910',
    memberSince: '2022',
    planType: 'HMO Standard',
    memberState: 'CA',
    serviceDate: '2024-01-18',
    submissionDate: '2024-01-19',
    claimNumber: 'CLM-2024-00912',
    totalCharged: 12800,
    providerName: 'St. Mary\'s Emergency Dept',
    providerNPI: '5678901234',
    providerNetwork: 'Out-of-Network',
    providerState: 'NV',
    facilityType: 'Hospital Emergency Room',
    primaryDiagnosis: 'Chest pain, unspecified',
    diagnosisCode: 'R07.9',
    procedureCodes: ['99285', '71046', '93010', '80053', '85025'],
    modifiers: ['25'],
    serviceType: 'Emergency Services',
    riskIndicators: {
      claimAmountFlag: 'elevated',
      providerFlag: 'new',
      memberFlag: 'established',
      codingFlag: 'standard',
      timingFlag: 'rush',
      authFlag: 'not-required',
      networkFlag: 'out-of-network',
      duplicateFlag: 'clear',
      frequencyFlag: 'normal',
      geoFlag: 'regional',
      modifierFlag: 'valid',
      benefitFlag: 'within-limit',
    },
    relatedClaims: 0,
    ytdSpend: 3200,
    remainingDeductible: 800,
    annualBenefitLimit: 75000,
    usedBenefitAmount: 3200,
  },
  {
    id: 'specialty-rx',
    memberName: 'Emily Watson',
    memberId: 'MBR-3928471',
    memberSince: '2020',
    planType: 'PPO Gold',
    memberState: 'WA',
    serviceDate: '2024-01-20',
    submissionDate: '2024-01-20',
    claimNumber: 'CLM-2024-00985',
    totalCharged: 14500,
    providerName: 'BioScript Specialty Pharmacy',
    providerNPI: '3456789012',
    providerNetwork: 'In-Network',
    providerState: 'WA',
    facilityType: 'Specialty Pharmacy',
    primaryDiagnosis: 'Rheumatoid arthritis',
    diagnosisCode: 'M06.9',
    procedureCodes: ['J0129'],
    modifiers: [],
    serviceType: 'Specialty Pharmacy - Biologics',
    riskIndicators: {
      claimAmountFlag: 'high',
      providerFlag: 'trusted',
      memberFlag: 'high-utilizer',
      codingFlag: 'standard',
      timingFlag: 'normal',
      authFlag: 'approved',
      networkFlag: 'in-network',
      duplicateFlag: 'possible',
      frequencyFlag: 'elevated',
      geoFlag: 'local',
      modifierFlag: 'none',
      benefitFlag: 'near-limit',
    },
    relatedClaims: 12,
    ytdSpend: 168000,
    remainingDeductible: 0,
    annualBenefitLimit: 200000,
    usedBenefitAmount: 168000,
  },
  {
    id: 'suspect-pattern',
    memberName: 'James Wilson',
    memberId: 'MBR-8274910',
    memberSince: '2023',
    planType: 'EPO Basic',
    memberState: 'FL',
    serviceDate: '2024-01-17',
    submissionDate: '2024-01-17',
    claimNumber: 'CLM-2024-00876',
    totalCharged: 28900,
    providerName: 'Advanced Pain Management LLC',
    providerNPI: '7890123456',
    providerNetwork: 'In-Network',
    providerState: 'GA',
    facilityType: 'Pain Management Clinic',
    primaryDiagnosis: 'Chronic pain syndrome',
    diagnosisCode: 'G89.29',
    procedureCodes: ['64483', '64484', '77003', '20552', '20553', '64493', '64494'],
    modifiers: ['50', '59', '76', '77'],
    serviceType: 'Pain Management - Interventional',
    riskIndicators: {
      claimAmountFlag: 'extreme',
      providerFlag: 'watch-list',
      memberFlag: 'new',
      codingFlag: 'unbundling-risk',
      timingFlag: 'suspicious',
      authFlag: 'pending',
      networkFlag: 'in-network',
      duplicateFlag: 'likely',
      frequencyFlag: 'excessive',
      geoFlag: 'anomaly',
      modifierFlag: 'invalid',
      benefitFlag: 'over-limit',
    },
    relatedClaims: 8,
    ytdSpend: 89000,
    remainingDeductible: 2500,
    annualBenefitLimit: 50000,
    usedBenefitAmount: 89000,
  },
  {
    id: 'mental-health',
    memberName: 'Amanda Foster',
    memberId: 'MBR-5918273',
    memberSince: '2021',
    planType: 'PPO Standard',
    memberState: 'CO',
    serviceDate: '2024-01-19',
    submissionDate: '2024-01-22',
    claimNumber: 'CLM-2024-00934',
    totalCharged: 450,
    providerName: 'Mindful Therapy Associates',
    providerNPI: '2345678901',
    providerNetwork: 'Tier 2',
    providerState: 'CO',
    facilityType: 'Outpatient Mental Health',
    primaryDiagnosis: 'Major depressive disorder',
    diagnosisCode: 'F33.1',
    procedureCodes: ['90837', '90785'],
    modifiers: [],
    serviceType: 'Behavioral Health - Outpatient',
    riskIndicators: {
      claimAmountFlag: 'normal',
      providerFlag: 'trusted',
      memberFlag: 'established',
      codingFlag: 'standard',
      timingFlag: 'delayed',
      authFlag: 'not-required',
      networkFlag: 'in-network',
      duplicateFlag: 'clear',
      frequencyFlag: 'elevated',
      geoFlag: 'local',
      modifierFlag: 'none',
      benefitFlag: 'within-limit',
    },
    relatedClaims: 24,
    ytdSpend: 8400,
    remainingDeductible: 250,
    annualBenefitLimit: 50000,
    usedBenefitAmount: 8400,
  },
];

// Gate definitions for display - VQC-appropriate descriptions
const GATE_INFO: Record<string, { name: string; symbol: string; color: string; description: string }> = {
  h: { name: 'Superpose', symbol: 'H', color: 'bg-blue-500', description: 'Creates superposition of outcomes' },
  x: { name: 'Flip', symbol: 'X', color: 'bg-red-500', description: 'Flips qubit state (NOT gate)' },
  y: { name: 'Y-Rotate', symbol: 'Y', color: 'bg-orange-500', description: 'Pauli-Y rotation' },
  z: { name: 'Phase', symbol: 'Z', color: 'bg-teal-500', description: 'Applies phase flip' },
  rz: { name: 'Z-Rot', symbol: 'Rz', color: 'bg-purple-500', description: 'Phase rotation around Z-axis' },
  ry: { name: 'Y-Rot', symbol: 'Ry', color: 'bg-pink-500', description: 'Amplitude rotation around Y-axis' },
  rx: { name: 'X-Rot', symbol: 'Rx', color: 'bg-rose-500', description: 'Rotation around X-axis' },
  cx: { name: 'CNOT', symbol: 'CX', color: 'bg-indigo-500', description: 'Controlled-NOT entanglement' },
  cz: { name: 'CZ', symbol: 'CZ', color: 'bg-cyan-500', description: 'Controlled-Z phase gate' },
  ccx: { name: 'Toffoli', symbol: 'CCX', color: 'bg-amber-500', description: 'Double-controlled NOT' },
  swap: { name: 'SWAP', symbol: 'SW', color: 'bg-lime-500', description: 'Swaps two qubit states' },
};

// Qubit definitions - what each qubit represents (12 qubits = 4,096 outcomes)
const QUBIT_LABELS = [
  { id: 0, name: 'Amount', description: 'Claim dollar amount analysis', icon: DollarSign, color: 'text-green-400' },
  { id: 1, name: 'Provider', description: 'Provider trust & history', icon: Building2, color: 'text-blue-400' },
  { id: 2, name: 'Member', description: 'Member history & patterns', icon: User, color: 'text-purple-400' },
  { id: 3, name: 'Clinical', description: 'Coding & medical necessity', icon: Stethoscope, color: 'text-cyan-400' },
  { id: 4, name: 'Timing', description: 'Submission timing', icon: Clock, color: 'text-yellow-400' },
  { id: 5, name: 'Auth', description: 'Prior authorization', icon: FileText, color: 'text-orange-400' },
  { id: 6, name: 'Network', description: 'In/Out of network', icon: GitBranch, color: 'text-pink-400' },
  { id: 7, name: 'Duplicate', description: 'Duplicate claim check', icon: History, color: 'text-red-400' },
  { id: 8, name: 'Frequency', description: 'Service frequency', icon: Activity, color: 'text-indigo-400' },
  { id: 9, name: 'Geo', description: 'Geographic location', icon: MapPin, color: 'text-emerald-400' },
  { id: 10, name: 'Modifier', description: 'CPT modifier validity', icon: CreditCard, color: 'text-amber-400' },
  { id: 11, name: 'Benefit', description: 'Benefit limit status', icon: HeartPulse, color: 'text-rose-400' },
];

const NUM_QUBITS = 12;

// Risk tiers based on WEIGHTED risk score (not just flag count)
// Different factors have different severity weights
interface RiskTier {
  level: number;
  minScore: number;
  maxScore: number;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  action: string;
  sla: string;
  queue: string;
}

// Weights for each risk factor (0-11) - higher weight = more concerning
// These reflect real-world Workers' Comp claims adjudication priorities
const RISK_WEIGHTS: Record<number, { weight: number; name: string }> = {
  0: { weight: 1.0, name: 'Amount' },       // High $ alone isn't fraud - needs context
  1: { weight: 2.5, name: 'Provider' },     // Provider issues are serious red flags
  2: { weight: 1.5, name: 'Member' },       // Member history matters
  3: { weight: 3.0, name: 'Clinical' },     // Coding fraud is a major concern
  4: { weight: 2.0, name: 'Timing' },       // Suspicious timing patterns
  5: { weight: 1.5, name: 'Auth' },         // Auth issues - procedural concern
  6: { weight: 1.0, name: 'Network' },      // OON is cost, not fraud
  7: { weight: 3.0, name: 'Duplicate' },    // Duplicate billing is serious
  8: { weight: 2.0, name: 'Frequency' },    // Overutilization concern
  9: { weight: 2.5, name: 'Geo' },          // Geographic anomalies are suspicious
  10: { weight: 2.5, name: 'Modifier' },    // Invalid modifiers = billing fraud
  11: { weight: 1.0, name: 'Benefit' },     // Benefit limits - administrative
};

// Max possible score: sum of all weights = 22.5
const MAX_RISK_SCORE = Object.values(RISK_WEIGHTS).reduce((sum, w) => sum + w.weight, 0);

const RISK_TIERS: RiskTier[] = [
  {
    level: 0,
    minScore: 0,
    maxScore: 0,
    label: 'Auto-Pay',
    description: 'All factors clear - straight-through processing',
    icon: <CheckCircle className="h-5 w-5" />,
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/50',
    action: 'Process payment automatically',
    sla: '< 24 hours',
    queue: 'Straight-Through Processing',
  },
  {
    level: 1,
    minScore: 0.1,
    maxScore: 2.5,
    label: 'Quick Review',
    description: 'Low risk factors - minor verification needed',
    icon: <Clock className="h-5 w-5" />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/50',
    action: 'Route to adjuster for quick review',
    sla: '1-2 days',
    queue: 'Standard Review Queue',
  },
  {
    level: 2,
    minScore: 2.6,
    maxScore: 5.0,
    label: 'Standard Review',
    description: 'Moderate concerns - adjuster attention required',
    icon: <FileText className="h-5 w-5" />,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/50',
    action: 'Assign to claims adjuster',
    sla: '2-3 days',
    queue: 'Claims Adjuster Queue',
  },
  {
    level: 3,
    minScore: 5.1,
    maxScore: 8.0,
    label: 'Senior Review',
    description: 'Multiple concerns - senior adjuster required',
    icon: <Activity className="h-5 w-5" />,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/50',
    action: 'Escalate to senior adjuster',
    sla: '3-5 days',
    queue: 'Senior Claims Queue',
  },
  {
    level: 4,
    minScore: 8.1,
    maxScore: 12.0,
    label: 'Medical Review',
    description: 'Clinical concerns - medical director review',
    icon: <Stethoscope className="h-5 w-5" />,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    borderColor: 'border-orange-500/50',
    action: 'Send to Medical Director',
    sla: '5-7 days',
    queue: 'Medical Director Queue',
  },
  {
    level: 5,
    minScore: 12.1,
    maxScore: 16.0,
    label: 'Pre-Pay Review',
    description: 'High risk pattern - pre-payment investigation',
    icon: <AlertTriangle className="h-5 w-5" />,
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/50',
    action: 'Hold for pre-payment review',
    sla: '7-10 days',
    queue: 'Pre-Payment Review Queue',
  },
  {
    level: 6,
    minScore: 16.1,
    maxScore: 25,
    label: 'SIU Referral',
    description: 'Fraud indicators present - investigation required',
    icon: <Shield className="h-5 w-5" />,
    color: 'text-red-500',
    bgColor: 'bg-red-600/30',
    borderColor: 'border-red-600/50',
    action: 'Refer to Special Investigations Unit',
    sla: '10-30 days',
    queue: 'Special Investigations Unit',
  },
];

// Helper to count bits in a binary string
const countBits = (binary: string): number => binary.split('').filter(b => b === '1').length;

// Calculate weighted risk score from measurement result
const calculateRiskScore = (measurement: string): number => {
  let score = 0;
  for (let i = 0; i < measurement.length && i < 12; i++) {
    if (measurement[i] === '1') {
      score += RISK_WEIGHTS[i]?.weight || 1;
    }
  }
  return score;
};

// Get risk tier from measurement result using weighted scoring
const getRiskTier = (measurement: string): RiskTier => {
  const score = calculateRiskScore(measurement);
  // Find the tier that matches this score
  for (const tier of RISK_TIERS) {
    if (score >= tier.minScore && score <= tier.maxScore) {
      return tier;
    }
  }
  // Fallback to highest tier if score exceeds all ranges
  return RISK_TIERS[RISK_TIERS.length - 1];
};

// Get which factors are flagged from measurement
const getFlaggedFactors = (measurement: string): number[] => {
  return measurement.split('').map((b, i) => b === '1' ? i : -1).filter(i => i >= 0);
};

export default function ClaimsTriageDemo() {
  const [selectedScenario, setSelectedScenario] = useState<ClaimScenario>(CLAIM_SCENARIOS[0]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [results, setResults] = useState<Record<string, number> | null>(null);
  const [simulationCount, setSimulationCount] = useState(1000);

  // Circuit state
  const [gates, setGates] = useState<PlacedGate[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isBuilding, setIsBuilding] = useState(false);
  const [builtForScenario, setBuiltForScenario] = useState<string | null>(null);

  // Ref to track the current scenario for aborting stale builds
  const currentScenarioRef = useRef(selectedScenario.id);

  // Update ref when scenario changes
  useEffect(() => {
    currentScenarioRef.current = selectedScenario.id;
  }, [selectedScenario.id]);

  // Add log entry
  const addLog = useCallback((type: LogEntry['type'], message: string, details?: string) => {
    setLogs(prev => [...prev, {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      type,
      message,
      details,
    }]);
  }, []);

  // Add gate with animation
  const addGate = useCallback((gate: Omit<PlacedGate, 'id'>) => {
    const newGate: PlacedGate = {
      ...gate,
      id: `gate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    setGates(prev => [...prev, newGate]);
    return newGate;
  }, []);

  // Build circuit based on actual claim risk analysis
  // Each qubit represents a risk factor: |0⟩ = clear, |1⟩ = flagged
  // Gates encode the actual risk level and correlations
  const buildCircuit = async (): Promise<PlacedGate[]> => {
    const buildScenarioId = selectedScenario.id;
    setIsBuilding(true);
    setGates([]);
    setLogs([]);
    setResults(null);
    setCurrentStep(0);

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const shouldAbort = () => currentScenarioRef.current !== buildScenarioId;

    const claim = selectedScenario;
    let col = 0;
    const builtGates: PlacedGate[] = [];

    const addGateTracked = (gate: Omit<PlacedGate, 'id'>): PlacedGate => {
      const newGate = addGate(gate);
      builtGates.push(newGate);
      return newGate;
    };

    // ========== PHASE 1: Initialize ==========
    addLog('info', `Analyzing Claim ${claim.claimNumber}`, `${claim.memberName} | $${claim.totalCharged.toLocaleString()}`);
    await delay(300);
    if (shouldAbort()) { setIsBuilding(false); return []; }

    addLog('analysis', 'Encoding 12 Risk Factors', 'Amount • Provider • Member • Clinical • Timing • Auth • Network • Duplicate • Frequency • Geo • Modifier • Benefit');
    setCurrentStep(1);
    await delay(300);

    // ========== QUBIT 0: Amount Analysis ==========
    // Context-aware: high $ with proper auth + trusted provider = expected, not suspicious
    const amountFlag = claim.riskIndicators.claimAmountFlag;
    const hasProperAuth = claim.riskIndicators.authFlag === 'approved' || claim.riskIndicators.authFlag === 'not-required';
    const hasTrustedProvider = claim.riskIndicators.providerFlag === 'trusted';
    const isAuthorizedHighDollar = (amountFlag === 'high' || amountFlag === 'extreme') && hasProperAuth && hasTrustedProvider;

    if (amountFlag === 'extreme') {
      if (isAuthorizedHighDollar) {
        // Extreme but authorized - still review but lower probability
        addLog('gate', `Amount: EXTREME but AUTHORIZED ($${claim.totalCharged.toLocaleString()})`, '30% review → H + Rz(-π/4)');
        addGateTracked({ gate: 'h', qubit: 0, column: col, reason: `$${claim.totalCharged.toLocaleString()} authorized` });
        addGateTracked({ gate: 'rz', qubit: 0, column: col + 1, params: { theta: -Math.PI / 4 }, reason: '30% bias (authorized)' });
        col++;
      } else {
        addLog('gate', `Amount: EXTREME ($${claim.totalCharged.toLocaleString()})`, 'Definite flag → X gate');
        addGateTracked({ gate: 'x', qubit: 0, column: col, reason: `$${claim.totalCharged.toLocaleString()} extreme` });
      }
    } else if (amountFlag === 'high') {
      if (isAuthorizedHighDollar) {
        // High dollar but properly authorized with trusted provider - expected cost
        addLog('info', `Amount: HIGH but AUTHORIZED ($${claim.totalCharged.toLocaleString()})`, 'Trusted provider + auth → clear');
      } else {
        addLog('gate', `Amount: HIGH ($${claim.totalCharged.toLocaleString()})`, '75% flag probability → H + Rz(π/2)');
        addGateTracked({ gate: 'h', qubit: 0, column: col, reason: `$${claim.totalCharged.toLocaleString()} high` });
        addGateTracked({ gate: 'rz', qubit: 0, column: col + 1, params: { theta: Math.PI / 2 }, reason: '75% bias' });
        col++;
      }
    } else if (amountFlag === 'elevated') {
      addLog('gate', `Amount: ELEVATED ($${claim.totalCharged.toLocaleString()})`, '50% uncertainty → H gate');
      addGateTracked({ gate: 'h', qubit: 0, column: col, reason: `$${claim.totalCharged.toLocaleString()} elevated` });
    } else {
      addLog('info', `Amount: NORMAL ($${claim.totalCharged.toLocaleString()})`, 'Clear → stays |0⟩');
    }
    col++;
    await delay(200);

    // ========== QUBIT 1: Provider Analysis ==========
    const providerFlag = claim.riskIndicators.providerFlag;
    if (providerFlag === 'flagged') {
      addLog('gate', `Provider: FLAGGED (${claim.providerName})`, 'Definite flag → X gate');
      addGateTracked({ gate: 'x', qubit: 1, column: col, reason: 'Provider flagged' });
    } else if (providerFlag === 'watch-list') {
      addLog('gate', `Provider: WATCH-LIST (${claim.providerName})`, '75% flag → H + Rz(π/2)');
      addGateTracked({ gate: 'h', qubit: 1, column: col, reason: 'Provider watch-list' });
      addGateTracked({ gate: 'rz', qubit: 1, column: col + 1, params: { theta: Math.PI / 2 }, reason: '75% bias' });
      col++;
    } else if (providerFlag === 'new') {
      addLog('gate', `Provider: NEW (${claim.providerName})`, '50% uncertainty → H gate');
      addGateTracked({ gate: 'h', qubit: 1, column: col, reason: 'New provider' });
    } else {
      addLog('info', `Provider: TRUSTED (${claim.providerName})`, 'Clear → stays |0⟩');
    }
    col++;
    setCurrentStep(2);
    await delay(200);

    // ========== QUBIT 2: Member Analysis ==========
    const memberFlag = claim.riskIndicators.memberFlag;
    if (memberFlag === 'suspect') {
      addLog('gate', `Member: SUSPECT (${claim.memberName})`, 'Definite flag → X gate');
      addGateTracked({ gate: 'x', qubit: 2, column: col, reason: 'Suspect pattern' });
    } else if (memberFlag === 'high-utilizer') {
      addLog('gate', `Member: HIGH-UTILIZER ($${claim.ytdSpend.toLocaleString()} YTD)`, '60% flag → H + Rz(π/4)');
      addGateTracked({ gate: 'h', qubit: 2, column: col, reason: 'High utilizer' });
      addGateTracked({ gate: 'rz', qubit: 2, column: col + 1, params: { theta: Math.PI / 4 }, reason: '60% bias' });
      col++;
    } else if (memberFlag === 'new') {
      addLog('gate', `Member: NEW (since ${claim.memberSince})`, '50% uncertainty → H gate');
      addGateTracked({ gate: 'h', qubit: 2, column: col, reason: 'New member' });
    } else {
      addLog('info', `Member: ESTABLISHED (since ${claim.memberSince})`, 'Clear → stays |0⟩');
    }
    col++;
    setCurrentStep(3);
    await delay(200);

    // ========== QUBIT 3: Clinical/Coding Analysis ==========
    const codingFlag = claim.riskIndicators.codingFlag;
    if (codingFlag === 'unbundling-risk') {
      addLog('gate', `Coding: UNBUNDLING RISK`, 'Definite audit → X gate');
      addGateTracked({ gate: 'x', qubit: 3, column: col, reason: 'Unbundling risk' });
    } else if (codingFlag === 'upcoding-risk') {
      addLog('gate', `Coding: UPCODING RISK`, 'Definite audit → X gate');
      addGateTracked({ gate: 'x', qubit: 3, column: col, reason: 'Upcoding risk' });
    } else if (codingFlag === 'unusual') {
      addLog('gate', `Coding: UNUSUAL (${claim.procedureCodes.join(', ')})`, '50% review → H gate');
      addGateTracked({ gate: 'h', qubit: 3, column: col, reason: 'Unusual coding' });
    } else {
      addLog('info', `Coding: STANDARD (${claim.diagnosisCode})`, 'Clear → stays |0⟩');
    }
    col++;
    setCurrentStep(4);
    await delay(200);

    // ========== QUBIT 4: Timing Analysis ==========
    const timingFlag = claim.riskIndicators.timingFlag;
    if (timingFlag === 'suspicious') {
      addLog('gate', `Timing: SUSPICIOUS`, 'Definite flag → X gate');
      addGateTracked({ gate: 'x', qubit: 4, column: col, reason: 'Suspicious timing' });
    } else if (timingFlag === 'rush') {
      addLog('gate', `Timing: RUSH submission`, '60% flag → H + Rz(π/4)');
      addGateTracked({ gate: 'h', qubit: 4, column: col, reason: 'Rush submission' });
      addGateTracked({ gate: 'rz', qubit: 4, column: col + 1, params: { theta: Math.PI / 4 }, reason: '60% bias' });
      col++;
    } else if (timingFlag === 'delayed') {
      addLog('gate', `Timing: DELAYED`, '50% review → H gate');
      addGateTracked({ gate: 'h', qubit: 4, column: col, reason: 'Delayed submission' });
    } else {
      addLog('info', `Timing: NORMAL`, 'Clear → stays |0⟩');
    }
    col++;
    setCurrentStep(5);
    await delay(200);

    // ========== QUBIT 5: Authorization Analysis ==========
    const authFlag = claim.riskIndicators.authFlag;
    if (authFlag === 'denied') {
      addLog('gate', `Auth: DENIED`, 'Definite hold → X gate');
      addGateTracked({ gate: 'x', qubit: 5, column: col, reason: 'Auth denied' });
    } else if (authFlag === 'expired') {
      addLog('gate', `Auth: EXPIRED`, '75% hold → H + Rz(π/2)');
      addGateTracked({ gate: 'h', qubit: 5, column: col, reason: 'Auth expired' });
      addGateTracked({ gate: 'rz', qubit: 5, column: col + 1, params: { theta: Math.PI / 2 }, reason: '75% bias' });
      col++;
    } else if (authFlag === 'pending') {
      addLog('gate', `Auth: PENDING`, '50% hold → H gate');
      addGateTracked({ gate: 'h', qubit: 5, column: col, reason: 'Auth pending' });
    } else {
      addLog('info', `Auth: ${authFlag.toUpperCase()}`, 'Clear → stays |0⟩');
    }
    col++;
    setCurrentStep(6);
    await delay(200);
    if (shouldAbort()) { setIsBuilding(false); return []; }

    // ========== QUBIT 6: Network Analysis ==========
    const networkFlag = claim.riskIndicators.networkFlag;
    if (networkFlag === 'out-of-area') {
      addLog('gate', `Network: OUT-OF-AREA`, 'Definite flag → X gate');
      addGateTracked({ gate: 'x', qubit: 6, column: col, reason: 'Out of service area' });
    } else if (networkFlag === 'out-of-network') {
      addLog('gate', `Network: OUT-OF-NETWORK`, '60% flag → H + Rz(π/4)');
      addGateTracked({ gate: 'h', qubit: 6, column: col, reason: 'Out of network' });
      addGateTracked({ gate: 'rz', qubit: 6, column: col + 1, params: { theta: Math.PI / 4 }, reason: '60% bias' });
      col++;
    } else {
      addLog('info', `Network: IN-NETWORK`, 'Clear → stays |0⟩');
    }
    col++;
    await delay(150);
    if (shouldAbort()) { setIsBuilding(false); return []; }

    // ========== QUBIT 7: Duplicate Claim Analysis ==========
    const duplicateFlag = claim.riskIndicators.duplicateFlag;
    if (duplicateFlag === 'likely') {
      addLog('gate', `Duplicate: LIKELY`, 'Definite flag → X gate');
      addGateTracked({ gate: 'x', qubit: 7, column: col, reason: 'Likely duplicate' });
    } else if (duplicateFlag === 'possible') {
      addLog('gate', `Duplicate: POSSIBLE`, '50% review → H gate');
      addGateTracked({ gate: 'h', qubit: 7, column: col, reason: 'Possible duplicate' });
    } else {
      addLog('info', `Duplicate: CLEAR`, 'No duplicates → stays |0⟩');
    }
    col++;
    await delay(150);
    if (shouldAbort()) { setIsBuilding(false); return []; }

    // ========== QUBIT 8: Frequency Analysis ==========
    const frequencyFlag = claim.riskIndicators.frequencyFlag;
    if (frequencyFlag === 'excessive') {
      addLog('gate', `Frequency: EXCESSIVE`, 'Definite flag → X gate');
      addGateTracked({ gate: 'x', qubit: 8, column: col, reason: 'Excessive frequency' });
    } else if (frequencyFlag === 'high') {
      addLog('gate', `Frequency: HIGH`, '75% flag → H + Rz(π/2)');
      addGateTracked({ gate: 'h', qubit: 8, column: col, reason: 'High frequency' });
      addGateTracked({ gate: 'rz', qubit: 8, column: col + 1, params: { theta: Math.PI / 2 }, reason: '75% bias' });
      col++;
    } else if (frequencyFlag === 'elevated') {
      addLog('gate', `Frequency: ELEVATED`, '50% review → H gate');
      addGateTracked({ gate: 'h', qubit: 8, column: col, reason: 'Elevated frequency' });
    } else {
      addLog('info', `Frequency: NORMAL`, 'Clear → stays |0⟩');
    }
    col++;
    await delay(150);
    if (shouldAbort()) { setIsBuilding(false); return []; }

    // ========== QUBIT 9: Geographic Analysis ==========
    const geoFlag = claim.riskIndicators.geoFlag;
    if (geoFlag === 'anomaly') {
      addLog('gate', `Geo: ANOMALY (${claim.memberState} → ${claim.providerState})`, 'Definite flag → X gate');
      addGateTracked({ gate: 'x', qubit: 9, column: col, reason: 'Geographic anomaly' });
    } else if (geoFlag === 'distant') {
      addLog('gate', `Geo: DISTANT`, '60% flag → H + Rz(π/4)');
      addGateTracked({ gate: 'h', qubit: 9, column: col, reason: 'Distant provider' });
      addGateTracked({ gate: 'rz', qubit: 9, column: col + 1, params: { theta: Math.PI / 4 }, reason: '60% bias' });
      col++;
    } else if (geoFlag === 'regional') {
      addLog('gate', `Geo: REGIONAL`, '50% review → H gate');
      addGateTracked({ gate: 'h', qubit: 9, column: col, reason: 'Regional provider' });
    } else {
      addLog('info', `Geo: LOCAL`, 'Clear → stays |0⟩');
    }
    col++;
    await delay(150);
    if (shouldAbort()) { setIsBuilding(false); return []; }

    // ========== QUBIT 10: Modifier Analysis ==========
    const modifierFlag = claim.riskIndicators.modifierFlag;
    if (modifierFlag === 'invalid') {
      addLog('gate', `Modifier: INVALID (${claim.modifiers.join(', ') || 'none'})`, 'Definite flag → X gate');
      addGateTracked({ gate: 'x', qubit: 10, column: col, reason: 'Invalid modifiers' });
    } else if (modifierFlag === 'questionable') {
      addLog('gate', `Modifier: QUESTIONABLE`, '60% flag → H + Rz(π/4)');
      addGateTracked({ gate: 'h', qubit: 10, column: col, reason: 'Questionable modifiers' });
      addGateTracked({ gate: 'rz', qubit: 10, column: col + 1, params: { theta: Math.PI / 4 }, reason: '60% bias' });
      col++;
    } else if (modifierFlag === 'valid') {
      addLog('info', `Modifier: VALID (${claim.modifiers.join(', ')})`, 'Modifiers OK → stays |0⟩');
    } else {
      addLog('info', `Modifier: NONE`, 'No modifiers → stays |0⟩');
    }
    col++;
    await delay(150);
    if (shouldAbort()) { setIsBuilding(false); return []; }

    // ========== QUBIT 11: Benefit Limit Analysis ==========
    const benefitFlag = claim.riskIndicators.benefitFlag;
    const benefitUsedPct = (claim.usedBenefitAmount / claim.annualBenefitLimit * 100).toFixed(0);
    if (benefitFlag === 'over-limit') {
      addLog('gate', `Benefit: OVER LIMIT (${benefitUsedPct}% used)`, 'Definite flag → X gate');
      addGateTracked({ gate: 'x', qubit: 11, column: col, reason: 'Over benefit limit' });
    } else if (benefitFlag === 'at-limit') {
      addLog('gate', `Benefit: AT LIMIT (${benefitUsedPct}% used)`, '75% flag → H + Rz(π/2)');
      addGateTracked({ gate: 'h', qubit: 11, column: col, reason: 'At benefit limit' });
      addGateTracked({ gate: 'rz', qubit: 11, column: col + 1, params: { theta: Math.PI / 2 }, reason: '75% bias' });
      col++;
    } else if (benefitFlag === 'near-limit') {
      addLog('gate', `Benefit: NEAR LIMIT (${benefitUsedPct}% used)`, '50% review → H gate');
      addGateTracked({ gate: 'h', qubit: 11, column: col, reason: 'Near benefit limit' });
    } else {
      addLog('info', `Benefit: WITHIN LIMIT (${benefitUsedPct}% used)`, 'Clear → stays |0⟩');
    }
    col++;
    setCurrentStep(7);
    await delay(200);
    if (shouldAbort()) { setIsBuilding(false); return []; }

    // ========== CORRELATIONS: Entangle related risk factors ==========
    addLog('analysis', 'Checking Risk Correlations', 'Entangling related factors across 12 dimensions');
    await delay(200);

    let correlations = 0;

    // High $ + risky provider = compound risk
    if (claim.totalCharged > 10000 && (providerFlag === 'watch-list' || providerFlag === 'flagged')) {
      addLog('gate', 'Amount ↔ Provider correlation', 'High $ with risky provider');
      addGateTracked({ gate: 'cx', qubit: 0, column: col, controlQubits: [1], reason: 'Amount↔Provider' });
      col++;
      correlations++;
      await delay(100);
    }

    // Risky provider + coding issues = audit trigger
    if (providerFlag !== 'trusted' && codingFlag !== 'standard') {
      addLog('gate', 'Provider ↔ Coding correlation', 'Provider + coding concerns');
      addGateTracked({ gate: 'cx', qubit: 1, column: col, controlQubits: [3], reason: 'Provider↔Coding' });
      col++;
      correlations++;
      await delay(100);
    }

    // New/suspect member + suspicious timing = fraud pattern
    if ((memberFlag === 'new' || memberFlag === 'suspect') && (timingFlag === 'suspicious' || timingFlag === 'rush')) {
      addLog('gate', 'Member ↔ Timing correlation', 'Member + timing fraud pattern');
      addGateTracked({ gate: 'cx', qubit: 2, column: col, controlQubits: [4], reason: 'Member↔Timing' });
      col++;
      correlations++;
      await delay(100);
    }

    // High utilization compound check
    if (claim.relatedClaims > 3 && claim.ytdSpend > 25000) {
      addLog('gate', 'Multi-factor correlation', 'High utilization pattern');
      addGateTracked({ gate: 'ccx', qubit: 0, column: col, controlQubits: [2, 3], reason: 'Utilization check' });
      col++;
      correlations++;
      await delay(100);
    }

    // Auth + high amount = pre-auth verification
    if (claim.totalCharged > 15000 && (authFlag === 'pending' || authFlag === 'expired')) {
      addLog('gate', 'Amount ↔ Auth correlation', 'High $ needs auth verification');
      addGateTracked({ gate: 'cz', qubit: 0, column: col, controlQubits: [5], reason: 'Amount↔Auth' });
      col++;
      correlations++;
      await delay(100);
    }

    // NEW CORRELATIONS FOR QUBITS 6-11

    // Out of network + geographic anomaly = billing scheme indicator
    if (networkFlag !== 'in-network' && (geoFlag === 'anomaly' || geoFlag === 'distant')) {
      addLog('gate', 'Network ↔ Geo correlation', 'Out of network + distant provider');
      addGateTracked({ gate: 'cx', qubit: 6, column: col, controlQubits: [9], reason: 'Network↔Geo' });
      col++;
      correlations++;
      await delay(100);
    }

    // Duplicate + high frequency = potential fraud pattern
    if ((duplicateFlag === 'possible' || duplicateFlag === 'likely') && (frequencyFlag === 'high' || frequencyFlag === 'excessive')) {
      addLog('gate', 'Duplicate ↔ Frequency correlation', 'Duplicate + high frequency pattern');
      addGateTracked({ gate: 'cx', qubit: 7, column: col, controlQubits: [8], reason: 'Duplicate↔Frequency' });
      col++;
      correlations++;
      await delay(100);
    }

    // Invalid modifiers + coding issues = unbundling/upcoding scheme
    if ((modifierFlag === 'invalid' || modifierFlag === 'questionable') && codingFlag !== 'standard') {
      addLog('gate', 'Modifier ↔ Coding correlation', 'Modifier + coding audit trigger');
      addGateTracked({ gate: 'cx', qubit: 10, column: col, controlQubits: [3], reason: 'Modifier↔Coding' });
      col++;
      correlations++;
      await delay(100);
    }

    // Near/over benefit limit + high amount = potential overutilization
    if ((benefitFlag === 'near-limit' || benefitFlag === 'at-limit' || benefitFlag === 'over-limit') && amountFlag !== 'normal') {
      addLog('gate', 'Benefit ↔ Amount correlation', 'Benefit limit + high amount concern');
      addGateTracked({ gate: 'cx', qubit: 11, column: col, controlQubits: [0], reason: 'Benefit↔Amount' });
      col++;
      correlations++;
      await delay(100);
    }

    // Triple correlation: frequency + duplicate + member history = SIU pattern
    if (frequencyFlag !== 'normal' && duplicateFlag !== 'clear' && (memberFlag === 'high-utilizer' || memberFlag === 'suspect')) {
      addLog('gate', 'Frequency ↔ Duplicate ↔ Member', 'Triple correlation SIU pattern');
      addGateTracked({ gate: 'ccx', qubit: 8, column: col, controlQubits: [7, 2], reason: 'Freq↔Dup↔Member' });
      col++;
      correlations++;
      await delay(100);
    }

    if (correlations === 0) {
      addLog('info', 'No compound risk patterns detected', 'All 12 factors are independent');
    } else {
      addLog('info', `${correlations} correlations found`, 'Risk factors entangled');
    }

    setCurrentStep(8);

    // ========== SUMMARY ==========
    await delay(200);
    const gateCount = builtGates.length;
    if (gateCount === 0) {
      addLog('result', '✅ STRAIGHT-THROUGH PROCESSING', 'All 12 factors clear → 100% Auto-Pay');
    } else {
      addLog('info', `Circuit Complete: ${gateCount} gates`, 'Ready for quantum measurement across 4,096 states');
    }
    setCurrentStep(9);

    setIsBuilding(false);
    return builtGates;
  };

  // Run the quantum simulation - 12 QUBIT VERSION
  const runSimulation = async () => {
    // Build circuit first if not already built for THIS scenario
    let simulationGates: PlacedGate[] = [];

    // Build if we haven't built yet for this specific scenario
    const needsBuild = builtForScenario !== selectedScenario.id;
    if (needsBuild) {
      // buildCircuit now returns the gates array directly
      simulationGates = await buildCircuit();
      // Check if build was aborted (empty result on abort)
      if (simulationGates.length === 0 && currentScenarioRef.current !== selectedScenario.id) {
        return;
      }
      setBuiltForScenario(selectedScenario.id);
      await new Promise(resolve => setTimeout(resolve, 300));
    } else {
      // For re-runs, use the existing gates from state
      // They should still be valid for this scenario
      simulationGates = [...gates];
      // Add a log for re-run
      addLog('info', 'Re-running quantum simulation...', `Using existing ${simulationGates.length} gates`);
    }

    setIsSimulating(true);

    try {
      const { SimpleQuantumCircuit } = await import('@/lib/quantum-sim');
      const circuit = new SimpleQuantumCircuit(NUM_QUBITS);

      // Apply gates from the captured gates array (not stale React state)
      for (const gate of simulationGates.sort((a, b) => a.column - b.column)) {
        if (gate.gate === 'h') {
          circuit.addGate('h', gate.qubit);
        } else if (gate.gate === 'x') {
          circuit.addGate('x', gate.qubit);
        } else if (gate.gate === 'y') {
          circuit.addGate('y', gate.qubit);
        } else if (gate.gate === 'z') {
          circuit.addGate('z', gate.qubit);
        } else if (gate.gate === 'rz') {
          circuit.addGate('rz', gate.qubit, undefined, { theta: gate.params?.theta || 0 });
        } else if (gate.gate === 'ry') {
          circuit.addGate('ry', gate.qubit, undefined, { theta: gate.params?.theta || 0 });
        } else if (gate.gate === 'cx' && gate.controlQubits) {
          circuit.addGate('cx', gate.qubit, gate.controlQubits);
        } else if (gate.gate === 'cz' && gate.controlQubits) {
          circuit.addGate('cz', gate.qubit, gate.controlQubits);
        } else if (gate.gate === 'ccx' && gate.controlQubits) {
          circuit.addGate('ccx', gate.qubit, gate.controlQubits);
        }
      }

      // Run measurements
      const result = circuit.runWithMeasurements(simulationCount);
      setResults(result.measurements);

      // Log results based on outcome
      const allZerosKey = '000000000000'; // 12-bit all zeros
      const allZeros = Object.keys(result.measurements).length === 1 && result.measurements[allZerosKey] === simulationCount;
      if (allZeros) {
        addLog('result', '✅ 100% AUTO-PAY', `All ${simulationCount} measurements returned |${allZerosKey}⟩ - straight-through processing`);
      } else {
        addLog('result', 'Quantum analysis complete', `Processed ${simulationCount} measurements across 4,096 possible states`);
      }
      setCurrentStep(10);

    } catch (error) {
      addLog('info', 'Simulation failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSimulating(false);
    }
  };

  // Reset everything when scenario changes
  useEffect(() => {
    // Clear all visual state - the ref check in buildCircuit will handle aborting stale builds
    setGates([]);
    setLogs([]);
    setResults(null);
    setCurrentStep(0);
    setIsBuilding(false);
    setIsSimulating(false);
    setBuiltForScenario(null); // Reset so next run triggers a fresh build
  }, [selectedScenario]);

  // Calculate business metrics - aggregated by risk tier using weighted scoring
  const getBusinessMetrics = () => {
    if (!results) return null;
    const total = Object.values(results).reduce((a, b) => a + b, 0);

    // Aggregate by risk tier (using weighted scores, not bit counts)
    const tierCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const rawMetrics: Record<string, { count: number; percentage: number; tier: number; score: number }> = {};

    for (const [state, count] of Object.entries(results)) {
      const riskTier = getRiskTier(state);
      const score = calculateRiskScore(state);
      tierCounts[riskTier.level] = (tierCounts[riskTier.level] || 0) + count;
      rawMetrics[state] = { count, percentage: (count / total) * 100, tier: riskTier.level, score };
    }

    // Calculate tier percentages
    const tierMetrics: Record<number, { count: number; percentage: number; tier: RiskTier }> = {};
    for (let i = 0; i <= 6; i++) {
      tierMetrics[i] = {
        count: tierCounts[i],
        percentage: (tierCounts[i] / total) * 100,
        tier: RISK_TIERS[i],
      };
    }

    return { raw: rawMetrics, byTier: tierMetrics, total };
  };

  const metrics = getBusinessMetrics();

  // Get primary recommendation (most likely tier)
  const getRecommendation = () => {
    if (!metrics) return null;

    // Find the tier with highest probability
    let maxTier = 0;
    let maxPercentage = 0;
    for (let i = 0; i <= 6; i++) {
      if (metrics.byTier[i].percentage > maxPercentage) {
        maxPercentage = metrics.byTier[i].percentage;
        maxTier = i;
      }
    }

    // Also find the most common specific outcome
    let topState = '000000';
    let topStateCount = 0;
    for (const [state, data] of Object.entries(metrics.raw)) {
      if (data.count > topStateCount) {
        topStateCount = data.count;
        topState = state;
      }
    }

    return {
      tier: RISK_TIERS[maxTier],
      confidence: maxPercentage,
      topState,
      topStatePercentage: (topStateCount / metrics.total) * 100,
      flaggedFactors: getFlaggedFactors(topState),
    };
  };

  const recommendation = getRecommendation();

  // Calculate grid columns for circuit display
  const maxColumn = Math.max(0, ...gates.map(g => g.column)) + 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-4">
          <Link href="/quantum">
            <Button variant="ghost" size="sm" className="text-white/60 hover:text-white">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Lab
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-400" />
              Quantum Claims Triage
            </h1>
            <p className="text-xs text-white/60">
              12-Factor Risk Analysis with 4,096 Possible Routing Outcomes
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-blue-600">Workers&apos; Comp Claims</Badge>
          <Badge variant="outline" className="border-purple-500/50 text-purple-300">
            <Atom className="h-3 w-3 mr-1" />
            {NUM_QUBITS} Qubits • 4,096 States
          </Badge>
          <Link href="/quantum/polypharmacy-demo">
            <Badge variant="outline" className="border-green-500/50 text-green-300 cursor-pointer hover:bg-green-500/10">
              <Zap className="h-3 w-3 mr-1" />
              Drug Interactions Demo
            </Badge>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3">
        {/* Left Panel - Claim Queue */}
        <div className="col-span-3 space-y-3">
          {/* Incoming Claims Queue */}
          <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-white flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-400" />
                Incoming Claims Queue
              </CardTitle>
              <CardDescription className="text-xs">Select a claim to analyze</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {CLAIM_SCENARIOS.map((scenario) => (
                <button
                  key={scenario.id}
                  className={cn(
                    'w-full text-left p-2 rounded-lg transition-all',
                    selectedScenario.id === scenario.id
                      ? 'bg-blue-600/30 border border-blue-500/50'
                      : 'bg-white/5 hover:bg-white/10 border border-transparent'
                  )}
                  onClick={() => setSelectedScenario(scenario)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs text-white/60">{scenario.claimNumber}</span>
                    <Badge variant="outline" className="border-green-500/50 text-green-400 text-xs px-1">
                      ${scenario.totalCharged.toLocaleString()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3 text-white/40" />
                    <span className="text-xs text-white font-medium">{scenario.memberName}</span>
                  </div>
                  <p className="text-xs text-white/50 mt-0.5 truncate">{scenario.serviceType}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Selected Claim Details */}
          <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-white flex items-center gap-2">
                <FileText className="h-4 w-4 text-cyan-400" />
                Claim Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {/* Member Info */}
              <div className="bg-white/5 rounded p-2">
                <div className="flex items-center gap-2 mb-1">
                  <User className="h-3 w-3 text-purple-400" />
                  <span className="text-white font-medium">{selectedScenario.memberName}</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-white/60">
                  <span>ID: {selectedScenario.memberId}</span>
                  <span>Since: {selectedScenario.memberSince}</span>
                  <span>Plan: {selectedScenario.planType}</span>
                  <span>YTD: ${selectedScenario.ytdSpend.toLocaleString()}</span>
                </div>
              </div>

              {/* Provider Info */}
              <div className="bg-white/5 rounded p-2">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-3 w-3 text-blue-400" />
                  <span className="text-white font-medium truncate">{selectedScenario.providerName}</span>
                </div>
                <div className="flex items-center justify-between text-white/60">
                  <span>{selectedScenario.facilityType}</span>
                  <Badge variant="outline" className={cn(
                    'text-xs px-1',
                    selectedScenario.providerNetwork === 'In-Network' || selectedScenario.providerNetwork === 'Tier 1'
                      ? 'border-green-500/50 text-green-400'
                      : selectedScenario.providerNetwork === 'Out-of-Network'
                      ? 'border-red-500/50 text-red-400'
                      : 'border-yellow-500/50 text-yellow-400'
                  )}>
                    {selectedScenario.providerNetwork}
                  </Badge>
                </div>
              </div>

              {/* Clinical Info */}
              <div className="bg-white/5 rounded p-2">
                <div className="flex items-center gap-2 mb-1">
                  <Stethoscope className="h-3 w-3 text-cyan-400" />
                  <span className="text-white font-medium">{selectedScenario.primaryDiagnosis}</span>
                </div>
                <p className="text-white/60">ICD-10: {selectedScenario.diagnosisCode}</p>
                <p className="text-white/60 truncate">CPT: {selectedScenario.procedureCodes.join(', ')}</p>
              </div>

              {/* Risk Indicators */}
              <div>
                <p className="text-white/60 mb-1">System Risk Flags:</p>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(selectedScenario.riskIndicators).map(([key, value]) => (
                    <Badge
                      key={key}
                      variant="outline"
                      className={cn(
                        'text-xs px-1',
                        value === 'normal' || value === 'trusted' || value === 'established' || value === 'standard'
                          ? 'border-green-500/50 text-green-400'
                          : value === 'elevated' || value === 'new' || value === 'delayed' || value === 'unusual'
                          ? 'border-yellow-500/50 text-yellow-400'
                          : 'border-red-500/50 text-red-400'
                      )}
                    >
                      {key.replace('Flag', '')}: {value}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Run Controls */}
          <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
            <CardContent className="pt-4 space-y-3">
              <Select
                value={simulationCount.toString()}
                onValueChange={(v) => setSimulationCount(parseInt(v))}
              >
                <SelectTrigger className="bg-black/30 border-white/20 text-white text-xs h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">100 quantum samples</SelectItem>
                  <SelectItem value="1000">1,000 quantum samples</SelectItem>
                  <SelectItem value="5000">5,000 quantum samples</SelectItem>
                </SelectContent>
              </Select>

              <Button
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
                onClick={runSimulation}
                disabled={isSimulating || isBuilding}
              >
                {isBuilding ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing Claim...
                  </>
                ) : isSimulating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Running Quantum Triage...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    {builtForScenario !== selectedScenario.id ? 'Analyze & Route' : 'Re-run Analysis'}
                  </>
                )}
              </Button>

              {builtForScenario === selectedScenario.id && (
                <Button
                  variant="outline"
                  className="w-full border-white/20 text-white text-xs"
                  onClick={() => {
                    setGates([]);
                    setLogs([]);
                    setResults(null);
                    setCurrentStep(0);
                    setBuiltForScenario(null);
                  }}
                >
                  Clear Analysis
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Middle Panel - Circuit Visualization */}
        <div className="col-span-5 space-y-3">
          {/* 12-Qubit Quantum Circuit */}
          <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-white flex items-center gap-2">
                <Atom className="h-4 w-4 text-purple-400" />
                Quantum Risk Analysis Circuit
                {gates.length > 0 && (
                  <Badge variant="outline" className="border-purple-500/50 text-purple-300 text-xs ml-2">
                    {gates.length} operations
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                Each qubit represents a risk factor • Gates encode claim characteristics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full h-[360px]">
                <div className="bg-black/30 rounded-lg p-3 min-h-[340px]">
                  {builtForScenario !== selectedScenario.id && !isBuilding ? (
                    <div className="flex items-center justify-center h-[320px] text-white/40 text-sm">
                      <div className="text-center">
                        <Atom className="h-10 w-10 mx-auto mb-3 opacity-50" />
                        <p className="mb-2">Click &quot;Analyze & Route&quot; to build the circuit</p>
                        <p className="text-xs text-white/30">12 risk factors will be analyzed simultaneously</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1" style={{ minWidth: `${Math.max(350, maxColumn * 28 + 150)}px` }}>
                      {/* Qubit lines - 12 qubits */}
                      {QUBIT_LABELS.map((qubitInfo) => {
                        const QubitIcon = qubitInfo.icon;
                        return (
                          <div key={qubitInfo.id} className="flex items-center gap-1 h-[26px]">
                            {/* Qubit label */}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className={cn('w-16 text-[10px] flex items-center gap-1 cursor-help', qubitInfo.color)}>
                                    <QubitIcon className="h-3 w-3 flex-shrink-0" />
                                    <span className="truncate">{qubitInfo.name}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{qubitInfo.description}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            {/* Initial state */}
                            <div className="w-5 h-5 rounded border border-white/20 flex items-center justify-center text-white/60 text-[9px]">
                              |0⟩
                            </div>

                            {/* Gate slots */}
                            <div className="flex-1 flex items-center">
                              <div className="flex-1 h-0.5 bg-white/20 relative">
                                {/* Gates on this qubit */}
                                {gates
                                  .filter(g =>
                                    g.qubit === qubitInfo.id ||
                                    (g.controlQubits?.includes(qubitInfo.id))
                                  )
                                  .map((gate) => {
                                    const gateInfo = GATE_INFO[gate.gate];
                                    const isControl = gate.controlQubits?.includes(qubitInfo.id);

                                    return (
                                      <TooltipProvider key={gate.id}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div
                                              className={cn(
                                                'absolute top-1/2 -translate-y-1/2 transition-all duration-300 cursor-help',
                                                isControl
                                                  ? 'w-2.5 h-2.5 rounded-full bg-indigo-500 border border-white'
                                                  : 'w-6 h-6 rounded flex items-center justify-center text-white font-bold text-[10px]',
                                                !isControl && (gateInfo?.color || 'bg-gray-500')
                                              )}
                                              style={{ left: `${gate.column * 28 + 6}px` }}
                                            >
                                              {!isControl && (gateInfo?.symbol || gate.gate.toUpperCase())}
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p className="font-semibold">{gateInfo?.name || gate.gate}</p>
                                            <p className="text-xs text-muted-foreground">{gate.reason}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    );
                                  })}
                              </div>
                            </div>

                            {/* Measurement */}
                            <div className="w-5 h-5 rounded border border-white/20 flex items-center justify-center text-white/40">
                              <BarChart3 className="h-2.5 w-2.5" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Compact Legend */}
              <div className="mt-2 flex flex-wrap gap-1">
                {Object.entries(GATE_INFO).slice(0, 6).map(([key, info]) => (
                  <div key={key} className="flex items-center gap-0.5 text-xs text-white/50">
                    <div className={cn('w-3 h-3 rounded flex items-center justify-center text-white text-[8px]', info.color)}>
                      {info.symbol}
                    </div>
                    <span>{info.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Analysis Log */}
          <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-white flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-cyan-400" />
                Analysis Log
                {currentStep > 0 && (
                  <Badge variant="outline" className="border-cyan-500/50 text-cyan-300 text-xs">
                    Step {currentStep}/10
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[180px]">
                <div className="space-y-1.5 pr-4">
                  {logs.length === 0 ? (
                    <p className="text-xs text-white/40 text-center py-4">
                      Analysis steps will appear here...
                    </p>
                  ) : (
                    logs.map((log) => (
                      <div
                        key={log.id}
                        className={cn(
                          'p-1.5 rounded text-xs',
                          log.type === 'gate' ? 'bg-purple-900/30 border-l-2 border-purple-500' :
                          log.type === 'analysis' ? 'bg-blue-900/30 border-l-2 border-blue-500' :
                          log.type === 'result' ? 'bg-green-900/30 border-l-2 border-green-500' :
                          'bg-white/5'
                        )}
                      >
                        <div className="flex items-start gap-1.5">
                          {log.type === 'gate' && <Zap className="h-3 w-3 text-purple-400 mt-0.5 shrink-0" />}
                          {log.type === 'analysis' && <Brain className="h-3 w-3 text-blue-400 mt-0.5 shrink-0" />}
                          {log.type === 'result' && <CheckCircle className="h-3 w-3 text-green-400 mt-0.5 shrink-0" />}
                          {log.type === 'info' && <Activity className="h-3 w-3 text-white/40 mt-0.5 shrink-0" />}
                          <div className="min-w-0">
                            <p className="text-white text-xs">{log.message}</p>
                            {log.details && (
                              <p className="text-white/50 text-xs truncate">{log.details}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Results */}
        <div className="col-span-4 space-y-3">
          {/* Primary Recommendation */}
          {recommendation && (
            <Card className={cn(
              'border backdrop-blur-sm',
              recommendation.tier.bgColor,
              recommendation.tier.borderColor
            )}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-white flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Routing Decision
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn('p-2 rounded-full', recommendation.tier.bgColor, recommendation.tier.color)}>
                    {recommendation.tier.icon}
                  </div>
                  <div className="flex-1">
                    <p className={cn('text-lg font-bold', recommendation.tier.color)}>
                      {recommendation.tier.label}
                    </p>
                    <p className="text-xs text-white/70">
                      {recommendation.confidence.toFixed(1)}% of outcomes
                    </p>
                  </div>
                  <Badge variant="outline" className="border-white/30 text-white/70">
                    SLA: {recommendation.tier.sla}
                  </Badge>
                </div>
                <div className="bg-black/30 rounded p-2 space-y-2">
                  <div>
                    <p className="text-xs text-white/60">Next Action</p>
                    <p className="text-sm text-white">{recommendation.tier.action}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/60">Route To</p>
                    <p className="text-sm text-white">{recommendation.tier.queue}</p>
                  </div>
                </div>

                {/* Flagged Factors */}
                {recommendation.flaggedFactors.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <p className="text-xs text-white/60 mb-1">Factors Contributing to Decision:</p>
                    <div className="flex flex-wrap gap-1">
                      {recommendation.flaggedFactors.map((idx) => {
                        const factor = QUBIT_LABELS[idx];
                        const FactorIcon = factor?.icon || Activity;
                        return (
                          <Badge key={idx} variant="outline" className={cn('text-xs', factor?.color, 'border-current')}>
                            <FactorIcon className="h-3 w-3 mr-1" />
                            {factor?.name || `Q${idx}`}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Risk Tier Distribution */}
          <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-white flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-cyan-400" />
                Risk Distribution by Tier
              </CardTitle>
              <CardDescription className="text-xs">
                {metrics ? `${metrics.total.toLocaleString()} quantum measurements` : 'Probability of each routing outcome'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {metrics ? (
                RISK_TIERS.map((tier) => {
                  const tierData = metrics.byTier[tier.level];
                  return (
                    <div key={tier.level} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1">
                          <span className={tier.color}>{tier.icon}</span>
                          <span className="text-white">{tier.label}</span>
                          <span className="text-white/40">(score {tier.minScore}-{tier.maxScore})</span>
                        </div>
                        <span className="font-mono text-white/80">
                          {tierData.percentage.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={tierData.percentage} className="h-1.5 bg-white/10" />
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-white/40 text-xs">
                  <PieChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Run analysis to see risk distribution</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Business Summary */}
          {metrics && (
            <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-white flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-400" />
                  Processing Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-green-500/10 border border-green-500/30 rounded p-2 text-center">
                    <p className="text-lg font-bold text-green-400">
                      {(metrics.byTier[0].percentage + metrics.byTier[1].percentage).toFixed(0)}%
                    </p>
                    <p className="text-xs text-white/60">Auto/Quick</p>
                  </div>
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2 text-center">
                    <p className="text-lg font-bold text-yellow-400">
                      {(metrics.byTier[2].percentage + metrics.byTier[3].percentage + metrics.byTier[4].percentage).toFixed(0)}%
                    </p>
                    <p className="text-xs text-white/60">Review</p>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/30 rounded p-2 text-center">
                    <p className="text-lg font-bold text-red-400">
                      {(metrics.byTier[5].percentage + metrics.byTier[6].percentage).toFixed(0)}%
                    </p>
                    <p className="text-xs text-white/60">Investigate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* How It Works */}
          <Card className="bg-gradient-to-br from-purple-900/30 to-cyan-900/30 border-purple-500/30 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-white flex items-center gap-2">
                <Zap className="h-4 w-4 text-purple-400" />
                How Quantum Triage Works
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-xs text-white/70">
                <p className="font-medium text-white/90">12 qubits = 12 weighted risk factors:</p>
                <div className="grid grid-cols-2 gap-1">
                  <div className="text-green-400">|0⟩ = Clear (0 pts)</div>
                  <div className="text-red-400">|1⟩ = Flagged (weighted)</div>
                </div>
                <div className="pt-1 border-t border-white/10 space-y-1">
                  <p><span className="text-red-400">X gate</span> = Definite flag (100%)</p>
                  <p><span className="text-blue-400">H gate</span> = Uncertainty (50/50)</p>
                  <p><span className="text-purple-400">H+Rz</span> = Biased probability</p>
                  <p><span className="text-indigo-400">CNOT/CCX</span> = Correlated factors</p>
                </div>
                <p className="text-white/50 pt-1 border-t border-white/10">
                  Routing uses <span className="text-cyan-400">weighted scoring</span>: Clinical issues (3.0), Duplicates (3.0), Provider (2.5) weigh more than Amount (1.0) or Network (1.0). High-dollar claims with proper auth route quickly.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
