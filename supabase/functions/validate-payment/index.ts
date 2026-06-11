import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, requireEnv } from "../_shared/http.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const { transaction_id: transactionId } = await request.json();
    if (!transactionId) return json({ error: "Missing transaction ID." }, 400);

    const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const { data: order, error } = await supabase.from("orders")
      .select("status, activation_status, amount, currency, access_months")
      .eq("transaction_id", String(transactionId))
      .single();
    if (error || !order) return json({ error: "Order not found." }, 404);

    return json(order);
  } catch (error) {
    console.error(error);
    return json({ error: "Could not check payment status." }, 400);
  }
});
