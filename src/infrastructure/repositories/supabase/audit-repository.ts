import type { SupabaseClient } from '@supabase/supabase-js';
import {
  auditEventCreateSchema,
  type AuditEvent,
  type AuditEventCreate,
} from '@/core/canonical';
import { DomainError } from '@/core/errors/domain-error';
import type { AuditRepository } from '@/core/ports/repositories';
import { mapAuditEventRow } from './mappers';
import type { AuditEventRow } from './rows';

const AUDIT_COLUMNS = [
  'id',
  'client_id',
  'actor_id',
  'action',
  'entity_type',
  'entity_id',
  'safe_details',
  'created_at',
].join(',');

export class SupabaseAuditRepository implements AuditRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async append(input: AuditEventCreate): Promise<AuditEvent> {
    const value = auditEventCreateSchema.parse(input);
    const { data, error } = await this.supabase
      .from('audit_events')
      .insert({
        client_id: value.clientId,
        actor_id: value.actorId,
        action: value.action,
        entity_type: value.entityType,
        entity_id: value.entityId,
        safe_details: value.safeDetails,
      })
      .select(AUDIT_COLUMNS)
      .single();

    if (error) {
      throw new DomainError('DATABASE_ERROR', 'Unable to append audit event.', {
        databaseCode: error.code,
      });
    }

    return mapAuditEventRow(data as unknown as AuditEventRow);
  }

  async listForClient(clientId: string, limit = 100): Promise<AuditEvent[]> {
    const { data, error } = await this.supabase
      .from('audit_events')
      .select(AUDIT_COLUMNS)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new DomainError('DATABASE_ERROR', 'Unable to list audit events.', {
        databaseCode: error.code,
      });
    }

    return ((data ?? []) as unknown as AuditEventRow[]).map(mapAuditEventRow);
  }
}
