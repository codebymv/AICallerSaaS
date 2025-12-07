import { createServer } from 'http';
import { Server } from 'socket.io';
import { initializeWebSocketServer } from './lib/websocket';

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

initializeWebSocketServer(io);

const PORT = process.env.WS_PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`WebSocket server listening on port ${PORT}`);
});
