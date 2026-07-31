export type TwilioOperation =
  | "createClient"
  | "availableNumbers.search"
  | "phoneNumbers.purchase"
  | "phoneNumbers.reconcile"
  | "tfv.submit"
  | "tfv.statusSync";

export interface TwilioErrorShape {
  readonly httpStatus: number | null;
  readonly twilioErrorCode: number | null;
  readonly message: string;
  readonly moreInfo: string | null;
  readonly operation: TwilioOperation;
}

export class TwilioServiceError extends Error implements TwilioErrorShape {
  readonly httpStatus: number | null;
  readonly twilioErrorCode: number | null;
  readonly moreInfo: string | null;
  readonly operation: TwilioOperation;

  constructor(input: TwilioErrorShape, options?: ErrorOptions) {
    super(input.message, options);
    this.name = "TwilioServiceError";
    this.httpStatus = input.httpStatus;
    this.twilioErrorCode = input.twilioErrorCode;
    this.moreInfo = input.moreInfo;
    this.operation = input.operation;
  }
}

export class TwilioDryRunError extends TwilioServiceError {
  constructor(operation: TwilioOperation) {
    super({ httpStatus: null, twilioErrorCode: null, message: "Dry run prevented a Twilio network operation.", moreInfo: null, operation });
    this.name = "TwilioDryRunError";
  }
}

export function normalizeTwilioError(error: unknown, operation: TwilioOperation): TwilioServiceError {
  if (error instanceof TwilioServiceError) return error;
  const record = isRecord(error) ? error : {};
  const message = error instanceof Error && error.message.trim() ? error.message : "Twilio operation failed.";
  return new TwilioServiceError({
    httpStatus: numeric(record.status) ?? numeric(record.statusCode),
    twilioErrorCode: numeric(record.code),
    message,
    moreInfo: typeof record.moreInfo === "string" ? record.moreInfo : null,
    operation,
  }, error instanceof Error ? { cause: error } : undefined);
}

function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object"; }
function numeric(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null; }
