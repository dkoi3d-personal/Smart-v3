'use client';

import dynamic from 'next/dynamic';
import { Atom, Loader2 } from 'lucide-react';

// Dynamically import the quantum builder with SSR disabled
// This is necessary because quantum-circuit uses antlr4 which requires fs
const QuantumBuilder = dynamic(
  () => import('./QuantumBuilder'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <Atom className="h-16 w-16 text-purple-400 animate-spin" style={{ animationDuration: '3s' }} />
            <div className="absolute inset-0 h-16 w-16 rounded-full border-2 border-purple-500/30 animate-ping" />
          </div>
          <div className="mt-6 flex items-center gap-2 text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Initializing Quantum Simulator...</span>
          </div>
          <p className="mt-2 text-xs text-white/40">
            Loading quantum-circuit library
          </p>
        </div>
      </div>
    ),
  }
);

export default function QuantumPage() {
  return <QuantumBuilder />;
}
