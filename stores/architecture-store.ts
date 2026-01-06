/**
 * Architecture Store - State management for architecture documentation
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  ArchitectureOverview,
  ArchitectureDiagram,
  ComponentDoc,
  DataModel,
  APIDocumentation,
  APIEndpoint,
  AgentDocumentation,
  ArchitectureGenerationStatus,
  DiagramType,
  TechStackItem,
  DesignPattern,
} from '@/lib/architecture/types';

type ArchitectureTab = 'overview' | 'diagrams' | 'components' | 'data-models' | 'api' | 'agents';

interface ArchitectureStore {
  // State
  overview: ArchitectureOverview | null;
  selectedDiagram: ArchitectureDiagram | null;
  selectedComponent: ComponentDoc | null;
  selectedDataModel: DataModel | null;
  selectedEndpoint: APIEndpoint | null;
  selectedAgent: AgentDocumentation | null;
  activeTab: ArchitectureTab;
  generationStatus: ArchitectureGenerationStatus | null;
  isGenerating: boolean;
  error: string | null;

  // Search and filters
  searchQuery: string;
  filters: {
    diagramType?: DiagramType;
    componentType?: ComponentDoc['type'];
    apiMethod?: APIEndpoint['method'];
    agentType?: string;
  };

  // Actions - Overview
  setOverview: (overview: ArchitectureOverview) => void;
  clearOverview: () => void;

  // Actions - Selection
  selectDiagram: (diagram: ArchitectureDiagram | null) => void;
  selectComponent: (component: ComponentDoc | null) => void;
  selectDataModel: (model: DataModel | null) => void;
  selectEndpoint: (endpoint: APIEndpoint | null) => void;
  selectAgent: (agent: AgentDocumentation | null) => void;

  // Actions - Navigation
  setActiveTab: (tab: ArchitectureTab) => void;

  // Actions - Generation
  setGenerationStatus: (status: ArchitectureGenerationStatus) => void;
  startGeneration: () => void;
  completeGeneration: () => void;
  setGenerationError: (error: string) => void;

  // Actions - Diagrams
  addDiagram: (diagram: ArchitectureDiagram) => void;
  updateDiagram: (id: string, updates: Partial<ArchitectureDiagram>) => void;
  removeDiagram: (id: string) => void;

  // Actions - Components
  addComponent: (component: ComponentDoc) => void;
  updateComponent: (id: string, updates: Partial<ComponentDoc>) => void;
  removeComponent: (id: string) => void;

  // Actions - Data Models
  addDataModel: (model: DataModel) => void;
  updateDataModel: (id: string, updates: Partial<DataModel>) => void;
  removeDataModel: (id: string) => void;

  // Actions - API
  setAPIDocumentation: (docs: APIDocumentation) => void;
  addEndpoint: (endpoint: APIEndpoint) => void;
  updateEndpoint: (id: string, updates: Partial<APIEndpoint>) => void;
  removeEndpoint: (id: string) => void;

  // Actions - Agents
  addAgentDoc: (agent: AgentDocumentation) => void;
  updateAgentDoc: (id: string, updates: Partial<AgentDocumentation>) => void;
  removeAgentDoc: (id: string) => void;

  // Actions - Search & Filter
  setSearchQuery: (query: string) => void;
  setFilter: (key: keyof ArchitectureStore['filters'], value: string | undefined) => void;
  clearFilters: () => void;

  // Computed getters
  getFilteredDiagrams: () => ArchitectureDiagram[];
  getFilteredComponents: () => ComponentDoc[];
  getFilteredEndpoints: () => APIEndpoint[];
  getFilteredAgents: () => AgentDocumentation[];

  // Reset
  reset: () => void;
}

const initialState = {
  overview: null,
  selectedDiagram: null,
  selectedComponent: null,
  selectedDataModel: null,
  selectedEndpoint: null,
  selectedAgent: null,
  activeTab: 'overview' as ArchitectureTab,
  generationStatus: null,
  isGenerating: false,
  error: null,
  searchQuery: '',
  filters: {},
};

export const useArchitectureStore = create<ArchitectureStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // Overview actions
      setOverview: (overview) => set({ overview, error: null }),
      clearOverview: () => set({ overview: null }),

      // Selection actions
      selectDiagram: (diagram) => set({ selectedDiagram: diagram }),
      selectComponent: (component) => set({ selectedComponent: component }),
      selectDataModel: (model) => set({ selectedDataModel: model }),
      selectEndpoint: (endpoint) => set({ selectedEndpoint: endpoint }),
      selectAgent: (agent) => set({ selectedAgent: agent }),

      // Navigation
      setActiveTab: (tab) => set({ activeTab: tab }),

      // Generation actions
      setGenerationStatus: (status) => set({ generationStatus: status }),
      startGeneration: () => set({ isGenerating: true, error: null }),
      completeGeneration: () => set({ isGenerating: false }),
      setGenerationError: (error) => set({ error, isGenerating: false }),

      // Diagram actions
      addDiagram: (diagram) =>
        set((state) => {
          if (!state.overview) return state;
          return {
            overview: {
              ...state.overview,
              diagrams: [...state.overview.diagrams, diagram],
              lastUpdated: new Date(),
            },
          };
        }),

      updateDiagram: (id, updates) =>
        set((state) => {
          if (!state.overview) return state;
          return {
            overview: {
              ...state.overview,
              diagrams: state.overview.diagrams.map((d) =>
                d.id === id ? { ...d, ...updates, lastUpdated: new Date(), version: d.version + 1 } : d
              ),
              lastUpdated: new Date(),
            },
          };
        }),

      removeDiagram: (id) =>
        set((state) => {
          if (!state.overview) return state;
          return {
            overview: {
              ...state.overview,
              diagrams: state.overview.diagrams.filter((d) => d.id !== id),
              lastUpdated: new Date(),
            },
            selectedDiagram: state.selectedDiagram?.id === id ? null : state.selectedDiagram,
          };
        }),

      // Component actions
      addComponent: (component) =>
        set((state) => {
          if (!state.overview) return state;
          return {
            overview: {
              ...state.overview,
              components: [...state.overview.components, component],
              lastUpdated: new Date(),
            },
          };
        }),

      updateComponent: (id, updates) =>
        set((state) => {
          if (!state.overview) return state;
          return {
            overview: {
              ...state.overview,
              components: state.overview.components.map((c) =>
                c.id === id ? { ...c, ...updates } : c
              ),
              lastUpdated: new Date(),
            },
          };
        }),

      removeComponent: (id) =>
        set((state) => {
          if (!state.overview) return state;
          return {
            overview: {
              ...state.overview,
              components: state.overview.components.filter((c) => c.id !== id),
              lastUpdated: new Date(),
            },
            selectedComponent: state.selectedComponent?.id === id ? null : state.selectedComponent,
          };
        }),

      // Data Model actions
      addDataModel: (model) =>
        set((state) => {
          if (!state.overview) return state;
          return {
            overview: {
              ...state.overview,
              dataModels: [...state.overview.dataModels, model],
              lastUpdated: new Date(),
            },
          };
        }),

      updateDataModel: (id, updates) =>
        set((state) => {
          if (!state.overview) return state;
          return {
            overview: {
              ...state.overview,
              dataModels: state.overview.dataModels.map((m) =>
                m.id === id ? { ...m, ...updates } : m
              ),
              lastUpdated: new Date(),
            },
          };
        }),

      removeDataModel: (id) =>
        set((state) => {
          if (!state.overview) return state;
          return {
            overview: {
              ...state.overview,
              dataModels: state.overview.dataModels.filter((m) => m.id !== id),
              lastUpdated: new Date(),
            },
            selectedDataModel: state.selectedDataModel?.id === id ? null : state.selectedDataModel,
          };
        }),

      // API actions
      setAPIDocumentation: (docs) =>
        set((state) => {
          if (!state.overview) return state;
          return {
            overview: {
              ...state.overview,
              apiDocumentation: docs,
              lastUpdated: new Date(),
            },
          };
        }),

      addEndpoint: (endpoint) =>
        set((state) => {
          if (!state.overview?.apiDocumentation) return state;
          return {
            overview: {
              ...state.overview,
              apiDocumentation: {
                ...state.overview.apiDocumentation,
                endpoints: [...state.overview.apiDocumentation.endpoints, endpoint],
                lastGenerated: new Date(),
              },
              lastUpdated: new Date(),
            },
          };
        }),

      updateEndpoint: (id, updates) =>
        set((state) => {
          if (!state.overview?.apiDocumentation) return state;
          return {
            overview: {
              ...state.overview,
              apiDocumentation: {
                ...state.overview.apiDocumentation,
                endpoints: state.overview.apiDocumentation.endpoints.map((e) =>
                  e.id === id ? { ...e, ...updates } : e
                ),
                lastGenerated: new Date(),
              },
              lastUpdated: new Date(),
            },
          };
        }),

      removeEndpoint: (id) =>
        set((state) => {
          if (!state.overview?.apiDocumentation) return state;
          return {
            overview: {
              ...state.overview,
              apiDocumentation: {
                ...state.overview.apiDocumentation,
                endpoints: state.overview.apiDocumentation.endpoints.filter((e) => e.id !== id),
                lastGenerated: new Date(),
              },
              lastUpdated: new Date(),
            },
            selectedEndpoint: state.selectedEndpoint?.id === id ? null : state.selectedEndpoint,
          };
        }),

      // Agent documentation actions
      addAgentDoc: (agent) =>
        set((state) => {
          if (!state.overview) return state;
          return {
            overview: {
              ...state.overview,
              agents: [...state.overview.agents, agent],
              lastUpdated: new Date(),
            },
          };
        }),

      updateAgentDoc: (id, updates) =>
        set((state) => {
          if (!state.overview) return state;
          return {
            overview: {
              ...state.overview,
              agents: state.overview.agents.map((a) =>
                a.id === id ? { ...a, ...updates } : a
              ),
              lastUpdated: new Date(),
            },
          };
        }),

      removeAgentDoc: (id) =>
        set((state) => {
          if (!state.overview) return state;
          return {
            overview: {
              ...state.overview,
              agents: state.overview.agents.filter((a) => a.id !== id),
              lastUpdated: new Date(),
            },
            selectedAgent: state.selectedAgent?.id === id ? null : state.selectedAgent,
          };
        }),

      // Search & Filter actions
      setSearchQuery: (query) => set({ searchQuery: query }),
      setFilter: (key, value) =>
        set((state) => ({
          filters: { ...state.filters, [key]: value },
        })),
      clearFilters: () => set({ filters: {}, searchQuery: '' }),

      // Computed getters
      getFilteredDiagrams: () => {
        const { overview, searchQuery, filters } = get();
        if (!overview) return [];

        let diagrams = overview.diagrams;

        if (filters.diagramType) {
          diagrams = diagrams.filter((d) => d.type === filters.diagramType);
        }

        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          diagrams = diagrams.filter(
            (d) =>
              d.name.toLowerCase().includes(query) ||
              d.description.toLowerCase().includes(query)
          );
        }

        return diagrams;
      },

      getFilteredComponents: () => {
        const { overview, searchQuery, filters } = get();
        if (!overview) return [];

        let components = overview.components;

        if (filters.componentType) {
          components = components.filter((c) => c.type === filters.componentType);
        }

        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          components = components.filter(
            (c) =>
              c.name.toLowerCase().includes(query) ||
              c.description.toLowerCase().includes(query) ||
              c.path.toLowerCase().includes(query)
          );
        }

        return components;
      },

      getFilteredEndpoints: () => {
        const { overview, searchQuery, filters } = get();
        if (!overview?.apiDocumentation) return [];

        let endpoints = overview.apiDocumentation.endpoints;

        if (filters.apiMethod) {
          endpoints = endpoints.filter((e) => e.method === filters.apiMethod);
        }

        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          endpoints = endpoints.filter(
            (e) =>
              e.path.toLowerCase().includes(query) ||
              e.summary.toLowerCase().includes(query) ||
              e.description.toLowerCase().includes(query)
          );
        }

        return endpoints;
      },

      getFilteredAgents: () => {
        const { overview, searchQuery, filters } = get();
        if (!overview) return [];

        let agents = overview.agents;

        if (filters.agentType) {
          agents = agents.filter((a) => a.type === filters.agentType);
        }

        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          agents = agents.filter(
            (a) =>
              a.name.toLowerCase().includes(query) ||
              a.description.toLowerCase().includes(query) ||
              a.type.toLowerCase().includes(query)
          );
        }

        return agents;
      },

      // Reset
      reset: () => set(initialState),
    }),
    { name: 'architecture-store' }
  )
);
