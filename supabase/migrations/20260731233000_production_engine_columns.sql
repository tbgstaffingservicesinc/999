-- Production Engine persistence columns. Created, not applied automatically.
ALTER TABLE public.tfv_applications ADD COLUMN IF NOT EXISTS phone_number_id uuid REFERENCES public.phone_numbers(id);
ALTER TABLE public.tfv_applications ADD COLUMN IF NOT EXISTS response_snapshot jsonb;
ALTER TABLE public.tfv_applications ADD COLUMN IF NOT EXISTS error_code integer;
ALTER TABLE public.tfv_applications ADD COLUMN IF NOT EXISTS rejection_reason jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS tfv_applications_one_per_phone ON public.tfv_applications(phone_number_id) WHERE phone_number_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.prepare_tfv_batch(p_client_id uuid,p_phone_number_ids uuid[],p_operation_id uuid)
RETURNS TABLE(application_id uuid) LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_phone_id uuid;v_source public.tfv_applications%ROWTYPE;v_application_id uuid;v_sid text;
BEGIN
 SELECT * INTO v_source FROM public.tfv_applications WHERE client_id=p_client_id AND application_payload ? 'submission_payload_en' ORDER BY created_at DESC LIMIT 1;
 IF v_source.id IS NULL THEN RAISE EXCEPTION 'No TFV draft with English submission payload exists';END IF;
 FOREACH v_phone_id IN ARRAY p_phone_number_ids LOOP
  SELECT phone_number_sid INTO v_sid FROM public.phone_numbers WHERE id=v_phone_id AND client_id=p_client_id;
  IF v_sid IS NULL OR v_sid !~ '^PN[A-Za-z0-9]{32}$' THEN RAISE EXCEPTION 'Phone number is not a purchased client PN';END IF;
  IF EXISTS(SELECT 1 FROM public.tfv_applications WHERE phone_number_id=v_phone_id) THEN RAISE EXCEPTION 'Phone number already has a TFV application';END IF;
  INSERT INTO public.tfv_applications(client_id,phone_number_id,status,application_payload,idempotency_key,operation_id)
   VALUES(p_client_id,v_phone_id,'DRAFT',v_source.application_payload,p_operation_id::text||':'||v_phone_id::text,p_operation_id) RETURNING id INTO v_application_id;
  INSERT INTO public.tfv_phone_numbers(tfv_application_id,phone_number_id,operation_id) VALUES(v_application_id,v_phone_id,p_operation_id);
  application_id:=v_application_id;RETURN NEXT;
 END LOOP;
END;$$;
REVOKE ALL ON FUNCTION public.prepare_tfv_batch(uuid,uuid[],uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepare_tfv_batch(uuid,uuid[],uuid) TO authenticated;
