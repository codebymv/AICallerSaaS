// ============================================
// Twilio Service
// ============================================

import twilio from 'twilio';
import { config } from '../config';
import { logger } from '../utils/logger';

export class TwilioService {
  private client: ReturnType<typeof twilio>;

  constructor() {
    this.client = twilio(config.twilioAccountSid, config.twilioAuthToken);
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
}
