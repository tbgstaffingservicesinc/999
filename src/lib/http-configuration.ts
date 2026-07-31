import { NextResponse } from "next/server";
import { tryGetSupabasePublicEnv } from "@/lib/env";

export function supabaseConfigurationErrorResponse(): NextResponse | null {
  const configuration = tryGetSupabasePublicEnv();
  if (configuration.success) return null;

  return NextResponse.json(
    {
      error: "Supabase is not configured for this deployment.",
      missingOrInvalidVariables: configuration.missingOrInvalidVariables,
    },
    { status: 503 },
  );
}
