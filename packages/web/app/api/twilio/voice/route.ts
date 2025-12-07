import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    
    console.log('[Twilio Voice] Incoming call:', { callSid, from, to });
    
    // Find the phone number and associated agent
    const phoneNumber = await prisma.phoneNumber.findUnique({
      where: { phoneNumber: to },
      include: {
        agent: true,
        user: true,
      },
    });
    
    if (!phoneNumber || !phoneNumber.agent) {
      const VoiceResponse = twilio.twiml.VoiceResponse;
      const response = new VoiceResponse();
      response.say('Sorry, this number is not configured. Please try again later.');
      response.hangup();
      
      return new NextResponse(response.toString(), {
        headers: { 'Content-Type': 'text/xml' },
      });
    }
    
    // Create call record
    await prisma.call.create({
      data: {
        callSid,
        direction: 'inbound',
        from,
        to,
        status: 'initiated',
        userId: phoneNumber.userId,
        agentId: phoneNumber.agentId!,
        phoneNumberId: phoneNumber.id,
        startTime: new Date(),
      },
    });
    
    // Generate TwiML to start WebSocket stream
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    
    // Say greeting if configured
    if (phoneNumber.agent.greeting) {
      response.say(
        {
          voice: 'Polly.Joanna',
        },
        phoneNumber.agent.greeting
      );
    }
    
    // Start WebSocket stream for bidirectional audio
    const start = response.start();
    start.stream({
      url: `${process.env.NEXT_PUBLIC_WS_URL}/media-stream`,
      track: 'both_tracks',
    });
    
    // Keep connection alive
    response.pause({ length: 60 });
    
    return new NextResponse(response.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    console.error('[Twilio Voice] Error:', error);
    
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    response.say('An error occurred. Please try again later.');
    response.hangup();
    
    return new NextResponse(response.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}
