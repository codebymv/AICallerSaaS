// ============================================
// Server Configuration
// ============================================

import express from 'express';
import { createServer as createHttpServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { Server as SocketIOServer } from 'socket.io';
import { WebSocketServer } from 'ws';

import { config } from './config';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { rateLimiter } from './middleware/rate-limiter';

// Routes
import authRoutes from './routes/auth.routes';
import agentRoutes from './routes/agents.routes';
import callRoutes from './routes/calls.routes';
import webhookRoutes from './routes/webhooks.routes';
import phoneNumberRoutes from './routes/phone-numbers.routes';
import settingsRoutes from './routes/settings.routes';

// WebSocket
import { initializeWebSocket, setupTwilioMediaStream } from './websocket';

export async function createServer() {
  const app = express();
  const httpServer = createHttpServer(app);
  
  // Socket.IO server
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.corsOrigin,
      methods: ['GET', 'POST', 'OPTIONS'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization'],
    },
    path: '/socket.io',
  });

  // Handle OPTIONS preflight FIRST - before ANY middleware
  app.options('*', (req, res) => {
    console.log(`OPTIONS ${req.path} from ${req.get('origin')}`);
    res.header('Access-Control-Allow-Origin', config.corsOrigin);
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH,HEAD');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Accept,Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.status(200).send();
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  });

  // WebSocket test endpoint
  app.get('/media-stream-test', (req, res) => {
    res.json({
      message: 'WebSocket endpoint ready',
      path: '/media-stream',
      protocol: req.secure || req.get('x-forwarded-proto') === 'https' ? 'wss' : 'ws',
      fullUrl: `${req.secure || req.get('x-forwarded-proto') === 'https' ? 'wss' : 'ws'}://${req.get('host')}/media-stream`,
    });
  });

  // Basic middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  
  app.use(helmet({
    contentSecurityPolicy: false,
  }));
  
  // Simple CORS for actual requests
  app.use(cors({
    origin: config.corsOrigin,
    credentials: true,
  }));
  
  // Manual logging
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} from ${req.get('origin')}`);
    next();
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/agents', agentRoutes);
  app.use('/api/calls', callRoutes);
  app.use('/api/phone-numbers', phoneNumberRoutes);
  app.use('/api/settings', settingsRoutes);
  
  // Twilio webhooks (no auth required) - both paths for compatibility
  app.use('/webhooks', webhookRoutes);
  app.use('/api/webhooks', webhookRoutes);

  // Error handler
  app.use(errorHandler);

  // Initialize WebSocket handlers
  try {
    console.log('Initializing Socket.IO...');
    initializeWebSocket(io);
    console.log('Socket.IO initialized');
  } catch (error) {
    console.error('Failed to initialize Socket.IO:', error);
    throw error;
  }

  // Initialize Twilio Media Stream WebSocket server
  try {
    console.log('Initializing Twilio Media Stream WebSocket...');
    const wss = new WebSocketServer({ 
      noServer: true  // Use noServer mode for better Railway compatibility
    });
    
    // Handle WebSocket upgrade manually
    httpServer.on('upgrade', (request, socket, head) => {
      try {
        console.log('[WebSocket] Upgrade request received');
        console.log('[WebSocket] URL:', request.url);
        console.log('[WebSocket] Headers:', request.headers);
        
        const { pathname } = new URL(request.url || '', `http://${request.headers.host}`);
        
        console.log('[WebSocket] Parsed pathname:', pathname);
        console.log('[WebSocket] Checking if pathname starts with /media-stream');
        
        if (pathname.startsWith('/media-stream')) {
          console.log('[WebSocket] Path matched! Handling upgrade...');
          wss.handleUpgrade(request, socket, head, (ws) => {
            console.log('[WebSocket] Upgrade successful, emitting connection');
            wss.emit('connection', ws, request);
          });
        } else {
          console.log('[WebSocket] Unknown path:', pathname, '- destroying socket');
          socket.destroy();
        }
      } catch (error) {
        console.error('[WebSocket] Upgrade error:', error);
        socket.destroy();
      }
    });
    
    setupTwilioMediaStream(wss);
    console.log('Twilio Media Stream WebSocket initialized');
  } catch (error) {
    console.error('Failed to initialize Twilio WebSocket:', error);
    throw error;
  }

  console.log('Server setup complete');
  return { app, httpServer, io };
}
