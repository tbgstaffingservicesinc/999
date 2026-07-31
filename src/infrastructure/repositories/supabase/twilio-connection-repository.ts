import type { SupabaseClient } from '@supabase/supabase-js';
import type { TwilioConnection } from '@/core/canonical';
import { DomainError } from '@/core/errors/domain-error';
import type { TwilioConnectionRepository } from '@/core/ports/repositories';
import { mapTwilioConnectionRow } from './mappers';
import type { TwilioConnectionRow } from './rows';

const CONNECTION_COLUMNS = [
  'id',
  'client_id',
  'account_sid_masked',
  'account_sid_encrypted',
  'api_key_sid_masked',
  'api_key_sid_encrypted',
  'api_key_secret_encrypted',
  'connection_status',
  'last_checked_at',
  'last_error_safe',
  'created_at',
  'updated_at',
].join(',');

export class SupabaseTwilioConnectionRepository implements TwilioConnectionRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findByClientId(clientId: string): Promise<TwilioConnection | null> {
    const { data, error } = await this.supabase
      .from('twilio_connections')
      .select(CONNECTION_COLUMNS)
      .eq('client_id', clientId)
      .maybeSingle();

    if (error) {
      throw new DomainError('DATABASE_ERROR', 'Unable to read Twilio connection.', {
        databaseCode: error.code,
      });
    }

    return data
      ? mapTwilioConnectionRow(data as unknown as TwilioConnectionRow)
      : null;
  }
}
