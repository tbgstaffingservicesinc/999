import type { ClientCreate } from "@/core/canonical";
import type { TfvCanonicalField, TfvFieldName } from "@/domain/schema/tfv-schema";
import { getImportField, TFV_CUSTOMER_INPUT_FIELDS } from "./field-mapping";
import type { FieldMapping, ImportIssue, ImportMappingResult, ImportValue, LanguageValidationResult, RequirementType } from "./types";

const ENGLISH_TEXT_FIELDS = new Set<TfvFieldName>(["businessName", "doingBusinessAs", "useCaseSummary", "productionMessageSample", "optInConfirmationMessage", "helpMessageSample", "additionalInformation", "businessStreetAddress", "businessStreetAddress2"]);
const CJK_OR_FULL_WIDTH = /[\u2E80-\u2FFF\u3000-\u303F\u31C0-\u31EF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF01-\uFF60\uFFE0-\uFFE6]/u;
const NON_ASCII_LETTER = /\p{L}/u;
const PLACEHOLDER = /^(?:test|testing|example|sample|placeholder|to be (?:added|confirmed|determined|provided)|not (?:available|confirmed|determined)|unknown|none|tba|tbd|n\/?a)$/i;

export function mapAndValidateRow(raw: Readonly<Record<string, unknown>>, mappings: readonly FieldMapping[], rowNumber: number): { submissionPayloadEn: Partial<Record<TfvFieldName, ImportValue>>; client: ClientCreate | null; internalClientId: string | null; authorizedContactName: string | null; languageValidation: LanguageValidationResult; issues: ImportIssue[]; mappingResults: ImportMappingResult[] } {
  const issues: ImportIssue[] = []; const submission: Partial<Record<TfvFieldName, ImportValue>> = {}; const mappingResults: ImportMappingResult[] = [];
  let internalClientId = ""; let authorizedContactName: string | null = null;
  for (const mapping of mappings) {
    const rawValue = raw[mapping.sourceColumn];
    if (mapping.targetField === "internalClientId" || mapping.targetField === "authorizedContactName") {
      const normalized = nullableString(rawValue);
      if (mapping.targetField === "internalClientId") internalClientId = normalized ?? ""; else authorizedContactName = normalized;
      mappingResults.push({ rowNumber, sourceColumn: mapping.sourceColumn, sourceValue: rawValue, targetField: mapping.targetField, normalizedValue: normalized, warning: null, error: null });
      continue;
    }
    const definition = getImportField(mapping.targetField); const before = issues.length;
    const normalized = coerceValue(definition, rawValue, rowNumber, issues);
    const fieldErrors = issues.slice(before);
    if (normalized !== null && fieldErrors.length === 0) submission[mapping.targetField] = normalized;
    mappingResults.push({ rowNumber, sourceColumn: mapping.sourceColumn, sourceValue: rawValue, targetField: mapping.targetField, normalizedValue: normalized, warning: null, error: fieldErrors.map((issue) => issue.message).join("; ") || null });
  }
  for (const definition of TFV_CUSTOMER_INPUT_FIELDS) {
    const requirementType = activeRequirement(definition, submission);
    if (requirementType && isBlank(submission[definition.fieldName])) issues.push(issue("REQUIRED_FIELD", rowNumber, definition.fieldName, `${definition.label} is required.`, requirementType));
  }
  const languageFields: string[] = [];
  for (const fieldName of ENGLISH_TEXT_FIELDS) {
    const value = submission[fieldName]; if (value === undefined || value === null) continue;
    const text = Array.isArray(value) ? value.join(" ") : String(value);
    if (containsNonEnglishText(text)) {
      languageFields.push(fieldName); issues.push(issue("NEEDS_ENGLISH_TRANSLATION", rowNumber, fieldName, `${getImportField(fieldName).label} must be manually confirmed in American English.`, null)); delete submission[fieldName]; continue;
    }
    const definition = getImportField(fieldName); const required = activeRequirement(definition, submission) !== null;
    const placeholder = PLACEHOLDER.test(text.trim());
    const isRequiredAnswerPlaceholder = required || !/^n\/?a$/i.test(text.trim());
    if (placeholder && isRequiredAnswerPlaceholder) {
      languageFields.push(fieldName); issues.push(issue("PLACEHOLDER_CONTENT", rowNumber, fieldName, `${definition.label} contains placeholder content and requires a complete American English answer.`, activeRequirement(definition, submission))); delete submission[fieldName];
    }
  }
  const businessName = nullableString(submission.businessName);
  const client = businessName ? { internalClientId, legalBusinessName: businessName, dba: nullableString(submission.doingBusinessAs), businessType: nullableString(submission.businessType), businessWebsite: nullableString(submission.businessWebsite), notificationEmail: nullableString(submission.notificationEmail), authorizedContactName, authorizationConfirmed: false, active: true } : null;
  const finalizedMappings = mappingResults.map((result) => {
    const fieldIssues = issues.filter((item) => item.fieldName === result.targetField);
    return { ...result, warning: fieldIssues.filter((item) => item.severity === "warning").map((item) => item.message).join("; ") || result.warning, error: fieldIssues.filter((item) => item.severity === "error").map((item) => item.message).join("; ") || result.error };
  });
  return { submissionPayloadEn: submission, client, internalClientId: internalClientId || null, authorizedContactName, languageValidation: { status: languageFields.length ? "NEEDS_ENGLISH_TRANSLATION" : "VALID_ENGLISH", fields: languageFields }, issues, mappingResults: finalizedMappings };
}

function activeRequirement(definition: TfvCanonicalField, payload: Partial<Record<TfvFieldName, ImportValue>>): RequirementType {
  const rules = definition.validationRule.split("|");
  for (const rule of rules) {
    if (rule.startsWith("requiredUnless:")) { const [field, value] = rule.slice(15).split("="); if (String(payload[field as TfvFieldName] ?? "") !== value) return "conditionallyRequired"; }
    if (rule.startsWith("requiredWith:")) { const field = rule.slice(13) as TfvFieldName; if (!isBlank(payload[field])) return "conditionallyRequired"; }
    if (rule.startsWith("requiredForUseCase:")) { const value = rule.slice(19); const categories = payload.useCaseCategories; if (Array.isArray(categories) && categories.includes(value)) return "conditionallyRequired"; }
  }
  if (definition.requiredByTwilio) return "requiredByTwilio";
  if (definition.requiredByBusiness) return "requiredByBusinessPolicy";
  return null;
}

function coerceValue(definition: TfvCanonicalField, rawValue: unknown, rowNumber: number, issues: ImportIssue[]): ImportValue {
  if (isBlank(rawValue)) return null; const text = stringValue(rawValue);
  if (definition.type === "boolean") { if (typeof rawValue === "boolean") return rawValue; if (/^(true|yes|1)$/i.test(text)) return true; if (/^(false|no|0)$/i.test(text)) return false; issues.push(issue("INVALID_TYPE", rowNumber, definition.fieldName, `${definition.label} must be a boolean.`, null)); return null; }
  if (definition.type === "integer") { const number = Number(rawValue); if (Number.isInteger(number)) return number; issues.push(issue("INVALID_TYPE", rowNumber, definition.fieldName, `${definition.label} must be an integer.`, null)); return null; }
  if (definition.type === "stringArray" || definition.type === "enumArray") { const values = arrayValue(rawValue); if (definition.type === "enumArray") validateEnum(definition, values, rowNumber, issues); return values; }
  if (definition.type === "enum") { if (!(definition.enumValues as readonly string[]).includes(text)) issues.push(issue("INVALID_ENUM", rowNumber, definition.fieldName, `${definition.label} must be one of: ${definition.enumValues.join(", ")}.`, null)); return text; }
  if (definition.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) issues.push(issue("INVALID_FORMAT", rowNumber, definition.fieldName, `${definition.label} must be a valid email address.`, null));
  if (definition.type === "url" && !isHttpUrl(text)) issues.push(issue("INVALID_FORMAT", rowNumber, definition.fieldName, `${definition.label} must be an HTTP or HTTPS URL.`, null));
  if (definition.type === "phone" && !/^\+[1-9]\d{7,14}$/.test(text)) issues.push(issue("INVALID_FORMAT", rowNumber, definition.fieldName, `${definition.label} must be an E.164 phone number.`, null));
  if (definition.type === "sid" && !/^[A-Z]{2}[A-Za-z0-9]{32}$/.test(text)) issues.push(issue("INVALID_FORMAT", rowNumber, definition.fieldName, `${definition.label} must be a Twilio SID.`, null));
  return text;
}

function containsNonEnglishText(value: string): boolean { if (CJK_OR_FULL_WIDTH.test(value)) return true; for (const character of value) if (character.codePointAt(0)! > 0x7f && NON_ASCII_LETTER.test(character)) return true; return false; }
function validateEnum(definition: TfvCanonicalField, values: readonly string[], rowNumber: number, issues: ImportIssue[]): void { const invalid = values.filter((value) => !(definition.enumValues as readonly string[]).includes(value)); if (invalid.length) issues.push(issue("INVALID_ENUM", rowNumber, definition.fieldName, `${definition.label} contains unsupported values: ${invalid.join(", ")}.`, null)); }
function arrayValue(value: unknown): string[] { if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean); const text = stringValue(value); if (text.startsWith("[")) try { const parsed: unknown = JSON.parse(text); if (Array.isArray(parsed)) return parsed.map(String).map((item) => item.trim()).filter(Boolean); } catch {} return text.split(/[;|]/).map((item) => item.trim()).filter(Boolean); }
function issue(code: ImportIssue["code"], rowNumber: number, fieldName: string, message: string, requirementType: RequirementType): ImportIssue { return { code, rowNumber, fieldName, message, requirementType, severity: "error" }; }
function stringValue(value: unknown): string { return value === null || value === undefined ? "" : String(value).trim(); }
function nullableString(value: unknown): string | null { const result = stringValue(value); return result || null; }
function isBlank(value: unknown): boolean { return value === null || value === undefined || value === ""; }
function isHttpUrl(value: string): boolean { try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; } }


