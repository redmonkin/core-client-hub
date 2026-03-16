
-- The view is unnecessary - the edge function uses service_role which bypasses RLS
-- and password verification is only done server-side
DROP VIEW IF EXISTS public.proposal_access_tokens_safe;
