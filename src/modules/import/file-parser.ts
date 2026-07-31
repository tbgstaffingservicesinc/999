import ExcelJS from "exceljs";
import { normalizeColumn } from "./field-mapping";
import type { ImportFile, ParsedImportDocument, ParsedImportRow } from "./types";

const CSV_MIME_TYPES = new Set(["text/csv", "application/csv", "text/plain", "application/vnd.ms-excel"]);
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export class ImportFileError extends Error {
  constructor(readonly code: "FILE_TYPE" | "FILE_CONTENT" | "FILE_STRUCTURE", message: string) { super(message); }
}

export async function parseImportFile(file: ImportFile): Promise<ParsedImportDocument> {
  validateMime(file);
  if (file.format === "csv") {
    const source = typeof file.data === "string" ? file.data : new TextDecoder("utf-8", { fatal: true }).decode(toUint8Array(file.data));
    return parseCsv(source);
  }
  const bytes = typeof file.data === "string" ? Buffer.from(file.data, "base64") : Buffer.from(toUint8Array(file.data));
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new ImportFileError("FILE_CONTENT", "The XLSX content is not a valid ZIP-based workbook.");
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer); }
  catch { throw new ImportFileError("FILE_CONTENT", "The XLSX workbook could not be parsed."); }
  if (workbook.worksheets.length === 0) throw new ImportFileError("FILE_STRUCTURE", "The XLSX workbook contains no worksheets.");
  const worksheet = selectWorksheet(workbook, file.worksheetName);
  if ((worksheet.model.merges ?? []).length > 0) throw new ImportFileError("FILE_STRUCTURE", `Worksheet "${worksheet.name}" contains merged cells; merged import cells are not supported.`);
  if (worksheet.rowCount === 0 || worksheet.columnCount === 0) throw new ImportFileError("FILE_STRUCTURE", `Worksheet "${worksheet.name}" is empty.`);
  const columns = Array.from({ length: worksheet.columnCount }, (_, index) => cellText(worksheet.getRow(1).getCell(index + 1).value));
  validateHeaders(columns);
  const rows: ParsedImportRow[] = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const values = Object.fromEntries(columns.map((column, index) => [column, excelValue(worksheet.getRow(rowNumber).getCell(index + 1).value)]));
    if (!Object.values(values).every(isBlank)) rows.push({ rowNumber, values });
  }
  return { columns, rows, worksheetName: worksheet.name };
}

export function parseCsv(source: string): ParsedImportDocument {
  if (source.replace(/^\uFEFF/, "").trim() === "") throw new ImportFileError("FILE_CONTENT", "The CSV file is empty.");
  const table: string[][] = []; let row: string[] = []; let value = ""; let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') { value += '"'; index += 1; } else quoted = !quoted;
    } else if (character === "," && !quoted) { row.push(value); value = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(value); table.push(row); row = []; value = "";
    } else value += character;
  }
  if (quoted) throw new ImportFileError("FILE_CONTENT", "The CSV contains an unterminated quoted field.");
  row.push(value); table.push(row);
  const columns = (table.shift() ?? []).map((header) => header.replace(/^\uFEFF/, "").trim());
  validateHeaders(columns);
  const rows = table.filter((values) => values.some((item) => item.trim() !== "")).map((values, index) => ({ rowNumber: index + 2, values: Object.fromEntries(columns.map((header, column) => [header, values[column] ?? ""])) }));
  return { columns, rows, worksheetName: null };
}

function validateMime(file: ImportFile): void {
  if (!file.mimeType) return;
  const mime = file.mimeType.toLowerCase().split(";")[0].trim();
  if (file.format === "csv" && !CSV_MIME_TYPES.has(mime)) throw new ImportFileError("FILE_TYPE", `MIME type "${mime}" is not valid for CSV import.`);
  if (file.format === "xlsx" && mime !== XLSX_MIME) throw new ImportFileError("FILE_TYPE", `MIME type "${mime}" is not valid for XLSX import.`);
}

function validateHeaders(columns: readonly string[]): void {
  if (columns.length === 0 || columns.every((column) => column === "")) throw new ImportFileError("FILE_STRUCTURE", "The import file has no header row.");
  if (columns.some((column) => column === "")) throw new ImportFileError("FILE_STRUCTURE", "The header row contains a blank column name.");
  const seen = new Set<string>(); const duplicates = new Set<string>();
  for (const column of columns) { const normalized = normalizeColumn(column); if (seen.has(normalized)) duplicates.add(column); seen.add(normalized); }
  if (duplicates.size > 0) throw new ImportFileError("FILE_STRUCTURE", `Duplicate header columns: ${[...duplicates].join(", ")}.`);
}

function selectWorksheet(workbook: ExcelJS.Workbook, requested?: string): ExcelJS.Worksheet {
  if (requested) { const selected = workbook.getWorksheet(requested); if (!selected) throw new ImportFileError("FILE_STRUCTURE", `Worksheet "${requested}" was not found.`); return selected; }
  const namedImport = workbook.getWorksheet("Import");
  if (namedImport) return namedImport;
  if (workbook.worksheets.length === 1) return workbook.worksheets[0];
  throw new ImportFileError("FILE_STRUCTURE", "The workbook contains multiple worksheets. Specify worksheetName or provide a worksheet named \"Import\".");
}

function toUint8Array(data: Uint8Array | ArrayBuffer): Uint8Array { return data instanceof Uint8Array ? data : new Uint8Array(data); }
function cellText(value: ExcelJS.CellValue | undefined): string { return String(excelValue(value) ?? "").trim(); }
function excelValue(value: ExcelJS.CellValue | undefined): unknown {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("result" in value) return value.result ?? "";
    if ("text" in value) return value.text;
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
    if ("hyperlink" in value) return "text" in value ? value.text : String(value.hyperlink);
  }
  return value;
}
function isBlank(value: unknown): boolean { return value === null || value === undefined || String(value).trim() === ""; }
