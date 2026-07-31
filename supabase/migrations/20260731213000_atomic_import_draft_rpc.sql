-- Atomic client resolution and TFV draft persistence for Import Engine.
-- This migration is intentionally not executed by application code.
CREATE OR REPLACE FUNCTION public.save_import_draft_atomic(
  p_resolution_mode text,
  p_existing_client_id uuid,
  p_internal_client_id text,
  p_legal_business_name text,
  p_dba text,
  p_business_type text,
  p_business_website text,
  p_notification_email text,
  p_authorized_contact_name text,
  p_application_status text,
  p_application_payload jsonb,
  p_idempotency_key text
)
RETURNS TABLE (client_id uuid, draft_id uuid, draft_status text, client_created boolean)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_internal_client_id text;
  v_draft_id uuid;
  v_client_created boolean := false;
BEGIN
  IF p_resolution_mode = 'CREATE_NEW' THEN
    IF p_existing_client_id IS NOT NULL THEN
      RAISE EXCEPTION 'CREATE_NEW does not accept an existing client ID';
    END IF;
    IF NULLIF(BTRIM(p_legal_business_name), '') IS NULL THEN
      RAISE EXCEPTION 'CREATE_NEW requires legal business name';
    END IF;

    INSERT INTO public.clients (
      internal_client_id, legal_business_name, dba, business_type,
      business_website, notification_email, authorized_contact_name,
      authorization_confirmed, active
    ) VALUES (
      COALESCE(NULLIF(BTRIM(p_internal_client_id), ''), gen_random_uuid()::text), BTRIM(p_legal_business_name), NULLIF(BTRIM(p_dba), ''),
      NULLIF(BTRIM(p_business_type), ''), NULLIF(BTRIM(p_business_website), ''),
      NULLIF(BTRIM(p_notification_email), ''), NULLIF(BTRIM(p_authorized_contact_name), ''), false, true
    ) RETURNING id INTO v_client_id;
    v_client_created := true;
  ELSIF p_resolution_mode = 'LINK_EXISTING' THEN
    IF p_existing_client_id IS NULL OR NULLIF(BTRIM(p_internal_client_id), '') IS NULL THEN
      RAISE EXCEPTION 'LINK_EXISTING requires existing client ID and internal client ID';
    END IF;
    SELECT id, internal_client_id INTO v_client_id, v_internal_client_id
      FROM public.clients WHERE id = p_existing_client_id FOR SHARE;
    IF v_client_id IS NULL THEN
      RAISE EXCEPTION 'Existing client was not found';
    END IF;
    IF v_internal_client_id IS DISTINCT FROM BTRIM(p_internal_client_id) THEN
      RAISE EXCEPTION 'Internal client ID does not match the selected existing client';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported client resolution mode';
  END IF;

  INSERT INTO public.tfv_applications (
    client_id, status, application_payload, submission_snapshot, idempotency_key
  ) VALUES (
    v_client_id, p_application_status, p_application_payload, NULL, p_idempotency_key
  ) RETURNING id, status INTO v_draft_id, draft_status;

  client_id := v_client_id;
  draft_id := v_draft_id;
  client_created := v_client_created;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.save_import_draft_atomic(text, uuid, text, text, text, text, text, text, text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_import_draft_atomic(text, uuid, text, text, text, text, text, text, text, text, jsonb, text) TO authenticated;
