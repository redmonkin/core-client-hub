
-- Fix the security definer view issue
DROP VIEW IF EXISTS public.proposal_access_tokens_safe;
CREATE VIEW public.proposal_access_tokens_safe
WITH (security_invoker = true) AS
SELECT id, proposal_id, token, expires_at, viewed_at, created_at
FROM public.proposal_access_tokens;

-- Make project-files bucket private
UPDATE storage.buckets SET public = false WHERE id = 'project-files';
