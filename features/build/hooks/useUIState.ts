'use client';

import React, { useState, useCallback } from 'react';
import type { Task, MainTab } from '../types';

export interface UseUIStateOptions {
  initialTab?: MainTab;
}

export interface UseUIStateReturn {
  // Main navigation
  mainTab: MainTab;
  setMainTab: (tab: MainTab) => void;

  // Task board
  taskBoardView: 'kanban' | 'epics';
  setTaskBoardView: (view: 'kanban' | 'epics') => void;
  expandedEpics: Set<string>;
  setExpandedEpics: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleEpic: (epicId: string) => void;
  epicSortBy: 'priority' | 'points' | 'status';
  setEpicSortBy: (sortBy: 'priority' | 'points' | 'status') => void;
  epicSortDir: 'asc' | 'desc';
  setEpicSortDir: (dir: 'asc' | 'desc') => void;
  selectedStory: Task | null;
  setSelectedStory: (story: Task | null) => void;

  // File explorer
  selectedFile: string | null;
  setSelectedFile: (file: string | null) => void;
  expandedFolders: Set<string>;
  setExpandedFolders: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleFolder: (folder: string) => void;

  // Panels
  showResearchPanel: boolean;
  setShowResearchPanel: (show: boolean) => void;
  showEpicExplorer: boolean;
  setShowEpicExplorer: (show: boolean) => void;

  // Settings
  settingsTab: 'quick' | 'agents';
  setSettingsTab: (tab: 'quick' | 'agents') => void;
}

export function useUIState({
  initialTab = 'build',
}: UseUIStateOptions = {}): UseUIStateReturn {
  // Main navigation
  const [mainTab, setMainTab] = useState<MainTab>(initialTab);

  // Task board
  const [taskBoardView, setTaskBoardView] = useState<'kanban' | 'epics'>('kanban');
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set());
  const [epicSortBy, setEpicSortBy] = useState<'priority' | 'points' | 'status'>('priority');
  const [epicSortDir, setEpicSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedStory, setSelectedStory] = useState<Task | null>(null);

  // File explorer
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));

  // Panels
  const [showResearchPanel, setShowResearchPanel] = useState(false);
  const [showEpicExplorer, setShowEpicExplorer] = useState(false);

  // Settings
  const [settingsTab, setSettingsTab] = useState<'quick' | 'agents'>('quick');

  // Toggle functions
  const toggleEpic = useCallback((epicId: string) => {
    setExpandedEpics(prev => {
      const next = new Set(prev);
      if (next.has(epicId)) {
        next.delete(epicId);
      } else {
        next.add(epicId);
      }
      return next;
    });
  }, []);

  const toggleFolder = useCallback((folder: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folder)) {
        next.delete(folder);
      } else {
        next.add(folder);
      }
      return next;
    });
  }, []);

  return {
    // Main navigation
    mainTab,
    setMainTab,

    // Task board
    taskBoardView,
    setTaskBoardView,
    expandedEpics,
    setExpandedEpics,
    toggleEpic,
    epicSortBy,
    setEpicSortBy,
    epicSortDir,
    setEpicSortDir,
    selectedStory,
    setSelectedStory,

    // File explorer
    selectedFile,
    setSelectedFile,
    expandedFolders,
    setExpandedFolders,
    toggleFolder,

    // Panels
    showResearchPanel,
    setShowResearchPanel,
    showEpicExplorer,
    setShowEpicExplorer,

    // Settings
    settingsTab,
    setSettingsTab,
  };
}
