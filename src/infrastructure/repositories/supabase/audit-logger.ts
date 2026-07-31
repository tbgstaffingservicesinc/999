import type { AuditLogger, AuditLogInput } from "@/audit/types";
import { SupabaseAuditRepository } from "./audit-repository";

export class SupabaseAuditLogger implements AuditLogger {
  constructor(private readonly repository: SupabaseAuditRepository) {}

  async append(input: AuditLogInput): Promise<void> {
    await this.repository.append(input);
  }
}
