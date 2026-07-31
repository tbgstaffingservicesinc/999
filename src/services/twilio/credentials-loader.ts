import { TwilioServiceError } from "./errors";

export interface TwilioCredentials {
  readonly accountSid: string;
  readonly apiKeySid: string;
  readonly apiKeySecret: string;
}

export function readTwilioCredentials(environment: Readonly<Record<string, string | undefined>> = process.env): TwilioCredentials {
  const accountSid = environment.TWILIO_ACCOUNT_SID;
  const apiKeySid = environment.TWILIO_API_KEY_SID;
  const apiKeySecret = environment.TWILIO_API_KEY_SECRET;
  if (!accountSid || !apiKeySid || !apiKeySecret) throw configurationError("TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, and TWILIO_API_KEY_SECRET are required.");
  if (!/^AC[A-Za-z0-9]{32}$/.test(accountSid)) throw configurationError("TWILIO_ACCOUNT_SID has an invalid format.");
  if (!/^SK[A-Za-z0-9]{32}$/.test(apiKeySid)) throw configurationError("TWILIO_API_KEY_SID has an invalid format.");
  return { accountSid, apiKeySid, apiKeySecret };
}

function configurationError(message: string): TwilioServiceError {
  return new TwilioServiceError({ httpStatus: null, twilioErrorCode: null, message, moreInfo: null, operation: "createClient" });
}
