﻿import { NextResponse } from "next/server";
import { AvailableNumberEngine } from "@/modules/available-numbers";
import { createTwilioService, TwilioServiceError } from "@/services/twilio";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigurationErrorResponse } from "@/lib/http-configuration";
import { SupabaseAuditLogger, SupabaseAuditRepository } from "@/infrastructure/repositories/supabase";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const configurationError = supabaseConfigurationErrorResponse();
  if (configurationError) return configurationError;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const limitValue = url.searchParams.get("limit");
  try {
    const engine = new AvailableNumberEngine(createTwilioService());
    const numbers = await engine.search({
      countryCode: url.searchParams.get("countryCode") ?? "US",
      areaCode: url.searchParams.get("areaCode") ?? undefined,
      contains: url.searchParams.get("contains") ?? undefined,
      limit: limitValue === null ? 20 : Number(limitValue),
    });
    await new SupabaseAuditLogger(new SupabaseAuditRepository(supabase)).append({clientId:null,actorId:user.id,action:"number_search",entityType:"twilio_number_search",entityId:null,safeDetails:{count:numbers.length,areaCode:url.searchParams.get("areaCode")}});
    return NextResponse.json({
      available_phone_numbers: numbers.map((number) => ({
        phone_number: number.phoneNumber,
        friendly_name: number.friendlyName,
        locality: number.locality,
        region: number.region,
        postal_code: number.postalCode,
        capabilities: number.capabilities,
      })),
    });
  } catch (error) {
    const serviceError = error instanceof TwilioServiceError ? error : null;
    return NextResponse.json(
      { error: serviceError?.operation === "createClient" ? "Service configuration error." : "Unable to search available toll-free numbers." },
      { status: serviceError?.operation === "createClient" ? 500 : 502 },
    );
  }
}

