-- record_invoice_payment() had two gaps found in a hardening review:
-- 1. No status guard: a void (or already-paid) invoice could still have a
--    payment recorded via direct RPC call, silently un-voiding it — the UI
--    hid the "Record Payment" action for void/paid invoices, but that's not
--    enforcement.
-- 2. No cap on overpayment: amount_paid could exceed total_amount, which
--    would then render as a negative "balance due" on the PDF/portal view.

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

  UPDATE public.invoices
  SET status = CASE WHEN _new_paid >= _total THEN 'paid' ELSE 'partial' END,
      paid_at = CASE WHEN _new_paid >= _total THEN now() ELSE paid_at END
  WHERE id = _invoice_id;
END;
$$;
