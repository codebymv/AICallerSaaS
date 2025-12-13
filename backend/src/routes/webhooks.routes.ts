// ============================================
// Webhook Routes (Twilio)
// ============================================

import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { config } from '../config';
import { TwilioMediaEvent } from '../lib/types';
import { CREDITS_PER_USD, VOICE_MINUTE_RATE_USD } from '../lib/constants';
import { 
  isS3Configured, 
  uploadFromUrl, 
  generateRecordingKey 
} from '../services/storage.service';

const router = Router();

// POST /webhooks/twilio/voice - Initial voice webhook
router.post('/twilio/voice', async (req, res) => {
  try {
    const { agentId, callId } = req.query;
    const { CallSid, From, To, Direction } = req.body;

    logger.info('[Webhook] Voice webhook received', { callSid: CallSid, agentId, callId });

    // Get agent
    const agent = await prisma.agent.findUnique({
      where: { id: agentId as string },
    });

    if (!agent) {
      logger.error('[Webhook] Agent not found', { agentId });
      const errorTwiml = '<?xml version="1.0" encoding="UTF-8"?>' +
        '<Response>' +
          '<Say>Sorry, the agent is not available.</Say>' +
          '<Hangup/>' +
        '</Response>';
      res.type('text/xml').send(errorTwiml);
      return;
    }

    // Validate agent mode matches call direction
    const callDirection = Direction?.toLowerCase() || 'inbound';
    if (callDirection === 'inbound' && agent.mode === 'OUTBOUND') {
      logger.error('[Webhook] Agent mode mismatch - inbound call to outbound-only agent', { agentId, mode: agent.mode });
      const errorTwiml = '<?xml version="1.0" encoding="UTF-8"?>' +
        '<Response>' +
          '<Say>This agent is not configured to receive inbound calls.</Say>' +
          '<Hangup/>' +
        '</Response>';
      res.type('text/xml').send(errorTwiml);
      return;
    }
    
    if (callDirection === 'outbound' && agent.mode === 'INBOUND') {
      logger.error('[Webhook] Agent mode mismatch - outbound call from inbound-only agent', { agentId, mode: agent.mode });
      const errorTwiml = '<?xml version="1.0" encoding="UTF-8"?>' +
        '<Response>' +
          '<Say>This agent is not configured to make outbound calls.</Say>' +
          '<Hangup/>' +
        '</Response>';
      res.type('text/xml').send(errorTwiml);
      return;
    }

    // Update call record for inbound calls
    if (Direction === 'inbound') {
      await prisma.call.create({
        data: {
          callSid: CallSid,
          userId: agent.userId,
          agentId: agent.id,
          direction: 'inbound',
          from: From,
          to: To,
          status: 'in-progress',
          startTime: new Date(),
          // Agent snapshot - preserve agent config at time of call
          agentName: agent.name,
          agentVoice: agent.voice,
          agentVoiceProvider: agent.voiceProvider,
        },
      });
    }

    // Return TwiML to connect to media stream
    // Always use the regular host - Railway's HTTP proxy supports WebSockets
    const protocol = req.secure || req.get('x-forwarded-proto') === 'https' ? 'wss' : 'ws';
    const host = req.get('host');
    // IMPORTANT: & must be escaped as &amp; in XML attributes
    const websocketUrl = `${protocol}://${host}/media-stream?agentId=${agentId}&amp;callSid=${CallSid}`;
    
    console.log('[Webhook] WebSocket URL:', websocketUrl);
    
    logger.info('[Webhook] Connecting to WebSocket:', websocketUrl);
    
    // IMPORTANT: XML declaration MUST be first with NO preceding whitespace
    const twiml = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<Response>' +
        '<Connect>' +
          `<Stream url="${websocketUrl}">` +
            `<Parameter name="agentId" value="${agentId}" />` +
            `<Parameter name="callSid" value="${CallSid}" />` +
          '</Stream>' +
        '</Connect>' +
      '</Response>';

    console.log('[Webhook] Sending TwiML:', twiml);
    
    res.type('text/xml').send(twiml);
  } catch (error) {
    logger.error('[Webhook] Voice error:', error);
    const errorTwiml = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<Response>' +
        '<Say>Sorry, an error occurred.</Say>' +
        '<Hangup/>' +
      '</Response>';
    res.type('text/xml').send(errorTwiml);
  }
});

// POST /webhooks/twilio/status - Call status updates
router.post('/twilio/status', async (req, res) => {
  try {
    const {
      CallSid,
      CallStatus,
      CallDuration,
      RecordingUrl,
      RecordingSid,
    } = req.body;

    logger.info('[Webhook] Status update', { callSid: CallSid, status: CallStatus });

    // Map Twilio status to our status
    const statusMap: Record<string, string> = {
      'queued': 'queued',
      'ringing': 'ringing',
      'in-progress': 'in-progress',
      'completed': 'completed',
      'busy': 'busy',
      'no-answer': 'no-answer',
      'canceled': 'canceled',
      'failed': 'failed',
    };

    const status = statusMap[CallStatus] || CallStatus;

    const updateData: any = {
      status,
    };

    if (CallDuration) {
      updateData.duration = parseInt(CallDuration, 10);
    }

    if (RecordingUrl) {
      updateData.recordingUrl = RecordingUrl;
    }

    if (['completed', 'busy', 'no-answer', 'canceled', 'failed'].includes(status)) {
      updateData.endTime = new Date();
      
      // Calculate cost (approximately $0.0085/min for Twilio + API costs)
      if (CallDuration) {
        const minutes = parseInt(CallDuration, 10) / 60;
        updateData.costUsd = Math.ceil(minutes * 0.05 * 100) / 100; // ~$0.05/min total
        updateData.minutesUsed = minutes;
      }
    }

    await prisma.call.update({
      where: { callSid: CallSid },
      data: updateData,
    });

    if (updateData.minutesUsed) {
      const call = await prisma.call.findUnique({
        where: { callSid: CallSid },
        select: { userId: true },
      });

      if (call) {
        const user = await prisma.user.findUnique({
          where: { id: call.userId },
          select: {
            minutesUsed: true,
            minutesLimit: true,
            creditsBalance: true,
          },
        });

        if (user) {
          const minutesThisCall = Math.ceil(updateData.minutesUsed as number);
          const previousMinutes = user.minutesUsed;
          const newTotalMinutes = previousMinutes + minutesThisCall;

          let overageMinutes = 0;

          if (previousMinutes >= user.minutesLimit) {
            overageMinutes = minutesThisCall;
          } else if (newTotalMinutes > user.minutesLimit) {
            overageMinutes = newTotalMinutes - user.minutesLimit;
          }

          let creditsToDecrement = 0;

          if (overageMinutes > 0) {
            const costUsd = overageMinutes * VOICE_MINUTE_RATE_USD;
            creditsToDecrement = Math.ceil(costUsd * CREDITS_PER_USD);
          }

          await prisma.user.update({
            where: { id: call.userId },
            data: {
              minutesUsed: {
                increment: minutesThisCall,
              },
              ...(creditsToDecrement > 0
                ? {
                    creditsBalance: {
                      decrement: creditsToDecrement,
                    },
                  }
                : {}),
            },
          });
        }
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    logger.error('[Webhook] Status error:', error);
    res.status(500).send('Error');
  }
});

// POST /webhooks/twilio/recording - Recording completed
router.post('/twilio/recording', async (req, res) => {
  try {
    const { CallSid, RecordingUrl, RecordingSid, RecordingDuration } = req.body;

    logger.info('[Webhook] Recording completed', { callSid: CallSid, recordingSid: RecordingSid });

    // First, get the call to find the userId
    const call = await prisma.call.findUnique({
      where: { callSid: CallSid },
      select: { userId: true },
    });

    if (!call) {
      logger.warn('[Webhook] Recording received for unknown call', { callSid: CallSid });
      res.status(200).send('OK'); // Acknowledge to Twilio
      return;
    }

    // Check if S3 is configured - if so, upload the recording to S3
    if (isS3Configured()) {
      try {
        const storageKey = generateRecordingKey(call.userId, CallSid);
        const twilioAuth = 'Basic ' + Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString('base64');
        
        // The RecordingUrl from Twilio doesn't include the format, append .mp3
        const recordingUrlWithFormat = `${RecordingUrl}.mp3`;
        
        logger.info('[Webhook] Uploading recording to S3', { callSid: CallSid, storageKey });
        
        const result = await uploadFromUrl(
          recordingUrlWithFormat,
          storageKey,
          'audio/mpeg',
          twilioAuth
        );
        
        // Update call with S3 storage info
        await prisma.call.update({
          where: { callSid: CallSid },
          data: {
            recordingUrl: RecordingUrl, // Keep Twilio URL as backup
            recordingStorageKey: result.key,
            recordingStorageProvider: 's3',
          },
        });
        
        logger.info('[Webhook] Recording uploaded to S3', { 
          callSid: CallSid, 
          storageKey: result.key,
          size: result.size 
        });
      } catch (s3Error) {
        // If S3 upload fails, still save the Twilio URL
        logger.error('[Webhook] S3 upload failed, falling back to Twilio URL', { callSid: CallSid, error: s3Error });
        await prisma.call.update({
          where: { callSid: CallSid },
          data: {
            recordingUrl: RecordingUrl,
            recordingStorageProvider: 'twilio',
          },
        });
      }
    } else {
      // S3 not configured, just store the Twilio URL
      await prisma.call.update({
        where: { callSid: CallSid },
        data: {
          recordingUrl: RecordingUrl,
          recordingStorageProvider: 'twilio',
        },
      });
    }

    res.status(200).send('OK');
  } catch (error) {
    logger.error('[Webhook] Recording error:', error);
    res.status(500).send('Error');
  }
});

// POST /webhooks/twilio/message-status - SMS/MMS status updates
router.post('/twilio/message-status', async (req, res) => {
  try {
    const {
      MessageSid,
      MessageStatus,
      ErrorCode,
      ErrorMessage,
    } = req.body;

    logger.info('[Webhook] Message status update', { messageSid: MessageSid, status: MessageStatus });

    // Map Twilio message status to our MessageStatus enum
    const statusMap: Record<string, string> = {
      'queued': 'QUEUED',
      'sending': 'QUEUED',
      'sent': 'SENT',
      'delivered': 'DELIVERED',
      'undelivered': 'UNDELIVERED',
      'failed': 'FAILED',
      'received': 'RECEIVED',
    };

    const status = statusMap[MessageStatus] || MessageStatus.toUpperCase();

    // Prepare update data
    const updateData: any = {
      status,
    };

    // Add timestamps based on status
    if (status === 'SENT') {
      updateData.sentAt = new Date();
    }
    if (status === 'DELIVERED') {
      updateData.deliveredAt = new Date();
    }

    // Add error info if present
    if (ErrorCode) {
      updateData.errorCode = ErrorCode;
      updateData.errorMessage = ErrorMessage || null;
    }

    // Update message record
    await prisma.message.update({
      where: { messageSid: MessageSid },
      data: updateData,
    });

    res.status(200).send('OK');
  } catch (error) {
    logger.error('[Webhook] Message status error:', error);
    // Don't return 500 for missing messages - they might have been deleted
    res.status(200).send('OK');
  }
});

export default router;
