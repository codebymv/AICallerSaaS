import { Server } from 'socket.io';
import { DeepgramService } from '@/lib/services/deepgram';
import { OpenAIService } from '@/lib/services/openai';
import { ElevenLabsService } from '@/lib/services/elevenlabs';
import { prisma } from '@/lib/prisma';

interface CallSession {
  callSid: string;
  agentId: string;
  userId: string;
  messages: Array<{ role: string; content: string }>;
  deepgramConnection: any;
  isProcessing: boolean;
}

const sessions = new Map<string, CallSession>();

export function initializeWebSocketServer(io: Server) {
  const deepgramService = new DeepgramService();
  const openaiService = new OpenAIService();
  const elevenLabsService = new ElevenLabsService();
  
  io.on('connection', (socket) => {
    console.log('[WebSocket] Client connected:', socket.id);
    
    let currentSession: CallSession | null = null;
    
    socket.on('start-call', async (data: { callSid: string; agentId: string }) => {
      try {
        console.log('[WebSocket] Starting call:', data);
        
        // Fetch agent and user info
        const agent = await prisma.agent.findUnique({
          where: { id: data.agentId },
          include: { user: true },
        });
        
        if (!agent) {
          socket.emit('error', { message: 'Agent not found' });
          return;
        }
        
        // Initialize session
        currentSession = {
          callSid: data.callSid,
          agentId: data.agentId,
          userId: agent.userId,
          messages: [],
          deepgramConnection: null,
          isProcessing: false,
        };
        
        sessions.set(socket.id, currentSession);
        
        // Create Deepgram connection
        const deepgramConnection = await deepgramService.createLiveTranscription(
          async (transcript: string, isFinal: boolean) => {
            if (!currentSession) return;
            
            console.log('[Deepgram] Transcript:', { transcript, isFinal });
            
            socket.emit('transcript', { text: transcript, isFinal, speaker: 'user' });
            
            if (isFinal && !currentSession.isProcessing) {
              currentSession.isProcessing = true;
              
              // Add user message
              currentSession.messages.push({
                role: 'user',
                content: transcript,
              });
              
              // Generate AI response
              try {
                const response = await openaiService.generateResponse(
                  currentSession.messages,
                  agent.systemPrompt
                );
                
                console.log('[OpenAI] Response:', response);
                
                // Add assistant message
                currentSession.messages.push({
                  role: 'assistant',
                  content: response,
                });
                
                socket.emit('transcript', { text: response, isFinal: true, speaker: 'agent' });
                
                // Convert to speech
                const audioBuffer = await elevenLabsService.textToSpeech(
                  response,
                  agent.voice
                );
                
                socket.emit('audio', audioBuffer);
                
                currentSession.isProcessing = false;
              } catch (error) {
                console.error('[AI Pipeline] Error:', error);
                currentSession.isProcessing = false;
                socket.emit('error', { message: 'Failed to process response' });
              }
            }
          },
          (error) => {
            console.error('[Deepgram] Error:', error);
            socket.emit('error', { message: 'Transcription error' });
          }
        );
        
        currentSession.deepgramConnection = deepgramConnection;
        
        socket.emit('call-started', { callSid: data.callSid });
      } catch (error) {
        console.error('[WebSocket] Start call error:', error);
        socket.emit('error', { message: 'Failed to start call' });
      }
    });
    
    socket.on('audio-input', (audioData: Buffer) => {
      if (currentSession?.deepgramConnection) {
        currentSession.deepgramConnection.send(audioData);
      }
    });
    
    socket.on('end-call', async () => {
      if (currentSession) {
        console.log('[WebSocket] Ending call:', currentSession.callSid);
        
        // Close Deepgram connection
        if (currentSession.deepgramConnection) {
          currentSession.deepgramConnection.finish();
        }
        
        // Save transcript to database
        await prisma.call.update({
          where: { callSid: currentSession.callSid },
          data: {
            transcript: currentSession.messages as any,
            status: 'completed',
            endTime: new Date(),
          },
        });
        
        sessions.delete(socket.id);
        currentSession = null;
      }
      
      socket.emit('call-ended');
    });
    
    socket.on('disconnect', () => {
      console.log('[WebSocket] Client disconnected:', socket.id);
      
      if (currentSession) {
        if (currentSession.deepgramConnection) {
          currentSession.deepgramConnection.finish();
        }
        sessions.delete(socket.id);
      }
    });
  });
  
  console.log('[WebSocket] Server initialized');
}
