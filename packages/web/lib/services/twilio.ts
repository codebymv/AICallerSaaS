import twilio from 'twilio';

export class TwilioService {
  private client;
  
  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken) {
      throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set');
    }
    
    this.client = twilio(accountSid, authToken);
  }
  
  async purchasePhoneNumber(areaCode?: string) {
    try {
      // Search for available numbers
      const availableNumbers = await this.client
        .availablePhoneNumbers('US')
        .local
        .list({
          areaCode: areaCode,
          voiceEnabled: true,
          limit: 1,
        });
      
      if (availableNumbers.length === 0) {
        throw new Error('No available phone numbers found');
      }
      
      // Purchase the number
      const purchasedNumber = await this.client.incomingPhoneNumbers.create({
        phoneNumber: availableNumbers[0].phoneNumber,
        voiceUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/voice`,
        voiceMethod: 'POST',
        statusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/status`,
        statusCallbackMethod: 'POST',
      });
      
      return {
        phoneNumber: purchasedNumber.phoneNumber,
        sid: purchasedNumber.sid,
        friendlyName: purchasedNumber.friendlyName,
      };
    } catch (error) {
      console.error('[Twilio] Purchase number error:', error);
      throw error;
    }
  }
  
  async updatePhoneNumber(sid: string, voiceUrl: string) {
    try {
      await this.client.incomingPhoneNumbers(sid).update({
        voiceUrl,
        voiceMethod: 'POST',
      });
    } catch (error) {
      console.error('[Twilio] Update number error:', error);
      throw error;
    }
  }
  
  async releasePhoneNumber(sid: string) {
    try {
      await this.client.incomingPhoneNumbers(sid).remove();
    } catch (error) {
      console.error('[Twilio] Release number error:', error);
      throw error;
    }
  }
  
  async makeCall(to: string, from: string, callbackUrl: string) {
    try {
      const call = await this.client.calls.create({
        to,
        from,
        url: callbackUrl,
        statusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/status`,
        statusCallbackMethod: 'POST',
      });
      
      return {
        callSid: call.sid,
        status: call.status,
      };
    } catch (error) {
      console.error('[Twilio] Make call error:', error);
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
        startTime: call.startTime,
        endTime: call.endTime,
      };
    } catch (error) {
      console.error('[Twilio] Get call error:', error);
      throw error;
    }
  }
  
  generateTwiML(text: string): string {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    response.say(text);
    return response.toString();
  }
  
  generateStreamTwiML(streamUrl: string): string {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    const start = response.start();
    start.stream({
      url: streamUrl,
    });
    response.say('Please wait while we connect your call');
    return response.toString();
  }
}
