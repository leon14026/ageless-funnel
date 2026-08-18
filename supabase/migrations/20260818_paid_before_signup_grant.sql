-- Close the paid-before-signup gap. When a match is discovered on the PRE-ORDER side
-- (the payment SMS was ingested first), the DB calls the grant-access Edge Function via
-- pg_net so the account/entitlement/invite are created too. Payment-side matches are still
-- granted inline by ingest-bkash, so grants never double-fire.
-- NOTE: replace __GRANT_SECRET__ with the real value when applying (kept out of git).
-- Applied to project osbaarjfafflzoftojbd on 2026-08-18 via the SQL editor.

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Private secret store (not in the public schema -> not exposed by PostgREST).
CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE IF NOT EXISTS private.app_secrets (
  name  text PRIMARY KEY,
  value text NOT NULL
);
INSERT INTO private.app_secrets (name, value)
VALUES ('grant_secret', '__GRANT_SECRET__')
ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value;

CREATE OR REPLACE FUNCTION public.reconcile_bkash(p_trx text, p_source text DEFAULT 'payment')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trx text := upper(trim(p_trx));
  pay   public.bkash_payments%ROWTYPE;
  pre   public.preorders%ROWTYPE;
BEGIN
  IF v_trx IS NULL OR v_trx = '' THEN RETURN; END IF;

  SELECT * INTO pay FROM public.bkash_payments
    WHERE trx_id = v_trx AND status <> 'matched'
    LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO pre FROM public.preorders
    WHERE upper(trim(txn_reference)) = v_trx AND status = 'pending'
    ORDER BY created_at ASC
    LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  IF pay.amount_bdt IS NOT NULL AND round(pay.amount_bdt) >= pre.amount_bdt THEN
    UPDATE public.preorders
      SET status = 'verified', verified_at = now()
      WHERE id = pre.id AND status = 'pending';
    UPDATE public.bkash_payments
      SET status = 'matched', matched_preorder_id = pre.id
      WHERE id = pay.id;

    IF p_source = 'preorder' THEN
      PERFORM net.http_post(
        url := 'https://osbaarjfafflzoftojbd.supabase.co/functions/v1/grant-access',
        body := jsonb_build_object('preorder_id', pre.id),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-grant-secret', (SELECT value FROM private.app_secrets WHERE name = 'grant_secret')
        )
      );
    END IF;
  ELSE
    UPDATE public.bkash_payments
      SET status = 'amount_mismatch', matched_preorder_id = pre.id
      WHERE id = pay.id AND status = 'unmatched';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reconcile_bkash(text, text) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_bkash_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.reconcile_bkash(NEW.trx_id, 'payment');
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_preorder_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.txn_reference IS NOT NULL THEN
    PERFORM public.reconcile_bkash(upper(trim(NEW.txn_reference)), 'preorder');
  END IF;
  RETURN NULL;
END;
$$;

DROP FUNCTION IF EXISTS public.reconcile_bkash(text);
