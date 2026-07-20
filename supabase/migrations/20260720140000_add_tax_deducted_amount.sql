-- TDS-style payments: when tax_deducted is set, the client withholds a tax
-- amount and pays the rest directly, but the invoice is settled for the
-- combined amount (received + tax withheld) -- the withheld portion isn't
-- unpaid, it's remitted to the tax authority on the vendor's behalf. This
-- also gives income/expense reporting a real figure for tax withheld,
-- separate from cash actually received, instead of just a boolean flag.

ALTER TABLE public.invoice_payments
  ADD COLUMN tax_deducted_amount numeric(12,2) NOT NULL DEFAULT 0;

DROP FUNCTION IF EXISTS public.record_invoice_payment(uuid, numeric, numeric, date, text, boolean, text, text, boolean);

CREATE OR REPLACE FUNCTION public.record_invoice_payment(
  _invoice_id uuid,
  _amount numeric,
  _bank_charges numeric DEFAULT 0,
  _payment_date date DEFAULT CURRENT_DATE,
  _payment_mode text DEFAULT NULL,
  _tax_deducted boolean DEFAULT false,
  _tax_amount numeric DEFAULT 0,
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
  _tax_withheld numeric;
  _settled_amount numeric;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'payment amount must be greater than zero';
  END IF;

  _tax_withheld := CASE WHEN _tax_deducted THEN COALESCE(_tax_amount, 0) ELSE 0 END;
  IF _tax_deducted AND _tax_withheld <= 0 THEN
    RAISE EXCEPTION 'tax amount must be greater than zero when tax is deducted';
  END IF;
  _settled_amount := _amount + _tax_withheld;

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
  SET amount_paid = LEAST(amount_paid + _settled_amount, total_amount)
  WHERE invoice_id = _invoice_id
  RETURNING total_amount, amount_paid INTO _total, _new_paid;

  IF _total IS NULL THEN
    RAISE EXCEPTION 'invoice has no recorded amount';
  END IF;

  INSERT INTO public.invoice_payments (
    invoice_id, amount, bank_charges, payment_date, payment_mode,
    tax_deducted, tax_deducted_amount, reference_number, notes, thank_you_sent
  ) VALUES (
    _invoice_id, _amount, COALESCE(_bank_charges, 0), COALESCE(_payment_date, CURRENT_DATE),
    _payment_mode, COALESCE(_tax_deducted, false), _tax_withheld, _reference_number, _notes, COALESCE(_thank_you_sent, false)
  );

  UPDATE public.invoices
  SET status = CASE WHEN _new_paid >= _total THEN 'paid' ELSE 'partial' END,
      paid_at = CASE WHEN _new_paid >= _total THEN now() ELSE paid_at END
  WHERE id = _invoice_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_invoice_payment(uuid, numeric, numeric, date, text, boolean, numeric, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_invoice_payment(uuid, numeric, numeric, date, text, boolean, numeric, text, text, boolean) TO authenticated;
