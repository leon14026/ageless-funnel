-- Two hardening items from an external review. Applied to osbaarjfafflzoftojbd on 2026-09-08.
--
-- 1. RLS restricts ROWS, not COLUMNS. The "orders owner read" policy lets a member read their own
--    order, which since the dispute-evidence work also means gateway_meta (the full SSLCommerz
--    validation payload, including store_id), their risk score, masked card and acquirer ids.
--    getOrderHistory already selects an explicit safe column list, so revoking these breaks
--    nothing; the service role used by the Edge Functions is unaffected by column grants.
--
-- 2. Drop the 4-arg fulfill_card_order. It existed only so the previously deployed payment-ipn
--    kept working while the 5-arg version rolled out; payment-ipn has since been redeployed.
--    Left in place it is a footgun: called with a NULL gateway it sees no risk_level, treats the
--    payment as safe ('0'), and would SILENTLY RELEASE A HELD ORDER - the exact control we added
--    to satisfy SSLCommerz's "hold and verify the customer" requirement.

REVOKE SELECT (gateway_meta, risk_level, risk_title, card_no, card_issuer,
               bank_tran_id, store_amount, gateway_tran_date)
  ON public.orders FROM authenticated;

REVOKE SELECT (gateway_meta, risk_level, risk_title, card_no, card_issuer,
               bank_tran_id, store_amount, gateway_tran_date)
  ON public.orders FROM anon;

DROP FUNCTION IF EXISTS public.fulfill_card_order(text, uuid, text, text);
