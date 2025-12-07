'use client';

import { useEffect, useState } from 'react';
import { Settings, Phone, CheckCircle, XCircle, Loader2, ExternalLink, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface TwilioSettings {
  configured: boolean;
  accountSid: string | null;
  authTokenSet: boolean;
  authTokenMasked: string | null;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState<TwilioSettings | null>(null);
  
  // Form state
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.getTwilioSettings();
      setSettings(response.data || null);
      if (response.data?.accountSid) {
        setAccountSid(response.data.accountSid);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!accountSid || !authToken) {
      toast({
        title: 'Missing fields',
        description: 'Please enter both Account SID and Auth Token',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      await api.updateTwilioSettings(accountSid, authToken);
      toast({
        title: 'Settings saved',
        description: 'Your Twilio credentials have been saved and verified.',
      });
      setAuthToken('');
      setEditing(false);
      fetchSettings();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to save settings';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const response = await api.testTwilioConnection();
      toast({
        title: 'Connection successful!',
        description: `Connected to: ${response.data?.accountName} (${response.data?.accountStatus})`,
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Connection test failed';
      toast({
        title: 'Connection failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Are you sure you want to remove your Twilio credentials?')) return;

    try {
      await api.deleteTwilioSettings();
      toast({
        title: 'Credentials removed',
        description: 'Your Twilio credentials have been removed.',
      });
      setAccountSid('');
      setAuthToken('');
      setSettings(null);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to remove credentials';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your integrations and preferences</p>
      </div>

      {/* Twilio Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <Phone className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <CardTitle>Twilio Integration</CardTitle>
                <CardDescription>
                  Connect your Twilio account to make and receive calls
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {settings?.configured ? (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sm text-gray-500">
                  <XCircle className="h-4 w-4" />
                  Not configured
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">How to get your Twilio credentials:</h4>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Go to your <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">Twilio Console</a></li>
              <li>Find your <strong>Account SID</strong> and <strong>Auth Token</strong> on the dashboard</li>
              <li>Copy and paste them below</li>
              <li>Make sure you have at least one phone number in your Twilio account</li>
            </ol>
            <a 
              href="https://console.twilio.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-3 text-sm text-blue-600 hover:underline"
            >
              Open Twilio Console <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Credentials Form */}
          {settings?.configured && !editing ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">Account SID</Label>
                  <p className="font-mono text-sm bg-slate-100 p-2 rounded mt-1">
                    {settings.accountSid}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Auth Token</Label>
                  <p className="font-mono text-sm bg-slate-100 p-2 rounded mt-1">
                    {settings.authTokenMasked || '••••••••'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditing(true)}>
                  Update Credentials
                </Button>
                <Button variant="outline" onClick={handleTest} disabled={testing}>
                  {testing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Test Connection'
                  )}
                </Button>
                <Button variant="destructive" onClick={handleRemove}>
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="accountSid">Account SID</Label>
                  <Input
                    id="accountSid"
                    value={accountSid}
                    onChange={(e) => setAccountSid(e.target.value)}
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="authToken">Auth Token</Label>
                  <div className="relative">
                    <Input
                      id="authToken"
                      type={showToken ? 'text' : 'password'}
                      value={authToken}
                      onChange={(e) => setAuthToken(e.target.value)}
                      placeholder="Your Twilio Auth Token"
                      className="font-mono text-sm pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save & Verify'
                  )}
                </Button>
                {editing && (
                  <Button variant="outline" onClick={() => {
                    setEditing(false);
                    setAuthToken('');
                  }}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Next Steps */}
      {settings?.configured && (
        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
            <CardDescription>
              Your Twilio account is connected. Here's what to do next:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <a 
                href="/dashboard/phone-numbers" 
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <Phone className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Add Phone Numbers</p>
                    <p className="text-sm text-muted-foreground">
                      Import your Twilio phone numbers to use with agents
                    </p>
                  </div>
                </div>
                <span className="text-muted-foreground">→</span>
              </a>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

