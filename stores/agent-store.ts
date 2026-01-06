/**
 * Agent Store - State management for AI agents
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Agent, AgentType, AgentStatus } from '@/lib/agents/types';

interface AgentStore {
  // State
  agents: Map<AgentType, Agent>;
  activeAgent: AgentType | null;

  // Actions
  initializeAgents: () => void;
  updateAgentStatus: (agentType: AgentType, status: AgentStatus, currentTask?: string) => void;
  updateAgentProgress: (agentType: AgentType, progress: number) => void;
  setActiveAgent: (agentType: AgentType | null) => void;
  getAgent: (agentType: AgentType) => Agent | undefined;
  setAgentSession: (agentType: AgentType, sessionId: string) => void;
  setAgentMessage: (agentType: AgentType, message: string) => void;
  resetAllAgents: () => void;
}

const createAgent = (type: AgentType): Agent => {
  const names: Record<AgentType, string> = {
    supervisor: 'Supervisor',
    research: 'Research Analyst',
    product_owner: 'Product Owner',
    coder: 'Coder',
    tester: 'Tester',
    security: 'Security Analyst',
    infrastructure: 'Infrastructure Engineer',
    architecture: 'Architecture Analyst',
  };

  return {
    id: `${type}-${Date.now()}`,
    type,
    name: names[type],
    status: 'idle',
  };
};

export const useAgentStore = create<AgentStore>()(
  devtools((set, get) => ({
    // Initial state
    agents: new Map(),
    activeAgent: null,

    // Initialize all 8 agents
    initializeAgents: () => {
      const agents = new Map<AgentType, Agent>();
      const types: AgentType[] = [
        'supervisor',
        'research',
        'product_owner',
        'coder',
        'tester',
        'security',
        'infrastructure',
        'architecture',
      ];

      types.forEach((type) => {
        agents.set(type, createAgent(type));
      });

      set({ agents });
    },

    // Update agent status
    updateAgentStatus: (agentType, status, currentTask) =>
      set((state) => {
        const newAgents = new Map(state.agents);
        const agent = newAgents.get(agentType);

        if (agent) {
          newAgents.set(agentType, {
            ...agent,
            status,
            currentTask,
          });
        }

        return { agents: newAgents };
      }),

    // Update agent progress
    updateAgentProgress: (agentType, progress) =>
      set((state) => {
        const newAgents = new Map(state.agents);
        const agent = newAgents.get(agentType);

        if (agent) {
          newAgents.set(agentType, {
            ...agent,
            progress,
          });
        }

        return { agents: newAgents };
      }),

    // Set active agent
    setActiveAgent: (agentType) =>
      set({ activeAgent: agentType }),

    // Get specific agent
    getAgent: (agentType) => {
      return get().agents.get(agentType);
    },

    // Set agent session ID
    setAgentSession: (agentType, sessionId) =>
      set((state) => {
        const newAgents = new Map(state.agents);
        const agent = newAgents.get(agentType);

        if (agent) {
          newAgents.set(agentType, {
            ...agent,
            sessionId,
          });
        }

        return { agents: newAgents };
      }),

    // Set agent last message
    setAgentMessage: (agentType, message) =>
      set((state) => {
        const newAgents = new Map(state.agents);
        const agent = newAgents.get(agentType);

        if (agent) {
          newAgents.set(agentType, {
            ...agent,
            lastMessage: message,
          });
        }

        return { agents: newAgents };
      }),

    // Reset all agents
    resetAllAgents: () => {
      const agents = new Map<AgentType, Agent>();
      const types: AgentType[] = [
        'supervisor',
        'research',
        'product_owner',
        'coder',
        'tester',
        'security',
        'infrastructure',
        'architecture',
      ];

      types.forEach((type) => {
        agents.set(type, createAgent(type));
      });

      set({ agents, activeAgent: null });
    },
  }))
);
