-- project_notes previously supported at most one file per note (single
-- file_url/file_name/file_type columns). This moves attachments to their own
-- one-to-many table so a note can carry multiple files. Existing single
-- attachments are copied over so nothing is lost; the legacy columns on
-- project_notes are left in place (unused going forward) rather than dropped,
-- since dropping them isn't necessary for this change and this repo has no
-- rollback tooling for destructive migrations.

CREATE TABLE public.project_note_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.project_notes(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX project_note_attachments_note_id_idx ON public.project_note_attachments(note_id);

INSERT INTO public.project_note_attachments (note_id, file_url, file_name, file_type)
SELECT id, file_url, COALESCE(file_name, 'attachment'), file_type
FROM public.project_notes
WHERE file_url IS NOT NULL;

ALTER TABLE public.project_note_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments on notes they can access" ON public.project_note_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_notes n
      WHERE n.id = project_note_attachments.note_id
      AND n.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    )
  );

CREATE POLICY "Users can add attachments on notes they can access" ON public.project_note_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_notes n
      WHERE n.id = project_note_attachments.note_id
      AND n.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    )
  );

CREATE POLICY "Users can delete attachments on notes they can access" ON public.project_note_attachments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_notes n
      WHERE n.id = project_note_attachments.note_id
      AND n.user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    )
  );
