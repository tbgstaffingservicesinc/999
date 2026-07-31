import type { Twilio } from "twilio";
import {
  TFV_CUSTOMER_INPUT_FIELDS,
} from "@/modules/import/field-mapping";
import type {
  AvailableNumberQuery,
  AvailableTollFreeNumber,
  PurchasedTollFreeNumber,
  SubmittedTfv,
  TfvRemoteStatus,
  TfvSubmissionPayload,
  TwilioService,
} from "./types";
import { TwilioWritesDisabledError } from "./types";
import { TwilioDryRunError, type TwilioOperation } from "./errors";
import { normalizeTwilioError } from "./error-handler";

export interface TwilioSdkServiceOptions {
  readonly writesEnabled?: boolean;
  readonly dryRun?: boolean;
}

export class TwilioSdkService implements TwilioService {
  private readonly writesEnabled: boolean;
  private readonly dryRun: boolean;

  constructor(
    private readonly client: Twilio,
    options: TwilioSdkServiceOptions = {},
  ) {
    this.writesEnabled = options.writesEnabled === true;
    this.dryRun = options.dryRun === true;
  }

  async searchAvailableTollFreeNumbers(
    query: AvailableNumberQuery,
  ): Promise<readonly AvailableTollFreeNumber[]> {
    const numbers = await this.execute("availableNumbers.search", () => this.client
      .availablePhoneNumbers(query.countryCode)
      .tollFree.list({
        areaCode: query.areaCode ? Number(query.areaCode) : undefined,
        contains: query.contains,
        limit: Math.min(Math.max(query.limit, 1), 100),
      }));
    return numbers.map((number) => ({
      phoneNumber: number.phoneNumber,
      friendlyName: number.friendlyName,
      locality: number.locality,
      region: number.region,
      postalCode: number.postalCode,
      capabilities: normalizeCapabilities(number.capabilities),
    }));
  }

  async findIncomingPhoneNumber(phoneNumber: string): Promise<PurchasedTollFreeNumber | null> {
    const numbers = await this.execute("phoneNumbers.reconcile", () => this.client.incomingPhoneNumbers.list({ phoneNumber, limit: 1 }));
    const found = numbers[0];
    return found ? { phoneNumberSid: found.sid, phoneNumber: found.phoneNumber, friendlyName: found.friendlyName, capabilities: normalizeCapabilities(found.capabilities) } : null;
  }

  async purchaseTollFreeNumber(
    phoneNumber: string,
  ): Promise<PurchasedTollFreeNumber> {
    this.assertWritesEnabled("phoneNumbers.purchase");
    const purchased = await this.execute("phoneNumbers.purchase", () => this.client.incomingPhoneNumbers.create({ phoneNumber }));
    return {
      phoneNumberSid: purchased.sid,
      phoneNumber: purchased.phoneNumber,
      friendlyName: purchased.friendlyName,
      capabilities: normalizeCapabilities(purchased.capabilities),
    };
  }

  async submitTfv(payload: TfvSubmissionPayload): Promise<SubmittedTfv> {
    this.assertWritesEnabled("tfv.submit");
    const params = Object.fromEntries(
      TFV_CUSTOMER_INPUT_FIELDS.flatMap((definition) => {
        const value = payload[definition.fieldName];
        return value === undefined || value === null || value === ""
          ? []
          : [[definition.apiName, value]];
      }),
    );
    const submitted = await this.execute("tfv.submit", () => this.client.messaging.v1.tollfreeVerifications.create({
      ...params,
      tollfreePhoneNumberSid: payload.tollfreePhoneNumberSid,
    } as never));
    return { verificationSid: submitted.sid, status: submitted.status };
  }

  async fetchTfvStatus(verificationSid: string): Promise<TfvRemoteStatus> {
    const remote = await this.execute("tfv.statusSync", () => this.client.messaging.v1
      .tollfreeVerifications(verificationSid)
      .fetch());
    return {
      verificationSid: remote.sid,
      status: remote.status,
      rejectionReasons: remote.rejectionReasons,
      errorCode: remote.errorCode ?? null,
      dateUpdated: remote.dateUpdated.toISOString(),
    };
  }

  private assertWritesEnabled(operation: "phoneNumbers.purchase" | "tfv.submit"): void {
    if (!this.writesEnabled) throw new TwilioWritesDisabledError(operation);
  }

  private async execute<T>(operation: TwilioOperation, callback: () => Promise<T>): Promise<T> {
    if (this.dryRun) throw new TwilioDryRunError(operation);
    try { return await callback(); }
    catch (error) { throw normalizeTwilioError(error, operation); }
  }
}

function normalizeCapabilities(
  value: unknown,
): Readonly<Record<string, boolean>> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
    ),
  );
}

