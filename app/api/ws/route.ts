import { NextRequest } from 'next/server';
import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

// This will be initialized once
let io: SocketIOServer | null = null;

export const dynamic = 'force-dynamic';

function initializeSocketIO(server: HTTPServer) {
  if (io) {
    console.log('Socket.io already initialized');
    return io;
  }

  io = new SocketIOServer(server, {
    path: '/api/ws',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join-project', (projectId: string) => {
      socket.join(`project:${projectId}`);
      console.log(`Client ${socket.id} joined project ${projectId}`);
    });

    socket.on('leave-project', (projectId: string) => {
      socket.leave(`project:${projectId}`);
      console.log(`Client ${socket.id} left project ${projectId}`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  console.log('✅ Socket.io initialized');
  return io;
}

export async function GET(req: NextRequest) {
  // For Next.js App Router, we can't directly access the HTTP server
  // We'll return a response indicating WebSocket is available via polling
  return new Response(
    JSON.stringify({
      message: 'WebSocket endpoint - use Socket.io client to connect',
      path: '/api/ws',
      transports: ['websocket', 'polling'],
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

// Note: For production WebSocket with Next.js App Router, consider using:
// - A separate WebSocket server (standalone Node.js server)
// - Next.js custom server (pages/api approach)
// - Vercel's built-in support for WebSocket in Edge Functions
// - Or use polling/SSE for real-time updates
