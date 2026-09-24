-- Schedules the recurring-invoice generator daily, ahead of the 9am
-- contract/proposal reminder jobs, using the same 'service_role_key' Vault
-- secret those jobs already rely on (see 20260712100000_fix_reminder_cron_auth.sql).
select cron.schedule(
  'generate-recurring-invoices',
  '0 6 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1) || '/functions/v1/generate-recurring-invoices',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1)
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
