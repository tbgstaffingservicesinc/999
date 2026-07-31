import { createClient } from "@/lib/supabase/server";

export async function getClientById(clientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (error) {
    console.error("Error fetching client:", error);
    return null;
  }

  return data;
}
