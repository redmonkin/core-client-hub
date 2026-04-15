
-- Step 1: Create team_members table
CREATE TABLE public.team_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  member_id uuid,
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'pending',
  invited_email text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(owner_id, invited_email)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Step 2: Security definer functions

-- Returns all user_ids this user can access (own + any owners they're a member of)
CREATE OR REPLACE FUNCTION public.get_accessible_user_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id
  UNION
  SELECT owner_id FROM public.team_members
  WHERE member_id = _user_id AND status = 'active'
$$;

-- Returns the workspace owner_id for inserts
CREATE OR REPLACE FUNCTION public.get_owner_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT owner_id FROM public.team_members
     WHERE member_id = _user_id AND status = 'active'
     LIMIT 1),
    _user_id
  )
$$;

-- Trigger function: when a new user signs up, activate any pending invitations
CREATE OR REPLACE FUNCTION public.activate_pending_team_invitations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.team_members
  SET member_id = NEW.id, status = 'active', updated_at = now()
  WHERE invited_email = NEW.email AND status = 'pending' AND member_id IS NULL;
  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users on insert
CREATE TRIGGER on_auth_user_created_activate_team
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.activate_pending_team_invitations();

-- Step 3: RLS policies for team_members
CREATE POLICY "Owners can manage their team members"
  ON public.team_members FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Members can view their own membership"
  ON public.team_members FOR SELECT
  TO authenticated
  USING (auth.uid() = member_id);

-- Step 4: Update RLS policies on all workspace tables

-- CLIENTS
DROP POLICY IF EXISTS "Users can view their own clients" ON public.clients;
CREATE POLICY "Users can view their own clients" ON public.clients
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can create their own clients" ON public.clients;
CREATE POLICY "Users can create their own clients" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their own clients" ON public.clients;
CREATE POLICY "Users can update their own clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own clients" ON public.clients;
CREATE POLICY "Users can delete their own clients" ON public.clients
  FOR DELETE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

-- PROJECTS
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
CREATE POLICY "Users can view their own projects" ON public.projects
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;
CREATE POLICY "Users can create their own projects" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
CREATE POLICY "Users can update their own projects" ON public.projects
  FOR UPDATE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;
CREATE POLICY "Users can delete their own projects" ON public.projects
  FOR DELETE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

-- PROPOSALS
DROP POLICY IF EXISTS "Users can view their own proposals" ON public.proposals;
CREATE POLICY "Users can view their own proposals" ON public.proposals
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can create their own proposals" ON public.proposals;
CREATE POLICY "Users can create their own proposals" ON public.proposals
  FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their own proposals" ON public.proposals;
CREATE POLICY "Users can update their own proposals" ON public.proposals
  FOR UPDATE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own proposals" ON public.proposals;
CREATE POLICY "Users can delete their own proposals" ON public.proposals
  FOR DELETE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

-- CONTRACTS
DROP POLICY IF EXISTS "Users can view their own contracts" ON public.contracts;
CREATE POLICY "Users can view their own contracts" ON public.contracts
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can create their own contracts" ON public.contracts;
CREATE POLICY "Users can create their own contracts" ON public.contracts
  FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their own contracts" ON public.contracts;
CREATE POLICY "Users can update their own contracts" ON public.contracts
  FOR UPDATE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own contracts" ON public.contracts;
CREATE POLICY "Users can delete their own contracts" ON public.contracts
  FOR DELETE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

-- TEMPLATES
DROP POLICY IF EXISTS "Users can view their own templates" ON public.templates;
CREATE POLICY "Users can view their own templates" ON public.templates
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can create their own templates" ON public.templates;
CREATE POLICY "Users can create their own templates" ON public.templates
  FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their own templates" ON public.templates;
CREATE POLICY "Users can update their own templates" ON public.templates
  FOR UPDATE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own templates" ON public.templates;
CREATE POLICY "Users can delete their own templates" ON public.templates
  FOR DELETE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

-- TIMESHEETS
DROP POLICY IF EXISTS "Users can view their own timesheets" ON public.timesheets;
CREATE POLICY "Users can view their own timesheets" ON public.timesheets
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can create their own timesheets" ON public.timesheets;
CREATE POLICY "Users can create their own timesheets" ON public.timesheets
  FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their own timesheets" ON public.timesheets;
CREATE POLICY "Users can update their own timesheets" ON public.timesheets
  FOR UPDATE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own timesheets" ON public.timesheets;
CREATE POLICY "Users can delete their own timesheets" ON public.timesheets
  FOR DELETE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

-- PROJECT_NOTES
DROP POLICY IF EXISTS "Users can view their own project notes" ON public.project_notes;
CREATE POLICY "Users can view their own project notes" ON public.project_notes
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can create their own project notes" ON public.project_notes;
CREATE POLICY "Users can create their own project notes" ON public.project_notes
  FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their own project notes" ON public.project_notes;
CREATE POLICY "Users can update their own project notes" ON public.project_notes
  FOR UPDATE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own project notes" ON public.project_notes;
CREATE POLICY "Users can delete their own project notes" ON public.project_notes
  FOR DELETE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

-- CLIENT_CONTACTS
DROP POLICY IF EXISTS "Users can view their own client contacts" ON public.client_contacts;
CREATE POLICY "Users can view their own client contacts" ON public.client_contacts
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can create their own client contacts" ON public.client_contacts;
CREATE POLICY "Users can create their own client contacts" ON public.client_contacts
  FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their own client contacts" ON public.client_contacts;
CREATE POLICY "Users can update their own client contacts" ON public.client_contacts
  FOR UPDATE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own client contacts" ON public.client_contacts;
CREATE POLICY "Users can delete their own client contacts" ON public.client_contacts
  FOR DELETE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

-- BRANDING_SETTINGS
DROP POLICY IF EXISTS "Users can view their own branding settings" ON public.branding_settings;
CREATE POLICY "Users can view their own branding settings" ON public.branding_settings
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can create their own branding settings" ON public.branding_settings;
CREATE POLICY "Users can create their own branding settings" ON public.branding_settings
  FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their own branding settings" ON public.branding_settings;
CREATE POLICY "Users can update their own branding settings" ON public.branding_settings
  FOR UPDATE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own branding settings" ON public.branding_settings;
CREATE POLICY "Users can delete their own branding settings" ON public.branding_settings
  FOR DELETE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

-- NOTIFICATION_PREFERENCES
DROP POLICY IF EXISTS "Users can view their own preferences" ON public.notification_preferences;
CREATE POLICY "Users can view their own preferences" ON public.notification_preferences
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can create their own preferences" ON public.notification_preferences;
CREATE POLICY "Users can create their own preferences" ON public.notification_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their own preferences" ON public.notification_preferences;
CREATE POLICY "Users can update their own preferences" ON public.notification_preferences
  FOR UPDATE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

-- NOTIFICATIONS
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications" ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

-- PROPOSAL_ACCESS_TOKENS
DROP POLICY IF EXISTS "Users can view tokens for their proposals" ON public.proposal_access_tokens;
CREATE POLICY "Users can view tokens for their proposals" ON public.proposal_access_tokens
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM proposals WHERE proposals.id = proposal_access_tokens.proposal_id AND proposals.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))));

DROP POLICY IF EXISTS "Users can create tokens for their proposals" ON public.proposal_access_tokens;
CREATE POLICY "Users can create tokens for their proposals" ON public.proposal_access_tokens
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM proposals WHERE proposals.id = proposal_access_tokens.proposal_id AND proposals.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))));

DROP POLICY IF EXISTS "Users can delete tokens for their proposals" ON public.proposal_access_tokens;
CREATE POLICY "Users can delete tokens for their proposals" ON public.proposal_access_tokens
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM proposals WHERE proposals.id = proposal_access_tokens.proposal_id AND proposals.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))));

-- CONTRACT_ACCESS_TOKENS
DROP POLICY IF EXISTS "Users can view tokens for their contracts" ON public.contract_access_tokens;
CREATE POLICY "Users can view tokens for their contracts" ON public.contract_access_tokens
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM contracts WHERE contracts.id = contract_access_tokens.contract_id AND contracts.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))));

DROP POLICY IF EXISTS "Users can create tokens for their contracts" ON public.contract_access_tokens;
CREATE POLICY "Users can create tokens for their contracts" ON public.contract_access_tokens
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM contracts WHERE contracts.id = contract_access_tokens.contract_id AND contracts.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))));

DROP POLICY IF EXISTS "Users can delete tokens for their contracts" ON public.contract_access_tokens;
CREATE POLICY "Users can delete tokens for their contracts" ON public.contract_access_tokens
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM contracts WHERE contracts.id = contract_access_tokens.contract_id AND contracts.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))));

-- PROPOSAL_STATUS_HISTORY
DROP POLICY IF EXISTS "Users can view history for their proposals" ON public.proposal_status_history;
CREATE POLICY "Users can view history for their proposals" ON public.proposal_status_history
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM proposals WHERE proposals.id = proposal_status_history.proposal_id AND proposals.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))));

DROP POLICY IF EXISTS "Users can insert history for their proposals" ON public.proposal_status_history;
CREATE POLICY "Users can insert history for their proposals" ON public.proposal_status_history
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM proposals WHERE proposals.id = proposal_status_history.proposal_id AND proposals.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))));

-- CONTRACT_STATUS_HISTORY
DROP POLICY IF EXISTS "Users can view history for their contracts" ON public.contract_status_history;
CREATE POLICY "Users can view history for their contracts" ON public.contract_status_history
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM contracts WHERE contracts.id = contract_status_history.contract_id AND contracts.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))));

DROP POLICY IF EXISTS "Users can insert history for their contracts" ON public.contract_status_history;
CREATE POLICY "Users can insert history for their contracts" ON public.contract_status_history
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM contracts WHERE contracts.id = contract_status_history.contract_id AND contracts.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))));
