import { z } from 'zod';

export const auditEventCreateSchema = z.object({
  clientId: z.uuid().nullable().default(null),
  actorId: z.uuid().nullable().default(null),
  action: z.string().trim().min(1),
  entityType: z.string().trim().min(1).nullable().default(null),
  entityId: z.uuid().nullable().default(null),
  safeDetails: z.record(z.string(), z.unknown()).default({}),
});

export const auditEventSchema = z.object({
  id: z.uuid(),
  ...auditEventCreateSchema.shape,
  createdAt: z.iso.datetime(),
});

export type AuditEventCreate = z.infer<typeof auditEventCreateSchema>;
export type AuditEvent = z.infer<typeof auditEventSchema>;
