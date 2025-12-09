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
import { decodeFromTwilio } from '../utils/audio';
import { TwilioMediaEvent, TwilioMediaStart, TwilioMediaPayload } from '../lib/types';

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
  logger.info('[MediaStream] WebSocket server listening for connections');
  
  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    console.log('[MediaStream] NEW CONNECTION RECEIVED');
    console.log('[MediaStream] Headers:', req.headers);
    console.log('[MediaStream] URL:', req.url);
    
    // Twilio sends agentId/callSid via <Parameter> tags in TwiML
    // These come in the 'start' event message, not as URL query params
    logger.info('[MediaStream] Connection opened, waiting for start event');

    let session: CallSession | null = null;

    ws.on('message', async (data: Buffer) => {
      try {
        const message: TwilioMediaEvent = JSON.parse(data.toString());

        switch (message.event) {
          case 'start':
            // Extract agentId from custom parameters sent via TwiML <Parameter> tags
            const startMsg = message as TwilioMediaStart;
            const agentId = startMsg.start.customParameters?.agentId;
            
            if (!agentId) {
              logger.error('[MediaStream] No agentId in start event');
              ws.close();
              return;
            }
            
            session = await handleStreamStart(ws, startMsg, agentId);
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
      logger.info('[MediaStream] Connection closed', { callSid: session?.callSid });
      if (session) {
        await handleStreamStop(session);
      }
    });

    ws.on('error', (error) => {
      logger.error('[MediaStream] WebSocket error:', error);
    });
  });

  wss.on('error', (error) => {
    console.error('[MediaStream] WebSocket Server Error:', error);
    logger.error('[MediaStream] Server error:', error);
  });

  wss.on('listening', () => {
    console.log('[MediaStream] WebSocket server is now listening');
    logger.info('[MediaStream] Server listening');
  });

  logger.info('[WebSocket] Twilio Media Stream server initialized');
  console.log('[MediaStream] WebSocket Server initialized on path: /media-stream');
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

  console.log('[MediaStream] Agent found:', {
    id: agent.id,
    name: agent.name,
    greeting: agent.greeting,
    voice: agent.voice,
  });

  // Fetch calendar integration for this user (supports both Calendly and Cal.com)
  let calendarIntegration = null;
  try {
    const calIntegration = await prisma.$queryRaw<Array<{
      provider: string;
      accessToken: string;
      calendlyUserUri: string | null;
      calendlyEventTypeUri: string | null;
      calendlyEventTypeName: string | null;
      calcomApiKey: string | null;
      calcomEventTypeId: number | null;
      calcomEventTypeName: string | null;
      timezone: string;
      isActive: boolean;
    }>>`
      SELECT provider, "accessToken", "calendlyUserUri", "calendlyEventTypeUri", "calendlyEventTypeName",
             "calcomApiKey", "calcomEventTypeId", "calcomEventTypeName", timezone, "isActive"
      FROM "CalendarIntegration"
      WHERE "userId" = ${agent.userId} AND "isActive" = true
      LIMIT 1;
    `;
    
    if (calIntegration.length > 0) {
      const integration = calIntegration[0];
      
      if (integration.provider === 'calcom' && integration.calcomApiKey && integration.calcomEventTypeId) {
        // Cal.com integration
        calendarIntegration = {
          provider: 'calcom' as const,
          calcomApiKey: integration.calcomApiKey,
          calcomEventTypeId: integration.calcomEventTypeId,
          calcomEventTypeName: integration.calcomEventTypeName,
          eventTypeName: integration.calcomEventTypeName,
          timezone: integration.timezone,
        };
        console.log('[MediaStream] Cal.com integration found for user');
      } else if (integration.calendlyEventTypeUri) {
        // Calendly integration
        calendarIntegration = {
          provider: 'calendly' as const,
          accessToken: integration.accessToken,
          calendlyUserUri: integration.calendlyUserUri,
          calendlyEventTypeUri: integration.calendlyEventTypeUri,
          eventTypeName: integration.calendlyEventTypeName,
          timezone: integration.timezone,
        };
        console.log('[MediaStream] Calendly integration found for user');
      }
    }
  } catch (error) {
    logger.warn('[MediaStream] Could not fetch calendar integration:', error);
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

  // Get call direction from database
  const call = await prisma.call.findUnique({
    where: { callSid },
    select: { direction: true },
  });

  // Initialize voice pipeline
  console.log('[MediaStream] Creating voice pipeline...');
  session.pipeline = new VoicePipeline(
    {
      agent,
      callDirection: call?.direction || 'inbound',
      calendarIntegration,
      onTranscript: (text, isFinal, speaker) => {
        console.log('[Pipeline] Transcript:', { text, isFinal, speaker });
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
        console.log('[Pipeline] Audio generated, length:', audio.length);
        // Send audio back through Twilio
        sendAudioToTwilio(ws, streamSid, audio);
      },
      onError: (error) => {
        console.error('[Pipeline] ERROR:', error);
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
  console.log('[MediaStream] Starting voice pipeline...');
  try {
    await session.pipeline.start();
    console.log('[MediaStream] ✅ Voice pipeline started successfully');
  } catch (error) {
    console.error('[MediaStream] ❌ Failed to start pipeline:', error);
    logger.error('[MediaStream] Pipeline start error:', error);
    ws.close();
    return null;
  }

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
    // Get call to calculate duration
    const call = await prisma.call.findUnique({
      where: { callSid: session.callSid },
      select: { startTime: true },
    });

    const endTime = new Date();
    let duration: number | undefined;

    // Calculate duration in seconds if startTime exists
    if (call?.startTime) {
      duration = Math.round((endTime.getTime() - call.startTime.getTime()) / 1000);
    }

    // Save transcript and update call status
    const messages = session.pipeline.getMessages();
    await prisma.call.update({
      where: { callSid: session.callSid },
      data: {
        transcript: messages as any,
        status: 'completed',
        endTime,
        duration,
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
  console.log('[Twilio] sendAudioToTwilio called, audio size:', audio.length);
  
  // Send ENTIRE audio buffer in ONE message (matching ElevenLabs example)
  // ulaw_8000 from ElevenLabs should be sent as a single payload
  const message = {
    event: 'media',
    streamSid,
    media: {
      payload: audio.toString('base64'),
    },
  };
  
  ws.send(JSON.stringify(message));
  console.log('[Twilio] ✅ Entire audio buffer sent to Twilio in one message');

  // Send mark to track playback completion
  const markMessage = {
    event: 'mark',
    streamSid,
    mark: {
      name: `audio_${Date.now()}`,
    },
  };
  ws.send(JSON.stringify(markMessage));
  console.log('[Twilio] ✅ Mark message sent');
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
