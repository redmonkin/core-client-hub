CREATE TABLE public.contract_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  token text NOT NULL,
  password_hash text,
  expires_at timestamptz NOT NULL,
  viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_access_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create tokens for their contracts"
  ON public.contract_access_tokens FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.contracts
    WHERE contracts.id = contract_access_tokens.contract_id
      AND contracts.user_id = auth.uid()
  ));

CREATE POLICY "Users can view tokens for their contracts"
  ON public.contract_access_tokens FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contracts
    WHERE contracts.id = contract_access_tokens.contract_id
      AND contracts.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete tokens for their contracts"
  ON public.contract_access_tokens FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contracts
    WHERE contracts.id = contract_access_tokens.contract_id
      AND contracts.user_id = auth.uid()
  ));