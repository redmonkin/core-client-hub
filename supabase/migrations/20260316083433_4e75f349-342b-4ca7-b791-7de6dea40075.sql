-- Remove the dangerous unrestricted public INSERT policy
DROP POLICY IF EXISTS "Anyone can insert status history" ON public.proposal_status_history;