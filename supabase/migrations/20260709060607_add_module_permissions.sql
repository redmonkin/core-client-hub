-- Team & Permissions v2: replace the single admin|editor|viewer role gate with a
-- per-module CRUD permission matrix (create/read/update/delete independently for
-- each of 8 modules), so a workspace owner can build custom access levels instead
-- of being stuck with one of three fixed tiers. Role presets (admin/manager/
-- contributor/viewer) still exist as one-click templates that populate this
-- matrix, plus a 'custom' label for hand-edited members.
--
-- Read access is now permission-gated too (previously every active member, even
-- 'viewer', could read every table). Backfill below preserves each existing
-- member's *current* effective access exactly, so nobody loses or gains access on
-- migration day -- it just becomes representable as a matrix going forward.

CREATE TABLE public.team_member_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  module text NOT NULL CHECK (module IN ('clients', 'projects', 'proposals', 'contracts', 'templates', 'timesheets', 'invoices', 'notes')),
  can_create boolean NOT NULL DEFAULT false,
  can_read boolean NOT NULL DEFAULT false,
  can_update boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  UNIQUE(team_member_id, module)
);

CREATE INDEX team_member_permissions_team_member_id_idx ON public.team_member_permissions(team_member_id);

-- Widen the allowed role labels FIRST, then rename the old 'editor' label to
-- 'manager' (its exact permission equivalent -- full read/write on every
-- module) -- the constraint must accept 'manager' before anything is set to it.
ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_role_check;
ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_role_check CHECK (role IN ('admin', 'manager', 'contributor', 'viewer', 'custom', 'editor'));

UPDATE public.team_members SET role = 'manager' WHERE role = 'editor';

ALTER TABLE public.team_members DROP CONSTRAINT team_members_role_check;
ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_role_check CHECK (role IN ('admin', 'manager', 'contributor', 'viewer', 'custom'));
ALTER TABLE public.team_members ALTER COLUMN role SET DEFAULT 'manager';

-- Backfill: for every active team member, create one permission row per module
-- reproducing their old role's effective access exactly.
--   admin      -> full CRUD on everything (same as old 'admin')
--   manager    -> full CRUD on everything (same as old 'editor')
--   viewer     -> read-only everywhere (same as old 'viewer')
-- invoices.can_read additionally respects each member's existing
-- can_view_financials value, so financial visibility doesn't silently change.
INSERT INTO public.team_member_permissions (team_member_id, module, can_create, can_read, can_update, can_delete)
SELECT
  tm.id,
  m.module,
  (tm.role IN ('admin', 'manager')) AS can_create,
  CASE WHEN m.module = 'invoices' THEN (tm.role IN ('admin', 'manager') AND tm.can_view_financials) OR (tm.role = 'viewer' AND tm.can_view_financials)
       ELSE true END AS can_read,
  (tm.role IN ('admin', 'manager')) AS can_update,
  (tm.role IN ('admin', 'manager')) AS can_delete
FROM public.team_members tm
CROSS JOIN (VALUES ('clients'), ('projects'), ('proposals'), ('contracts'), ('templates'), ('timesheets'), ('invoices'), ('notes')) AS m(module)
WHERE tm.status = 'active';

-- Returns whether _user_id has _action ('create'|'read'|'update'|'delete') on
-- _module within _owner_id's workspace. The workspace owner always has full
-- access; a team member's access comes from their team_member_permissions row.
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _owner_id uuid, _module text, _action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _user_id = _owner_id THEN true
    ELSE COALESCE(
      (SELECT CASE _action
         WHEN 'create' THEN tmp.can_create
         WHEN 'read' THEN tmp.can_read
         WHEN 'update' THEN tmp.can_update
         WHEN 'delete' THEN tmp.can_delete
         ELSE false
       END
       FROM public.team_member_permissions tmp
       JOIN public.team_members tm ON tm.id = tmp.team_member_id
       WHERE tm.member_id = _user_id AND tm.owner_id = _owner_id AND tm.status = 'active' AND tmp.module = _module
       LIMIT 1),
      false
    )
  END
$$;

REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, uuid, text, text) TO authenticated;

ALTER TABLE public.team_member_permissions ENABLE ROW LEVEL SECURITY;

-- A member can read their own permission matrix (needed client-side to know what
-- they're allowed to do); owners/admins can read/manage everyone's.
CREATE POLICY "Members can view their own permissions" ON public.team_member_permissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.id = team_member_permissions.team_member_id AND tm.member_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.id = team_member_permissions.team_member_id
      AND (tm.owner_id = auth.uid() OR public.get_workspace_role(auth.uid(), tm.owner_id) = 'admin')
    )
  );

CREATE POLICY "Owners and admins can manage team permissions" ON public.team_member_permissions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.id = team_member_permissions.team_member_id
      AND (tm.owner_id = auth.uid() OR public.get_workspace_role(auth.uid(), tm.owner_id) = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.id = team_member_permissions.team_member_id
      AND (tm.owner_id = auth.uid() OR public.get_workspace_role(auth.uid(), tm.owner_id) = 'admin')
    )
  );

-- Rewrite SELECT/INSERT/UPDATE/DELETE on every module table to use
-- has_permission() instead of the old single role-tier check. SELECT was
-- previously ungated for any active member; it is now gated on read permission.

-- clients
DROP POLICY IF EXISTS "Users can view their own clients" ON public.clients;
CREATE POLICY "Users can view their own clients" ON public.clients
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'clients', 'read'));
DROP POLICY IF EXISTS "Users can create their own clients" ON public.clients;
CREATE POLICY "Users can create their own clients" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'clients', 'create'));
DROP POLICY IF EXISTS "Users can update their own clients" ON public.clients;
CREATE POLICY "Users can update their own clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'clients', 'update'));
DROP POLICY IF EXISTS "Users can delete their own clients" ON public.clients;
CREATE POLICY "Users can delete their own clients" ON public.clients
  FOR DELETE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'clients', 'delete'));

-- client_contacts (sub-resource of clients module)
DROP POLICY IF EXISTS "Users can view their own client contacts" ON public.client_contacts;
CREATE POLICY "Users can view their own client contacts" ON public.client_contacts
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'clients', 'read'));
DROP POLICY IF EXISTS "Users can create their own client contacts" ON public.client_contacts;
CREATE POLICY "Users can create their own client contacts" ON public.client_contacts
  FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'clients', 'create'));
DROP POLICY IF EXISTS "Users can update their own client contacts" ON public.client_contacts;
CREATE POLICY "Users can update their own client contacts" ON public.client_contacts
  FOR UPDATE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'clients', 'update'));
DROP POLICY IF EXISTS "Users can delete their own client contacts" ON public.client_contacts;
CREATE POLICY "Users can delete their own client contacts" ON public.client_contacts
  FOR DELETE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'clients', 'delete'));

-- projects
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
CREATE POLICY "Users can view their own projects" ON public.projects
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'projects', 'read'));
DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;
CREATE POLICY "Users can create their own projects" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'projects', 'create'));
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
CREATE POLICY "Users can update their own projects" ON public.projects
  FOR UPDATE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'projects', 'update'));
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;
CREATE POLICY "Users can delete their own projects" ON public.projects
  FOR DELETE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'projects', 'delete'));

-- proposals
DROP POLICY IF EXISTS "Users can view their own proposals" ON public.proposals;
CREATE POLICY "Users can view their own proposals" ON public.proposals
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'proposals', 'read'));
DROP POLICY IF EXISTS "Users can create their own proposals" ON public.proposals;
CREATE POLICY "Users can create their own proposals" ON public.proposals
  FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'proposals', 'create'));
DROP POLICY IF EXISTS "Users can update their own proposals" ON public.proposals;
CREATE POLICY "Users can update their own proposals" ON public.proposals
  FOR UPDATE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'proposals', 'update'));
DROP POLICY IF EXISTS "Users can delete their own proposals" ON public.proposals;
CREATE POLICY "Users can delete their own proposals" ON public.proposals
  FOR DELETE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'proposals', 'delete'));

-- contracts
DROP POLICY IF EXISTS "Users can view their own contracts" ON public.contracts;
CREATE POLICY "Users can view their own contracts" ON public.contracts
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'contracts', 'read'));
DROP POLICY IF EXISTS "Users can create their own contracts" ON public.contracts;
CREATE POLICY "Users can create their own contracts" ON public.contracts
  FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'contracts', 'create'));
DROP POLICY IF EXISTS "Users can update their own contracts" ON public.contracts;
CREATE POLICY "Users can update their own contracts" ON public.contracts
  FOR UPDATE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'contracts', 'update'));
DROP POLICY IF EXISTS "Users can delete their own contracts" ON public.contracts;
CREATE POLICY "Users can delete their own contracts" ON public.contracts
  FOR DELETE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'contracts', 'delete'));

-- templates
DROP POLICY IF EXISTS "Users can view their own templates" ON public.templates;
CREATE POLICY "Users can view their own templates" ON public.templates
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'templates', 'read'));
DROP POLICY IF EXISTS "Users can create their own templates" ON public.templates;
CREATE POLICY "Users can create their own templates" ON public.templates
  FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'templates', 'create'));
DROP POLICY IF EXISTS "Users can update their own templates" ON public.templates;
CREATE POLICY "Users can update their own templates" ON public.templates
  FOR UPDATE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'templates', 'update'));
DROP POLICY IF EXISTS "Users can delete their own templates" ON public.templates;
CREATE POLICY "Users can delete their own templates" ON public.templates
  FOR DELETE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'templates', 'delete'));

-- timesheets
DROP POLICY IF EXISTS "Users can view their own timesheets" ON public.timesheets;
CREATE POLICY "Users can view their own timesheets" ON public.timesheets
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'timesheets', 'read'));
DROP POLICY IF EXISTS "Users can create their own timesheets" ON public.timesheets;
CREATE POLICY "Users can create their own timesheets" ON public.timesheets
  FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'timesheets', 'create'));
DROP POLICY IF EXISTS "Users can update their own timesheets" ON public.timesheets;
CREATE POLICY "Users can update their own timesheets" ON public.timesheets
  FOR UPDATE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'timesheets', 'update'));
DROP POLICY IF EXISTS "Users can delete their own timesheets" ON public.timesheets;
CREATE POLICY "Users can delete their own timesheets" ON public.timesheets
  FOR DELETE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'timesheets', 'delete'));

-- project_notes (module: 'notes')
DROP POLICY IF EXISTS "Users can view their own project notes" ON public.project_notes;
CREATE POLICY "Users can view their own project notes" ON public.project_notes
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'notes', 'read'));
DROP POLICY IF EXISTS "Users can create their own project notes" ON public.project_notes;
CREATE POLICY "Users can create their own project notes" ON public.project_notes
  FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'notes', 'create'));
DROP POLICY IF EXISTS "Users can update their own project notes" ON public.project_notes;
CREATE POLICY "Users can update their own project notes" ON public.project_notes
  FOR UPDATE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'notes', 'update'));
DROP POLICY IF EXISTS "Users can delete their own project notes" ON public.project_notes;
CREATE POLICY "Users can delete their own project notes" ON public.project_notes
  FOR DELETE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'notes', 'delete'));

-- invoices
DROP POLICY IF EXISTS "Users can view their own invoices" ON public.invoices;
CREATE POLICY "Users can view their own invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'invoices', 'read'));
DROP POLICY IF EXISTS "Users can create their own invoices" ON public.invoices;
CREATE POLICY "Users can create their own invoices" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'invoices', 'create'));
DROP POLICY IF EXISTS "Users can update their own invoices" ON public.invoices;
CREATE POLICY "Users can update their own invoices" ON public.invoices
  FOR UPDATE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'invoices', 'update'));
DROP POLICY IF EXISTS "Users can delete their own invoices" ON public.invoices;
CREATE POLICY "Users can delete their own invoices" ON public.invoices
  FOR DELETE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())) AND public.has_permission(auth.uid(), user_id, 'invoices', 'delete'));

-- invoice_amounts: financial-visibility boundary is orthogonal to module CRUD --
-- a member needs BOTH module-level 'invoices' access AND can_view_financials.
DROP POLICY IF EXISTS "Users can view invoice amounts they have financial access to" ON public.invoice_amounts;
CREATE POLICY "Users can view invoice amounts they have financial access to" ON public.invoice_amounts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_amounts.invoice_id
    AND i.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.has_permission(auth.uid(), i.user_id, 'invoices', 'read')
    AND public.can_view_financials(auth.uid(), i.user_id)
  ));
DROP POLICY IF EXISTS "Users can create invoice amounts they have financial access to" ON public.invoice_amounts;
CREATE POLICY "Users can create invoice amounts they have financial access to" ON public.invoice_amounts
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_amounts.invoice_id
    AND i.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.has_permission(auth.uid(), i.user_id, 'invoices', 'create')
    AND public.can_view_financials(auth.uid(), i.user_id)
  ));
DROP POLICY IF EXISTS "Users can update invoice amounts they have financial access to" ON public.invoice_amounts;
CREATE POLICY "Users can update invoice amounts they have financial access to" ON public.invoice_amounts
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_amounts.invoice_id
    AND i.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.has_permission(auth.uid(), i.user_id, 'invoices', 'update')
    AND public.can_view_financials(auth.uid(), i.user_id)
  ));
DROP POLICY IF EXISTS "Users can delete invoice amounts they have financial access to" ON public.invoice_amounts;
CREATE POLICY "Users can delete invoice amounts they have financial access to" ON public.invoice_amounts
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_amounts.invoice_id
    AND i.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.has_permission(auth.uid(), i.user_id, 'invoices', 'delete')
    AND public.can_view_financials(auth.uid(), i.user_id)
  ));

-- invoice_access_tokens: creating/revoking a share link is treated as an
-- 'update' action on the invoice it belongs to.
DROP POLICY IF EXISTS "Users can create tokens for their invoices" ON public.invoice_access_tokens;
CREATE POLICY "Users can create tokens for their invoices" ON public.invoice_access_tokens
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.invoices
    WHERE invoices.id = invoice_access_tokens.invoice_id
    AND invoices.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.has_permission(auth.uid(), invoices.user_id, 'invoices', 'update')
  ));
DROP POLICY IF EXISTS "Users can delete tokens for their invoices" ON public.invoice_access_tokens;
CREATE POLICY "Users can delete tokens for their invoices" ON public.invoice_access_tokens
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices
    WHERE invoices.id = invoice_access_tokens.invoice_id
    AND invoices.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.has_permission(auth.uid(), invoices.user_id, 'invoices', 'update')
  ));

-- document_comments: reading a document's comments requires 'read' permission on
-- its module; posting requires 'update' (viewer/read-only members stay blocked).
DROP POLICY IF EXISTS "Users can view comments on their documents" ON public.document_comments;
CREATE POLICY "Users can view comments on their documents" ON public.document_comments
  FOR SELECT TO authenticated
  USING (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.has_permission(
      auth.uid(), user_id,
      CASE document_type WHEN 'proposal' THEN 'proposals' WHEN 'contract' THEN 'contracts' WHEN 'invoice' THEN 'invoices' END,
      'read'
    )
  );

DROP POLICY IF EXISTS "Team members can add comments to their documents" ON public.document_comments;
CREATE POLICY "Team members can add comments to their documents" ON public.document_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.has_permission(
      auth.uid(), user_id,
      CASE document_type WHEN 'proposal' THEN 'proposals' WHEN 'contract' THEN 'contracts' WHEN 'invoice' THEN 'invoices' END,
      'update'
    )
  );
