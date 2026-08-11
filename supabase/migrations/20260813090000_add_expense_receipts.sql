-- Lets an expense carry one receipt file (photo/PDF of the receipt), stored
-- in its own private bucket following the same per-user-folder RLS pattern
-- used by project-attachments.

ALTER TABLE public.expenses
  ADD COLUMN receipt_url text,
  ADD COLUMN receipt_name text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-receipts', 'expense-receipts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload their own expense receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'expense-receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own expense receipts"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own expense receipts"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own expense receipts"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
