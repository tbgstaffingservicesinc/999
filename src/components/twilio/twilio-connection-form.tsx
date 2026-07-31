'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function TwilioConnectionForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [accountSid, setAccountSid] = useState('');
  const [apiKeySid, setApiKeySid] = useState('');
  const [apiKeySecret, setApiKeySecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const response = await fetch(`/api/clients/${clientId}/twilio-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountSid, apiKeySid, apiKeySecret }),
    });

    setLoading(false);

    if (response.ok) {
      setSuccess(true);
      router.refresh();
    } else {
      const data = await response.json();
      setError(data.error || 'An unknown error occurred.');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect to Twilio</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="accountSid">Account SID</Label>
            <Input
              id="accountSid"
              value={accountSid}
              onChange={(e) => setAccountSid(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apiKeySid">API Key SID</Label>
            <Input
              id="apiKeySid"
              value={apiKeySid}
              onChange={(e) => setApiKeySid(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apiKeySecret">API Key Secret</Label>
            <Input
              id="apiKeySecret"
              type="password"
              value={apiKeySecret}
              onChange={(e) => setApiKeySecret(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Connecting...' : 'Save Connection'}
          </Button>

          {error && <p className="text-sm font-medium text-red-500">{error}</p>}
          {success && <p className="text-sm font-medium text-green-500">Connection saved successfully!</p>}
        </form>
      </CardContent>
    </Card>
  );
}
