import { z } from 'zod';

export const connectionStatusSchema = z.enum(['unverified', 'verified', 'error']);

export const twilioConnectionSchema = z.object({
  id: z.uuid(),
  clientId: z.uuid(),
  accountSidMasked: z.string().nullable(),
  accountSidEncrypted: z.string().nullable(),
  apiKeySidMasked: z.string().nullable(),
  apiKeySidEncrypted: z.string().nullable(),
  apiKeySecretEncrypted: z.string().nullable(),
  connectionStatus: connectionStatusSchema,
  lastCheckedAt: z.iso.datetime().nullable(),
  lastErrorSafe: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;
export type TwilioConnection = z.infer<typeof twilioConnectionSchema>;
