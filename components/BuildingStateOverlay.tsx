'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Rocket,
  Coffee,
  Brain,
  Sparkles,
  Code2,
  Zap,
  Bot,
  Cpu,
  GitBranch,
  Terminal,
  Wrench,
  Package,
  Shield,
  TestTube,
  CloudUpload,
  FileCode,
  Cog,
  Globe,
  Layout,
  Palette,
  Server,
  CheckCircle2,
  Timer,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Fleet phase type - matches FleetCoordinator phases exactly
export type FleetPhase =
  | 'idle'
  | 'decomposing'
  | 'clustering'
  | 'architecture'
  | 'squad-assignment'
  | 'foundation'
  | 'core'
  | 'feature'
  | 'integration'
  | 'polish'
  | 'completed'
  | 'error'
  | 'paused';

// Execution phase messages (shared by foundation, core, feature, integration, polish)
const executionMessages = [
  { icon: Code2, text: "Coder agents are implementing features...", subtext: "Turning stories into reality" },
  { icon: Terminal, text: "Writing production code...", subtext: "Clean, tested, maintainable" },
  { icon: TestTube, text: "Tester agents are validating...", subtext: "Checking acceptance criteria" },
  { icon: Shield, text: "Security checks in progress...", subtext: "Scanning for vulnerabilities" },
  { icon: Palette, text: "Styling components...", subtext: "Making it beautiful and accessible" },
  { icon: Globe, text: "Building API endpoints...", subtext: "Connecting frontend to backend" },
  { icon: Bot, text: "Squads collaborating via A2A...", subtext: "Agent-to-agent communication" },
  { icon: Zap, text: "Parallel execution in progress...", subtext: "Multiple squads working simultaneously" },
];

// Phase-specific messages - shown based on actual fleet phase
const phaseMessages: Record<FleetPhase, Array<{ icon: any; text: string; subtext: string }>> = {
  idle: [
    { icon: Rocket, text: "Initializing Fleet...", subtext: "Preparing AI agents for deployment" },
    { icon: Cog, text: "Setting up workspace...", subtext: "Creating isolated environments" },
  ],
  architecture: [
    { icon: Layout, text: "🏗️ Architecture Agent is designing your system...", subtext: "Creating diagrams, components, and data models" },
    { icon: Brain, text: "Analyzing project requirements...", subtext: "Understanding the big picture" },
    { icon: Server, text: "Defining system architecture...", subtext: "APIs, components, and data flow" },
    { icon: FileCode, text: "Generating architecture documentation...", subtext: "Mermaid diagrams and component specs" },
    { icon: Cpu, text: "Identifying design patterns...", subtext: "Best practices for your domain" },
  ],
  decomposing: [
    { icon: Brain, text: "📋 Product Owner is crafting detailed stories...", subtext: "Breaking down your vision into actionable tasks" },
    { icon: FileCode, text: "Generating acceptance criteria...", subtext: "Defining what 'done' looks like" },
    { icon: CheckCircle2, text: "Writing testable requirements...", subtext: "GIVEN/WHEN/THEN specifications" },
    { icon: Bot, text: "Analyzing edge cases...", subtext: "Thinking through error scenarios" },
    { icon: Wrench, text: "Estimating story complexity...", subtext: "Story points and dependencies" },
  ],
  clustering: [
    { icon: GitBranch, text: "🔀 Organizing stories into squads...", subtext: "Grouping by domain expertise" },
    { icon: Bot, text: "Assigning specialized squads...", subtext: "UI, Backend, Security, Data teams" },
    { icon: Package, text: "Creating isolated worktrees...", subtext: "Each squad gets its own workspace" },
    { icon: Cog, text: "Configuring squad prompts...", subtext: "Tailoring AI agents to their roles" },
  ],
  'squad-assignment': [
    { icon: Bot, text: "👥 Assigning squads based on architecture...", subtext: "Matching expertise to components" },
    { icon: Brain, text: "Analyzing architecture decisions...", subtext: "Understanding system design" },
    { icon: GitBranch, text: "Re-evaluating squad assignments...", subtext: "Optimizing for architecture alignment" },
    { icon: CheckCircle2, text: "Finalizing squad workload...", subtext: "Balancing work across teams" },
  ],
  foundation: [
    { icon: Package, text: "🏗️ Building foundation layer...", subtext: "Core infrastructure and setup" },
    ...executionMessages,
  ],
  core: [
    { icon: Cpu, text: "⚙️ Implementing core functionality...", subtext: "Essential features and logic" },
    ...executionMessages,
  ],
  feature: [
    { icon: Sparkles, text: "✨ Building features...", subtext: "User-facing functionality" },
    ...executionMessages,
  ],
  integration: [
    { icon: GitBranch, text: "🔗 Integration phase...", subtext: "Connecting all the pieces" },
    ...executionMessages,
  ],
  polish: [
    { icon: Sparkles, text: "💅 Polish phase...", subtext: "Final touches and refinements" },
    ...executionMessages,
  ],
  completed: [
    { icon: Rocket, text: "🎉 Fleet completed successfully!", subtext: "All stories implemented" },
    { icon: CheckCircle2, text: "All acceptance criteria met!", subtext: "Ready for review" },
  ],
  error: [
    { icon: Shield, text: "Handling an issue...", subtext: "AI agents are troubleshooting" },
  ],
  paused: [
    { icon: Timer, text: "Fleet paused...", subtext: "Waiting to resume" },
  ],
};

// Building phase messages - fallback for non-fleet contexts
const buildingMessages = [
  // Planning
  { icon: Brain, text: "Product Owner is crafting user stories...", subtext: "Breaking down your vision into tasks" },
  { icon: Layout, text: "Designing the architecture...", subtext: "Building a solid foundation" },

  // Setup
  { icon: Package, text: "Setting up project foundation...", subtext: "package.json, configs, the works" },
  { icon: Cog, text: "Configuring TypeScript...", subtext: "Type safety is our friend" },
  { icon: FileCode, text: "Creating folder structure...", subtext: "A place for everything" },

  // Coding
  { icon: Code2, text: "Coder is in the zone...", subtext: "Turning ideas into reality" },
  { icon: Terminal, text: "Writing components...", subtext: "Pixel-perfect precision" },
  { icon: Palette, text: "Styling your interface...", subtext: "Making it beautiful" },
  { icon: Globe, text: "Building API routes...", subtext: "Connecting the dots" },
  { icon: Bot, text: "AI agents collaborating...", subtext: "Teamwork makes the dream work" },
  { icon: Cpu, text: "Processing logic...", subtext: "Teaching your app to think" },

  // Testing
  { icon: TestTube, text: "Tester is breaking things...", subtext: "Finding bugs so you don't have to" },
  { icon: Shield, text: "Security scan in progress...", subtext: "Keeping your app safe" },
  { icon: CheckCircle2, text: "Verifying acceptance criteria...", subtext: "Making sure it works right" },

  // Deploying
  { icon: Server, text: "Preparing for launch...", subtext: "Final checks in progress" },
  { icon: CloudUpload, text: "Optimizing assets...", subtext: "Making it fast" },
  { icon: Rocket, text: "Almost ready for liftoff!", subtext: "Your app is coming to life" },

  // Fun fillers
  { icon: Coffee, text: "Brewing coffee for the AI agents...", subtext: "They work better caffeinated" },
  { icon: Zap, text: "Converting caffeine to code...", subtext: "It's basically alchemy" },
  { icon: GitBranch, text: "Branching into possibilities...", subtext: "Every great app starts with git init" },
  { icon: Wrench, text: "Calibrating the awesome meter...", subtext: "It's going to be off the charts" },
  { icon: Sparkles, text: "Sprinkling magic dust...", subtext: "100% organic, ethically sourced" },
];

// Iteration-specific messages
const iteratingMessages = [
  { icon: Wrench, text: "Analyzing your changes...", subtext: "Understanding what needs to be done" },
  { icon: Code2, text: "Modifying existing code...", subtext: "Careful, surgical changes" },
  { icon: Terminal, text: "Updating components...", subtext: "Preserving what works" },
  { icon: Bot, text: "AI agents iterating...", subtext: "Building on the foundation" },
  { icon: TestTube, text: "Testing the changes...", subtext: "Making sure nothing broke" },
  { icon: Zap, text: "Applying improvements...", subtext: "Making it even better" },
  { icon: Sparkles, text: "Polishing the updates...", subtext: "Almost there" },
  { icon: CheckCircle2, text: "Verifying changes...", subtext: "Quality assurance in progress" },
];

interface ProgressLog {
  timestamp: Date;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

interface BuildingStateOverlayProps {
  projectName?: string;
  currentAgent?: string;
  currentTask?: string;
  storiesTotal?: number;
  storiesCompleted?: number;
  elapsedTime?: number; // in seconds
  isIterating?: boolean; // true when iterating on existing project
  fleetPhase?: FleetPhase; // current fleet phase for phase-specific messages
  progressLogs?: ProgressLog[]; // real-time progress logs from decomposition/execution
  onSkipToExecution?: () => void; // callback to skip planning phases and go to execution
}

export function BuildingStateOverlay({
  projectName = "Your Project",
  currentAgent,
  storiesTotal = 0,
  storiesCompleted = 0,
  elapsedTime = 0,
  isIterating = false,
  fleetPhase,
  progressLogs = [],
  onSkipToExecution,
}: BuildingStateOverlayProps) {
  const [messageIndex, setMessageIndex] = useState(0);

  // Determine which messages to use based on context
  const baseMessages = useMemo(() => {
    // If we have a fleet phase, use phase-specific messages
    if (fleetPhase && phaseMessages[fleetPhase]) {
      return phaseMessages[fleetPhase];
    }
    // Otherwise fall back to iteration or building messages
    return isIterating ? iteratingMessages : buildingMessages;
  }, [fleetPhase, isIterating]);

  // Shuffle messages on mount for variety (but keep phase messages in order for first few)
  const shuffledMessages = useMemo(() => {
    // For fleet phases, show first message immediately, then shuffle rest
    if (fleetPhase) {
      const [first, ...rest] = baseMessages;
      return [first, ...rest.sort(() => Math.random() - 0.5)];
    }
    return [...baseMessages].sort(() => Math.random() - 0.5);
  }, [baseMessages, fleetPhase]);

  // Rotate messages - slower pace (6 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % shuffledMessages.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [shuffledMessages.length]);

  const currentMessage = shuffledMessages[messageIndex];
  const IconComponent = currentMessage.icon;

  // Format elapsed time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress - real-time based on stories or time
  let progress = 0;
  if (storiesTotal > 0 && storiesCompleted > 0) {
    progress = Math.round((storiesCompleted / storiesTotal) * 100);
  } else {
    // Time-based progress: starts at 5%, grows steadily, caps at 90%
    // Reaches ~50% at 60 seconds, ~75% at 120 seconds, ~85% at 180 seconds
    progress = Math.min(90, 5 + Math.floor(elapsedTime * 0.7));
  }

  return (
    <div className="h-full w-full flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden relative">
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, rgba(139, 92, 246, 0.3) 0%, transparent 50%),
                           radial-gradient(circle at 75% 75%, rgba(168, 85, 247, 0.3) 0%, transparent 50%)`,
        }} />
        <motion.div
          className="absolute inset-0"
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%'],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            repeatType: 'reverse',
          }}
          style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%239C92AC" fill-opacity="0.1"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 15 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-primary/40 rounded-full"
            initial={{
              x: `${(i * 7) % 100}%`,
              y: '100%',
              opacity: 0,
            }}
            animate={{
              y: '-10%',
              opacity: [0, 0.8, 0],
            }}
            transition={{
              duration: 6 + (i % 4),
              repeat: Infinity,
              delay: i * 0.4,
              ease: 'linear',
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative flex-1 flex flex-col items-center justify-center p-8">
        {/* Phase indicator badge */}
        {fleetPhase && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <div className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border",
              fleetPhase === 'idle' && "bg-slate-500/20 border-slate-500/40 text-slate-300",
              fleetPhase === 'architecture' && "bg-amber-500/20 border-amber-500/40 text-amber-300",
              fleetPhase === 'decomposing' && "bg-blue-500/20 border-blue-500/40 text-blue-300",
              fleetPhase === 'clustering' && "bg-purple-500/20 border-purple-500/40 text-purple-300",
              fleetPhase === 'foundation' && "bg-cyan-500/20 border-cyan-500/40 text-cyan-300",
              fleetPhase === 'core' && "bg-emerald-500/20 border-emerald-500/40 text-emerald-300",
              fleetPhase === 'feature' && "bg-teal-500/20 border-teal-500/40 text-teal-300",
              fleetPhase === 'integration' && "bg-indigo-500/20 border-indigo-500/40 text-indigo-300",
              fleetPhase === 'polish' && "bg-pink-500/20 border-pink-500/40 text-pink-300",
              fleetPhase === 'completed' && "bg-green-500/20 border-green-500/40 text-green-300",
              fleetPhase === 'error' && "bg-red-500/20 border-red-500/40 text-red-300",
              fleetPhase === 'paused' && "bg-orange-500/20 border-orange-500/40 text-orange-300",
            )}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
              </span>
              {fleetPhase === 'idle' && "Initializing..."}
              {fleetPhase === 'decomposing' && "Phase 1: Story Generation"}
              {fleetPhase === 'clustering' && "Phase 2: Squad Organization"}
              {fleetPhase === 'architecture' && "Phase 3: Architecture Design"}
              {fleetPhase === 'foundation' && "Phase 4: Foundation"}
              {fleetPhase === 'core' && "Phase 5: Core Implementation"}
              {fleetPhase === 'feature' && "Phase 6: Features"}
              {fleetPhase === 'integration' && "Phase 7: Integration"}
              {fleetPhase === 'polish' && "Phase 8: Polish"}
              {fleetPhase === 'completed' && "Completed!"}
              {fleetPhase === 'error' && "Error Occurred"}
              {fleetPhase === 'paused' && "Paused"}
            </div>
          </motion.div>
        )}

        {/* Project name */}
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-bold mb-8 text-center"
        >
          {isIterating ? 'Iterating' : 'Building'} <span className="text-primary">{projectName}</span>
        </motion.h2>

        {/* Animated icon container */}
        <div className="relative mb-8">
          {/* Outer glow ring */}
          <motion.div
            className="absolute inset-[-20px] rounded-full"
            animate={{
              boxShadow: [
                '0 0 20px rgba(139, 92, 246, 0.3)',
                '0 0 60px rgba(139, 92, 246, 0.5)',
                '0 0 20px rgba(139, 92, 246, 0.3)',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />

          {/* Rotating ring */}
          <motion.div
            className="absolute inset-[-10px] rounded-full border-2 border-dashed border-primary/30"
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
          />

          {/* Icon circle */}
          <AnimatePresence mode="wait">
            <motion.div
              key={messageIndex}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="relative w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center backdrop-blur-sm"
            >
              <IconComponent className="w-12 h-12 text-primary" />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Current message */}
        <AnimatePresence mode="wait">
          <motion.div
            key={messageIndex}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="text-center mb-8 min-h-[60px]"
          >
            <p className="text-lg font-medium text-white/90">{currentMessage.text}</p>
            <p className="text-sm text-white/50 mt-1">{currentMessage.subtext}</p>
          </motion.div>
        </AnimatePresence>

        {/* Progress bar - simplified, real-time */}
        <div className="w-full max-w-sm space-y-2">
          <div className="flex justify-between text-xs text-white/60">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-purple-400 rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Stats row - cleaner */}
        <div className="flex gap-4 mt-6 text-center">
          <div className="px-4 py-2 bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-center gap-1.5 text-white/60 text-xs mb-1">
              <Timer className="h-3 w-3" />
              <span>Elapsed</span>
            </div>
            <p className="text-base font-mono font-bold text-white/90">{formatTime(elapsedTime)}</p>
          </div>

          {storiesTotal > 0 && (
            <div className="px-4 py-2 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center gap-1.5 text-white/60 text-xs mb-1">
                <CheckCircle2 className="h-3 w-3" />
                <span>Stories</span>
              </div>
              <p className="text-base font-mono font-bold text-white/90">
                {storiesCompleted}/{storiesTotal}
              </p>
            </div>
          )}

          {currentAgent && (
            <div className="px-4 py-2 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center gap-1.5 text-white/60 text-xs mb-1">
                <Bot className="h-3 w-3" />
                <span>Agent</span>
              </div>
              <p className="text-sm font-medium text-primary">{currentAgent}</p>
            </div>
          )}
        </div>

        {/* Skip to Execution button - only show during architecture phase */}
        {onSkipToExecution && (fleetPhase === 'architecture' || fleetPhase === 'clustering') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 5 }} // Show after 5 seconds
            className="mt-6"
          >
            <button
              onClick={onSkipToExecution}
              className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/20 hover:border-white/40 rounded-lg transition-all flex items-center gap-2"
            >
              <Zap className="h-4 w-4" />
              Skip to Coding Phase
            </button>
            <p className="text-xs text-white/40 mt-2 text-center">
              Architecture will continue in background
            </p>
          </motion.div>
        )}

        {/* Live progress logs */}
        {progressLogs.length > 0 && (
          <div className="mt-8 w-full max-w-lg">
            <div className="flex items-center gap-2 mb-2 text-white/60 text-xs">
              <Terminal className="h-3 w-3" />
              <span>Live Activity</span>
            </div>
            <div className="bg-black/30 rounded-lg border border-white/10 p-3 max-h-32 overflow-y-auto">
              <div className="space-y-1.5 font-mono text-xs">
                {progressLogs.slice(-8).map((log, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      "flex items-start gap-2",
                      log.type === 'success' && "text-green-400",
                      log.type === 'warning' && "text-yellow-400",
                      log.type === 'error' && "text-red-400",
                      (!log.type || log.type === 'info') && "text-white/70"
                    )}
                  >
                    <span className="text-white/30 shrink-0">
                      {log.timestamp.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span className="truncate">{log.message}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Fallback message when no logs */}
        {progressLogs.length === 0 && (
          <div className="mt-8 text-center text-white/40 text-sm">
            <p>Waiting for activity...</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Export the ProgressLog type for use in other components
export type { ProgressLog };
