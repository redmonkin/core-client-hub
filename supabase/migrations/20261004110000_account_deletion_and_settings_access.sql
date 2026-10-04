-- delete-account used to remove only 7 tables, leaving invoices, bank details
-- (invoice_settings), templates, branding, expenses and team rows behind after
-- a user deleted their account. This deletes everything the user owns in one
-- transaction. Every public table keyed by user_id is swept (so tables added
-- later are covered too); child rows without a user_id go via ON DELETE
-- CASCADE / SET NULL from their parents. Storage files are removed by the
-- edge function.
CREATE OR REPLACE FUNCTION public.delete_user_data(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _table text;
BEGIN
  -- Workspaces they own lose their team; workspaces they belong to lose them.
  DELETE FROM public.team_members WHERE owner_id = p_user_id OR member_id = p_user_id;
  -- Tasks assigned to them in someone else's workspace stay, unassigned.
  UPDATE public.timesheets SET assignee_user_id = NULL
  WHERE assignee_user_id = p_user_id AND user_id <> p_user_id;
  DELETE FROM public.portfolio_onboard_submissions WHERE owner_id = p_user_id;

  FOR _table IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'user_id'
      AND t.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', _table) USING p_user_id;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_user_data(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_data(uuid) TO service_role;

-- invoice_settings holds the bank account, IFSC, PAN and UPI id. Any team
-- member could read it, including members with no access to invoices. The
-- details are printed on every invoice, so anyone who can read invoices still
-- sees them; everyone else no longer does. Owners/admins keep full access via
-- "Owners and admins can manage invoice settings".
DROP POLICY IF EXISTS "Users can view their workspace invoice settings" ON public.invoice_settings;
CREATE POLICY "Users can view their workspace invoice settings" ON public.invoice_settings
  FOR SELECT TO authenticated
  USING (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.has_permission(auth.uid(), user_id, 'invoices', 'read')
  );
