-- Only accounts that have confirmed their email count toward the free
-- workspace limit, so sign-ups with made-up addresses can't use up the
-- free seats. (With "Confirm email" off in Supabase Auth, accounts are
-- confirmed at sign-up and every account counts, as before.)
CREATE OR REPLACE FUNCTION public.workspace_count()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM auth.users u
  WHERE u.email_confirmed_at IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.team_members t
      WHERE t.member_id = u.id AND t.status = 'active'
    )
$$;

REVOKE EXECUTE ON FUNCTION public.workspace_count() FROM PUBLIC, anon, authenticated;
