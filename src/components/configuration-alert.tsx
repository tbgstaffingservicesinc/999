import { getMissingProductionEnvironmentVariables } from "@/lib/env";

export function ConfigurationAlert() {
  const missingVariables = getMissingProductionEnvironmentVariables();
  if (missingVariables.length === 0) return null;

  return (
    <div role="alert" className="border-b border-amber-300 bg-amber-50 px-6 py-4 text-sm text-amber-950">
      <p className="font-semibold">Application configuration is incomplete.</p>
      <p>Configure these Vercel Environment Variables and redeploy:</p>
      <ul className="mt-2 list-disc pl-5 font-mono">
        {missingVariables.map((name) => <li key={name}>{name}</li>)}
      </ul>
      <p className="mt-2">Database and Twilio operations remain unavailable until configuration is complete.</p>
    </div>
  );
}

export function SupabaseConfigurationRequired() {
  return (
    <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950">
      <h1 className="font-semibold">Supabase configuration required</h1>
      <p>Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel, then redeploy.</p>
    </div>
  );
}
