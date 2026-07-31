﻿import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusSyncButton } from "@/components/tfv/status-sync-button";
import { createClient } from "@/lib/supabase/server";
import { tryGetSupabasePublicEnv } from "@/lib/env";
import { SupabaseConfigurationRequired } from "@/components/configuration-alert";

interface StatusRow { id: string; status: string; submitted_at: string | null; tfv_phone_numbers: Array<{ phone_numbers: { phone_number: string } | null }> | null; }

export default async function StatusPage() {
  if (!tryGetSupabasePublicEnv().success) return <SupabaseConfigurationRequired />;
  const supabase = await createClient();
  const { data } = await supabase.from('tfv_applications').select('id,status,submitted_at,tfv_phone_numbers(phone_numbers(phone_number))').order('created_at', { ascending: false }).limit(100);
  const rows = (data ?? []) as unknown as StatusRow[];
  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-4"><h1 className="text-2xl font-bold">Verification Status</h1><StatusSyncButton /></div>
      <div className="rounded-md border">
        <Table>
          <TableHeader><TableRow><TableHead>Phone Number</TableHead><TableHead>Status</TableHead><TableHead>Submitted At</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.tfv_phone_numbers?.[0]?.phone_numbers?.phone_number ?? 'Not linked'}</TableCell>
                <TableCell>{item.status}</TableCell>
                <TableCell>{item.submitted_at ? new Date(item.submitted_at).toLocaleString('en-US') : 'Not submitted'}</TableCell>
                <TableCell><Button variant="outline" disabled>Server sync</Button></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 ? <TableRow><TableCell colSpan={4}>No verification records.</TableCell></TableRow> : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

