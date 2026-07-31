import type { Twilio } from "twilio";
import { getTwilioClient, type TwilioClientFactoryOptions } from "./client-factory";
import { TwilioSdkService, type TwilioSdkServiceOptions } from "./twilio-service";
import type { TwilioService } from "./types";

export interface TwilioServiceFactoryOptions extends TwilioClientFactoryOptions, TwilioSdkServiceOptions {
  readonly client?: Twilio;
}

export function createTwilioService(options: TwilioServiceFactoryOptions = {}): TwilioService {
  const client = options.client ?? getTwilioClient({ credentials: options.credentials, environment: options.environment });
  return new TwilioSdkService(client, { writesEnabled: options.writesEnabled, dryRun: options.dryRun });
}
