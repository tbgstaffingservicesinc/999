import type { SupabaseClient } from '@supabase/supabase-js';
import type { Client, ClientCreate } from '@/core/canonical';
import { clientCreateSchema } from '@/core/canonical';
import { DomainError } from '@/core/errors/domain-error';
import type { ClientRepository } from '@/core/ports/repositories';
import { mapClientRow } from './mappers';
import type { ClientRow } from './rows';

const CLIENT_COLUMNS = [
  'id',
  'internal_client_id',
  'legal_business_name',
  'dba',
  'business_type',
  'business_website',
  'notification_email',
  'authorized_contact_name',
  'authorization_confirmed',
  'active',
  'created_at',
  'updated_at',
].join(',');

export class SupabaseClientRepository implements ClientRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async list(): Promise<Client[]> {
    const { data, error } = await this.supabase
      .from('clients')
      .select(CLIENT_COLUMNS)
      .order('created_at', { ascending: false });

    if (error) {
      throw databaseError('Unable to list clients.', error.code);
    }

    return ((data ?? []) as unknown as ClientRow[]).map(mapClientRow);
  }

  async findById(id: string): Promise<Client | null> {
    const { data, error } = await this.supabase
      .from('clients')
      .select(CLIENT_COLUMNS)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw databaseError('Unable to read client.', error.code);
    }

    return data ? mapClientRow(data as unknown as ClientRow) : null;
  }

  async findByInternalClientId(internalClientId: string): Promise<Client | null> {
    const { data, error } = await this.supabase
      .from('clients')
      .select(CLIENT_COLUMNS)
      .eq('internal_client_id', internalClientId)
      .maybeSingle();

    if (error) {
      throw databaseError('Unable to read client.', error.code);
    }

    return data ? mapClientRow(data as unknown as ClientRow) : null;
  }

  async deleteById(id: string): Promise<void> {
    const { error } = await this.supabase.from('clients').delete().eq('id', id);
    if (error) {
      throw databaseError('Unable to compensate the newly created client.', error.code);
    }
  }
  async create(input: ClientCreate): Promise<Client> {
    const value = clientCreateSchema.parse(input);
    const { data, error } = await this.supabase
      .from('clients')
      .insert({
        internal_client_id: value.internalClientId,
        legal_business_name: value.legalBusinessName,
        dba: value.dba,
        business_type: value.businessType,
        business_website: value.businessWebsite,
        notification_email: value.notificationEmail,
        authorized_contact_name: value.authorizedContactName,
        authorization_confirmed: value.authorizationConfirmed,
        active: value.active,
      })
      .select(CLIENT_COLUMNS)
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new DomainError('CONFLICT', 'A client with this identifier already exists.');
      }
      throw databaseError('Unable to create client.', error.code);
    }

    return mapClientRow(data as unknown as ClientRow);
  }
}

function databaseError(message: string, databaseCode: string): DomainError {
  return new DomainError('DATABASE_ERROR', message, { databaseCode });
}

