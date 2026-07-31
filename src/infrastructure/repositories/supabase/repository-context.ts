import { createClient } from '@/lib/supabase/server';
import type { RepositoryContext } from '@/core/ports/repositories';
import { SupabaseAuditRepository } from './audit-repository';
import { SupabaseClientRepository } from './client-repository';
import { SupabaseImportDraftRepository } from './import-draft-repository';
import { SupabaseTwilioConnectionRepository } from './twilio-connection-repository';

export async function createRepositoryContext(): Promise<RepositoryContext> {
  const supabase = await createClient();

  return {
    clients: new SupabaseClientRepository(supabase),
    importDrafts: new SupabaseImportDraftRepository(supabase),
    twilioConnections: new SupabaseTwilioConnectionRepository(supabase),
    audit: new SupabaseAuditRepository(supabase),
  };
}

