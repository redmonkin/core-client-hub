
SELECT cron.schedule(
  'proposal-expiry-reminders',
  '0 9 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://jizouqjrdyfshhztqucd.supabase.co/functions/v1/proposal-expiry-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imppem91cWpyZHlmc2hoenRxdWNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzU5MDMsImV4cCI6MjA4Mjk1MTkwM30.prIoZs_4euyfe1-CDc8Rl3D2aVtYZp9EEb2rpOi2ddY"}'::jsonb,
        body:='{}'::jsonb
    ) AS request_id;
  $$
);
