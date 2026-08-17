// Ingest a bKash "payment received" SMS forwarded by an iPhone Shortcut.
// Secret-gated (NOT the public anon key) + service role. Parses the TrxID + amount,
// stores it in public.bkash_payments (idempotent by TrxID); a DB trigger reconciles it
// against pending pre-orders (TrxID + EXACT amount) and flips matches to 'verified'.
//
// Call: POST /functions/v1/ingest-bkash
//   headers: x-ingest-secret: <BKASH_INGEST_SECRET>, Content-Type: application/json
//   body:    { "message": "<the raw bKash SMS text>" }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, requireEnv } from "../_shared/http.ts";

// Parse a bKash payment SMS. Tuned to the common "You have received Tk N from 01... TrxID XXX at ..."
// shape; refine these regexes against a real sample if a field comes back null.
function parseBkashSms(raw: string) {
  const text = raw.replace(/\s+/g, " ").trim();

  // TrxID: the token after "TrxID" (bKash uses ~10 uppercase alphanumerics).
  const trxMatch = text.match(/TrxID[:\s]+([A-Za-z0-9]{6,15})/i);
  const trxId = trxMatch ? trxMatch[1].toUpperCase() : null;

  // Amount: the first "Tk <number>" that follows the word "received" (avoids Fee/Balance amounts).
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
    });
  } catch (error) {
    console.error(error);
    return json({ error: "Server error" }, 500);
  }
});
