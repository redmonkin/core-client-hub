-- Lets the user override the auto-generated invoice number at create time
-- (the UI now prefills the generated number from invoice_settings but allows
-- editing it before save) and at edit time (plain column update, already
-- covered by the existing "Users can update their own invoices" policy).
-- The sequence counter still always advances so the next invoice keeps
-- getting a fresh generated suggestion regardless of whether this one was
-- customized; the UNIQUE(user_id, invoice_number) constraint on the table
-- rejects a custom number that collides with an existing invoice.

DROP FUNCTION IF EXISTS public.create_invoice(uuid, uuid, uuid, date, text, date, text, text, numeric);

CREATE OR REPLACE FUNCTION public.create_invoice(
  _client_id uuid,
  _project_id uuid,
  _contract_id uuid,
  _issued_date date,
  _payment_terms text,
  _due_date date,
  _notes text,
  _cost_breakdown text,
  _total_amount numeric,
  _invoice_number text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_id uuid;
  _prefix text;
  _seq integer;
  _padding integer;
  _generated_number text;
  _final_number text;
  _invoice_id uuid;
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

  _generated_number := _prefix || lpad(_seq::text, _padding, '0');
  _final_number := NULLIF(trim(_invoice_number), '');
  IF _final_number IS NULL THEN
    _final_number := _generated_number;
  END IF;

  INSERT INTO public.invoices (
    user_id, client_id, project_id, contract_id, invoice_number,
    issued_date, payment_terms, due_date, notes, cost_breakdown
  ) VALUES (
    _owner_id, _client_id, _project_id, _contract_id, _final_number,
    _issued_date, _payment_terms, _due_date, _notes, _cost_breakdown
  ) RETURNING id INTO _invoice_id;

  IF _total_amount IS NOT NULL AND public.can_view_financials(auth.uid(), _owner_id) THEN
    INSERT INTO public.invoice_amounts (invoice_id, total_amount)
    VALUES (_invoice_id, _total_amount);
  END IF;

  RETURN _invoice_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_invoice(uuid, uuid, uuid, date, text, date, text, text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_invoice(uuid, uuid, uuid, date, text, date, text, text, numeric, text) TO authenticated;
