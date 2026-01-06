'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  Play,
  RotateCcw,
  Download,
  Plus,
  Minus,
  Trash2,
  Copy,
  Zap,
  Atom,
  Activity,
  BarChart3,
  Code2,
  ChevronLeft,
  Layers,
  CircleDot,
  Waves,
  CheckCircle,
  Bot,
  Loader2,
  Wand2,
  Server,
  Gauge,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';

// Types
interface PlacedGate {
  id: string;
  gate: string;
  qubit: number;
  column: number;
  controlQubits?: number[];
  params?: Record<string, number>;
}

interface SimulationResult {
  probabilities: number[];
  amplitudes: { re: number; im: number }[];
  measurements: number[];
  stateVector: string[];
}

interface BackendStatus {
  backends: {
    'quantum-circuit-js': {
      available: boolean;
      description: string;
      maxQubits: number;
    };
    'qiskit': {
      available: boolean;
      configured: boolean;
      version?: string;
      description: string;
    };
  };
}

// Gate definitions with better colors
const GATES: Record<string, {
  name: string;
  symbol: string;
  description: string;
  qubits: number;
  category: 'pauli' | 'hadamard' | 'phase' | 'rotation' | 'controlled' | 'measurement';
  color: string;
  textColor?: string;
  params?: string[];
}> = {
  // Pauli gates - intuitive RGB
  x: { name: 'Pauli-X', symbol: 'X', description: 'Bit flip (NOT)', qubits: 1, category: 'pauli', color: 'bg-red-500', textColor: 'text-white' },
  y: { name: 'Pauli-Y', symbol: 'Y', description: 'Bit & phase flip', qubits: 1, category: 'pauli', color: 'bg-green-500', textColor: 'text-white' },
  z: { name: 'Pauli-Z', symbol: 'Z', description: 'Phase flip', qubits: 1, category: 'pauli', color: 'bg-blue-500', textColor: 'text-white' },
  // Hadamard - purple for superposition
  h: { name: 'Hadamard', symbol: 'H', description: 'Superposition', qubits: 1, category: 'hadamard', color: 'bg-purple-500', textColor: 'text-white' },
  // Phase gates - cyan/teal
  s: { name: 'S Gate', symbol: 'S', description: 'π/2 phase', qubits: 1, category: 'phase', color: 'bg-cyan-500', textColor: 'text-white' },
  t: { name: 'T Gate', symbol: 'T', description: 'π/4 phase', qubits: 1, category: 'phase', color: 'bg-teal-500', textColor: 'text-white' },
  // Rotation gates - orange
  rx: { name: 'RX', symbol: 'Rx', description: 'X rotation', qubits: 1, category: 'rotation', color: 'bg-orange-500', textColor: 'text-white', params: ['theta'] },
  ry: { name: 'RY', symbol: 'Ry', description: 'Y rotation', qubits: 1, category: 'rotation', color: 'bg-amber-500', textColor: 'text-white', params: ['theta'] },
  rz: { name: 'RZ', symbol: 'Rz', description: 'Z rotation', qubits: 1, category: 'rotation', color: 'bg-yellow-500', textColor: 'text-black', params: ['theta'] },
  // Controlled gates - indigo
  cx: { name: 'CNOT', symbol: 'CX', description: 'Controlled NOT', qubits: 2, category: 'controlled', color: 'bg-indigo-500', textColor: 'text-white' },
  cz: { name: 'CZ', symbol: 'CZ', description: 'Controlled Z', qubits: 2, category: 'controlled', color: 'bg-violet-500', textColor: 'text-white' },
  swap: { name: 'SWAP', symbol: '⨯', description: 'Swap qubits', qubits: 2, category: 'controlled', color: 'bg-pink-500', textColor: 'text-white' },
  ccx: { name: 'Toffoli', symbol: 'CCX', description: 'Double CNOT', qubits: 3, category: 'controlled', color: 'bg-rose-500', textColor: 'text-white' },
  // Measurement - gray
  measure: { name: 'Measure', symbol: 'M', description: 'Measure qubit', qubits: 1, category: 'measurement', color: 'bg-slate-600', textColor: 'text-white' },
};

// Example circuits
const EXAMPLE_CIRCUITS = [
  {
    name: 'Bell State',
    description: 'Entangled |00⟩ + |11⟩',
    qubits: 2,
    gates: [
      { id: '1', gate: 'h', qubit: 0, column: 0 },
      { id: '2', gate: 'cx', qubit: 0, column: 1, controlQubits: [1] },
    ],
  },
  {
    name: 'GHZ State',
    description: '3-qubit entanglement',
    qubits: 3,
    gates: [
      { id: '1', gate: 'h', qubit: 0, column: 0 },
      { id: '2', gate: 'cx', qubit: 0, column: 1, controlQubits: [1] },
      { id: '3', gate: 'cx', qubit: 1, column: 2, controlQubits: [2] },
    ],
  },
  {
    name: 'Superposition',
    description: 'All qubits in |+⟩',
    qubits: 4,
    gates: [
      { id: '1', gate: 'h', qubit: 0, column: 0 },
      { id: '2', gate: 'h', qubit: 1, column: 0 },
      { id: '3', gate: 'h', qubit: 2, column: 0 },
      { id: '4', gate: 'h', qubit: 3, column: 0 },
    ],
  },
  {
    name: 'Teleportation',
    description: 'Quantum teleportation',
    qubits: 3,
    gates: [
      { id: '1', gate: 'h', qubit: 1, column: 0 },
      { id: '2', gate: 'cx', qubit: 1, column: 1, controlQubits: [2] },
      { id: '3', gate: 'cx', qubit: 0, column: 2, controlQubits: [1] },
      { id: '4', gate: 'h', qubit: 0, column: 3 },
    ],
  },
];

const GATE_CATEGORIES = [
  { id: 'pauli', label: 'Pauli', gates: ['x', 'y', 'z'] },
  { id: 'hadamard', label: 'H', gates: ['h'] },
  { id: 'phase', label: 'Phase', gates: ['s', 't'] },
  { id: 'rotation', label: 'Rotate', gates: ['rx', 'ry', 'rz'] },
  { id: 'controlled', label: 'Multi', gates: ['cx', 'cz', 'swap', 'ccx'] },
  { id: 'measurement', label: 'Measure', gates: ['measure'] },
];

export default function QuantumCircuitBuilder() {
  // Circuit state
  const [numQubits, setNumQubits] = useState(3);
  const [gates, setGates] = useState<PlacedGate[]>([]);
  const [selectedGate, setSelectedGate] = useState<string | null>(null);
  const [selectedPlacedGate, setSelectedPlacedGate] = useState<string | null>(null);

  // Simulation state
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [shots, setShots] = useState(1024);
  const [measurementResults, setMeasurementResults] = useState<Record<string, number>>({});

  // UI state
  const [rightPanelTab, setRightPanelTab] = useState<'gates' | 'results' | 'code'>('gates');
  const [rotationAngle, setRotationAngle] = useState(Math.PI / 2);
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Backend state
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [useQiskit, setUseQiskit] = useState(false);
  const [qiskitConnected, setQiskitConnected] = useState(false);

  // Check backend status on mount
  useEffect(() => {
    const checkBackends = async () => {
      try {
        const response = await fetch('/api/quantum');
        if (response.ok) {
          const status = await response.json();
          setBackendStatus(status);
          const qiskitAvailable = status.backends?.qiskit?.available;
          setQiskitConnected(qiskitAvailable);
          if (qiskitAvailable) setUseQiskit(true);
        }
      } catch {
        // Ignore errors
      }
    };
    checkBackends();
  }, []);

  // Calculate grid columns
  const maxColumn = Math.max(0, ...gates.map(g => g.column)) + 3;

  // Add gate to circuit
  const addGateToCircuit = (gateName: string, qubit: number, column: number) => {
    const gate = GATES[gateName];
    if (!gate) return;

    const newGate: PlacedGate = {
      id: `gate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      gate: gateName,
      qubit,
      column,
      params: gate.params ? { theta: rotationAngle } : undefined,
    };

    // For multi-qubit gates, add control qubits
    if (gate.qubits === 2 && qubit < numQubits - 1) {
      newGate.controlQubits = [qubit + 1];
    } else if (gate.qubits === 3 && qubit < numQubits - 2) {
      newGate.controlQubits = [qubit + 1, qubit + 2];
    }

    setGates(prev => [...prev, newGate]);
    setSelectedGate(null);
  };

  // Remove gate
  const removeGate = (gateId: string) => {
    setGates(prev => prev.filter(g => g.id !== gateId));
    setSelectedPlacedGate(null);
  };

  // Clear circuit
  const clearCircuit = () => {
    setGates([]);
    setSimulationResult(null);
    setMeasurementResults({});
  };

  // Load example circuit
  const loadExample = (example: typeof EXAMPLE_CIRCUITS[0]) => {
    setNumQubits(example.qubits);
    setGates(example.gates.map(g => ({ ...g, id: `gate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` })));
    setSimulationResult(null);
    setMeasurementResults({});
  };

  // Generate with AI
  const generateWithAI = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);

    try {
      const response = await fetch('/api/quantum/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, currentQubits: numQubits }),
      });

      const data = await response.json();
      if (data.success && data.circuit) {
        setNumQubits(data.circuit.qubits || numQubits);
        setGates(data.circuit.gates.map((g: PlacedGate) => ({
          ...g,
          id: g.id || `gate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        })));
        setSimulationResult(null);
        setMeasurementResults({});
        setAiPrompt('');
        setShowAiPrompt(false);
      }
    } catch {
      // Handle error
    } finally {
      setIsGenerating(false);
    }
  };

  // Run simulation
  const runSimulation = async () => {
    setIsSimulating(true);

    try {
      // Prepare gates for API
      const gateList = gates.sort((a, b) => a.column - b.column).map(g => ({
        gate: g.gate,
        qubit: g.qubit,
        targetQubit: g.controlQubits?.[0],
        params: g.params?.theta ? [g.params.theta] : undefined,
      }));

      // Try Qiskit backend if enabled
      if (useQiskit && qiskitConnected) {
        const qiskitUrl = process.env.NEXT_PUBLIC_QISKIT_BACKEND_URL || 'http://localhost:5001';
        const response = await fetch(`${qiskitUrl}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ numQubits, gates: gateList, shots }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            const stateVector: string[] = [];
            for (const [state, prob] of Object.entries(data.results.probabilities)) {
              stateVector.push(`|${state}⟩: ${((prob as number) * 100).toFixed(2)}%`);
            }

            setSimulationResult({
              probabilities: Object.values(data.results.probabilities),
              amplitudes: [],
              measurements: [],
              stateVector,
            });
            setMeasurementResults(data.results.measurements || data.results.counts || {});
            setRightPanelTab('results');
            return;
          }
        }
      }

      // Fallback to JS simulator
      const { SimpleQuantumCircuit } = await import('@/lib/quantum-sim');
      const circuit = new SimpleQuantumCircuit(numQubits);

      for (const placedGate of gates.sort((a, b) => a.column - b.column)) {
        const gateDef = GATES[placedGate.gate];
        if (!gateDef || placedGate.gate === 'measure') continue;

        if (gateDef.qubits === 1) {
          circuit.addGate(
            placedGate.gate,
            placedGate.qubit,
            undefined,
            placedGate.params?.theta !== undefined ? { theta: placedGate.params.theta } : undefined
          );
        } else if (gateDef.qubits >= 2 && placedGate.controlQubits) {
          circuit.addGate(placedGate.gate, placedGate.qubit, placedGate.controlQubits);
        }
      }

      const result = circuit.runWithMeasurements(shots);
      setSimulationResult({
        probabilities: result.probabilities,
        amplitudes: [],
        measurements: [],
        stateVector: result.stateVector,
      });
      setMeasurementResults(result.measurements);
      setRightPanelTab('results');
    } catch (error) {
      console.error('Simulation failed:', error);
    } finally {
      setIsSimulating(false);
    }
  };

  // Generate Qiskit code
  const generateCode = () => {
    let code = `# Quantum Circuit - Qiskit Code\n`;
    code += `from qiskit import QuantumCircuit, transpile\n`;
    code += `from qiskit_aer import AerSimulator\n\n`;
    code += `qc = QuantumCircuit(${numQubits}, ${numQubits})\n\n`;

    for (const placedGate of gates.sort((a, b) => a.column - b.column)) {
      const gateDef = GATES[placedGate.gate];
      if (!gateDef) continue;

      if (placedGate.gate === 'measure') {
        code += `qc.measure(${placedGate.qubit}, ${placedGate.qubit})\n`;
      } else if (placedGate.gate === 'h') {
        code += `qc.h(${placedGate.qubit})\n`;
      } else if (['x', 'y', 'z', 's', 't'].includes(placedGate.gate)) {
        code += `qc.${placedGate.gate}(${placedGate.qubit})\n`;
      } else if (['rx', 'ry', 'rz'].includes(placedGate.gate)) {
        code += `qc.${placedGate.gate}(${placedGate.params?.theta || Math.PI / 2}, ${placedGate.qubit})\n`;
      } else if (['cx', 'cz', 'swap'].includes(placedGate.gate) && placedGate.controlQubits) {
        code += `qc.${placedGate.gate}(${placedGate.qubit}, ${placedGate.controlQubits[0]})\n`;
      } else if (placedGate.gate === 'ccx' && placedGate.controlQubits) {
        code += `qc.ccx(${placedGate.qubit}, ${placedGate.controlQubits[0]}, ${placedGate.controlQubits[1]})\n`;
      }
    }

    code += `\n# Run simulation\n`;
    code += `simulator = AerSimulator()\n`;
    code += `result = simulator.run(transpile(qc, simulator), shots=${shots}).result()\n`;
    code += `print(result.get_counts())\n`;

    return code;
  };

  // Export circuit
  const exportCircuit = () => {
    const data = { qubits: numQubits, gates, metadata: { exported: new Date().toISOString() } };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quantum-circuit.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Subtle animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-30">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-purple-500/20 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-cyan-500/20 rounded-full blur-[128px]" />
      </div>

      <div className="relative z-10 h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-white/60 hover:text-white hover:bg-white/10">
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500">
                  <Atom className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-white">Quantum Circuit Builder</h1>
                  <p className="text-xs text-white/50">Design and simulate quantum circuits</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Qubit selector */}
              <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
                <span className="text-xs text-white/60">Qubits</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-white/60 hover:text-white hover:bg-white/10"
                  onClick={() => setNumQubits(Math.max(1, numQubits - 1))}
                  disabled={numQubits <= 1}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="text-sm font-mono text-white w-4 text-center">{numQubits}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-white/60 hover:text-white hover:bg-white/10"
                  onClick={() => setNumQubits(Math.min(8, numQubits + 1))}
                  disabled={numQubits >= 8}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              {/* Stats badges */}
              <Badge variant="outline" className="border-purple-500/50 text-purple-300">
                <Layers className="h-3 w-3 mr-1" />
                {gates.length} gates
              </Badge>

              {/* Backend indicator */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className={cn(
                        'cursor-pointer',
                        qiskitConnected
                          ? 'border-green-500/50 text-green-300'
                          : 'border-yellow-500/50 text-yellow-300'
                      )}
                      onClick={() => qiskitConnected && setUseQiskit(!useQiskit)}
                    >
                      <Server className="h-3 w-3 mr-1" />
                      {useQiskit && qiskitConnected ? 'Qiskit' : 'JS Sim'}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    {qiskitConnected ? 'Click to toggle backend' : 'Qiskit backend offline'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Action buttons */}
              <Button
                size="sm"
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
                onClick={clearCircuit}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Clear
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
                onClick={exportCircuit}
              >
                <Download className="h-3 w-3 mr-1" />
                Export
              </Button>
              <Button
                size="sm"
                className="bg-gradient-to-r from-purple-500 to-cyan-500 text-white hover:from-purple-400 hover:to-cyan-400"
                onClick={runSimulation}
                disabled={isSimulating || gates.length === 0}
              >
                {isSimulating ? (
                  <Activity className="h-3 w-3 mr-1 animate-pulse" />
                ) : (
                  <Play className="h-3 w-3 mr-1" />
                )}
                {isSimulating ? 'Running...' : 'Simulate'}
              </Button>
            </div>
          </div>
        </header>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Circuit Editor - Main area */}
          <div className="flex-1 p-6 overflow-auto">
            <Card className="h-full bg-black/40 border-white/10 backdrop-blur-sm">
              <CardContent className="p-6 h-full">
                <div className="relative h-full">
                  {/* Circuit grid */}
                  <div className="space-y-1">
                    {Array.from({ length: numQubits }).map((_, qubit) => (
                      <div key={qubit} className="flex items-center gap-3 group">
                        {/* Qubit label */}
                        <div className="w-16 flex items-center gap-2 flex-shrink-0">
                          <div className="w-3 h-3 rounded-full bg-gradient-to-br from-cyan-400 to-purple-400" />
                          <span className="text-sm font-mono text-white/70">q[{qubit}]</span>
                        </div>

                        {/* Initial state */}
                        <div className="w-10 h-12 flex items-center justify-center text-white/50 text-sm font-mono flex-shrink-0">
                          |0⟩
                        </div>

                        {/* Wire and gates */}
                        <div className="flex-1 flex items-center relative min-w-0">
                          {/* Background wire */}
                          <div className="absolute inset-y-0 left-0 right-0 flex items-center">
                            <div className="w-full h-[3px] bg-gradient-to-r from-cyan-500/30 via-purple-500/30 to-cyan-500/30 rounded-full" />
                          </div>

                          {/* Gate slots */}
                          <div className="flex gap-2 relative z-10 overflow-x-auto pb-1">
                            {Array.from({ length: maxColumn }).map((_, col) => {
                              const gateAtPosition = gates.find(g => g.qubit === qubit && g.column === col);
                              const isControlTarget = gates.some(g =>
                                g.column === col && g.controlQubits?.includes(qubit)
                              );
                              const controlGate = gates.find(g =>
                                g.column === col && g.controlQubits?.includes(qubit)
                              );

                              return (
                                <div
                                  key={col}
                                  className={cn(
                                    'w-12 h-12 rounded-lg flex items-center justify-center transition-all cursor-pointer flex-shrink-0',
                                    gateAtPosition
                                      ? ''
                                      : 'border-2 border-dashed border-white/10 hover:border-white/30 hover:bg-white/5',
                                    selectedGate && !gateAtPosition && 'border-purple-500/50 bg-purple-500/10',
                                    isControlTarget && !gateAtPosition && 'bg-indigo-500/20 border-indigo-500/50',
                                  )}
                                  onClick={() => {
                                    if (selectedGate && !gateAtPosition) {
                                      addGateToCircuit(selectedGate, qubit, col);
                                    } else if (gateAtPosition) {
                                      setSelectedPlacedGate(selectedPlacedGate === gateAtPosition.id ? null : gateAtPosition.id);
                                    }
                                  }}
                                >
                                  {gateAtPosition && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div
                                            className={cn(
                                              'w-full h-full rounded-lg flex items-center justify-center text-sm font-bold shadow-lg transition-all',
                                              GATES[gateAtPosition.gate]?.color || 'bg-gray-500',
                                              GATES[gateAtPosition.gate]?.textColor || 'text-white',
                                              selectedPlacedGate === gateAtPosition.id && 'ring-2 ring-white ring-offset-2 ring-offset-slate-900',
                                            )}
                                          >
                                            {GATES[gateAtPosition.gate]?.symbol || gateAtPosition.gate}
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p className="font-semibold">{GATES[gateAtPosition.gate]?.name}</p>
                                          <p className="text-xs text-muted-foreground">{GATES[gateAtPosition.gate]?.description}</p>
                                          {gateAtPosition.params?.theta && (
                                            <p className="text-xs mt-1">θ = {(gateAtPosition.params.theta / Math.PI).toFixed(2)}π</p>
                                          )}
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                  {isControlTarget && !gateAtPosition && (
                                    <div className="w-4 h-4 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/50" />
                                  )}
                                  {!gateAtPosition && !isControlTarget && selectedGate && (
                                    <Plus className="h-4 w-4 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Output */}
                        <div className="w-10 flex items-center justify-center text-white/30 flex-shrink-0">
                          <Waves className="h-4 w-4" />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Empty state */}
                  {gates.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <Atom className="h-16 w-16 mx-auto mb-4 text-white/20" />
                        <p className="text-white/40 text-lg">Select a gate from the panel</p>
                        <p className="text-white/30 text-sm mt-1">Then click on the circuit to place it</p>
                      </div>
                    </div>
                  )}

                  {/* Selected gate delete button */}
                  {selectedPlacedGate && (
                    <div className="absolute top-2 right-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8"
                        onClick={() => removeGate(selectedPlacedGate)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel */}
          <div className="w-80 border-l border-white/10 bg-black/20 backdrop-blur-sm flex flex-col">
            <Tabs value={rightPanelTab} onValueChange={(v) => setRightPanelTab(v as any)} className="flex-1 flex flex-col">
              <TabsList className="mx-4 mt-4 bg-white/5">
                <TabsTrigger value="gates" className="flex-1 data-[state=active]:bg-white/10">
                  <Zap className="h-3 w-3 mr-1" />
                  Gates
                </TabsTrigger>
                <TabsTrigger value="results" className="flex-1 data-[state=active]:bg-white/10">
                  <BarChart3 className="h-3 w-3 mr-1" />
                  Results
                </TabsTrigger>
                <TabsTrigger value="code" className="flex-1 data-[state=active]:bg-white/10">
                  <Code2 className="h-3 w-3 mr-1" />
                  Code
                </TabsTrigger>
              </TabsList>

              <TabsContent value="gates" className="flex-1 overflow-auto p-4 mt-0">
                <div className="space-y-4">
                  {/* Gate categories */}
                  {GATE_CATEGORIES.map((category) => (
                    <div key={category.id}>
                      <p className="text-xs text-white/50 uppercase tracking-wider mb-2">{category.label}</p>
                      <div className="flex flex-wrap gap-2">
                        {category.gates.map((gateKey) => {
                          const gate = GATES[gateKey];
                          return (
                            <TooltipProvider key={gateKey}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    className={cn(
                                      'w-11 h-11 rounded-lg text-sm font-bold transition-all shadow-md',
                                      gate.color,
                                      gate.textColor || 'text-white',
                                      selectedGate === gateKey
                                        ? 'ring-2 ring-white scale-110 shadow-lg'
                                        : 'hover:scale-105 hover:shadow-lg',
                                    )}
                                    onClick={() => setSelectedGate(selectedGate === gateKey ? null : gateKey)}
                                  >
                                    {gate.symbol}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="left">
                                  <p className="font-semibold">{gate.name}</p>
                                  <p className="text-xs text-muted-foreground">{gate.description}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Rotation angle */}
                  {selectedGate && GATES[selectedGate]?.params?.includes('theta') && (
                    <div className="pt-4 border-t border-white/10">
                      <p className="text-xs text-white/50 mb-2">Rotation Angle</p>
                      <div className="flex items-center gap-3">
                        <Slider
                          value={[rotationAngle]}
                          min={0}
                          max={2 * Math.PI}
                          step={Math.PI / 8}
                          onValueChange={([v]) => setRotationAngle(v)}
                          className="flex-1"
                        />
                        <span className="text-sm text-white/70 font-mono w-12">
                          {(rotationAngle / Math.PI).toFixed(2)}π
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Demo circuits */}
                  <div className="pt-4 border-t border-white/10">
                    <p className="text-xs text-white/50 uppercase tracking-wider mb-2">Quick Demos</p>
                    <div className="grid grid-cols-2 gap-2">
                      {EXAMPLE_CIRCUITS.map((example) => (
                        <button
                          key={example.name}
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-left transition-colors"
                          onClick={() => loadExample(example)}
                        >
                          <p className="text-xs font-medium text-white">{example.name}</p>
                          <p className="text-[10px] text-white/50">{example.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Shots control */}
                  <div className="pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-white/50">Measurement Shots</p>
                      <div className="flex items-center gap-2">
                        <Gauge className="h-3 w-3 text-white/40" />
                        <Input
                          type="number"
                          value={shots}
                          onChange={(e) => setShots(Math.max(1, Math.min(10000, parseInt(e.target.value) || 1024)))}
                          className="w-20 h-7 text-xs bg-white/5 border-white/10 text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="results" className="flex-1 overflow-auto p-4 mt-0">
                {simulationResult ? (
                  <div className="space-y-4">
                    {/* State vector */}
                    <div>
                      <p className="text-xs text-white/50 uppercase tracking-wider mb-2">State Vector</p>
                      <div className="flex flex-wrap gap-1">
                        {simulationResult.stateVector.slice(0, 8).map((state, i) => (
                          <Badge key={i} variant="outline" className="border-purple-500/50 text-purple-300 text-xs font-mono">
                            {state}
                          </Badge>
                        ))}
                        {simulationResult.stateVector.length > 8 && (
                          <Badge variant="outline" className="border-white/20 text-white/50 text-xs">
                            +{simulationResult.stateVector.length - 8} more
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Histogram */}
                    <div>
                      <p className="text-xs text-white/50 uppercase tracking-wider mb-2">
                        Measurements ({shots} shots)
                      </p>
                      <div className="space-y-2">
                        {Object.entries(measurementResults)
                          .sort(([, a], [, b]) => b - a)
                          .slice(0, 8)
                          .map(([state, count]) => (
                            <div key={state} className="flex items-center gap-2">
                              <span className="font-mono text-xs text-white/60 w-16">|{state}⟩</span>
                              <div className="flex-1 h-5 bg-white/5 rounded overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-500"
                                  style={{ width: `${(count / shots) * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-white/60 w-12 text-right font-mono">
                                {((count / shots) * 100).toFixed(1)}%
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <Activity className="h-12 w-12 text-white/20 mb-3" />
                    <p className="text-white/40">No results yet</p>
                    <p className="text-xs text-white/30 mt-1">Run the simulation to see results</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="code" className="flex-1 overflow-auto p-4 mt-0">
                <div className="relative h-full">
                  <pre className="text-xs font-mono text-green-400 bg-black/50 p-4 rounded-lg overflow-auto h-full">
                    {generateCode()}
                  </pre>
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute top-2 right-2 h-7 border-white/20 text-white hover:bg-white/10"
                    onClick={() => navigator.clipboard.writeText(generateCode())}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-white/10 bg-black/20 backdrop-blur-sm px-6 py-3">
          <div className="flex items-center justify-between">
            {/* AI Prompt */}
            <div className="flex items-center gap-3 flex-1 max-w-xl">
              <Button
                size="sm"
                variant="ghost"
                className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                onClick={() => setShowAiPrompt(!showAiPrompt)}
              >
                <Bot className="h-4 w-4 mr-1" />
                AI Builder
                {showAiPrompt ? <ChevronDown className="h-3 w-3 ml-1" /> : <ChevronUp className="h-3 w-3 ml-1" />}
              </Button>
              {showAiPrompt && (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    placeholder="Describe what circuit to build..."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="h-8 bg-white/5 border-white/10 text-white text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && generateWithAI()}
                  />
                  <Button
                    size="sm"
                    className="h-8 bg-purple-500 hover:bg-purple-400"
                    onClick={generateWithAI}
                    disabled={isGenerating || !aiPrompt.trim()}
                  >
                    {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                  </Button>
                </div>
              )}
            </div>

            {/* Quick prompt chips */}
            <div className="flex items-center gap-2">
              {['Bell state', 'GHZ', 'Teleport'].map((prompt) => (
                <button
                  key={prompt}
                  className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 rounded text-white/60 hover:text-white transition-colors"
                  onClick={() => {
                    setAiPrompt(prompt);
                    setShowAiPrompt(true);
                  }}
                >
                  <Sparkles className="h-3 w-3 inline mr-1" />
                  {prompt}
                </button>
              ))}
            </div>

            {/* Healthcare demos */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/40">Demos:</span>
              <Link href="/quantum/polypharmacy-demo">
                <Button variant="outline" size="sm" className="border-purple-500/50 text-purple-300 hover:bg-purple-500/10 h-7 text-xs">
                  <Zap className="h-3 w-3 mr-1" />
                  Polypharmacy
                </Button>
              </Link>
              <Link href="/quantum/surgical-risk">
                <Button variant="outline" size="sm" className="border-red-500/50 text-red-300 hover:bg-red-500/10 h-7 text-xs">
                  <Activity className="h-3 w-3 mr-1" />
                  Surgical Risk
                </Button>
              </Link>
              <Link href="/quantum/icu-deterioration">
                <Button variant="outline" size="sm" className="border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/10 h-7 text-xs">
                  <Gauge className="h-3 w-3 mr-1" />
                  ICU Monitor
                </Button>
              </Link>
              <Link href="/quantum/claims-demo">
                <Button variant="outline" size="sm" className="border-blue-500/50 text-blue-300 hover:bg-blue-500/10 h-7 text-xs">
                  <BarChart3 className="h-3 w-3 mr-1" />
                  Claims
                </Button>
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
