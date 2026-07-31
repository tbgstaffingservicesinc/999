﻿'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from 'react';

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
    setMessage(null);
  };

  const handleImport = async () => {
    if (!file || loading) {
      if (!file) setMessage('Please select a CSV or XLSX file.');
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.set('file', file);
      const response = await fetch('/api/imports', { method: 'POST', body: formData });
      const payload = await response.json() as { error?: string; summary?: { total: number; imported: number; rejected: number } };
      if (!response.ok) throw new Error(payload.error ?? 'Import failed.');
      const summary = payload.summary;
      setMessage(summary ? `Processed ${summary.total} row(s): ${summary.imported} imported, ${summary.rejected} rejected.` : 'Import completed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Import failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-4">Import Client Data</h1>
      <div className="space-y-4 max-w-md">
        <div>
          <Label htmlFor="client-import">Select CSV or XLSX File</Label>
          <Input id="client-import" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFileChange} />
        </div>
        <Button type="button" onClick={handleImport} disabled={loading}>{loading ? 'Importing…' : 'Import'}</Button>
        {message ? <p role="status" className="text-sm">{message}</p> : null}
      </div>
    </div>
  );
}
