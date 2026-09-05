import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireEnv } from "../_shared/http.ts";

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

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { paid_order_id: orderId },
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
    if (order.status === "completed") return new Response("Already processed.", { status: 200 });
    if (validation.tran_id !== transactionId ||
        validation.currency !== "BDT" ||
        Number(validation.amount) !== Number(order.amount)) {
      throw new Error("Payment details do not match the pending order.");
    }

    const user = await findOrInviteUser(supabase, order.customer_email.toLowerCase(), order.id);

    // Atomic fulfilment: marks the order completed AND grants the entitlement in one transaction
    // (row-locked, idempotent). Avoids the earlier split-write race where access could be granted
    // without the order being marked completed.
    const { data: outcome, error: fulfillError } = await supabase.rpc("fulfill_card_order", {
      p_transaction_id: transactionId,
      p_user_id: user.id,
      p_payment_reference: validationId,
      p_payment_method: validation.card_type || "online",
    });
    if (fulfillError) throw fulfillError;
    if (outcome === "not_found") throw new Error("Order not found for fulfilment.");

    return new Response("Payment verified.", { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("Payment verification failed.", { status: 400 });
  }
});
