-- Automatic payment reminder, sent once per invoice 3 days before its due
-- date by the invoice-due-reminders edge function.
--
-- due_reminder_sent_for holds the due date a reminder was sent for: it stops
-- duplicate reminders, and changing an invoice's due date re-arms it.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS due_reminder_sent_for date;

-- Daily at 03:30 UTC (09:00 IST). Like the other cron jobs, the function URL
-- and service role key come from the Vault secrets 'project_url' and
-- 'service_role_key' (see 20260924120000_cron_project_url_from_vault.sql).
select cron.schedule(
  'invoice-due-reminders',
  '30 3 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1) || '/functions/v1/invoice-due-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1)
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
