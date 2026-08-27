-- Schedule the daily Pathao band-shipping batch.
-- Run in the SQL editor with __PATHAO_BATCH_SECRET__ replaced by the real value (kept out of git).
-- The same secret is also set as the pathao-batch Edge Function secret PATHAO_BATCH_SECRET.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Store the batch secret privately so cron can authenticate to the function.
INSERT INTO private.app_secrets (name, value)
VALUES ('pathao_batch_secret', '__PATHAO_BATCH_SECRET__')
ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value;

-- Daily at 16:00 UTC (10 PM Dhaka): create the day's Pathao orders + email the packing list.
SELECT cron.schedule(
  'pathao-daily-batch',
  '0 16 * * *',
  $$
  SELECT net.http_post(
    url := 'https://osbaarjfafflzoftojbd.supabase.co/functions/v1/pathao-batch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-batch-secret', (SELECT value FROM private.app_secrets WHERE name = 'pathao_batch_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
