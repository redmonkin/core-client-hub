-- Superseded by create_invoice(), which allocates the invoice number and
-- inserts the invoice/invoice_amounts rows atomically in one call. The old
-- two-step RPC is no longer called from the client.
DROP FUNCTION IF EXISTS public.get_next_invoice_number();
