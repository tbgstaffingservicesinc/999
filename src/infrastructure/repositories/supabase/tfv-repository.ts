import type { SupabaseClient } from "@supabase/supabase-js";
import { DomainError } from "@/core/errors/domain-error";
import type { TfvFieldName } from "@/domain/schema/tfv-schema";
import type { ImportValue } from "@/modules/import";
import type {
  TfvRepository,
  TfvSubmissionCandidate,
  TfvSyncCandidate,
} from "@/modules/tfv";
import type { TfvRemoteStatus, TfvSubmissionPayload } from "@/services/twilio";

export class SupabaseTfvRepository implements TfvRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async prepareBatch(input:{clientId:string;phoneNumberIds:readonly string[];operationId:string}):Promise<readonly string[]>{const{data,error}=await this.supabase.rpc("prepare_tfv_batch",{p_client_id:input.clientId,p_phone_number_ids:input.phoneNumberIds,p_operation_id:input.operationId});if(error)throw databaseError("Unable to prepare TFV batch.",error.code);return(data??[]).map((row:Record<string,unknown>)=>String(row.application_id));}

  async getSubmissionCandidate(
    applicationId: string,
  ): Promise<TfvSubmissionCandidate | null> {
    const { data, error } = await this.supabase
      .from("tfv_applications")
      .select(
        "id,client_id,idempotency_key,status,verification_sid,application_payload",
      )
      .eq("id", applicationId)
      .maybeSingle();
    if (error) throw databaseError("Unable to read TFV draft.", error.code);
    if (!data) return null;

    const { data: link, error: linkError } = await this.supabase
      .from("tfv_phone_numbers")
      .select("phone_numbers(phone_number_sid)")
      .eq("tfv_application_id", applicationId)
      .limit(1)
      .maybeSingle();
    if (linkError)
      throw databaseError("Unable to read linked toll-free number.", linkError.code);
    const payload = objectValue(data.application_payload);
    const linked = link as unknown as {
      phone_numbers:
        | { phone_number_sid: string }
        | { phone_number_sid: string }[]
        | null;
    } | null;
    const phone = Array.isArray(linked?.phone_numbers)
      ? linked.phone_numbers[0]
      : linked?.phone_numbers;
    return {
      id: data.id,
      clientId: data.client_id,
      idempotencyKey: data.idempotency_key,
      status: data.status,
      verificationSid: data.verification_sid,
      submissionPayloadEn: objectValue(
        payload.submission_payload_en,
      ) as Partial<Record<TfvFieldName, ImportValue>>,
      tollfreePhoneNumberSid: phone?.phone_number_sid ?? null,
    };
  }

  async markSubmitting(
    applicationId: string,
    payloadHash: string,
  ): Promise<void> {
    await this.mergePayload(applicationId, "submitting", {
      submission_payload_hash: payloadHash,
      submission_started_at: new Date().toISOString(),
    });
  }

  async markSubmitted(input: {
    applicationId: string;
    verificationSid: string;
    status: string;
    snapshot: TfvSubmissionPayload;
    operationId: string;
    sanitizedResponse: Readonly<Record<string,unknown>>;
  }): Promise<void> {
    const { error } = await this.supabase
      .from("tfv_applications")
      .update({
        verification_sid: input.verificationSid,
        status: input.status,
        submission_snapshot: input.snapshot,
        request_snapshot: input.snapshot,
        sanitized_response: input.sanitizedResponse,
        response_snapshot: input.sanitizedResponse,
        operation_id: input.operationId,
        submitted_at: new Date().toISOString(),
      })
      .eq("id", input.applicationId);
    if (error) throw databaseError("Unable to save TFV submission.", error.code);
  }

  async markSubmissionFailed(applicationId:string,safeError:string):Promise<void>{await this.mergePayload(applicationId,"failed",{submission_safe_error:safeError,submission_failed_at:new Date().toISOString()});}

  async markSubmissionRecoveryRequired(
    applicationId: string,
    safeError: string,
  ): Promise<void> {
    await this.mergePayload(applicationId, "recovery_required", {
      submission_safe_error: safeError,
    });
  }

  async getStatusSyncCandidate(applicationId:string):Promise<TfvSyncCandidate|null>{const{data,error}=await this.supabase.from("tfv_applications").select("id,client_id,verification_sid,status").eq("id",applicationId).not("verification_sid","is",null).maybeSingle();if(error)throw databaseError("Unable to read TFV sync candidate.",error.code);return data?{id:data.id,clientId:data.client_id,verificationSid:data.verification_sid as string,status:data.status}:null;}

  async listStatusSyncCandidates(
    limit: number,
  ): Promise<readonly TfvSyncCandidate[]> {
    const { data, error } = await this.supabase
      .from("tfv_applications")
      .select("id,client_id,verification_sid,status")
      .not("verification_sid", "is", null)
      .not("status", "in", '("TWILIO_APPROVED","TWILIO_REJECTED")')
      .order("last_refreshed_at", { ascending: true, nullsFirst: true })
      .limit(limit);
    if (error)
      throw databaseError("Unable to list TFV sync candidates.", error.code);
    return (data ?? []).map((row) => ({
      id: row.id,
      clientId: row.client_id,
      verificationSid: row.verification_sid as string,
      status: row.status,
    }));
  }

  async updateRemoteStatus(input: {
    applicationId: string;
    remote: TfvRemoteStatus;
  }): Promise<void> {
    const { error } = await this.supabase
      .from("tfv_applications")
      .update({
        status: input.remote.status,
        rejection_reasons: input.remote.rejectionReasons,
        rejection_reason: input.remote.rejectionReasons,
        error_code: input.remote.errorCode,
        status_updated_at: input.remote.dateUpdated,
        error_codes:
          input.remote.errorCode === null ? [] : [input.remote.errorCode],
        last_refreshed_at: new Date().toISOString(),
      })
      .eq("id", input.applicationId);
    if (error) throw databaseError("Unable to update TFV status.", error.code);
  }

  async markStatusRecoveryRequired(
    applicationId: string,
    safeError: string,
  ): Promise<void> {
    await this.mergePayload(applicationId, "status_recovery_required", {
      status_sync_safe_error: safeError,
      status_sync_failed_at: new Date().toISOString(),
    });
  }

  private async mergePayload(
    applicationId: string,
    status: string,
    additions: Record<string, unknown>,
  ): Promise<void> {
    const { data, error } = await this.supabase
      .from("tfv_applications")
      .select("application_payload")
      .eq("id", applicationId)
      .single();
    if (error) throw databaseError("Unable to read TFV payload.", error.code);
    const { error: updateError } = await this.supabase
      .from("tfv_applications")
      .update({
        status,
        application_payload: {
          ...objectValue(data.application_payload),
          ...additions,
        },
      })
      .eq("id", applicationId);
    if (updateError)
      throw databaseError("Unable to update TFV payload.", updateError.code);
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function databaseError(message: string, databaseCode: string): DomainError {
  return new DomainError("DATABASE_ERROR", message, { databaseCode });
}
