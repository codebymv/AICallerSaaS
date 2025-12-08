'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Phone, X, Loader2 } from 'lucide-react';

interface OutboundCallDialogProps {
  agentId: string;
  agentName: string;
  callWindow?: { start?: string; end?: string };
  onClose: () => void;
  onCallInitiated?: (callData: any) => void;
}

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

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
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

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  const isWithinCallWindow = () => {
    if (!callWindow?.start || !callWindow?.end) return true;
    
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    return currentTime >= callWindow.start && currentTime <= callWindow.end;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Extract digits only
    const digits = phoneNumber.replace(/\D/g, '');
    
    if (digits.length < 10) {
      toast({
        title: 'Invalid phone number',
        description: 'Please enter a valid 10-digit phone number',
        variant: 'destructive',
      });
      return;
    }

    // Check call window
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
      // Format with country code
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

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              <CardTitle>Make Outbound Call</CardTitle>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <CardDescription>
            Place a call using <span className="font-semibold">{agentName}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number *</Label>
              <Input
                id="phoneNumber"
                type="tel"
                placeholder="(555) 123-4567"
                value={phoneNumber}
                onChange={handlePhoneChange}
                maxLength={14}
                required
              />
              <p className="text-xs text-muted-foreground">
                Enter a US phone number (10 digits)
              </p>
            </div>

            {callWindow?.start && callWindow?.end && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm font-medium">Call Window</p>
                <p className="text-sm text-muted-foreground">
                  {callWindow.start} - {callWindow.end}
                </p>
                {!isWithinCallWindow() && (
                  <p className="text-sm text-orange-600 mt-1">
                    ⚠️ Current time is outside the configured call window
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={loading || !phoneNumber}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Calling...
                  </>
                ) : (
                  <>
                    <Phone className="h-4 w-4 mr-2" />
                    Call Now
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
