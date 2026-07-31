import type { SupabaseClient } from "@supabase/supabase-js";
import { DomainError } from "@/core/errors/domain-error";
import type {
  PurchaseBatchRecord,
  PurchaseItemRecord,
  PurchaseRepository,
} from "@/modules/purchase";

export class SupabasePurchaseRepository implements PurchaseRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async clientExists(clientId: string): Promise<boolean> {
    const { data, error } = await this.supabase.from("clients").select("id").eq("id", clientId).maybeSingle();
    if (error) throw databaseError("Unable to verify purchase client.", error.code);
    return data !== null;
  }

  async findBatchByIdempotencyKey(
    key: string,
  ): Promise<PurchaseBatchRecord | null> {
    const { data, error } = await this.supabase
      .from("purchase_batches")
      .select("id,client_id,idempotency_key,status")
      .eq("idempotency_key", key)
      .maybeSingle();
    if (error) throw databaseError("Unable to read purchase batch.", error.code);
    return data
      ? {
          id: data.id,
          clientId: data.client_id,
          idempotencyKey: data.idempotency_key,
          status: data.status,
        }
      : null;
  }

  async createBatch(input: {
    clientId: string;
    requestedQuantity: number;
    idempotencyKey: string;
    actorId: string | null;
  }): Promise<PurchaseBatchRecord> {
    const { data, error } = await this.supabase
      .from("purchase_batches")
      .insert({
        client_id: input.clientId,
        requested_quantity: input.requestedQuantity,
        status: "in_progress",
        requested_by: input.actorId,
        idempotency_key: input.idempotencyKey,
      })
      .select("id,client_id,idempotency_key,status")
      .single();
    if (error) throw databaseError("Unable to create purchase batch.", error.code);
    return {
      id: data.id,
      clientId: data.client_id,
      idempotencyKey: data.idempotency_key,
      status: data.status,
    };
  }

  async listItems(batchId: string): Promise<readonly PurchaseItemRecord[]> {
    const { data, error } = await this.supabase
      .from("purchase_items")
      .select(
        "id,batch_id,client_id,requested_phone_number,phone_number_sid,status,safe_error",
      )
      .eq("batch_id", batchId)
      .order("created_at");
    if (error) throw databaseError("Unable to list purchase items.", error.code);
    return (data ?? []).map(mapItem);
  }

  async createItem(input: {
    batchId: string;
    clientId: string;
    requestedPhoneNumber: string;
  }): Promise<PurchaseItemRecord> {
    const { data, error } = await this.supabase
      .from("purchase_items")
      .insert({
        batch_id: input.batchId,
        client_id: input.clientId,
        requested_phone_number: input.requestedPhoneNumber,
        status: "pending",
      })
      .select(
        "id,batch_id,client_id,requested_phone_number,phone_number_sid,status,safe_error",
      )
      .single();
    if (error) throw databaseError("Unable to create purchase item.", error.code);
    return mapItem(data);
  }

  async findPhoneByNumber(phoneNumber: string) {
    const { data, error } = await this.supabase
      .from("phone_numbers")
      .select("id,client_id,phone_number_sid")
      .eq("phone_number", phoneNumber)
      .maybeSingle();
    if (error) throw databaseError("Unable to read phone number.", error.code);
    return data
      ? {
          id: data.id,
          clientId: data.client_id,
          phoneNumberSid: data.phone_number_sid,
        }
      : null;
  }

  async markItem(input: {
    itemId: string;
    status: PurchaseItemRecord["status"];
    phoneNumberSid?: string | null;
    safeError?: string | null;
  }): Promise<void> {
    const values: Record<string, unknown> = { status: input.status };
    if ("phoneNumberSid" in input)
      values.phone_number_sid = input.phoneNumberSid;
    if ("safeError" in input) values.safe_error = input.safeError;
    const { error } = await this.supabase
      .from("purchase_items")
      .update(values)
      .eq("id", input.itemId);
    if (error) throw databaseError("Unable to update purchase item.", error.code);
  }

  async savePurchasedPhone(input: {
    purchaseOperationId: string;
    clientId: string;
    phoneNumberSid: string;
    phoneNumber: string;
    friendlyName: string;
    capabilities: Readonly<Record<string, boolean>>;
  }): Promise<{ id: string }> {
    const { data, error } = await this.supabase.from("phone_numbers").insert({
      client_id: input.clientId,
      purchase_operation_id: input.purchaseOperationId,
      status: "active",
      phone_number_sid: input.phoneNumberSid,
      phone_number: input.phoneNumber,
      friendly_name: input.friendlyName,
      capabilities: input.capabilities,
      lifecycle_status: "active",
      purchased_at: new Date().toISOString(),
    }).select("id").single();
    if (error) throw databaseError("Unable to save purchased phone.", error.code);
    return { id: data.id };
  }

  async completeBatch(batchId: string, status: string): Promise<void> {
    const { error } = await this.supabase
      .from("purchase_batches")
      .update({ status, completed_at: new Date().toISOString() })
      .eq("id", batchId);
    if (error) throw databaseError("Unable to complete purchase batch.", error.code);
  }
}

function mapItem(row: Record<string, unknown>): PurchaseItemRecord {
  return {
    id: String(row.id),
    batchId: String(row.batch_id),
    clientId: String(row.client_id),
    requestedPhoneNumber: String(row.requested_phone_number),
    phoneNumberSid: row.phone_number_sid ? String(row.phone_number_sid) : null,
    status: String(row.status) as PurchaseItemRecord["status"],
    safeError: row.safe_error ? String(row.safe_error) : null,
  };
}

function databaseError(message: string, databaseCode: string): DomainError {
  return new DomainError("DATABASE_ERROR", message, { databaseCode });
}
