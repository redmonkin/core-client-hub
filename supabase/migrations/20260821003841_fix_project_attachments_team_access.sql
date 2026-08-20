-- project-attachments storage policies only checked auth.uid() against the
-- folder name, but note uploads are written under the workspace owner's id
-- (see ProjectNotes.tsx). That made uploads/reads fail for team members
-- acting in an owner's workspace. Switch to the same get_accessible_user_ids()
-- pattern already used for the contract-files bucket.

DROP POLICY IF EXISTS "Users can upload their own project attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own project attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own project attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own project attachments" ON storage.objects;

CREATE POLICY "Users can view their workspace project attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-attachments'
  AND (storage.foldername(name))[1] IN (
    SELECT get_accessible_user_ids(auth.uid())::text
  )
);

CREATE POLICY "Users can upload their workspace project attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-attachments'
  AND (storage.foldername(name))[1] IN (
    SELECT get_accessible_user_ids(auth.uid())::text
  )
);

CREATE POLICY "Users can update their workspace project attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'project-attachments'
  AND (storage.foldername(name))[1] IN (
    SELECT get_accessible_user_ids(auth.uid())::text
  )
);

CREATE POLICY "Users can delete their workspace project attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-attachments'
  AND (storage.foldername(name))[1] IN (
    SELECT get_accessible_user_ids(auth.uid())::text
  )
);
