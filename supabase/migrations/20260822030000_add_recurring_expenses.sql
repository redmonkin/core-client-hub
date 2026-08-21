-- Recurring expenses: a schedule/template (category, vendor, amount,
-- cadence, optionally tagged projects) that a cron-triggered edge function
-- turns into ordinary rows in `expenses` on each run date. Mirrors
-- recurring_invoices exactly -- same frequency/day-of-month/next-run-date
-- shape -- minus anything email-related, since expenses have no client to
-- send to.

CREATE TABLE public.recurring_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'other',
  vendor text,
  description text,
  amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  notes text,
  frequency text NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'yearly')),
  day_of_month integer NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  start_date date NOT NULL,
  next_run_date date NOT NULL,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  last_generated_expense_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TRIGGER update_recurring_expenses_updated_at
BEFORE UPDATE ON public.recurring_expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX recurring_expenses_user_id_idx ON public.recurring_expenses(user_id);
CREATE INDEX recurring_expenses_due_idx ON public.recurring_expenses(next_run_date) WHERE is_active;

ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view recurring expenses they have financial access to" ON public.recurring_expenses
  FOR SELECT TO authenticated
  USING (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.can_view_financials(auth.uid(), user_id)
    AND public.has_permission(auth.uid(), user_id, 'invoices', 'read')
  );

CREATE POLICY "Users can create recurring expenses they have financial access to" ON public.recurring_expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.can_view_financials(auth.uid(), user_id)
    AND public.has_permission(auth.uid(), user_id, 'invoices', 'create')
  );

CREATE POLICY "Users can update recurring expenses they have financial access to" ON public.recurring_expenses
  FOR UPDATE TO authenticated
  USING (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.can_view_financials(auth.uid(), user_id)
    AND public.has_permission(auth.uid(), user_id, 'invoices', 'update')
  );

CREATE POLICY "Users can delete recurring expenses they have financial access to" ON public.recurring_expenses
  FOR DELETE TO authenticated
  USING (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.can_view_financials(auth.uid(), user_id)
    AND public.has_permission(auth.uid(), user_id, 'invoices', 'delete')
  );

-- Which project(s) each generated expense should be tagged with -- copied
-- into expense_projects for the new expense row on every run.
CREATE TABLE public.recurring_expense_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_expense_id uuid NOT NULL REFERENCES public.recurring_expenses(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recurring_expense_id, project_id)
);

CREATE INDEX recurring_expense_projects_recurring_expense_id_idx ON public.recurring_expense_projects(recurring_expense_id);

ALTER TABLE public.recurring_expense_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view recurring expense-project tags they have financial access to" ON public.recurring_expense_projects
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recurring_expenses re
      WHERE re.id = recurring_expense_projects.recurring_expense_id
        AND re.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
        AND public.can_view_financials(auth.uid(), re.user_id)
        AND public.has_permission(auth.uid(), re.user_id, 'invoices', 'read')
    )
  );

CREATE POLICY "Users can create recurring expense-project tags they have financial access to" ON public.recurring_expense_projects
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recurring_expenses re
      WHERE re.id = recurring_expense_projects.recurring_expense_id
        AND re.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
        AND public.can_view_financials(auth.uid(), re.user_id)
        AND public.has_permission(auth.uid(), re.user_id, 'invoices', 'create')
    )
  );

CREATE POLICY "Users can delete recurring expense-project tags they have financial access to" ON public.recurring_expense_projects
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recurring_expenses re
      WHERE re.id = recurring_expense_projects.recurring_expense_id
        AND re.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
        AND public.can_view_financials(auth.uid(), re.user_id)
        AND public.has_permission(auth.uid(), re.user_id, 'invoices', 'delete')
    )
  );
