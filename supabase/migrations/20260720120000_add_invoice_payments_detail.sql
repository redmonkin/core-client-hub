-- Zoho-style payment capture: previously a payment was only a delta applied
-- to invoice_amounts.amount_paid, with no record of how/when it was paid.
-- invoice_payments stores one row per recorded transaction (partial or
-- full) so the invoice retains a real payment history.

CREATE TABLE public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  bank_charges numeric(12,2) NOT NULL DEFAULT 0,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_mode text,
  tax_deducted boolean NOT NULL DEFAULT false,
  reference_number text,
  notes text,
  thank_you_sent boolean NOT NULL DEFAULT false,
  recorded_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX invoice_payments_invoice_id_idx ON public.invoice_payments(invoice_id);

ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

-- Same visibility rule as invoice_amounts: only visible to workspace members
-- with financial access on the invoice's owner workspace.
CREATE POLICY "Users can view payments they have financial access to" ON public.invoice_payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_payments.invoice_id
      AND i.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
      AND public.can_view_financials(auth.uid(), i.user_id)
    )
  );

-- Rows are normally inserted by record_invoice_payment() (SECURITY DEFINER,
-- bypasses RLS), but these policies exist so direct table access is governed
-- by the same rule if ever used outside that RPC.
CREATE POLICY "Users can add payments they have financial access to" ON public.invoice_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_payments.invoice_id
      AND i.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
      AND public.get_workspace_role(auth.uid(), i.user_id) IN ('owner', 'admin', 'editor')
      AND public.can_view_financials(auth.uid(), i.user_id)
    )
  );

CREATE POLICY "Users can delete payments they have financial access to" ON public.invoice_payments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_payments.invoice_id
      AND i.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
      AND public.get_workspace_role(auth.uid(), i.user_id) IN ('owner', 'admin', 'editor')
      AND public.can_view_financials(auth.uid(), i.user_id)
    )
  );

-- record_invoice_payment() gains the Zoho-style detail fields and now writes
-- an invoice_payments row alongside the existing amount_paid/status update.
-- Signature changes (new params), so the old two-arg version is dropped
-- first rather than relying on CREATE OR REPLACE, which cannot add
-- parameters to an existing signature.
DROP FUNCTION IF EXISTS public.record_invoice_payment(uuid, numeric);

CREATE OR REPLACE FUNCTION public.record_invoice_payment(
  _invoice_id uuid,
  _amount numeric,
  _bank_charges numeric DEFAULT 0,
  _payment_date date DEFAULT CURRENT_DATE,
  _payment_mode text DEFAULT NULL,
  _tax_deducted boolean DEFAULT false,
  _reference_number text DEFAULT NULL,
  _notes text DEFAULT NULL,
  _thank_you_sent boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_id uuid;
  _status text;
  _total numeric;
  _new_paid numeric;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'payment amount must be greater than zero';
  END IF;

  SELECT user_id, status INTO _owner_id, _status FROM public.invoices WHERE id = _invoice_id;
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'invoice not found';
  END IF;
  IF _status = 'void' THEN
    RAISE EXCEPTION 'cannot record a payment on a void invoice';
  END IF;

  IF NOT public.has_permission(auth.uid(), _owner_id, 'invoices', 'update') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  IF NOT public.can_view_financials(auth.uid(), _owner_id) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  UPDATE public.invoice_amounts
  SET amount_paid = LEAST(amount_paid + _amount, total_amount)
  WHERE invoice_id = _invoice_id
  RETURNING total_amount, amount_paid INTO _total, _new_paid;

  IF _total IS NULL THEN
    RAISE EXCEPTION 'invoice has no recorded amount';
  END IF;

  INSERT INTO public.invoice_payments (
    invoice_id, amount, bank_charges, payment_date, payment_mode,
    tax_deducted, reference_number, notes, thank_you_sent
  ) VALUES (
    _invoice_id, _amount, COALESCE(_bank_charges, 0), COALESCE(_payment_date, CURRENT_DATE),
    _payment_mode, COALESCE(_tax_deducted, false), _reference_number, _notes, COALESCE(_thank_you_sent, false)
  );

  UPDATE public.invoices
  SET status = CASE WHEN _new_paid >= _total THEN 'paid' ELSE 'partial' END,
      paid_at = CASE WHEN _new_paid >= _total THEN now() ELSE paid_at END
  WHERE id = _invoice_id;
END;
$$;

-- DROP FUNCTION above reset EXECUTE grants to their default (PUBLIC/anon),
-- regressing the anon/PUBLIC revoke the original record_invoice_payment
-- migration had in place. Restore it to match the rest of the codebase's
-- convention.
REVOKE EXECUTE ON FUNCTION public.record_invoice_payment(uuid, numeric, numeric, date, text, boolean, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_invoice_payment(uuid, numeric, numeric, date, text, boolean, text, text, boolean) TO authenticated;
