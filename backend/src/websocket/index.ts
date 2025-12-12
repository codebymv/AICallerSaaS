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
    let sessionStopped = false; // Guard against duplicate stop handling

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
            if (session && !sessionStopped) {
              sessionStopped = true;
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
      if (session && !sessionStopped) {
        sessionStopped = true;
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

  // Fetch calendar integration using agent's calendarIntegrationId (agent-centric approach)
  let calendarIntegration = null;
  try {
    // Only fetch if agent has calendar enabled AND has a calendar integration assigned
    if (agent.calendarEnabled && agent.calendarIntegrationId) {
      const calIntegration = await prisma.$queryRaw<Array<{
        provider: string;
        accessToken: string;
        calendlyUserUri: string | null;
        calendlyEventTypeUri: string | null;
        calendlyEventTypeName: string | null;
        calcomApiKey: string | null;
        calcomEventTypeId: number | null;
        calcomEventTypeName: string | null;
        googleAccessToken: string | null;
        googleRefreshToken: string | null;
        googleCalendarId: string | null;
        googleUserEmail: string | null;
        timezone: string;
        isActive: boolean;
      }>>`
        SELECT provider, "accessToken", "calendlyUserUri", "calendlyEventTypeUri", "calendlyEventTypeName",
               "calcomApiKey", "calcomEventTypeId", "calcomEventTypeName",
               "googleAccessToken", "googleRefreshToken", "googleCalendarId", "googleUserEmail",
               timezone, "isActive"
        FROM "CalendarIntegration"
        WHERE "id" = ${agent.calendarIntegrationId} AND "isActive" = true
        LIMIT 1;
      `;
      
      if (calIntegration.length > 0) {
        const integration = calIntegration[0];
        
        // Use agent's defaultEventTypeId/defaultEventTypeName if set, otherwise fall back to integration values
        const eventTypeId = agent.defaultEventTypeId ? parseInt(agent.defaultEventTypeId) : integration.calcomEventTypeId;
        const eventTypeName = agent.defaultEventTypeName || integration.calcomEventTypeName || integration.calendlyEventTypeName;
        
        if (integration.provider === 'google' && integration.googleAccessToken) {
          // Google Calendar integration
          calendarIntegration = {
            provider: 'google' as const,
            googleAccessToken: integration.googleAccessToken,
            googleRefreshToken: integration.googleRefreshToken,
            googleCalendarId: integration.googleCalendarId || 'primary',
            googleUserEmail: integration.googleUserEmail,
            timezone: integration.timezone,
            // Agent-specific duration for Google Calendar
            defaultDuration: agent.defaultEventDuration || 30,
          };
          console.log('[MediaStream] Google Calendar integration found for agent:', agent.name);
        } else if (integration.provider === 'calcom' && integration.calcomApiKey) {
          // Cal.com integration - use agent's event type if set
          calendarIntegration = {
            provider: 'calcom' as const,
            calcomApiKey: integration.calcomApiKey,
            calcomEventTypeId: eventTypeId,
            calcomEventTypeName: eventTypeName,
            eventTypeName: eventTypeName,
            timezone: integration.timezone,
          };
          console.log('[MediaStream] Cal.com integration found for agent:', agent.name);
        } else if (integration.calendlyEventTypeUri || agent.defaultEventTypeId) {
          // Calendly integration - use agent's event type if set
          calendarIntegration = {
            provider: 'calendly' as const,
            accessToken: integration.accessToken,
            calendlyUserUri: integration.calendlyUserUri,
            calendlyEventTypeUri: agent.defaultEventTypeId || integration.calendlyEventTypeUri,
            eventTypeName: eventTypeName,
            timezone: integration.timezone,
          };
          console.log('[MediaStream] Calendly integration found for agent:', agent.name);
        }
      }
    } else if (agent.calendarEnabled && !agent.calendarIntegrationId) {
      console.log('[MediaStream] Agent has calendar enabled but no calendar integration assigned');
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

// Track audio chunks for logging (don't spam logs during streaming)
let audioChunkCount = 0;
let totalAudioBytes = 0;

function sendAudioToTwilio(ws: WebSocket, streamSid: string, audio: Buffer) {
  audioChunkCount++;
  totalAudioBytes += audio.length;
  
  // Only log occasionally during streaming to avoid spam
  if (audioChunkCount === 1 || audio.length > 10000) {
    console.log(`[Twilio] Sending audio chunk #${audioChunkCount}, size: ${audio.length} bytes (total: ${totalAudioBytes})`);
  }
  
  // Send audio buffer as media message
  const message = {
    event: 'media',
    streamSid,
    media: {
      payload: audio.toString('base64'),
    },
  };
  
  ws.send(JSON.stringify(message));

  // Only send mark for larger chunks (final or batch mode)
  // This avoids flooding Twilio with mark events during streaming
  if (audio.length > 5000) {
    const markMessage = {
      event: 'mark',
      streamSid,
      mark: {
        name: `audio_${Date.now()}`,
      },
    };
    ws.send(JSON.stringify(markMessage));
  }
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

// ============================================
// Campaign WebSocket Events
// ============================================

export function broadcastCampaignStarted(userId: string, campaignId: string, campaignName: string) {
  broadcastToUser(userId, 'campaign:started', {
    campaignId,
    campaignName,
    timestamp: new Date().toISOString(),
  });
}

export function broadcastCampaignPaused(userId: string, campaignId: string, campaignName: string) {
  broadcastToUser(userId, 'campaign:paused', {
    campaignId,
    campaignName,
    timestamp: new Date().toISOString(),
  });
}

export function broadcastCampaignCompleted(userId: string, campaignId: string, campaignName: string) {
  broadcastToUser(userId, 'campaign:completed', {
    campaignId,
    campaignName,
    timestamp: new Date().toISOString(),
  });
}

export function broadcastCampaignLeadCalled(userId: string, campaignId: string, leadId: string, leadName: string | null, phoneNumber: string) {
  broadcastToUser(userId, 'campaign:lead-called', {
    campaignId,
    leadId,
    leadName,
    phoneNumber,
    timestamp: new Date().toISOString(),
  });
}

export function broadcastCampaignStatsUpdated(userId: string, campaignId: string, stats: any) {
  broadcastToUser(userId, 'campaign:stats-updated', {
    campaignId,
    stats,
    timestamp: new Date().toISOString(),
  });
}

// Export for external access
export function getActiveSessions(): Map<string, CallSession> {
  return activeSessions;
}

export function getActiveCallCount(): number {
  return activeSessions.size;
}
