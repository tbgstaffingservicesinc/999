import { randomUUID } from "node:crypto";
import { IMPORT_SCHEMA_VERSION, mapImportColumns, suggestImportField } from "./field-mapping";
import { ImportFileError, parseImportFile } from "./file-parser";
import type { ImportEngineRepositories, ImportExecutionResult, ImportFile, ImportIssue, ImportPreview, ImportPreviewRow, ImportRowExecutionResult, ImportSaveOptions } from "./types";
import { mapAndValidateRow } from "./validation";

export class ImportEngine {
  constructor(private readonly repositories: ImportEngineRepositories) {}

  async preview(file: ImportFile): Promise<ImportPreview> {
    const metadata = { importOperationId: randomUUID(), schemaVersion: IMPORT_SCHEMA_VERSION, sourceFilename: file.fileName ?? `import.${file.format}`, importedAt: new Date().toISOString(), format: file.format } as const;
    let document;
    try { document = await parseImportFile(file); }
    catch (error) {
      const known = error instanceof ImportFileError ? error : new ImportFileError("FILE_CONTENT", "The import file could not be parsed.");
      return { ...metadata, worksheetName: null, fileIssues: [fileIssue(known.code, known.message)], rows: [] };
    }
    const mapped = mapImportColumns(document.columns);
    if (document.rows.length === 0) {
      const message = mapped.mappings.length === 0 ? "The file does not contain a recognizable header row." : "The import file contains a header but no data rows.";
      return { ...metadata, worksheetName: document.worksheetName, fileIssues: [fileIssue("FILE_STRUCTURE", message)], rows: [] };
    }
    const rows = document.rows.map((row): ImportPreviewRow => {
      const unknownIssues: ImportIssue[] = mapped.unknownFields.map((columnName) => ({ code: "UNKNOWN_FIELD", rowNumber: row.rowNumber, fieldName: columnName, columnName, originalValue: row.values[columnName], severity: "warning", suggestedField: suggestImportField(columnName), message: `Unknown import field "${columnName}" was preserved but not mapped.`, requirementType: null }));
      const duplicateIssues: ImportIssue[] = mapped.duplicateTargets.map((fieldName) => ({ code: "DUPLICATE_FIELD", rowNumber: row.rowNumber, fieldName, severity: "error", message: `Multiple source columns map to "${fieldName}".`, requirementType: null }));
      const validated = mapAndValidateRow(row.values, mapped.mappings, row.rowNumber);
      const issues = [...unknownIssues, ...duplicateIssues, ...validated.issues];
      const warnings = issues.filter((issue) => issue.severity === "warning"); const errors = issues.filter((issue) => issue.severity === "error");
      const status = errors.length ? "draft_with_errors" : warnings.length ? "imported_with_warnings" : "imported";
      const unknownMappings = unknownIssues.map((item) => ({ rowNumber: row.rowNumber, sourceColumn: item.columnName!, sourceValue: item.originalValue, targetField: null, normalizedValue: null, warning: item.message, error: null }));
      return { rowNumber: row.rowNumber, status, readyForPurchase: errors.length === 0, readyToSubmit: false, originalImportPayload: Object.freeze({ ...row.values }), rawImportPayload: Object.freeze({ ...row.values }), importMappingResult: [...validated.mappingResults, ...unknownMappings], submissionPayloadEn: Object.freeze(validated.submissionPayloadEn), client: validated.client, internalClientId: validated.internalClientId, authorizedContactName: validated.authorizedContactName, languageValidation: validated.languageValidation, warnings, errors };
    });
    const clientRows = new Map<string, number[]>();
    for (const row of rows) {
      const clientId = row.client?.internalClientId;
      if (clientId) clientRows.set(clientId, [...(clientRows.get(clientId) ?? []), row.rowNumber]);
    }
    const finalizedRows = rows.map((row): ImportPreviewRow => {
      const clientId = row.client?.internalClientId;
      const duplicates = clientId ? clientRows.get(clientId) ?? [] : [];
      if (duplicates.length < 2) return row;
      const warning: ImportIssue = { code: "DUPLICATE_CLIENT", rowNumber: row.rowNumber, fieldName: "internalClientId", columnName: "internal_client_id", originalValue: clientId, severity: "warning", suggestedField: null, message: `Internal Client ID "${clientId}" appears on rows ${duplicates.join(", ")}. Existing client data will not be overwritten.`, requirementType: null };
      return { ...row, status: row.errors.length ? "draft_with_errors" : "imported_with_warnings", readyForPurchase: false, warnings: [...row.warnings, warning] };
    });
    return { ...metadata, worksheetName: document.worksheetName, fileIssues: [], rows: finalizedRows };
  }

  async saveDrafts(file: ImportFile, options: ImportSaveOptions = {}): Promise<ImportExecutionResult> {
    const preview = await this.preview(file);
    const results: ImportRowExecutionResult[] = [];
    await this.safeAudit({clientId:null,actorId:options.actorId??null,action:"import_started",entityType:"import_operation",entityId:null,safeDetails:{importOperationId:preview.importOperationId,sourceFilename:preview.sourceFilename}});
    const defaultResolution = options.defaultResolution ?? { mode: "CREATE_NEW" as const };

    for (const row of preview.rows) {
      const resolution = options.rowResolutions?.[row.rowNumber] ?? defaultResolution;
      const resolutionError = validateResolution(row, resolution);
      if (resolutionError) {
        results.push(rejectedRow(row, resolutionError));
        continue;
      }

      try {
        const application = await this.repositories.importDrafts.saveAtomic({
          resolution,
          client: row.client,
          internalClientId: row.internalClientId,
          status: row.languageValidation.status === "NEEDS_ENGLISH_TRANSLATION" ? "NEEDS_ENGLISH_TRANSLATION" : row.errors.length ? "DRAFT_WITH_ERRORS" : "DRAFT",
          idempotencyKey: randomUUID(),
          applicationPayload: {
            import_operation_id: preview.importOperationId,
            source_filename: preview.sourceFilename,
            imported_at: preview.importedAt,
            schema_version: preview.schemaVersion,
            row_number: row.rowNumber,
            import_status: row.status,
            client_resolution: resolution.mode,
            validation_results: { warnings: row.warnings, errors: row.errors, language: row.languageValidation },
            original_import_payload: row.originalImportPayload,
            raw_import_payload: sanitizeForNonOriginalPayload(row.rawImportPayload),
            import_mapping_result: sanitizeForNonOriginalPayload(row.importMappingResult),
            submission_payload_en: row.submissionPayloadEn,
            ready_for_purchase: row.readyForPurchase,
            ready_to_submit: false,
          },
        });
        try {
          await this.repositories.audit?.append({ clientId: application.clientId, actorId: options.actorId ?? null, action: "import_draft_saved", entityType: "tfv_application", entityId: application.draftId, safeDetails: { importOperationId: preview.importOperationId, rowNumber: row.rowNumber, status: row.status, resolution: resolution.mode } });
        } catch {
          // The atomic database result remains authoritative if audit persistence fails.
        }
        results.push({ rowNumber: row.rowNumber, clientId: application.clientId, draftId: application.draftId, status: row.status, warnings: row.warnings, errors: row.errors, languageStatus: row.languageValidation.status, compensation: "not_needed" });
      } catch {
        results.push(rejectedRow(row, "The client and draft transaction failed; neither record was reported as saved."));
        await this.safeAudit({clientId:null,actorId:options.actorId??null,action:"import_failed",entityType:"import_operation",entityId:null,safeDetails:{importOperationId:preview.importOperationId,rowNumber:row.rowNumber}});
      }
    }
    await this.safeAudit({clientId:null,actorId:options.actorId??null,action:"import_completed",entityType:"import_operation",entityId:null,safeDetails:{importOperationId:preview.importOperationId,total:results.length,rejected:results.filter(row=>row.status==="rejected").length}});
    return { importOperationId: preview.importOperationId, rows: results };
  }
  private async safeAudit(input:Parameters<NonNullable<ImportEngineRepositories["audit"]>["append"]>[0]){try{await this.repositories.audit?.append(input);}catch{}}
}

function validateResolution(row: ImportPreviewRow, resolution: import("./types").ImportClientResolution): string | null {
  if (resolution.mode === "CREATE_NEW") {
    if (!row.client) return "CREATE_NEW requires a valid Business Name and client profile.";
    return null;
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(resolution.existingClientId)) {
    return "LINK_EXISTING requires a valid existing client UUID.";
  }
  if (!row.internalClientId) return "LINK_EXISTING requires Internal Client ID for identity verification.";
  return null;
}

function fileIssue(code: ImportIssue["code"], message: string): ImportIssue { return { code, rowNumber: null, fieldName: "$file", message, requirementType: null, severity: "error" }; }
function rejectedRow(row: ImportPreviewRow, message: string): ImportRowExecutionResult { const databaseIssue: ImportIssue = { code: "DATABASE_ERROR", rowNumber: row.rowNumber, fieldName: "$database", message, requirementType: null, severity: "error" }; return { rowNumber: row.rowNumber, clientId: null, draftId: null, status: "rejected", warnings: row.warnings, errors: [...row.errors, databaseIssue], languageStatus: row.languageValidation.status, compensation: "not_needed" }; }

function sanitizeForNonOriginalPayload(value: unknown): unknown {
  if (typeof value === "string") {
    return containsNonEnglish(value) ? "[REQUIRES_ENGLISH_TRANSLATION]" : value;
  }
  if (Array.isArray(value)) return value.map(sanitizeForNonOriginalPayload);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeForNonOriginalPayload(item)]));
  }
  return value;
}

function containsNonEnglish(value: string): boolean {
  if (/[\u2E80-\u2FFF\u3000-\u303F\u31C0-\u31EF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF01-\uFF60\uFFE0-\uFFE6]/u.test(value)) return true;
  for (const character of value) {
    if (character.codePointAt(0)! > 0x7f && /\p{L}/u.test(character)) return true;
  }
  return false;
}
export type { ImportPreviewRow };




