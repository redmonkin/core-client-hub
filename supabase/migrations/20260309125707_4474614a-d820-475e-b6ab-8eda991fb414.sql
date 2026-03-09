
-- Create proposal status history table
CREATE TABLE public.proposal_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.proposal_status_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view history for their proposals"
  ON public.proposal_status_history
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.proposals
    WHERE proposals.id = proposal_status_history.proposal_id
    AND proposals.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert history for their proposals"
  ON public.proposal_status_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow service role / anon to insert (for client portal actions)
CREATE POLICY "Anyone can insert status history"
  ON public.proposal_status_history
  FOR INSERT
  TO public
  WITH CHECK (true);
