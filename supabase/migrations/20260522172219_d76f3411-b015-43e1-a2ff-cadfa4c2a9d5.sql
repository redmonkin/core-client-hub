-- 1. Revoke SELECT on password_hash columns so the hash never leaves the server.
REVOKE SELECT (password_hash) ON public.proposal_access_tokens FROM anon, authenticated;
REVOKE SELECT (password_hash) ON public.contract_access_tokens FROM anon, authenticated;

-- 2. Drop the anonymous SELECT policy on the projects table.
--    The public portfolio uses public.public_portfolio_projects view instead.
DROP POLICY IF EXISTS "Anon can read featured projects for portfolio" ON public.projects;

-- 3. Recreate the portfolio view as a security-definer view (security_invoker=false)
--    so anon can SELECT only the safe columns even though the base table has no anon policy.
--    Restrict to projects owned by users who have published a portfolio slug.
DROP VIEW IF EXISTS public.public_portfolio_projects;
CREATE VIEW public.public_portfolio_projects
WITH (security_invoker = false) AS
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
WHERE p.is_featured = true
  AND EXISTS (
    SELECT 1 FROM public.branding_settings b
    WHERE b.user_id = p.user_id AND b.slug IS NOT NULL
  );

GRANT SELECT ON public.public_portfolio_projects TO anon, authenticated;