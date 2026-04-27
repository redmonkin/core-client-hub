DROP VIEW IF EXISTS public.public_portfolio_branding CASCADE;
DROP VIEW IF EXISTS public.public_portfolio_clients CASCADE;
DROP VIEW IF EXISTS public.public_portfolio_projects CASCADE;

CREATE VIEW public.public_portfolio_branding
WITH (security_invoker = true) AS
SELECT user_id, slug, company_name, company_logo_url, tagline,
       primary_color, accent_color, website_url, support_email
FROM public.branding_settings
WHERE slug IS NOT NULL;

CREATE VIEW public.public_portfolio_projects
WITH (security_invoker = true) AS
SELECT id, user_id, project_name, project_type, status, feature_image_url, is_featured, client_id
FROM public.projects
WHERE is_featured = true;

CREATE VIEW public.public_portfolio_clients
WITH (security_invoker = true) AS
SELECT id, client_name, company_name
FROM public.clients
WHERE EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.client_id = clients.id AND p.is_featured = true
);

GRANT SELECT ON public.public_portfolio_branding TO anon, authenticated;
GRANT SELECT ON public.public_portfolio_projects TO anon, authenticated;
GRANT SELECT ON public.public_portfolio_clients TO anon, authenticated;

CREATE POLICY "Anon can read published portfolio branding"
  ON public.branding_settings FOR SELECT TO anon
  USING (slug IS NOT NULL);

CREATE POLICY "Anon can read featured projects for portfolio"
  ON public.projects FOR SELECT TO anon
  USING (is_featured = true);

CREATE POLICY "Anon can read companies of featured project clients"
  ON public.clients FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.client_id = clients.id AND p.is_featured = true
  ));

GRANT SELECT (user_id, slug, company_name, company_logo_url, tagline,
              primary_color, accent_color, website_url, support_email)
  ON public.branding_settings TO anon;
GRANT SELECT (id, user_id, project_name, project_type, status,
              feature_image_url, is_featured, client_id)
  ON public.projects TO anon;
GRANT SELECT (id, client_name, company_name)
  ON public.clients TO anon;

REVOKE EXECUTE ON FUNCTION public.get_accessible_user_ids(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_owner_id(uuid) FROM anon;