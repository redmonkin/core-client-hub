-- 1. Recreate portfolio views with security_invoker = true
DROP VIEW IF EXISTS public.public_portfolio_branding;
CREATE VIEW public.public_portfolio_branding
WITH (security_invoker = true) AS
SELECT user_id, company_name, company_logo_url, tagline,
       primary_color, accent_color, website_url, support_email
FROM public.branding_settings;

DROP VIEW IF EXISTS public.public_portfolio_clients;
CREATE VIEW public.public_portfolio_clients
WITH (security_invoker = true) AS
SELECT id, client_name, company_name
FROM public.clients;

-- 2. Add anon SELECT policies for portfolio views to work
CREATE POLICY "Anon can read branding for portfolio"
  ON public.branding_settings FOR SELECT TO anon
  USING (true);

CREATE POLICY "Anon can read client names for portfolio"
  ON public.clients FOR SELECT TO anon
  USING (true);

-- 3. Remove overly permissive storage INSERT policy
DROP POLICY IF EXISTS "Authenticated users can upload project files" ON storage.objects;

-- 4. Create a safe public view for featured projects
CREATE VIEW public.public_portfolio_projects
WITH (security_invoker = true) AS
SELECT id, user_id, project_name, feature_image_url, is_featured, client_id
FROM public.projects
WHERE is_featured = true;

-- 5. Drop the direct anon SELECT policy on projects and replace with a narrower one
DROP POLICY IF EXISTS "Anyone can view featured projects" ON public.projects;

CREATE POLICY "Anon can view featured projects"
  ON public.projects FOR SELECT TO anon
  USING (is_featured = true);