// ============================================
// Webhook Routes (Twilio)
// ============================================

import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { config } from '../config';
import { TwilioMediaEvent } from '../lib/types';

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

    // Update call record
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

    // Update user minutes used
    if (updateData.minutesUsed) {
      const call = await prisma.call.findUnique({
        where: { callSid: CallSid },
        select: { userId: true },
      });

      if (call) {
        await prisma.user.update({
          where: { id: call.userId },
          data: {
            minutesUsed: {
              increment: Math.ceil(updateData.minutesUsed),
            },
          },
        });
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

    await prisma.call.update({
      where: { callSid: CallSid },
      data: {
        recordingUrl: RecordingUrl,
      },
    });

    res.status(200).send('OK');
  } catch (error) {
    logger.error('[Webhook] Recording error:', error);
    res.status(500).send('Error');
  }
});

export default router;
