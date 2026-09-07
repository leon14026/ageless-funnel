-- Capture SSLCommerz transaction evidence on the order, for chargeback defence.
-- Applied to osbaarjfafflzoftojbd on 2026-09-06.
--
-- When a cardholder disputes a charge, the acquirer asks for the acquiring bank's transaction id
-- (bank_tran_id) plus supporting detail. We previously stored only val_id (payment_reference) and
-- card_type, which is not enough to contest a dispute. This matters more than usual here: the
-- statement descriptor is a different entity name to the website, so "I don't recognise this
-- charge" disputes are the most likely kind.
--
-- No raw card data is stored: SSLCommerz returns card_no already masked (e.g. 411111******1111)
-- and never sends PAN or CVV, so the PCI SAQ-A posture is unchanged.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS bank_tran_id       text,
  ADD COLUMN IF NOT EXISTS card_no            text,           -- masked by the gateway
  ADD COLUMN IF NOT EXISTS card_issuer        text,
  ADD COLUMN IF NOT EXISTS card_brand         text,
  ADD COLUMN IF NOT EXISTS risk_level         text,
  ADD COLUMN IF NOT EXISTS risk_title         text,
  ADD COLUMN IF NOT EXISTS store_amount       numeric(12,2),  -- net of gateway fees
  ADD COLUMN IF NOT EXISTS gateway_tran_date  text,
  ADD COLUMN IF NOT EXISTS gateway_meta       jsonb;          -- full validation response

CREATE INDEX IF NOT EXISTS idx_orders_bank_tran_id ON public.orders(bank_tran_id);

COMMENT ON COLUMN public.orders.bank_tran_id IS 'Acquiring bank transaction id - the primary reference when contesting a chargeback.';
COMMENT ON COLUMN public.orders.card_no      IS 'Masked card number as returned by SSLCommerz. Never a full PAN.';
COMMENT ON COLUMN public.orders.gateway_meta IS 'Full SSLCommerz validation response, kept verbatim as dispute evidence.';

-- ---------- Fulfilment now records the evidence in the same transaction ----------
-- New 5-arg form takes the validation payload. The old 4-arg form is kept as a thin wrapper so
-- the currently-deployed payment-ipn keeps working until it is redeployed (no broken window).
CREATE OR REPLACE FUNCTION public.fulfill_card_order(
  p_transaction_id    text,
  p_user_id           uuid,
  p_payment_reference text,
  p_payment_method    text,
  p_gateway           jsonb
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

  UPDATE public.orders SET
      user_id           = p_user_id,
      status            = 'completed',
      paid_at           = v_paid,
      payment_reference = p_payment_reference,
      payment_method    = coalesce(p_payment_method, 'online'),
      activation_status = 'email_sent',
      bank_tran_id      = coalesce(p_gateway->>'bank_tran_id', bank_tran_id),
      card_no           = coalesce(p_gateway->>'card_no', card_no),
      card_issuer       = coalesce(p_gateway->>'card_issuer', card_issuer),
      card_brand        = coalesce(p_gateway->>'card_brand', card_brand),
      risk_level        = coalesce(p_gateway->>'risk_level', risk_level),
      risk_title        = coalesce(p_gateway->>'risk_title', risk_title),
      store_amount      = coalesce((p_gateway->>'store_amount')::numeric, store_amount),
      gateway_tran_date = coalesce(p_gateway->>'tran_date', gateway_tran_date),
      gateway_meta      = coalesce(p_gateway, gateway_meta)
    WHERE id = o.id AND status IN ('pending','cancelled','failed');

  GET DIAGNOSTICS v_rows = ROW_COUNT;
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

-- Back-compat wrapper (pre-redeploy payment-ipn calls this 4-arg form).
CREATE OR REPLACE FUNCTION public.fulfill_card_order(
  p_transaction_id    text,
  p_user_id           uuid,
  p_payment_reference text,
  p_payment_method    text
) RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.fulfill_card_order(p_transaction_id, p_user_id, p_payment_reference, p_payment_method, NULL::jsonb);
$$;

REVOKE EXECUTE ON FUNCTION public.fulfill_card_order(text, uuid, text, text, jsonb) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fulfill_card_order(text, uuid, text, text)        FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fulfill_card_order(text, uuid, text, text, jsonb) TO service_role;
GRANT  EXECUTE ON FUNCTION public.fulfill_card_order(text, uuid, text, text)        TO service_role;
