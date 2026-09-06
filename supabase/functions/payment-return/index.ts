// Bridges SSLCommerz's POST redirect back to our static return pages.
//
// SSLCommerz sends the customer back to success_url / fail_url / cancel_url with an
// HTTP POST. Our return pages are static assets on Cloudflare, which only answer GET —
// a POST gets HTTP 405. This function accepts the POST (or GET), works out whether the
// payment succeeded, and issues a 303 redirect, which makes the browser follow with GET.
//
// Self-contained on purpose so it can be deployed by pasting this single file into the
// Supabase dashboard. Deploy with Verify JWT = OFF (SSLCommerz sends no auth header).

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

Deno.serve(async (request) => {
  const url = new URL(request.url);
  let tranId = url.searchParams.get("tran_id") || "";
  let status = (url.searchParams.get("status") || "").toUpperCase();
  const cancelledParam = url.searchParams.get("cancelled") === "true";

  // SSLCommerz posts the transaction fields as form data; query params are the fallback.
  if (request.method === "POST") {
    try {
      const form = await request.formData();
      tranId = String(form.get("tran_id") || tranId);
      status = String(form.get("status") || status).toUpperCase();
    } catch (_error) {
      // Keep whatever the query string gave us.
    }
  }

  const site = requireEnv("SITE_URL").replace(/\/$/, "");
  const cancelled = cancelledParam || status === "CANCELLED";
  const failed = cancelled || ["FAILED", "UNATTEMPTED", "EXPIRED"].includes(status);

  const destination = failed
    ? `${site}/pages/payment/signup-fail?tran_id=${encodeURIComponent(tranId)}` +
      (cancelled ? "&cancelled=true" : "")
    : `${site}/pages/payment/signup-success?tran_id=${encodeURIComponent(tranId)}`;

  // 303 See Other: the browser re-issues the request as a GET, which the static page serves.
  return new Response(null, { status: 303, headers: { Location: destination } });
});
