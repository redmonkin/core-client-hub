-- Add "ended" as a valid contract status, for contracts the client has explicitly
-- chosen not to renew (distinct from "expired", which is date-based lapse).
ALTER TABLE public.contracts DROP CONSTRAINT contracts_status_check;
ALTER TABLE public.contracts ADD CONSTRAINT contracts_status_check
  CHECK (status = ANY (ARRAY['draft'::text, 'sent'::text, 'approved'::text, 'rejected'::text, 'change_requested'::text, 'active'::text, 'expired'::text, 'pending-renewal'::text, 'ended'::text]));
