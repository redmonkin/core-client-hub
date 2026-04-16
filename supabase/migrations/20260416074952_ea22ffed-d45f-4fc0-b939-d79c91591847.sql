-- Remove the overly permissive anon SELECT policy on clients table
-- The public portfolio already uses the public_portfolio_clients view which only exposes id, client_name, company_name
DROP POLICY IF EXISTS "Anon can read portfolio clients only" ON public.clients;