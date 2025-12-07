// ============================================
// Backend Entry Point
// ============================================

import 'dotenv/config';
import { createServer } from './server';
import { config } from './config';
import { logger } from './utils/logger';

async function main() {
  try {
    const { httpServer, app } = await createServer();
    
    httpServer.listen(config.port, () => {
      logger.info(`🚀 Server running on port ${config.port}`);
      logger.info(`📡 WebSocket server ready`);
      logger.info(`🌍 Environment: ${config.nodeEnv}`);
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
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
