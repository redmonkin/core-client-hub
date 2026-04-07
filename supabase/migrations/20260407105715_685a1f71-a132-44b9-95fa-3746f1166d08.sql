
-- Add is_featured and feature_image_url to projects
ALTER TABLE public.projects 
  ADD COLUMN is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN feature_image_url text;

-- Allow anon to read branding_settings for public portfolio
CREATE POLICY "Anyone can view branding settings for portfolio"
  ON public.branding_settings
  FOR SELECT
  TO anon
  USING (true);

-- Allow anon to read featured projects for public portfolio
CREATE POLICY "Anyone can view featured projects"
  ON public.projects
  FOR SELECT
  TO anon
  USING (is_featured = true);

-- Allow anon to read client names for featured projects display
CREATE POLICY "Anyone can view clients of featured projects"
  ON public.clients
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.client_id = clients.id
        AND projects.is_featured = true
    )
  );
