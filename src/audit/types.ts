export interface AuditLogInput {
  readonly clientId: string | null;
  readonly actorId: string | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly safeDetails: Readonly<Record<string, unknown>>;
}

export interface AuditLogger {
  append(input: AuditLogInput): Promise<void>;
}
