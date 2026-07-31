import { createClient } from "@/lib/supabase/server";

export async function getTwilioConnection(clientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("twilio_connections")
    .select("account_sid_masked, connection_status, last_checked_at")
    .eq("client_id", clientId)
    .single();

  if (error) {
    // It's normal for a connection not to exist, so we don't log the error
    // unless it's something other than "PGRST116" (resource not found).
    if (error.code !== 'PGRST116') {
      console.error("Error fetching Twilio connection:", error);
    }
    return null;
  }

  return data;
}
