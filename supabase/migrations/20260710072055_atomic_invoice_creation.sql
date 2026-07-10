-- Redundant re-apply of 20260710072003_atomic_invoice_creation.sql (idempotent
-- CREATE OR REPLACE of the same function) -- recorded here only to keep this
-- migration history file in sync with what actually ran against the remote
-- project.
CREATE OR REPLACE FUNCTION public.create_invoice(
  _client_id uuid,
  _project_id uuid,
  _contract_id uuid,
  _issued_date date,
  _payment_terms text,
  _due_date date,
  _notes text,
  _cost_breakdown text,
  _total_amount numeric
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
  _invoice_number text;
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

  _invoice_number := _prefix || lpad(_seq::text, _padding, '0');

  INSERT INTO public.invoices (
    user_id, client_id, project_id, contract_id, invoice_number,
    issued_date, payment_terms, due_date, notes, cost_breakdown
  ) VALUES (
    _owner_id, _client_id, _project_id, _contract_id, _invoice_number,
    _issued_date, _payment_terms, _due_date, _notes, _cost_breakdown
  ) RETURNING id INTO _invoice_id;

  IF _total_amount IS NOT NULL AND public.can_view_financials(auth.uid(), _owner_id) THEN
    INSERT INTO public.invoice_amounts (invoice_id, total_amount)
    VALUES (_invoice_id, _total_amount);
  END IF;

  RETURN _invoice_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_invoice(uuid, uuid, uuid, date, text, date, text, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_invoice(uuid, uuid, uuid, date, text, date, text, text, numeric) TO authenticated;
