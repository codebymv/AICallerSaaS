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
  initializeWebSocket(io);

  // Initialize Twilio Media Stream WebSocket server
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/media-stream'
  });
  setupTwilioMediaStream(wss);

  return { app, httpServer, io };
}
