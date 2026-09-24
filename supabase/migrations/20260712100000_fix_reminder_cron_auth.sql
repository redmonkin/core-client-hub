-- contract-renewal-reminders and proposal-expiry-reminders were unscheduled
-- on 2026-04-27 because they never actually worked: the cron jobs sent a
-- hardcoded anon-role JWT, but both edge functions require an exact
-- `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` match, so every run
-- 401'd silently for months. Re-schedule both, pulling the real service role
-- key from Supabase Vault at run time instead of embedding a key in the
-- migration (which would otherwise commit a live secret to git history).
--
-- One-time manual step required after this migration runs: add a Vault
-- secret named 'service_role_key' (Project Settings > Vault, or
-- `select vault.create_secret('<the service role key>', 'service_role_key')`)
-- containing the project's actual service role key, and one named
-- 'project_url' with the project's API URL (https://<ref>.supabase.co) --
-- see 20260924120000_cron_project_url_from_vault.sql. Until those secrets
-- exists, these jobs will send a null/blank bearer token and 401 the same
-- way the old ones did -- check `select * from cron.job_run_details order by
-- start_time desc limit 20;` after adding the secret to confirm 200s.

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
