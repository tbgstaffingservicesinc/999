import type { AuditLogger } from "@/audit/types";
import type { TfvFieldName } from "@/domain/schema/tfv-schema";
import type { ImportValue } from "@/modules/import";
import type {
  TfvRemoteStatus,
  TfvSubmissionPayload,
  TwilioReadService,
  TwilioWriteService,
} from "@/services/twilio";

export interface TfvSubmissionCandidate {
  readonly id: string;
  readonly clientId: string;
  readonly idempotencyKey: string;
  readonly status: string;
  readonly verificationSid: string | null;
  readonly submissionPayloadEn: Readonly<
    Partial<Record<TfvFieldName, ImportValue>>
  >;
  readonly tollfreePhoneNumberSid: string | null;
}

export interface TfvSyncCandidate {
  readonly id: string;
  readonly clientId: string;
  readonly verificationSid: string;
  readonly status: string;
}

export interface TfvRepository {
  prepareBatch(input:{clientId:string;phoneNumberIds:readonly string[];operationId:string}):Promise<readonly string[]>;
  getSubmissionCandidate(applicationId: string): Promise<TfvSubmissionCandidate | null>;
  markSubmitting(applicationId: string, payloadHash: string): Promise<void>;
  markSubmitted(input: {
    applicationId: string;
    verificationSid: string;
    status: string;
    snapshot: TfvSubmissionPayload;
    operationId: string;
    sanitizedResponse: Readonly<Record<string,unknown>>;
  }): Promise<void>;
  markSubmissionFailed(applicationId:string,safeError:string):Promise<void>;
  markSubmissionRecoveryRequired(
    applicationId: string,
    safeError: string,
  ): Promise<void>;
  getStatusSyncCandidate(applicationId:string):Promise<TfvSyncCandidate|null>;
  listStatusSyncCandidates(limit: number): Promise<readonly TfvSyncCandidate[]>;
  updateRemoteStatus(input: {
    applicationId: string;
    remote: TfvRemoteStatus;
  }): Promise<void>;
  markStatusRecoveryRequired(
    applicationId: string,
    safeError: string,
  ): Promise<void>;
}

export interface TfvSubmitDependencies {
  readonly repository: TfvRepository;
  readonly twilio: TwilioWriteService;
  readonly audit: AuditLogger;
  readonly executionEnabled?: boolean;
}

export interface TfvSubmitResult {
  readonly applicationId: string;
  readonly status:
    | "dry_run"
    | "submitted"
    | "duplicate"
    | "validation_failed"
    | "failed"
    | "recovery_required";
  readonly verificationSid: string | null;
  readonly errors: readonly string[];
}

export interface StatusSyncDependencies {
  readonly repository: TfvRepository;
  readonly twilio: TwilioReadService;
  readonly audit: AuditLogger;
}

export interface StatusSyncItemResult {
  readonly applicationId: string;
  readonly verificationSid: string;
  readonly status: "synced" | "recovery_required";
  readonly remoteStatus: string | null;
}
