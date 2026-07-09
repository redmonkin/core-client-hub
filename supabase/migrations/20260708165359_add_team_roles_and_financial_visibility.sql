-- Team & Permissions: formalize team_members.role (currently unused, defaults to
-- 'member') into admin|editor|viewer, enforced at the RLS layer for writes only.
-- SELECT policies are intentionally left untouched -- viewer still reads everything,
-- matching today's "sees everything, just can't edit" model. Backfill preserves
-- today's full-access behavior exactly (zero behavior change on migration day).

UPDATE public.team_members SET role = 'editor' WHERE role = 'member';

ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_role_check CHECK (role IN ('admin', 'editor', 'viewer'));
ALTER TABLE public.team_members ALTER COLUMN role SET DEFAULT 'editor';

-- Financial visibility is a separate tier from role. Existing active members are
-- backfilled to `true` since today's behavior already shows them everything --
-- owners restrict it going forward per-invite/per-member.
ALTER TABLE public.team_members ADD COLUMN can_view_financials boolean NOT NULL DEFAULT true;

-- Returns the effective role of _user_id within _owner_id's workspace: 'owner' if
-- _user_id *is* the owner (not a team_members row for themselves), else the
-- team_members.role for an active membership, else NULL (no access -- the caller
-- of this function should already be gated by get_accessible_user_ids() upstream).
-- Deliberately not built on get_accessible_user_ids()/get_owner_id() -- those
-- answer "what user_ids can I see rows for", which is a different question from
-- "what is my permission level within a specific workspace".
CREATE OR REPLACE FUNCTION public.get_workspace_role(_user_id uuid, _owner_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _user_id = _owner_id THEN 'owner'
    ELSE (SELECT role FROM public.team_members
          WHERE member_id = _user_id AND owner_id = _owner_id AND status = 'active'
          LIMIT 1)
  END
$$;

REVOKE EXECUTE ON FUNCTION public.get_workspace_role(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_workspace_role(uuid, uuid) TO authenticated;

-- team_members: admins can also invite/remove team members (confirmed decision --
-- not owner-exclusive). get_workspace_role() is SECURITY DEFINER, so referencing
-- team_members inside a policy defined ON team_members does not recurse into RLS,
-- same as how get_accessible_user_ids()/get_owner_id() already do this safely.
DROP POLICY IF EXISTS "Owners can manage their team members" ON public.team_members;
CREATE POLICY "Owners and admins can manage their team members" ON public.team_members
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR public.get_workspace_role(auth.uid(), owner_id) = 'admin')
  WITH CHECK (auth.uid() = owner_id OR public.get_workspace_role(auth.uid(), owner_id) = 'admin');

-- clients
DROP POLICY IF EXISTS "Users can create their own clients" ON public.clients;
CREATE POLICY "Users can create their own clients" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );
DROP POLICY IF EXISTS "Users can update their own clients" ON public.clients;
CREATE POLICY "Users can update their own clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );
DROP POLICY IF EXISTS "Users can delete their own clients" ON public.clients;
CREATE POLICY "Users can delete their own clients" ON public.clients
  FOR DELETE TO authenticated
  USING (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );

-- projects
DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;
CREATE POLICY "Users can create their own projects" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
CREATE POLICY "Users can update their own projects" ON public.projects
  FOR UPDATE TO authenticated
  USING (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;
CREATE POLICY "Users can delete their own projects" ON public.projects
  FOR DELETE TO authenticated
  USING (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );

-- proposals
DROP POLICY IF EXISTS "Users can create their own proposals" ON public.proposals;
CREATE POLICY "Users can create their own proposals" ON public.proposals
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );
DROP POLICY IF EXISTS "Users can update their own proposals" ON public.proposals;
CREATE POLICY "Users can update their own proposals" ON public.proposals
  FOR UPDATE TO authenticated
  USING (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );
DROP POLICY IF EXISTS "Users can delete their own proposals" ON public.proposals;
CREATE POLICY "Users can delete their own proposals" ON public.proposals
  FOR DELETE TO authenticated
  USING (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );

-- contracts
DROP POLICY IF EXISTS "Users can create their own contracts" ON public.contracts;
CREATE POLICY "Users can create their own contracts" ON public.contracts
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );
DROP POLICY IF EXISTS "Users can update their own contracts" ON public.contracts;
CREATE POLICY "Users can update their own contracts" ON public.contracts
  FOR UPDATE TO authenticated
  USING (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );
DROP POLICY IF EXISTS "Users can delete their own contracts" ON public.contracts;
CREATE POLICY "Users can delete their own contracts" ON public.contracts
  FOR DELETE TO authenticated
  USING (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );

-- templates
DROP POLICY IF EXISTS "Users can create their own templates" ON public.templates;
CREATE POLICY "Users can create their own templates" ON public.templates
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );
DROP POLICY IF EXISTS "Users can update their own templates" ON public.templates;
CREATE POLICY "Users can update their own templates" ON public.templates
  FOR UPDATE TO authenticated
  USING (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );
DROP POLICY IF EXISTS "Users can delete their own templates" ON public.templates;
CREATE POLICY "Users can delete their own templates" ON public.templates
  FOR DELETE TO authenticated
  USING (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );

-- timesheets
DROP POLICY IF EXISTS "Users can create their own timesheets" ON public.timesheets;
CREATE POLICY "Users can create their own timesheets" ON public.timesheets
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );
DROP POLICY IF EXISTS "Users can update their own timesheets" ON public.timesheets;
CREATE POLICY "Users can update their own timesheets" ON public.timesheets
  FOR UPDATE TO authenticated
  USING (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );
DROP POLICY IF EXISTS "Users can delete their own timesheets" ON public.timesheets;
CREATE POLICY "Users can delete their own timesheets" ON public.timesheets
  FOR DELETE TO authenticated
  USING (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );

-- project_notes
DROP POLICY IF EXISTS "Users can create their own project notes" ON public.project_notes;
CREATE POLICY "Users can create their own project notes" ON public.project_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );
DROP POLICY IF EXISTS "Users can update their own project notes" ON public.project_notes;
CREATE POLICY "Users can update their own project notes" ON public.project_notes
  FOR UPDATE TO authenticated
  USING (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );
DROP POLICY IF EXISTS "Users can delete their own project notes" ON public.project_notes;
CREATE POLICY "Users can delete their own project notes" ON public.project_notes
  FOR DELETE TO authenticated
  USING (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );

-- client_contacts
DROP POLICY IF EXISTS "Users can create their own client contacts" ON public.client_contacts;
CREATE POLICY "Users can create their own client contacts" ON public.client_contacts
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );
DROP POLICY IF EXISTS "Users can update their own client contacts" ON public.client_contacts;
CREATE POLICY "Users can update their own client contacts" ON public.client_contacts
  FOR UPDATE TO authenticated
  USING (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );
DROP POLICY IF EXISTS "Users can delete their own client contacts" ON public.client_contacts;
CREATE POLICY "Users can delete their own client contacts" ON public.client_contacts
  FOR DELETE TO authenticated
  USING (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );
