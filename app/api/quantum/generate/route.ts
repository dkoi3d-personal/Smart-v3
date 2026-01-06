import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

interface QuantumGate {
  id: string;
  gate: string;
  qubit: number;
  column: number;
  controlQubits?: number[];
  params?: { theta?: number };
}

interface GeneratedCircuit {
  name: string;
  description: string;
  qubits: number;
  gates: QuantumGate[];
}

const SYSTEM_PROMPT = `You are a quantum computing expert. Generate quantum circuits based on user descriptions.

Available gates:
- h: Hadamard gate (creates superposition)
- x: Pauli-X gate (NOT/bit flip)
- y: Pauli-Y gate (bit and phase flip)
- z: Pauli-Z gate (phase flip)
- s: S gate (π/2 phase)
- t: T gate (π/4 phase)
- rx: X-rotation (requires theta parameter in radians)
- ry: Y-rotation (requires theta parameter in radians)
- rz: Z-rotation (requires theta parameter in radians)
- cx: CNOT (controlled-NOT, requires controlQubits array with target)
- cz: Controlled-Z (requires controlQubits array with target)
- swap: Swap two qubits (requires controlQubits array with second qubit)
- ccx: Toffoli/CCNOT (requires controlQubits array with two targets)
- measure: Measurement gate

Rules:
1. Gates are placed on a grid with qubit (row) and column
2. Column numbers should increase left to right (0, 1, 2...)
3. For multi-qubit gates like cx, the main qubit is control, controlQubits[0] is target
4. Keep circuits simple and educational
5. Maximum 8 qubits
6. Generate unique IDs for each gate (use format: gate-1, gate-2, etc.)

Respond ONLY with valid JSON in this exact format:
{
  "name": "Circuit Name",
  "description": "Brief description of what this circuit does",
  "qubits": 2,
  "gates": [
    { "id": "gate-1", "gate": "h", "qubit": 0, "column": 0 },
    { "id": "gate-2", "gate": "cx", "qubit": 0, "column": 1, "controlQubits": [1] }
  ]
}`;

export async function POST(request: NextRequest) {
  try {
    const { prompt, currentQubits } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const userPrompt = `Create a quantum circuit for: "${prompt}"

Current number of qubits available: ${currentQubits || 3}

Generate the circuit JSON now:`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      system: SYSTEM_PROMPT,
    });

    // Extract text content
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse the JSON response
    let circuit: GeneratedCircuit;
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      circuit = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Failed to parse circuit JSON:', textContent.text);
      return NextResponse.json(
        { error: 'Failed to parse generated circuit', raw: textContent.text },
        { status: 500 }
      );
    }

    // Validate the circuit
    if (!circuit.gates || !Array.isArray(circuit.gates)) {
      return NextResponse.json(
        { error: 'Invalid circuit format' },
        { status: 500 }
      );
    }

    // Ensure all gates have valid structure
    circuit.gates = circuit.gates.map((gate, index) => ({
      id: gate.id || `gate-${Date.now()}-${index}`,
      gate: gate.gate.toLowerCase(),
      qubit: Math.max(0, Math.min(gate.qubit, (circuit.qubits || 3) - 1)),
      column: gate.column || index,
      ...(gate.controlQubits && { controlQubits: gate.controlQubits }),
      ...(gate.params && { params: gate.params }),
    }));

    return NextResponse.json({
      success: true,
      circuit,
    });

  } catch (error) {
    console.error('Quantum generate error:', error);
    return NextResponse.json(
      { error: 'Failed to generate circuit', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET - Return demo circuits
export async function GET() {
  const demos: GeneratedCircuit[] = [
    {
      name: "Claims Triage",
      description: "Workers' comp claims routing simulation - determines auto-approve vs review needed",
      qubits: 2,
      gates: [
        { id: "demo-1", gate: "h", qubit: 0, column: 0 },
        { id: "demo-2", gate: "h", qubit: 1, column: 0 },
        { id: "demo-3", gate: "cx", qubit: 0, column: 1, controlQubits: [1] },
        { id: "demo-4", gate: "rz", qubit: 1, column: 2, params: { theta: Math.PI / 4 } },
      ]
    },
    {
      name: "Bell State",
      description: "Creates maximally entangled state |00⟩ + |11⟩ using Hadamard and CNOT",
      qubits: 2,
      gates: [
        { id: "demo-1", gate: "h", qubit: 0, column: 0 },
        { id: "demo-2", gate: "cx", qubit: 0, column: 1, controlQubits: [1] },
      ]
    },
    {
      name: "GHZ State",
      description: "Three-qubit entanglement |000⟩ + |111⟩",
      qubits: 3,
      gates: [
        { id: "demo-1", gate: "h", qubit: 0, column: 0 },
        { id: "demo-2", gate: "cx", qubit: 0, column: 1, controlQubits: [1] },
        { id: "demo-3", gate: "cx", qubit: 1, column: 2, controlQubits: [2] },
      ]
    },
    {
      name: "Quantum Superposition",
      description: "Put all qubits into equal superposition",
      qubits: 4,
      gates: [
        { id: "demo-1", gate: "h", qubit: 0, column: 0 },
        { id: "demo-2", gate: "h", qubit: 1, column: 0 },
        { id: "demo-3", gate: "h", qubit: 2, column: 0 },
        { id: "demo-4", gate: "h", qubit: 3, column: 0 },
      ]
    },
    {
      name: "Quantum Teleportation Setup",
      description: "Prepares entangled pair for quantum teleportation protocol",
      qubits: 3,
      gates: [
        { id: "demo-1", gate: "h", qubit: 1, column: 0 },
        { id: "demo-2", gate: "cx", qubit: 1, column: 1, controlQubits: [2] },
        { id: "demo-3", gate: "cx", qubit: 0, column: 2, controlQubits: [1] },
        { id: "demo-4", gate: "h", qubit: 0, column: 3 },
      ]
    },
    {
      name: "Phase Kickback",
      description: "Demonstrates phase kickback with controlled operations",
      qubits: 2,
      gates: [
        { id: "demo-1", gate: "x", qubit: 1, column: 0 },
        { id: "demo-2", gate: "h", qubit: 0, column: 1 },
        { id: "demo-3", gate: "h", qubit: 1, column: 1 },
        { id: "demo-4", gate: "cz", qubit: 0, column: 2, controlQubits: [1] },
        { id: "demo-5", gate: "h", qubit: 0, column: 3 },
      ]
    },
    {
      name: "Quantum Random Number",
      description: "Generate random bits using quantum measurement",
      qubits: 4,
      gates: [
        { id: "demo-1", gate: "h", qubit: 0, column: 0 },
        { id: "demo-2", gate: "h", qubit: 1, column: 0 },
        { id: "demo-3", gate: "h", qubit: 2, column: 0 },
        { id: "demo-4", gate: "h", qubit: 3, column: 0 },
        { id: "demo-5", gate: "measure", qubit: 0, column: 1 },
        { id: "demo-6", gate: "measure", qubit: 1, column: 1 },
        { id: "demo-7", gate: "measure", qubit: 2, column: 1 },
        { id: "demo-8", gate: "measure", qubit: 3, column: 1 },
      ]
    },
  ];

  return NextResponse.json({ demos });
}
