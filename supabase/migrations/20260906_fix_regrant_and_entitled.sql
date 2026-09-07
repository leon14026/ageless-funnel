-- Two defects found in review. Applied to osbaarjfafflzoftojbd on 2026-09-06.
--
-- 1. fulfill_card_order() could re-grant access to an order that was no longer payable.
--    The guard only rejected status='completed'. For any other status the UPDATE (scoped to
--    status='pending') silently matched zero rows, but the entitlement upsert still ran and set
--    status='active'. So an IPN replayed after revoke_card_order() restored a refunded customer's
--    access while the order stayed 'refunded'.
--
--    NOTE - deliberately NOT the naive "require pending" fix: cancel_stale_orders() cancels
--    unpaid orders after 2h, and a genuinely late-but-valid payment would then be refused,
--    leaving a paying customer with no access. payment-ipn only calls this AFTER SSLCommerz's
--    Validation API confirms the payment, so a validated payment on a cancelled/failed order is
--    real money and must be honoured. Only 'refunded' is permanently un-grantable.
--
-- 2. is_entitled() used `ends_at >= now()`, which is NULL (=> false) for lifetime members, so
--    every lifetime member would silently fail the RLS check on program_weeks / workout_videos.
--    Latent today (both tables are empty and unused - content is served from static JSON) but it
--    would bite the moment content moves into them.

-- ---------- 1. Card fulfilment: never re-grant after a refund ----------
CREATE OR REPLACE FUNCTION public.fulfill_card_order(
  p_transaction_id   text,
  p_user_id          uuid,
  p_payment_reference text,
  p_payment_method   text
) RETURNS text   -- 'completed' | 'already' | 'refunded' | 'not_grantable' | 'not_found'
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.orders%ROWTYPE;
  v_paid timestamptz := now();
  v_rows integer;
BEGIN
  SELECT * INTO o FROM public.orders WHERE transaction_id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF o.status = 'completed' THEN RETURN 'already'; END IF;
  -- Money has been returned: never restore access, however many times the IPN is replayed.
  IF o.status = 'refunded' THEN RETURN 'refunded'; END IF;

  -- 'cancelled'/'failed' are honoured: the caller has already validated the payment with
  -- SSLCommerz, so this is a real (if late) payment for an order we had given up on.
  UPDATE public.orders SET
      user_id           = p_user_id,
      status            = 'completed',
      paid_at           = v_paid,
      payment_reference = p_payment_reference,
      payment_method    = coalesce(p_payment_method, 'online'),
      activation_status = 'email_sent'
    WHERE id = o.id AND status IN ('pending','cancelled','failed');

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  -- Lost a race, or the status moved somewhere unexpected: grant nothing.
  IF v_rows = 0 THEN RETURN 'not_grantable'; END IF;

  INSERT INTO public.access_entitlements
      (order_id, user_id, customer_email, status, starts_at, ends_at, source, months)
  VALUES
      (o.id, p_user_id, lower(o.customer_email), 'active',
       v_paid, NULL, 'card', o.access_months)
  ON CONFLICT (order_id) DO UPDATE SET
      user_id    = EXCLUDED.user_id,
      status     = 'active',
      starts_at  = EXCLUDED.starts_at,
      ends_at    = NULL,
      source     = 'card',
      months     = EXCLUDED.months;

  RETURN 'completed';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fulfill_card_order(text, uuid, text, text) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fulfill_card_order(text, uuid, text, text) TO service_role;

-- ---------- 2. is_entitled(): NULL ends_at means lifetime, not expired ----------
CREATE OR REPLACE FUNCTION public.is_entitled() RETURNS boolean
  LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM access_entitlements
    WHERE user_id = auth.uid()
      AND status = 'active'
      AND (ends_at IS NULL OR ends_at >= now())
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_entitled() FROM anon;
