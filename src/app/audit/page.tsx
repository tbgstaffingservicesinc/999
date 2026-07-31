﻿import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { tryGetSupabasePublicEnv } from "@/lib/env";
import { SupabaseConfigurationRequired } from "@/components/configuration-alert";

interface AuditRow { id: string; created_at: string; actor_id: string | null; action: string; }

export default async function AuditPage() {
  if (!tryGetSupabasePublicEnv().success) return <SupabaseConfigurationRequired />;
  const supabase = await createClient();
  const { data } = await supabase.from('audit_events').select('id,created_at,actor_id,action').order('created_at', { ascending: false }).limit(100);
  const rows = (data ?? []) as AuditRow[];
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-4">Audit Log</h1>
      <div className="rounded-md border">
        <Table>
          <TableHeader><TableRow><TableHead>Timestamp</TableHead><TableHead>User</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((item) => <TableRow key={item.id}><TableCell>{new Date(item.created_at).toLocaleString('en-US')}</TableCell><TableCell>{item.actor_id ?? 'System'}</TableCell><TableCell>{item.action}</TableCell></TableRow>)}
            {rows.length === 0 ? <TableRow><TableCell colSpan={3}>No audit events.</TableCell></TableRow> : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

