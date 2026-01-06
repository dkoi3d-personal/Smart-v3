// Quantum Circuit Simulator - Client-only wrapper
// This module should only be imported dynamically on the client side

import { getQuantumCircuit } from './quantum-circuit-browser';

export interface QuantumSimulationResult {
  probabilities: number[];
  stateVector: string[];
  measurements: Record<string, number>;
}

export interface QuantumGate {
  id: string;
  gate: string;
  qubit: number;
  column: number;
  controlQubits?: number[];
  params?: Record<string, number>;
}

export async function runQuantumSimulation(
  numQubits: number,
  gates: QuantumGate[],
  shots: number = 1024
): Promise<QuantumSimulationResult> {
  // Load quantum-circuit from browser bundle
  const QuantumCircuit = await getQuantumCircuit();

  const circuit = new QuantumCircuit(numQubits);

  // Add gates to circuit
  for (const placedGate of gates.sort((a, b) => a.column - b.column)) {
    if (placedGate.gate === 'measure') {
      circuit.addMeasure(placedGate.qubit, 'c', placedGate.qubit);
    } else if (placedGate.gate === 'h') {
      circuit.addGate('h', placedGate.column, placedGate.qubit);
    } else if (placedGate.gate === 'x') {
      circuit.addGate('x', placedGate.column, placedGate.qubit);
    } else if (placedGate.gate === 'y') {
      circuit.addGate('y', placedGate.column, placedGate.qubit);
    } else if (placedGate.gate === 'z') {
      circuit.addGate('z', placedGate.column, placedGate.qubit);
    } else if (placedGate.gate === 's') {
      circuit.addGate('s', placedGate.column, placedGate.qubit);
    } else if (placedGate.gate === 't') {
      circuit.addGate('t', placedGate.column, placedGate.qubit);
    } else if (placedGate.gate === 'rx' || placedGate.gate === 'ry' || placedGate.gate === 'rz') {
      if (placedGate.params?.theta !== undefined) {
        circuit.addGate(placedGate.gate, placedGate.column, placedGate.qubit, {
          params: { theta: placedGate.params.theta.toString() }
        });
      } else {
        circuit.addGate(placedGate.gate, placedGate.column, placedGate.qubit);
      }
    } else if (placedGate.gate === 'cx' || placedGate.gate === 'cy' || placedGate.gate === 'cz' || placedGate.gate === 'swap') {
      if (placedGate.controlQubits && placedGate.controlQubits.length > 0) {
        circuit.addGate(placedGate.gate, placedGate.column, [placedGate.qubit, ...placedGate.controlQubits]);
      }
    } else if (placedGate.gate === 'ccx') {
      if (placedGate.controlQubits && placedGate.controlQubits.length >= 2) {
        circuit.addGate(placedGate.gate, placedGate.column, [placedGate.qubit, ...placedGate.controlQubits]);
      }
    }
  }

  // Run simulation
  circuit.run();

  // Get probabilities
  const probabilities = circuit.probabilities();
  const stateVector: string[] = [];

  for (let i = 0; i < Math.pow(2, numQubits); i++) {
    const binary = i.toString(2).padStart(numQubits, '0');
    const prob = probabilities[i] || 0;
    if (prob > 0.001) {
      stateVector.push(`|${binary}⟩: ${(prob * 100).toFixed(2)}%`);
    }
  }

  // Run multiple shots for measurement statistics
  const measurements: Record<string, number> = {};
  for (let i = 0; i < shots; i++) {
    circuit.run();
    const result = circuit.measureAll();
    const key = result.join('');
    measurements[key] = (measurements[key] || 0) + 1;
  }

  return {
    probabilities,
    stateVector,
    measurements,
  };
}
