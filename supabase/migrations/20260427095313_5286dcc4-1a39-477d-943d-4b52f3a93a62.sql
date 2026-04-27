-- 1. Recreate portfolio views as SECURITY DEFINER so anon does not need RLS on base tables
DROP VIEW IF EXISTS public.public_portfolio_branding CASCADE;
DROP VIEW IF EXISTS public.public_portfolio_clients CASCADE;
DROP VIEW IF EXISTS public.public_portfolio_projects CASCADE;

CREATE VIEW public.public_portfolio_branding
WITH (security_invoker = false) AS
SELECT user_id, slug, company_name, company_logo_url, tagline,
       primary_color, accent_color, website_url, support_email
FROM public.branding_settings
WHERE slug IS NOT NULL;

CREATE VIEW public.public_portfolio_projects
WITH (security_invoker = false) AS
SELECT id, user_id, project_name, project_type, status, feature_image_url, is_featured, client_id
FROM public.projects
WHERE is_featured = true;

CREATE VIEW public.public_portfolio_clients
WITH (security_invoker = false) AS
SELECT c.id, c.client_name, c.company_name
FROM public.clients c
WHERE EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.client_id = c.id AND p.is_featured = true
);

GRANT SELECT ON public.public_portfolio_branding TO anon, authenticated;
GRANT SELECT ON public.public_portfolio_projects TO anon, authenticated;
GRANT SELECT ON public.public_portfolio_clients TO anon, authenticated;

-- 2. Drop the broad anon SELECT policies + column grants on base tables.
DROP POLICY IF EXISTS "Anon can read clients linked to featured projects" ON public.clients;
DROP POLICY IF EXISTS "Anon can read featured projects for portfolio" ON public.projects;
DROP POLICY IF EXISTS "Anon can read published portfolio branding" ON public.branding_settings;

REVOKE SELECT ON public.clients FROM anon;
REVOKE SELECT ON public.projects FROM anon;
REVOKE SELECT ON public.branding_settings FROM anon;

-- 3. Lock down SECURITY DEFINER helpers: only authenticated users may call them
REVOKE EXECUTE ON FUNCTION public.get_accessible_user_ids(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_owner_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_accessible_user_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_id(uuid) TO authenticated;

-- 4. Make project-files bucket private
UPDATE storage.buckets SET public = false WHERE id = 'project-files';

-- Drop any stale public-read policies on project-files
DROP POLICY IF EXISTS "Public read project files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view project files" ON storage.objects;
DROP POLICY IF EXISTS "Public can read project files" ON storage.objects;
DROP POLICY IF EXISTS "Project files are publicly accessible" ON storage.objects;

-- Owner-scoped RLS so only the file owner (or teammates) can read/write their folder
DROP POLICY IF EXISTS "Users can view their own project files" ON storage.objects;
CREATE POLICY "Users can view their own project files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'project-files'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can upload their own project files" ON storage.objects;
CREATE POLICY "Users can upload their own project files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'project-files'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update their own project files" ON storage.objects;
CREATE POLICY "Users can update their own project files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'project-files'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete their own project files" ON storage.objects;
CREATE POLICY "Users can delete their own project files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'project-files'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );