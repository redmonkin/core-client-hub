-- Reusable invoice item catalog (Zoho-style "Items" list): lets a user save a
-- title/cost/unit/description once and pick it into an invoice's line items
-- instead of retyping the same billable item every time.

CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  unit text NOT NULL DEFAULT 'hr',
  cost numeric NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX invoice_items_user_id_idx ON public.invoice_items(user_id);

CREATE TRIGGER update_invoice_items_updated_at
BEFORE UPDATE ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- Same owner/admin/editor-write, whole-workspace-read shape as invoices
-- itself, since this catalog only exists to feed invoice line items.
CREATE POLICY "Users can view their workspace invoice items" ON public.invoice_items
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT public.get_accessible_user_ids(auth.uid())));

CREATE POLICY "Users can create their workspace invoice items" ON public.invoice_items
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );

CREATE POLICY "Users can update their workspace invoice items" ON public.invoice_items
  FOR UPDATE TO authenticated
  USING (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );

CREATE POLICY "Users can delete their workspace invoice items" ON public.invoice_items
  FOR DELETE TO authenticated
  USING (
    user_id IN (SELECT public.get_accessible_user_ids(auth.uid()))
    AND public.get_workspace_role(auth.uid(), user_id) IN ('owner', 'admin', 'editor')
  );
