-- Create a new private bucket for project note attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-attachments', 'project-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies: users can only access files within their own user-id folder
CREATE POLICY "Users can upload their own project attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'project-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own project attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'project-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own project attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'project-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own project attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'project-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);