-- Schedules the recurring-expense generator daily, staggered a few minutes
-- after generate-recurring-invoices (06:00) so the two jobs don't overlap.
select cron.schedule(
  'generate-recurring-expenses',
  '5 6 * * *',
  $$
  select net.http_post(
    url := 'https://jizouqjrdyfshhztqucd.supabase.co/functions/v1/generate-recurring-expenses',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1)
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
