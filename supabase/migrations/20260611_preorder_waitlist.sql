-- Beta preorder + waitlist capture for Funnel A (manual bKash/bank payment).
-- Applied to project osbaarjfafflzoftojbd on 2026-06-11.
-- Admin page deferred for beta: the owner verifies rows via the Supabase dashboard
-- (Table Editor uses the service role, which bypasses RLS).

-- ---------- Price lookup (server-authoritative) ----------
CREATE TABLE IF NOT EXISTS public.preorder_prices (
  tier        text PRIMARY KEY,
  sku         text NOT NULL,
  amount_bdt  integer NOT NULL,
  amount_usd  numeric(10,2) NOT NULL
);

INSERT INTO public.preorder_prices (tier, sku, amount_bdt, amount_usd) VALUES
  ('1', 'access_1_month',  4999, 49.99),
  ('3', 'access_3_months', 5999, 59.99),
  ('6', 'access_6_months', 7499, 74.99)
ON CONFLICT (tier) DO UPDATE
  SET sku = EXCLUDED.sku, amount_bdt = EXCLUDED.amount_bdt, amount_usd = EXCLUDED.amount_usd;

-- ---------- Waitlist ----------
CREATE TABLE IF NOT EXISTS public.waitlist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel      text NOT NULL DEFAULT 'A',
  name        text NOT NULL,
  email       text NOT NULL,
  phone       text,
  source      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT waitlist_email_funnel_unique UNIQUE (email, funnel)
);

-- ---------- Preorders ----------
CREATE TABLE IF NOT EXISTS public.preorders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel         text NOT NULL DEFAULT 'A',
  name           text NOT NULL,
  email          text NOT NULL,
  phone          text NOT NULL,
  tier           text NOT NULL REFERENCES public.preorder_prices(tier),
  sku            text,
  amount_bdt     integer,
  amount_usd     numeric(10,2),
  payment_method text NOT NULL CHECK (payment_method IN ('bkash','bank','card')),
  txn_reference  text,
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','verified','rejected','activated')),
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  verified_at    timestamptz,
  verified_by    uuid REFERENCES auth.users(id),
  CONSTRAINT preorders_email_funnel_unique UNIQUE (email, funnel)
);

-- ---------- Server-side price enforcement (clobbers any client-sent amounts) ----------
CREATE OR REPLACE FUNCTION public.set_preorder_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE p public.preorder_prices%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.preorder_prices WHERE tier = NEW.tier;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid tier: %', NEW.tier;
  END IF;
  NEW.sku        := p.sku;
  NEW.amount_bdt := p.amount_bdt;
  NEW.amount_usd := p.amount_usd;
  NEW.status      := 'pending';   -- never trust client-sent status / verification fields
  NEW.verified_at := NULL;
  NEW.verified_by := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_preorder_amount ON public.preorders;
CREATE TRIGGER trg_set_preorder_amount
  BEFORE INSERT ON public.preorders
  FOR EACH ROW EXECUTE FUNCTION public.set_preorder_amount();

-- Trigger fires on INSERT regardless of EXECUTE grant; block direct RPC calls.
REVOKE EXECUTE ON FUNCTION public.set_preorder_amount() FROM public, anon, authenticated;

-- ---------- Row Level Security: anon INSERT only, with field validation ----------
ALTER TABLE public.preorder_prices ENABLE ROW LEVEL SECURITY; -- no policy => no anon access (trigger is SECURITY DEFINER)
ALTER TABLE public.waitlist        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preorders       ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON public.waitlist  TO anon, authenticated;
GRANT INSERT ON public.preorders TO anon, authenticated;

CREATE POLICY "waitlist public insert" ON public.waitlist
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    funnel = 'A'
    AND char_length(name) BETWEEN 1 AND 200
    AND char_length(email) <= 320
    AND email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    AND (phone IS NULL OR char_length(phone) BETWEEN 6 AND 20)
    AND (source IS NULL OR char_length(source) <= 100)
  );

CREATE POLICY "preorders public insert" ON public.preorders
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    funnel = 'A'
    AND char_length(name) BETWEEN 1 AND 200
    AND char_length(email) <= 320
    AND email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    AND char_length(phone) BETWEEN 6 AND 20
    AND tier IN ('1','3','6')
    AND payment_method IN ('bkash','bank','card')
    AND char_length(coalesce(txn_reference, '')) <= 100
  );
-- No SELECT / UPDATE / DELETE policies: anon can create a row but never read, edit, or remove any.
