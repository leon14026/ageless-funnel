-- Fix: the column restriction from 20260908_hold_hardening.sql never took effect.
--
-- WHAT WENT WRONG
-- That migration ran REVOKE SELECT (gateway_meta, risk_level, ...) ON public.orders
-- FROM authenticated. It applied cleanly and changed nothing, because in Postgres
-- column privileges are ADDITIVE to table privileges, not subtractive. The roles
-- held table-wide SELECT (Supabase grants anon/authenticated/service_role on tables
-- in public), so revoking individual columns removed grants that were never there.
-- Revoking a privilege a role does not hold is a legitimate no-op: no error, no
-- warning, no effect. Confirmed against the live database on 2026-09-13:
--
--   has_column_privilege('authenticated','public.orders','card_no','SELECT')     -> true
--   has_column_privilege('authenticated','public.orders','gateway_meta','SELECT')-> true
--
-- THE CORRECT SHAPE
-- Drop the table-wide SELECT first, then grant back only the safe columns. After
-- this, the sensitive columns have no grant at any level.
--
-- WHY IT MATTERS
-- RLS restricts ROWS, not COLUMNS. The "orders owner read" policy lets a member
-- read their own order, which since the dispute-evidence work also means the full
-- SSLCommerz validation payload (gateway_meta, including store_id), their risk
-- score, masked card and acquirer ids. This was never cross-customer exposure -
-- RLS always confined a member to their own rows - but a member has no reason to
-- read the gateway's fraud scoring of their own payment.
--
-- No impact on current data: public.orders has 0 rows, as no card payment has
-- completed yet. This lands before card go-live.
--
-- NOT AFFECTED
--   service_role  - used by the Edge Functions, keeps full access
--   anon          - gets no SELECT at all; the RLS policy keys on auth.uid(),
--                   which is null for anon, so it could never read a row anyway
--   writes        - INSERT/UPDATE grants are left as they are; orders has no RLS
--                   write policy, so RLS blocks browser writes regardless

BEGIN;

REVOKE SELECT ON public.orders FROM authenticated, anon;

-- Everything except: gateway_meta, risk_level, risk_title, card_no, card_issuer,
-- bank_tran_id, store_amount, gateway_tran_date.
-- card_brand stays readable (VISA/MASTER is not sensitive), matching the intent of
-- the original hardening migration.
GRANT SELECT (
  id, transaction_id, product_name, amount, currency, status,
  customer_name, customer_email, customer_phone, source_funnel,
  access_months, activation_status, user_id, paid_at,
  payment_reference, payment_method, created_at, card_brand
) ON public.orders TO authenticated;

COMMIT;

-- Verify (should be f, f, f, t):
--   SELECT has_column_privilege('authenticated','public.orders','gateway_meta','SELECT'),
--          has_column_privilege('authenticated','public.orders','card_no','SELECT'),
--          has_column_privilege('anon','public.orders','transaction_id','SELECT'),
--          has_column_privilege('authenticated','public.orders','transaction_id','SELECT');
