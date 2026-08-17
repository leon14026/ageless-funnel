-- Interim bKash auto-verification (before SSLCommerz).
-- An iPhone Shortcut forwards each bKash "payment received" SMS to the `ingest-bkash`
-- Edge Function, which parses the TrxID + amount and inserts a row here (service role).
-- When a received payment's TrxID + EXACT amount matches a pending pre-order (customers
-- type the TrxID as preorders.txn_reference at checkout), the pre-order is flipped to
-- 'verified' automatically. Access/account creation stays manual for now.
-- Applied to project osbaarjfafflzoftojbd on 2026-08-17.

-- ---------- Ledger of money actually received in bKash ----------
CREATE TABLE IF NOT EXISTS public.bkash_payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trx_id              text NOT NULL,                 -- bKash TrxID, normalized upper(trim())
  amount_bdt          numeric(10,2),                 -- parsed from the SMS
  sender_msisdn       text,                          -- payer phone, if parsed
  raw_message         text,                          -- full SMS, for audit/debug
  received_at         timestamptz NOT NULL DEFAULT now(),
  status              text NOT NULL DEFAULT 'unmatched'
                      CHECK (status IN ('unmatched','matched','amount_mismatch')),
  matched_preorder_id uuid REFERENCES public.preorders(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bkash_payments_trx_unique UNIQUE (trx_id)   -- idempotent re-sends; one payment => one order
);

-- Normalize TrxID on the way in so the UNIQUE constraint + matching are case/space-insensitive.
CREATE OR REPLACE FUNCTION public.trg_bkash_normalize()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.trx_id := upper(trim(NEW.trx_id));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bkash_normalize_before_insert ON public.bkash_payments;
CREATE TRIGGER bkash_normalize_before_insert
  BEFORE INSERT ON public.bkash_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_bkash_normalize();

-- Fast reverse lookup of pre-orders by normalized typed reference.
CREATE INDEX IF NOT EXISTS idx_preorders_txnref_norm
  ON public.preorders (upper(trim(txn_reference)));

-- ---------- Two-way reconciliation (SMS may arrive before OR after the customer submits) ----------
-- Given a normalized TrxID, match a received payment to a pending pre-order on TrxID + EXACT amount.
CREATE OR REPLACE FUNCTION public.reconcile_bkash(p_trx text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trx text := upper(trim(p_trx));
  pay   public.bkash_payments%ROWTYPE;
  pre   public.preorders%ROWTYPE;
BEGIN
  IF v_trx IS NULL OR v_trx = '' THEN RETURN; END IF;

  -- The received payment for this TrxID that hasn't been matched yet.
  SELECT * INTO pay FROM public.bkash_payments
    WHERE trx_id = v_trx AND status <> 'matched'
    LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  -- A still-pending pre-order whose typed reference equals this TrxID (oldest first).
  SELECT * INTO pre FROM public.preorders
    WHERE upper(trim(txn_reference)) = v_trx AND status = 'pending'
    ORDER BY created_at ASC
    LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  IF pay.amount_bdt IS NOT NULL AND round(pay.amount_bdt) = pre.amount_bdt THEN
    UPDATE public.preorders
      SET status = 'verified', verified_at = now()
      WHERE id = pre.id AND status = 'pending';
    UPDATE public.bkash_payments
      SET status = 'matched', matched_preorder_id = pre.id
      WHERE id = pay.id;
  ELSE
    -- TrxID matched but amount is wrong/unparsed -> flag for manual review; do NOT verify.
    UPDATE public.bkash_payments
      SET status = 'amount_mismatch', matched_preorder_id = pre.id
      WHERE id = pay.id AND status = 'unmatched';
  END IF;
END;
$$;

-- Only the triggers (owner context) call this; never anon/authenticated directly.
REVOKE EXECUTE ON FUNCTION public.reconcile_bkash(text) FROM public, anon, authenticated;

-- Reconcile when a payment arrives.
CREATE OR REPLACE FUNCTION public.trg_bkash_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.reconcile_bkash(NEW.trx_id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS bkash_reconcile_after_insert ON public.bkash_payments;
CREATE TRIGGER bkash_reconcile_after_insert
  AFTER INSERT ON public.bkash_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_bkash_after_insert();

-- Reconcile when a pre-order arrives (payment may already be sitting unmatched).
CREATE OR REPLACE FUNCTION public.trg_preorder_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.txn_reference IS NOT NULL THEN
    PERFORM public.reconcile_bkash(upper(trim(NEW.txn_reference)));
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS preorder_reconcile_after_insert ON public.preorders;
CREATE TRIGGER preorder_reconcile_after_insert
  AFTER INSERT ON public.preorders
  FOR EACH ROW EXECUTE FUNCTION public.trg_preorder_after_insert();

-- ---------- Lock the ledger down: service role only ----------
ALTER TABLE public.bkash_payments ENABLE ROW LEVEL SECURITY;
-- No policies => anon/authenticated get nothing. Revoke any default grants too, for belt-and-braces.
REVOKE ALL ON public.bkash_payments FROM anon, authenticated;
