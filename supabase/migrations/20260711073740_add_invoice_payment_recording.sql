-- Partial-payment recording. Previously "Mark as Paid" only flipped
-- invoices.status without ever writing invoice_amounts.amount_paid, so a
-- "paid" invoice's PDF/portal view still showed the full balance due. This
-- adds a 'partial' status and a single atomic RPC that records a payment
-- (increment amount_paid) and derives the correct status from the running
-- total, so status and amount_paid can never drift apart.

ALTER TABLE public.invoices DROP CONSTRAINT invoices_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'sent', 'partial', 'paid', 'void'));

CREATE OR REPLACE FUNCTION public.record_invoice_payment(
  _invoice_id uuid,
  _amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_id uuid;
  _total numeric;
  _new_paid numeric;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'payment amount must be greater than zero';
  END IF;

  SELECT user_id INTO _owner_id FROM public.invoices WHERE id = _invoice_id;
  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'invoice not found';
  END IF;

  IF NOT public.has_permission(auth.uid(), _owner_id, 'invoices', 'update') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  IF NOT public.can_view_financials(auth.uid(), _owner_id) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  UPDATE public.invoice_amounts
  SET amount_paid = amount_paid + _amount
  WHERE invoice_id = _invoice_id
  RETURNING total_amount, amount_paid INTO _total, _new_paid;

  IF _total IS NULL THEN
    RAISE EXCEPTION 'invoice has no recorded amount';
  END IF;

  UPDATE public.invoices
  SET status = CASE WHEN _new_paid >= _total THEN 'paid' ELSE 'partial' END,
      paid_at = CASE WHEN _new_paid >= _total THEN now() ELSE paid_at END
  WHERE id = _invoice_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_invoice_payment(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_invoice_payment(uuid, numeric) TO authenticated;
