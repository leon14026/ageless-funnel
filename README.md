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

## Deferred to July / `live` phase

SSLCommerz Edge Functions + secrets, the member dashboard/auth area, an in-app admin page,
and converting `verified` pre-orders into `access_entitlements`.
