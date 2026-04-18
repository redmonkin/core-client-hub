DROP VIEW IF EXISTS public.public_portfolio_branding;
CREATE VIEW public.public_portfolio_branding
WITH (security_invoker = on)
AS
SELECT
  user_id,
  slug,
  company_name,
  company_logo_url,
  tagline,
  primary_color,
  accent_color,
  website_url,
  support_email
FROM public.branding_settings;

GRANT SELECT ON public.public_portfolio_branding TO anon, authenticated;