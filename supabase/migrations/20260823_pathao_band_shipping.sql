-- First-50 "surprise band" shipping via Pathao.
-- Adds a delivery address to pre-orders, a shipment ledger, and a Pathao token store.
-- Applied to project osbaarjfafflzoftojbd on 2026-08-23.

ALTER TABLE public.preorders ADD COLUMN IF NOT EXISTS address text;

-- Allow address through the anon INSERT policy (validated when present).
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
    AND (address IS NULL OR char_length(btrim(address)) BETWEEN 5 AND 220)
  );

CREATE TABLE IF NOT EXISTS public.band_shipments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preorder_id           uuid NOT NULL REFERENCES public.preorders(id) ON DELETE CASCADE,
  recipient_name        text,
  recipient_phone       text,
  recipient_address     text,
  pathao_consignment_id text,
  pathao_status         text,
  status                text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','created','failed')),
  note                  text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  shipped_at            timestamptz,
  CONSTRAINT band_shipments_preorder_unique UNIQUE (preorder_id)
);
ALTER TABLE public.band_shipments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.band_shipments FROM anon, authenticated;
CREATE POLICY "admins read band_shipments" ON public.band_shipments
  FOR SELECT TO authenticated USING (public.is_admin());
GRANT SELECT ON public.band_shipments TO authenticated;

CREATE TABLE IF NOT EXISTS public.pathao_tokens (
  id            integer PRIMARY KEY DEFAULT 1,
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pathao_tokens_singleton CHECK (id = 1)
);
ALTER TABLE public.pathao_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pathao_tokens FROM anon, authenticated;
