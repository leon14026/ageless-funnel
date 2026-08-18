-- Hidden ৳10 end-to-end test plan.
-- Lets a real person run the full funnel -> pay ৳10 bKash -> auto-verify -> auto-grant -> login.
-- Not shown on any pricing card; reachable only via the secret link #/checkout?tier=test.
-- Applied to project osbaarjfafflzoftojbd on 2026-08-18.

INSERT INTO public.preorder_prices (tier, sku, amount_bdt, amount_usd) VALUES
  ('test', 'access_test', 10, 0.10)
ON CONFLICT (tier) DO UPDATE
  SET sku = EXCLUDED.sku, amount_bdt = EXCLUDED.amount_bdt, amount_usd = EXCLUDED.amount_usd;

-- Allow the 'test' tier through the anon INSERT policy (email regex uses the escaping-proof [.]).
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
  );
