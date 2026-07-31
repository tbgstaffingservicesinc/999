export const MAX_PURCHASE_QUANTITY = 50;
const US_TOLL_FREE = /^\+1(?:800|833|844|855|866|877|888)\d{7}$/;
const E164 = /^\+[1-9]\d{7,14}$/;

export interface PurchaseValidationIssue { readonly code: "CLIENT_REQUIRED" | "EMPTY_SELECTION" | "QUANTITY_LIMIT" | "DUPLICATE_NUMBER" | "INVALID_FORMAT" | "NON_US" | "NON_TOLL_FREE" | "INVALID_OPERATION_ID" | "CLIENT_NOT_FOUND" | "ALREADY_PURCHASED"; readonly field: string; readonly message: string; readonly phoneNumber?: string; }
export interface PurchaseValidationResult { readonly valid: boolean; readonly errors: readonly PurchaseValidationIssue[]; }

export function validatePurchaseSelection(input: { clientId: string; phoneNumbers: readonly string[]; countryCode?: string; purchaseOperationId: string }): PurchaseValidationResult {
  const errors: PurchaseValidationIssue[]=[];
  if (!input.clientId.trim()) errors.push(issue("CLIENT_REQUIRED","clientId","clientId is required."));
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.purchaseOperationId)) errors.push(issue("INVALID_OPERATION_ID","purchaseOperationId","purchaseOperationId must be a UUID."));
  if (input.countryCode && input.countryCode !== "US") errors.push(issue("NON_US","countryCode","Only US toll-free numbers can be purchased."));
  if (input.phoneNumbers.length===0) errors.push(issue("EMPTY_SELECTION","phoneNumbers","At least one phone number is required."));
  if (input.phoneNumbers.length>MAX_PURCHASE_QUANTITY) errors.push(issue("QUANTITY_LIMIT","phoneNumbers",`A purchase operation is limited to ${MAX_PURCHASE_QUANTITY} numbers.`));
  const seen=new Set<string>();
  for(const phoneNumber of input.phoneNumbers){
    if(seen.has(phoneNumber)) errors.push({...issue("DUPLICATE_NUMBER","phoneNumbers",`Duplicate selected number: ${phoneNumber}`),phoneNumber});
    seen.add(phoneNumber);
    if(!E164.test(phoneNumber)){errors.push({...issue("INVALID_FORMAT","phoneNumbers",`Invalid E.164 phone number: ${phoneNumber}`),phoneNumber});continue;}
    if(!phoneNumber.startsWith("+1")){errors.push({...issue("NON_US","phoneNumbers",`Number is not a US number: ${phoneNumber}`),phoneNumber});continue;}
    if(!US_TOLL_FREE.test(phoneNumber)) errors.push({...issue("NON_TOLL_FREE","phoneNumbers",`Number is not a supported US toll-free number: ${phoneNumber}`),phoneNumber});
  }
  return {valid:errors.length===0,errors};
}
function issue(code:PurchaseValidationIssue["code"],field:string,message:string):PurchaseValidationIssue{return{code,field,message};}

export const validatePurchaseRequest = validatePurchaseSelection;
