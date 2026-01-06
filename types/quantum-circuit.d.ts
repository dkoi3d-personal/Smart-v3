declare module 'quantum-circuit' {
  export interface QuantumCircuitGateOptions {
    params?: Record<string, string | number>;
  }

  export default class QuantumCircuit {
    constructor(numQubits: number);

    addGate(
      gateName: string,
      column: number,
      qubit: number | number[],
      options?: QuantumCircuitGateOptions
    ): void;

    addMeasure(qubit: number, creg: string, cbit: number): void;

    run(initialValues?: number[]): void;

    probabilities(): number[];

    measureAll(): number[];

    stateAsString(onlyPossible?: boolean): string;

    numQubits: number;
  }
}
