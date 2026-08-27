-- Discount codes for the Ageless pre-order checkout.
-- Applied to project osbaarjfafflzoftojbd on 2026-08-28.
--
-- Prices are server-authoritative: set_preorder_amount() (BEFORE INSERT) copies the price from
-- preorder_prices, and reconcile_bkash() auto-verifies only when the paid bKash amount is >= the
-- stored preorders.amount_bdt. A discount therefore CANNOT be display-only: it must lower the stored
-- amount_bdt server-side. This migration adds:
--   * discount_codes         - the codes the owner manages from the table editor (service role)
--   * _calc_discount()       - shared validate+price helper (single source of truth)
--   * preview_discount()     - anon-callable wrapper the checkout calls to preview a code
--   * set_preorder_amount()  - extended to re-apply the same discount authoritatively on insert
--   * count_discount_use()   - increments used_count once, when a pre-order is verified/activated
--   * "preorders public insert" - re-created preserving the live rules, plus a discount_code allowance
-- reconcile_bkash() needs NO change: it already compares the paid amount against the (now discounted)
-- amount_bdt.

-- ---------- Codes table (service-role only) ----------
CREATE TABLE IF NOT EXISTS public.discount_codes (
  code             text PRIMARY KEY,                 -- stored UPPER-cased
  kind             text NOT NULL CHECK (kind IN ('percent','fixed')),
  value            numeric NOT NULL CHECK (value > 0), -- percent: 1-100 ; fixed: BDT off
  active           boolean NOT NULL DEFAULT true,
  expires_at       timestamptz,
  max_uses         integer CHECK (max_uses IS NULL OR max_uses > 0),
  used_count       integer NOT NULL DEFAULT 0,
  applies_to_tiers text[] NOT NULL DEFAULT ARRAY['1','3','6'],  -- never 'test'
  label            text,                             -- optional friendly label
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discount_percent_range CHECK (kind <> 'percent' OR (value >= 1 AND value <= 100))
);

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
-- No policies => anon/authenticated get no access. The service role (Supabase table editor) bypasses RLS.

-- ---------- Preorder bookkeeping columns ----------
ALTER TABLE public.preorders
  ADD COLUMN IF NOT EXISTS discount_code       text,
  ADD COLUMN IF NOT EXISTS original_amount_bdt integer,
  ADD COLUMN IF NOT EXISTS discount_counted    boolean NOT NULL DEFAULT false;

-- ---------- Shared validate + price helper (single source of truth) ----------
-- Returns the discounted price for (code, tier) WITHOUT touching used_count. Used by both the
-- anon preview RPC and the insert trigger so the two can never disagree.
CREATE OR REPLACE FUNCTION public._calc_discount(
  p_code text,
  p_tier text,
  OUT valid boolean,
  OUT message text,
  OUT amount_bdt integer,
  OUT amount_usd numeric,
  OUT code text,
  OUT label text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pr public.preorder_prices%ROWTYPE;
  dc public.discount_codes%ROWTYPE;
  v_code text := upper(trim(coalesce(p_code, '')));
  ratio numeric;
  floor_bdt constant integer := 10;
  floor_usd constant numeric := 0.10;
BEGIN
  valid := false; message := NULL; code := NULL; label := NULL;
  amount_bdt := NULL; amount_usd := NULL;

  SELECT * INTO pr FROM public.preorder_prices WHERE tier = p_tier;
  IF NOT FOUND THEN message := 'Invalid plan.'; RETURN; END IF;

  IF v_code = '' THEN message := 'Enter a code.'; RETURN; END IF;

  SELECT * INTO dc FROM public.discount_codes t WHERE t.code = v_code;
  IF NOT FOUND THEN message := 'That code isn''t valid.'; RETURN; END IF;
  IF NOT dc.active THEN message := 'That code is no longer active.'; RETURN; END IF;
  IF dc.expires_at IS NOT NULL AND dc.expires_at < now() THEN
    message := 'That code has expired.'; RETURN;
  END IF;
  IF dc.max_uses IS NOT NULL AND dc.used_count >= dc.max_uses THEN
    message := 'That code has reached its limit.'; RETURN;
  END IF;
  IF NOT (p_tier = ANY (dc.applies_to_tiers)) THEN
    message := 'That code doesn''t apply to this plan.'; RETURN;
  END IF;

  IF dc.kind = 'percent' THEN
    ratio := (100 - dc.value) / 100.0;
    amount_bdt := round(pr.amount_bdt * ratio);
    amount_usd := round(pr.amount_usd * ratio, 2);
  ELSE  -- fixed BDT off; keep USD proportional to the BDT reduction
    amount_bdt := pr.amount_bdt - round(dc.value);
    amount_usd := round(pr.amount_usd * (GREATEST(amount_bdt, 0)::numeric / pr.amount_bdt), 2);
  END IF;

  IF amount_bdt < floor_bdt THEN amount_bdt := floor_bdt; END IF;
  IF amount_usd < floor_usd THEN amount_usd := floor_usd; END IF;

  valid := true;
  code := v_code;
  label := coalesce(dc.label, dc.code);
  message := 'Code applied.';
END;
$$;

-- The helper is internal; only the wrapper below is exposed to anon.
REVOKE EXECUTE ON FUNCTION public._calc_discount(text, text) FROM public, anon, authenticated;

-- ---------- Anon-callable preview ----------
CREATE OR REPLACE FUNCTION public.preview_discount(p_code text, p_tier text)
RETURNS TABLE (valid boolean, message text, amount_bdt integer, amount_usd numeric, label text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.valid, d.message, d.amount_bdt, d.amount_usd, d.label
  FROM public._calc_discount(p_code, p_tier) d;
$$;

REVOKE EXECUTE ON FUNCTION public.preview_discount(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.preview_discount(text, text) TO anon, authenticated;

-- ---------- Extend the server-authoritative price trigger ----------
CREATE OR REPLACE FUNCTION public.set_preorder_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.preorder_prices%ROWTYPE;
  d record;
  v_code text := upper(trim(coalesce(NEW.discount_code, '')));
BEGIN
  SELECT * INTO p FROM public.preorder_prices WHERE tier = NEW.tier;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid tier: %', NEW.tier;
  END IF;
  NEW.sku        := p.sku;
  NEW.amount_bdt := p.amount_bdt;
  NEW.amount_usd := p.amount_usd;
  -- never trust client-sent status / verification / discount-bookkeeping fields on insert
  NEW.status              := 'pending';
  NEW.verified_at         := NULL;
  NEW.verified_by         := NULL;
  NEW.original_amount_bdt := NULL;
  NEW.discount_counted    := false;

  IF v_code <> '' THEN
    SELECT * INTO d FROM public._calc_discount(v_code, NEW.tier);
    IF NOT d.valid THEN
      -- Aborts the insert; the client surfaces this and clears the applied code.
      RAISE EXCEPTION 'discount_invalid: %', d.message USING ERRCODE = 'check_violation';
    END IF;
    NEW.original_amount_bdt := p.amount_bdt;
    NEW.amount_bdt          := d.amount_bdt;
    NEW.amount_usd          := d.amount_usd;
    NEW.discount_code       := d.code;   -- normalized UPPER
  ELSE
    NEW.discount_code := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------- Count a redemption once, at verification (any path) ----------
CREATE OR REPLACE FUNCTION public.count_discount_use()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.discount_code IS NOT NULL
     AND NOT NEW.discount_counted
     AND NEW.status IN ('verified', 'activated')
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.discount_codes
      SET used_count = used_count + 1
      WHERE code = NEW.discount_code;
    NEW.discount_counted := true;   -- BEFORE UPDATE: set on NEW, no recursive write
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.count_discount_use() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_count_discount_use ON public.preorders;
CREATE TRIGGER trg_count_discount_use
  BEFORE UPDATE ON public.preorders
  FOR EACH ROW EXECUTE FUNCTION public.count_discount_use();

-- ---------- Re-create the anon INSERT policy: live rules verbatim + discount_code allowance ----------
DROP POLICY IF EXISTS "preorders public insert" ON public.preorders;
CREATE POLICY "preorders public insert" ON public.preorders
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    funnel = 'A'
    AND char_length(name) BETWEEN 1 AND 200
    AND char_length(email) <= 320
    AND email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
    AND char_length(phone) BETWEEN 6 AND 20
    AND tier IN ('1','3','6','test')
    AND payment_method IN ('bkash','bank','card')
    AND char_length(coalesce(txn_reference, '')) <= 100
    AND (address IS NULL OR (char_length(btrim(address)) BETWEEN 5 AND 220))
    AND (discount_code IS NULL OR discount_code ~ '^[A-Za-z0-9_-]{1,40}$')
  );
