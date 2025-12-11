// ============================================
// Twilio Service
// ============================================

import twilio from 'twilio';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
}

export class TwilioService {
  private client: ReturnType<typeof twilio>;
  private accountSid: string;

  /**
   * Create a TwilioService instance
   * @param credentials - Optional user-provided credentials. Falls back to env vars if not provided.
   */
  constructor(credentials?: TwilioCredentials) {
    const accountSid = credentials?.accountSid || config.twilioAccountSid;
    const authToken = credentials?.authToken || config.twilioAuthToken;
    
    this.accountSid = accountSid;
    this.client = twilio(accountSid, authToken);
  }

  /**
   * Validate Twilio credentials by fetching account info
   */
  async validateCredentials(): Promise<{ friendlyName: string; status: string }> {
    try {
      const account = await this.client.api.accounts(this.accountSid).fetch();
      return {
        friendlyName: account.friendlyName,
        status: account.status,
      };
    } catch (error: any) {
      logger.error('[Twilio] Credential validation failed:', error.message);
      throw new Error('Invalid Twilio credentials');
    }
  }

  /**
   * List phone numbers owned by this Twilio account
   */
  async listPhoneNumbers(): Promise<Array<{
    phoneNumber: string;
    sid: string;
    friendlyName: string;
    capabilities: any;
  }>> {
    try {
      const numbers = await this.client.incomingPhoneNumbers.list({ limit: 100 });
      return numbers.map((n) => ({
        phoneNumber: n.phoneNumber,
        sid: n.sid,
        friendlyName: n.friendlyName,
        capabilities: n.capabilities,
      }));
    } catch (error) {
      logger.error('[Twilio] List phone numbers error:', error);
      throw error;
    }
  }

  /**
   * Configure webhook URLs for an existing phone number
   */
  async configurePhoneNumber(sid: string, webhookBaseUrl: string, agentId?: string): Promise<void> {
    try {
      // Include agentId in webhook URL if provided
      const voiceUrl = agentId 
        ? `${webhookBaseUrl}/api/webhooks/twilio/voice?agentId=${agentId}`
        : `${webhookBaseUrl}/api/webhooks/twilio/voice`;
      
      await this.client.incomingPhoneNumbers(sid).update({
        voiceUrl,
        voiceMethod: 'POST',
        statusCallback: `${webhookBaseUrl}/api/webhooks/twilio/status`,
        statusCallbackMethod: 'POST',
      });
      logger.info('[Twilio] Phone number configured', { sid, agentId });
    } catch (error) {
      logger.error('[Twilio] Configure phone number error:', error);
      throw error;
    }
  }

  async purchasePhoneNumber(areaCode?: string) {
    try {
      // Search for available numbers
      const availableNumbers = await this.client
        .availablePhoneNumbers('US')
        .local.list({
          areaCode: areaCode ? parseInt(areaCode, 10) : undefined,
          voiceEnabled: true,
          limit: 1,
        });

      if (availableNumbers.length === 0) {
        throw new Error('No available phone numbers found');
      }

      // Purchase the number
      const purchased = await this.client.incomingPhoneNumbers.create({
        phoneNumber: availableNumbers[0].phoneNumber,
        voiceUrl: `${config.apiUrl}/webhooks/twilio/voice`,
        voiceMethod: 'POST',
        statusCallback: `${config.apiUrl}/webhooks/twilio/status`,
        statusCallbackMethod: 'POST',
      });

      logger.info('[Twilio] Phone number purchased', { number: purchased.phoneNumber });

      return {
        phoneNumber: purchased.phoneNumber,
        sid: purchased.sid,
        friendlyName: purchased.friendlyName,
      };
    } catch (error) {
      logger.error('[Twilio] Purchase error:', error);
      throw error;
    }
  }

  async releasePhoneNumber(sid: string) {
    try {
      await this.client.incomingPhoneNumbers(sid).remove();
      logger.info('[Twilio] Phone number released', { sid });
    } catch (error) {
      logger.error('[Twilio] Release error:', error);
      throw error;
    }
  }

  async makeCall(to: string, from: string, url: string) {
    try {
      const call = await this.client.calls.create({
        to,
        from,
        url,
        statusCallback: `${config.apiUrl}/webhooks/twilio/status`,
        statusCallbackMethod: 'POST',
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        record: true,
        recordingStatusCallback: `${config.apiUrl}/webhooks/twilio/recording`,
      });

      logger.info('[Twilio] Call initiated', { callSid: call.sid, to, from });

      return {
        callSid: call.sid,
        status: call.status,
      };
    } catch (error) {
      logger.error('[Twilio] Make call error:', error);
      throw error;
    }
  }

  /**
   * Make an outbound call for an agent
   */
  async makeOutboundCall(toNumber: string, agentId: string, fromNumber: string): Promise<{ callSid: string }> {
    try {
      const webhookUrl = `${config.apiUrl}/webhooks/twilio/voice?agentId=${agentId}`;
      
      const call = await this.client.calls.create({
        to: toNumber,
        from: fromNumber,
        url: webhookUrl,
        method: 'POST',
        statusCallback: `${config.apiUrl}/webhooks/twilio/status`,
        statusCallbackMethod: 'POST',
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        record: true,
        recordingStatusCallback: `${config.apiUrl}/webhooks/twilio/recording`,
      });

      logger.info('[Twilio] Outbound call initiated', { callSid: call.sid, to: toNumber, from: fromNumber, agentId });

      return {
        callSid: call.sid,
      };
    } catch (error) {
      logger.error('[Twilio] Make outbound call error:', error);
      throw error;
    }
  }

  async endCall(callSid: string) {
    try {
      await this.client.calls(callSid).update({
        status: 'completed',
      });
      logger.info('[Twilio] Call ended', { callSid });
    } catch (error) {
      logger.error('[Twilio] End call error:', error);
      throw error;
    }
  }

  async getCall(callSid: string) {
    try {
      const call = await this.client.calls(callSid).fetch();
      return {
        sid: call.sid,
        status: call.status,
        duration: call.duration,
        from: call.from,
        to: call.to,
      };
    } catch (error) {
      logger.error('[Twilio] Get call error:', error);
      throw error;
    }
  }

  // Generate TwiML for media stream
  generateMediaStreamTwiML(websocketUrl: string, agentId: string, callSid: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Connect>
          <Stream url="${websocketUrl}">
            <Parameter name="agentId" value="${agentId}" />
            <Parameter name="callSid" value="${callSid}" />
          </Stream>
        </Connect>
      </Response>`;
  }

  // ============================================
  // SMS/MMS Methods
  // ============================================

  /**
   * Send an SMS message
   * @param to - Recipient phone number
   * @param from - Sender phone number (used if no messagingServiceSid)
   * @param body - Message content
   * @param messagingServiceSid - Optional Twilio Messaging Service SID for A2P 10DLC compliance
   */
  async sendSMS(to: string, from: string, body: string, messagingServiceSid?: string): Promise<{ messageSid: string; status: string }> {
    try {
      // Use Messaging Service SID if provided (required for US A2P 10DLC compliance)
      // Otherwise fall back to using the 'from' phone number directly
      const messageOptions: any = {
        to,
        body,
        statusCallback: `${config.apiUrl}/webhooks/twilio/message-status`,
      };

      if (messagingServiceSid) {
        messageOptions.messagingServiceSid = messagingServiceSid;
        logger.info('[Twilio] Using Messaging Service for SMS', { messagingServiceSid });
      } else {
        messageOptions.from = from;
      }

      const message = await this.client.messages.create(messageOptions);

      logger.info('[Twilio] SMS sent', { messageSid: message.sid, to, from: messagingServiceSid || from });

      return {
        messageSid: message.sid,
        status: message.status,
      };
    } catch (error) {
      logger.error('[Twilio] Send SMS error:', error);
      throw error;
    }
  }

  /**
   * Send an MMS message with media
   * @param to - Recipient phone number
   * @param from - Sender phone number (used if no messagingServiceSid)
   * @param body - Message content
   * @param mediaUrls - Array of media URLs to attach
   * @param messagingServiceSid - Optional Twilio Messaging Service SID for A2P 10DLC compliance
   */
  async sendMMS(to: string, from: string, body: string, mediaUrls: string[], messagingServiceSid?: string): Promise<{ messageSid: string; status: string }> {
    try {
      // Use Messaging Service SID if provided (required for US A2P 10DLC compliance)
      const messageOptions: any = {
        to,
        body,
        mediaUrl: mediaUrls,
        statusCallback: `${config.apiUrl}/webhooks/twilio/message-status`,
      };

      if (messagingServiceSid) {
        messageOptions.messagingServiceSid = messagingServiceSid;
        logger.info('[Twilio] Using Messaging Service for MMS', { messagingServiceSid });
      } else {
        messageOptions.from = from;
      }

      const message = await this.client.messages.create(messageOptions);

      logger.info('[Twilio] MMS sent', { messageSid: message.sid, to, from, mediaCount: mediaUrls.length });

      return {
        messageSid: message.sid,
        status: message.status,
      };
    } catch (error) {
      logger.error('[Twilio] Send MMS error:', error);
      throw error;
    }
  }

  /**
   * Get message details
   */
  async getMessage(messageSid: string) {
    try {
      const message = await this.client.messages(messageSid).fetch();
      return {
        sid: message.sid,
        status: message.status,
        from: message.from,
        to: message.to,
        body: message.body,
        numSegments: message.numSegments,
        numMedia: message.numMedia,
        direction: message.direction,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
      };
    } catch (error) {
      logger.error('[Twilio] Get message error:', error);
      throw error;
    }
  }
}
