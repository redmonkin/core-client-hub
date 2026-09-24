-- Portal share-link password hardening.
--
-- 1. Limit password guesses per access token. The client-portal edge function
--    calls claim_portal_password_attempt() before every password check; after
--    10 attempts without a success the token is locked for 15 minutes. A
--    successful check resets the counter.
-- 2. Actually hide password_hash from API roles. The earlier column-level
--    REVOKEs (20260512104017, 20260522172219) had no effect because a
--    table-wide SELECT grant was still in place, and invoice_access_tokens
--    never had one. Replace the table grant with an explicit column list.

ALTER TABLE public.proposal_access_tokens
  ADD COLUMN IF NOT EXISTS failed_password_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS password_locked_until timestamptz;

ALTER TABLE public.contract_access_tokens
  ADD COLUMN IF NOT EXISTS failed_password_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS password_locked_until timestamptz;

ALTER TABLE public.invoice_access_tokens
  ADD COLUMN IF NOT EXISTS failed_password_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS password_locked_until timestamptz;

-- Atomically records one password attempt against a token. Returns false when
-- the token is currently locked (caller must reject without checking the
-- password). Row locks taken by UPDATE serialize concurrent calls, so a burst
-- of parallel requests cannot exceed the limit.
CREATE OR REPLACE FUNCTION public.claim_portal_password_attempt(p_document_type text, p_token text)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  max_attempts constant integer := 10;
  lock_duration constant interval := interval '15 minutes';
  claimed integer;
BEGIN
  IF p_document_type = 'proposal' THEN
    UPDATE public.proposal_access_tokens
    SET failed_password_attempts = CASE WHEN password_locked_until IS NULL THEN failed_password_attempts + 1 ELSE 1 END,
        password_locked_until = CASE
          WHEN (CASE WHEN password_locked_until IS NULL THEN failed_password_attempts + 1 ELSE 1 END) >= max_attempts
          THEN now() + lock_duration ELSE NULL END
    WHERE token = p_token AND (password_locked_until IS NULL OR password_locked_until <= now());
  ELSIF p_document_type = 'contract' THEN
    UPDATE public.contract_access_tokens
    SET failed_password_attempts = CASE WHEN password_locked_until IS NULL THEN failed_password_attempts + 1 ELSE 1 END,
        password_locked_until = CASE
          WHEN (CASE WHEN password_locked_until IS NULL THEN failed_password_attempts + 1 ELSE 1 END) >= max_attempts
          THEN now() + lock_duration ELSE NULL END
    WHERE token = p_token AND (password_locked_until IS NULL OR password_locked_until <= now());
  ELSIF p_document_type = 'invoice' THEN
    UPDATE public.invoice_access_tokens
    SET failed_password_attempts = CASE WHEN password_locked_until IS NULL THEN failed_password_attempts + 1 ELSE 1 END,
        password_locked_until = CASE
          WHEN (CASE WHEN password_locked_until IS NULL THEN failed_password_attempts + 1 ELSE 1 END) >= max_attempts
          THEN now() + lock_duration ELSE NULL END
    WHERE token = p_token AND (password_locked_until IS NULL OR password_locked_until <= now());
  ELSE
    RAISE EXCEPTION 'Unknown document type: %', p_document_type;
  END IF;

  GET DIAGNOSTICS claimed = ROW_COUNT;
  RETURN claimed > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_portal_password_attempt(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_portal_password_attempt(text, text) TO service_role;

-- Column-scoped SELECT: everything the app reads, never password_hash or the
-- attempt counters. anon has no RLS policy on these tables and gets nothing.
REVOKE SELECT ON public.proposal_access_tokens FROM anon, authenticated;
REVOKE SELECT ON public.contract_access_tokens FROM anon, authenticated;
REVOKE SELECT ON public.invoice_access_tokens FROM anon, authenticated;

GRANT SELECT (id, proposal_id, token, expires_at, viewed_at, created_at)
  ON public.proposal_access_tokens TO authenticated;
GRANT SELECT (id, contract_id, token, expires_at, viewed_at, created_at)
  ON public.contract_access_tokens TO authenticated;
GRANT SELECT (id, invoice_id, token, expires_at, viewed_at, created_at)
  ON public.invoice_access_tokens TO authenticated;
