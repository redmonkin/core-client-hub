-- Expenses: a simple log of business spend (rent, software, contractors,
-- travel, etc.) shown as a new tab on the Accounts page alongside invoices.
-- Not linked to any invoice/client/project -- it's a standalone ledger, not
-- billable-expense tracking. Gated the same way invoice_amounts/invoice
-- financial data is: can_view_financials plus the existing 'invoices' module
-- permission, since expenses live on the same Accounts page and there's no
-- separate permission module for them.

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL DEFAULT 'other',
  vendor text,
  description text,
  amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX expenses_user_id_idx ON public.expenses(user_id);
CREATE INDEX expenses_expense_date_idx ON public.expenses(expense_date);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view expenses they have financial access to" ON public.expenses
  FOR SELECT TO authenticated
  USING (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.can_view_financials(auth.uid(), user_id)
    AND public.has_permission(auth.uid(), user_id, 'invoices', 'read')
  );

CREATE POLICY "Users can create expenses they have financial access to" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.can_view_financials(auth.uid(), user_id)
    AND public.has_permission(auth.uid(), user_id, 'invoices', 'create')
  );

CREATE POLICY "Users can update expenses they have financial access to" ON public.expenses
  FOR UPDATE TO authenticated
  USING (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.can_view_financials(auth.uid(), user_id)
    AND public.has_permission(auth.uid(), user_id, 'invoices', 'update')
  );

CREATE POLICY "Users can delete expenses they have financial access to" ON public.expenses
  FOR DELETE TO authenticated
  USING (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.can_view_financials(auth.uid(), user_id)
    AND public.has_permission(auth.uid(), user_id, 'invoices', 'delete')
  );
