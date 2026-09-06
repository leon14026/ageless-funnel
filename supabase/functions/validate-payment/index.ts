import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Inlined from _shared/http.ts so this function is self-contained and can be
// deployed by pasting this single file into the Supabase dashboard.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const { transaction_id: transactionId } = await request.json();
    if (!transactionId) return json({ error: "Missing transaction ID." }, 400);

    const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));

    // Rate-limit per transaction id: allows the success page's ~20 status polls, blocks hammering.
    const limit = await supabase.rpc("rate_limit_hit", {
      p_bucket: `validate:${String(transactionId)}`, p_max: 40, p_window_seconds: 600,
    });
    if (limit.data === false) return json({ error: "Too many requests. Please slow down." }, 429);

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
