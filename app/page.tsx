'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MultiProjectDashboard } from '@/components/MultiProjectDashboard';
import {
  ShieldCheck,
  Zap,
  ArrowRight,
  Settings,
  Rocket,
  Bot,
  Atom,
  HeartPulse,
  Sparkles,
  Clock,
  Shield,
  FileCheck,
  Activity,
  Code2,
  FolderGit2,
  TestTube,
  Brain,
} from 'lucide-react';

interface PlatformStats {
  totalProjects: number;
  completedProjects: number;
  totalLinesOfCode: number;
  totalFiles: number;
  totalTests: number;
  learningsCount: number;
}

function AnimatedCounter({ value, duration = 2000 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (value === 0) return;

    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * value));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  return <span>{count.toLocaleString()}</span>;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

export default function Home() {
  const router = useRouter();
  const [stats, setStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    fetch('/api/platform-stats')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.stats) {
          setStats(data.stats);
        }
      })
      .catch(console.error);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-[#0a0e1a] to-slate-950 relative overflow-hidden">
      {/* Animated background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* SmartCycleAI Branding */}
            <div className="flex items-center gap-3 pr-4 border-r border-white/20">
              <img src="/smartcycle-logo.svg" alt="SmartCycleAI" className="h-10 w-10" />
              <div className="flex flex-col">
                <span className="text-base font-bold text-white leading-tight">Smart</span>
                <span className="text-base font-bold text-white leading-tight">CycleAI</span>
              </div>
            </div>
            {/* Ochsner AI Studio */}
            <div className="flex items-center gap-2">
              <HeartPulse className="h-8 w-8 text-emerald-400" />
              <h1 className="text-2xl font-bold text-white">Ochsner AI Studio</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/settings">
              <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/projects">
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                My Projects
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 pt-16 pb-8 text-center relative z-10">
        <div className="flex justify-center gap-2 mb-8 flex-wrap">
          <Badge className="bg-emerald-600/90 hover:bg-emerald-600 text-white border-0">HIPAA Compliant</Badge>
          <Badge className="bg-blue-600/90 hover:bg-blue-600 text-white border-0">HL7 FHIR Ready</Badge>
          <Badge className="bg-purple-600/90 hover:bg-purple-600 text-white border-0">SOC 2 Type II</Badge>
          <Badge className="bg-amber-600/90 hover:bg-amber-600 text-white border-0">Epic Integration</Badge>
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-white">
          Healthcare Apps
          <br />
          <span className="bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400 bg-clip-text text-transparent animate-gradient-shimmer">
            Built with SmartCycleAI
          </span>
        </h1>
        <p className="text-xl text-white/70 max-w-3xl mx-auto mb-4 leading-relaxed">
          From clinical idea to compliant application in minutes
        </p>
        <p className="text-lg text-white/50 max-w-2xl mx-auto">
          SmartCycleAI builds <span className="text-emerald-400 font-medium">HIPAA-compliant</span> healthcare
          applications with security controls, audit logging, and EHR integration.
        </p>
      </section>

      {/* Main Cards Section */}
      <section className="container mx-auto px-4 py-12 max-w-6xl relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Quick Builds Card */}
          <button
            onClick={() => router.push('/quick-build')}
            className="group relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/50 to-slate-900/50 p-8 text-left transition-all duration-300 hover:border-emerald-400/60 hover:shadow-2xl hover:shadow-emerald-500/20 hover:-translate-y-1"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-center justify-between mb-6">
                <div className="p-3 rounded-xl bg-emerald-500/20 ring-1 ring-emerald-500/30">
                  <Rocket className="h-8 w-8 text-emerald-400" />
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Fast</Badge>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Quick Builds</h3>
              <p className="text-white/60 mb-6 leading-relaxed">
                Build Epic FHIR apps from templates in ~2 minutes. Select a template, customize, and deploy.
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                <Badge variant="outline" className="border-white/20 text-white/70">
                  <Clock className="h-3 w-3 mr-1" />
                  ~2 min
                </Badge>
                <Badge variant="outline" className="border-white/20 text-white/70">
                  <Activity className="h-3 w-3 mr-1" />
                  Epic APIs
                </Badge>
                <Badge variant="outline" className="border-white/20 text-white/70">
                  <FileCheck className="h-3 w-3 mr-1" />
                  Templates
                </Badge>
              </div>
              <div className="flex items-center text-emerald-400 font-medium group-hover:gap-3 transition-all">
                <span>Start Building</span>
                <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </button>

          {/* Clinical Build Card */}
          <button
            onClick={() => router.push('/build')}
            className="group relative overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-950/50 to-slate-900/50 p-8 text-left transition-all duration-300 hover:border-blue-400/60 hover:shadow-2xl hover:shadow-blue-500/20 hover:-translate-y-1"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-center justify-between mb-6">
                <div className="p-3 rounded-xl bg-blue-500/20 ring-1 ring-blue-500/30">
                  <Bot className="h-8 w-8 text-blue-400" />
                </div>
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">Multi-Agent</Badge>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Clinical Build</h3>
              <p className="text-white/60 mb-6 leading-relaxed">
                Full-featured apps with EHR integration, audit trails, security scanning, and HIPAA compliance.
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                <Badge variant="outline" className="border-white/20 text-white/70">
                  <Clock className="h-3 w-3 mr-1" />
                  ~10 min
                </Badge>
                <Badge variant="outline" className="border-white/20 text-white/70">
                  <Shield className="h-3 w-3 mr-1" />
                  HIPAA Ready
                </Badge>
                <Badge variant="outline" className="border-white/20 text-white/70">
                  <Sparkles className="h-3 w-3 mr-1" />
                  5 Agents
                </Badge>
              </div>
              <div className="flex items-center text-blue-400 font-medium group-hover:gap-3 transition-all">
                <span>Start Clinical Build</span>
                <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </button>

          {/* Quantum Lab Card */}
          <button
            onClick={() => router.push('/quantum')}
            className="group relative overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-950/50 to-slate-900/50 p-8 text-left transition-all duration-300 hover:border-purple-400/60 hover:shadow-2xl hover:shadow-purple-500/20 hover:-translate-y-1"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-center justify-between mb-6">
                <div className="p-3 rounded-xl bg-purple-500/20 ring-1 ring-purple-500/30">
                  <Atom className="h-8 w-8 text-purple-400" />
                </div>
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">Experimental</Badge>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Quantum Lab</h3>
              <p className="text-white/60 mb-6 leading-relaxed">
                Explore quantum computing with a visual circuit builder. Design, simulate, and analyze quantum algorithms.
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                <Badge variant="outline" className="border-white/20 text-white/70">
                  <Zap className="h-3 w-3 mr-1" />
                  Simulator
                </Badge>
                <Badge variant="outline" className="border-white/20 text-white/70">
                  <Activity className="h-3 w-3 mr-1" />
                  Qubits
                </Badge>
                <Badge variant="outline" className="border-white/20 text-white/70">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Visual
                </Badge>
              </div>
              <div className="flex items-center text-purple-400 font-medium group-hover:gap-3 transition-all">
                <span>Open Quantum Lab</span>
                <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* Live Platform Stats */}
      <section className="container mx-auto px-4 py-8 max-w-6xl relative z-10">
        <h3 className="text-sm font-medium text-white/50 mb-6 text-center uppercase tracking-wider">
          Platform Lifetime Stats
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 text-center">
            <div className="p-2 rounded-lg bg-blue-500/20 w-fit mx-auto mb-3">
              <FolderGit2 className="h-5 w-5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              <AnimatedCounter value={stats?.totalProjects || 0} />
            </div>
            <div className="text-xs text-white/50 mt-1">Projects Built</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 text-center">
            <div className="p-2 rounded-lg bg-emerald-500/20 w-fit mx-auto mb-3">
              <Code2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              <AnimatedCounter value={stats?.totalLinesOfCode || 0} />
            </div>
            <div className="text-xs text-white/50 mt-1">Lines of Code</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 text-center">
            <div className="p-2 rounded-lg bg-purple-500/20 w-fit mx-auto mb-3">
              <FileCheck className="h-5 w-5 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              <AnimatedCounter value={stats?.totalFiles || 0} />
            </div>
            <div className="text-xs text-white/50 mt-1">Files Created</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 text-center">
            <div className="p-2 rounded-lg bg-amber-500/20 w-fit mx-auto mb-3">
              <TestTube className="h-5 w-5 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              <AnimatedCounter value={stats?.totalTests || 0} />
            </div>
            <div className="text-xs text-white/50 mt-1">Tests Written</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 text-center">
            <div className="p-2 rounded-lg bg-cyan-500/20 w-fit mx-auto mb-3">
              <Brain className="h-5 w-5 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              <AnimatedCounter value={stats?.learningsCount || 0} />
            </div>
            <div className="text-xs text-white/50 mt-1">AI Learnings</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 text-center">
            <div className="p-2 rounded-lg bg-green-500/20 w-fit mx-auto mb-3">
              <ShieldCheck className="h-5 w-5 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              <AnimatedCounter value={stats?.completedProjects || 0} />
            </div>
            <div className="text-xs text-white/50 mt-1">Deployed</div>
          </div>
        </div>
      </section>

      {/* Active Projects Dashboard */}
      <section className="container mx-auto px-4 py-8 max-w-6xl relative z-10">
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-sm p-6">
          <MultiProjectDashboard maxProjects={4} showInactive={false} />
        </div>
      </section>

      {/* How it Works */}
      <section className="container mx-auto px-4 py-16 max-w-4xl relative z-10">
        <h2 className="text-2xl font-bold text-center mb-12 text-white">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 ring-1 ring-emerald-500/30 flex items-center justify-center mx-auto mb-4">
              <span className="text-xl font-bold text-emerald-400">1</span>
            </div>
            <h3 className="font-semibold mb-2 text-white">Describe Your Need</h3>
            <p className="text-sm text-white/60">
              Tell us what clinical problem you&apos;re solving in plain language
            </p>
          </div>
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-blue-500/20 ring-1 ring-blue-500/30 flex items-center justify-center mx-auto mb-4">
              <span className="text-xl font-bold text-blue-400">2</span>
            </div>
            <h3 className="font-semibold mb-2 text-white">AI Builds Compliant Code</h3>
            <p className="text-sm text-white/60">
              Our agents design HIPAA-compliant architecture with audit trails
            </p>
          </div>
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-purple-500/20 ring-1 ring-purple-500/30 flex items-center justify-center mx-auto mb-4">
              <span className="text-xl font-bold text-purple-400">3</span>
            </div>
            <h3 className="font-semibold mb-2 text-white">Review & Deploy</h3>
            <p className="text-sm text-white/60">
              Validate with your team, run security scans, and deploy
            </p>
          </div>
        </div>
      </section>

      {/* Compliance Features */}
      <section className="container mx-auto px-4 py-12 max-w-4xl relative z-10">
        <h3 className="text-sm font-medium text-white/50 mb-6 text-center uppercase tracking-wider">
          Built-In Healthcare Compliance
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { name: 'HIPAA Controls', desc: 'PHI encryption & access' },
            { name: 'Audit Logging', desc: 'Complete activity tracking' },
            { name: 'Role-Based Access', desc: 'Provider, nurse, admin' },
            { name: 'HL7 FHIR Ready', desc: 'EHR integration patterns' },
            { name: 'Security Scanning', desc: 'Automated vuln checks' },
            { name: 'Data Encryption', desc: 'At rest and in transit' },
            { name: 'Session Security', desc: 'Auto-timeout & MFA' },
            { name: 'Compliance Docs', desc: 'Audit-ready reports' },
          ].map((feature) => (
            <div key={feature.name} className="flex items-start gap-2 text-sm p-3 rounded-lg bg-white/5 border border-white/10">
              <ShieldCheck className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium text-white">{feature.name}</span>
                <p className="text-xs text-white/50">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-12 relative z-10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <span className="font-medium text-white">Ochsner AI Studio</span>
              <span className="text-white/50">| Healthcare AI Development Platform</span>
            </div>
            <div className="flex gap-4 text-sm text-white/50">
              <span>HIPAA Compliant</span>
              <span>&middot;</span>
              <span>SOC 2 Type II</span>
              <span>&middot;</span>
              <span>HL7 FHIR</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
