'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useToast } from '@/hooks/use-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface CallEventData {
  callSid: string;
  streamSid?: string;
  agentId?: string;
  agentName?: string;
}

/**
 * Hook to listen for real-time call events via Socket.IO
 * Shows toast notifications for call started/ended events
 */
export function useCallEvents(userId: string | null) {
  const { toast } = useToast();
  const socketRef = useRef<Socket | null>(null);
  const connectedRef = useRef(false);

  // Memoize toast handlers to prevent reconnection loops
  const handleCallStarted = useCallback((data: CallEventData) => {
    console.log('[CallEvents] Call started:', data);
    toast({
      title: '📞 Call Connected',
      description: 'Agent is now on the line',
    });
  }, [toast]);

  const handleCallEnded = useCallback((data: CallEventData) => {
    console.log('[CallEvents] Call ended:', data);
    toast({
      title: '📴 Call Ended',
      description: 'The call has been completed',
    });
  }, [toast]);

  useEffect(() => {
    if (!userId) return;

    // Don't reconnect if already connected
    if (connectedRef.current && socketRef.current?.connected) {
      return;
    }

    console.log('[CallEvents] Connecting to Socket.IO server...');
    
    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[CallEvents] Connected to server');
      connectedRef.current = true;
      
      // Subscribe to this user's dashboard events
      socket.emit('subscribe_dashboard', { userId });
    });

    socket.on('disconnect', () => {
      console.log('[CallEvents] Disconnected from server');
      connectedRef.current = false;
    });

    socket.on('connect_error', (error) => {
      console.error('[CallEvents] Connection error:', error);
    });

    // Listen for call events
    socket.on('call_started', handleCallStarted);
    socket.on('call_ended', handleCallEnded);

    // Also listen for active calls on initial connect
    socket.on('active_calls', (calls: CallEventData[]) => {
      console.log('[CallEvents] Active calls:', calls.length);
    });

    return () => {
      console.log('[CallEvents] Cleaning up socket connection');
      socket.off('call_started', handleCallStarted);
      socket.off('call_ended', handleCallEnded);
      socket.disconnect();
      connectedRef.current = false;
    };
  }, [userId, handleCallStarted, handleCallEnded]);

  return socketRef.current;
}


