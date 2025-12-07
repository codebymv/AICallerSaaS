import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const callSid = formData.get('CallSid') as string;
    const callStatus = formData.get('CallStatus') as string;
    const callDuration = formData.get('CallDuration') as string;
    
    console.log('[Twilio Status] Call update:', { callSid, callStatus, callDuration });
    
    // Update call status in database
    const updateData: any = {
      status: callStatus.toLowerCase(),
    };
    
    if (callStatus === 'completed' || callStatus === 'failed' || callStatus === 'no-answer') {
      updateData.endTime = new Date();
      
      if (callDuration) {
        const duration = parseInt(callDuration);
        updateData.duration = duration;
        updateData.minutesUsed = Math.ceil(duration / 60);
      }
    }
    
    await prisma.call.update({
      where: { callSid },
      data: updateData,
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Twilio Status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update call status' },
      { status: 500 }
    );
  }
}
