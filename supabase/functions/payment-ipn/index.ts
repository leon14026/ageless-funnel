import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireEnv } from "../_shared/http.ts";

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
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
    const validationId = String(incoming.get("val_id") || "");
    if (!transactionId || !validationId) throw new Error("Missing transaction validation data.");

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

    const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
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

    const paidAt = new Date();
    const user = await findOrInviteUser(supabase, order.customer_email.toLowerCase(), order.id);
    const { error: entitlementError } = await supabase.from("access_entitlements").upsert({
      order_id: order.id,
      user_id: user.id,
      customer_email: order.customer_email.toLowerCase(),
      status: "active",
      starts_at: paidAt.toISOString(),
      ends_at: addMonths(paidAt, Number(order.access_months)).toISOString(),
    }, { onConflict: "order_id" });
    if (entitlementError) throw entitlementError;

    const { error: updateError } = await supabase.from("orders").update({
      user_id: user.id,
      status: "completed",
      paid_at: paidAt.toISOString(),
      payment_reference: validationId,
      payment_method: validation.card_type || "online",
      activation_status: "email_sent",
    }).eq("id", order.id).eq("status", "pending");
    if (updateError) throw updateError;

    return new Response("Payment verified.", { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("Payment verification failed.", { status: 400 });
  }
});
