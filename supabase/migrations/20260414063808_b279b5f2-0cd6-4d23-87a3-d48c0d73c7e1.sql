
-- Recreate branding view WITH support_email and WITHOUT security_invoker
DROP VIEW IF EXISTS public.public_portfolio_branding;
CREATE VIEW public.public_portfolio_branding AS
SELECT 
  user_id,
  company_name,
  company_logo_url,
  tagline,
  primary_color,
  accent_color,
  website_url,
  support_email
FROM public.branding_settings;

-- Recreate clients view WITHOUT security_invoker
DROP VIEW IF EXISTS public.public_portfolio_clients;
CREATE VIEW public.public_portfolio_clients AS
SELECT c.id, c.client_name, c.company_name
FROM public.clients c
WHERE EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.client_id = c.id AND p.is_featured = true
);

-- Grant anon access to both views
GRANT SELECT ON public.public_portfolio_branding TO anon;
GRANT SELECT ON public.public_portfolio_clients TO anon;
