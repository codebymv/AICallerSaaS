// ============================================
// WebSocket Server - Real-time Call Handling
// ============================================

import { Server as SocketIOServer, Socket } from 'socket.io';
import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { prisma } from '../lib/prisma';
import { VoicePipeline } from '../services/voice-pipeline';
import { logger } from '../utils/logger';
import { metricsCollector } from '../utils/metrics';
import { decodeFromTwilio, encodeForTwilio, chunkAudio } from '../utils/audio';
import { TwilioMediaEvent, TwilioMediaStart, TwilioMediaPayload } from '@aicaller/shared';

interface CallSession {
  callSid: string;
  streamSid: string | null;
  agentId: string;
  userId: string;
  pipeline: VoicePipeline | null;
  ws: WebSocket;
}

const activeSessions = new Map<string, CallSession>();

// Dashboard clients for real-time updates
const dashboardClients = new Map<string, Set<Socket>>();

export function initializeWebSocket(io: SocketIOServer) {
  // Handle Socket.IO connections (Dashboard clients)
  io.on('connection', (socket) => {
    logger.debug('[WebSocket] Dashboard client connected:', socket.id);

    socket.on('subscribe_dashboard', async (data: { userId: string }) => {
      const { userId } = data;
      
      if (!dashboardClients.has(userId)) {
        dashboardClients.set(userId, new Set());
      }
      dashboardClients.get(userId)!.add(socket);

      // Send current active calls
      const activeCalls = Array.from(activeSessions.values())
        .filter((s) => s.userId === userId)
        .map((s) => ({
          callSid: s.callSid,
          agentId: s.agentId,
          state: s.pipeline?.getState() || 'unknown',
        }));

      socket.emit('active_calls', activeCalls);
    });

    socket.on('disconnect', () => {
      // Remove from all dashboard subscriptions
      for (const [userId, clients] of dashboardClients.entries()) {
        clients.delete(socket);
        if (clients.size === 0) {
          dashboardClients.delete(userId);
        }
      }
    });
  });

  // Note: Twilio Media Streams require raw WebSocket (ws library)
  // This should be set up on the HTTP server separately
  logger.info('[WebSocket] Socket.IO server initialized');
}

/**
 * Set up raw WebSocket server for Twilio Media Streams
 */
export function setupTwilioMediaStream(wss: WebSocketServer) {
  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const agentId = url.searchParams.get('agentId');
    const callSid = url.searchParams.get('callSid');

    logger.info('[MediaStream] Connection opened', { agentId, callSid });

    if (!agentId || !callSid) {
      logger.error('[MediaStream] Missing agentId or callSid');
      ws.close();
      return;
    }

    let session: CallSession | null = null;

    ws.on('message', async (data: Buffer) => {
      try {
        const message: TwilioMediaEvent = JSON.parse(data.toString());

        switch (message.event) {
          case 'start':
            session = await handleStreamStart(ws, message as TwilioMediaStart, agentId);
            break;

          case 'media':
            if (session?.pipeline) {
              await handleMediaPayload(session, message as TwilioMediaPayload);
            }
            break;

          case 'mark':
            // Mark events indicate audio playback progress
            logger.debug('[MediaStream] Mark received:', message.mark);
            break;

          case 'stop':
            if (session) {
              await handleStreamStop(session);
            }
            break;
        }
      } catch (error) {
        logger.error('[MediaStream] Message error:', error);
      }
    });

    ws.on('close', async () => {
      logger.info('[MediaStream] Connection closed', { callSid });
      if (session) {
        await handleStreamStop(session);
      }
    });

    ws.on('error', (error) => {
      logger.error('[MediaStream] WebSocket error:', error);
    });
  });

  logger.info('[WebSocket] Twilio Media Stream server initialized');
}

async function handleStreamStart(
  ws: WebSocket,
  message: TwilioMediaStart,
  agentId: string
): Promise<CallSession | null> {
  const { streamSid, callSid, customParameters } = message.start;

  logger.info('[MediaStream] Stream started', { streamSid, callSid, agentId });

  // Fetch agent
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: { user: true },
  });

  if (!agent) {
    logger.error('[MediaStream] Agent not found:', agentId);
    ws.close();
    return null;
  }

  // Create session
  const session: CallSession = {
    callSid,
    streamSid,
    agentId,
    userId: agent.userId,
    pipeline: null,
    ws,
  };

  // Initialize voice pipeline
  session.pipeline = new VoicePipeline(
    {
      agent,
      onTranscript: (text, isFinal, speaker) => {
        // Broadcast to dashboard
        broadcastToUser(agent.userId, 'transcript', {
          callSid,
          text,
          isFinal,
          speaker,
          timestamp: Date.now(),
        });
      },
      onAudio: (audio) => {
        // Send audio back through Twilio
        sendAudioToTwilio(ws, streamSid, audio);
      },
      onError: (error) => {
        logger.error('[Pipeline] Error:', error);
        broadcastToUser(agent.userId, 'error', {
          callSid,
          message: error.message,
        });
      },
      onLatencyMetrics: (metrics) => {
        broadcastToUser(agent.userId, 'latency_metrics', {
          callSid,
          ...metrics,
        });
      },
    },
    callSid
  );

  // Handle interruption
  session.pipeline.on('interrupt', () => {
    // Clear Twilio's audio queue
    sendClearMessage(ws, streamSid);
  });

  // Start the pipeline
  await session.pipeline.start();

  // Store session
  activeSessions.set(callSid, session);
  metricsCollector.getTracker(callSid);

  // Notify dashboard
  broadcastToUser(agent.userId, 'call_started', {
    callSid,
    streamSid,
    agentId,
  });

  return session;
}

async function handleMediaPayload(session: CallSession, message: TwilioMediaPayload) {
  const audioPayload = message.media.payload;
  const audioBuffer = decodeFromTwilio(audioPayload);

  // Process audio through pipeline
  await session.pipeline?.processAudio(audioBuffer);
}

async function handleStreamStop(session: CallSession) {
  logger.info('[MediaStream] Stopping session', { callSid: session.callSid });

  // Stop pipeline
  if (session.pipeline) {
    // Save transcript to database
    const messages = session.pipeline.getMessages();
    await prisma.call.update({
      where: { callSid: session.callSid },
      data: {
        transcript: messages as any,
        status: 'completed',
        endTime: new Date(),
      },
    });

    await session.pipeline.stop();
  }

  // Clean up
  activeSessions.delete(session.callSid);
  metricsCollector.removeTracker(session.callSid);

  // Notify dashboard
  broadcastToUser(session.userId, 'call_ended', {
    callSid: session.callSid,
  });
}

function sendAudioToTwilio(ws: WebSocket, streamSid: string, audio: Buffer) {
  // Chunk audio for streaming
  const chunks = chunkAudio(audio, 160); // 20ms chunks

  for (const chunk of chunks) {
    const message = {
      event: 'media',
      streamSid,
      media: {
        payload: encodeForTwilio(chunk),
      },
    };
    ws.send(JSON.stringify(message));
  }

  // Send mark to track playback
  const markMessage = {
    event: 'mark',
    streamSid,
    mark: {
      name: `audio_${Date.now()}`,
    },
  };
  ws.send(JSON.stringify(markMessage));
}

function sendClearMessage(ws: WebSocket, streamSid: string) {
  const message = {
    event: 'clear',
    streamSid,
  };
  ws.send(JSON.stringify(message));
}

function broadcastToUser(userId: string, event: string, data: any) {
  const clients = dashboardClients.get(userId);
  if (clients) {
    for (const socket of clients) {
      socket.emit(event, data);
    }
  }
}

// Export for external access
export function getActiveSessions(): Map<string, CallSession> {
  return activeSessions;
}

export function getActiveCallCount(): number {
  return activeSessions.size;
}
