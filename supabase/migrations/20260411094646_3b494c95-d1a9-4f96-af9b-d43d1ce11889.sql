
-- Storage policies for project-files bucket
CREATE POLICY "Users can upload project files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'project-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their project files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'project-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their project files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'project-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their project files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'project-files' AND auth.uid()::text = (storage.foldername(name))[1]);
