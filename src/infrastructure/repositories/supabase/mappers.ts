import {
  auditEventSchema,
  clientSchema,
  connectionStatusSchema,
  twilioConnectionSchema,
  type AuditEvent,
  type Client,
  type TwilioConnection,
} from '@/core/canonical';
import type { AuditEventRow, ClientRow, TwilioConnectionRow } from './rows';

export function mapClientRow(row: ClientRow): Client {
  return clientSchema.parse({
    id: row.id,
    internalClientId: row.internal_client_id,
    legalBusinessName: row.legal_business_name,
    dba: row.dba,
    businessType: row.business_type,
    businessWebsite: row.business_website,
    notificationEmail: row.notification_email,
    authorizedContactName: row.authorized_contact_name,
    authorizationConfirmed: row.authorization_confirmed,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function mapTwilioConnectionRow(row: TwilioConnectionRow): TwilioConnection {
  return twilioConnectionSchema.parse({
    id: row.id,
    clientId: row.client_id,
    accountSidMasked: row.account_sid_masked,
    accountSidEncrypted: row.account_sid_encrypted,
    apiKeySidMasked: row.api_key_sid_masked,
    apiKeySidEncrypted: row.api_key_sid_encrypted,
    apiKeySecretEncrypted: row.api_key_secret_encrypted,
    connectionStatus: connectionStatusSchema.catch('unverified').parse(row.connection_status),
    lastCheckedAt: row.last_checked_at,
    lastErrorSafe: row.last_error_safe,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function mapAuditEventRow(row: AuditEventRow): AuditEvent {
  return auditEventSchema.parse({
    id: row.id,
    clientId: row.client_id,
    actorId: row.actor_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    safeDetails: row.safe_details ?? {},
    createdAt: row.created_at,
  });
}
