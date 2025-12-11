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
import googleAuthRoutes from './routes/google-auth.routes';
import agentRoutes from './routes/agents.routes';
import callRoutes from './routes/calls.routes';
import webhookRoutes from './routes/webhooks.routes';
import phoneNumberRoutes from './routes/phone-numbers.routes';
import settingsRoutes from './routes/settings.routes';
import calendarRoutes from './routes/calendar.routes';
import contactRoutes from './routes/contacts.routes';
import assetRoutes from './routes/assets.routes';
import messageRoutes from './routes/messages.routes';

// WebSocket
import { initializeWebSocket, setupTwilioMediaStream } from './websocket';

export async function createServer() {
  const app = express();
  const httpServer = createHttpServer(app);
  
  // Initialize Twilio Media Stream WebSocket server FIRST (before Socket.IO)
  console.log('Initializing Twilio Media Stream WebSocket...');
  const wss = new WebSocketServer({ noServer: true });
  
  console.log('[WebSocket] Server created in noServer mode');
  
  // Handle upgrade at the HTTP server level (BEFORE Socket.IO)
  httpServer.on('upgrade', (request, socket, head) => {
    console.log('[UPGRADE] *** Upgrade request received ***');
    console.log('[UPGRADE] URL:', request.url);
    console.log('[UPGRADE] Headers:', JSON.stringify(request.headers, null, 2));
    
    try {
      const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
      console.log('[UPGRADE] Parsed pathname:', pathname);
      
      if (pathname === '/media-stream' || pathname.startsWith('/media-stream')) {
        console.log('[UPGRADE] Path matched /media-stream - handling upgrade');
        
        wss.handleUpgrade(request, socket, head, (ws) => {
          console.log('[UPGRADE] *** UPGRADE SUCCESSFUL ***');
          wss.emit('connection', ws, request);
        });
      } else {
        console.log('[UPGRADE] Path is NOT /media-stream, pathname:', pathname);
        console.log('[UPGRADE] Assuming Socket.IO or other - not destroying');
        // Don't destroy - let Socket.IO or other handlers deal with it
      }
    } catch (error) {
      console.error('[UPGRADE] Error processing upgrade:', error);
      socket.destroy();
    }
  });
  
  // Add connection tracking
  wss.on('connection', (ws, req) => {
    console.log('[WebSocket] *** CONNECTION ESTABLISHED ***');
    console.log('[WebSocket] Client connected from:', req.socket.remoteAddress);
    console.log('[WebSocket] Request URL:', req.url);
  });
  
  wss.on('error', (error) => {
    console.error('[WebSocket] *** SERVER ERROR ***:', error);
  });
  
  // Socket.IO server (initialized AFTER raw WebSocket)
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

  // HTTP handler for /media-stream path (for debugging)
  app.get('/media-stream', (req, res) => {
    console.log('[HTTP] GET request to /media-stream - this should be a WebSocket upgrade!');
    res.status(426).json({
      error: 'Upgrade Required',
      message: 'This endpoint requires WebSocket connection',
      expectedProtocol: 'WebSocket'
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
  app.use('/api/auth', googleAuthRoutes);
  app.use('/api/agents', agentRoutes);
  app.use('/api/calls', callRoutes);
  app.use('/api/contacts', contactRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/phone-numbers', phoneNumberRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/calendar', calendarRoutes);
  app.use('/api/assets', assetRoutes);
  
  // Twilio webhooks (no auth required) - both paths for compatibility
  app.use('/webhooks', webhookRoutes);
  app.use('/api/webhooks', webhookRoutes);

  // Error handler
  app.use(errorHandler);

  // Initialize WebSocket handlers
  try {
    console.log('Initializing Socket.IO dashboard handlers...');
    initializeWebSocket(io);
    console.log('Socket.IO initialized');
  } catch (error) {
    console.error('Failed to initialize Socket.IO:', error);
    throw error;
  }

  // Set up Twilio Media Stream handler (wss already created above)
  try {
    setupTwilioMediaStream(wss);
    console.log('Twilio Media Stream WebSocket initialized');
    console.log('[WebSocket] Waiting for connections...');
  } catch (error) {
    console.error('Failed to initialize Twilio WebSocket:', error);
    throw error;
  }

  console.log('Server setup complete');
  return { app, httpServer, io };
}
