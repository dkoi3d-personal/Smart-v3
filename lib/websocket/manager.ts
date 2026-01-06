/**
 * WebSocket Manager
 * Handles real-time bidirectional communication between server and clients
 */

import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import type { WebSocketEvent } from '@/lib/agents/types';

export class WebSocketManager {
  private io: SocketIOServer | null = null;
  private connections: Map<string, any> = new Map();

  /**
   * Initialize WebSocket server
   */
  initialize(httpServer: HTTPServer): void {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
      },
      path: '/api/ws',
    });

    this.io.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);
      this.connections.set(socket.id, socket);

      // Send welcome message
      socket.emit('connected', {
        message: 'Connected to Ochsner AI Studio',
        socketId: socket.id,
      });

      // Handle client events
      socket.on('join-project', (projectId: string) => {
        socket.join(`project:${projectId}`);
        console.log(`📂 Socket ${socket.id} joined project ${projectId}`);
      });

      socket.on('leave-project', (projectId: string) => {
        socket.leave(`project:${projectId}`);
        console.log(`📂 Socket ${socket.id} left project ${projectId}`);
      });

      socket.on('clarification-response', (data) => {
        this.broadcast('clarification:response', data);
      });

      socket.on('approval-response', (data) => {
        this.broadcast('approval:response', data);
      });

      socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
        this.connections.delete(socket.id);
      });
    });

    console.log('✅ WebSocket server initialized');
  }

  /**
   * Broadcast event to all connected clients
   */
  broadcast(event: string, data: any): void {
    if (!this.io) {
      console.warn('WebSocket not initialized');
      return;
    }

    this.io.emit(event, data);
  }

  /**
   * Send event to specific project room
   */
  sendToProject(projectId: string, event: string, data: any): void {
    if (!this.io) {
      console.warn('WebSocket not initialized');
      return;
    }

    this.io.to(`project:${projectId}`).emit(event, data);
  }

  /**
   * Send event to specific socket
   */
  sendToSocket(socketId: string, event: string, data: any): void {
    const socket = this.connections.get(socketId);
    if (socket) {
      socket.emit(event, data);
    }
  }

  /**
   * Emit story update
   */
  emitStoryUpdate(projectId: string, story: any): void {
    this.sendToProject(projectId, 'story:update', {
      type: 'story:update',
      payload: story,
      timestamp: new Date(),
    });
  }

  /**
   * Emit code change with typing animation data
   */
  emitCodeChange(projectId: string, change: any): void {
    this.sendToProject(projectId, 'code:change', {
      type: 'code:change',
      payload: {
        ...change,
        animateTyping: true,
        typingSpeed: 50, // ms per character
      },
      timestamp: new Date(),
    });
  }

  /**
   * Emit test result
   */
  emitTestResult(projectId: string, result: any): void {
    this.sendToProject(projectId, 'test:result', {
      type: 'test:result',
      payload: result,
      timestamp: new Date(),
    });
  }

  /**
   * Emit security alert
   */
  emitSecurityAlert(projectId: string, alert: any): void {
    this.sendToProject(projectId, 'security:alert', {
      type: 'security:alert',
      payload: alert,
      timestamp: new Date(),
    });

    // Also send browser notification if critical
    if (alert.severity === 'critical') {
      this.sendToProject(projectId, 'notification', {
        title: 'Critical Security Alert',
        message: alert.title,
        severity: 'critical',
      });
    }
  }

  /**
   * Emit deployment progress
   */
  emitDeploymentProgress(projectId: string, progress: any): void {
    this.sendToProject(projectId, 'deployment:progress', {
      type: 'deployment:progress',
      payload: progress,
      timestamp: new Date(),
    });
  }

  /**
   * Emit agent status update
   */
  emitAgentStatus(projectId: string, agent: any): void {
    this.sendToProject(projectId, 'agent:status', {
      type: 'agent:status',
      payload: agent,
      timestamp: new Date(),
    });
  }

  /**
   * Emit agent message
   */
  emitAgentMessage(projectId: string, message: any): void {
    this.sendToProject(projectId, 'agent:message', {
      type: 'message',
      payload: message,
      timestamp: new Date(),
    });
  }

  /**
   * Request clarification from user (blocks workflow)
   */
  emitClarificationRequest(projectId: string, request: any): void {
    this.sendToProject(projectId, 'clarification:request', {
      type: 'clarification:request',
      payload: request,
      timestamp: new Date(),
    });

    // Send browser notification
    this.sendToProject(projectId, 'notification', {
      title: 'Clarification Needed',
      message: request.question,
      severity: request.priority,
      requiresResponse: true,
    });
  }

  /**
   * Request approval from user
   */
  emitApprovalRequest(projectId: string, request: any): void {
    this.sendToProject(projectId, 'approval:request', {
      type: 'approval:request',
      payload: request,
      timestamp: new Date(),
    });

    // Send browser notification
    this.sendToProject(projectId, 'notification', {
      title: 'Approval Required',
      message: request.message,
      severity: 'high',
      requiresResponse: true,
    });
  }

  /**
   * Emit approval gate created - requires user decision
   */
  emitApprovalGateCreated(projectId: string, gate: any): void {
    this.sendToProject(projectId, 'approval:gate:created', {
      type: 'approval:gate:created',
      payload: gate,
      timestamp: new Date(),
    });

    // Send browser notification
    this.sendToProject(projectId, 'notification', {
      title: gate.title || 'Approval Required',
      message: gate.description || 'The AI is waiting for your approval to continue.',
      severity: 'high',
      requiresResponse: true,
      gateId: gate.id,
    });
  }

  /**
   * Emit approval gate resolved (approved/rejected)
   */
  emitApprovalGateResolved(projectId: string, gate: any): void {
    this.sendToProject(projectId, 'approval:gate:resolved', {
      type: 'approval:gate:resolved',
      payload: gate,
      timestamp: new Date(),
    });
  }

  /**
   * Emit approval gate timeout
   */
  emitApprovalGateTimeout(projectId: string, gate: any): void {
    this.sendToProject(projectId, 'approval:gate:timeout', {
      type: 'approval:gate:timeout',
      payload: gate,
      timestamp: new Date(),
    });

    // Send browser notification
    this.sendToProject(projectId, 'notification', {
      title: 'Approval Timed Out',
      message: `The approval for "${gate.title}" has expired.`,
      severity: 'warning',
    });
  }

  /**
   * Emit workflow status change
   */
  emitWorkflowStatus(projectId: string, status: string, details?: any): void {
    this.sendToProject(projectId, 'workflow:status', {
      type: 'workflow:status',
      payload: {
        status,
        details,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Emit error
   */
  emitError(projectId: string, error: any): void {
    this.sendToProject(projectId, 'error', {
      type: 'error',
      payload: error,
      timestamp: new Date(),
    });
  }

  /**
   * Get number of active connections
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get connections for specific project
   */
  getProjectConnectionCount(projectId: string): number {
    if (!this.io) return 0;

    const room = this.io.sockets.adapter.rooms.get(`project:${projectId}`);
    return room ? room.size : 0;
  }

  /**
   * Close WebSocket server
   */
  close(): void {
    if (this.io) {
      this.io.close();
      this.io = null;
      this.connections.clear();
      console.log('WebSocket server closed');
    }
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();
