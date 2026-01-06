# Qiskit Backend for Ochsner AI Studio Quantum Lab

This Python Flask server provides a REST API for running quantum circuits using IBM's Qiskit framework.

## Quick Start

### Option 1: Local Python Environment

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run server
python server.py
```

### Option 2: Docker

```bash
# Build image
docker build -t qiskit-backend .

# Run container
docker run -p 5001:5001 qiskit-backend

# With IBM Quantum token (for real hardware)
docker run -p 5001:5001 -e IBM_QUANTUM_TOKEN=your_token qiskit-backend
```

## Configuration

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `PORT` | Server port | 5001 |
| `IBM_QUANTUM_TOKEN` | IBM Quantum API token for real hardware | None |
| `QISKIT_DEBUG` | Enable debug logging | false |

## Connecting to Ochsner AI Studio

Add to your `.env` file:

```
QISKIT_BACKEND_URL=http://localhost:5001
```

## API Endpoints

### GET /status
Get server status and Qiskit version.

```bash
curl http://localhost:5001/status
```

### POST /run
Run a quantum circuit.

```bash
curl -X POST http://localhost:5001/run \
  -H "Content-Type: application/json" \
  -d '{
    "numQubits": 2,
    "gates": [
      {"gate": "h", "qubit": 0},
      {"gate": "cx", "qubit": 0, "targetQubit": 1}
    ],
    "shots": 1024
  }'
```

### GET /jobs
List recent jobs.

```bash
curl http://localhost:5001/jobs?limit=10
```

### POST /qasm
Parse and run OpenQASM code.

```bash
curl -X POST http://localhost:5001/qasm \
  -H "Content-Type: application/json" \
  -d '{
    "qasm": "OPENQASM 2.0;\ninclude \"qelib1.inc\";\nqreg q[2];\ncreg c[2];\nh q[0];\ncx q[0],q[1];\nmeasure q -> c;",
    "shots": 1024
  }'
```

## Supported Gates

| Gate | Description | Parameters |
|------|-------------|------------|
| `h` | Hadamard | qubit |
| `x`, `y`, `z` | Pauli gates | qubit |
| `s`, `t` | Phase gates | qubit |
| `rx`, `ry`, `rz` | Rotation gates | qubit, angle |
| `cx`, `cy`, `cz` | Controlled gates | control, target |
| `swap` | Swap gate | qubit1, qubit2 |
| `ccx` | Toffoli (CCNOT) | control1, control2, target |
| `cswap` | Fredkin | control, swap1, swap2 |
| `measure` | Measurement | qubit |

## IBM Quantum Integration

To run circuits on real IBM Quantum hardware:

1. Create an account at [IBM Quantum](https://quantum.ibm.com/)
2. Get your API token from your account settings
3. Set the `IBM_QUANTUM_TOKEN` environment variable
4. The backend will automatically use IBM Quantum when available

## Example Circuit: Bell State

```python
# Creates an entangled Bell state |00⟩ + |11⟩
{
  "numQubits": 2,
  "gates": [
    {"gate": "h", "qubit": 0},
    {"gate": "cx", "qubit": 0, "targetQubit": 1}
  ],
  "shots": 1024
}
```

Expected output: ~50% |00⟩, ~50% |11⟩
