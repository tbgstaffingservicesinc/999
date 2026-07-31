import type {
  AuditEvent,
  AuditEventCreate,
  Client,
  ClientCreate,
  TwilioConnection,
} from '@/core/canonical';
import type { ImportDraftRepository } from '@/modules/import/types';

export interface ClientRepository {
  list(): Promise<Client[]>;
  findById(id: string): Promise<Client | null>;
  findByInternalClientId(internalClientId: string): Promise<Client | null>;
  create(input: ClientCreate): Promise<Client>;
  deleteById(id: string): Promise<void>;
}

export interface TwilioConnectionRepository {
  findByClientId(clientId: string): Promise<TwilioConnection | null>;
}

export interface AuditRepository {
  append(input: AuditEventCreate): Promise<AuditEvent>;
  listForClient(clientId: string, limit?: number): Promise<AuditEvent[]>;
}

export interface RepositoryContext {
  clients: ClientRepository;
  twilioConnections: TwilioConnectionRepository;
  audit: AuditRepository;
  importDrafts: ImportDraftRepository;
}



