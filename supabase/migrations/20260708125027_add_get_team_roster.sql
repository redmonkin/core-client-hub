-- Returns the full workspace roster (the workspace owner plus all their active team
-- members), regardless of whether the caller is the owner or a member, so the client
-- can offer a dropdown of real users instead of a free-text field (e.g. timesheet
-- entry ownership). get_accessible_user_ids() is not used here — it answers a
-- different question ("what user_ids can I see rows for"), which for an owner is
-- just themselves, not their team.
CREATE OR REPLACE FUNCTION public.get_team_roster()
RETURNS TABLE (user_id uuid, email text, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH workspace_owner AS (
    SELECT public.get_owner_id(auth.uid()) AS owner_id
  ),
  roster_ids AS (
    SELECT owner_id AS id FROM workspace_owner
    UNION
    SELECT tm.member_id FROM public.team_members tm, workspace_owner wo
    WHERE tm.owner_id = wo.owner_id AND tm.status = 'active' AND tm.member_id IS NOT NULL
  )
  SELECT
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)) AS full_name
  FROM auth.users u
  JOIN roster_ids r ON r.id = u.id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_team_roster() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_roster() TO authenticated;
