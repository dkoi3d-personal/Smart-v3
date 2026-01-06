'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Atom, Sparkles, Zap, Lock, Key, ChevronRight, RotateCcw, CheckCircle2, BookOpen, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface QuantumParticlesProps {
  onEntanglementAchieved?: () => void;
}

interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  isSpecial?: 'alice' | 'bob';
  label?: string;
}

const COLORS = [
  '#f472b6', '#fb923c', '#facc15', '#4ade80',
  '#22d3ee', '#818cf8', '#e879f9', '#f87171',
];

// Generate a fake "encrypted" version for display (SHA-256 style hex string)
const generateFakeEncryption = (pin: string) => {
  const chars = '0123456789abcdef';
  let hash = '';

  // Use a simple but effective hash-like function
  // Initialize with pin-derived seed
  let h1 = 0x9e3779b9;
  let h2 = 0x85ebca6b;

  // Mix in each digit
  for (let i = 0; i < pin.length; i++) {
    const digit = parseInt(pin[i]);
    h1 = ((h1 ^ digit) * 0x01000193) >>> 0;
    h2 = ((h2 ^ (digit + i)) * 0x01000193) >>> 0;
  }

  // Generate 64 hex characters
  for (let i = 0; i < 64; i++) {
    // Mix the hashes for each character
    h1 = ((h1 * 1664525 + 1013904223) ^ h2) >>> 0;
    h2 = ((h2 * 22695477 + 1) ^ h1) >>> 0;
    // Use upper bits which have better distribution
    hash += chars[(h1 >>> 28) & 0xf];
  }

  return hash;
};

// Generate a random 4-digit PIN (each digit 0-9)
// Note: This is called inside useState, so it runs client-side after hydration
const generateRandomPin = () => {
  // Use crypto.getRandomValues for true randomness in browser
  if (typeof window !== 'undefined' && window.crypto) {
    const array = new Uint8Array(4);
    window.crypto.getRandomValues(array);
    return Array.from(array, (byte) => (byte % 10).toString()).join('');
  }
  // Fallback: use current timestamp to seed randomness
  const seed = Date.now();
  return Array.from({ length: 4 }, (_, i) => {
    const val = Math.floor(((seed * (i + 1) * 9301 + 49297) % 233280) / 23328 * 10);
    return val.toString();
  }).join('');
};

// Learning resources before the challenge
const LEARNING_LINKS = [
  {
    id: 'intro-video',
    title: 'Intro to Quantum Mechanics',
    description: 'Watch this excellent video introduction first',
    url: 'https://www.youtube.com/watch?v=uexPZ8bKRT0',
    icon: '🎬',
    required: true,
    isVideo: true,
  },
  {
    id: 'grover',
    title: "Grover's Algorithm",
    description: 'Learn about the exact algorithm you will build',
    url: 'https://learning.quantum.ibm.com/course/fundamentals-of-quantum-algorithms/grovers-algorithm',
    icon: '🔍',
    required: true,
  },
  {
    id: 'qiskit',
    title: 'IBM Qiskit Basics',
    description: 'Understand quantum gates and circuits',
    url: 'https://learning.quantum.ibm.com/course/basics-of-quantum-information',
    icon: '💻',
    required: true,
  },
  {
    id: 'quantum-country',
    title: 'Quantum Country',
    description: 'Interactive introduction to quantum computing',
    url: 'https://quantum.country/',
    icon: '🌍',
    required: true,
  },
];

interface CircuitStep {
  id: string;
  title: string;
  instruction: string;
  gate: string;
  gateDisplay: string;
  description: string;
  qubits: number[];
  color: string;
  control?: number;
  target?: number;
}

// Circuit building steps - more complex with varied gates
const CIRCUIT_STEPS: CircuitStep[] = [
  {
    id: 'superposition',
    title: 'Initialize Superposition',
    instruction: 'Apply Hadamard gate to q0 to create equal superposition',
    gate: 'H',
    gateDisplay: 'H',
    description: 'H|0⟩ = (|0⟩ + |1⟩)/√2 - creates quantum parallelism',
    qubits: [0],
    color: 'purple',
  },
  {
    id: 'entangle1',
    title: 'Create Entanglement',
    instruction: 'Apply CNOT: q0 controls q1 to entangle qubits',
    gate: 'CX',
    gateDisplay: 'CX',
    description: 'CNOT creates Bell pair: |00⟩ + |11⟩',
    qubits: [0, 1],
    control: 0,
    target: 1,
    color: 'blue',
  },
  {
    id: 'rotation',
    title: 'Phase Rotation',
    instruction: 'Apply Rz(π/4) rotation to q1 for phase encoding',
    gate: 'Rz',
    gateDisplay: 'Rz',
    description: 'Rz(θ) rotates around Z-axis by π/4 radians',
    qubits: [1],
    color: 'cyan',
  },
  {
    id: 'entangle2',
    title: 'Extend Entanglement',
    instruction: 'Apply CNOT: q1 controls q2 to create GHZ state',
    gate: 'CX',
    gateDisplay: 'CX',
    description: 'Extends entanglement to all 3 qubits',
    qubits: [1, 2],
    control: 1,
    target: 2,
    color: 'blue',
  },
  {
    id: 'oracle',
    title: 'Apply Oracle',
    instruction: 'Oracle marks the password state with phase flip',
    gate: 'Uf',
    gateDisplay: 'Uf',
    description: 'Uf|x⟩ = (-1)^f(x)|x⟩ for password match',
    qubits: [0, 1, 2],
    color: 'orange',
  },
  {
    id: 'x-rotation',
    title: 'X-Rotation',
    instruction: 'Apply Rx(π/2) to q0 for amplitude redistribution',
    gate: 'Rx',
    gateDisplay: 'Rx',
    description: 'Rx(π/2) rotates around X-axis',
    qubits: [0],
    color: 'pink',
  },
  {
    id: 'diffusion',
    title: 'Grover Diffusion',
    instruction: 'Apply diffusion operator: 2|ψ⟩⟨ψ| - I',
    gate: 'D',
    gateDisplay: 'D',
    description: 'Amplifies marked state probability',
    qubits: [0, 1, 2],
    color: 'green',
  },
  {
    id: 'measure',
    title: 'Measure Result',
    instruction: 'Collapse superposition to reveal password',
    gate: 'M',
    gateDisplay: 'M',
    description: 'Quantum measurement collapses to |101⟩',
    qubits: [0, 1, 2],
    color: 'yellow',
  },
];

export function QuantumParticles({ onEntanglementAchieved }: QuantumParticlesProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const particlesRef = useRef<Particle[]>([]);

  const [particles, setParticles] = useState<Particle[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [hovering, setHovering] = useState<string | null>(null);
  const [entangled, setEntangled] = useState(false);
  const [showExplosion, setShowExplosion] = useState(false);
  const [showQuantumChallenge, setShowQuantumChallenge] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);
  const [connectionStrength, setConnectionStrength] = useState(0);
  const [explosionParticles, setExplosionParticles] = useState<Array<{x: number; y: number; vx: number; vy: number; color: string; size: number; life: number}>>([]);

  // The secret PIN - generated randomly when component mounts (client-side only)
  const [secretPin, setSecretPin] = useState('0000'); // Default, will be replaced on client
  const [isClient, setIsClient] = useState(false);

  // Generate the PIN on client-side only to ensure true randomness
  useEffect(() => {
    const newPin = generateRandomPin();
    console.log('🔐 Generated secret PIN:', newPin); // Debug log
    setSecretPin(newPin);
    setIsClient(true);
  }, []);

  // Memoize the encrypted display - updates when PIN changes
  const encryptedPin = useMemo(() => generateFakeEncryption(secretPin), [secretPin]);

  // Learning phase state
  const [showLearningPhase, setShowLearningPhase] = useState(true);
  const [visitedLinks, setVisitedLinks] = useState<string[]>([]);

  // Quantum challenge state
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [circuitGates, setCircuitGates] = useState<Array<{gate: string; qubits: number[]; control?: number; target?: number; color?: string}>>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [revealedDigits, setRevealedDigits] = useState<string[]>([]);
  const [pinCracked, setPinCracked] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState('');
  const [quantumResults, setQuantumResults] = useState<{
    probability: number;
    measurements: Record<string, number>;
    topStates: { state: string; probability: number }[];
  } | null>(null);
  const [currentDigitIndex, setCurrentDigitIndex] = useState(0);

  // PIN entry state (after cracking)
  const [showPinEntry, setShowPinEntry] = useState(false);
  const [pinInput, setPinInput] = useState(['', '', '', '']);
  const [pinError, setPinError] = useState(false);
  const pinInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const triggerEntanglementRef = useRef<(() => void) | undefined>(undefined);

  // Initialize particles
  useEffect(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const allParticles: Particle[] = [];

    for (let i = 0; i < 12; i++) {
      allParticles.push({
        id: `particle-${i}`,
        x: Math.random() * (width - 100) + 50,
        y: Math.random() * (height - 100) + 50,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 6 + Math.random() * 4,
      });
    }

    allParticles.push({
      id: 'alice',
      x: width * 0.2 + Math.random() * width * 0.1,
      y: height * 0.3 + Math.random() * height * 0.2,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      color: '#a855f7',
      size: 10,
      isSpecial: 'alice',
      label: 'Alice',
    });

    allParticles.push({
      id: 'bob',
      x: width * 0.7 + Math.random() * width * 0.1,
      y: height * 0.3 + Math.random() * height * 0.2,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      color: '#06b6d4',
      size: 10,
      isSpecial: 'bob',
      label: 'Bob',
    });

    setParticles(allParticles);
    particlesRef.current = allParticles;

    (window as any).entanglement = () => {
      triggerEntanglementRef.current?.();
    };

    return () => {
      delete (window as any).entanglement;
    };
  }, []);

  const createExplosion = useCallback((x: number, y: number) => {
    const newParticles = [];
    for (let i = 0; i < 40; i++) {
      const angle = (Math.PI * 2 * i) / 40 + Math.random() * 0.3;
      const speed = 4 + Math.random() * 8;
      newParticles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: Math.random() > 0.5 ? '#a855f7' : '#06b6d4',
        size: 2 + Math.random() * 4,
        life: 1,
      });
    }
    setExplosionParticles(newParticles);
  }, []);

  const triggerEntanglement = useCallback(() => {
    if (entangled || showQuantumChallenge) return;

    const alice = particlesRef.current.find(p => p.isSpecial === 'alice');
    const bob = particlesRef.current.find(p => p.isSpecial === 'bob');
    if (!alice || !bob) return;

    setEntangled(true);
    setConnectionStrength(100);
    setShowExplosion(true);

    const midX = (alice.x + bob.x) / 2;
    const midY = (alice.y + bob.y) / 2;
    createExplosion(midX, midY);

    setTimeout(() => {
      setShowExplosion(false);
      setShowQuantumChallenge(true);
    }, 1200);
  }, [entangled, showQuantumChallenge, createExplosion]);

  useEffect(() => {
    triggerEntanglementRef.current = triggerEntanglement;
  }, [triggerEntanglement]);

  // Handle visiting a learning link
  const handleLinkVisit = (linkId: string) => {
    if (!visitedLinks.includes(linkId)) {
      setVisitedLinks(prev => [...prev, linkId]);
    }
  };

  // Check if all required links have been visited
  const allLinksVisited = LEARNING_LINKS.filter(l => l.required).every(l => visitedLinks.includes(l.id));

  // Apply a gate in the circuit challenge
  const applyGate = () => {
    if (currentStep >= CIRCUIT_STEPS.length) return;

    const step = CIRCUIT_STEPS[currentStep];
    setCircuitGates(prev => [...prev, {
      gate: step.gate,
      qubits: step.qubits,
      control: step.control,
      target: step.target,
      color: step.color,
    }]);
    setCompletedSteps(prev => [...prev, step.id]);
    setCurrentStep(prev => prev + 1);
  };

  // Run the circuit simulation with REAL Grover's algorithm
  const runCircuit = async () => {
    if (completedSteps.length < CIRCUIT_STEPS.length) return;

    setIsRunning(true);
    setSimulationProgress('Loading quantum simulator...');

    try {
      // Dynamically import the Grover search module
      const { runSimplifiedGrover } = await import('@/lib/grover-search');

      // Run Grover's algorithm digit by digit
      const foundDigits: string[] = [];

      for (let d = 0; d < secretPin.length; d++) {
        setCurrentDigitIndex(d);
        setSimulationProgress(`Searching for digit ${d + 1} of ${secretPin.length}...`);

        const targetDigit = parseInt(secretPin[d]);

        // Run real Grover's search for this digit
        const result = await runSimplifiedGrover(targetDigit, (step, progress) => {
          setSimulationProgress(`Digit ${d + 1}: ${step}`);
        });

        // Store the quantum results for display
        setQuantumResults({
          probability: result.probability,
          measurements: result.measurementCounts,
          topStates: result.allProbabilities.slice(0, 5)
        });

        // Reveal the found digit
        const foundDigit = result.foundValue.toString();
        foundDigits.push(foundDigit);
        setRevealedDigits([...foundDigits]);

        // Small pause between digits
        await new Promise(r => setTimeout(r, 600));
      }

      setSimulationProgress('Quantum search complete!');
      await new Promise(r => setTimeout(r, 500));

      // Check if we found the correct PIN
      const foundPin = foundDigits.join('');
      const success = foundPin === secretPin;
      setPinCracked(success);

      if (success) {
        // Show PIN entry screen after a brief delay
        setTimeout(() => {
          setShowQuantumChallenge(false);
          setShowPinEntry(true);
          // Focus the first input after modal appears
          setTimeout(() => {
            pinInputRefs.current[0]?.focus();
          }, 100);
        }, 2500);
      }
    } catch (error) {
      console.error('Quantum simulation error:', error);
      setSimulationProgress(`Error: ${error instanceof Error ? error.message : 'Failed to run quantum simulation'}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Reset the challenge
  const resetChallenge = () => {
    setCurrentStep(0);
    setCompletedSteps([]);
    setCircuitGates([]);
    setIsRunning(false);
    setRevealedDigits([]);
    setPinCracked(false);
    setSimulationProgress('');
    setQuantumResults(null);
    setCurrentDigitIndex(0);
  };

  // Proceed from learning to circuit building
  const startChallenge = () => {
    setShowLearningPhase(false);
  };

  // Handle PIN input
  const handlePinInput = (index: number, value: string) => {
    // Only allow single digits
    if (value.length > 1) {
      value = value.slice(-1);
    }
    if (value && !/^\d$/.test(value)) return;

    const newPin = [...pinInput];
    newPin[index] = value;
    setPinInput(newPin);
    setPinError(false);

    // Auto-focus next input
    if (value && index < 3) {
      pinInputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace in PIN input
  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pinInput[index] && index > 0) {
      pinInputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') {
      verifyPin();
    }
  };

  // Verify the entered PIN
  const verifyPin = () => {
    const enteredPin = pinInput.join('');
    if (enteredPin === secretPin) {
      // Success! Show unlock animation
      setShowPinEntry(false);
      setShowUnlock(true);
      onEntanglementAchieved?.();
    } else {
      // Wrong PIN - shake and reset
      setPinError(true);
      setTimeout(() => {
        setPinInput(['', '', '', '']);
        pinInputRefs.current[0]?.focus();
      }, 500);
    }
  };

  // Animation loop
  useEffect(() => {
    if (showQuantumChallenge || showUnlock || showPinEntry) return;

    const animate = () => {
      if (explosionParticles.length > 0) {
        setExplosionParticles(prev =>
          prev.map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.15,
            life: p.life - 0.025,
          })).filter(p => p.life > 0)
        );
      }

      setParticles(prev => {
        const updated = prev.map(p => {
          if (p.id === dragging) return p;
          if (entangled && p.isSpecial) return p;

          let { x, y, vx, vy } = p;
          x += vx;
          y += vy;

          const padding = 30;
          const width = window.innerWidth;
          const height = window.innerHeight;

          if (x < padding) { x = padding; vx = Math.abs(vx); }
          if (x > width - padding) { x = width - padding; vx = -Math.abs(vx); }
          if (y < padding) { y = padding; vy = Math.abs(vy); }
          if (y > height - padding) { y = height - padding; vy = -Math.abs(vy); }

          vx += (Math.random() - 0.5) * 0.02;
          vy += (Math.random() - 0.5) * 0.02;

          const maxV = p.isSpecial ? 0.5 : 0.6;
          vx = Math.max(-maxV, Math.min(maxV, vx));
          vy = Math.max(-maxV, Math.min(maxV, vy));

          return { ...p, x, y, vx, vy };
        });

        particlesRef.current = updated;
        return updated;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [dragging, entangled, explosionParticles, showQuantumChallenge, showUnlock, showPinEntry]);

  // Check entanglement distance
  useEffect(() => {
    if (entangled || particles.length < 2) return;

    const alice = particles.find(p => p.isSpecial === 'alice');
    const bob = particles.find(p => p.isSpecial === 'bob');
    if (!alice || !bob) return;

    const dx = alice.x - bob.x;
    const dy = alice.y - bob.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 150) {
      setConnectionStrength(Math.max(0, (1 - distance / 150) * 100));
    } else {
      setConnectionStrength(0);
    }

    if (distance < 40 && dragging) {
      triggerEntanglement();
    }
  }, [particles, dragging, entangled, triggerEntanglement]);

  // Canvas effects
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    let time = 0;

    const draw = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += 0.016;

      explosionParticles.forEach(p => {
        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
      });

      const ps = particlesRef.current;
      const alice = ps.find(p => p.isSpecial === 'alice');
      const bob = ps.find(p => p.isSpecial === 'bob');

      if (alice && bob && (connectionStrength > 0 || entangled)) {
        const strength = entangled ? 100 : connectionStrength;
        const gradient = ctx.createLinearGradient(alice.x, alice.y, bob.x, bob.y);
        gradient.addColorStop(0, '#a855f7');
        gradient.addColorStop(0.5, '#ffffff');
        gradient.addColorStop(1, '#06b6d4');

        ctx.beginPath();
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1 + (strength / 40);
        ctx.globalAlpha = (strength / 100) * 0.7;

        const steps = 30;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const x = alice.x + (bob.x - alice.x) * t;
          const baseY = alice.y + (bob.y - alice.y) * t;
          const wave = Math.sin(t * Math.PI * 4 + time * 5) * (5 * (strength / 100));
          const y = baseY + wave;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [connectionStrength, entangled, explosionParticles]);

  const handleMouseDown = (id: string, e: React.MouseEvent) => {
    if (entangled) return;
    e.stopPropagation();
    setDragging(id);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging && !entangled) {
      setParticles(prev => {
        const updated = prev.map(p =>
          p.id === dragging ? { ...p, x: e.clientX, y: e.clientY, vx: 0, vy: 0 } : p
        );
        particlesRef.current = updated;
        return updated;
      });
    }
  };

  const handleMouseUp = () => setDragging(null);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden pointer-events-none"
      style={{ zIndex: 5 }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Particles */}
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className={`absolute ${particle.isSpecial ? 'pointer-events-auto cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
          style={{
            left: particle.x,
            top: particle.y,
            transform: 'translate(-50%, -50%)',
            zIndex: dragging === particle.id ? 30 : particle.isSpecial ? 15 : 10,
          }}
          onMouseDown={particle.isSpecial ? (e) => handleMouseDown(particle.id, e) : undefined}
          onMouseEnter={particle.isSpecial ? () => setHovering(particle.id) : undefined}
          onMouseLeave={particle.isSpecial ? () => setHovering(null) : undefined}
          animate={entangled && particle.isSpecial ? { scale: [1, 1.4, 1] } : {}}
          transition={entangled && particle.isSpecial ? { duration: 0.5, repeat: Infinity } : {}}
        >
          <div
            className="absolute rounded-full blur-md transition-all duration-300"
            style={{
              width: particle.size * 3,
              height: particle.size * 3,
              left: -particle.size,
              top: -particle.size,
              background: particle.color,
              opacity: (hovering === particle.id || dragging === particle.id) ? 0.6 : particle.isSpecial ? 0.3 : 0.15,
            }}
          />
          <motion.div
            className="rounded-full"
            style={{
              width: particle.size,
              height: particle.size,
              background: `radial-gradient(circle at 30% 30%, ${particle.color}, ${particle.color}88)`,
              boxShadow: `0 0 ${particle.isSpecial ? 12 : 6}px ${particle.color}60`,
            }}
            whileHover={particle.isSpecial ? { scale: 1.3 } : {}}
          />
          <AnimatePresence>
            {particle.isSpecial && (hovering === particle.id || dragging === particle.id) && !entangled && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap"
                style={{ top: particle.size + 6 }}
              >
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm" style={{ color: particle.color }}>
                  {particle.label}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}

      {/* Connection indicator */}
      <AnimatePresence>
        {connectionStrength > 40 && !entangled && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 pointer-events-none"
          >
            <div className="bg-black/50 backdrop-blur-sm rounded-full px-4 py-2 border border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-gradient-to-r from-purple-500 to-cyan-500" style={{ width: `${connectionStrength}%` }} />
                </div>
                <span className="text-[10px] text-white/50 font-mono">
                  {connectionStrength > 75 ? 'entangling...' : 'closer...'}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Explosion flash */}
      <AnimatePresence>
        {showExplosion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-white pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Quantum Password Challenge */}
      <AnimatePresence>
        {showQuantumChallenge && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center pointer-events-auto z-50"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="relative z-10 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 border border-purple-500/30 rounded-2xl p-6 shadow-2xl">

                {/* LEARNING PHASE */}
                {showLearningPhase ? (
                  <>
                    {/* Header */}
                    <div className="text-center mb-6">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center border border-purple-500/30"
                      >
                        <BookOpen className="w-8 h-8 text-purple-400" />
                      </motion.div>

                      <h2 className="text-xl font-bold text-white mb-1">Prepare for Quantum Computing</h2>
                      <p className="text-white/50 text-sm">
                        Read these resources to learn how to build a quantum PIN cracker
                      </p>
                    </div>

                    {/* The Challenge Preview */}
                    <div className="mb-6 p-4 bg-black/40 rounded-xl border border-red-500/20">
                      <div className="flex items-center gap-2 mb-3">
                        <Lock className="w-4 h-4 text-red-400" />
                        <span className="text-xs text-white/60 font-medium">YOUR MISSION</span>
                      </div>
                      <p className="text-sm text-white/70 mb-3">
                        Crack a 4-digit PIN using Grover&apos;s quantum search algorithm.
                        This uses REAL quantum simulation with the quantum-circuit library!
                      </p>
                      <div className="bg-black/30 rounded-lg p-3 border border-white/10">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-white/40 font-mono">ENCRYPTED PIN:</span>
                          <span className="text-[10px] text-cyan-400/60">4 qubits per digit</span>
                        </div>
                        <p className="text-[10px] text-orange-400/80 font-mono break-all">
                          {isClient ? encryptedPin : 'Loading...'}
                        </p>
                      </div>
                    </div>

                    {/* Learning Resources */}
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs text-white/60 font-medium">REQUIRED READING</span>
                        <span className="text-[10px] text-purple-400">({visitedLinks.length}/{LEARNING_LINKS.length} completed)</span>
                      </div>

                      <div className="space-y-3">
                        {LEARNING_LINKS.map((link, i) => (
                          <motion.a
                            key={link.id}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            onClick={() => handleLinkVisit(link.id)}
                            className={`block p-4 rounded-xl border transition-all ${
                              visitedLinks.includes(link.id)
                                ? 'bg-green-500/10 border-green-500/30'
                                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-purple-500/30'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{link.icon}</span>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-medium text-white">{link.title}</h4>
                                  {visitedLinks.includes(link.id) && (
                                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                                  )}
                                </div>
                                <p className="text-xs text-white/50">{link.description}</p>
                              </div>
                              <ExternalLink className="w-4 h-4 text-white/30" />
                            </div>
                          </motion.a>
                        ))}
                      </div>
                    </div>

                    {/* Progress indicator */}
                    <div className="mb-4">
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-purple-500 to-cyan-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${(visitedLinks.length / LEARNING_LINKS.length) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Start Challenge Button */}
                    <Button
                      onClick={startChallenge}
                      disabled={!allLinksVisited}
                      className={`w-full ${
                        allLinksVisited
                          ? 'bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500'
                          : 'bg-white/10 cursor-not-allowed'
                      }`}
                    >
                      {allLinksVisited ? (
                        <>
                          <Zap className="w-4 h-4 mr-2" />
                          Start Building the Circuit
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </>
                      ) : (
                        <>
                          <BookOpen className="w-4 h-4 mr-2" />
                          Read All Resources to Continue
                        </>
                      )}
                    </Button>

                    <p className="text-[10px] text-white/30 text-center mt-4">
                      Click each link to mark it as read. All resources are required before building the circuit.
                    </p>
                  </>
                ) : (
                  /* CIRCUIT BUILDING PHASE */
                  <>
                    {/* Header */}
                    <div className="text-center mb-6">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center border border-red-500/30"
                      >
                        <Lock className="w-8 h-8 text-red-400" />
                      </motion.div>

                      <h2 className="text-xl font-bold text-white mb-1">Quantum Password Cracker</h2>
                      <p className="text-white/50 text-sm">
                        Build Grover&apos;s algorithm step by step
                      </p>
                    </div>

                    {/* The encrypted PIN display */}
                    <div className="mb-6 p-4 bg-black/40 rounded-xl border border-white/10">
                      <div className="mb-3">
                        <span className="text-xs text-white/40 font-mono block mb-1">ENCRYPTED PIN (SHA-256):</span>
                        <span className="text-[9px] text-orange-400/70 font-mono break-all">{isClient ? encryptedPin : 'Loading...'}</span>
                      </div>

                      <div className="flex items-center justify-center gap-3">
                        {secretPin.split('').map((digit, i) => (
                          <motion.div
                            key={i}
                            className={`w-14 h-16 rounded-lg border-2 flex items-center justify-center text-3xl font-bold font-mono ${
                              revealedDigits[i]
                                ? 'border-green-500 bg-green-500/20 text-green-400'
                                : currentDigitIndex === i && isRunning
                                ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400 animate-pulse'
                                : 'border-white/20 bg-white/5 text-white/20'
                            }`}
                            animate={revealedDigits[i] ? { scale: [1, 1.3, 1] } : {}}
                            transition={{ duration: 0.4 }}
                          >
                            {revealedDigits[i] || '?'}
                          </motion.div>
                        ))}
                      </div>

                      {/* Simulation progress */}
                      {isRunning && simulationProgress && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="mt-3 text-center"
                        >
                          <div className="flex items-center justify-center gap-2 text-cyan-400 text-xs">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            >
                              <Atom className="w-4 h-4" />
                            </motion.div>
                            <span className="font-mono">{simulationProgress}</span>
                          </div>
                        </motion.div>
                      )}

                      {/* Quantum Results Display */}
                      {quantumResults && !pinCracked && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-4 p-3 bg-black/30 rounded-lg border border-cyan-500/20"
                        >
                          <div className="text-[10px] text-cyan-400 font-medium mb-2">QUANTUM STATE PROBABILITIES:</div>
                          <div className="space-y-1">
                            {quantumResults.topStates.slice(0, 4).map((state, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className="text-[10px] text-white/50 font-mono w-12">|{state.state}⟩</span>
                                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                  <motion.div
                                    className="h-full bg-gradient-to-r from-purple-500 to-cyan-500"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${state.probability * 100}%` }}
                                    transition={{ duration: 0.3 }}
                                  />
                                </div>
                                <span className="text-[10px] text-white/40 font-mono w-12">
                                  {(state.probability * 100).toFixed(1)}%
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 text-[9px] text-white/30">
                            Found digit with {(quantumResults.probability * 100).toFixed(1)}% probability
                          </div>
                        </motion.div>
                      )}

                      {pinCracked && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-4 text-center"
                        >
                          <span className="text-green-400 text-sm font-medium flex items-center justify-center gap-2">
                            <Key className="w-4 h-4" />
                            PIN Cracked via Quantum Search!
                          </span>
                          <p className="text-[10px] text-white/40 mt-1">
                            Grover&apos;s algorithm found the PIN in O(√N) time instead of O(N)
                          </p>
                        </motion.div>
                      )}
                    </div>

                    {/* Circuit visualization */}
                    <div className="mb-6 p-4 bg-black/30 rounded-xl border border-white/10">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-white/60 font-medium">QUANTUM CIRCUIT</span>
                        <button
                          onClick={resetChallenge}
                          className="text-xs text-white/40 hover:text-white/60 flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" /> Reset
                        </button>
                      </div>

                      {/* Qubit lines with improved gate visualization */}
                      <div className="space-y-2 overflow-x-auto">
                        {[0, 1, 2].map((qubit) => (
                          <div key={qubit} className="flex items-center gap-2 min-w-max">
                            <span className="text-xs text-white/40 font-mono w-8">|q{qubit}⟩</span>
                            <div className="flex-1 h-10 bg-white/5 rounded relative flex items-center min-w-[400px]">
                              {/* Wire */}
                              <div className="absolute inset-y-0 left-0 right-0 flex items-center">
                                <div className="w-full h-px bg-white/20" />
                              </div>

                              {/* Gates on this qubit */}
                              <div className="relative flex items-center gap-1 px-2">
                                {circuitGates.map((gate, i) => {
                                  const isOnQubit = gate.qubits.includes(qubit);
                                  const isControl = gate.control === qubit;
                                  const isTarget = gate.target === qubit;

                                  if (!isOnQubit) return null;

                                  // For CX gates, show control dot or target X
                                  if (gate.gate === 'CX') {
                                    if (isControl) {
                                      return (
                                        <motion.div
                                          key={i}
                                          initial={{ scale: 0 }}
                                          animate={{ scale: 1 }}
                                          className="w-8 h-8 flex items-center justify-center"
                                        >
                                          <div className="w-3 h-3 rounded-full bg-blue-500" />
                                        </motion.div>
                                      );
                                    } else if (isTarget) {
                                      return (
                                        <motion.div
                                          key={i}
                                          initial={{ scale: 0 }}
                                          animate={{ scale: 1 }}
                                          className="w-8 h-8 rounded-full border-2 border-blue-500 flex items-center justify-center text-blue-400 text-xs font-bold"
                                        >
                                          +
                                        </motion.div>
                                      );
                                    }
                                  }

                                  // Regular gate boxes with colors
                                  const colorClasses: Record<string, string> = {
                                    purple: 'bg-purple-500/80',
                                    blue: 'bg-blue-500/80',
                                    cyan: 'bg-cyan-500/80',
                                    orange: 'bg-orange-500/80',
                                    pink: 'bg-pink-500/80',
                                    green: 'bg-green-500/80',
                                    yellow: 'bg-yellow-500/80',
                                  };

                                  return (
                                    <motion.div
                                      key={i}
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      className={`w-8 h-7 rounded text-[9px] font-bold flex items-center justify-center text-white ${
                                        colorClasses[gate.color || 'purple'] || 'bg-purple-500/80'
                                      }`}
                                    >
                                      {gate.gate}
                                    </motion.div>
                                  );
                                })}
                              </div>
                            </div>
                            <span className="text-xs text-white/40 font-mono w-8">
                              {revealedDigits.length > 0 ? (qubit === 0 ? '|1⟩' : qubit === 1 ? '|0⟩' : '|1⟩') : '|0⟩'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Step instructions */}
                    {!pinCracked && (
                      <div className="mb-4">
                        {currentStep < CIRCUIT_STEPS.length ? (
                          <motion.div
                            key={currentStep}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl"
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-lg bg-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-sm">
                                {currentStep + 1}
                              </div>
                              <div className="flex-1">
                                <h4 className="text-sm font-medium text-white mb-1">
                                  {CIRCUIT_STEPS[currentStep].title}
                                </h4>
                                <p className="text-xs text-white/50 mb-2">
                                  {CIRCUIT_STEPS[currentStep].instruction}
                                </p>
                                <p className="text-[10px] text-purple-300/60 font-mono">
                                  {CIRCUIT_STEPS[currentStep].description}
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-center"
                          >
                            <CheckCircle2 className="w-6 h-6 text-green-400 mx-auto mb-2" />
                            <p className="text-sm text-green-300">Circuit complete! Run to crack the password.</p>
                          </motion.div>
                        )}
                      </div>
                    )}

                    {/* Progress dots */}
                    <div className="flex items-center justify-center gap-1 mb-4 flex-wrap">
                      {CIRCUIT_STEPS.map((step) => (
                        <div
                          key={step.id}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            completedSteps.includes(step.id) ? 'bg-purple-400' : 'bg-white/20'
                          }`}
                        />
                      ))}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-3">
                      {currentStep < CIRCUIT_STEPS.length ? (
                        <Button
                          onClick={applyGate}
                          className="flex-1 bg-purple-600 hover:bg-purple-500"
                          disabled={isRunning}
                        >
                          Apply {CIRCUIT_STEPS[currentStep]?.gateDisplay || CIRCUIT_STEPS[currentStep]?.gate} Gate
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      ) : (
                        <Button
                          onClick={runCircuit}
                          className="flex-1 bg-gradient-to-r from-green-600 to-cyan-600 hover:from-green-500 hover:to-cyan-500"
                          disabled={isRunning || pinCracked}
                        >
                          {isRunning ? (
                            <>
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                              >
                                <Atom className="w-4 h-4 mr-2" />
                              </motion.div>
                              Running Quantum Circuit...
                            </>
                          ) : (
                            <>
                              <Zap className="w-4 h-4 mr-2" />
                              Run Circuit
                            </>
                          )}
                        </Button>
                      )}
                    </div>

                    {/* Educational note */}
                    <p className="text-[10px] text-white/30 text-center mt-4">
                      Grover&apos;s algorithm provides quadratic speedup for searching unsorted databases
                    </p>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PIN Entry Modal */}
      <AnimatePresence>
        {showPinEntry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center pointer-events-auto z-50"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="relative z-10 max-w-md w-full mx-4"
            >
              <div className="bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 border border-purple-500/30 rounded-2xl p-8 shadow-2xl">
                {/* Lock icon */}
                <motion.div
                  className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center border border-purple-500/30"
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Lock className="w-10 h-10 text-purple-400" />
                </motion.div>

                <h2 className="text-2xl font-bold text-center text-white mb-2">
                  Enter Quantum Lab PIN
                </h2>
                <p className="text-white/50 text-sm text-center mb-8">
                  Enter the PIN you cracked using Grover&apos;s algorithm
                </p>

                {/* PIN Input boxes */}
                <motion.div
                  className="flex justify-center gap-4 mb-8"
                  animate={pinError ? { x: [-10, 10, -10, 10, 0] } : {}}
                  transition={{ duration: 0.4 }}
                >
                  {[0, 1, 2, 3].map((i) => (
                    <input
                      key={i}
                      ref={(el) => { pinInputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={pinInput[i]}
                      onChange={(e) => handlePinInput(i, e.target.value)}
                      onKeyDown={(e) => handlePinKeyDown(i, e)}
                      className={`w-16 h-20 text-center text-3xl font-bold font-mono rounded-xl border-2 bg-black/50 text-white focus:outline-none transition-colors ${
                        pinError
                          ? 'border-red-500 bg-red-500/10'
                          : pinInput[i]
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-white/20 focus:border-purple-500'
                      }`}
                    />
                  ))}
                </motion.div>

                {pinError && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-400 text-sm text-center mb-4"
                  >
                    Incorrect PIN. Try again!
                  </motion.p>
                )}

                {/* Unlock button */}
                <Button
                  onClick={verifyPin}
                  disabled={pinInput.some(d => !d)}
                  className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed py-6 text-lg"
                >
                  <Key className="w-5 h-5 mr-2" />
                  Unlock Quantum Lab
                </Button>

                <p className="text-[10px] text-white/30 text-center mt-6">
                  Hint: You discovered the PIN was <span className="text-purple-400 font-mono">{revealedDigits.join('')}</span>
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unlock modal */}
      <AnimatePresence>
        {showUnlock && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 flex items-center justify-center pointer-events-auto z-50"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.8, 0] }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 bg-white"
            />

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="absolute inset-0 bg-black/85"
            />

            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full border"
                style={{ borderColor: i % 2 === 0 ? 'rgba(168, 85, 247, 0.4)' : 'rgba(6, 182, 212, 0.4)' }}
                initial={{ width: 0, height: 0, opacity: 1 }}
                animate={{ width: 1000, height: 1000, opacity: 0 }}
                transition={{ duration: 1.5, delay: 0.3 + i * 0.1, ease: 'easeOut' }}
              />
            ))}

            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', delay: 0.5, duration: 0.8, bounce: 0.4 }}
              className="relative z-10"
            >
              <div className="relative bg-gradient-to-br from-slate-900/95 via-purple-900/80 to-slate-900/95 backdrop-blur-xl border border-purple-500/30 rounded-2xl p-8 text-center shadow-2xl max-w-md">
                <div className="absolute inset-0 rounded-2xl overflow-hidden">
                  <motion.div
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.2), transparent)' }}
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  />
                </div>

                <motion.div
                  className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-500/20 to-cyan-500/20 flex items-center justify-center border border-green-500/30"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                >
                  <Key className="w-10 h-10 text-green-400" />
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-yellow-400" />
                    <span className="text-xs font-medium text-green-400">PIN CRACKED: {secretPin}</span>
                    <Sparkles className="h-4 w-4 text-yellow-400" />
                  </div>

                  <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-purple-300 via-cyan-300 to-purple-300 bg-clip-text text-transparent">
                    Quantum Lab Unlocked!
                  </h2>

                  <p className="text-white/50 text-sm mb-6">
                    You&apos;ve mastered Grover&apos;s algorithm. Welcome to quantum computing!
                  </p>
                </motion.div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="flex justify-center gap-2 mb-6">
                  {['Grover', 'Shor', 'VQE', 'QAOA'].map((f, i) => (
                    <motion.span
                      key={f}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 1.1 + i * 0.1 }}
                      className="px-3 py-1 rounded-full text-xs border border-purple-500/30 text-purple-300 bg-purple-500/10"
                    >
                      {f}
                    </motion.span>
                  ))}
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3 }}>
                  <Button
                    size="lg"
                    onClick={() => router.push('/quantum')}
                    className="relative overflow-hidden bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold px-8 py-6 text-lg rounded-xl shadow-lg shadow-purple-500/25 cursor-pointer"
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
                      animate={{ x: ['-100%', '100%'] }}
                      transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 0.5 }}
                    />
                    <Zap className="mr-2 h-5 w-5" />
                    Enter Quantum Lab
                    <Atom className="ml-2 h-5 w-5" />
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
