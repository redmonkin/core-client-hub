-- Remove the broad anon SELECT policy on clients which exposes PII
-- (email, phone, billing_address, notes) for any client linked to a featured project.
-- The public portfolio already reads safe fields via the public_portfolio_clients view.
DROP POLICY IF EXISTS "Anon can read companies of featured project clients" ON public.clients;