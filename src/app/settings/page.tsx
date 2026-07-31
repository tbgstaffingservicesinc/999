'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Environment</CardTitle>
          </CardHeader>
          <CardContent>
            <p><strong>Application Name:</strong> {process.env.NEXT_PUBLIC_APP_NAME}</p>
            <p><strong>Dry Run Mode:</strong> {process.env.DRY_RUN}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Supabase</CardTitle>
          </CardHeader>
          <CardContent>
            <p><strong>URL:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL}</p>
            <p><strong>Status:</strong> Connected</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
