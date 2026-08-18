// Grant member access for a verified pre-order. Called by the DB (pg_net) when a match is
// discovered on the pre-order side (paid-before-signup case). Creates/invites the account,
// inserts a 'preorder' access entitlement for the tier's months, and flips the pre-order to
// 'activated'. Idempotent (one entitlement per pre-order).
//
// Self-contained for the Supabase dashboard editor. Deploy with "Enforce JWT verification" OFF
// -- auth is the x-grant-secret header (matched against the GRANT_SECRET function secret).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-grant-secret",
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

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

const TIER_MONTHS: Record<string, number> = { "1": 1, "3": 3, "6": 6, "test": 1 };

// deno-lint-ignore no-explicit-any
async function findOrInviteUser(supabase: any, email: string, preorderId: string) {
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const existing = data.users.find((u: any) => u.email?.toLowerCase() === email);
    if (existing) return existing;
    if (data.users.length < 1000) break;
    page += 1;
  }
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { preorder_id: preorderId },
    redirectTo: "https://agelessbytulee.com/pages/auth/reset-password.html",
  });
  if (error) throw error;
  if (!data.user) throw new Error("Could not create the invited user.");
  return data.user;
}

// deno-lint-ignore no-explicit-any
async function grantAccess(supabase: any, preorderId: string) {
  const { data: pre } = await supabase.from("preorders")
    .select("id, email, tier, status").eq("id", preorderId).single();
  if (!pre) return { granted: false, reason: "preorder not found" };
  if (pre.status !== "verified") return { granted: false, reason: `status ${pre.status}` };

  const email = String(pre.email || "").toLowerCase().trim();
  if (!email) return { granted: false, reason: "no email" };
  const months = TIER_MONTHS[String(pre.tier)] ?? 1;

  const user = await findOrInviteUser(supabase, email, pre.id);

  const { data: existing } = await supabase.from("access_entitlements")
    .select("id").eq("order_id", pre.id).limit(1);
  if (!existing || existing.length === 0) {
    const now = new Date();
    const { error: entErr } = await supabase.from("access_entitlements").insert({
      user_id: user.id,
      customer_email: email,
      status: "active",
      starts_at: now.toISOString(),
      ends_at: addMonths(now, months).toISOString(),
      source: "preorder",
      order_id: pre.id,
    });
    if (entErr) return { granted: false, reason: `entitlement: ${entErr.message}` };
  }

  await supabase.from("preorders").update({ status: "activated" })
    .eq("id", pre.id).eq("status", "verified");

  return { granted: true, user_id: user.id, months };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const provided = request.headers.get("x-grant-secret") || "";
    if (provided !== requireEnv("GRANT_SECRET")) return json({ error: "Unauthorized" }, 401);

    const body = await request.json().catch(() => ({}));
    const preorderId = String(body?.preorder_id ?? "").trim();
    if (!preorderId) return json({ error: "Missing preorder_id" }, 400);

    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );
    const result = await grantAccess(supabase, preorderId);
    return json(result);
  } catch (error) {
    console.error(error);
    return json({ error: "Server error" }, 500);
  }
});
