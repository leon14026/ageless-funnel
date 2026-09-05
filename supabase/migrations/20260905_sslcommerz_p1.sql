-- SSLCommerz go-live hardening (P1). Applied to osbaarjfafflzoftojbd on 2026-09-05.
-- Additive only; does not touch the bKash flow. Card path stays gated by LAUNCH_MODE/SANDBOX.

-- ---------- Allow a 'refunded' order status ----------
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD  CONSTRAINT orders_status_check
  CHECK (status IN ('pending','completed','failed','cancelled','refunded'));

-- ---------- Durable rate limiter (edge functions are stateless, so track in the DB) ----------
CREATE TABLE IF NOT EXISTS public.rate_limits (
  bucket       text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  count        integer NOT NULL DEFAULT 0
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;  -- no policies => service-role only

-- Returns true if the hit is allowed, false if the bucket is over p_max within the rolling window.
CREATE OR REPLACE FUNCTION public.rate_limit_hit(p_bucket text, p_max integer, p_window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.rate_limits%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.rate_limits WHERE bucket = p_bucket FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.rate_limits(bucket, window_start, count) VALUES (p_bucket, now(), 1);
    RETURN true;
  END IF;
  IF r.window_start < now() - make_interval(secs => p_window_seconds) THEN
    UPDATE public.rate_limits SET window_start = now(), count = 1 WHERE bucket = p_bucket;
    RETURN true;
  END IF;
  IF r.count >= p_max THEN
    RETURN false;
  END IF;
  UPDATE public.rate_limits SET count = count + 1 WHERE bucket = p_bucket;
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rate_limit_hit(text,integer,integer) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.rate_limit_hit(text,integer,integer) TO service_role;

-- ---------- Auto-cancel abandoned pending orders (gateway sessions are short-lived) ----------
CREATE OR REPLACE FUNCTION public.cancel_stale_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  UPDATE public.orders SET status = 'cancelled'
    WHERE status = 'pending' AND created_at < now() - interval '2 hours';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cancel_stale_orders() FROM public, anon, authenticated;

DO $$ BEGIN
  PERFORM cron.unschedule('cancel-stale-card-orders');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('cancel-stale-card-orders', '17 * * * *', $$ SELECT public.cancel_stale_orders(); $$);

-- ---------- Refund helper: revoke access + mark the order refunded (manual/admin use) ----------
CREATE OR REPLACE FUNCTION public.revoke_card_order(p_order_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.access_entitlements SET status = 'revoked' WHERE order_id = p_order_id;
  UPDATE public.orders SET status = 'refunded' WHERE id = p_order_id;
  RETURN 'revoked';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.revoke_card_order(uuid) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.revoke_card_order(uuid) TO service_role;
