
-- 1. weekly_reviews: add user_id + RLS
ALTER TABLE public.weekly_reviews ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.weekly_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own weekly reviews" ON public.weekly_reviews;
CREATE POLICY "Users can view their own weekly reviews"
ON public.weekly_reviews FOR SELECT TO authenticated
USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can insert their own weekly reviews" ON public.weekly_reviews;
CREATE POLICY "Users can insert their own weekly reviews"
ON public.weekly_reviews FOR INSERT TO authenticated
WITH CHECK (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can update their own weekly reviews" ON public.weekly_reviews;
CREATE POLICY "Users can update their own weekly reviews"
ON public.weekly_reviews FOR UPDATE TO authenticated
USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own weekly reviews" ON public.weekly_reviews;
CREATE POLICY "Users can delete their own weekly reviews"
ON public.weekly_reviews FOR DELETE TO authenticated
USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

-- 2. Hide password_hash columns from authenticated reads
REVOKE SELECT (password_hash) ON public.contract_access_tokens FROM authenticated, anon;
REVOKE SELECT (password_hash) ON public.proposal_access_tokens FROM authenticated, anon;

-- 3. Restrict anon access to projects so only published portfolios expose featured projects
DROP POLICY IF EXISTS "Anon can read featured projects for portfolio" ON public.projects;
CREATE POLICY "Anon can read featured projects for portfolio"
ON public.projects FOR SELECT TO anon
USING (
  is_featured = true
  AND EXISTS (
    SELECT 1 FROM public.branding_settings b
    WHERE b.user_id = projects.user_id AND b.slug IS NOT NULL
  )
);

-- 4. Remove broad anon read on branding_settings; public portfolio uses public_portfolio_branding view
DROP POLICY IF EXISTS "Anon can read published portfolio branding" ON public.branding_settings;
