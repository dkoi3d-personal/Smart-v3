'use client';

import { useState, useEffect, useRef } from 'react';
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
  CloudUpload
} from 'lucide-react';

const funnyMessages = [
  // Ochsner AI Studio themed messages
  { icon: Zap, text: "Ochsner AI Studio is spinning up...", subtext: "Building smarter, shipping faster" },
  { icon: Brain, text: "Studio agents are syncing...", subtext: "Collective intelligence activated" },
  { icon: Rocket, text: "Launching Ochsner AI Studio...", subtext: "Your idea is about to become reality" },
  { icon: Sparkles, text: "Studio magic in progress...", subtext: "Watch your vision come to life" },

  // Agent personality messages
  { icon: Coffee, text: "Brewing coffee for the AI agents...", subtext: "They work better caffeinated" },
  { icon: Brain, text: "Teaching robots to think...", subtext: "Almost there, just explaining recursion" },
  { icon: Bot, text: "Waking up the AI team...", subtext: "The Coder hit snooze twice" },
  { icon: Sparkles, text: "Sprinkling magic dust on your code...", subtext: "100% organic, ethically sourced" },
  { icon: Rocket, text: "Fueling the rocket ships...", subtext: "Your app is about to take off" },
  { icon: Code2, text: "Arguing about tabs vs spaces...", subtext: "Don't worry, we picked the right one" },
  { icon: Zap, text: "Charging up the flux capacitor...", subtext: "1.21 gigawatts should do it" },
  { icon: Cpu, text: "Allocating extra neurons...", subtext: "Your project deserves the best" },
  { icon: GitBranch, text: "Creating alternate timelines...", subtext: "Just kidding, we use version control" },
  { icon: Terminal, text: "Hacking the mainframe...", subtext: "In a totally legal way" },
  { icon: Wrench, text: "Calibrating the nonsense detector...", subtext: "Bugs don't stand a chance" },
  { icon: Package, text: "Downloading more RAM...", subtext: "Just kidding... or are we?" },
  { icon: Shield, text: "Activating security protocols...", subtext: "Hackers hate this one trick" },
  { icon: TestTube, text: "Mixing the secret sauce...", subtext: "Recipe: 1 part AI, 2 parts awesome" },
  { icon: CloudUpload, text: "Uploading your dreams to the cloud...", subtext: "Don't worry, we encrypted them" },

  // Agent-specific messages
  { icon: Bot, text: "Product Owner is writing user stories...", subtext: "As a user, I want this to load faster" },
  { icon: Brain, text: "Research Analyst is doing research...", subtext: "Stack Overflow to the rescue" },
  { icon: Code2, text: "Coder is in the zone...", subtext: "Please do not disturb" },
  { icon: TestTube, text: "Tester is preparing to break things...", subtext: "It's for science" },
  { icon: Shield, text: "Security is being paranoid...", subtext: "As they should be" },
  { icon: Rocket, text: "Infrastructure is spinning up servers...", subtext: "Somewhere in the cloud, probably" },

  // Fun dev humor
  { icon: Sparkles, text: "Generating witty variable names...", subtext: "const pizzaTime = new Date()" },
  { icon: Coffee, text: "Optimizing the snack break schedule...", subtext: "AI work-life balance is important" },
  { icon: Zap, text: "Converting caffeine to code...", subtext: "It's basically alchemy" },
  { icon: Cpu, text: "Ochsner AI Studio is thinking hard...", subtext: "Neurons firing at maximum capacity" },
  { icon: GitBranch, text: "Branching into possibilities...", subtext: "Every great app starts with git init" },
];

// Pre-computed particle data (computed once at module load)
const particleData = Array.from({ length: 6 }, (_, i) => ({
  id: i,
  startX: (i * 15 + 10), // spread evenly with some offset
  endX: ((i + 3) * 12 + 5) % 100, // deterministic end positions
  duration: 4 + (i * 0.4), // varied but deterministic
  delay: i * 0.5,
}));

// Separate component to handle particle animations with proper SSR handling
function FloatingParticles() {
  const [dimensions, setDimensions] = useState({ width: 1000, height: 800 });

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particleData.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute w-2 h-2 bg-primary/30 rounded-full"
          initial={{
            x: (particle.startX / 100) * dimensions.width,
            y: dimensions.height + 20,
          }}
          animate={{
            y: -20,
            x: (particle.endX / 100) * dimensions.width,
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}

interface ProjectLaunchOverlayProps {
  isVisible: boolean;
  projectName: string;
  onReady?: (projectId: string) => void;
}

export function ProjectLaunchOverlay({ isVisible, projectName }: ProjectLaunchOverlayProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  // Shuffle messages on mount for variety
  const [shuffledMessages] = useState(() => {
    return [...funnyMessages].sort(() => Math.random() - 0.5);
  });

  // Rotate through messages
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % shuffledMessages.length);
    }, 2500);

    return () => clearInterval(interval);
  }, [isVisible, shuffledMessages.length]);

  // Track progress with a ref to avoid the synchronous setState issue
  const progressRef = useRef(0);

  // Animate progress bar (fake progress for UX)
  useEffect(() => {
    if (!isVisible) {
      // Reset ref when not visible (next visibility will start from 0)
      progressRef.current = 0;
      return;
    }

    // Start from 0 when becoming visible
    progressRef.current = 0;

    const interval = setInterval(() => {
      // Slow down as we approach 90% (never quite get there until actually ready)
      let increment = 0;
      if (progressRef.current < 30) increment = 3;
      else if (progressRef.current < 60) increment = 2;
      else if (progressRef.current < 85) increment = 1;
      else if (progressRef.current < 92) increment = 0.2;

      progressRef.current = Math.min(92, progressRef.current + increment);
      setProgress(progressRef.current);
    }, 200);

    return () => clearInterval(interval);
  }, [isVisible]);

  const currentMessage = shuffledMessages[currentMessageIndex];
  const IconComponent = currentMessage.icon;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm"
        >
          <div className="flex flex-col items-center max-w-md px-8 text-center">
            {/* Animated Icon */}
            <motion.div
              key={currentMessageIndex}
              initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0, rotate: 10 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="mb-6"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
                <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
                  <IconComponent className="w-12 h-12 text-primary" />
                </div>
              </div>
            </motion.div>

            {/* Project Name */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-2"
            >
              <span className="text-sm text-muted-foreground">Launching</span>
              <h2 className="text-2xl font-bold text-foreground">{projectName}</h2>
            </motion.div>

            {/* Funny Message */}
            <motion.div
              key={`msg-${currentMessageIndex}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="mb-8 min-h-[60px]"
            >
              <p className="text-lg font-medium text-foreground">
                {currentMessage.text}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {currentMessage.subtext}
              </p>
            </motion.div>

            {/* Progress Bar */}
            <div className="w-full max-w-xs">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {progress < 30 && "Initializing AI agents..."}
                {progress >= 30 && progress < 60 && "Analyzing requirements..."}
                {progress >= 60 && progress < 85 && "Creating project structure..."}
                {progress >= 85 && "Almost ready..."}
              </p>
            </div>

{/* Floating particles effect */}
            <FloatingParticles />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
