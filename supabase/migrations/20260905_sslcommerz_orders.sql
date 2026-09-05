-- SSLCommerz card-payment DB layer (P0). Applied to osbaarjfafflzoftojbd on 2026-09-05.
--
-- Context: the SSLCommerz Edge Functions (initiate-payment / payment-ipn / validate-payment) were written
-- against an `orders`/`order_items` schema that only ever lived in SUPABASE-SETUP.md and was NEVER applied to
-- this project (the live DB has no `orders`/`order_items`; `access_entitlements` was reshaped for the bKash
-- flow). This migration creates the real tables with tight RLS, reconciles `access_entitlements` so the IPN
-- fulfilment can upsert on `order_id`, and adds an ATOMIC fulfilment RPC.
--
-- Isolation from the live bKash flow:
--   * orders / order_items are brand-new, additive tables — nothing in the bKash path touches them.
--   * access_entitlements is shared. bKash rows use source 'preorder'/'manual'; card rows use 'card'. We only
--     ADD a UNIQUE INDEX on order_id (full index → allows the existing multiple bKash rows since their values
--     are distinct/nullable, and satisfies the IPN's ON CONFLICT (order_id) upsert). We do NOT add an FK to
--     orders, because existing bKash rows carry non-orders ids in order_id.
--   * None of this activates card checkout — that stays gated by LAUNCH_MODE='live' + SSLCOMMERZ_SANDBOX=false.

-- ---------- orders ----------
CREATE TABLE IF NOT EXISTS public.orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id    text NOT NULL UNIQUE,
  product_name      text NOT NULL,
  amount            integer NOT NULL,
  currency          text NOT NULL DEFAULT 'BDT',
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','completed','failed','cancelled')),
  customer_name     text NOT NULL,
  customer_email    text NOT NULL,
  customer_phone    text NOT NULL,
  source_funnel     text,
  access_months     integer,
  activation_status text NOT NULL DEFAULT 'pending'
                    CHECK (activation_status IN ('pending','email_sent','activated')),
  user_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at           timestamptz,
  payment_reference text,
  payment_method    text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_user       ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created    ON public.orders(created_at);

-- ---------- order_items ----------
CREATE TABLE IF NOT EXISTS public.order_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sku        text NOT NULL,
  item_name  text NOT NULL,
  item_kind  text NOT NULL CHECK (item_kind IN ('access','addon')),
  amount_bdt numeric(10,2) NOT NULL,
  amount_usd numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, sku)
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

-- ---------- RLS: members read only their own; admins read all; writes are service-role only ----------
ALTER TABLE public.orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders owner read" ON public.orders;
CREATE POLICY "orders owner read" ON public.orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "orders admin read" ON public.orders;
CREATE POLICY "orders admin read" ON public.orders
  FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "order_items owner read" ON public.order_items;
CREATE POLICY "order_items owner read" ON public.order_items
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "order_items admin read" ON public.order_items;
CREATE POLICY "order_items admin read" ON public.order_items
  FOR SELECT TO authenticated USING (is_admin());
-- No INSERT/UPDATE/DELETE policies => only the service role (Edge Functions) can write.

-- ---------- Reconcile access_entitlements for the card upsert ----------
-- Full unique index on order_id: allows the existing bKash rows (distinct ids / nulls) and lets the IPN
-- fulfilment upsert with ON CONFLICT (order_id). No FK to orders (bKash rows hold non-orders ids here).
CREATE UNIQUE INDEX IF NOT EXISTS access_entitlements_order_id_key
  ON public.access_entitlements(order_id);

-- ---------- Atomic card fulfilment (single transaction, idempotent) ----------
-- Replaces the two separate writes in payment-ipn. Locks the order row so concurrent IPNs serialize.
CREATE OR REPLACE FUNCTION public.fulfill_card_order(
  p_transaction_id   text,
  p_user_id          uuid,
  p_payment_reference text,
  p_payment_method   text
) RETURNS text   -- 'completed' | 'already' | 'not_found'
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
      (order_id, user_id, customer_email, status, starts_at, ends_at, source)
  VALUES
      (o.id, p_user_id, lower(o.customer_email), 'active',
       v_paid, v_paid + make_interval(months => coalesce(o.access_months, 0)), 'card')
  ON CONFLICT (order_id) DO UPDATE SET
      user_id    = EXCLUDED.user_id,
      status     = 'active',
      starts_at  = EXCLUDED.starts_at,
      ends_at    = EXCLUDED.ends_at,
      source     = 'card';

  RETURN 'completed';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fulfill_card_order(text, uuid, text, text) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fulfill_card_order(text, uuid, text, text) TO service_role;
