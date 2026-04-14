
-- 1. Fix client PII exposure: drop broad anon policy, create safe view
DROP POLICY IF EXISTS "Anyone can view clients of featured projects" ON public.clients;

CREATE OR REPLACE VIEW public.public_portfolio_clients AS
SELECT c.id, c.client_name, c.company_name
FROM public.clients c
WHERE EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.client_id = c.id AND p.is_featured = true
);

GRANT SELECT ON public.public_portfolio_clients TO anon;
GRANT SELECT ON public.public_portfolio_clients TO authenticated;

-- 2. Fix branding settings: drop broad anon policy, create safe view
DROP POLICY IF EXISTS "Anyone can view branding settings for portfolio" ON public.branding_settings;

CREATE OR REPLACE VIEW public.public_portfolio_branding AS
SELECT user_id, company_name, company_logo_url, tagline, primary_color, accent_color, website_url
FROM public.branding_settings;

GRANT SELECT ON public.public_portfolio_branding TO anon;
GRANT SELECT ON public.public_portfolio_branding TO authenticated;

-- 3. Fix storage: drop broad SELECT and DELETE policies on project-files
DROP POLICY IF EXISTS "Authenticated users can view project files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own project files" ON storage.objects;
