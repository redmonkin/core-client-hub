-- Drop the overly permissive anon SELECT policy on clients
DROP POLICY IF EXISTS "Anon can read client names for portfolio" ON public.clients;

-- Replace with a narrower policy: anon can only read clients that have featured projects
CREATE POLICY "Anon can read portfolio clients only"
  ON public.clients FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.client_id = clients.id
        AND projects.is_featured = true
    )
  );