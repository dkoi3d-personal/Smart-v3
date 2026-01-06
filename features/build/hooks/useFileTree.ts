'use client';

import { useState, useCallback } from 'react';
import type { TreeNode } from '../types';

export interface UseFileTreeOptions {
  projectId: string;
  projectDirectory?: string;
}

export function useFileTree({ projectId, projectDirectory }: UseFileTreeOptions) {
  const [fileTree, setFileTree] = useState<TreeNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContents, setFileContents] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // Toggle folder expansion
  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Load file content
  const loadFileContent = useCallback(
    async (filePath: string) => {
      // Check cache first
      if (fileContents.has(filePath)) {
        setSelectedFile(filePath);
        return fileContents.get(filePath);
      }

      try {
        const response = await fetch(
          `/api/projects/${projectId}/files?path=${encodeURIComponent(filePath)}`
        );
        if (!response.ok) throw new Error('Failed to load file');

        const data = await response.json();
        const content = data.content || '';

        setFileContents((prev) => new Map(prev).set(filePath, content));
        setSelectedFile(filePath);

        return content;
      } catch (err) {
        console.error('Failed to load file:', err);
        return null;
      }
    },
    [projectId, fileContents]
  );

  // Load file tree
  const loadFileTree = useCallback(async () => {
    if (!projectDirectory) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/files`);
      if (!response.ok) throw new Error('Failed to load file tree');

      const data = await response.json();
      if (data.tree) {
        setFileTree(data.tree);
      }
    } catch (err) {
      console.error('Failed to load file tree:', err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, projectDirectory]);

  // Refresh file tree and optionally select a file
  const refreshAndSelect = useCallback(
    async (filePath?: string) => {
      await loadFileTree();
      if (filePath) {
        await loadFileContent(filePath);
      }
    },
    [loadFileTree, loadFileContent]
  );

  // Check for common file types
  const hasPackageJson = Array.from(fileContents.keys()).some(
    (f) => f === 'package.json' || f.endsWith('/package.json')
  );
  const hasIndexHtml = Array.from(fileContents.keys()).some(
    (f) => f === 'index.html' || f.endsWith('/index.html')
  );

  return {
    fileTree,
    setFileTree,
    expandedFolders,
    toggleFolder,
    selectedFile,
    setSelectedFile,
    fileContents,
    setFileContents,
    isLoading,
    loadFileContent,
    loadFileTree,
    refreshAndSelect,
    hasPackageJson,
    hasIndexHtml,
  };
}
