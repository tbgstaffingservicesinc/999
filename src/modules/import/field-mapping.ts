import { TFV_SCHEMA, type TfvCanonicalField, type TfvFieldName } from "@/domain/schema/tfv-schema";
import type { FieldMapping } from "./types";

export const IMPORT_SCHEMA_VERSION = "tfv-canonical-1";

export const INTERNAL_CONTROL_FIELDS = [
  { fieldName: "internalClientId", importColumn: "internal_client_id", label: "Internal Client ID", description: "Your unique internal identifier for this client.", aliases: ["internalClientId", "client_id"] },
  { fieldName: "authorizedContactName", importColumn: "authorized_contact_name", label: "Authorized Contact Name", description: "Full name of the person authorized to represent the client.", aliases: ["authorizedContactName"] },
] as const;

export const TFV_CUSTOMER_INPUT_FIELDS = TFV_SCHEMA.filter(
  (definition) =>
    (definition.operations as readonly string[]).includes("create") &&
    definition.fieldName !== "tollfreePhoneNumberSid",
);

export const TFV_RESOURCE_FIELDS = TFV_SCHEMA.filter(
  (definition) => !TFV_CUSTOMER_INPUT_FIELDS.some((input) => input.fieldName === definition.fieldName),
);

const normalizedTargets = new Map<string, FieldMapping["targetField"]>();
const canonicalColumns = new Map<string, string>();
for (const definition of TFV_CUSTOMER_INPUT_FIELDS) {
  for (const alias of fieldAliases(definition)) {
    normalizedTargets.set(normalizeColumn(alias), definition.fieldName);
    canonicalColumns.set(normalizeColumn(alias), definition.importColumn ?? definition.exportColumn);
  }
}
for (const control of INTERNAL_CONTROL_FIELDS) {
  for (const alias of [control.fieldName, control.importColumn, ...control.aliases]) {
    normalizedTargets.set(normalizeColumn(alias), control.fieldName);
    canonicalColumns.set(normalizeColumn(alias), control.importColumn);
  }
}

export function mapImportColumns(columns: readonly string[]): { mappings: FieldMapping[]; unknownFields: string[]; duplicateTargets: string[] } {
  const mappings: FieldMapping[] = [];
  const unknownFields: string[] = [];
  const seenTargets = new Set<string>();
  const duplicateTargets = new Set<string>();
  for (const sourceColumn of columns) {
    const targetField = normalizedTargets.get(normalizeColumn(sourceColumn));
    if (!targetField) { unknownFields.push(sourceColumn); continue; }
    if (seenTargets.has(targetField)) { duplicateTargets.add(targetField); continue; }
    seenTargets.add(targetField);
    mappings.push({ sourceColumn, targetField });
  }
  return { mappings, unknownFields, duplicateTargets: [...duplicateTargets] };
}

export function suggestImportField(column: string): string | null {
  const normalized = normalizeColumn(column);
  let best: { value: string; distance: number } | null = null;
  for (const [candidate, canonical] of canonicalColumns) {
    const distance = levenshtein(normalized, candidate);
    if (!best || distance < best.distance) best = { value: canonical, distance };
  }
  return best && best.distance <= Math.max(2, Math.floor(normalized.length * 0.2)) ? best.value : null;
}

export function getImportField(fieldName: TfvFieldName): TfvCanonicalField {
  const definition = TFV_CUSTOMER_INPUT_FIELDS.find((candidate) => candidate.fieldName === fieldName);
  if (!definition) throw new Error(`TFV field "${fieldName}" is not customer-importable.`);
  return definition;
}

function fieldAliases(definition: TfvCanonicalField): string[] {
  const aliases: Array<string | null> = [definition.fieldName, definition.apiName, definition.label, definition.importColumn, definition.exportColumn];
  if (definition.fieldName === "businessName") aliases.push("business_name", "legal_business_name");
  return aliases.filter((value): value is string => value !== null);
}

export function normalizeColumn(value: string): string {
  return value.replace(/^\uFEFF/, "").trim().replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
}

function levenshtein(left: string, right: string): number {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let previous = row[0]; row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[right.length];
}
