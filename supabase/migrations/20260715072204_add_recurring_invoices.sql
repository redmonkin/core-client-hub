-- Recurring invoicing: a schedule/template (client, project, line items,
-- cadence) that a cron-triggered edge function turns into ordinary rows in
-- `invoices` on each run date. This table holds no invoice data itself --
-- generated invoices live in the existing `invoices`/`invoice_amounts`
-- tables and go through the same numbering, status lifecycle, and portal
-- flows as a manually created invoice.
CREATE TABLE public.recurring_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  frequency text NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'yearly')),
  day_of_month integer NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  start_date date NOT NULL,
  next_run_date date NOT NULL,
  end_date date,
  payment_terms text,
  cost_breakdown text,
  notes text,
  auto_send boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  last_generated_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TRIGGER update_recurring_invoices_updated_at
BEFORE UPDATE ON public.recurring_invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX recurring_invoices_user_id_idx ON public.recurring_invoices(user_id);
CREATE INDEX recurring_invoices_due_idx ON public.recurring_invoices(next_run_date) WHERE is_active;

ALTER TABLE public.recurring_invoices ENABLE ROW LEVEL SECURITY;

-- Mirrors the current `invoices` module RLS pattern exactly (has_permission
-- against the 'invoices' module -- a recurring schedule is just another way
-- to create an invoice, so it rides the same permission).
CREATE POLICY "Users can view their own recurring invoices" ON public.recurring_invoices
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'invoices', 'read'));

CREATE POLICY "Users can create their own recurring invoices" ON public.recurring_invoices
  FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'invoices', 'create'));

CREATE POLICY "Users can update their own recurring invoices" ON public.recurring_invoices
  FOR UPDATE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'invoices', 'update'));

CREATE POLICY "Users can delete their own recurring invoices" ON public.recurring_invoices
  FOR DELETE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'invoices', 'delete'));

-- Same atomic invoice-numbering step as create_invoice(), minus the
-- auth.uid()-based permission check -- auth.uid() is null under the
-- service-role connection the recurring-invoice cron function runs as, so
-- create_invoice() itself is not callable from that context. Restricted to
-- service_role only; this is not meant to be reachable from client code.
CREATE OR REPLACE FUNCTION public.generate_invoice_number_for_owner(_owner_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prefix text;
  _seq integer;
  _padding integer;
BEGIN
  INSERT INTO public.invoice_settings (user_id) VALUES (_owner_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.invoice_settings
  SET next_invoice_number = next_invoice_number + 1
  WHERE user_id = _owner_id
  RETURNING invoice_prefix, next_invoice_number - 1, number_padding INTO _prefix, _seq, _padding;

  RETURN _prefix || lpad(_seq::text, _padding, '0');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_invoice_number_for_owner(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_invoice_number_for_owner(uuid) TO service_role;
