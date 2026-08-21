-- An expense can be tagged against one or more projects (e.g. a shared AWS
-- bill split across projects, or a contractor cost tied to a specific
-- engagement), without expenses becoming per-project billable-expense
-- tracking -- it's still the same standalone ledger, just optionally
-- cross-referenced to projects for reporting/filtering.

CREATE TABLE public.expense_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (expense_id, project_id)
);

CREATE INDEX expense_projects_expense_id_idx ON public.expense_projects(expense_id);
CREATE INDEX expense_projects_project_id_idx ON public.expense_projects(project_id);

ALTER TABLE public.expense_projects ENABLE ROW LEVEL SECURITY;

-- Mirrors the expenses table's own policies (same financial-visibility +
-- 'invoices' module permission gate) via a join to the owning expense,
-- since this table has no user_id column of its own.
CREATE POLICY "Users can view expense-project tags they have financial access to" ON public.expense_projects
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_projects.expense_id
        AND e.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
        AND public.can_view_financials(auth.uid(), e.user_id)
        AND public.has_permission(auth.uid(), e.user_id, 'invoices', 'read')
    )
  );

CREATE POLICY "Users can create expense-project tags they have financial access to" ON public.expense_projects
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_projects.expense_id
        AND e.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
        AND public.can_view_financials(auth.uid(), e.user_id)
        AND public.has_permission(auth.uid(), e.user_id, 'invoices', 'create')
    )
  );

CREATE POLICY "Users can delete expense-project tags they have financial access to" ON public.expense_projects
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_projects.expense_id
        AND e.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
        AND public.can_view_financials(auth.uid(), e.user_id)
        AND public.has_permission(auth.uid(), e.user_id, 'invoices', 'delete')
    )
  );
