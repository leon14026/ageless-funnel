import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateItems } from "../_shared/catalog.ts";
import { corsHeaders, json, requireEnv } from "../_shared/http.ts";

const phonePattern = /^(?:\+?88)?01[3-9]\d{8}$/;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const payload = await request.json();
    const name = String(payload?.customer?.name || "").trim();
    const email = String(payload?.customer?.email || "").trim().toLowerCase();
    const phone = String(payload?.customer?.phone || "").replace(/[\s-]/g, "");
    if (!name || !email.includes("@") || !phonePattern.test(phone)) {
      return json({ error: "Enter a valid name, email, and Bangladeshi phone number." }, 400);
    }

    const items = validateItems(payload.items, Deno.env.get("ALLOW_CHECKOUT_ADDONS") === "true");
    const access = items.find((item) => item.kind === "access")!;
    const amount = items.reduce((total, item) => total + item.bdt, 0);
    const transactionId = `ABT_${Date.now()}_${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const siteUrl = requireEnv("SITE_URL").replace(/\/$/, "");
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const supabase = createClient(supabaseUrl, requireEnv("SUPABASE_SERVICE_ROLE_KEY"));

    const { data: order, error: orderError } = await supabase.from("orders").insert({
      transaction_id: transactionId,
      product_name: access.name,
      amount,
      currency: "BDT",
      status: "pending",
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      source_funnel: String(payload.funnel || "unknown"),
      access_months: access.months,
      activation_status: "pending",
    }).select("id").single();
    if (orderError) throw orderError;

    const { error: itemError } = await supabase.from("order_items").insert(items.map((item) => ({
      order_id: order.id,
      sku: item.sku,
      item_name: item.name,
      item_kind: item.kind,
      amount_bdt: item.bdt,
      amount_usd: item.usd,
    })));
    if (itemError) throw itemError;

    const form = new FormData();
    const gatewayFields: Record<string, string> = {
      store_id: requireEnv("SSLCOMMERZ_STORE_ID"),
      store_passwd: requireEnv("SSLCOMMERZ_STORE_PASSWORD"),
      total_amount: String(amount),
      currency: "BDT",
      tran_id: transactionId,
      success_url: `${siteUrl}/pages/payment/signup-success.html?tran_id=${transactionId}`,
      fail_url: `${siteUrl}/pages/payment/signup-fail.html?tran_id=${transactionId}`,
      cancel_url: `${siteUrl}/pages/payment/signup-fail.html?cancelled=true&tran_id=${transactionId}`,
      ipn_url: `${supabaseUrl}/functions/v1/payment-ipn`,
      cus_name: name,
      cus_email: email,
      cus_phone: phone,
      cus_add1: "Bangladesh",
      cus_city: "Dhaka",
      cus_country: "Bangladesh",
      product_name: access.name,
      product_category: "term_access",
      product_profile: "general",
      shipping_method: "NO",
      num_of_item: "1",
    };
    Object.entries(gatewayFields).forEach(([key, value]) => form.append(key, value));

    const sandbox = Deno.env.get("SSLCOMMERZ_SANDBOX") !== "false";
    const gatewayUrl = sandbox
      ? "https://sandbox.sslcommerz.com/gwprocess/v4/api.php"
      : "https://securepay.sslcommerz.com/gwprocess/v4/api.php";
    const gatewayResponse = await fetch(gatewayUrl, { method: "POST", body: form });
    const gateway = await gatewayResponse.json();
    if (!gatewayResponse.ok || gateway.status !== "SUCCESS" || !gateway.GatewayPageURL) {
      await supabase.from("orders").update({ status: "failed" }).eq("id", order.id);
      throw new Error(gateway.failedreason || "Payment gateway rejected the request.");
    }

    return json({ transaction_id: transactionId, gateway_url: gateway.GatewayPageURL });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Could not initiate payment." }, 400);
  }
});
