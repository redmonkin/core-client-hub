
-- Fix 1: Remove the insecure public INSERT policy on notifications
-- Service role bypasses RLS by default, so no replacement needed
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;

-- Fix 2: Remove the insecure public read-all policy on notification_preferences
DROP POLICY IF EXISTS "Service role can read all preferences" ON public.notification_preferences;

-- Fix 3: Replace the blanket public SELECT on proposal_access_tokens
-- with a restricted policy that only allows lookup by exact token value
DROP POLICY IF EXISTS "Anyone can view tokens by token value" ON public.proposal_access_tokens;

CREATE POLICY "Anyone can view tokens by exact token match"
ON public.proposal_access_tokens
FOR SELECT
TO public
USING (token = current_setting('request.headers', true)::json->>'x-portal-token');
