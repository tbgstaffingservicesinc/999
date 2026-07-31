import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { TFV_CUSTOMER_INPUT_FIELDS, TFV_RESOURCE_FIELDS } from "../src/modules/import/field-mapping";
import { ImportEngine } from "../src/modules/import/import-engine";
import { createCsvImportTemplate, createXlsxImportTemplate, exportDraftToCsv, getImportTemplateColumns } from "../src/modules/import/template";
import type { AtomicImportDraftCreate, ImportEngineRepositories } from "../src/modules/import/types";

const BASE_ROW: Record<string, string> = {
  internal_client_id: "client-001", legal_business_name: "Example Communications LLC", dba: "Example Communications",
  business_address: "100 Main Street", business_street_address_2: "Suite 200", business_city: "Austin", business_state: "TX", business_postal_code: "78701", business_country: "US",
  business_website: "https://example.com", business_contact_first_name: "Alex", business_contact_last_name: "Morgan", authorized_contact_email: "alex@example.com", authorized_contact_phone: "+15125550100",
  notification_email: "compliance@example.com", use_case_categories: "CUSTOMER_CARE", message_use_case: "We send customer support updates after consumers request assistance.",
  sample_messages: "Example Communications: Your support request has been updated. Reply HELP for help.", opt_in_image_url: "https://example.com/opt-in.png", opt_in_type: "WEB_FORM", estimated_monthly_message_volume: "1,000",
  business_type: "PRIVATE_PROFIT", business_registration_number: "12-3456789", business_registration_authority: "EIN", business_registration_country: "US", business_phone: "+15125550101",
  opt_in_message: "Example Communications: You are subscribed. Reply STOP to opt out.", help_message: "Example Communications: Reply STOP to opt out or contact support@example.com.",
  privacy_policy_url: "https://example.com/privacy", terms_and_conditions_url: "https://example.com/terms", age_gated_content: "false", opt_in_keywords: "START;YES",
};

test("01 normal CSV import", async () => { const p = await preview(BASE_ROW); assert.equal(p.rows[0].status, "imported"); });
test("02 normal XLSX import reads workbook content", async () => { const p = await xlsxPreview(BASE_ROW); assert.equal(p.rows[0].submissionPayloadEn.businessName, BASE_ROW.legal_business_name); });
test("03 UTF-8 BOM CSV", async () => { const p = await engine().preview({ format: "csv", mimeType: "text/csv", data: `\uFEFF${csv(BASE_ROW)}` }); assert.equal(p.rows[0].status, "imported"); });
test("04 empty file is rejected", async () => { const p = await engine().preview({ format: "csv", data: "" }); assert.equal(p.fileIssues[0].code, "FILE_CONTENT"); });
test("05 missing header is rejected", async () => { const p = await engine().preview({ format: "csv", data: Object.values(BASE_ROW).map(csvCell).join(",") }); assert.equal(p.fileIssues[0].code, "FILE_STRUCTURE"); });
test("06 duplicate header is rejected", async () => { const p = await engine().preview({ format: "csv", data: 'internal_client_id,internal_client_id\na,b\n' }); assert.match(p.fileIssues[0].message, /Duplicate header/); });
test("07 unknown field preserves row details", async () => { const p = await preview({ ...BASE_ROW, business_websit: "https://typo.example" }); const w=p.rows[0].warnings[0]; assert.equal(w.code,"UNKNOWN_FIELD"); assert.equal(w.rowNumber,2); assert.equal(w.originalValue,"https://typo.example"); assert.equal(w.suggestedField,"business_website"); assert.equal(p.rows[0].status,"imported_with_warnings"); });
test("08 optional empty field imports", async () => { const p = await preview({ ...BASE_ROW, additional_notes: "" }); assert.notEqual(p.rows[0].status,"rejected"); });
test("09 missing required field saves draft with errors", async () => { const repos=fakeRepositories(); const result=await engine(repos).saveDrafts(csvFile({ ...BASE_ROW, business_website:"" })); assert.equal(result.rows[0].status,"draft_with_errors"); assert.ok(result.rows[0].draftId); });
test("10 conditional required fields come from schema rule", async () => { const row={...BASE_ROW}; delete row.business_registration_number; const p=await preview(row); assert.ok(p.rows[0].errors.some(e=>e.fieldName==="businessRegistrationNumber"&&e.requirementType==="conditionallyRequired")); });
test("11 multi-row partial success remains independent", async () => { const repos=fakeRepositories({ failClientIds:new Set(["client-002"]) }); const second={...BASE_ROW,internal_client_id:"client-002"}; const result=await engine(repos).saveDrafts(csvRows([BASE_ROW,second])); assert.equal(result.rows[0].status,"imported"); assert.equal(result.rows[1].status,"rejected"); });
test("12 Chinese UseCaseSummary", async () => assertLanguageBlocked("message_use_case","用于客户服务"));
test("13 Chinese ProductionMessageSample", async () => assertLanguageBlocked("sample_messages","这是消息示例"));
test("14 Chinese AdditionalInformation", async () => assertLanguageBlocked("additional_notes","暂无补充信息"));
test("15 Chinese full-width punctuation", async () => assertLanguageBlocked("message_use_case","Customer support updates。"));
test("16 Chinese remains in original_import_payload", async () => { const repos=fakeRepositories(); await engine(repos).saveDrafts(csvFile({...BASE_ROW,additional_notes:"待填写"})); assert.equal((repos.savedDrafts[0].applicationPayload.original_import_payload as Record<string, unknown>).additional_notes,"待填写"); });
test("16b Chinese is redacted outside original_import_payload at persistence", async () => { const repos=fakeRepositories(); await engine(repos).saveDrafts(csvFile({...BASE_ROW,additional_notes:"待填写"})); const payload=repos.savedDrafts[0].applicationPayload; assert.equal((payload.raw_import_payload as Record<string,unknown>).additional_notes,"[REQUIRES_ENGLISH_TRANSLATION]"); assert.doesNotMatch(JSON.stringify(payload.import_mapping_result),/待填写/); });
test("17 Chinese does not enter submission_payload_en", async () => { const p=await preview({...BASE_ROW,additional_notes:"待填写"}); assert.equal(p.rows[0].submissionPayloadEn.additionalInformation,undefined); });
test("18 resource fields do not appear in templates", () => { const columns=getImportTemplateColumns().map(c=>c.fieldName); for(const forbidden of ["sid","status","dateCreated","dateUpdated","errorCode","rejectionReason","editReason"]) assert.ok(!columns.includes(forbidden)); });
test("19 internal_client_id is excluded from submission", async () => { const p=await preview(BASE_ROW); assert.ok(!("internalClientId" in p.rows[0].submissionPayloadEn)); });
test("20 authorized_contact_name is excluded from submission", async () => { const p=await preview({...BASE_ROW,authorized_contact_name:"Alex Morgan"}); assert.ok(!("authorizedContactName" in p.rows[0].submissionPayloadEn)); });
test("21 client write failure prevents draft write", async () => { const repos=fakeRepositories({failClientIds:new Set(["client-001"])}); const r=await engine(repos).saveDrafts(csvFile(BASE_ROW)); assert.equal(r.rows[0].status,"rejected"); assert.equal(repos.savedDrafts.length,0); });
test("22 atomic draft failure reports no client or draft success", async () => { const repos=fakeRepositories({failDraft:true}); const r=await engine(repos).saveDrafts(csvFile(BASE_ROW)); assert.equal(r.rows[0].status,"rejected"); assert.equal(r.rows[0].clientId,null); assert.equal(repos.savedDrafts.length,0); });
test("23 database failure never reports success", async () => { const r=await engine(fakeRepositories({failDraft:true})).saveDrafts(csvFile(BASE_ROW)); assert.equal(r.rows.some(x=>x.status==="imported"),false); });
test("24 operation and idempotency UUIDs do not use Math.random", async () => { const original=Math.random; Math.random=()=>{throw new Error("forbidden")}; try { const repos=fakeRepositories(); const r=await engine(repos).saveDrafts(csvFile(BASE_ROW)); assert.match(r.importOperationId,/^[0-9a-f-]{36}$/i); assert.match(repos.savedDrafts[0].idempotencyKey,/^[0-9a-f-]{36}$/i); } finally { Math.random=original; } });
test("25 Import Engine has no Twilio dependency", async () => { const source=await readFile("src/modules/import/import-engine.ts","utf8"); assert.doesNotMatch(source,/from ["']twilio["']|twilio\.com|auth\/v1/i); });
test("26 no external POST is executed", async () => { const original=globalThis.fetch; let calls=0; globalThis.fetch=(async()=>{calls+=1; throw new Error("network forbidden")}) as typeof fetch; try { await engine(fakeRepositories()).saveDrafts(csvFile(BASE_ROW)); assert.equal(calls,0); } finally { globalThis.fetch=original; } });
test("27 optional fields can be re-exported", async () => { const p=await preview({...BASE_ROW,additional_notes:"Manual compliance context."}); const output=exportDraftToCsv(p.rows[0].submissionPayloadEn,{internalClientId:"client-001"}); assert.match(output,/Manual compliance context\./); assert.match(output,/additional_notes/); });
test("28 templates are American English", async () => { const csvTemplate=createCsvImportTemplate(); const xlsx=await createXlsxImportTemplate(); assert.doesNotMatch(csvTemplate,/[^\x00-\x7F]/); const workbook=new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(xlsx) as unknown as ExcelJS.Buffer); for(const sheet of workbook.worksheets) sheet.eachRow(row=>row.eachCell(cell=>assert.doesNotMatch(String(cell.value),/[\u3400-\u9FFF\uFF01-\uFF60]/u))); });
test("29 CSV supports commas, quotes, and cell newlines", async () => { const p=await preview({...BASE_ROW,additional_notes:'Line one, "quoted"\nLine two'}); assert.equal(p.rows[0].submissionPayloadEn.additionalInformation,'Line one, "quoted"\nLine two'); });
test("30 invalid XLSX content is rejected", async () => { const p=await engine().preview({format:"xlsx",mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",data:new TextEncoder().encode("not xlsx")}); assert.equal(p.fileIssues[0].code,"FILE_CONTENT"); });
test("31 multiple worksheets require explicit rule", async () => { const wb=new ExcelJS.Workbook(); wb.addWorksheet("One").addRow(Object.keys(BASE_ROW)); wb.addWorksheet("Two").addRow(Object.keys(BASE_ROW)); const p=await engine().preview({format:"xlsx",data:new Uint8Array(await wb.xlsx.writeBuffer())}); assert.match(p.fileIssues[0].message,/multiple worksheets/i); });
test("32 merged cells are rejected", async () => { const wb=new ExcelJS.Workbook(); const s=wb.addWorksheet("Import"); s.addRow(Object.keys(BASE_ROW)); s.addRow(Object.values(BASE_ROW)); s.mergeCells("A2:B2"); const p=await engine().preview({format:"xlsx",data:new Uint8Array(await wb.xlsx.writeBuffer())}); assert.match(p.fileIssues[0].message,/merged cells/i); });
test("33 customer/resource field classifications are disjoint", () => { const input=new Set(TFV_CUSTOMER_INPUT_FIELDS.map(f=>f.fieldName)); assert.equal(TFV_RESOURCE_FIELDS.some(f=>input.has(f.fieldName)),false); assert.equal(TFV_CUSTOMER_INPUT_FIELDS.length+TFV_RESOURCE_FIELDS.length,54); });

test("34 TBA placeholder is blocked", async () => { const p=await preview({...BASE_ROW,additional_notes:"TBA"}); assert.ok(p.rows[0].errors.some(e=>e.code==="PLACEHOLDER_CONTENT")); });
test("35 N/A is blocked for a required answer", async () => { const p=await preview({...BASE_ROW,message_use_case:"N/A"}); assert.ok(p.rows[0].errors.some(e=>e.code==="PLACEHOLDER_CONTENT")); });
test("36 invalid MIME is rejected", async () => { const p=await engine().preview({format:"csv",mimeType:"application/json",data:csv(BASE_ROW)}); assert.equal(p.fileIssues[0].code,"FILE_TYPE"); });
test("37 empty XLSX worksheet is rejected", async () => { const wb=new ExcelJS.Workbook(); wb.addWorksheet("Import"); const p=await engine().preview({format:"xlsx",data:new Uint8Array(await wb.xlsx.writeBuffer())}); assert.equal(p.fileIssues[0].code,"FILE_STRUCTURE"); });
test("38 XLSX without a header is rejected", async () => { const wb=new ExcelJS.Workbook(); const s=wb.addWorksheet("Import"); s.getRow(2).values=Object.values(BASE_ROW); const p=await engine().preview({format:"xlsx",data:new Uint8Array(await wb.xlsx.writeBuffer())}); assert.equal(p.fileIssues[0].code,"FILE_STRUCTURE"); });
test("39 duplicate XLSX headers are rejected", async () => { const wb=new ExcelJS.Workbook(); const s=wb.addWorksheet("Import"); s.addRow(["internal_client_id","internal_client_id"]); s.addRow(["a","b"]); const p=await engine().preview({format:"xlsx",data:new Uint8Array(await wb.xlsx.writeBuffer())}); assert.match(p.fileIssues[0].message,/Duplicate header/); });
test("40 duplicate internal client IDs are reported without overwrite", async () => { const duplicate={...BASE_ROW}; const p=await engine().preview(csvRows([BASE_ROW,duplicate])); assert.equal(p.rows[0].status,"imported_with_warnings"); assert.equal(p.rows[1].status,"imported_with_warnings"); assert.ok(p.rows.every(row=>row.warnings.some(w=>w.code==="DUPLICATE_CLIENT"))); });
test("41 business_name maps to canonical BusinessName", async () => { const row: Record<string,string>={...BASE_ROW,business_name:BASE_ROW.legal_business_name}; delete row.legal_business_name; const p=await preview(row); assert.equal(p.rows[0].submissionPayloadEn.businessName,"Example Communications LLC"); });
test("42 CREATE_NEW never silently links an existing internal client", async () => { const r=await engine(fakeRepositories({existingClientIds:new Set(["client-001"])})).saveDrafts(csvFile(BASE_ROW)); assert.equal(r.rows[0].status,"rejected"); });
test("43 LINK_EXISTING uses the explicit UUID and does not create a client", async () => { const repos=fakeRepositories({existingClientIds:new Set(["client-001"])}); const existingClientId="11111111-1111-4111-8111-111111111111"; const r=await engine(repos).saveDrafts(csvFile(BASE_ROW),{defaultResolution:{mode:"LINK_EXISTING",existingClientId}}); assert.equal(r.rows[0].clientId,existingClientId); assert.equal(repos.savedDrafts[0].resolution.mode,"LINK_EXISTING"); });
test("44 LINK_EXISTING rejects an invalid UUID before persistence", async () => { const repos=fakeRepositories({existingClientIds:new Set(["client-001"])}); const r=await engine(repos).saveDrafts(csvFile(BASE_ROW),{defaultResolution:{mode:"LINK_EXISTING",existingClientId:"invalid"}}); assert.equal(r.rows[0].status,"rejected"); assert.equal(repos.savedDrafts.length,0); });
test("45 CREATE_NEW works without internal_client_id", async () => { const row:Record<string,string>={...BASE_ROW}; delete row.internal_client_id; const repos=fakeRepositories(); const r=await engine(repos).saveDrafts(csvFile(row)); assert.equal(r.rows[0].status,"imported"); assert.equal(repos.savedDrafts.length,1); assert.equal(repos.savedDrafts[0].internalClientId,null); });
test("46 LINK_EXISTING requires internal_client_id", async () => { const row:Record<string,string>={...BASE_ROW}; delete row.internal_client_id; const repos=fakeRepositories(); const r=await engine(repos).saveDrafts(csvFile(row),{defaultResolution:{mode:"LINK_EXISTING",existingClientId:"11111111-1111-4111-8111-111111111111"}}); assert.equal(r.rows[0].status,"rejected"); assert.equal(repos.savedDrafts.length,0); });
async function assertLanguageBlocked(column:string,value:string){const p=await preview({...BASE_ROW,[column]:value});assert.equal(p.rows[0].languageValidation.status,"NEEDS_ENGLISH_TRANSLATION");}
async function preview(row:Record<string,string>){return engine().preview(csvFile(row));}
async function xlsxPreview(row:Record<string,string>){const wb=new ExcelJS.Workbook();const s=wb.addWorksheet("Import");s.addRow(Object.keys(row));s.addRow(Object.values(row));return engine().preview({format:"xlsx",mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",fileName:"clients.xlsx",data:new Uint8Array(await wb.xlsx.writeBuffer())});}
function csvFile(row:Record<string,string>){return {format:"csv" as const,mimeType:"text/csv",fileName:"clients.csv",data:csv(row)};}
function csv(row:Record<string,string>){return csvRows([row]).data;}
function csvRows(rows:Record<string,string>[]){const headers=Object.keys(rows[0]);return {format:"csv" as const,mimeType:"text/csv",fileName:"clients.csv",data:`${headers.map(csvCell).join(",")}\n${rows.map(row=>headers.map(h=>csvCell(row[h]??"")).join(",")).join("\n")}\n`};}
function csvCell(value:string){return `"${value.replaceAll('"','""')}"`;}
function engine(repositories=fakeRepositories()){return new ImportEngine(repositories);}
function fakeRepositories(options:{failClientIds?:Set<string>;failDraft?:boolean;existingClientIds?:Set<string>}={}){
  const savedDrafts:AtomicImportDraftCreate[]=[];
  const existingIds=new Set(options.existingClientIds??[]);
  const repositories:ImportEngineRepositories={importDrafts:{async saveAtomic(input){
    if(options.failDraft || (input.internalClientId && options.failClientIds?.has(input.internalClientId))) throw new Error("atomic failure");
    if(input.resolution.mode==="CREATE_NEW" && existingIds.has(input.internalClientId??"")) throw new Error("duplicate client");
    if(input.resolution.mode==="LINK_EXISTING" && !existingIds.has(input.internalClientId??"")) throw new Error("missing client");
    savedDrafts.push(input);
    return {clientId:input.resolution.mode==="LINK_EXISTING"?input.resolution.existingClientId:`00000000-0000-4000-8000-${String((input.internalClientId??"").length).padStart(12,"0")}`,draftId:`00000000-0000-4000-8000-${String(savedDrafts.length).padStart(12,"0")}`,status:input.status,clientCreated:input.resolution.mode==="CREATE_NEW"};
  }}};
  return Object.assign(repositories,{savedDrafts});
}
