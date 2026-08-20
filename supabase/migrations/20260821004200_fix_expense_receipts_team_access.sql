-- expense-receipts storage policies only checked auth.uid() against the
-- folder name, and the client uploaded receipts under the uploading user's
-- own id rather than the workspace owner's. That meant a team member's
-- uploaded receipt lived in a folder the owner (and other team members)
-- couldn't read, and uploads would fail once the client-side path is fixed
-- to point at the workspace owner (see Expenses.tsx). Switch to the same
-- get_accessible_user_ids() pattern already used for project-attachments
-- and contract-files.

DROP POLICY IF EXISTS "Users can upload their own expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own expense receipts" ON storage.objects;

CREATE POLICY "Users can view their workspace expense receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND (storage.foldername(name))[1] IN (
    SELECT get_accessible_user_ids(auth.uid())::text
  )
);

CREATE POLICY "Users can upload their workspace expense receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'expense-receipts'
  AND (storage.foldername(name))[1] IN (
    SELECT get_accessible_user_ids(auth.uid())::text
  )
);

CREATE POLICY "Users can update their workspace expense receipts"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND (storage.foldername(name))[1] IN (
    SELECT get_accessible_user_ids(auth.uid())::text
  )
);

CREATE POLICY "Users can delete their workspace expense receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND (storage.foldername(name))[1] IN (
    SELECT get_accessible_user_ids(auth.uid())::text
  )
);
