import ExcelJS from "exceljs";
import type { TfvFieldName } from "@/domain/schema/tfv-schema";
import { INTERNAL_CONTROL_FIELDS, TFV_CUSTOMER_INPUT_FIELDS } from "./field-mapping";
import type { ImportValue } from "./types";

export interface ImportTemplateColumn { readonly fieldName: string; readonly column: string; readonly label: string; readonly description: string; readonly required: boolean; readonly enumValues: readonly string[]; }

export function getImportTemplateColumns(): readonly ImportTemplateColumn[] {
  return [
    ...INTERNAL_CONTROL_FIELDS.map((field) => ({ fieldName: field.fieldName, column: field.importColumn, label: field.label, description: field.description, required: false, enumValues: [] as readonly string[] })),
    ...TFV_CUSTOMER_INPUT_FIELDS.map((definition) => ({ fieldName: definition.fieldName, column: definition.importColumn ?? definition.exportColumn, label: definition.label, description: definition.description, required: definition.requiredByTwilio, enumValues: definition.enumValues })),
  ];
}

export function createCsvImportTemplate(): string { return `${getImportTemplateColumns().map((column) => csvCell(column.column)).join(",")}\r\n`; }

export function exportDraftToCsv(payload: Readonly<Partial<Record<TfvFieldName, ImportValue>>>, controls: { internalClientId?: string | null; authorizedContactName?: string | null }): string {
  const columns = getImportTemplateColumns();
  const row = columns.map((column) => {
    if (column.fieldName === "internalClientId") return controls.internalClientId ?? "";
    if (column.fieldName === "authorizedContactName") return controls.authorizedContactName ?? "";
    const value = payload[column.fieldName as TfvFieldName];
    return Array.isArray(value) ? value.join(";") : value === null || value === undefined ? "" : String(value);
  });
  return `${columns.map((column) => csvCell(column.column)).join(",")}\r\n${row.map(csvCell).join(",")}\r\n`;
}

export async function createXlsxImportTemplate(): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook(); workbook.creator = "TFN Console";
  const importSheet = workbook.addWorksheet("Import"); const guide = workbook.addWorksheet("Field Guide"); const columns = getImportTemplateColumns();
  importSheet.addRow(columns.map((column) => column.column)); importSheet.getRow(1).font = { bold: true }; importSheet.views = [{ state: "frozen", ySplit: 1 }];
  guide.addRow(["Column", "Field", "Description", "Required", "Allowed Values"]); guide.getRow(1).font = { bold: true };
  for (const column of columns) guide.addRow([column.column, column.label, column.description, column.required ? "Yes" : "No", column.enumValues.join(" | ")]);
  for (const sheet of [importSheet, guide]) sheet.columns.forEach((column) => { column.width = 28; });
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
function csvCell(value: string): string { return `"${value.replaceAll('"', '""')}"`; }
