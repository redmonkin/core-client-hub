-- Collaboration & Client Experience: drawn signature capture + append-only
-- document comments.

-- 1. Signature capture ------------------------------------------------------

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS client_signature_image_url text,
  ADD COLUMN IF NOT EXISTS client_signature_captured_at timestamptz;

INSERT INTO storage.buckets (id, name, public)
VALUES ('signatures', 'signatures', false)
ON CONFLICT (id) DO NOTHING;

-- Mirrors the contract-files bucket policy pattern: folder-per-owner, read
-- access via get_accessible_user_ids(). Uploads happen server-side through
-- the client-portal edge function (service role, bypasses RLS) since the
-- client signing a contract has no Supabase session — these authenticated
-- policies exist for the owner's app to view/manage the resulting file.
CREATE POLICY "Users can view their own signature files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'signatures'
  AND (storage.foldername(name))[1] IN (
    SELECT get_accessible_user_ids(auth.uid())::text
  )
);

CREATE POLICY "Users can delete their own signature files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'signatures'
  AND (storage.foldername(name))[1] IN (
    SELECT get_accessible_user_ids(auth.uid())::text
  )
);

-- 2. Append-only document comments ------------------------------------------

CREATE TABLE public.document_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, -- workspace owner (get_accessible_user_ids scope), not the author
  document_type text NOT NULL CHECK (document_type IN ('proposal', 'contract', 'invoice')),
  document_id uuid NOT NULL,
  author_type text NOT NULL CHECK (author_type IN ('client', 'team')),
  author_name text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX document_comments_document_idx ON public.document_comments(document_type, document_id);
CREATE INDEX document_comments_user_id_idx ON public.document_comments(user_id);

ALTER TABLE public.document_comments ENABLE ROW LEVEL SECURITY;

-- No UPDATE/DELETE policy — append-only, matching the existing
-- proposal_status_history/contract_status_history audit-trail tables.
-- No anon INSERT policy — client-authored comments go through the
-- client-portal edge function (service role), which resolves document_id
-- from the access token server-side rather than trusting client input.

CREATE POLICY "Users can view comments on their documents" ON public.document_comments
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

CREATE POLICY "Team members can add comments to their documents" ON public.document_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );

-- 3. Notification preference for new comments --------------------------------

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS comment_added boolean NOT NULL DEFAULT true;
