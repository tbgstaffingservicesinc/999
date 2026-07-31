import type { AuditLogger } from "@/audit/types";
import type { TwilioService } from "@/services/twilio";

export type { PurchaseValidationIssue, PurchaseValidationResult } from "./purchase-validator";
import type { PurchaseValidationResult } from "./purchase-validator";

export type PurchaseItemStatus =
  | "pending"
  | "purchasing"
  | "purchased"
  | "duplicate"
  | "failed"
  | "recovery_required"
  | "dry_run";

export interface PurchaseBatchRecord {
  readonly id: string;
  readonly clientId: string;
  readonly idempotencyKey: string;
  readonly status: string;
}

export interface PurchaseItemRecord {
  readonly id: string;
  readonly batchId: string;
  readonly clientId: string;
  readonly requestedPhoneNumber: string;
  readonly phoneNumberSid: string | null;
  readonly status: PurchaseItemStatus;
  readonly safeError: string | null;
}

export interface PurchaseRepository {
  clientExists(clientId: string): Promise<boolean>;
  findBatchByIdempotencyKey(key: string): Promise<PurchaseBatchRecord | null>;
  createBatch(input: {
    clientId: string;
    requestedQuantity: number;
    idempotencyKey: string;
    actorId: string | null;
  }): Promise<PurchaseBatchRecord>;
  listItems(batchId: string): Promise<readonly PurchaseItemRecord[]>;
  createItem(input: {
    batchId: string;
    clientId: string;
    requestedPhoneNumber: string;
  }): Promise<PurchaseItemRecord>;
  findPhoneByNumber(phoneNumber: string): Promise<{
    id: string;
    clientId: string;
    phoneNumberSid: string;
  } | null>;
  markItem(input: {
    itemId: string;
    status: PurchaseItemStatus;
    phoneNumberSid?: string | null;
    safeError?: string | null;
  }): Promise<void>;
  savePurchasedPhone(input: {
    purchaseOperationId: string;
    clientId: string;
    phoneNumberSid: string;
    phoneNumber: string;
    friendlyName: string;
    capabilities: Readonly<Record<string, boolean>>;
  }): Promise<{ id: string }>;
  completeBatch(batchId: string, status: string): Promise<void>;
}

export interface PurchaseEngineDependencies {
  readonly repository: PurchaseRepository;
  readonly twilio: TwilioService;
  readonly audit: AuditLogger;
  readonly executionEnabled?: boolean;
}

export interface PurchaseRequest {
  readonly clientId: string;
  readonly actorId: string | null;
  readonly idempotencyKey?: string;
  readonly purchaseOperationId?: string;
  readonly countryCode?: string;
  readonly operatorConfirmed?: boolean;
  readonly phoneNumbers: readonly string[];
  readonly dryRun: boolean;
}

export interface PurchaseResultItem {
  readonly requestedNumber: string;
  readonly normalizedNumber: string;
  readonly requestedPhoneNumber: string;
  readonly status: PurchaseItemStatus;
  readonly phoneNumberSid: string | null;
  readonly safeError: string | null;
  readonly databaseRecordId: string | null;
  readonly errorCode: number | null;
  readonly errorMessage: string | null;
  readonly reconciliationRequired: boolean;
}

export interface PurchaseEstimatedAction { readonly phoneNumber: string; readonly action: "PURCHASE_TOLL_FREE_NUMBER"; }

export interface PurchaseResult {
  readonly purchaseOperationId: string;
  readonly batchId: string | null;
  readonly duplicateRequest: boolean;
  readonly dryRun: boolean;
  readonly selectedNumbers: readonly string[];
  readonly validationResult: PurchaseValidationResult;
  readonly estimatedActions: readonly PurchaseEstimatedAction[];
  readonly warnings: readonly string[];
  readonly requiresConfirmation: boolean;
  readonly items: readonly PurchaseResultItem[];
}
