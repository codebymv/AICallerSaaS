'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Phone, Plus, RefreshCw, Loader2, CheckCircle, Settings, Bot, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  twilioSid?: string;
  friendlyName?: string;
  isActive: boolean;
  agent?: { id: string; name: string } | null;
  createdAt: string;
}

interface TwilioNumber {
  phoneNumber: string;
  sid: string;
  friendlyName: string;
  capabilities: any;
  alreadyAdded: boolean;
}

export default function PhoneNumbersPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [twilioConfigured, setTwilioConfigured] = useState(false);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [twilioNumbers, setTwilioNumbers] = useState<TwilioNumber[]>([]);
  const [loadingTwilio, setLoadingTwilio] = useState(false);
  const [addingNumber, setAddingNumber] = useState<string | null>(null);
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [settingsRes, numbersRes, agentsRes] = await Promise.all([
        api.getTwilioSettings(),
        api.getPhoneNumbers(),
        api.getAgents(),
      ]);

      setTwilioConfigured(settingsRes.data?.configured || false);
      setPhoneNumbers(numbersRes.data || []);
      setAgents(agentsRes.data || []);

      // If Twilio is configured, fetch available numbers
      if (settingsRes.data?.configured) {
        fetchTwilioNumbers();
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTwilioNumbers = async () => {
    setLoadingTwilio(true);
    try {
      const response = await api.getTwilioPhoneNumbers();
      setTwilioNumbers(response.data || []);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to fetch Twilio numbers';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoadingTwilio(false);
    }
  };

  const handleAddNumber = async (twilioNumber: TwilioNumber) => {
    setAddingNumber(twilioNumber.phoneNumber);
    try {
      await api.addPhoneNumber({
        phoneNumber: twilioNumber.phoneNumber,
        twilioSid: twilioNumber.sid,
        friendlyName: twilioNumber.friendlyName,
        agentId: selectedAgent || undefined,
      });

      toast({
        title: 'Phone number added',
        description: `${twilioNumber.phoneNumber} has been added.`,
      });

      // Refresh data
      fetchData();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to add phone number';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setAddingNumber(null);
    }
  };

  const handleDeleteNumber = async (id: string) => {
    if (!confirm('Are you sure you want to remove this phone number?')) return;

    try {
      await api.deletePhoneNumber(id);
      toast({
        title: 'Phone number removed',
        description: 'The phone number has been removed.',
      });
      fetchData();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to remove phone number';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const formatPhoneNumber = (phone: string) => {
    // Format as (XXX) XXX-XXXX for US numbers
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show setup prompt if Twilio not configured
  if (!twilioConfigured) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Phone Numbers</h1>
          <p className="text-muted-foreground">Manage your Twilio phone numbers</p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Settings className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Twilio Not Configured</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              You need to connect your Twilio account before you can manage phone numbers.
            </p>
            <Link href="/dashboard/settings">
              <Button>
                <Settings className="h-4 w-4 mr-2" />
                Configure Twilio
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Phone Numbers</h1>
          <p className="text-muted-foreground">Manage your Twilio phone numbers</p>
        </div>
        <Button variant="outline" onClick={fetchTwilioNumbers} disabled={loadingTwilio}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loadingTwilio ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Your Phone Numbers */}
      <Card>
        <CardHeader>
          <CardTitle>Your Phone Numbers</CardTitle>
          <CardDescription>
            Phone numbers connected to your AI agents
          </CardDescription>
        </CardHeader>
        <CardContent>
          {phoneNumbers.length === 0 ? (
            <div className="text-center py-8">
              <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No phone numbers added yet</p>
              <p className="text-sm text-muted-foreground">
                Add a phone number from your Twilio account below
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {phoneNumbers.map((number) => (
                <div
                  key={number.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <Phone className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-mono font-medium">
                        {formatPhoneNumber(number.phoneNumber)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {number.friendlyName || 'No name'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {number.agent ? (
                      <Link
                        href={`/dashboard/agents/${number.agent.id}`}
                        className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                      >
                        <Bot className="h-4 w-4" />
                        {number.agent.name}
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">No agent assigned</span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteNumber(number.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Twilio Numbers */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Available from Twilio</CardTitle>
              <CardDescription>
                Phone numbers in your Twilio account that can be added
              </CardDescription>
            </div>
            {agents.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">Assign to:</label>
                <select
                  className="px-3 py-1.5 text-sm border rounded-md"
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                >
                  <option value="">No agent</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loadingTwilio ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : twilioNumbers.length === 0 ? (
            <div className="text-center py-8">
              <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No phone numbers found in Twilio</p>
              <p className="text-sm text-muted-foreground">
                Purchase a phone number in your{' '}
                <a
                  href="https://console.twilio.com/us1/develop/phone-numbers/manage/incoming"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Twilio Console
                </a>
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {twilioNumbers.map((number) => (
                <div
                  key={number.sid}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    number.alreadyAdded ? 'bg-slate-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      number.alreadyAdded ? 'bg-gray-100' : 'bg-blue-100'
                    }`}>
                      <Phone className={`h-5 w-5 ${
                        number.alreadyAdded ? 'text-gray-500' : 'text-blue-600'
                      }`} />
                    </div>
                    <div>
                      <p className="font-mono font-medium">
                        {formatPhoneNumber(number.phoneNumber)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {number.friendlyName}
                      </p>
                    </div>
                  </div>
                  <div>
                    {number.alreadyAdded ? (
                      <span className="flex items-center gap-1 text-sm text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        Added
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleAddNumber(number)}
                        disabled={addingNumber === number.phoneNumber}
                      >
                        {addingNumber === number.phoneNumber ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-2" />
                            Add
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
