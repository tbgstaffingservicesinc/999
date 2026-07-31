import { TwilioServiceError } from "./errors";
import type { TfvFieldName } from "@/domain/schema/tfv-schema";
import type { ImportValue } from "@/modules/import";

export interface AvailableNumberQuery {
  readonly countryCode: "US";
  readonly areaCode?: string;
  readonly contains?: string;
  readonly limit: number;
}

export interface AvailableTollFreeNumber {
  readonly phoneNumber: string;
  readonly friendlyName: string;
  readonly locality: string | null;
  readonly region: string | null;
  readonly postalCode: string | null;
  readonly capabilities: Readonly<Record<string, boolean>>;
}

export interface PurchasedTollFreeNumber {
  readonly phoneNumberSid: string;
  readonly phoneNumber: string;
  readonly friendlyName: string;
  readonly capabilities: Readonly<Record<string, boolean>>;
}

export type TfvSubmissionPayload = Readonly<
  Partial<Record<TfvFieldName, ImportValue>> & {
    tollfreePhoneNumberSid: string;
  }
>;

export interface SubmittedTfv {
  readonly verificationSid: string;
  readonly status: string;
}

export interface TfvRemoteStatus {
  readonly verificationSid: string;
  readonly status: string;
  readonly rejectionReasons: readonly unknown[];
  readonly errorCode: number | null;
  readonly dateUpdated: string;
}

export interface TwilioReadService {
  searchAvailableTollFreeNumbers(
    query: AvailableNumberQuery,
  ): Promise<readonly AvailableTollFreeNumber[]>;
  fetchTfvStatus(verificationSid: string): Promise<TfvRemoteStatus>;
  findIncomingPhoneNumber(phoneNumber: string): Promise<PurchasedTollFreeNumber | null>;
}

export interface TwilioWriteService {
  purchaseTollFreeNumber(phoneNumber: string): Promise<PurchasedTollFreeNumber>;
  submitTfv(payload: TfvSubmissionPayload): Promise<SubmittedTfv>;
}

export interface TwilioService extends TwilioReadService, TwilioWriteService {}

export class TwilioWritesDisabledError extends TwilioServiceError {
  readonly code = "TWILIO_WRITES_DISABLED";
  constructor(operation: "phoneNumbers.purchase" | "tfv.submit" = "phoneNumbers.purchase") {
    super({ httpStatus: null, twilioErrorCode: null, message: "Twilio write operations are disabled.", moreInfo: null, operation });
    this.name = "TwilioWritesDisabledError";
  }
}
