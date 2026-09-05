# Ageless by Tulee — Funnel A (beta)

Static marketing + pre-order funnel for **Ageless by Tulee**. Vanilla HTML/CSS/JS SPA
(hash routing) + Supabase (data + AI Edge Function). Program opens **July 2026**; this
beta collects **pre-orders (manual bKash / bank transfer)** and **free waitlist** sign-ups.
No card gateway (SSLCommerz) in the beta.

## Hosting

- **Frontend:** Cloudflare Pages (static; build command = none, output dir = repo root).
- **Backend:** Supabase project `osbaarjfafflzoftojbd` (region `ap-southeast-1`, Singapore).
- **Domain:** Namecheap → Cloudflare nameservers (attach the custom domain in Pages last).

## Launch mode

`js/config.js` → `APP.LAUNCH_MODE`: `'demo' | 'preorder' | 'live'`. Beta = **`'preorder'`**.
In preorder mode all synthetic/demo elements (`.f-demo-only`) auto-hide, the SSLCommerz
checkout (`.f-gateway-only`) is replaced by the manual-payment block (`.f-preorder-only`),
and card/international visitors are routed to the free waitlist.

## Configuration (public values, safe to commit — in `js/config.js`)

| Value | Status |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_FUNCTIONS_URL` | set |
| `TURNSTILE_SITE_KEY` | **TODO** — paste your Cloudflare Turnstile site key (AI preview stays off until set) |
| `PAYMENT.BKASH_NUMBER`, `PAYMENT.BANK_DETAILS` | **TODO** — fill real numbers before launch |

## Secrets (NEVER commit — set in Supabase → Edge Functions → Secrets)

- `OPENAI_API_KEY` — required for the AI "future self" preview.
- `TURNSTILE_SECRET_KEY` — required; the function fails closed without it.
- `OPENAI_IMAGE_MODEL` — optional (defaults to `gpt-image-1`; set to `gpt-image-2` to match the old local server).

## Supabase

- Migration: [supabase/migrations/20260611_preorder_waitlist.sql](supabase/migrations/20260611_preorder_waitlist.sql)
  — `preorders` + `waitlist` tables, server-side price trigger, anon-INSERT-only RLS. Already applied.
- Edge Function: [supabase/functions/transformation-preview/index.ts](supabase/functions/transformation-preview/index.ts)
  — public (`verify_jwt=false`), Turnstile-gated, calls OpenAI image edits. Already deployed.
- **Verifying pre-orders (beta):** there is no in-app admin page. Open the Supabase dashboard →
  Table Editor → `preorders`, check the `txn_reference` against money received, and flip `status`
  to `verified`/`rejected`. (Dashboard uses the service role, which bypasses RLS.)

## Deploy steps

1. Push this repo to GitHub.
2. Cloudflare Pages → connect the repo → deploy → test on the `*.pages.dev` URL.
3. Set the two Supabase Edge Function secrets; paste `TURNSTILE_SITE_KEY` + payment details into `config.js`; push.
4. In Supabase → Auth, add the `*.pages.dev` URL (and later the real domain) as Site URL / redirect URL.
5. **`images/for website.mp4` is ~25.3 MiB — just over Cloudflare Pages' 25 MiB per-file limit.**
   Compress it below 25 MiB (or move it to Cloudflare Stream/R2 / a video embed) before the Pages build,
   or that build will fail on that file.
6. Once verified on `*.pages.dev`: point Namecheap nameservers at Cloudflare and attach the custom domain.

## SSLCommerz card payments (go-live)

The card path is fully built but **gated** — it stays dormant while `LAUNCH_MODE='preorder'` and
`SSLCOMMERZ_SANDBOX` is unset. It never affects the live bKash preorder flow. Build/test on **sandbox**
first; the only step that touches real money is the final flip.

**Edge Function secrets (Supabase → Edge Functions → Secrets):**

- `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD` — your SSLCommerz store credentials
  (use the **sandbox** pair for testing, the **live** pair at go-live).
- `SSLCOMMERZ_SANDBOX` — leave **unset** (or any value ≠ `false`) to use `sandbox.sslcommerz.com`.
  Set to **`false`** only at go-live to use `securepay.sslcommerz.com`.
- `SITE_URL` = `https://agelessbytulee.com` (used to build the return URLs).
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — already set for the other functions.
- `ALLOW_CHECKOUT_ADDONS` — optional; `true` lets add-on SKUs through `validateItems`.

**Functions:** `initiate-payment`, `payment-ipn` (`verify_jwt=false`), `validate-payment`. Redeploy all
three after changing secrets: `supabase functions deploy <name>`.

**DB (already applied):** `orders` + `order_items` (RLS: owner/admin read, service-role write),
`fulfill_card_order()` (atomic, idempotent fulfilment), `rate_limits` + `rate_limit_hit()`,
`cancel_stale_orders()` (hourly cron, cancels pending > 2h), `revoke_card_order(order_id)` (refund helper —
call from the SQL editor to revoke access + mark the order `refunded`).

**Sandbox test (site stays on `preorder`):** call `initiate-payment` directly (curl with a test payload) →
open the returned `GatewayPageURL` → pay with a sandbox test card → confirm the IPN completes the order and
grants one `source='card'` entitlement, and the return page (`/pages/payment/signup-success`) shows success.

**Go-live checklist:**
1. Sandbox end-to-end passes (success + fail/cancel + duplicate-IPN idempotency).
2. Swap the two SSLCommerz secrets to the **live** pair; set `SSLCOMMERZ_SANDBOX=false`; redeploy the 3 functions.
3. In the SSLCommerz merchant panel, set the IPN URL to `<SUPABASE_URL>/functions/v1/payment-ipn`.
4. Flip `js/config.js` → `APP.LAUNCH_MODE` to `'live'`; push.
5. Do one real low-value live card order end-to-end, then confirm the entitlement, then open the doors.

**Note — promo codes are preorder-only by design.** The discount-code UI is `.f-preorder-only`, so it's
hidden in `live`/card mode and the card path applies no discount. If you later want promo codes on cards,
wire `_calc_discount`/`preview_discount` into `initiate-payment` and add a discount field to the gateway UI.

## Deferred to `live` phase

The member dashboard/auth area polish and an in-app admin page. (bKash pre-orders already convert to
`access_entitlements` automatically via `grant-access`; card orders via `fulfill_card_order`.)
