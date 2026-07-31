'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function CreateClientForm() {
  const router = useRouter();
  const [legalBusinessName, setLegalBusinessName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    const trimmedName = legalBusinessName.trim();
    if (!trimmedName) {
      setError('Legal business name is required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          legal_business_name: trimmedName,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Your session has expired. Please log in again.');
        }
        if (response.status === 400) {
          throw new Error(data?.error || 'Please check the client details.');
        }
        throw new Error(data?.error || 'The server could not create the client.');
      }

      if (!data?.id) {
        throw new Error('The server returned an invalid response.');
      }

      router.push(`/clients/${data.id}`);
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'A network error prevented the client from being created.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleCreate}>
      <div className="space-y-2">
        <Label htmlFor="legal-business-name">Legal Business Name</Label>
        <Input
          id="legal-business-name"
          name="legalBusinessName"
          value={legalBusinessName}
          onChange={(event) => setLegalBusinessName(event.target.value)}
          placeholder="e.g., Acme Corporation"
          disabled={loading}
          required
        />
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert" aria-live="polite">
          {error}
        </p>
      )}
      <Button type="submit" disabled={loading}>
        {loading ? 'Creating Client...' : 'Create Client'}
      </Button>
    </form>
  );
}