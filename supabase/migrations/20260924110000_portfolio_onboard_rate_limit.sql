-- Rate limiting for the public portfolio "start a project" form
-- (portfolio-onboard edge function). The form is anonymous by design, so
-- submissions are capped per submitter IP and per portfolio owner instead.
--
-- Only the service role touches this table: RLS is enabled with no policies,
-- and IPs are stored as SHA-256 hashes, never in plain text.

CREATE TABLE IF NOT EXISTS public.portfolio_onboard_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portfolio_onboard_submissions_ip_idx
  ON public.portfolio_onboard_submissions (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS portfolio_onboard_submissions_owner_idx
  ON public.portfolio_onboard_submissions (owner_id, created_at);
CREATE INDEX IF NOT EXISTS portfolio_onboard_submissions_created_idx
  ON public.portfolio_onboard_submissions (created_at);

ALTER TABLE public.portfolio_onboard_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portfolio_onboard_submissions FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.portfolio_onboard_submissions TO service_role;

-- Records a submission if it is within limits and returns true; returns false
-- (recording nothing) when the IP or the owner is over its limit.
CREATE OR REPLACE FUNCTION public.record_portfolio_onboard_submission(p_owner_id uuid, p_ip_hash text)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  max_per_ip_per_hour constant integer := 5;
  max_per_owner_per_day constant integer := 50;
BEGIN
  -- Serialize checks per owner so parallel requests cannot all pass the count.
  PERFORM pg_advisory_xact_lock(hashtext('portfolio_onboard:' || p_owner_id::text));

  DELETE FROM public.portfolio_onboard_submissions WHERE created_at < now() - interval '2 days';

  IF (SELECT count(*) FROM public.portfolio_onboard_submissions
      WHERE ip_hash = p_ip_hash AND created_at > now() - interval '1 hour') >= max_per_ip_per_hour THEN
    RETURN false;
  END IF;

  IF (SELECT count(*) FROM public.portfolio_onboard_submissions
      WHERE owner_id = p_owner_id AND created_at > now() - interval '1 day') >= max_per_owner_per_day THEN
    RETURN false;
  END IF;

  INSERT INTO public.portfolio_onboard_submissions (owner_id, ip_hash) VALUES (p_owner_id, p_ip_hash);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_portfolio_onboard_submission(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_portfolio_onboard_submission(uuid, text) TO service_role;
