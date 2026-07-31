import twilio, { type Twilio } from "twilio";
import { TwilioServiceError } from "./errors";
import { readTwilioCredentials, type TwilioCredentials } from "./credentials-loader";

export interface TwilioClientFactoryOptions {
  readonly credentials?: TwilioCredentials;
  readonly environment?: Readonly<Record<string, string | undefined>>;
}

export function getTwilioClient(options: TwilioClientFactoryOptions = {}): Twilio {
  const credentials = options.credentials ?? readTwilioCredentials(options.environment ?? process.env);
  try {
    return twilio(credentials.apiKeySid, credentials.apiKeySecret, { accountSid: credentials.accountSid });
  } catch (error) {
    throw new TwilioServiceError({ httpStatus: null, twilioErrorCode: null, message: "Unable to initialize the Twilio SDK client.", moreInfo: null, operation: "createClient" }, { cause: error });
  }
}
