import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Inlined from _shared/http.ts so this function is self-contained and can be
// deployed by pasting this single file into the Supabase dashboard.
function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

/**
 * Best-effort alert to the owner (same Resend setup as ingest-bkash). Never throws: a mail
 * failure must not make us reject an IPN we have already acted on.
 */
async function notifyOwner(subject: string, text: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  const to = Deno.env.get("NOTIFY_EMAIL");
  if (!key || !to) {
    // Loud, because a held payment nobody is told about is money taken with no access given.
    console.error("notifyOwner SKIPPED: RESEND_API_KEY and/or NOTIFY_EMAIL are not set. Subject:", subject);
    return;
  }
  const from = Deno.env.get("RESEND_FROM") || "Ageless Alerts <noreply@agelessbytulee.com>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!res.ok) console.error("notifyOwner FAILED:", res.status, await res.text());
  } catch (error) {
    console.error("notifyOwner FAILED to send:", error);
  }
}

async function findOrInviteUser(supabase: ReturnType<typeof createClient>, email: string, orderId: string) {
  let pageNumber = 1;

  while (true) {
    const { data: page, error } = await supabase.auth.admin.listUsers({ page: pageNumber, perPage: 1000 });
    if (error) throw error;

    const existing = page.users.find((user) => user.email?.toLowerCase() === email);
    if (existing) return existing;
    if (page.users.length < 1000) break;

    pageNumber += 1;
  }

  // redirectTo lands the customer on the set-password page. Without it Supabase sends them
  // to the default Site URL, which signs them in but never lets them set a password —
  // so they could never log in again with email + password. Mirrors grant-access (bKash).
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { paid_order_id: orderId },
    redirectTo: "https://agelessbytulee.com/pages/auth/reset-password.html",
  });
  if (error) throw error;
  if (!data.user) throw new Error("Could not create the invited user.");
  return data.user;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed.", { status: 405 });

  try {
    const incoming = await request.formData();
    const transactionId = String(incoming.get("tran_id") || "");
    if (!transactionId) throw new Error("Missing transaction id.");
    const ipnStatus = String(incoming.get("status") || "").toUpperCase();

    const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));

    // Explicit failure/cancellation IPNs: mark the pending order so it doesn't sit stuck, then ack.
    if (ipnStatus === "FAILED" || ipnStatus === "CANCELLED") {
      await supabase.from("orders")
        .update({ status: ipnStatus === "CANCELLED" ? "cancelled" : "failed" })
        .eq("transaction_id", transactionId).eq("status", "pending");
      return new Response("Acknowledged.", { status: 200 });
    }

    const validationId = String(incoming.get("val_id") || "");
    if (!validationId) throw new Error("Missing validation data.");

    const storeId = requireEnv("SSLCOMMERZ_STORE_ID");
    const storePassword = requireEnv("SSLCOMMERZ_STORE_PASSWORD");
    const sandbox = Deno.env.get("SSLCOMMERZ_SANDBOX") !== "false";
    const validationBase = sandbox
      ? "https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php"
      : "https://securepay.sslcommerz.com/validator/api/validationserverAPI.php";
    const validationUrl = new URL(validationBase);
    validationUrl.searchParams.set("val_id", validationId);
    validationUrl.searchParams.set("store_id", storeId);
    validationUrl.searchParams.set("store_passwd", storePassword);
    validationUrl.searchParams.set("format", "json");

    const validationResponse = await fetch(validationUrl);
    const validation = await validationResponse.json();
    if (!validationResponse.ok || !["VALID", "VALIDATED"].includes(validation.status)) {
      throw new Error("SSLCommerz validation failed.");
    }

    const { data: order, error: orderError } = await supabase.from("orders")
      .select("*")
      .eq("transaction_id", transactionId)
      .single();
    if (orderError || !order) throw orderError || new Error("Order not found.");
    // A held order is ALSO status 'completed', so don't short-circuit on it: letting SSLCommerz's
    // retry fall through re-runs the held branch and gives the owner alert another chance to send.
    // fulfill_card_order returns 'held' idempotently and grants nothing, so re-entry is safe.
    if (order.status === "completed" && order.activation_status !== "on_hold") {
      return new Response("Already processed.", { status: 200 });
    }
    if (validation.tran_id !== transactionId ||
        validation.currency !== "BDT" ||
        Number(validation.amount) !== Number(order.amount)) {
      throw new Error("Payment details do not match the pending order.");
    }

    const user = await findOrInviteUser(supabase, order.customer_email.toLowerCase(), order.id);

    // Atomic fulfilment: marks the order completed AND grants the entitlement in one transaction
    // (row-locked, idempotent). Avoids the earlier split-write race where access could be granted
    // without the order being marked completed.
    // The whole validation response is stored on the order as chargeback evidence
    // (bank_tran_id, masked card_no, issuer, risk level, net store_amount...). SSLCommerz
    // never returns a full PAN or CVV, so nothing sensitive is persisted.
    const { data: outcome, error: fulfillError } = await supabase.rpc("fulfill_card_order", {
      p_transaction_id: transactionId,
      p_user_id: user.id,
      p_payment_reference: validationId,
      p_payment_method: validation.card_type || "online",
      p_gateway: validation,
    });
    if (fulfillError) throw fulfillError;
    if (outcome === "not_found") throw new Error("Order not found for fulfilment.");

    // SSLCommerz asks us to hold and verify the customer when risk_level = 1. The payment and
    // evidence are recorded, but no access is granted until it is released by hand.
    if (outcome === "held") {
      console.warn(`IPN ${transactionId} HELD for review (risk_level=${validation.risk_level}).`);
      await notifyOwner(
        `⚠️ Held for review: card payment ${transactionId}`,
        [
          `A card payment was flagged by SSLCommerz and is ON HOLD - no access has been granted.`,
          ``,
          `Transaction: ${transactionId}`,
          `Amount:      ${validation.amount} ${validation.currency}`,
          `Risk:        level ${validation.risk_level} (${validation.risk_title || "-"})`,
          `Card:        ${validation.card_no || "-"} ${validation.card_brand || ""} ${validation.card_issuer || ""}`,
          `Bank tran:   ${validation.bank_tran_id || "-"}`,
          ``,
          `Verify the customer, then release access by running in the Supabase SQL editor:`,
          `  select public.release_held_order(id) from public.orders where transaction_id = '${transactionId}';`,
        ].join("\n"),
      );
      return new Response("Held for review.", { status: 200 });
    }

    // 'refunded'/'not_grantable' are terminal: the payment is valid but the order must not be
    // granted (money already returned, or a lost race). Acknowledge so SSLCommerz stops retrying,
    // and log loudly so it can be reconciled by hand.
    if (outcome === "refunded" || outcome === "not_grantable") {
      console.error(`IPN for ${transactionId} not granted: ${outcome}. Needs manual review.`);
      await notifyOwner(
        `Card payment ${transactionId} not granted (${outcome})`,
        `An IPN arrived for ${transactionId} but access was not granted: ${outcome}. Needs manual reconciliation.`,
      );
      return new Response("Acknowledged.", { status: 200 });
    }

    return new Response("Payment verified.", { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("Payment verification failed.", { status: 400 });
  }
});
