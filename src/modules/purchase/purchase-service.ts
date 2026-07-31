import { createPurchaseOperationId,PurchaseIdempotencyHandler } from "./idempotency-handler";
import { createPurchasePreview,purchaseItem } from "./purchase-result-model";
import { validatePurchaseSelection,type PurchaseValidationIssue } from "./purchase-validator";
import type { PurchaseEngineDependencies,PurchaseRequest,PurchaseResult,PurchaseResultItem } from "./types";
import { TwilioServiceError } from "@/services/twilio";
export class PurchaseService{
 constructor(private readonly d:PurchaseEngineDependencies){}
 async prepare(r:PurchaseRequest):Promise<PurchaseResult>{
  const op=r.purchaseOperationId??r.idempotencyKey??createPurchaseOperationId(); const base=validatePurchaseSelection({clientId:r.clientId,phoneNumbers:r.phoneNumbers,countryCode:r.countryCode,purchaseOperationId:op}); const errors:PurchaseValidationIssue[]=[...base.errors];
  if(r.clientId&&!(await this.d.repository.clientExists(r.clientId)))errors.push({code:"CLIENT_NOT_FOUND",field:"clientId",message:"The selected client does not exist."});
  for(const n of new Set(r.phoneNumbers))if(await this.d.repository.findPhoneByNumber(n))errors.push({code:"ALREADY_PURCHASED",field:"phoneNumbers",phoneNumber:n,message:`Phone number is already recorded as purchased: ${n}`});
  const existing=base.valid?await new PurchaseIdempotencyHandler(this.d.repository).findExisting(op):null; const validationResult={valid:errors.length===0,errors};
  if(existing)return{purchaseOperationId:op,batchId:existing.id,duplicateRequest:true,dryRun:r.dryRun,selectedNumbers:r.phoneNumbers,validationResult,estimatedActions:[],warnings:["This operationId already exists; purchase was not repeated."],requiresConfirmation:false,items:(await this.d.repository.listItems(existing.id)).map(i=>purchaseItem(i.requestedPhoneNumber,i.status,{phoneNumberSid:i.phoneNumberSid,safeError:i.safeError}))};
  await this.audit("purchase_prepared",r,op,{operationId:op,count:r.phoneNumbers.length,valid:validationResult.valid});
  const preview=createPurchasePreview({purchaseOperationId:op,selectedNumbers:r.phoneNumbers,validationResult,warnings:[]}); if(r.dryRun||!validationResult.valid)return preview;
  if(!r.operatorConfirmed)return{...preview,dryRun:false,requiresConfirmation:true,warnings:["Operator confirmation is required."],items:r.phoneNumbers.map(n=>purchaseItem(n,"pending"))};
  if(!this.d.executionEnabled)return{...preview,dryRun:false,requiresConfirmation:false,warnings:["TWILIO_EXECUTION_ENABLED is false; no purchase was attempted."],items:r.phoneNumbers.map(n=>purchaseItem(n,"pending"))};
  return this.execute(r,op,validationResult);
 }
 private async execute(r:PurchaseRequest,op:string,validationResult:PurchaseResult["validationResult"]):Promise<PurchaseResult>{
  const batch=await this.d.repository.createBatch({clientId:r.clientId,requestedQuantity:r.phoneNumbers.length,idempotencyKey:op,actorId:r.actorId}); await this.audit("purchase_started",r,batch.id,{operationId:op,count:r.phoneNumbers.length}); const items:PurchaseResultItem[]=[];
  for(const n of r.phoneNumbers){const record=await this.d.repository.createItem({batchId:batch.id,clientId:r.clientId,requestedPhoneNumber:n}); await this.d.repository.markItem({itemId:record.id,status:"purchasing"});
   try{const purchased=await this.d.twilio.purchaseTollFreeNumber(n); if(!/^PN[A-Za-z0-9]{32}$/.test(purchased.phoneNumberSid))throw new Error("Twilio returned no valid PN SID."); const saved=await this.d.repository.savePurchasedPhone({purchaseOperationId:op,clientId:r.clientId,...purchased}); await this.d.repository.markItem({itemId:record.id,status:"purchased",phoneNumberSid:purchased.phoneNumberSid}); items.push(purchaseItem(n,"purchased",{phoneNumberSid:purchased.phoneNumberSid,databaseRecordId:saved.id})); await this.audit("purchase_succeeded",r,record.id,{operationId:op,phoneNumber:n,phoneNumberSid:purchased.phoneNumberSid});}
   catch(error){const definitive=error instanceof TwilioServiceError&&error.httpStatus!==null&&error.httpStatus>=400&&error.httpStatus<500; if(!definitive){try{await this.d.twilio.findIncomingPhoneNumber(n);}catch{} const msg="Purchase outcome is uncertain; reconcile with the Twilio incoming-number list before retrying."; await this.d.repository.markItem({itemId:record.id,status:"recovery_required",safeError:msg}); items.push(purchaseItem(n,"recovery_required",{safeError:msg,errorCode:error instanceof TwilioServiceError?error.twilioErrorCode:null,errorMessage:msg,reconciliationRequired:true})); await this.audit("purchase_reconciliation_required",r,record.id,{operationId:op,phoneNumber:n});}
   else{const msg="Twilio rejected the purchase.";await this.d.repository.markItem({itemId:record.id,status:"failed",safeError:msg});items.push(purchaseItem(n,"failed",{safeError:msg,errorCode:error.twilioErrorCode,errorMessage:msg}));await this.audit("purchase_failed",r,record.id,{operationId:op,phoneNumber:n,errorCode:error.twilioErrorCode});}}
  }
  const status=items.every(i=>i.status==="purchased")?"completed":items.some(i=>i.status==="purchased")?"partially_completed":items.some(i=>i.reconciliationRequired)?"recovery_required":"failed";await this.d.repository.completeBatch(batch.id,status);return{purchaseOperationId:op,batchId:batch.id,duplicateRequest:false,dryRun:false,selectedNumbers:r.phoneNumbers,validationResult,estimatedActions:[],warnings:[],requiresConfirmation:false,items};
 }
 private async audit(action:string,r:PurchaseRequest,entityId:string,details:Record<string,unknown>){await this.d.audit.append({clientId:r.clientId,actorId:r.actorId,action,entityType:"purchase",entityId,safeDetails:details});}
}
