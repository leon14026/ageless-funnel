-- Hold high-risk card payments for manual verification. Applied 2026-09-07.
--
-- SSLCommerz's live integration instructions are explicit:
--   "if risk_level = 1 and transaction status = VALID, then please hold the transaction and
--    verify the customer"
-- We were granting access on any VALID payment, so a transaction the gateway had flagged as risky
-- would be fulfilled instantly - the classic fraud-then-chargeback pattern, made worse here by a
-- statement descriptor (Shape N' Shine) that customers won't recognise.
--
-- risk_level arrives in the Validation API response (not the IPN POST), which fulfill_card_order
-- already receives as p_gateway - so the decision lives in one place, next to the grant itself.
--
-- Held orders: payment IS recorded (the money was captured) with full evidence, and the customer's
-- account is still created, but NO entitlement is granted. Release with release_held_order() once
-- the customer has been verified.

-- 'on_hold' = paid, evidence recorded, access withheld pending manual verification.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_activation_status_check;
ALTER TABLE public.orders ADD  CONSTRAINT orders_activation_status_check
  CHECK (activation_status IN ('pending','email_sent','activated','on_hold'));

CREATE OR REPLACE FUNCTION public.fulfill_card_order(
  p_transaction_id    text,
  p_user_id           uuid,
  p_payment_reference text,
  p_payment_method    text,
  p_gateway           jsonb
) RETURNS text   -- 'completed' | 'held' | 'already' | 'refunded' | 'not_grantable' | 'not_found'
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.orders%ROWTYPE;
  v_paid timestamptz := now();
  v_rows integer;
  -- Absent risk_level is treated as safe: the sandbox and some channels omit it, and failing
  -- closed there would hold every legitimate payment.
  v_risk text := coalesce(nullif(p_gateway->>'risk_level', ''), '0');
BEGIN
  SELECT * INTO o FROM public.orders WHERE transaction_id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF o.status = 'completed' AND o.activation_status <> 'on_hold' THEN RETURN 'already'; END IF;
  IF o.status = 'refunded' THEN RETURN 'refunded'; END IF;

  UPDATE public.orders SET
      user_id           = p_user_id,
      status            = 'completed',
      paid_at           = v_paid,
      payment_reference = p_payment_reference,
      payment_method    = coalesce(p_payment_method, 'online'),
      activation_status = CASE WHEN v_risk <> '0' THEN 'on_hold' ELSE 'email_sent' END,
      bank_tran_id      = coalesce(p_gateway->>'bank_tran_id', bank_tran_id),
      card_no           = coalesce(p_gateway->>'card_no', card_no),
      card_issuer       = coalesce(p_gateway->>'card_issuer', card_issuer),
      card_brand        = coalesce(p_gateway->>'card_brand', card_brand),
      risk_level        = coalesce(p_gateway->>'risk_level', risk_level),
      risk_title        = coalesce(p_gateway->>'risk_title', risk_title),
      store_amount      = coalesce((p_gateway->>'store_amount')::numeric, store_amount),
      gateway_tran_date = coalesce(p_gateway->>'tran_date', gateway_tran_date),
      gateway_meta      = coalesce(p_gateway, gateway_meta)
    WHERE id = o.id AND status IN ('pending','cancelled','failed','completed');

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RETURN 'not_grantable'; END IF;

  -- Flagged by the gateway: money captured and evidence stored, but grant nothing yet.
  IF v_risk <> '0' THEN RETURN 'held'; END IF;

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

-- ---------- Manual release after verifying the customer ----------
-- Run from the SQL editor:  select public.release_held_order('<order uuid>');
CREATE OR REPLACE FUNCTION public.release_held_order(p_order_id uuid)
RETURNS text   -- 'released' | 'not_held' | 'no_user' | 'not_completed' | 'not_found'
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE o public.orders%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF o.status <> 'completed'        THEN RETURN 'not_completed'; END IF;
  IF o.activation_status <> 'on_hold' THEN RETURN 'not_held'; END IF;
  IF o.user_id IS NULL              THEN RETURN 'no_user'; END IF;

  INSERT INTO public.access_entitlements
      (order_id, user_id, customer_email, status, starts_at, ends_at, source, months)
  VALUES
      (o.id, o.user_id, lower(o.customer_email), 'active', now(), NULL, 'card', o.access_months)
  ON CONFLICT (order_id) DO UPDATE SET
      user_id   = EXCLUDED.user_id,
      status    = 'active',
      starts_at = EXCLUDED.starts_at,
      ends_at   = NULL,
      source    = 'card',
      months    = EXCLUDED.months;

  UPDATE public.orders SET activation_status = 'email_sent' WHERE id = o.id;
  RETURN 'released';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.release_held_order(uuid) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.release_held_order(uuid) TO service_role;
