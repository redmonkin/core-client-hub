ALTER TABLE public.clients DROP CONSTRAINT clients_status_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_status_check CHECK (status IN ('active', 'archived', 'pending-review'));