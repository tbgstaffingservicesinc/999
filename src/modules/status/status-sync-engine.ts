import type {
  StatusSyncDependencies,
  StatusSyncItemResult,
  TfvSyncCandidate,
} from "@/modules/tfv/types";

export class StatusSyncEngine {
  constructor(private readonly dependencies: StatusSyncDependencies) {}

  async execute(input: {
    applicationId?: string;
    limit?: number;
    actorId?: string | null;
  } = {}): Promise<readonly StatusSyncItemResult[]> {
    const candidates = input.applicationId
      ? [await this.dependencies.repository.getStatusSyncCandidate(input.applicationId)].filter((value): value is TfvSyncCandidate => value !== null)
      : await this.dependencies.repository.listStatusSyncCandidates(Math.min(Math.max(input.limit ?? 100, 1), 500));
    const results: StatusSyncItemResult[] = [];
    await this.dependencies.audit.append({clientId:null,actorId:input.actorId??null,action:"status_sync_started",entityType:"tfv_application",entityId:null,safeDetails:{count:candidates.length}});
    for (const candidate of candidates) {
      try {
        const remote = await this.dependencies.twilio.fetchTfvStatus(
          candidate.verificationSid,
        );
        await this.dependencies.repository.updateRemoteStatus({
          applicationId: candidate.id,
          remote,
        });
        if (remote.status !== candidate.status) {
          await this.dependencies.audit.append({
            clientId: candidate.clientId,
            actorId: input.actorId ?? null,
            action: "status_sync_completed",
            entityType: "tfv_application",
            entityId: candidate.id,
            safeDetails: {
              previousStatus: candidate.status,
              currentStatus: remote.status,
              verificationSid: candidate.verificationSid,
            },
          });
        }
        results.push({
          applicationId: candidate.id,
          verificationSid: candidate.verificationSid,
          status: "synced",
          remoteStatus: remote.status,
        });
      } catch {
        await this.dependencies.audit.append({clientId:candidate.clientId,actorId:input.actorId??null,action:"status_sync_failed",entityType:"tfv_application",entityId:candidate.id,safeDetails:{verificationSid:candidate.verificationSid}});
        await this.dependencies.repository.markStatusRecoveryRequired(
          candidate.id,
          "Unable to determine the current remote TFV status.",
        );
        results.push({
          applicationId: candidate.id,
          verificationSid: candidate.verificationSid,
          status: "recovery_required",
          remoteStatus: null,
        });
      }
    }
    return results;
  }
}
