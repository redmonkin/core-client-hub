-- Invoice feature deepening (migrating off Zoho): configurable invoice
-- numbering (prefix + sequence, allocated atomically to avoid the previous
-- client-side collision-retry hack), bank/payment details + default terms &
-- conditions for the PDF/email, a payment_terms field on each invoice
-- (Net 15/30/45/60/Custom) for auto-filling due_date, and the workspace
-- owner's own postal address (previously nowhere in the schema -- only the
-- client's address was ever stored).

ALTER TABLE public.branding_settings ADD COLUMN IF NOT EXISTS company_address text;

CREATE TABLE public.invoice_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  invoice_prefix text NOT NULL DEFAULT 'INV-',
  next_invoice_number integer NOT NULL DEFAULT 1,
  number_padding integer NOT NULL DEFAULT 4,
  bank_account_name text,
  bank_name text,
  account_number text,
  ifsc_code text,
  swift_code text,
  pan text,
  upi_id text,
  payment_instructions text,
  terms_and_conditions text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_invoice_settings_updated_at
BEFORE UPDATE ON public.invoice_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.invoices ADD COLUMN payment_terms text;

ALTER TABLE public.invoice_settings ENABLE ROW LEVEL SECURITY;

-- Every team member can read (needed to render/send invoices); only the
-- owner or an admin can change bank/payment details.
CREATE POLICY "Users can view their workspace invoice settings" ON public.invoice_settings
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

CREATE POLICY "Owners and admins can manage invoice settings" ON public.invoice_settings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.get_workspace_role(auth.uid(), user_id) = 'admin')
  WITH CHECK (auth.uid() = user_id OR public.get_workspace_role(auth.uid(), user_id) = 'admin');

-- Atomically allocates and returns the next invoice number for the caller's
-- workspace (creating a default invoice_settings row on first use). Runs
-- SECURITY DEFINER and derives the workspace from auth.uid() itself (never
-- trusts a caller-supplied user id) so it can safely bypass RLS to do the
-- increment under a row lock, avoiding the race a plain client-side
-- "count existing rows + 1" approach has under concurrent invoice creation.
CREATE OR REPLACE FUNCTION public.get_next_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_id uuid;
  _prefix text;
  _seq integer;
  _padding integer;
BEGIN
  _owner_id := public.get_owner_id(auth.uid());

  IF NOT public.has_permission(auth.uid(), _owner_id, 'invoices', 'create') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  INSERT INTO public.invoice_settings (user_id) VALUES (_owner_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.invoice_settings
  SET next_invoice_number = next_invoice_number + 1
  WHERE user_id = _owner_id
  RETURNING invoice_prefix, next_invoice_number - 1, number_padding INTO _prefix, _seq, _padding;

  RETURN _prefix || lpad(_seq::text, _padding, '0');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_next_invoice_number() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_next_invoice_number() TO authenticated;
