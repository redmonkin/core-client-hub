
-- Remove broad anon SELECT on branding_settings; public access happens via public_portfolio_branding view
DROP POLICY IF EXISTS "Anon can read branding for portfolio" ON public.branding_settings;
REVOKE SELECT ON public.branding_settings FROM anon;

-- Remove anon SELECT on projects; public access happens via public_portfolio_projects view
DROP POLICY IF EXISTS "Anon can view featured projects" ON public.projects;
REVOKE SELECT ON public.projects FROM anon;

-- Ensure public-facing views are readable by anon (they use security_invoker and filter to safe rows)
GRANT SELECT ON public.public_portfolio_branding TO anon, authenticated;
GRANT SELECT ON public.public_portfolio_projects TO anon, authenticated;
GRANT SELECT ON public.public_portfolio_clients TO anon, authenticated;

-- The underlying base tables need at least one row visible to anon for security_invoker views to return rows.
-- Re-add narrow, intentional anon policies that ONLY expose the rows the views are designed to surface,
-- and only for the columns the views select (the views project columns, but RLS still runs row-by-row).
CREATE POLICY "Anon can read published portfolio branding"
  ON public.branding_settings FOR SELECT TO anon
  USING (slug IS NOT NULL);

CREATE POLICY "Anon can read featured projects for portfolio"
  ON public.projects FOR SELECT TO anon
  USING (is_featured = true);

CREATE POLICY "Anon can read clients linked to featured projects"
  ON public.clients FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.client_id = clients.id AND p.is_featured = true
  ));

-- Re-grant base SELECT to anon so the security_invoker view can read rows it is designed to return.
GRANT SELECT (slug, company_name, company_logo_url, tagline, primary_color, accent_color, website_url, support_email, user_id)
  ON public.branding_settings TO anon;
GRANT SELECT (id, project_name, feature_image_url, is_featured, client_id, user_id)
  ON public.projects TO anon;
GRANT SELECT (id, client_name, company_name)
  ON public.clients TO anon;
