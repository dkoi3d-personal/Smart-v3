// Browser-compatible Quantum Circuit wrapper
// Uses the pre-bundled browser version to avoid Node.js fs/path dependencies

let QuantumCircuitClass: any = null;
let loadingPromise: Promise<any> | null = null;

/**
 * Dynamically load the QuantumCircuit class from the browser bundle
 * This avoids the antlr4/fs import issues
 */
export async function getQuantumCircuit(): Promise<any> {
  if (QuantumCircuitClass) {
    return QuantumCircuitClass;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('QuantumCircuit can only be loaded in browser'));
      return;
    }

    // Check if already loaded globally
    if ((window as any).QuantumCircuit) {
      QuantumCircuitClass = (window as any).QuantumCircuit;
      resolve(QuantumCircuitClass);
      return;
    }

    // Load the script dynamically
    const script = document.createElement('script');
    script.src = '/quantum-circuit.min.js';
    script.async = true;

    script.onload = () => {
      QuantumCircuitClass = (window as any).QuantumCircuit;
      if (QuantumCircuitClass) {
        resolve(QuantumCircuitClass);
      } else {
        reject(new Error('QuantumCircuit not found after script load'));
      }
    };

    script.onerror = () => {
      reject(new Error('Failed to load quantum-circuit script'));
    };

    document.head.appendChild(script);
  });

  return loadingPromise;
}

/**
 * Create a new quantum circuit instance
 */
export async function createCircuit(numQubits: number): Promise<any> {
  const QC = await getQuantumCircuit();
  return new QC(numQubits);
}
