import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigurationErrorResponse } from "@/lib/http-configuration";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const configurationError = supabaseConfigurationErrorResponse();
  if (configurationError) return configurationError;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await params;
  return NextResponse.json(
    {
      error: "Twilio credentials are managed by server environment variables. Browser-supplied credentials are disabled.",
    },
    { status: 409 },
  );
}


