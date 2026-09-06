-- Fix: a customer could be permanently locked out of pre-ordering.
-- Applied to osbaarjfafflzoftojbd on 2026-09-06.
--
-- preorders has UNIQUE (email, funnel). If someone submitted once (e.g. a test entry with a
-- bogus TrxID) and later actually paid, the second insert failed with 23505 and the client
-- "treated it as success" - so the real TrxID was never stored, reconcile_bkash could never
-- match it, and the customer paid but never got access, while seeing a confirmation page.
--
-- submit_preorder() decides based on the existing row's status:
--   * no row                   -> insert                       -> 'created'
--   * pending / rejected       -> replace it (never paid for)  -> 'updated'
--   * verified / activated     -> leave the paid row alone     -> 'already_active'
--
-- The unpaid case is a DELETE + INSERT rather than an UPDATE, so the BEFORE INSERT pricing
-- trigger (set_preorder_amount: server-authoritative price + discount) and the AFTER INSERT
-- reconcile trigger both run exactly as on a first submission. That keeps ONE pricing path.
--
-- SECURITY DEFINER bypasses RLS, so the field validation from the anon INSERT policy is
-- re-implemented here verbatim - the client can still never set a price.

CREATE OR REPLACE FUNCTION public.submit_preorder(
  p_funnel         text,
  p_name           text,
  p_email          text,
  p_phone          text,
  p_address        text,
  p_tier           text,
  p_payment_method text,
  p_txn_reference  text,
  p_discount_code  text
) RETURNS text   -- 'created' | 'updated' | 'already_active'
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_funnel text := coalesce(p_funnel, 'A');
  v_name   text := btrim(coalesce(p_name, ''));
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_phone  text := btrim(coalesce(p_phone, ''));
  v_addr   text := nullif(btrim(coalesce(p_address, '')), '');
  v_ref    text := nullif(btrim(coalesce(p_txn_reference, '')), '');
  v_code   text := nullif(btrim(coalesce(p_discount_code, '')), '');
  existing public.preorders%ROWTYPE;
BEGIN
  -- ---- validation (mirrors the "preorders public insert" RLS policy) ----
  IF v_funnel <> 'A' THEN RAISE EXCEPTION 'invalid_funnel'; END IF;
  IF char_length(v_name) < 1 OR char_length(v_name) > 200 THEN RAISE EXCEPTION 'invalid_name'; END IF;
  IF char_length(v_email) > 320
     OR v_email !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;
  IF char_length(v_phone) < 6 OR char_length(v_phone) > 20 THEN RAISE EXCEPTION 'invalid_phone'; END IF;
  IF p_tier NOT IN ('1','3','6','test') THEN RAISE EXCEPTION 'invalid_tier'; END IF;
  IF p_payment_method NOT IN ('bkash','bank','card') THEN RAISE EXCEPTION 'invalid_payment_method'; END IF;
  IF v_ref IS NOT NULL AND char_length(v_ref) > 100 THEN RAISE EXCEPTION 'invalid_reference'; END IF;
  IF v_addr IS NOT NULL AND (char_length(v_addr) < 5 OR char_length(v_addr) > 220) THEN
    RAISE EXCEPTION 'invalid_address';
  END IF;
  IF v_code IS NOT NULL AND v_code !~ '^[A-Za-z0-9_-]{1,40}$' THEN RAISE EXCEPTION 'invalid_discount_code'; END IF;

  SELECT * INTO existing FROM public.preorders
    WHERE email = v_email AND funnel = v_funnel
    FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.preorders
      (funnel, name, email, phone, address, tier, payment_method, txn_reference, discount_code)
    VALUES
      (v_funnel, v_name, v_email, v_phone, v_addr, p_tier, p_payment_method, v_ref, v_code);
    RETURN 'created';
  END IF;

  -- Never touch an order that has already been paid for and granted.
  IF existing.status IN ('verified','activated') THEN
    RETURN 'already_active';
  END IF;

  -- Unpaid (pending / rejected): let them submit their real transaction reference.
  DELETE FROM public.preorders WHERE id = existing.id;

  INSERT INTO public.preorders
    (funnel, name, email, phone, address, tier, payment_method, txn_reference, discount_code)
  VALUES
    (v_funnel, v_name, v_email, v_phone, v_addr, p_tier, p_payment_method, v_ref, v_code);

  RETURN 'updated';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_preorder(text,text,text,text,text,text,text,text,text) FROM public;
GRANT  EXECUTE ON FUNCTION public.submit_preorder(text,text,text,text,text,text,text,text,text)
  TO anon, authenticated;
