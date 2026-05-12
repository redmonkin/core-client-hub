-- Add public sharing and creator name to templates
ALTER TABLE public.templates 
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS creator_name text;

CREATE INDEX IF NOT EXISTS idx_templates_is_public ON public.templates(is_public) WHERE is_public = true;

-- Allow any authenticated user to view templates marked as public
CREATE POLICY "Authenticated users can view public templates"
ON public.templates
FOR SELECT
TO authenticated
USING (is_public = true);
