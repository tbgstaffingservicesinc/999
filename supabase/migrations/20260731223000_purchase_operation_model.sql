-- Purchase Engine persistence model for a future execution phase.
-- This migration is created for review only and must not be applied in the architecture phase.
ALTER TABLE public.purchase_batches
  ADD COLUMN purchase_operation_id uuid,
  ADD CONSTRAINT purchase_batches_purchase_operation_id_key UNIQUE (purchase_operation_id);

ALTER TABLE public.phone_numbers
  ADD COLUMN purchase_operation_id uuid,
  ADD COLUMN status text;

ALTER TABLE public.phone_numbers
  ADD CONSTRAINT phone_numbers_purchase_operation_id_fkey
  FOREIGN KEY (purchase_operation_id)
  REFERENCES public.purchase_batches(purchase_operation_id);

CREATE INDEX phone_numbers_purchase_operation_id_idx
  ON public.phone_numbers (purchase_operation_id);

COMMENT ON COLUMN public.phone_numbers.phone_number_sid IS 'Twilio Phone Number SID; populated only after a confirmed remote purchase.';
COMMENT ON COLUMN public.phone_numbers.status IS 'Local purchase lifecycle status.';
