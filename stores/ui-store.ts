/**
 * UI Store - State management for UI components
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

type PanelId =
  | 'requirements'
  | 'kanban'
  | 'code-editor'
  | 'live-preview'
  | 'test-runner'
  | 'security-scanner'
  | 'deployment-status'
  | 'agent-chat';

interface PanelState {
  collapsed: boolean;
  fullscreen: boolean;
  width?: number;
  height?: number;
}

interface Dialog {
  id: string;
  type: 'clarification' | 'approval' | 'configuration' | 'cost-warning';
  open: boolean;
  data?: any;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  timestamp: Date;
  read: boolean;
}

interface UIStore {
  // Panel management
  panels: Map<PanelId, PanelState>;
  activePanel: PanelId | null;

  togglePanelCollapse: (panelId: PanelId) => void;
  setPanelFullscreen: (panelId: PanelId, fullscreen: boolean) => void;
  setPanelSize: (panelId: PanelId, width?: number, height?: number) => void;
  setActivePanel: (panelId: PanelId | null) => void;
  resetPanels: () => void;

  // Dialog management
  dialogs: Dialog[];
  openDialog: (type: Dialog['type'], data?: any) => string;
  closeDialog: (dialogId: string) => void;
  updateDialogData: (dialogId: string, data: any) => void;

  // Notifications
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (notificationId: string) => void;
  clearNotifications: () => void;
  getUnreadCount: () => number;

  // Global UI state
  sidebarOpen: boolean;
  darkMode: boolean;
  gridLayout: boolean;

  toggleSidebar: () => void;
  toggleDarkMode: () => void;
  toggleGridLayout: () => void;

  // Loading states
  loading: boolean;
  loadingMessage: string;

  setLoading: (loading: boolean, message?: string) => void;
}

const defaultPanelState: PanelState = {
  collapsed: false,
  fullscreen: false,
};

const createDefaultPanels = (): Map<PanelId, PanelState> => {
  const panels = new Map<PanelId, PanelState>();
  const panelIds: PanelId[] = [
    'requirements',
    'kanban',
    'code-editor',
    'live-preview',
    'test-runner',
    'security-scanner',
    'deployment-status',
    'agent-chat',
  ];

  panelIds.forEach((id) => {
    panels.set(id, { ...defaultPanelState });
  });

  return panels;
};

export const useUIStore = create<UIStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        panels: createDefaultPanels(),
        activePanel: null,

        dialogs: [],

        notifications: [],

        sidebarOpen: true,
        darkMode: false,
        gridLayout: true,

        loading: false,
        loadingMessage: '',

        // Panel actions
        togglePanelCollapse: (panelId) =>
          set((state) => {
            const newPanels = new Map(state.panels);
            const panel = newPanels.get(panelId);

            if (panel) {
              newPanels.set(panelId, {
                ...panel,
                collapsed: !panel.collapsed,
              });
            }

            return { panels: newPanels };
          }),

        setPanelFullscreen: (panelId, fullscreen) =>
          set((state) => {
            const newPanels = new Map(state.panels);

            // If setting fullscreen, collapse all other panels
            if (fullscreen) {
              newPanels.forEach((panel, id) => {
                if (id !== panelId) {
                  newPanels.set(id, { ...panel, collapsed: true });
                } else {
                  newPanels.set(id, { ...panel, fullscreen: true, collapsed: false });
                }
              });
            } else {
              // If exiting fullscreen, restore all panels
              newPanels.forEach((panel, id) => {
                newPanels.set(id, { ...panel, fullscreen: false, collapsed: false });
              });
            }

            return { panels: newPanels };
          }),

        setPanelSize: (panelId, width, height) =>
          set((state) => {
            const newPanels = new Map(state.panels);
            const panel = newPanels.get(panelId);

            if (panel) {
              newPanels.set(panelId, {
                ...panel,
                width,
                height,
              });
            }

            return { panels: newPanels };
          }),

        setActivePanel: (panelId) =>
          set({ activePanel: panelId }),

        resetPanels: () =>
          set({ panels: createDefaultPanels(), activePanel: null }),

        // Dialog actions
        openDialog: (type, data) => {
          const dialogId = `dialog-${Date.now()}`;
          const dialog: Dialog = {
            id: dialogId,
            type,
            open: true,
            data,
          };

          set((state) => ({
            dialogs: [...state.dialogs, dialog],
          }));

          return dialogId;
        },

        closeDialog: (dialogId) =>
          set((state) => ({
            dialogs: state.dialogs.filter((d) => d.id !== dialogId),
          })),

        updateDialogData: (dialogId, data) =>
          set((state) => ({
            dialogs: state.dialogs.map((d) =>
              d.id === dialogId ? { ...d, data } : d
            ),
          })),

        // Notification actions
        addNotification: (notification) => {
          const newNotification: Notification = {
            ...notification,
            id: `notif-${Date.now()}`,
            timestamp: new Date(),
            read: false,
          };

          set((state) => ({
            notifications: [...state.notifications, newNotification],
          }));

          // Auto-dismiss non-critical notifications after 5 seconds
          if (notification.severity !== 'critical') {
            setTimeout(() => {
              set((state) => ({
                notifications: state.notifications.filter(
                  (n) => n.id !== newNotification.id
                ),
              }));
            }, 5000);
          }
        },

        markNotificationRead: (notificationId) =>
          set((state) => ({
            notifications: state.notifications.map((n) =>
              n.id === notificationId ? { ...n, read: true } : n
            ),
          })),

        clearNotifications: () =>
          set({ notifications: [] }),

        getUnreadCount: () => {
          return get().notifications.filter((n) => !n.read).length;
        },

        // Global UI actions
        toggleSidebar: () =>
          set((state) => ({ sidebarOpen: !state.sidebarOpen })),

        toggleDarkMode: () =>
          set((state) => ({ darkMode: !state.darkMode })),

        toggleGridLayout: () =>
          set((state) => ({ gridLayout: !state.gridLayout })),

        // Loading actions
        setLoading: (loading, message = '') =>
          set({ loading, loadingMessage: message }),
      }),
      {
        name: 'ui-storage',
        partialize: (state) => ({
          sidebarOpen: state.sidebarOpen,
          darkMode: state.darkMode,
          gridLayout: state.gridLayout,
          // Don't persist panels, dialogs, notifications
        }),
      }
    )
  )
);
