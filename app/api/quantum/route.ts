import { NextRequest, NextResponse } from 'next/server';

/**
 * Quantum Circuit API Endpoint
 *
 * This endpoint can be used to:
 * 1. Run quantum circuit simulations using the quantum-circuit JS library (default)
 * 2. Optionally connect to a Python/Qiskit backend for more advanced simulations
 *
 * For Qiskit integration, you need to:
 * 1. Set up a Python backend (see /qiskit-backend directory)
 * 2. Set QISKIT_BACKEND_URL environment variable
 */

interface QuantumGate {
  gate: string;
  qubit: number;
  targetQubit?: number;
  params?: number[];
}

interface QuantumCircuitRequest {
  numQubits: number;
  gates: QuantumGate[];
  shots?: number;
  useQiskit?: boolean;
}

// POST - Run quantum circuit simulation
export async function POST(request: NextRequest) {
  try {
    const body: QuantumCircuitRequest = await request.json();
    const { numQubits, gates, shots = 1024, useQiskit = false } = body;

    // Validate input
    if (!numQubits || numQubits < 1 || numQubits > 20) {
      return NextResponse.json(
        { error: 'Invalid number of qubits (must be 1-20)' },
        { status: 400 }
      );
    }

    if (!gates || !Array.isArray(gates)) {
      return NextResponse.json(
        { error: 'Gates must be an array' },
        { status: 400 }
      );
    }

    // Check if Qiskit backend is requested and available
    if (useQiskit) {
      const qiskitUrl = process.env.QISKIT_BACKEND_URL;

      if (!qiskitUrl) {
        return NextResponse.json({
          error: 'Qiskit backend not configured',
          message: 'Set QISKIT_BACKEND_URL environment variable to use Qiskit',
          fallback: 'Using quantum-circuit JS library instead'
        }, { status: 400 });
      }

      try {
        // Forward to Qiskit backend
        const qiskitResponse = await fetch(`${qiskitUrl}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ numQubits, gates, shots }),
        });

        if (!qiskitResponse.ok) {
          throw new Error('Qiskit backend error');
        }

        const result = await qiskitResponse.json();
        return NextResponse.json({
          success: true,
          backend: 'qiskit',
          ...result
        });
      } catch {
        return NextResponse.json({
          error: 'Failed to connect to Qiskit backend',
          message: 'Ensure the Python Qiskit server is running'
        }, { status: 503 });
      }
    }

    // Use quantum-circuit JS library (default)
    // Note: The actual simulation happens client-side for performance
    // This endpoint is for logging, persistence, and optional Qiskit integration

    return NextResponse.json({
      success: true,
      backend: 'quantum-circuit-js',
      message: 'Use client-side quantum-circuit library for simulation',
      circuit: {
        numQubits,
        gates,
        shots
      }
    });

  } catch (error) {
    console.error('Quantum API error:', error);
    return NextResponse.json(
      { error: 'Failed to process quantum circuit request' },
      { status: 500 }
    );
  }
}

// GET - Get quantum backend status
export async function GET() {
  // Try configured URL first, then default localhost
  const qiskitUrl = process.env.QISKIT_BACKEND_URL || 'http://localhost:5001';
  let qiskitAvailable = false;
  let qiskitVersion = null;

  try {
    const response = await fetch(`${qiskitUrl}/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });
    if (response.ok) {
      const data = await response.json();
      qiskitAvailable = true;
      qiskitVersion = data.version?.qiskit || data.version;
    }
  } catch {
    // Qiskit backend not available
  }

  return NextResponse.json({
    backends: {
      'quantum-circuit-js': {
        available: true,
        description: 'Built-in JavaScript quantum simulator',
        maxQubits: 12,
        features: ['state-vector', 'measurement', 'visualization']
      },
      'qiskit': {
        available: qiskitAvailable,
        configured: !!process.env.QISKIT_BACKEND_URL,
        version: qiskitVersion,
        url: qiskitUrl,
        description: 'IBM Qiskit Python quantum framework',
        features: qiskitAvailable
          ? ['state-vector', 'measurement', 'ibm-quantum', 'noise-models', 'real-hardware']
          : []
      }
    },
    supportedGates: [
      'h', 'x', 'y', 'z', 's', 't',
      'rx', 'ry', 'rz',
      'cx', 'cy', 'cz', 'swap',
      'ccx', 'cswap',
      'measure'
    ]
  });
}
