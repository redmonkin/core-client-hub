
-- ============================================================
-- Fix 1: Prevent password_hash exposure via a secure view
-- ============================================================

-- Create a view that excludes password_hash
CREATE VIEW public.proposal_access_tokens_safe AS
SELECT id, proposal_id, token, expires_at, viewed_at, created_at
FROM public.proposal_access_tokens;

-- Drop the old public SELECT policy that returned password_hash
DROP POLICY IF EXISTS "Anyone can view tokens by exact token match" ON public.proposal_access_tokens;

-- ============================================================
-- Fix 2: Tighten RLS policies from public to authenticated
-- ============================================================

-- templates
DROP POLICY IF EXISTS "Users can create their own templates" ON public.templates;
CREATE POLICY "Users can create their own templates" ON public.templates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own templates" ON public.templates;
CREATE POLICY "Users can delete their own templates" ON public.templates FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own templates" ON public.templates;
CREATE POLICY "Users can update their own templates" ON public.templates FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own templates" ON public.templates;
CREATE POLICY "Users can view their own templates" ON public.templates FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- client_contacts
DROP POLICY IF EXISTS "Users can create their own client contacts" ON public.client_contacts;
CREATE POLICY "Users can create their own client contacts" ON public.client_contacts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own client contacts" ON public.client_contacts;
CREATE POLICY "Users can delete their own client contacts" ON public.client_contacts FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own client contacts" ON public.client_contacts;
CREATE POLICY "Users can update their own client contacts" ON public.client_contacts FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own client contacts" ON public.client_contacts;
CREATE POLICY "Users can view their own client contacts" ON public.client_contacts FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- proposals
DROP POLICY IF EXISTS "Users can create their own proposals" ON public.proposals;
CREATE POLICY "Users can create their own proposals" ON public.proposals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own proposals" ON public.proposals;
CREATE POLICY "Users can delete their own proposals" ON public.proposals FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own proposals" ON public.proposals;
CREATE POLICY "Users can update their own proposals" ON public.proposals FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own proposals" ON public.proposals;
CREATE POLICY "Users can view their own proposals" ON public.proposals FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- clients
DROP POLICY IF EXISTS "Users can create their own clients" ON public.clients;
CREATE POLICY "Users can create their own clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own clients" ON public.clients;
CREATE POLICY "Users can delete their own clients" ON public.clients FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own clients" ON public.clients;
CREATE POLICY "Users can update their own clients" ON public.clients FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own clients" ON public.clients;
CREATE POLICY "Users can view their own clients" ON public.clients FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- contracts
DROP POLICY IF EXISTS "Users can create their own contracts" ON public.contracts;
CREATE POLICY "Users can create their own contracts" ON public.contracts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own contracts" ON public.contracts;
CREATE POLICY "Users can delete their own contracts" ON public.contracts FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own contracts" ON public.contracts;
CREATE POLICY "Users can update their own contracts" ON public.contracts FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own contracts" ON public.contracts;
CREATE POLICY "Users can view their own contracts" ON public.contracts FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- projects
DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;
CREATE POLICY "Users can create their own projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;
CREATE POLICY "Users can delete their own projects" ON public.projects FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
CREATE POLICY "Users can update their own projects" ON public.projects FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
CREATE POLICY "Users can view their own projects" ON public.projects FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- notifications
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- notification_preferences
DROP POLICY IF EXISTS "Users can create their own preferences" ON public.notification_preferences;
CREATE POLICY "Users can create their own preferences" ON public.notification_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own preferences" ON public.notification_preferences;
CREATE POLICY "Users can update their own preferences" ON public.notification_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own preferences" ON public.notification_preferences;
CREATE POLICY "Users can view their own preferences" ON public.notification_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- proposal_access_tokens (owner policies only - keep scoped to authenticated)
DROP POLICY IF EXISTS "Users can create tokens for their proposals" ON public.proposal_access_tokens;
CREATE POLICY "Users can create tokens for their proposals" ON public.proposal_access_tokens FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM proposals WHERE proposals.id = proposal_access_tokens.proposal_id AND proposals.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete tokens for their proposals" ON public.proposal_access_tokens;
CREATE POLICY "Users can delete tokens for their proposals" ON public.proposal_access_tokens FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM proposals WHERE proposals.id = proposal_access_tokens.proposal_id AND proposals.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view tokens for their proposals" ON public.proposal_access_tokens;
CREATE POLICY "Users can view tokens for their proposals" ON public.proposal_access_tokens FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM proposals WHERE proposals.id = proposal_access_tokens.proposal_id AND proposals.user_id = auth.uid()));

-- branding_settings
DROP POLICY IF EXISTS "Users can create their own branding settings" ON public.branding_settings;
CREATE POLICY "Users can create their own branding settings" ON public.branding_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own branding settings" ON public.branding_settings;
CREATE POLICY "Users can delete their own branding settings" ON public.branding_settings FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own branding settings" ON public.branding_settings;
CREATE POLICY "Users can update their own branding settings" ON public.branding_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own branding settings" ON public.branding_settings;
CREATE POLICY "Users can view their own branding settings" ON public.branding_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- Fix 3: Strengthen proposal_status_history INSERT policy
-- ============================================================

DROP POLICY IF EXISTS "Users can insert history for their proposals" ON public.proposal_status_history;
CREATE POLICY "Users can insert history for their proposals" ON public.proposal_status_history FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_status_history.proposal_id AND proposals.user_id = auth.uid()
  )
);
