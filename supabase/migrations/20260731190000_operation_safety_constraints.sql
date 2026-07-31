-- Safety constraints for idempotent local operation recording.
-- This migration is created for review only and is not executed automatically.

CREATE UNIQUE INDEX IF NOT EXISTS twilio_connections_one_per_client
ON twilio_connections (client_id);

CREATE UNIQUE INDEX IF NOT EXISTS purchase_items_one_number_per_batch
ON purchase_items (batch_id, requested_phone_number)
WHERE requested_phone_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS purchase_batches_status_idx
ON purchase_batches (status);

CREATE INDEX IF NOT EXISTS purchase_items_status_idx
ON purchase_items (status);

CREATE INDEX IF NOT EXISTS tfv_applications_status_refresh_idx
ON tfv_applications (status, last_refreshed_at);
