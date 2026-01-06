'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Code2, File, ChevronRight, ChevronDown, Folder, FolderOpen, FileText, RefreshCw } from 'lucide-react';
import { useProjectStore } from '@/stores/project-store';
import { cn } from '@/lib/utils';

// Tree node structure
interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
  file?: any;
}

export function CodeEditor() {
  const { project } = useProjectStore();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [filesFromDisk, setFilesFromDisk] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));

  // Fetch files from the project directory
  const fetchProjectFiles = useCallback(async () => {
    if (!project?.projectId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${project.projectId}/files`);
      if (response.ok) {
        const data = await response.json();
        setFilesFromDisk(data.files || []);
      }
    } catch (error) {
      console.error('Failed to fetch project files:', error);
    } finally {
      setLoading(false);
    }
  }, [project?.projectId]);

  // Fetch files on mount and when project changes (every 10s to reduce load)
  useEffect(() => {
    fetchProjectFiles();
    const interval = setInterval(fetchProjectFiles, 10000);
    return () => clearInterval(interval);
  }, [fetchProjectFiles]);

  // Combine files from store and disk (memoized)
  const codeFiles = useMemo(() => {
    const storeFiles = Array.from(project?.codeFiles?.values() || []);
    return [...storeFiles, ...filesFromDisk];
  }, [project?.codeFiles, filesFromDisk]);

  // Auto-select the most recently modified file
  useEffect(() => {
    if (codeFiles.length > 0 && !selectedFile) {
      const sortedFiles = [...codeFiles].sort((a, b) => {
        const aTime = a.lastModified instanceof Date
          ? a.lastModified.getTime()
          : new Date(a.lastModified || 0).getTime();
        const bTime = b.lastModified instanceof Date
          ? b.lastModified.getTime()
          : new Date(b.lastModified || 0).getTime();
        return bTime - aTime;
      });
      setSelectedFile(sortedFiles[0].path);
    }
  }, [codeFiles.length]);

  // Build tree structure
  const buildTree = (files: typeof codeFiles): TreeNode[] => {
    const root: TreeNode[] = [];
    const folderMap = new Map<string, TreeNode>();

    files.forEach(file => {
      // Normalize path separators (Windows uses \, Unix uses /)
      const normalizedPath = file.path.replace(/\\/g, '/');
      const parts = normalizedPath.split('/').filter((p: string) => p);
      let currentLevel = root;
      let currentPath = '';

      parts.forEach((part: string, index: number) => {
        currentPath += (currentPath ? '/' : '') + part;
        const isFile = index === parts.length - 1;

        if (isFile) {
          // Add file to current level
          currentLevel.push({
            name: part,
            path: file.path,
            type: 'file',
            file: file
          });
        } else {
          // Check if folder already exists
          let folder = folderMap.get(currentPath);
          if (!folder) {
            // Create new folder
            folder = {
              name: part,
              path: currentPath,
              type: 'folder',
              children: []
            };
            folderMap.set(currentPath, folder);
            // Add folder to current level
            currentLevel.push(folder);
          }
          // Move to this folder's children for next iteration
          currentLevel = folder.children!;
        }
      });
    });

    // Sort: folders first, then files alphabetically
    const sortTree = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      nodes.forEach(node => {
        if (node.children) {
          sortTree(node.children);
        }
      });
    };

    sortTree(root);
    return root;
  };

  // Memoize tree to avoid rebuilding on every render
  const tree = useMemo(() => buildTree(codeFiles), [codeFiles]);

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    const isFolder = node.type === 'folder';
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = node.path === selectedFile;

    return (
      <div key={node.path}>
        <div
          className={cn(
            'flex items-center gap-1.5 px-2 py-1.5 text-xs cursor-pointer hover:bg-muted/80 transition-colors',
            isSelected && 'bg-primary/10 font-medium border-l-2 border-primary'
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (isFolder) {
              toggleFolder(node.path);
            } else {
              setSelectedFile(node.path);
            }
          }}
        >
          {isFolder && (
            <div className="flex-shrink-0">
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </div>
          )}
          {isFolder ? (
            isExpanded ? (
              <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
            ) : (
              <Folder className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
            )
          ) : (
            <FileText className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" style={{ marginLeft: '14px' }} />
          )}
          <span className="truncate">{node.name}</span>
          {isFolder && node.children && (
            <span className="ml-auto text-[10px] text-muted-foreground">
              {node.children.length}
            </span>
          )}
          {!isFolder && node.file?.modified && (
            <span className="ml-auto text-orange-500 text-xs">●</span>
          )}
        </div>

        {/* Render children if expanded */}
        {isFolder && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const currentFile = selectedFile ? codeFiles.find(f => f.path === selectedFile) : null;

  return (
    <>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Code2 className="h-4 w-4" />
          Code Editor
          {codeFiles.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {codeFiles.length} files
            </Badge>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-6 w-6 p-0"
            onClick={fetchProjectFiles}
            disabled={loading}
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex gap-2 min-h-0">
        {/* File Tree */}
        <div className="w-64 border-r-2 border-border bg-muted/20">
          {codeFiles.length > 0 ? (
            <ScrollArea className="h-full">
              <div className="py-2">
                {tree.map(node => renderTreeNode(node, 0))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-xs text-muted-foreground text-center py-8 px-4">
              <File className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="font-medium mb-1">No files yet</p>
              <p className="text-[10px]">
                Files will appear here once the Coder agent starts working
              </p>
            </div>
          )}
        </div>

        {/* Code Display */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {currentFile ? (
            <>
              <div className="flex items-center justify-between px-3 py-2 border-b-2 border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <File className="h-4 w-4" />
                  <span className="text-sm font-medium">{currentFile.path}</span>
                </div>
                <Badge variant="outline" className="text-xs border-border">
                  {currentFile.language}
                </Badge>
              </div>
              <ScrollArea className="flex-1 border-2 border-t-0 border-border rounded-b-md">
                <pre className="p-4 text-xs font-mono bg-muted/10">
                  <code>{currentFile.content}</code>
                </pre>
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground border-2 border-border border-dashed rounded-md">
              {codeFiles.length > 0 ? 'Select a file to view' : 'No files to display'}
            </div>
          )}
        </div>
      </CardContent>
    </>
  );
}
