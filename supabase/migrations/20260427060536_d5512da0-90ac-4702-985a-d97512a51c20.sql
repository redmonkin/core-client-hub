-- Add columns for uploaded external contract files
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_type TEXT,
  ADD COLUMN IF NOT EXISTS is_external BOOLEAN NOT NULL DEFAULT false;

-- Create storage bucket for contract files
INSERT INTO storage.buckets (id, name, public)
VALUES ('contract-files', 'contract-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: users can manage files in their own folder (folder = user_id)
CREATE POLICY "Users can view their own contract files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'contract-files'
  AND (storage.foldername(name))[1] IN (
    SELECT get_accessible_user_ids(auth.uid())::text
  )
);

CREATE POLICY "Users can upload their own contract files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'contract-files'
  AND (storage.foldername(name))[1] IN (
    SELECT get_accessible_user_ids(auth.uid())::text
  )
);

CREATE POLICY "Users can update their own contract files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'contract-files'
  AND (storage.foldername(name))[1] IN (
    SELECT get_accessible_user_ids(auth.uid())::text
  )
);

CREATE POLICY "Users can delete their own contract files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'contract-files'
  AND (storage.foldername(name))[1] IN (
    SELECT get_accessible_user_ids(auth.uid())::text
  )
);