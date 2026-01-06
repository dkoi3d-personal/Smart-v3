// Simple Quantum Circuit Simulator
// A pure JavaScript implementation that doesn't require Node.js dependencies

type Complex = { re: number; im: number };

function complexMul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

function complexAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

function complexScale(a: Complex, s: number): Complex {
  return { re: a.re * s, im: a.im * s };
}

function complexMag2(a: Complex): number {
  return a.re * a.re + a.im * a.im;
}

// Standard quantum gates as 2x2 matrices
const GATES: Record<string, Complex[][]> = {
  h: [
    [{ re: 1 / Math.SQRT2, im: 0 }, { re: 1 / Math.SQRT2, im: 0 }],
    [{ re: 1 / Math.SQRT2, im: 0 }, { re: -1 / Math.SQRT2, im: 0 }],
  ],
  x: [
    [{ re: 0, im: 0 }, { re: 1, im: 0 }],
    [{ re: 1, im: 0 }, { re: 0, im: 0 }],
  ],
  y: [
    [{ re: 0, im: 0 }, { re: 0, im: -1 }],
    [{ re: 0, im: 1 }, { re: 0, im: 0 }],
  ],
  z: [
    [{ re: 1, im: 0 }, { re: 0, im: 0 }],
    [{ re: 0, im: 0 }, { re: -1, im: 0 }],
  ],
  s: [
    [{ re: 1, im: 0 }, { re: 0, im: 0 }],
    [{ re: 0, im: 0 }, { re: 0, im: 1 }],
  ],
  t: [
    [{ re: 1, im: 0 }, { re: 0, im: 0 }],
    [{ re: 0, im: 0 }, { re: Math.cos(Math.PI / 4), im: Math.sin(Math.PI / 4) }],
  ],
};

function getRxGate(theta: number): Complex[][] {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  return [
    [{ re: c, im: 0 }, { re: 0, im: -s }],
    [{ re: 0, im: -s }, { re: c, im: 0 }],
  ];
}

function getRyGate(theta: number): Complex[][] {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  return [
    [{ re: c, im: 0 }, { re: -s, im: 0 }],
    [{ re: s, im: 0 }, { re: c, im: 0 }],
  ];
}

function getRzGate(theta: number): Complex[][] {
  return [
    [{ re: Math.cos(theta / 2), im: -Math.sin(theta / 2) }, { re: 0, im: 0 }],
    [{ re: 0, im: 0 }, { re: Math.cos(theta / 2), im: Math.sin(theta / 2) }],
  ];
}

export interface QuantumGate {
  gate: string;
  qubit: number;
  controlQubits?: number[];
  params?: { theta?: number };
}

export interface SimulationResult {
  probabilities: number[];
  stateVector: string[];
  measurements: Record<string, number>;
}

export class SimpleQuantumCircuit {
  private numQubits: number;
  private stateVector: Complex[];

  constructor(numQubits: number) {
    this.numQubits = numQubits;
    const numStates = Math.pow(2, numQubits);
    this.stateVector = new Array(numStates).fill(null).map((_, i) =>
      i === 0 ? { re: 1, im: 0 } : { re: 0, im: 0 }
    );
  }

  // Apply single-qubit gate
  private applySingleGate(gate: Complex[][], targetQubit: number) {
    const numStates = this.stateVector.length;
    const newState: Complex[] = new Array(numStates).fill(null).map(() => ({ re: 0, im: 0 }));

    for (let i = 0; i < numStates; i++) {
      // Get the bit value at target qubit position
      const bit = (i >> targetQubit) & 1;
      // Get the state index with bit flipped
      const flippedIdx = i ^ (1 << targetQubit);

      // Determine which indices we're working with
      const idx0 = bit === 0 ? i : flippedIdx;
      const idx1 = bit === 0 ? flippedIdx : i;

      if (bit === 0) {
        // Only process each pair once
        const a0 = this.stateVector[idx0];
        const a1 = this.stateVector[idx1];

        // Apply gate matrix
        newState[idx0] = complexAdd(
          complexMul(gate[0][0], a0),
          complexMul(gate[0][1], a1)
        );
        newState[idx1] = complexAdd(
          complexMul(gate[1][0], a0),
          complexMul(gate[1][1], a1)
        );
      }
    }

    this.stateVector = newState;
  }

  // Apply CNOT gate (control, target)
  private applyCNOT(controlQubit: number, targetQubit: number) {
    const numStates = this.stateVector.length;
    const newState = [...this.stateVector];

    for (let i = 0; i < numStates; i++) {
      const controlBit = (i >> controlQubit) & 1;
      if (controlBit === 1) {
        const flippedIdx = i ^ (1 << targetQubit);
        // Swap amplitudes
        const temp = newState[i];
        newState[i] = newState[flippedIdx];
        newState[flippedIdx] = temp;
      }
    }

    this.stateVector = newState;
  }

  // Apply CZ gate
  private applyCZ(controlQubit: number, targetQubit: number) {
    const numStates = this.stateVector.length;

    for (let i = 0; i < numStates; i++) {
      const controlBit = (i >> controlQubit) & 1;
      const targetBit = (i >> targetQubit) & 1;
      if (controlBit === 1 && targetBit === 1) {
        // Apply phase flip
        this.stateVector[i] = complexScale(this.stateVector[i], -1);
      }
    }
  }

  // Apply SWAP gate
  private applySWAP(qubit1: number, qubit2: number) {
    const numStates = this.stateVector.length;
    const newState = [...this.stateVector];

    for (let i = 0; i < numStates; i++) {
      const bit1 = (i >> qubit1) & 1;
      const bit2 = (i >> qubit2) & 1;
      if (bit1 !== bit2) {
        const swappedIdx = i ^ (1 << qubit1) ^ (1 << qubit2);
        if (i < swappedIdx) {
          const temp = newState[i];
          newState[i] = newState[swappedIdx];
          newState[swappedIdx] = temp;
        }
      }
    }

    this.stateVector = newState;
  }

  // Apply Toffoli (CCX) gate
  private applyCCX(control1: number, control2: number, target: number) {
    const numStates = this.stateVector.length;
    const newState = [...this.stateVector];

    for (let i = 0; i < numStates; i++) {
      const c1 = (i >> control1) & 1;
      const c2 = (i >> control2) & 1;
      if (c1 === 1 && c2 === 1) {
        const flippedIdx = i ^ (1 << target);
        const temp = newState[i];
        newState[i] = newState[flippedIdx];
        newState[flippedIdx] = temp;
      }
    }

    this.stateVector = newState;
  }

  addGate(gateName: string, qubit: number, controlQubits?: number[], params?: { theta?: number }) {
    const gate = gateName.toLowerCase();

    // Single qubit gates
    if (gate === 'h' || gate === 'x' || gate === 'y' || gate === 'z' || gate === 's' || gate === 't') {
      this.applySingleGate(GATES[gate], qubit);
    } else if (gate === 'rx') {
      this.applySingleGate(getRxGate(params?.theta || Math.PI / 2), qubit);
    } else if (gate === 'ry') {
      this.applySingleGate(getRyGate(params?.theta || Math.PI / 2), qubit);
    } else if (gate === 'rz') {
      this.applySingleGate(getRzGate(params?.theta || Math.PI / 2), qubit);
    }
    // Two qubit gates
    else if ((gate === 'cx' || gate === 'cnot') && controlQubits && controlQubits.length >= 1) {
      this.applyCNOT(qubit, controlQubits[0]);
    } else if (gate === 'cz' && controlQubits && controlQubits.length >= 1) {
      this.applyCZ(qubit, controlQubits[0]);
    } else if (gate === 'swap' && controlQubits && controlQubits.length >= 1) {
      this.applySWAP(qubit, controlQubits[0]);
    }
    // Three qubit gates
    else if ((gate === 'ccx' || gate === 'toffoli') && controlQubits && controlQubits.length >= 2) {
      this.applyCCX(qubit, controlQubits[0], controlQubits[1]);
    }
  }

  getProbabilities(): number[] {
    return this.stateVector.map(complexMag2);
  }

  measure(): number[] {
    const probs = this.getProbabilities();
    const rand = Math.random();
    let cumProb = 0;

    for (let i = 0; i < probs.length; i++) {
      cumProb += probs[i];
      if (rand < cumProb) {
        // Convert index to bit array
        const bits: number[] = [];
        for (let q = 0; q < this.numQubits; q++) {
          bits.push((i >> q) & 1);
        }
        return bits;
      }
    }

    // Fallback
    return new Array(this.numQubits).fill(0);
  }

  run(): SimulationResult {
    const probabilities = this.getProbabilities();
    const stateVector: string[] = [];

    for (let i = 0; i < probabilities.length; i++) {
      if (probabilities[i] > 0.001) {
        const binary = i.toString(2).padStart(this.numQubits, '0');
        stateVector.push(`|${binary}⟩: ${(probabilities[i] * 100).toFixed(2)}%`);
      }
    }

    return {
      probabilities,
      stateVector,
      measurements: {},
    };
  }

  runWithMeasurements(shots: number): SimulationResult {
    const result = this.run();
    const measurements: Record<string, number> = {};

    for (let i = 0; i < shots; i++) {
      const bits = this.measure();
      const key = bits.reverse().join('');
      measurements[key] = (measurements[key] || 0) + 1;
    }

    return {
      ...result,
      measurements,
    };
  }
}
