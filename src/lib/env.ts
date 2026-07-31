import { z } from 'zod';

const supabasePublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const envSchema = supabasePublicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  CREDENTIAL_ENCRYPTION_KEY: z.string().length(64, { message: "Must be 64 characters long" }),
  DRY_RUN: z.preprocess((val) => String(val).toLowerCase() === 'true', z.boolean()).default(true),
  NEXT_PUBLIC_APP_NAME: z.string().default('Twilio Toll-Free Number Operations Console'),
});

type Environment = z.infer<typeof envSchema>;
type SupabasePublicEnvironment = z.infer<typeof supabasePublicEnvSchema>;

let cachedSupabasePublicEnvironment: SupabasePublicEnvironment | undefined;
let cachedEnvironment: Environment | undefined;

export function tryGetSupabasePublicEnv():
  | { success: true; data: SupabasePublicEnvironment }
  | { success: false; missingOrInvalidVariables: string[] } {
  const result = supabasePublicEnvSchema.safeParse(process.env);
  if (!result.success) {
    return {
      success: false,
      missingOrInvalidVariables: [...new Set(result.error.issues.map((issue) => String(issue.path[0])))],
    };
  }

  cachedSupabasePublicEnvironment = result.data;
  return { success: true, data: result.data };
}

export function getSupabasePublicEnv(): SupabasePublicEnvironment {
  if (cachedSupabasePublicEnvironment) return cachedSupabasePublicEnvironment;

  const result = tryGetSupabasePublicEnv();
  if (!result.success) {
    throw new Error(`Missing or invalid server configuration: ${result.missingOrInvalidVariables.join(', ')}`);
  }
  return result.data;
}

export function getEnv(): Environment {
  cachedEnvironment ??= envSchema.parse(process.env);
  return cachedEnvironment;
}

/**
 * Retains the existing `env.PROPERTY` API while deferring validation until a
 * request actually reads a value. Route modules can therefore be loaded by the
 * Next.js build without requiring runtime-only secrets.
 */
export const env = new Proxy({} as Environment, {
  get(_target, property: keyof Environment) {
    return getEnv()[property];
  },
});




