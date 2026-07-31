import { createHash } from "node:crypto";
import type { TfvCanonicalField, TfvFieldName } from "@/domain/schema/tfv-schema";
import {
  TFV_CUSTOMER_INPUT_FIELDS,
} from "@/modules/import/field-mapping";
import type { ImportValue } from "@/modules/import";
import type { TfvSubmissionPayload } from "@/services/twilio";

const CUSTOMER_FIELDS: ReadonlySet<string> = new Set(
  TFV_CUSTOMER_INPUT_FIELDS.map((field) => field.fieldName),
);
const CJK_OR_FULL_WIDTH =
  /[\u2E80-\u2FFF\u3000-\u303F\u31C0-\u31EF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF01-\uFF60\uFFE0-\uFFE6]/u;
const NON_ASCII_LETTER = /\p{L}/u;
const PLACEHOLDER =
  /^(?:test|testing|example|sample|placeholder|tba|tbd|n\/?a|unknown|none|to be (?:added|confirmed|determined|provided))$/i;

export function buildTfvSubmissionPayload(input: {
  submissionPayloadEn: Readonly<
    Partial<Record<TfvFieldName, ImportValue>>
  >;
  tollfreePhoneNumberSid: string;
  ignoredRequiredFields?: ReadonlySet<TfvFieldName>;
}): { payload: TfvSubmissionPayload | null; errors: string[] } {
  const errors: string[] = [];
  if (!/^PN[A-Za-z0-9]{32}$/.test(input.tollfreePhoneNumberSid)) {
    errors.push("A valid purchased Toll-Free Phone Number SID is required.");
  }

  const output: Partial<Record<TfvFieldName, ImportValue>> = {};
  for (const [fieldName, value] of Object.entries(input.submissionPayloadEn)) {
    if (!CUSTOMER_FIELDS.has(fieldName)) {
      errors.push(`${fieldName} is not a customer-input TFV field.`);
      continue;
    }
    if (isEmpty(value)) continue;
    if (containsUnsafeText(value)) {
      errors.push(
        `${fieldName} must contain manually confirmed American English content.`,
      );
      continue;
    }
    output[fieldName as TfvFieldName] = value as ImportValue;
  }

  for (const definition of TFV_CUSTOMER_INPUT_FIELDS) {
    if (input.ignoredRequiredFields?.has(definition.fieldName)) continue;
    const requirement = activeRequirement(definition, output);
    if (requirement && isEmpty(output[definition.fieldName])) {
      errors.push(`${definition.label} is ${requirement}.`);
    }
  }

  if (errors.length > 0) return { payload: null, errors };
  return {
    payload: Object.freeze({
      ...output,
      tollfreePhoneNumberSid: input.tollfreePhoneNumberSid,
    }),
    errors: [],
  };
}

export type TfvProfileMode = "WITHOUT_PROFILE" | "EXISTING_PROFILE";
export interface TfvProfileSelection { readonly mode:TfvProfileMode; readonly customerProfileSid?:string; readonly operatorConfirmedEligibleProfile?:boolean; readonly profileEligibility?:"ISV_STARTER"|"SECONDARY"|"PRIMARY"|"UNKNOWN"; }
const PROFILE_MANAGED_FIELDS = new Set<TfvFieldName>(["businessName","businessStreetAddress","businessStreetAddress2","businessCity","businessStateProvinceRegion","businessPostalCode","businessCountry","businessContactFirstName","businessContactLastName","businessContactEmail","businessContactPhone","businessRegistrationNumber","businessRegistrationAuthority","businessRegistrationCountry","businessType","businessRegistrationPhoneNumber","doingBusinessAs"]);
export function buildTfvFormRequest(input:{submissionPayloadEn:Readonly<Partial<Record<TfvFieldName,ImportValue>>>;tollfreePhoneNumberSid:string;profile:TfvProfileSelection}):{payload:TfvSubmissionPayload|null;body:URLSearchParams|null;errors:string[]}{
 const source={...input.submissionPayloadEn}; const errors:string[]=[];
 if(input.profile.mode==="WITHOUT_PROFILE"){delete source.customerProfileSid;}
 else {if(!input.profile.operatorConfirmedEligibleProfile)errors.push("Operator confirmation of an eligible Customer Profile is required.");if(!["ISV_STARTER","SECONDARY"].includes(input.profile.profileEligibility??""))errors.push("Primary or unverified Customer Profiles cannot be used.");if(!/^BU[A-Za-z0-9]{32}$/.test(input.profile.customerProfileSid??""))errors.push("A valid eligible BU SID is required.");for(const field of PROFILE_MANAGED_FIELDS)delete source[field];source.customerProfileSid=input.profile.customerProfileSid??null;}
 const built=buildTfvSubmissionPayload({submissionPayloadEn:source,tollfreePhoneNumberSid:input.tollfreePhoneNumberSid,ignoredRequiredFields:input.profile.mode==="EXISTING_PROFILE"?PROFILE_MANAGED_FIELDS:undefined});errors.push(...built.errors);if(!built.payload||errors.length)return{payload:null,body:null,errors};
 const body=new URLSearchParams();for(const definition of TFV_CUSTOMER_INPUT_FIELDS){const value=built.payload[definition.fieldName];if(isEmpty(value))continue;const key=definition.apiName.charAt(0).toUpperCase()+definition.apiName.slice(1);if(Array.isArray(value)){for(const item of value)body.append(key,String(item));}else body.append(key,String(value));}body.set("TollfreePhoneNumberSid",input.tollfreePhoneNumberSid);return{payload:built.payload,body,errors:[]};
}

export function hashTfvPayload(payload: TfvSubmissionPayload): string {
  const sorted = Object.fromEntries(
    Object.entries(payload).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
  return createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}

function activeRequirement(
  definition: TfvCanonicalField,
  payload: Partial<Record<TfvFieldName, ImportValue>>,
): string | null {
  for (const rule of definition.validationRule.split("|")) {
    if (rule.startsWith("requiredUnless:")) {
      const [field, value] = rule.slice(15).split("=");
      if (String(payload[field as TfvFieldName] ?? "") !== value)
        return "conditionally required by Twilio";
    }
    if (rule.startsWith("requiredWith:")) {
      const field = rule.slice(13) as TfvFieldName;
      if (!isEmpty(payload[field])) return "conditionally required by Twilio";
    }
    if (rule.startsWith("requiredForUseCase:")) {
      const value = rule.slice(19);
      const categories = payload.useCaseCategories;
      if (Array.isArray(categories) && categories.includes(value))
        return "conditionally required by Twilio";
    }
  }
  if (definition.requiredByTwilio) return "required by Twilio";
  if (definition.requiredByBusiness) return "required by business policy";
  return null;
}

function containsUnsafeText(value: unknown): boolean {
  const values = Array.isArray(value) ? value : [value];
  return values.some((item) => {
    if (typeof item !== "string") return false;
    if (CJK_OR_FULL_WIDTH.test(item) || PLACEHOLDER.test(item.trim())) return true;
    for (const character of item) {
      if (
        character.codePointAt(0)! > 0x7f &&
        NON_ASCII_LETTER.test(character)
      )
        return true;
    }
    return false;
  });
}

function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}


export const buildTfvRequest = buildTfvFormRequest;
