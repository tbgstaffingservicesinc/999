-- Create clients table
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    internal_client_id TEXT UNIQUE NOT NULL,
    legal_business_name TEXT NOT NULL,
    dba TEXT,
    business_type TEXT,
    business_website TEXT,
    notification_email TEXT,
    authorized_contact_name TEXT,
    authorization_confirmed BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create twilio_connections table
CREATE TABLE twilio_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    account_sid_masked TEXT,
    account_sid_encrypted TEXT,
    api_key_sid_masked TEXT,
    api_key_sid_encrypted TEXT,
    api_key_secret_encrypted TEXT,
    connection_status TEXT,
    last_checked_at TIMESTAMPTZ,
    last_error_safe TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create purchase_batches table
CREATE TABLE purchase_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    requested_quantity INTEGER NOT NULL,
    status TEXT NOT NULL,
    estimated_cost NUMERIC,
    requested_by UUID REFERENCES auth.users(id),
    idempotency_key TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Create purchase_items table
CREATE TABLE purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES purchase_batches(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    requested_phone_number TEXT,
    phone_number_sid TEXT,
    status TEXT NOT NULL,
    safe_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create phone_numbers table
CREATE TABLE phone_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    phone_number_sid TEXT UNIQUE NOT NULL,
    phone_number TEXT UNIQUE NOT NULL,
    friendly_name TEXT,
    capabilities JSONB,
    lifecycle_status TEXT,
    purchased_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create tfv_applications table
CREATE TABLE tfv_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    verification_sid TEXT UNIQUE,
    status TEXT NOT NULL,
    application_payload JSONB,
    submission_snapshot JSONB,
    rejection_reasons JSONB,
    error_codes JSONB,
    idempotency_key TEXT UNIQUE NOT NULL,
    submitted_at TIMESTAMPTZ,
    last_refreshed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create tfv_phone_numbers table
CREATE TABLE tfv_phone_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tfv_application_id UUID NOT NULL REFERENCES tfv_applications(id) ON DELETE CASCADE,
    phone_number_id UUID NOT NULL REFERENCES phone_numbers(id) ON DELETE CASCADE,
    UNIQUE (tfv_application_id, phone_number_id)
);

-- Create audit_events table
CREATE TABLE audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    actor_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    safe_details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes
CREATE INDEX ON twilio_connections (client_id);
CREATE INDEX ON purchase_batches (client_id);
CREATE INDEX ON purchase_items (batch_id);
CREATE INDEX ON purchase_items (client_id);
CREATE INDEX ON phone_numbers (client_id);
CREATE INDEX ON tfv_applications (client_id);
CREATE INDEX ON tfv_phone_numbers (tfv_application_id);
CREATE INDEX ON tfv_phone_numbers (phone_number_id);
CREATE INDEX ON audit_events (client_id);
CREATE INDEX ON audit_events (actor_id);
CREATE INDEX ON audit_events (entity_type, entity_id);

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON clients
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON twilio_connections
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON purchase_items
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON phone_numbers
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON tfv_applications
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Enable Row Level Security
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE twilio_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tfv_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE tfv_phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow full access to authenticated users" ON clients FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow full access to authenticated users" ON twilio_connections FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow full access to authenticated users" ON purchase_batches FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow full access to authenticated users" ON purchase_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow full access to authenticated users" ON phone_numbers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow full access to authenticated users" ON tfv_applications FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow full access to authenticated users" ON tfv_phone_numbers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow full access to authenticated users" ON audit_events FOR ALL USING (auth.role() = 'authenticated');
