// ============================================
// Server Configuration
// ============================================

import express from 'express';
import { createServer as createHttpServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { Server as SocketIOServer } from 'socket.io';

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

// WebSocket
import { initializeWebSocket } from './websocket';

export async function createServer() {
  const app = express();
  const httpServer = createHttpServer(app);
  
  // Socket.IO server
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/socket.io',
  });

  // Middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Disable for development
  }));
  
  app.use(cors({
    origin: config.corsOrigin,
    credentials: true,
  }));
  
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  
  app.use(requestLogger);
  
  // Rate limiting (skip in development)
  if (config.nodeEnv === 'production') {
    app.use('/api', rateLimiter);
  }

  // Health check
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/agents', agentRoutes);
  app.use('/api/calls', callRoutes);
  app.use('/api/phone-numbers', phoneNumberRoutes);
  
  // Twilio webhooks (no auth required)
  app.use('/webhooks', webhookRoutes);

  // Error handler
  app.use(errorHandler);

  // Initialize WebSocket handlers
  initializeWebSocket(io);

  return { app, httpServer, io };
}
