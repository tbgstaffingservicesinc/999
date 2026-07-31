import { AvailableNumberEngine } from "@/modules/available-numbers";
import { PurchaseEngine } from "@/modules/purchase";
import { StatusSyncEngine } from "@/modules/status";
import { TfvSubmitEngine } from "@/modules/tfv";
import {
  SupabaseAuditLogger,
  SupabaseAuditRepository,
  SupabasePurchaseRepository,
  SupabaseTfvRepository,
} from "@/infrastructure/repositories/supabase";
import { createClient } from "@/lib/supabase/server";
import {
  createTwilioService,
  isTwilioExecutionEnabled,
} from "@/services/twilio";

export async function createOperationServices(options: {
  readonly twilioWritesEnabled?: boolean;
} = {}) {
  const supabase = await createClient();
  const audit = new SupabaseAuditLogger(new SupabaseAuditRepository(supabase));
  const executionEnabled = options.twilioWritesEnabled === true && isTwilioExecutionEnabled();
  const twilio = createTwilioService({ writesEnabled: executionEnabled });
  const tfvRepository = new SupabaseTfvRepository(supabase);

  return {
    availableNumbers: new AvailableNumberEngine(twilio),
    purchase: new PurchaseEngine({
      repository: new SupabasePurchaseRepository(supabase),
      twilio,
      audit,
      executionEnabled,
    }),
    tfvSubmit: new TfvSubmitEngine({
      repository: tfvRepository,
      twilio,
      audit,
      executionEnabled,
    }),
    statusSync: new StatusSyncEngine({
      repository: tfvRepository,
      twilio,
      audit,
    }),
  };
}
