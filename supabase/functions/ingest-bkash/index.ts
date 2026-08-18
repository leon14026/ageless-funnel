// Ingest a bKash "payment received" SMS forwarded by an iPhone Shortcut.
// Secret-gated (NOT the public anon key) + service role. Parses the TrxID + amount,
// stores it in public.bkash_payments (idempotent by TrxID); a DB trigger reconciles it
// against pending pre-orders (TrxID + EXACT amount) and flips matches to 'verified'.
//
// Self-contained (no shared imports) so it can be pasted into the Supabase dashboard editor.
// Deploy with "Enforce JWT verification" OFF -- auth is the x-ingest-secret header below.
//
// Call: POST /functions/v1/ingest-bkash
//   headers: x-ingest-secret: <BKASH_INGEST_SECRET>, Content-Type: application/json
//   body:    { "message": "<the raw bKash SMS text>" }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ingest-secret",
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

// Parse a bKash payment SMS. Verified against a real sample:
// "You have received Tk 5,000.00 from 01727217767. Fee Tk 0.00. Balance Tk 15,607.03. TrxID CI141ZCZBA at ..."
function parseBkashSms(raw: string) {
  const text = raw.replace(/\s+/g, " ").trim();

  // TrxID: the token after "TrxID" (bKash uses ~10 uppercase alphanumerics).
  const trxMatch = text.match(/TrxID[:\s]+([A-Za-z0-9]{6,15})/i);
  const trxId = trxMatch ? trxMatch[1].toUpperCase() : null;

  // Amount: the first "Tk <number>" that follows "received" (skips Fee/Balance amounts).
  let amount: number | null = null;
  const amtMatch = text.match(/received(?:\s+payment)?(?:\s+of)?\s+Tk\.?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (amtMatch) {
    const n = Number(amtMatch[1].replace(/,/g, ""));
    amount = Number.isFinite(n) ? n : null;
  }

  // Sender phone (optional).
  const fromMatch = text.match(/from\s+(\+?8?8?01\d{9})/i);
  const sender = fromMatch ? fromMatch[1] : null;

  return { trxId, amount, sender };
}

// Best-effort email alert via Resend. No-ops silently if not configured, and never
// throws (so a mail failure can't break ingestion).
async function notifyEmail(subject: string, text: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  const to = Deno.env.get("NOTIFY_EMAIL");
  if (!key || !to) return;
  const from = Deno.env.get("RESEND_FROM") || "Ageless Alerts <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!res.ok) console.error("email send failed:", res.status, await res.text());
  } catch (error) {
    console.error("email error:", error);
  }
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

const TIER_MONTHS: Record<string, number> = { "1": 1, "3": 3, "6": 6 };

// Find the auth user for this email, or invite them (sends the "set your password" email).
// Mirrors supabase/functions/payment-ipn/index.ts:findOrInviteUser.
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
    // Invited users have no password yet -> land on the set-password page (same one the
    // "forgot password" flow uses), then they log in. NOT the plain login page.
    redirectTo: "https://agelessbytulee.com/pages/auth/reset-password.html",
  });
  if (error) throw error;
  if (!data.user) throw new Error("Could not create the invited user.");
  return data.user;
}

// Grant access for a verified pre-order: create/invite the account + an access entitlement,
// then flip the pre-order to 'activated'. Idempotent (one entitlement per pre-order).
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

  // One entitlement per pre-order (order_id links back). Skip if it already exists.
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
    // --- Auth: shared secret only this Shortcut knows ---
    const provided = request.headers.get("x-ingest-secret") || "";
    if (provided !== requireEnv("BKASH_INGEST_SECRET")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await request.json().catch(() => ({}));
    const message = String(body?.message ?? body?.text ?? "").trim();
    if (!message) return json({ error: "Missing message" }, 400);

    // Only ingest money RECEIVED. Skip outgoing/other bKash SMS (bill payment, send money,
    // cash out, etc.) even if the Shortcut forwards them -- they contain a TrxID too.
    if (!/received/i.test(message)) {
      return json({ stored: false, skipped: true, reason: "not a received-payment SMS" }, 200);
    }

    const parsed = parseBkashSms(message);
    if (!parsed.trxId) {
      return json({ error: "Could not find a TrxID in the message", stored: false, message }, 422);
    }

    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    // Idempotent insert; the AFTER INSERT trigger reconciles against pre-orders.
    const { error: insErr } = await supabase.from("bkash_payments").insert({
      trx_id: parsed.trxId,
      amount_bdt: parsed.amount,
      sender_msisdn: parsed.sender,
      raw_message: message,
    });
    // 23505 = duplicate TrxID (SMS re-sent) -> already handled, treat as success.
    if (insErr && insErr.code !== "23505") {
      console.error("bkash insert failed:", insErr);
      return json({ error: "Could not store payment" }, 500);
    }
    const isNew = !insErr; // false when this SMS was already ingested (avoids duplicate alerts)

    // Read back the (possibly now-matched) row + the linked pre-order status.
    const { data: pay } = await supabase.from("bkash_payments")
      .select("trx_id, amount_bdt, status, matched_preorder_id")
      .eq("trx_id", parsed.trxId).single();

    let preorderStatus: string | null = null;
    if (pay?.matched_preorder_id) {
      const { data: pre } = await supabase.from("preorders")
        .select("status").eq("id", pay.matched_preorder_id).single();
      preorderStatus = pre?.status ?? null;
    }

    // Auto-grant access on a fresh match (common case: SMS arrives after the pre-order).
    let grant: unknown = null;
    if (isNew && pay?.status === "matched" && pay?.matched_preorder_id) {
      try {
        grant = await grantAccess(supabase, pay.matched_preorder_id);
        if ((grant as { granted?: boolean })?.granted) preorderStatus = "activated";
      } catch (error) {
        console.error("grant failed:", error);
        grant = { granted: false, reason: "exception" };
      }
    }

    // Email alert on a newly-received payment.
    if (isNew) {
      const amountStr = (pay?.amount_bdt ?? parsed.amount) ?? "?";
      const status = pay?.status ?? "unmatched";
      await notifyEmail(
        `bKash: Tk ${amountStr} received from ${parsed.sender ?? "unknown"}`,
        [
          "You received a bKash payment.",
          "",
          `Amount:  Tk ${amountStr}`,
          `From:    ${parsed.sender ?? "unknown"}`,
          `TrxID:   ${parsed.trxId}`,
          `Status:  ${status}${status === "matched" ? " (a pending pre-order was auto-verified)" : ""}`,
          "",
          `Raw SMS: ${message}`,
        ].join("\n"),
      );
    }

    return json({
      stored: true,
      trx_id: parsed.trxId,
      amount_bdt: pay?.amount_bdt ?? parsed.amount,
      payment_status: pay?.status ?? "unmatched",
      matched: pay?.status === "matched",
      preorder_status: preorderStatus,
      grant,
    });
  } catch (error) {
    console.error(error);
    return json({ error: "Server error" }, 500);
  }
});
