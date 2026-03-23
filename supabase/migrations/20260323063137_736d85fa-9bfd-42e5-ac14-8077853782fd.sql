
-- Create contract_status_history table mirroring proposal_status_history
CREATE TABLE public.contract_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contract_status_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can insert history for their contracts"
  ON public.contract_status_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = contract_status_history.contract_id
      AND contracts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view history for their contracts"
  ON public.contract_status_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = contract_status_history.contract_id
      AND contracts.user_id = auth.uid()
    )
  );
