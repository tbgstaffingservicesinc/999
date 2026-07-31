import assert from "node:assert/strict";
import test from "node:test";
import type { AuditLogInput, AuditLogger } from "../src/audit/types";
import { AvailableNumberEngine } from "../src/modules/available-numbers";
import {
  PurchaseEngine,
  type PurchaseBatchRecord,
  type PurchaseItemRecord,
  type PurchaseRepository,
} from "../src/modules/purchase";
import { StatusSyncEngine } from "../src/modules/status";
import {
  buildTfvFormRequest,
  buildTfvSubmissionPayload,
  TfvSubmitEngine,
  type TfvRepository,
  type TfvSubmissionCandidate,
  type TfvSyncCandidate,
} from "../src/modules/tfv";
import {
  getTwilioClient,
  isTwilioExecutionEnabled,
  normalizeTwilioError,
  readTwilioCredentials,
  TwilioDryRunError,
  TwilioSdkService,
  TwilioServiceError,
  TwilioWritesDisabledError,
  type AvailableNumberQuery,
  type AvailableTollFreeNumber,
  type PurchasedTollFreeNumber,
  type TfvRemoteStatus,
  type TfvSubmissionPayload,
  type TwilioReadService,
  type TwilioWriteService,
} from "../src/services/twilio";
import type { Twilio } from "twilio";

const PN_SID = `PN${"1".repeat(32)}`;
const HH_SID = `HH${"2".repeat(32)}`;
const PURCHASE_OPERATION_ID = "11111111-1111-4111-8111-111111111111";

test("TWILIO_EXECUTION_ENABLED defaults to false",()=>{assert.equal(isTwilioExecutionEnabled({}),false);assert.equal(isTwilioExecutionEnabled({TWILIO_EXECUTION_ENABLED:"false"}),false);});

test("Twilio credentials use Account SID and API key environment names", () => {
  const credentials = readTwilioCredentials({
    TWILIO_ACCOUNT_SID: `AC${"a".repeat(32)}`,
    TWILIO_API_KEY_SID: `SK${"b".repeat(32)}`,
    TWILIO_API_KEY_SECRET: "secret-not-logged",
  });
  assert.match(credentials.accountSid, /^AC/);
  assert.match(credentials.apiKeySid, /^SK/);
});

test("Twilio credential factory rejects missing credentials", () => {
  assert.throws(() => readTwilioCredentials({}), /TWILIO_ACCOUNT_SID/);
});

test("Twilio client factory creates an SDK client without a network request", () => {
  const originalFetch = globalThis.fetch; let calls = 0;
  globalThis.fetch = (async () => { calls += 1; throw new Error("network forbidden"); }) as typeof fetch;
  try {
    const client = getTwilioClient({ credentials: { accountSid: `AC${"a".repeat(32)}`, apiKeySid: `SK${"b".repeat(32)}`, apiKeySecret: "test-only-secret" } });
    assert.ok(client); assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("Twilio errors use the unified safe shape", () => {
  const error = normalizeTwilioError(Object.assign(new Error("Rejected"), { status: 400, code: 20404, moreInfo: "https://www.twilio.com/docs/errors/20404" }), "availableNumbers.search");
  assert.deepEqual({ httpStatus: error.httpStatus, twilioErrorCode: error.twilioErrorCode, message: error.message, moreInfo: error.moreInfo, operation: error.operation }, { httpStatus: 400, twilioErrorCode: 20404, message: "Rejected", moreInfo: "https://www.twilio.com/docs/errors/20404", operation: "availableNumbers.search" });
});

test("Twilio dry run prevents SDK access and returns no fake resource", async () => {
  const client = new Proxy({}, { get() { throw new Error("SDK must not be touched"); } }) as Twilio;
  const service = new TwilioSdkService(client, { dryRun: true, writesEnabled: true });
  await assert.rejects(service.purchaseTollFreeNumber("+18005550100"), TwilioDryRunError);
});

test("Twilio SDK write methods are disabled by default", async () => {
  const service = new TwilioSdkService({} as Twilio);
  await assert.rejects(
    service.purchaseTollFreeNumber("+18005550100"),
    TwilioWritesDisabledError,
  );
});

test("Available Numbers validates and delegates a read-only query", async () => {
  const read = new FakeTwilio();
  const engine = new AvailableNumberEngine(read);
  const result = await engine.search({ areaCode: "800", limit: 1000 });
  assert.equal(read.availableQueries.length, 1);
  assert.equal(read.availableQueries[0].limit, 100);
  assert.equal(result[0].phoneNumber, "+18005550100");
});

test("Available Numbers rejects unsupported countries", async () => {
  await assert.rejects(
    new AvailableNumberEngine(new FakeTwilio()).search({
      countryCode: "CA",
    }),
    /Only US/,
  );
});

test("Available TFN service maps the official SDK response without purchase access", async () => {
  let purchaseEndpointAccessed = false;
  let receivedCountry: string | null = null;
  let receivedOptions: Record<string, unknown> | null = null;
  const sdk = {
    availablePhoneNumbers(country: string) {
      receivedCountry = country;
      return { tollFree: { list: async (options: Record<string, unknown>) => {
        receivedOptions = options;
        return [{ phoneNumber: "+18885550123", friendlyName: "(888) 555-0123", locality: "Austin", region: "TX", postalCode: "78701", capabilities: { voice: true, SMS: true, MMS: false } }];
      } } };
    },
    get incomingPhoneNumbers() { purchaseEndpointAccessed = true; throw new Error("Purchase endpoint must not be accessed"); },
  } as unknown as Twilio;
  const result = await new TwilioSdkService(sdk).searchAvailableTollFreeNumbers({ countryCode: "US", areaCode: "888", contains: "555", limit: 25 });
  assert.equal(receivedCountry, "US");
  assert.deepEqual(receivedOptions, { areaCode: 888, contains: "555", limit: 25 });
  assert.deepEqual(result[0], { phoneNumber: "+18885550123", friendlyName: "(888) 555-0123", locality: "Austin", region: "TX", postalCode: "78701", capabilities: { voice: true, SMS: true, MMS: false } });
  assert.equal(purchaseEndpointAccessed, false);
});

test("Available TFN SDK failures become TwilioServiceError", async () => {
  const sdk = { availablePhoneNumbers() { return { tollFree: { list: async () => { throw Object.assign(new Error("Lookup rejected"), { status: 429, code: 20429, moreInfo: "https://www.twilio.com/docs/errors/20429" }); } } }; } } as unknown as Twilio;
  await assert.rejects(new TwilioSdkService(sdk).searchAvailableTollFreeNumbers({ countryCode: "US", limit: 20 }), (error: unknown) => {
    assert.ok(error instanceof TwilioServiceError);
    assert.equal(error.operation, "availableNumbers.search"); assert.equal(error.httpStatus, 429); assert.equal(error.twilioErrorCode, 20429);
    return true;
  });
});

test("Purchase dry run validates a normal US toll-free selection", async () => {
  const repository=new FakePurchaseRepository(); const twilio=new FakeTwilio();
  const result=await new PurchaseEngine({repository,twilio,audit:new FakeAudit()}).execute(purchaseRequest({dryRun:true}));
  assert.equal(result.validationResult.valid,true); assert.equal(result.requiresConfirmation,true); assert.deepEqual(result.selectedNumbers,["+18005550100"]); assert.equal(result.estimatedActions[0].action,"PURCHASE_TOLL_FREE_NUMBER"); assert.equal(twilio.purchaseCalls.length,0); assert.equal(repository.writeCalls,0);
});

test("Purchase validation rejects duplicate selected numbers", async () => {
  const r=await purchasePreview({phoneNumbers:["+18005550100","+18005550100"]}); assert.ok(r.validationResult.errors.some(e=>e.code==="DUPLICATE_NUMBER"));
});

test("Purchase validation rejects an empty selection", async () => {
  const r=await purchasePreview({phoneNumbers:[]}); assert.ok(r.validationResult.errors.some(e=>e.code==="EMPTY_SELECTION"));
});

test("Purchase validation rejects non-US numbers", async () => {
  const r=await purchasePreview({phoneNumbers:["+448001112222"]}); assert.ok(r.validationResult.errors.some(e=>e.code==="NON_US"));
});

test("Purchase validation rejects non-toll-free US numbers", async () => {
  const r=await purchasePreview({phoneNumbers:["+15125550100"]}); assert.ok(r.validationResult.errors.some(e=>e.code==="NON_TOLL_FREE"));
});

test("Purchase duplicate operationId returns the existing result without writes", async () => {
  const repository=new FakePurchaseRepository(); repository.batches.push({id:"batch-existing",clientId:"client-1",idempotencyKey:PURCHASE_OPERATION_ID,status:"pending"});
  const twilio=new FakeTwilio(); const r=await new PurchaseEngine({repository,twilio,audit:new FakeAudit()}).execute(purchaseRequest({dryRun:false}));
  assert.equal(r.duplicateRequest,true); assert.equal(repository.writeCalls,0); assert.equal(twilio.purchaseCalls.length,0);
});

test("Confirmed Purchase Request remains disabled and never calls Twilio purchase", async () => {
  const repository=new FakePurchaseRepository(); const twilio=new FakeTwilio();
  const r=await new PurchaseEngine({repository,twilio,audit:new FakeAudit()}).execute(purchaseRequest({dryRun:false}));
  assert.equal(r.items[0].status,"pending"); assert.match(r.warnings[0],/confirmation/); assert.equal(repository.writeCalls,0); assert.equal(twilio.purchaseCalls.length,0);
});

test("Purchase validation rejects a missing client", async () => {
  const repository=new FakePurchaseRepository(); repository.clientPresent=false;
  const r=await new PurchaseEngine({repository,twilio:new FakeTwilio(),audit:new FakeAudit()}).execute(purchaseRequest({dryRun:true}));
  assert.ok(r.validationResult.errors.some(e=>e.code==="CLIENT_NOT_FOUND")); assert.equal(repository.writeCalls,0);
});

test("Purchase validation rejects a number already recorded as purchased", async () => {
  const repository=new FakePurchaseRepository(); repository.owned.set("+18005550100",{id:"phone-1",clientId:"client-1",phoneNumberSid:PN_SID});
  const r=await new PurchaseEngine({repository,twilio:new FakeTwilio(),audit:new FakeAudit()}).execute(purchaseRequest({dryRun:true}));
  assert.ok(r.validationResult.errors.some(e=>e.code==="ALREADY_PURCHASED")); assert.equal(repository.writeCalls,0);
});

test("Purchase preview generates a UUID operationId without Math.random", async () => {
  const original=Math.random; Math.random=()=>{throw new Error("Math.random forbidden")};
  try { const request={...purchaseRequest({dryRun:true}),purchaseOperationId:undefined}; const r=await new PurchaseEngine({repository:new FakePurchaseRepository(),twilio:new FakeTwilio(),audit:new FakeAudit()}).execute(request); assert.match(r.purchaseOperationId,/^[0-9a-f-]{36}$/i); }
  finally { Math.random=original; }
});

test("Production purchase succeeds per number only with both guards",async()=>{const repository=new FakePurchaseRepository();const twilio=new FakeTwilio();const r=await new PurchaseEngine({repository,twilio,audit:new FakeAudit(),executionEnabled:true}).execute({...purchaseRequest({dryRun:false,phoneNumbers:["+18005550100","+18885550101"]}),operatorConfirmed:true});assert.ok(r.items.every(i=>i.status==="purchased"&&i.phoneNumberSid===PN_SID&&i.databaseRecordId));assert.equal(repository.savedPhones.length,2);});
test("Production purchase supports partial failure",async()=>{const repository=new FakePurchaseRepository();const twilio=new FakeTwilio();twilio.purchaseFailures.add("+18885550101");const r=await new PurchaseEngine({repository,twilio,audit:new FakeAudit(),executionEnabled:true}).execute({...purchaseRequest({dryRun:false,phoneNumbers:["+18005550100","+18885550101"]}),operatorConfirmed:true});assert.equal(r.items[0].status,"purchased");assert.equal(r.items[1].status,"recovery_required");});
test("Purchase timeout is reconciliation_required and is not retried",async()=>{const repository=new FakePurchaseRepository();const twilio=new FakeTwilio();twilio.purchaseError=new Error("timeout");const r=await new PurchaseEngine({repository,twilio,audit:new FakeAudit(),executionEnabled:true}).execute({...purchaseRequest({dryRun:false}),operatorConfirmed:true});assert.equal(r.items[0].reconciliationRequired,true);assert.equal(twilio.purchaseCalls.length,1);});
test("Invalid PN SID never writes phone_numbers",async()=>{const repository=new FakePurchaseRepository();const twilio=new FakeTwilio();twilio.purchaseSid="INVALID";const r=await new PurchaseEngine({repository,twilio,audit:new FakeAudit(),executionEnabled:true}).execute({...purchaseRequest({dryRun:false}),operatorConfirmed:true});assert.equal(repository.savedPhones.length,0);assert.equal(r.items[0].status,"recovery_required");});

test("WITHOUT_PROFILE produces form-urlencoded canonical fields",()=>{const built=buildTfvFormRequest({submissionPayloadEn:validSubmission(),tollfreePhoneNumberSid:PN_SID,profile:{mode:"WITHOUT_PROFILE"}});assert.ok(built.body);assert.equal(built.body.get("BusinessName"),"Example Communications LLC");assert.equal(built.body.get("CustomerProfileSid"),null);});
test("EXISTING_PROFILE rejects Primary Profile and mixed business fields",()=>{const built=buildTfvFormRequest({submissionPayloadEn:{...validSubmission(),customerProfileSid:`BU${"4".repeat(32)}`},tollfreePhoneNumberSid:PN_SID,profile:{mode:"EXISTING_PROFILE",customerProfileSid:`BU${"4".repeat(32)}`,operatorConfirmedEligibleProfile:true,profileEligibility:"PRIMARY"}});assert.equal(built.payload,null);assert.match(built.errors.join(" "),/Primary/);});
test("TFV form repeats arrays and emits ProductionMessageSample once",()=>{const built=buildTfvFormRequest({submissionPayloadEn:validSubmission(),tollfreePhoneNumberSid:PN_SID,profile:{mode:"WITHOUT_PROFILE"}});assert.ok(built.body);assert.equal(built.body.getAll("UseCaseCategories").length,1);assert.equal(built.body.getAll("OptInKeywords").length,2);assert.equal(built.body.getAll("ProductionMessageSample").length,1);assert.match(built.body.toString(),/BusinessName=/);});

test("TFV payload omits empty optional fields", () => {
  const built = buildTfvSubmissionPayload({
    submissionPayloadEn: {
      ...validSubmission(),
      additionalInformation: "",
    },
    tollfreePhoneNumberSid: PN_SID,
  });
  assert.ok(built.payload);
  assert.equal("additionalInformation" in built.payload, false);
});

test("TFV payload rejects CJK content", () => {
  const built = buildTfvSubmissionPayload({
    submissionPayloadEn: {
      ...validSubmission(),
      useCaseSummary: "用于客户服务",
    },
    tollfreePhoneNumberSid: PN_SID,
  });
  assert.equal(built.payload, null);
  assert.match(built.errors.join(" "), /American English/);
});

test("TFV payload rejects resource and internal fields", () => {
  const built = buildTfvSubmissionPayload({
    submissionPayloadEn: {
      ...validSubmission(),
      status: "IN_REVIEW",
      internalClientId: "client-1",
    } as never,
    tollfreePhoneNumberSid: PN_SID,
  });
  assert.equal(built.payload, null);
  assert.match(built.errors.join(" "), /not a customer-input/);
});

test("TFV dryRun validates but never calls Twilio", async () => {
  const repository = new FakeTfvRepository();
  const twilio = new FakeTwilio();
  const result = await new TfvSubmitEngine({
    repository,
    twilio,
    audit: new FakeAudit(),
  }).execute({ applicationId: "tfv-1", actorId: null, dryRun: true });
  assert.equal(result.status, "dry_run");
  assert.equal(twilio.submitCalls.length, 0);
  assert.equal(repository.submitting.length, 0);
});

test("TFV does not resubmit an application with a verification SID", async () => {
  const repository = new FakeTfvRepository();
  repository.candidate = { ...repository.candidate, verificationSid: HH_SID };
  const twilio = new FakeTwilio();
  const result = await new TfvSubmitEngine({
    repository,
    twilio,
    audit: new FakeAudit(),
  }).execute({ applicationId: "tfv-1", actorId: null, dryRun: false });
  assert.equal(result.status, "duplicate");
  assert.equal(twilio.submitCalls.length, 0);
});

test("TFV successful submission saves immutable English snapshot", async () => {
  const repository = new FakeTfvRepository();
  const result = await new TfvSubmitEngine({
    repository,
    twilio: new FakeTwilio(),
    audit: new FakeAudit(),
    executionEnabled:true,
  }).execute({ applicationId: "tfv-1", actorId: null, dryRun: false,operatorConfirmed:true,operationId:"22222222-2222-4222-8222-222222222222" });
  assert.equal(result.status, "submitted");
  assert.equal(repository.submitted.length, 1);
  assert.equal(repository.submitted[0].snapshot.tollfreePhoneNumberSid, PN_SID);
});

test("Uncertain TFV submission becomes recovery_required", async () => {
  const repository = new FakeTfvRepository();
  const twilio = new FakeTwilio();
  twilio.submitError = new Error("timeout");
  const result = await new TfvSubmitEngine({
    repository,
    twilio,
    audit: new FakeAudit(),
    executionEnabled:true,
  }).execute({ applicationId: "tfv-1", actorId: null, dryRun: false,operatorConfirmed:true,operationId:"22222222-2222-4222-8222-222222222222" });
  assert.equal(result.status, "recovery_required");
  assert.equal(repository.submissionRecovery.length, 1);
});

test("TFV execution flag false blocks submission",async()=>{const repository=new FakeTfvRepository();const twilio=new FakeTwilio();const r=await new TfvSubmitEngine({repository,twilio,audit:new FakeAudit(),executionEnabled:false}).execute({applicationId:"tfv-1",actorId:null,dryRun:false,operatorConfirmed:true,operationId:"22222222-2222-4222-8222-222222222222"});assert.equal(r.status,"validation_failed");assert.equal(twilio.submitCalls.length,0);});
test("Invalid HH SID is never marked submitted",async()=>{const repository=new FakeTfvRepository();const twilio=new FakeTwilio();twilio.submittedSid="INVALID";const r=await new TfvSubmitEngine({repository,twilio,audit:new FakeAudit(),executionEnabled:true}).execute({applicationId:"tfv-1",actorId:null,dryRun:false,operatorConfirmed:true,operationId:"22222222-2222-4222-8222-222222222222"});assert.equal(r.status,"recovery_required");assert.equal(repository.submitted.length,0);});
test("Eligible EXISTING_PROFILE omits profile-managed business fields",()=>{const built=buildTfvFormRequest({submissionPayloadEn:validSubmission(),tollfreePhoneNumberSid:PN_SID,profile:{mode:"EXISTING_PROFILE",customerProfileSid:`BU${"4".repeat(32)}`,operatorConfirmedEligibleProfile:true,profileEligibility:"SECONDARY"}});assert.ok(built.body);assert.equal(built.body.get("CustomerProfileSid"),`BU${"4".repeat(32)}`);assert.equal(built.body.get("BusinessName"),null);});

test("Status Sync returns independent partial results", async () => {
  const repository = new FakeTfvRepository();
  repository.syncCandidates = [
    {
      id: "tfv-1",
      clientId: "client-1",
      verificationSid: HH_SID,
      status: "IN_REVIEW",
    },
    {
      id: "tfv-2",
      clientId: "client-2",
      verificationSid: `HH${"3".repeat(32)}`,
      status: "IN_REVIEW",
    },
  ];
  const twilio = new FakeTwilio();
  twilio.statusErrors.add(`HH${"3".repeat(32)}`);
  const results = await new StatusSyncEngine({
    repository,
    twilio,
    audit: new FakeAudit(),
  }).execute();
  assert.equal(results[0].status, "synced");
  assert.equal(results[1].status, "recovery_required");
});

test("Operation tests perform no fetch or external POST", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    throw new Error("External network forbidden");
  }) as typeof fetch;
  try {
    await new PurchaseEngine({
      repository: new FakePurchaseRepository(),
      twilio: new FakeTwilio(),
      audit: new FakeAudit(),
    }).execute(purchaseRequest({ dryRun: true }));
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

class FakeAudit implements AuditLogger {
  readonly events: AuditLogInput[] = [];
  async append(input: AuditLogInput): Promise<void> {
    this.events.push(input);
  }
}

class FakeTwilio implements TwilioReadService, TwilioWriteService {
  readonly availableQueries: AvailableNumberQuery[] = [];
  readonly purchaseCalls: string[] = [];
  readonly submitCalls: TfvSubmissionPayload[] = [];
  readonly statusErrors = new Set<string>();
  purchaseError: unknown = null;
  readonly purchaseFailures=new Set<string>();
  purchaseSid=PN_SID;
  submitError: unknown = null;
  submittedSid=HH_SID;

  async searchAvailableTollFreeNumbers(query: AvailableNumberQuery) {
    this.availableQueries.push(query);
    return [
      {
        phoneNumber: "+18005550100",
        friendlyName: "(800) 555-0100",
        locality: null,
        region: null,
        postalCode: null,
        capabilities: { voice: true, sms: true },
      },
    ] satisfies AvailableTollFreeNumber[];
  }

  async findIncomingPhoneNumber(phoneNumber:string):Promise<PurchasedTollFreeNumber|null>{return this.purchaseCalls.includes(phoneNumber)?{phoneNumberSid:PN_SID,phoneNumber,friendlyName:phoneNumber,capabilities:{voice:true,sms:true}}:null;}

  async purchaseTollFreeNumber(
    phoneNumber: string,
  ): Promise<PurchasedTollFreeNumber> {
    this.purchaseCalls.push(phoneNumber);
    if (this.purchaseError) throw this.purchaseError;
    if(this.purchaseFailures.has(phoneNumber))throw new Error("timeout");
    return {
      phoneNumberSid: this.purchaseSid,
      phoneNumber,
      friendlyName: phoneNumber,
      capabilities: { voice: true, sms: true },
    };
  }

  async submitTfv(payload: TfvSubmissionPayload) {
    this.submitCalls.push(payload);
    if (this.submitError) throw this.submitError;
    return { verificationSid: this.submittedSid, status: "PENDING_REVIEW" };
  }

  async fetchTfvStatus(verificationSid: string): Promise<TfvRemoteStatus> {
    if (this.statusErrors.has(verificationSid)) throw new Error("timeout");
    return {
      verificationSid,
      status: "TWILIO_APPROVED",
      rejectionReasons: [],
      errorCode: null,
      dateUpdated: "2026-07-31T00:00:00.000Z",
    };
  }
}

class FakePurchaseRepository implements PurchaseRepository {
  clientPresent = true;
  writeCalls = 0;
  async clientExists(){ return this.clientPresent; }
  readonly batches: PurchaseBatchRecord[] = [];
  readonly items: PurchaseItemRecord[] = [];
  readonly owned = new Map<
    string,
    { id: string; clientId: string; phoneNumberSid: string }
  >();
  readonly savedPhones: PurchasedTollFreeNumber[] = [];
  failSavePhone = false;

  async findBatchByIdempotencyKey(key: string) {
    return this.batches.find((batch) => batch.idempotencyKey === key) ?? null;
  }
  async createBatch(input: {
    clientId: string;
    requestedQuantity: number;
    idempotencyKey: string;
    actorId: string | null;
  }) {
    this.writeCalls += 1;
    const batch = {
      id: `batch-${this.batches.length + 1}`,
      clientId: input.clientId,
      idempotencyKey: input.idempotencyKey,
      status: "in_progress",
    };
    this.batches.push(batch);
    return batch;
  }
  async listItems(batchId: string) {
    return this.items.filter((item) => item.batchId === batchId);
  }
  async createItem(input: {
    batchId: string;
    clientId: string;
    requestedPhoneNumber: string;
  }) {
    this.writeCalls += 1;
    const item = purchaseItem(input.batchId, "pending", null);
    this.items.push(item);
    return item;
  }
  async findPhoneByNumber(phoneNumber: string) {
    return this.owned.get(phoneNumber) ?? null;
  }
  async markItem(input: {
    itemId: string;
    status: PurchaseItemRecord["status"];
    phoneNumberSid?: string | null;
    safeError?: string | null;
  }) {
    this.writeCalls += 1;
    const index = this.items.findIndex((item) => item.id === input.itemId);
    this.items[index] = {
      ...this.items[index],
      status: input.status,
      phoneNumberSid:
        input.phoneNumberSid === undefined
          ? this.items[index].phoneNumberSid
          : input.phoneNumberSid,
      safeError:
        input.safeError === undefined
          ? this.items[index].safeError
          : input.safeError,
    };
  }
  async savePurchasedPhone(input: PurchasedTollFreeNumber & { clientId: string; purchaseOperationId:string }) {
    this.writeCalls += 1;
    if (this.failSavePhone) throw new Error("database unavailable");
    this.savedPhones.push(input);
    return {id:`phone-${this.savedPhones.length}`};
  }
  async completeBatch(batchId: string, status: string) {
    this.writeCalls += 1;
    const index = this.batches.findIndex((batch) => batch.id === batchId);
    this.batches[index] = { ...this.batches[index], status };
  }
}

class FakeTfvRepository implements TfvRepository {
  async prepareBatch(){return ["tfv-1"];}
  candidate: TfvSubmissionCandidate = {
    id: "tfv-1",
    clientId: "client-1",
    idempotencyKey: "tfv-submit-1",
    status: "DRAFT",
    verificationSid: null,
    submissionPayloadEn: validSubmission(),
    tollfreePhoneNumberSid: PN_SID,
  };
  syncCandidates: TfvSyncCandidate[] = [];
  readonly submitting: string[] = [];
  readonly submitted: Array<{
    applicationId: string;
    verificationSid: string;
    status: string;
    snapshot: TfvSubmissionPayload;
  }> = [];
  readonly submissionRecovery: string[] = [];

  async getSubmissionCandidate(id: string) {
    return id === this.candidate.id ? this.candidate : null;
  }
  async markSubmitting(id: string) {
    this.submitting.push(id);
  }
  async markSubmitted(input: {
    applicationId: string;
    verificationSid: string;
    status: string;
    snapshot: TfvSubmissionPayload;
  }) {
    this.submitted.push(input);
  }
  async markSubmissionFailed(id:string){this.submissionRecovery.push(id);}
  async markSubmissionRecoveryRequired(id: string) {
    this.submissionRecovery.push(id);
  }
  async getStatusSyncCandidate(id:string){return this.syncCandidates.find(item=>item.id===id)??null;}
  async listStatusSyncCandidates() {
    return this.syncCandidates;
  }
  async updateRemoteStatus() {}
  async markStatusRecoveryRequired() {}
}

function purchaseRequest(overrides: Partial<{ dryRun:boolean; phoneNumbers:readonly string[]; clientId:string; countryCode:string }> = {}) {
  return { clientId:overrides.clientId??"client-1", actorId:null, purchaseOperationId:PURCHASE_OPERATION_ID, countryCode:overrides.countryCode??"US", phoneNumbers:overrides.phoneNumbers??["+18005550100"], dryRun:overrides.dryRun??false };
}
async function purchasePreview(overrides:Partial<{phoneNumbers:readonly string[];clientId:string;countryCode:string}>){return new PurchaseEngine({repository:new FakePurchaseRepository(),twilio:new FakeTwilio(),audit:new FakeAudit()}).execute(purchaseRequest({...overrides,dryRun:true}));}

function purchaseItem(
  batchId: string,
  status: PurchaseItemRecord["status"],
  phoneNumberSid: string | null,
): PurchaseItemRecord {
  return {
    id: `item-${batchId}`,
    batchId,
    clientId: "client-1",
    requestedPhoneNumber: "+18005550100",
    phoneNumberSid,
    status,
    safeError: null,
  };
}

function validSubmission() {
  return {
    businessName: "Example Communications LLC",
    businessStreetAddress: "100 Main Street",
    businessCity: "Austin",
    businessStateProvinceRegion: "TX",
    businessPostalCode: "78701",
    businessCountry: "US",
    businessWebsite: "https://example.com",
    businessContactFirstName: "Alex",
    businessContactLastName: "Morgan",
    businessContactEmail: "alex@example.com",
    businessContactPhone: "+15125550100",
    notificationEmail: "compliance@example.com",
    useCaseCategories: ["CUSTOMER_CARE"],
    useCaseSummary:
      "We send customer support updates after consumers request assistance.",
    productionMessageSample:
      "Example Communications: Your support request has been updated.",
    optInImageUrls: ["https://example.com/opt-in.png"],
    optInType: "WEB_FORM",
    messageVolume: "1,000",
    businessRegistrationNumber: "12-3456789",
    businessRegistrationAuthority: "EIN",
    businessRegistrationCountry: "US",
    businessType: "PRIVATE_PROFIT",
    businessRegistrationPhoneNumber: "+15125550101",
    optInConfirmationMessage:
      "Example Communications: You are subscribed. Reply STOP to opt out.",
    helpMessageSample:
      "Example Communications: Reply STOP to opt out or contact support@example.com.",
    privacyPolicyUrl: "https://example.com/privacy",
    termsAndConditionsUrl: "https://example.com/terms",
    ageGatedContent: false,
    optInKeywords: ["START", "YES"],
  } as const;
}
