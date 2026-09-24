-- Read the edge-function base URL for cron jobs from Vault instead of
-- hardcoding this deployment's project URL.
--
-- The earlier cron migrations embedded https://<our project>.supabase.co and
-- attached the database's own service role key from Vault. On a self-hosted
-- copy that would send *that* project's service role key to our functions
-- every day. Those migrations now read the URL from Vault too (fresh installs
-- never see a hardcoded URL); this migration re-schedules the jobs on
-- databases that already ran the old versions. pg_cron >= 1.3 replaces a job
-- when scheduled again under the same name.
--
-- Required before this migration runs (once per project):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
-- The 'service_role_key' secret from 20260712100000 is also required.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'project_url') THEN
    RAISE EXCEPTION 'Missing Vault secret "project_url". Run: select vault.create_secret(''https://<project-ref>.supabase.co'', ''project_url''); then re-run migrations.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'service_role_key') THEN
    RAISE EXCEPTION 'Missing Vault secret "service_role_key". Run: select vault.create_secret(''<service role key>'', ''service_role_key''); then re-run migrations.';
  END IF;
END
$$;

select cron.schedule(
  'daily-contract-renewal-reminders',
  '0 9 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1) || '/functions/v1/contract-renewal-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1)
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

select cron.schedule(
  'proposal-expiry-reminders',
  '0 9 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1) || '/functions/v1/proposal-expiry-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1)
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

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

select cron.schedule(
  'generate-recurring-expenses',
  '5 6 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1) || '/functions/v1/generate-recurring-expenses',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1)
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
