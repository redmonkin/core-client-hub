-- Create table to store proposal access tokens for client portal
CREATE TABLE public.proposal_access_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  viewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.proposal_access_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage tokens for their own proposals
CREATE POLICY "Users can view tokens for their proposals"
ON public.proposal_access_tokens
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.proposals 
    WHERE proposals.id = proposal_access_tokens.proposal_id 
    AND proposals.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create tokens for their proposals"
ON public.proposal_access_tokens
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.proposals 
    WHERE proposals.id = proposal_access_tokens.proposal_id 
    AND proposals.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete tokens for their proposals"
ON public.proposal_access_tokens
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.proposals 
    WHERE proposals.id = proposal_access_tokens.proposal_id 
    AND proposals.user_id = auth.uid()
  )
);

-- Public access policy for portal (using token validation)
CREATE POLICY "Anyone can view tokens by token value"
ON public.proposal_access_tokens
FOR SELECT
USING (true);

-- Create index for fast token lookup
CREATE INDEX idx_proposal_access_tokens_token ON public.proposal_access_tokens(token);
CREATE INDEX idx_proposal_access_tokens_proposal ON public.proposal_access_tokens(proposal_id);