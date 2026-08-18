-- Accept overpayment. reconcile_bkash now matches when the received bKash amount is
-- AT LEAST the pre-order price (was exact equality). Underpayment still flags
-- amount_mismatch and is not auto-verified. Applied to osbaarjfafflzoftojbd 2026-08-18.
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

  SELECT * INTO pay FROM public.bkash_payments
    WHERE trx_id = v_trx AND status <> 'matched'
    LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO pre FROM public.preorders
    WHERE upper(trim(txn_reference)) = v_trx AND status = 'pending'
    ORDER BY created_at ASC
    LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  -- Overpayment is fine; only underpayment is flagged for manual review.
  IF pay.amount_bdt IS NOT NULL AND round(pay.amount_bdt) >= pre.amount_bdt THEN
    UPDATE public.preorders
      SET status = 'verified', verified_at = now()
      WHERE id = pre.id AND status = 'pending';
    UPDATE public.bkash_payments
      SET status = 'matched', matched_preorder_id = pre.id
      WHERE id = pay.id;
  ELSE
    UPDATE public.bkash_payments
      SET status = 'amount_mismatch', matched_preorder_id = pre.id
      WHERE id = pay.id AND status = 'unmatched';
  END IF;
END;
$$;
