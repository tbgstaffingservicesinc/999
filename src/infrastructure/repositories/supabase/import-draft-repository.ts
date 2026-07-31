import type { SupabaseClient } from "@supabase/supabase-js";
import { DomainError } from "@/core/errors/domain-error";
import type { AtomicImportDraftCreate, AtomicImportDraftResult, ImportDraftRepository } from "@/modules/import";

interface AtomicImportDraftRow {
  client_id: string;
  draft_id: string;
  draft_status: string;
  client_created: boolean;
}

export class SupabaseImportDraftRepository implements ImportDraftRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async saveAtomic(input: AtomicImportDraftCreate): Promise<AtomicImportDraftResult> {
    const { data, error } = await this.supabase.rpc("save_import_draft_atomic", {
      p_resolution_mode: input.resolution.mode,
      p_existing_client_id: input.resolution.mode === "LINK_EXISTING" ? input.resolution.existingClientId : null,
      p_internal_client_id: input.internalClientId,
      p_legal_business_name: input.client?.legalBusinessName ?? null,
      p_dba: input.client?.dba ?? null,
      p_business_type: input.client?.businessType ?? null,
      p_business_website: input.client?.businessWebsite ?? null,
      p_notification_email: input.client?.notificationEmail ?? null,
      p_authorized_contact_name: input.client?.authorizedContactName ?? null,
      p_application_status: input.status,
      p_application_payload: input.applicationPayload,
      p_idempotency_key: input.idempotencyKey,
    });

    if (error) {
      throw new DomainError("DATABASE_ERROR", "Unable to save the client and TFV import draft atomically.", { databaseCode: error.code });
    }
    const row = (Array.isArray(data) ? data[0] : data) as AtomicImportDraftRow | null;
    if (!row?.client_id || !row.draft_id) throw new DomainError("DATABASE_ERROR", "The atomic import operation returned no saved record.");
    return { clientId: row.client_id, draftId: row.draft_id, status: row.draft_status, clientCreated: row.client_created };
  }
}
