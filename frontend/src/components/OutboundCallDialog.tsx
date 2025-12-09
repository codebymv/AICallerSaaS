'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { PhoneCall, X, Loader2, Delete } from 'lucide-react';

interface OutboundCallDialogProps {
  agentId: string;
  agentName: string;
  callWindow?: { start?: string; end?: string };
  onClose: () => void;
  onCallInitiated?: (callData: any) => void;
}

const dialpadKeys = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*', letters: '' },
  { digit: '0', letters: '+' },
  { digit: '#', letters: '' },
];

export function OutboundCallDialog({ 
  agentId, 
  agentName, 
  callWindow,
  onClose, 
  onCallInitiated 
}: OutboundCallDialogProps) {
  const { toast } = useToast();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Use portal to render at document.body level (avoids z-index stacking context issues)
  useEffect(() => {
    setMounted(true);
  }, []);

  const formatPhoneNumber = (digits: string) => {
    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else if (digits.length <= 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  };

  const handleDialpadPress = (digit: string) => {
    const currentDigits = phoneNumber.replace(/\D/g, '');
    if (currentDigits.length < 10) {
      const newDigits = currentDigits + digit;
      setPhoneNumber(formatPhoneNumber(newDigits));
    }
  };

  const handleBackspace = () => {
    const currentDigits = phoneNumber.replace(/\D/g, '');
    const newDigits = currentDigits.slice(0, -1);
    setPhoneNumber(formatPhoneNumber(newDigits));
  };

  const isWithinCallWindow = () => {
    if (!callWindow?.start || !callWindow?.end) return true;
    
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    return currentTime >= callWindow.start && currentTime <= callWindow.end;
  };

  const handleCall = async () => {
    const digits = phoneNumber.replace(/\D/g, '');
    
    if (digits.length < 10) {
      toast({
        title: 'Invalid phone number',
        description: 'Please enter a valid 10-digit phone number',
        variant: 'destructive',
      });
      return;
    }

    if (!isWithinCallWindow()) {
      toast({
        title: 'Outside call window',
        description: `Calls can only be made between ${callWindow?.start} and ${callWindow?.end}`,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const formattedNumber = `+1${digits}`;
      const response = await api.makeOutboundCall(agentId, formattedNumber);
      
      toast({
        title: 'Call initiated!',
        description: `Calling ${phoneNumber}...`,
      });
      
      if (onCallInitiated) {
        onCallInitiated(response.data);
      }
      
      onClose();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to initiate call';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const digits = phoneNumber.replace(/\D/g, '');

  // Don't render until mounted (for SSR compatibility with portal)
  if (!mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-slate-600" />
              <CardTitle className="text-slate-600">Make Outbound Call</CardTitle>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-slate-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            Place a call using <span className="font-medium text-slate-600">{agentName}</span>
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Phone Number Display */}
          <div className="text-center py-4">
            <div className="h-10 flex items-center justify-center">
              {phoneNumber ? (
                <span className="text-2xl font-semibold text-slate-700 tracking-wide">
                  {phoneNumber}
                </span>
              ) : (
                <span className="text-2xl text-slate-300">
                  (___) ___-____
                </span>
              )}
            </div>
          </div>

          {/* Dialpad */}
          <div className="grid grid-cols-3 gap-3">
            {dialpadKeys.map((key) => (
              <button
                key={key.digit}
                type="button"
                onClick={() => handleDialpadPress(key.digit)}
                className="flex flex-col items-center justify-center h-16 rounded-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 transition-colors"
                disabled={loading}
              >
                <span className="text-xl font-semibold text-slate-700">{key.digit}</span>
                {key.letters && (
                  <span className="text-[10px] text-slate-400 tracking-widest">{key.letters}</span>
                )}
              </button>
            ))}
          </div>

          {/* Backspace */}
          <div className="flex justify-end px-4">
            <button
              type="button"
              onClick={handleBackspace}
              className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
              disabled={!phoneNumber || loading}
            >
              <Delete className="h-6 w-6" />
            </button>
          </div>

          {/* Call Window Warning */}
          {callWindow?.start && callWindow?.end && !isWithinCallWindow() && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-700">
                ⚠️ Outside call window ({callWindow.start} - {callWindow.end})
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 text-slate-600"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCall}
              className="flex-1 bg-teal-600 hover:bg-teal-700"
              disabled={loading || digits.length < 10}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Calling...
                </>
              ) : (
                <>
                  <PhoneCall className="h-4 w-4 mr-2" />
                  Call Now
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Render via portal to escape any stacking context
  return createPortal(modalContent, document.body);
}

