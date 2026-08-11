-- Once an invoice is fully paid its content must freeze -- the UI already
-- stops offering the Edit action for a paid invoice, but that's
-- client-side-only, so a direct table update could still slip through. This
-- trigger is the server-side backstop: any UPDATE on a row that was already
-- 'paid' is rejected if it touches billing content, while still allowing the
-- columns that legitimately change afterwards (status -> void, paid_at, and
-- the updated_at trigger).

CREATE OR REPLACE FUNCTION public.prevent_paid_invoice_edit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'paid' THEN
    IF NEW.invoice_number IS DISTINCT FROM OLD.invoice_number
       OR NEW.client_id IS DISTINCT FROM OLD.client_id
       OR NEW.project_id IS DISTINCT FROM OLD.project_id
       OR NEW.contract_id IS DISTINCT FROM OLD.contract_id
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.cost_breakdown IS DISTINCT FROM OLD.cost_breakdown
       OR NEW.due_date IS DISTINCT FROM OLD.due_date
       OR NEW.issued_date IS DISTINCT FROM OLD.issued_date
       OR NEW.payment_terms IS DISTINCT FROM OLD.payment_terms
       OR NEW.notes IS DISTINCT FROM OLD.notes
    THEN
      RAISE EXCEPTION 'invoice is paid and its content is frozen';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_paid_invoice_edit_trigger
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.prevent_paid_invoice_edit();
