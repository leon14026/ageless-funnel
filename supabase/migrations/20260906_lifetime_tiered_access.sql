-- Lifetime tiered access + content drip. Applied to osbaarjfafflzoftojbd on 2026-09-06.
--
-- New model: a member keeps the months their tier bought, FOREVER.
--   1-month tier -> Month 1        3-month tier -> Months 1-3        6-month tier -> Months 1-6
-- Content still unlocks progressively (month N after N months, anchored at the later of the
-- program launch or their access start) - that drip is enforced client-side in programs.js.
--
-- Previously the tier only set how LONG access lasted (ends_at) and every member could see all
-- six months, so a 1-month buyer could take the entire programme for the lowest price.
--
-- Lifetime is implemented as a DATABASE POLICY (the trigger below) rather than in each caller.
-- That matters because the live bKash `grant-access` Edge Function still computes and sends an
-- expiry date: rather than redeploy it, the trigger DELIBERATELY DISCARDS any caller-supplied
-- ends_at and writes NULL (= lifetime). If the model is ever reverted to timed access, this
-- trigger is the single place to change.

-- ---------- Schema ----------
ALTER TABLE public.access_entitlements ADD COLUMN IF NOT EXISTS months integer;
ALTER TABLE public.access_entitlements ALTER COLUMN ends_at DROP NOT NULL;  -- NULL = lifetime

COMMENT ON COLUMN public.access_entitlements.months  IS 'Content scope: highest program month this member may ever access (1, 3 or 6).';
COMMENT ON COLUMN public.access_entitlements.ends_at IS 'NULL = lifetime access. Legacy timed grants may still carry a date.';

-- ---------- Policy trigger ----------
CREATE OR REPLACE FUNCTION public.set_entitlement_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_months integer;
BEGIN
  -- Lifetime: intentionally overrides whatever the caller sent (see header note).
  NEW.ends_at := NULL;

  IF NEW.months IS NULL THEN
    -- Card purchase: order_id points at public.orders
    SELECT o.access_months INTO v_months
      FROM public.orders o WHERE o.id = NEW.order_id;

    -- bKash pre-order: order_id points at public.preorders
    IF v_months IS NULL THEN
      SELECT CASE p.tier WHEN '1' THEN 1 WHEN '3' THEN 3 WHEN '6' THEN 6 WHEN 'test' THEN 1 END
        INTO v_months
        FROM public.preorders p WHERE p.id = NEW.order_id;
    END IF;

    -- Manual/admin grants (no linked order) get the full programme.
    NEW.months := coalesce(v_months, 6);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_entitlement_scope() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_set_entitlement_scope ON public.access_entitlements;
CREATE TRIGGER trg_set_entitlement_scope
  BEFORE INSERT ON public.access_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.set_entitlement_scope();

-- ---------- Card fulfilment writes the scope explicitly (trigger is the backstop) ----------
CREATE OR REPLACE FUNCTION public.fulfill_card_order(
  p_transaction_id   text,
  p_user_id          uuid,
  p_payment_reference text,
  p_payment_method   text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.orders%ROWTYPE;
  v_paid timestamptz := now();
BEGIN
  SELECT * INTO o FROM public.orders WHERE transaction_id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF o.status = 'completed' THEN RETURN 'already'; END IF;

  UPDATE public.orders SET
      user_id           = p_user_id,
      status            = 'completed',
      paid_at           = v_paid,
      payment_reference = p_payment_reference,
      payment_method    = coalesce(p_payment_method, 'online'),
      activation_status = 'email_sent'
    WHERE id = o.id AND status = 'pending';

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

-- ---------- Backfill existing members onto the lifetime model ----------
UPDATE public.access_entitlements e SET
  ends_at = NULL,
  months  = coalesce(
    e.months,
    (SELECT o.access_months FROM public.orders o WHERE o.id = e.order_id),
    (SELECT CASE p.tier WHEN '1' THEN 1 WHEN '3' THEN 3 WHEN '6' THEN 6 WHEN 'test' THEN 1 END
       FROM public.preorders p WHERE p.id = e.order_id),
    6
  );
