import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  CREDENTIAL_ENCRYPTION_KEY: z.string().length(64, { message: "Must be 64 characters long" }),
  DRY_RUN: z.preprocess((val) => String(val).toLowerCase() === 'true', z.boolean()).default(true),
  NEXT_PUBLIC_APP_NAME: z.string().default('Twilio Toll-Free Number Operations Console'),
});

export const env = envSchema.parse(process.env);
