// ============================================
// Backend Entry Point
// ============================================

console.log('===================================');
console.log('Starting AICallerSaaS Backend');
console.log('===================================');

import 'dotenv/config';
import { createServer } from './server';
import { config } from './config';
import { logger } from './utils/logger';

async function main() {
  try {
    // Log startup configuration
    console.log('=== STARTING SERVER ===');
    console.log('NODE_ENV:', config.nodeEnv);
    console.log('PORT:', config.port);
    console.log('CORS_ORIGIN:', config.corsOrigin);
    
    logger.info('Starting server...');
    logger.info(`NODE_ENV: ${config.nodeEnv}`);
    logger.info(`PORT: ${config.port}`);
    logger.info(`CORS_ORIGIN: ${config.corsOrigin}`);
    
    console.log('Creating server...');
    const { httpServer, app } = await createServer();
    console.log('Server created successfully');
    
    console.log(`Attempting to listen on port ${config.port}...`);
    httpServer.listen(config.port, '0.0.0.0', () => {
      console.log('=== SERVER STARTED SUCCESSFULLY ===');
      console.log(`Port: ${config.port}`);
      logger.info(`🚀 Server running on port ${config.port}`);
      logger.info(`📡 WebSocket server ready`);
      logger.info(`🌍 Environment: ${config.nodeEnv}`);
    });

    httpServer.on('error', (error: any) => {
      console.error('=== HTTP SERVER ERROR ===');
      console.error(error);
      logger.error('HTTP Server error:', error);
      process.exit(1);
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down gracefully...');
      httpServer.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
      
      // Force close after 10s
      setTimeout(() => {
        logger.error('Forced shutdown');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    
  } catch (error) {
    console.error('=== FATAL ERROR ===');
    console.error(error);
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Catch unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('=== UNHANDLED REJECTION ===');
  console.error('Reason:', reason);
  console.error('Promise:', promise);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('=== UNCAUGHT EXCEPTION ===');
  console.error(error);
  process.exit(1);
});

main();
