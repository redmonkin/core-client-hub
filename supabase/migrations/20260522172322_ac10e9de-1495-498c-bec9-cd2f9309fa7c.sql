-- Revert the portfolio view to standard security_invoker so it inherits caller's RLS.
DROP VIEW IF EXISTS public.public_portfolio_projects;
CREATE VIEW public.public_portfolio_projects
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.user_id,
  p.project_name,
  p.project_type,
  p.status,
  p.feature_image_url,
  p.is_featured,
  p.client_id
FROM public.projects p
WHERE p.is_featured = true;

GRANT SELECT ON public.public_portfolio_projects TO anon, authenticated;

-- Re-add the anon SELECT policy on the projects table (RLS will gate row access).
CREATE POLICY "Anon can read featured projects for portfolio"
ON public.projects
FOR SELECT
TO anon
USING (
  is_featured = true
  AND EXISTS (
    SELECT 1 FROM public.branding_settings b
    WHERE b.user_id = projects.user_id AND b.slug IS NOT NULL
  )
);

-- Lock down which columns anon can read. start_date, end_date, created_at, updated_at
-- are excluded so business-sensitive timing data never leaves the server.
REVOKE SELECT ON public.projects FROM anon;
GRANT SELECT (
  id, user_id, project_name, project_type, status,
  feature_image_url, is_featured, client_id
) ON public.projects TO anon;