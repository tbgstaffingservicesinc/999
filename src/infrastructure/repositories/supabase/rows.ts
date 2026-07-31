export interface ClientRow {
  id: string;
  internal_client_id: string;
  legal_business_name: string;
  dba: string | null;
  business_type: string | null;
  business_website: string | null;
  notification_email: string | null;
  authorized_contact_name: string | null;
  authorization_confirmed: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TwilioConnectionRow {
  id: string;
  client_id: string;
  account_sid_masked: string | null;
  account_sid_encrypted: string | null;
  api_key_sid_masked: string | null;
  api_key_sid_encrypted: string | null;
  api_key_secret_encrypted: string | null;
  connection_status: string | null;
  last_checked_at: string | null;
  last_error_safe: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditEventRow {
  id: string;
  client_id: string | null;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  safe_details: Record<string, unknown> | null;
  created_at: string;
}
