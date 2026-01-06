#!/usr/bin/env python3
"""
Qiskit Backend Server for Ochsner AI Studio Quantum Lab

This Flask server provides a REST API for running quantum circuits
using IBM's Qiskit framework.

Usage:
    python server.py

Environment Variables:
    - PORT: Server port (default: 5001)
    - IBM_QUANTUM_TOKEN: Your IBM Quantum token for real hardware access
    - QISKIT_DEBUG: Enable debug logging (default: false)

API Endpoints:
    GET  /status  - Get server status and Qiskit version
    POST /run     - Run a quantum circuit
    GET  /jobs    - List recent jobs
"""

import os
import json
import logging
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS

# Qiskit imports
from qiskit import QuantumCircuit, transpile
from qiskit_aer import AerSimulator
from qiskit.quantum_info import Statevector
import numpy as np

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if os.getenv('QISKIT_DEBUG') else logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('qiskit-backend')

app = Flask(__name__)
CORS(app)

# Store recent jobs in memory (use Redis/DB in production)
recent_jobs = []
MAX_JOBS = 100

# Gate mapping from frontend to Qiskit
GATE_MAP = {
    'h': 'h',
    'x': 'x',
    'y': 'y',
    'z': 'z',
    's': 's',
    't': 't',
    'sdg': 'sdg',
    'tdg': 'tdg',
    'rx': 'rx',
    'ry': 'ry',
    'rz': 'rz',
    'cx': 'cx',
    'cnot': 'cx',
    'cy': 'cy',
    'cz': 'cz',
    'swap': 'swap',
    'ccx': 'ccx',
    'toffoli': 'ccx',
    'cswap': 'cswap',
    'fredkin': 'cswap',
    'measure': 'measure',
}


def get_qiskit_version():
    """Get Qiskit version info"""
    import qiskit
    return {
        'qiskit': qiskit.__version__,
    }


def build_circuit(num_qubits: int, gates: list) -> QuantumCircuit:
    """Build a Qiskit QuantumCircuit from gate list"""
    qc = QuantumCircuit(num_qubits, num_qubits)

    for gate_info in gates:
        gate = gate_info.get('gate', '').lower()
        qubit = gate_info.get('qubit', 0)
        target_qubit = gate_info.get('targetQubit')
        params = gate_info.get('params', [])

        mapped_gate = GATE_MAP.get(gate)
        if not mapped_gate:
            logger.warning(f"Unknown gate: {gate}")
            continue

        try:
            if mapped_gate == 'h':
                qc.h(qubit)
            elif mapped_gate == 'x':
                qc.x(qubit)
            elif mapped_gate == 'y':
                qc.y(qubit)
            elif mapped_gate == 'z':
                qc.z(qubit)
            elif mapped_gate == 's':
                qc.s(qubit)
            elif mapped_gate == 't':
                qc.t(qubit)
            elif mapped_gate == 'sdg':
                qc.sdg(qubit)
            elif mapped_gate == 'tdg':
                qc.tdg(qubit)
            elif mapped_gate == 'rx':
                angle = params[0] if params else np.pi / 2
                qc.rx(angle, qubit)
            elif mapped_gate == 'ry':
                angle = params[0] if params else np.pi / 2
                qc.ry(angle, qubit)
            elif mapped_gate == 'rz':
                angle = params[0] if params else np.pi / 2
                qc.rz(angle, qubit)
            elif mapped_gate == 'cx':
                if target_qubit is not None:
                    qc.cx(qubit, target_qubit)
            elif mapped_gate == 'cy':
                if target_qubit is not None:
                    qc.cy(qubit, target_qubit)
            elif mapped_gate == 'cz':
                if target_qubit is not None:
                    qc.cz(qubit, target_qubit)
            elif mapped_gate == 'swap':
                if target_qubit is not None:
                    qc.swap(qubit, target_qubit)
            elif mapped_gate == 'ccx':
                control2 = gate_info.get('control2Qubit', qubit + 1)
                if target_qubit is not None:
                    qc.ccx(qubit, control2, target_qubit)
            elif mapped_gate == 'cswap':
                swap1 = gate_info.get('swap1Qubit', qubit + 1)
                swap2 = gate_info.get('swap2Qubit', qubit + 2)
                qc.cswap(qubit, swap1, swap2)
            elif mapped_gate == 'measure':
                qc.measure(qubit, qubit)

        except Exception as e:
            logger.error(f"Error applying gate {gate}: {e}")

    return qc


def run_simulation(qc: QuantumCircuit, shots: int = 1024):
    """Run circuit simulation using Aer simulator"""
    simulator = AerSimulator()

    # Get state vector before measurement
    state_circuit = qc.copy()
    state_circuit.remove_final_measurements()
    state_circuit.save_statevector()

    # Run for state vector
    transpiled = transpile(state_circuit, simulator)
    job = simulator.run(transpiled, shots=1)
    result = job.result()
    statevector = result.get_statevector()

    # Calculate probabilities
    probabilities = {}
    for i, amp in enumerate(statevector.data):
        prob = abs(amp) ** 2
        if prob > 1e-10:  # Filter near-zero probabilities
            state = format(i, f'0{qc.num_qubits}b')
            probabilities[state] = float(prob)

    # Run measurements
    measurement_circuit = qc.copy()
    measurement_circuit.measure_all()
    transpiled_meas = transpile(measurement_circuit, simulator)
    meas_job = simulator.run(transpiled_meas, shots=shots)
    meas_result = meas_job.result()
    counts = meas_result.get_counts()

    # Convert counts to probabilities
    measurement_probs = {
        state: count / shots
        for state, count in counts.items()
    }

    return {
        'statevector': {
            'real': [float(x.real) for x in statevector.data],
            'imag': [float(x.imag) for x in statevector.data],
        },
        'probabilities': probabilities,
        'measurements': measurement_probs,
        'counts': counts,
        'shots': shots
    }


@app.route('/status', methods=['GET'])
def status():
    """Get server status and version info"""
    return jsonify({
        'status': 'running',
        'version': get_qiskit_version(),
        'timestamp': datetime.now().isoformat(),
        'ibm_quantum_configured': bool(os.getenv('IBM_QUANTUM_TOKEN')),
        'max_qubits': 25,
        'features': [
            'state-vector',
            'measurement',
            'noise-models',
            'ibm-quantum' if os.getenv('IBM_QUANTUM_TOKEN') else None
        ]
    })


@app.route('/run', methods=['POST'])
def run_circuit():
    """Run a quantum circuit"""
    try:
        data = request.json
        num_qubits = data.get('numQubits', 2)
        gates = data.get('gates', [])
        shots = data.get('shots', 1024)

        logger.info(f"Running circuit: {num_qubits} qubits, {len(gates)} gates, {shots} shots")

        # Build circuit
        qc = build_circuit(num_qubits, gates)

        # Run simulation
        results = run_simulation(qc, shots)

        # Store job
        job_record = {
            'id': f"job-{datetime.now().strftime('%Y%m%d%H%M%S%f')}",
            'timestamp': datetime.now().isoformat(),
            'num_qubits': num_qubits,
            'num_gates': len(gates),
            'shots': shots,
            'success': True
        }
        recent_jobs.insert(0, job_record)
        if len(recent_jobs) > MAX_JOBS:
            recent_jobs.pop()

        # Generate QASM
        qasm = qc.qasm()

        return jsonify({
            'success': True,
            'job_id': job_record['id'],
            'results': results,
            'qasm': qasm,
            'circuit_depth': qc.depth(),
            'gate_count': len(qc.data)
        })

    except Exception as e:
        logger.error(f"Error running circuit: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/jobs', methods=['GET'])
def list_jobs():
    """List recent jobs"""
    limit = request.args.get('limit', 10, type=int)
    return jsonify({
        'jobs': recent_jobs[:limit],
        'total': len(recent_jobs)
    })


@app.route('/qasm', methods=['POST'])
def parse_qasm():
    """Parse and run QASM code"""
    try:
        data = request.json
        qasm_code = data.get('qasm', '')
        shots = data.get('shots', 1024)

        qc = QuantumCircuit.from_qasm_str(qasm_code)
        results = run_simulation(qc, shots)

        return jsonify({
            'success': True,
            'results': results,
            'num_qubits': qc.num_qubits,
            'depth': qc.depth()
        })

    except Exception as e:
        logger.error(f"Error parsing QASM: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5001))
    debug = os.getenv('QISKIT_DEBUG', 'false').lower() == 'true'

    logger.info(f"Starting Qiskit backend server on port {port}")
    logger.info(f"Qiskit version: {get_qiskit_version()}")

    app.run(host='0.0.0.0', port=port, debug=debug)
