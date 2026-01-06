const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

// Disable Turbopack to avoid "missing bootstrap script" error in Next.js 16.0.3
const app = next({ dev, hostname, port, turbo: false });
const handle = app.getRequestHandler();

// Global registry for active orchestrators
global.activeOrchestrators = new Map();
global.serverShuttingDown = false;

// Memory monitoring configuration
const MEMORY_CHECK_INTERVAL_MS = 60000; // Check every minute
const MEMORY_WARNING_THRESHOLD_MB = 512; // Warn at 512MB
const MEMORY_CRITICAL_THRESHOLD_MB = 1024; // Critical at 1GB
let lastMemoryWarning = 0;

// Memory monitoring function
function checkMemoryUsage() {
  const usage = process.memoryUsage();
  const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
  const rssMB = Math.round(usage.rss / 1024 / 1024);
  const externalMB = Math.round(usage.external / 1024 / 1024);

  const now = Date.now();
  const timeSinceLastWarning = now - lastMemoryWarning;

  // Only warn every 5 minutes to avoid log spam
  const shouldWarn = timeSinceLastWarning > 5 * 60 * 1000;

  if (heapUsedMB >= MEMORY_CRITICAL_THRESHOLD_MB) {
    if (shouldWarn) {
      console.error(`🔴 CRITICAL: Memory usage at ${heapUsedMB}MB (heap), ${rssMB}MB (RSS)`);
      console.error(`   Active fleets: ${global.activeOrchestrators?.size || 0}`);
      console.error(`   Consider restarting the server or stopping some builds`);
      lastMemoryWarning = now;
    }
  } else if (heapUsedMB >= MEMORY_WARNING_THRESHOLD_MB) {
    if (shouldWarn) {
      console.warn(`⚠️  Memory usage high: ${heapUsedMB}MB (heap), ${rssMB}MB (RSS)`);
      console.warn(`   Heap total: ${heapTotalMB}MB, External: ${externalMB}MB`);
      console.warn(`   Active fleets: ${global.activeOrchestrators?.size || 0}`);
      lastMemoryWarning = now;
    }
  }

  // Emit memory stats via WebSocket for UI monitoring (if io is available)
  if (global.io) {
    global.io.emit('server:memory', {
      heapUsedMB,
      heapTotalMB,
      rssMB,
      externalMB,
      activeFleets: global.activeOrchestrators?.size || 0,
      timestamp: new Date().toISOString()
    });
  }
}

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize Socket.io
  const io = new Server(httpServer, {
    path: '/api/ws',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // Store io instance globally so it can be accessed by API routes
  global.io = io;

  io.on('connection', (socket) => {
    console.log('✅ Client connected:', socket.id);

    socket.on('join-project', (projectId) => {
      socket.join(`project:${projectId}`);
      console.log(`Client ${socket.id} joined project ${projectId}`);
    });

    socket.on('leave-project', (projectId) => {
      socket.leave(`project:${projectId}`);
      console.log(`Client ${socket.id} left project ${projectId}`);
    });

    socket.on('disconnect', () => {
      console.log('❌ Client disconnected:', socket.id);
    });
  });

  // Graceful shutdown handler
  async function gracefulShutdown(signal) {
    console.log(`\n${signal} received, starting graceful shutdown...`);
    global.serverShuttingDown = true;

    try {
      // Close WebSocket server
      if (io) {
        console.log('Closing WebSocket connections...');
        io.close();
      }

      // Stop all active orchestrators
      if (global.activeOrchestrators && global.activeOrchestrators.size > 0) {
        console.log(`Stopping ${global.activeOrchestrators.size} active orchestrators...`);
        const shutdownPromises = [];

        for (const [projectId, orchestrator] of global.activeOrchestrators) {
          console.log(`  - Stopping orchestrator for project: ${projectId}`);
          if (typeof orchestrator.stop === 'function') {
            shutdownPromises.push(
              orchestrator.stop().catch(err => {
                console.error(`Failed to stop orchestrator ${projectId}:`, err);
              })
            );
          }
        }

        await Promise.all(shutdownPromises);
        global.activeOrchestrators.clear();
      }

      // Clear all Claude agent sessions
      try {
        const { ClaudeAgentService } = require('./services/anthropic-api');
        const claudeService = ClaudeAgentService.getInstance();
        await claudeService.clearAllSessions();
        console.log('All Claude agent sessions cleared');
      } catch (err) {
        console.error('Error clearing Claude sessions:', err);
      }

      // Close HTTP server
      console.log('Closing HTTP server...');
      httpServer.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    } catch (error) {
      console.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  }

  // Register signal handlers
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Global error handlers
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    console.error(error.stack);
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise);
    console.error('Reason:', reason);
    // Don't exit on unhandled rejection, just log it
  });

  httpServer
    .once('error', (err) => {
      console.error(err);
      gracefulShutdown('error');
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> WebSocket server running on ws://${hostname}:${port}/api/ws`);

      // Start memory monitoring
      const memoryInterval = setInterval(checkMemoryUsage, MEMORY_CHECK_INTERVAL_MS);
      console.log(`> Memory monitoring started (checking every ${MEMORY_CHECK_INTERVAL_MS / 1000}s)`);

      // Clear interval on shutdown
      process.on('beforeExit', () => {
        clearInterval(memoryInterval);
      });
    });
});
