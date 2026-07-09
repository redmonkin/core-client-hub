-- Revenue & Billing: invoices, generated manually or from a contract, with
-- client-portal viewing and manual "mark as paid". No payment gateway in this
-- phase (payment_provider/payment_reference are here so a future gateway
-- integration doesn't need another migration).
--
-- Financial figures (total_amount/amount_paid) live in a separate
-- invoice_amounts table with its own RLS requiring can_view_financials, so a
-- team member without financial access genuinely never receives the amount
-- in an API response — not just a UI-hidden field.

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'void')),
  currency text NOT NULL DEFAULT 'INR',
  cost_breakdown text,
  due_date date,
  issued_date date NOT NULL DEFAULT CURRENT_DATE,
  paid_at timestamptz,
  payment_provider text,
  payment_reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, invoice_number)
);

CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.invoice_amounts (
  invoice_id uuid PRIMARY KEY REFERENCES public.invoices(id) ON DELETE CASCADE,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid numeric(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE public.invoice_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  password_hash text,
  expires_at timestamptz NOT NULL,
  viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX invoices_user_id_idx ON public.invoices(user_id);
CREATE INDEX invoices_client_id_idx ON public.invoices(client_id);
CREATE INDEX invoices_status_idx ON public.invoices(status);
CREATE INDEX invoices_due_date_idx ON public.invoices(due_date);

-- Returns whether _user_id can see financial figures within _owner_id's
-- workspace: always true for the owner themselves, otherwise the active
-- team_members row's can_view_financials flag (defaulting to false if no
-- active membership is found).
CREATE OR REPLACE FUNCTION public.can_view_financials(_user_id uuid, _owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _user_id = _owner_id THEN true
    ELSE COALESCE(
      (SELECT tm.can_view_financials FROM public.team_members tm
       WHERE tm.member_id = _user_id AND tm.owner_id = _owner_id AND tm.status = 'active'
       LIMIT 1),
      false
    )
  END
$$;

REVOKE EXECUTE ON FUNCTION public.can_view_financials(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_financials(uuid, uuid) TO authenticated;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

CREATE POLICY "Users can create their own invoices" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );

CREATE POLICY "Users can update their own invoices" ON public.invoices
  FOR UPDATE TO authenticated
  USING (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );

CREATE POLICY "Users can delete their own invoices" ON public.invoices
  FOR DELETE TO authenticated
  USING (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );

ALTER TABLE public.invoice_amounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invoice amounts they have financial access to" ON public.invoice_amounts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_amounts.invoice_id
      AND i.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
      AND public.can_view_financials(auth.uid(), i.user_id)
    )
  );

CREATE POLICY "Users can create invoice amounts they have financial access to" ON public.invoice_amounts
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_amounts.invoice_id
      AND i.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
      AND public.get_workspace_role(auth.uid(), i.user_id) IN ('owner', 'admin', 'editor')
      AND public.can_view_financials(auth.uid(), i.user_id)
    )
  );

CREATE POLICY "Users can update invoice amounts they have financial access to" ON public.invoice_amounts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_amounts.invoice_id
      AND i.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
      AND public.get_workspace_role(auth.uid(), i.user_id) IN ('owner', 'admin', 'editor')
      AND public.can_view_financials(auth.uid(), i.user_id)
    )
  );

CREATE POLICY "Users can delete invoice amounts they have financial access to" ON public.invoice_amounts
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_amounts.invoice_id
      AND i.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
      AND public.get_workspace_role(auth.uid(), i.user_id) IN ('owner', 'admin', 'editor')
      AND public.can_view_financials(auth.uid(), i.user_id)
    )
  );

ALTER TABLE public.invoice_access_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tokens for their invoices" ON public.invoice_access_tokens
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_access_tokens.invoice_id
      AND invoices.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    )
  );

CREATE POLICY "Users can create tokens for their invoices" ON public.invoice_access_tokens
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_access_tokens.invoice_id
      AND invoices.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
      AND public.get_workspace_role(auth.uid(), invoices.user_id) IN ('owner', 'admin', 'editor')
    )
  );

CREATE POLICY "Users can delete tokens for their invoices" ON public.invoice_access_tokens
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_access_tokens.invoice_id
      AND invoices.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
      AND public.get_workspace_role(auth.uid(), invoices.user_id) IN ('owner', 'admin', 'editor')
    )
  );
