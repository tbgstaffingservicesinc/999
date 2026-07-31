import type { ClientCreate } from "@/core/canonical";
import type { TfvFieldName } from "@/domain/schema/tfv-schema";

export type ImportFileFormat = "csv" | "xlsx";
export type ImportValue = string | number | boolean | readonly string[] | null;
export type ImportOutcomeStatus = "imported" | "imported_with_warnings" | "draft_with_errors" | "rejected";
export type RequirementType = "requiredByTwilio" | "conditionallyRequired" | "requiredByBusinessPolicy" | null;
export type ImportClientResolution =
  | { readonly mode: "CREATE_NEW" }
  | { readonly mode: "LINK_EXISTING"; readonly existingClientId: string };

export interface ImportSaveOptions {
  readonly actorId?: string | null;
  readonly defaultResolution?: ImportClientResolution;
  readonly rowResolutions?: Readonly<Record<number, ImportClientResolution>>;
}

export interface ImportFile {
  readonly format: ImportFileFormat;
  readonly data: string | Uint8Array | ArrayBuffer;
  readonly fileName?: string;
  readonly mimeType?: string;
  readonly worksheetName?: string;
}

export interface ParsedImportRow {
  readonly rowNumber: number;
  readonly values: Readonly<Record<string, unknown>>;
}

export interface ParsedImportDocument {
  readonly columns: readonly string[];
  readonly rows: readonly ParsedImportRow[];
  readonly worksheetName: string | null;
}

export interface FieldMapping {
  readonly sourceColumn: string;
  readonly targetField: TfvFieldName | "internalClientId" | "authorizedContactName";
}

export interface ImportMappingResult {
  readonly rowNumber: number;
  readonly sourceColumn: string;
  readonly sourceValue: unknown;
  readonly targetField: FieldMapping["targetField"] | null;
  readonly normalizedValue: ImportValue;
  readonly warning: string | null;
  readonly error: string | null;
}

export interface ImportIssue {
  readonly code: "FILE_TYPE" | "FILE_CONTENT" | "FILE_STRUCTURE" | "UNKNOWN_FIELD" | "DUPLICATE_FIELD" | "DUPLICATE_CLIENT" | "REQUIRED_FIELD" | "INVALID_TYPE" | "INVALID_ENUM" | "INVALID_FORMAT" | "NEEDS_ENGLISH_TRANSLATION" | "PLACEHOLDER_CONTENT" | "DATABASE_ERROR";
  readonly rowNumber: number | null;
  readonly fieldName: string;
  readonly message: string;
  readonly requirementType: RequirementType;
  readonly columnName?: string;
  readonly originalValue?: unknown;
  readonly severity: "warning" | "error";
  readonly suggestedField?: string | null;
}

export interface LanguageValidationResult {
  readonly status: "VALID_ENGLISH" | "NEEDS_ENGLISH_TRANSLATION";
  readonly fields: readonly string[];
}

export interface ImportPreviewRow {
  readonly rowNumber: number;
  readonly status: ImportOutcomeStatus;
  readonly readyForPurchase: boolean;
  readonly readyToSubmit: false;
  readonly originalImportPayload: Readonly<Record<string, unknown>>;
  readonly rawImportPayload: Readonly<Record<string, unknown>>;
  readonly importMappingResult: readonly ImportMappingResult[];
  readonly submissionPayloadEn: Readonly<Partial<Record<TfvFieldName, ImportValue>>>;
  readonly client: ClientCreate | null;
  readonly internalClientId: string | null;
  readonly authorizedContactName: string | null;
  readonly languageValidation: LanguageValidationResult;
  readonly warnings: readonly ImportIssue[];
  readonly errors: readonly ImportIssue[];
}

export interface ImportPreview {
  readonly importOperationId: string;
  readonly schemaVersion: string;
  readonly sourceFilename: string;
  readonly importedAt: string;
  readonly format: ImportFileFormat;
  readonly worksheetName: string | null;
  readonly fileIssues: readonly ImportIssue[];
  readonly rows: readonly ImportPreviewRow[];
}

export interface AtomicImportDraftCreate {
  readonly resolution: ImportClientResolution;
  readonly client: ClientCreate | null;
  readonly internalClientId: string | null;
  readonly status: "DRAFT" | "DRAFT_WITH_ERRORS" | "NEEDS_ENGLISH_TRANSLATION";
  readonly idempotencyKey: string;
  readonly applicationPayload: Readonly<Record<string, unknown>>;
}

export interface AtomicImportDraftResult {
  readonly draftId: string;
  readonly clientId: string;
  readonly status: string;
  readonly clientCreated: boolean;
}

export interface ImportDraftRepository {
  saveAtomic(input: AtomicImportDraftCreate): Promise<AtomicImportDraftResult>;
}

export interface ImportEngineRepositories {
  readonly importDrafts: ImportDraftRepository;
  readonly audit?: { append(input: { clientId: string | null; actorId: string | null; action: string; entityType: string | null; entityId: string | null; safeDetails: Record<string, unknown> }): Promise<unknown> };
}

export interface ImportRowExecutionResult {
  readonly rowNumber: number;
  readonly clientId: string | null;
  readonly draftId: string | null;
  readonly status: ImportOutcomeStatus;
  readonly warnings: readonly ImportIssue[];
  readonly errors: readonly ImportIssue[];
  readonly languageStatus: LanguageValidationResult["status"];
  readonly compensation: "not_needed";
}

export interface ImportExecutionResult {
  readonly importOperationId: string;
  readonly rows: readonly ImportRowExecutionResult[];
}



