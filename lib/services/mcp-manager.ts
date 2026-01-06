/**
 * MCP Manager - Manages Model Context Protocol server lifecycle
 *
 * Handles starting, stopping, and communicating with MCP servers
 * that provide tools and resources to agents.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { McpServerConfig, McpTool, loadServiceCatalog, getEnabledMcpServers } from './service-catalog';

// ============================================================================
// TYPES
// ============================================================================

export interface McpServerInstance {
  config: McpServerConfig;
  process: ChildProcess | null;
  status: 'stopped' | 'starting' | 'running' | 'error';
  error?: string;
  startedAt?: Date;
  tools: McpTool[];
}

export interface McpToolCall {
  serverId: string;
  toolName: string;
  arguments: Record<string, any>;
}

export interface McpToolResult {
  success: boolean;
  result?: any;
  error?: string;
}

// ============================================================================
// MCP MANAGER CLASS
// ============================================================================

class McpManager extends EventEmitter {
  private servers: Map<string, McpServerInstance> = new Map();
  private initialized: boolean = false;

  constructor() {
    super();
  }

  /**
   * Initialize the MCP manager and auto-start enabled servers
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const enabledServers = getEnabledMcpServers();

    for (const config of enabledServers) {
      this.servers.set(config.id, {
        config,
        process: null,
        status: 'stopped',
        tools: config.tools,
      });

      // Auto-start if configured
      if (config.autoStart) {
        await this.startServer(config.id);
      }
    }

    this.initialized = true;
    console.log(`[MCP Manager] Initialized with ${enabledServers.length} servers`);
  }

  /**
   * Start an MCP server by ID
   */
  async startServer(serverId: string): Promise<boolean> {
    const instance = this.servers.get(serverId);
    if (!instance) {
      console.error(`[MCP Manager] Server not found: ${serverId}`);
      return false;
    }

    if (instance.status === 'running') {
      console.log(`[MCP Manager] Server already running: ${serverId}`);
      return true;
    }

    try {
      instance.status = 'starting';
      this.emit('server:starting', serverId);

      // Resolve environment variables
      const env = { ...process.env };
      if (instance.config.env) {
        for (const [key, value] of Object.entries(instance.config.env)) {
          // Replace ${VAR} with actual env value
          const resolved = value.replace(/\$\{(\w+)\}/g, (_, varName) => process.env[varName] || '');
          env[key] = resolved;
        }
      }

      // Spawn the MCP server process
      const proc = spawn(instance.config.command, instance.config.args, {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      instance.process = proc;

      // Handle stdout (MCP messages)
      proc.stdout?.on('data', (data: Buffer) => {
        const message = data.toString();
        this.handleServerMessage(serverId, message);
      });

      // Handle stderr (logs/errors)
      proc.stderr?.on('data', (data: Buffer) => {
        console.log(`[MCP ${serverId}] ${data.toString()}`);
      });

      // Handle process exit
      proc.on('exit', (code) => {
        console.log(`[MCP Manager] Server ${serverId} exited with code ${code}`);
        instance.status = code === 0 ? 'stopped' : 'error';
        instance.process = null;
        this.emit('server:stopped', serverId, code);
      });

      // Wait a bit for startup
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (instance.process && !instance.process.killed) {
        instance.status = 'running';
        instance.startedAt = new Date();
        this.emit('server:started', serverId);
        console.log(`[MCP Manager] Server started: ${serverId}`);
        return true;
      } else {
        instance.status = 'error';
        instance.error = 'Server process terminated unexpectedly';
        return false;
      }
    } catch (error) {
      console.error(`[MCP Manager] Failed to start server ${serverId}:`, error);
      instance.status = 'error';
      instance.error = error instanceof Error ? error.message : 'Unknown error';
      this.emit('server:error', serverId, instance.error);
      return false;
    }
  }

  /**
   * Stop an MCP server by ID
   */
  async stopServer(serverId: string): Promise<boolean> {
    const instance = this.servers.get(serverId);
    if (!instance) return false;

    if (instance.process) {
      instance.process.kill('SIGTERM');
      instance.process = null;
    }

    instance.status = 'stopped';
    this.emit('server:stopped', serverId, 0);
    console.log(`[MCP Manager] Server stopped: ${serverId}`);
    return true;
  }

  /**
   * Get all server instances with their status
   */
  getServers(): McpServerInstance[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get a specific server instance
   */
  getServer(serverId: string): McpServerInstance | undefined {
    return this.servers.get(serverId);
  }

  /**
   * Get all available tools from running servers
   */
  getAvailableTools(): Array<{ serverId: string; tool: McpTool }> {
    const tools: Array<{ serverId: string; tool: McpTool }> = [];

    for (const [serverId, instance] of this.servers) {
      if (instance.status === 'running') {
        for (const tool of instance.tools) {
          tools.push({ serverId, tool });
        }
      }
    }

    return tools;
  }

  /**
   * Call a tool on an MCP server
   */
  async callTool(call: McpToolCall): Promise<McpToolResult> {
    const instance = this.servers.get(call.serverId);

    if (!instance) {
      return { success: false, error: `Server not found: ${call.serverId}` };
    }

    if (instance.status !== 'running' || !instance.process) {
      return { success: false, error: `Server not running: ${call.serverId}` };
    }

    try {
      // Send JSON-RPC request to the MCP server
      const request = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: call.toolName,
          arguments: call.arguments,
        },
      };

      // Write to stdin
      instance.process.stdin?.write(JSON.stringify(request) + '\n');

      // In a real implementation, we'd wait for the response
      // For now, return a placeholder
      return {
        success: true,
        result: { message: 'Tool call sent', request },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Tool call failed',
      };
    }
  }

  /**
   * Handle incoming message from MCP server
   */
  private handleServerMessage(serverId: string, message: string): void {
    try {
      const parsed = JSON.parse(message);
      this.emit('server:message', serverId, parsed);
    } catch {
      // Not JSON, might be a log line
      console.log(`[MCP ${serverId}] ${message}`);
    }
  }

  /**
   * Reload servers from catalog
   */
  async reloadFromCatalog(): Promise<void> {
    // Stop all current servers
    for (const serverId of this.servers.keys()) {
      await this.stopServer(serverId);
    }

    // Clear and reload
    this.servers.clear();
    this.initialized = false;
    await this.initialize();
  }

  /**
   * Shutdown all servers
   */
  async shutdown(): Promise<void> {
    for (const serverId of this.servers.keys()) {
      await this.stopServer(serverId);
    }
    this.servers.clear();
    this.initialized = false;
    console.log('[MCP Manager] Shutdown complete');
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const mcpManager = new McpManager();
export default mcpManager;
