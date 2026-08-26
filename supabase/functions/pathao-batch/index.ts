// Daily batch: create Pathao courier orders for the first-50 paid "surprise band" gifts,
// then email a print-ready packing list to the fulfilment address.
//
// Secret-gated via x-batch-secret (verify_jwt off). Service-role. Idempotent: an order that
// already has a band_shipments row is never re-shipped. Test-tier orders never get a band.
//
// Trigger: pg_cron -> net.http_post daily (or curl for testing). Sandbox first, then live.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-batch-secret",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function requireEnv(name: string) {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}
// Pathao wants an 11-digit 01XXXXXXXXX number.
function normalizePhone(raw: string) {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("880")) return "0" + d.slice(3);
  if (d.length === 12 && d.startsWith("88")) return d.slice(2);
  return d.slice(-11);
}

const BAND_CAP = 50;

// ---- Pathao token (persisted in public.pathao_tokens) ----
// deno-lint-ignore no-explicit-any
async function getAccessToken(supabase: any, base: string) {
  const { data: tok } = await supabase.from("pathao_tokens").select("*").eq("id", 1).maybeSingle();
  if (tok?.access_token && tok.expires_at && new Date(tok.expires_at).getTime() > Date.now() + 60_000) {
    return tok.access_token;
  }
  const res = await fetch(`${base}/aladdin/api/v1/issue-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: requireEnv("PATHAO_CLIENT_ID"),
      client_secret: requireEnv("PATHAO_CLIENT_SECRET"),
      grant_type: "password",
      username: requireEnv("PATHAO_USERNAME"),
      password: requireEnv("PATHAO_PASSWORD"),
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.access_token) {
    throw new Error(`Pathao token failed: ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
  }
  const expiresAt = new Date(Date.now() + (Number(body.expires_in || 432000) - 300) * 1000).toISOString();
  await supabase.from("pathao_tokens").upsert({
    id: 1, access_token: body.access_token, refresh_token: body.refresh_token ?? null,
    expires_at: expiresAt, updated_at: new Date().toISOString(),
  });
  return body.access_token as string;
}

// deno-lint-ignore no-explicit-any
async function createPathaoOrder(base: string, token: string, storeId: number, pre: any) {
  const res = await fetch(`${base}/aladdin/api/v1/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({
      store_id: storeId,
      merchant_order_id: pre.id,
      recipient_name: String(pre.name || "").slice(0, 100),
      recipient_phone: normalizePhone(pre.phone),
      recipient_address: String(pre.address || "").slice(0, 220),
      delivery_type: 48,
      item_type: 2,
      item_quantity: 1,
      item_weight: 0.5,
      amount_to_collect: 0,
      item_description: "Ageless welcome gift (resistance band)",
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.data?.consignment_id) {
    return { ok: false as const, error: `${res.status} ${JSON.stringify(body).slice(0, 300)}` };
  }
  return { ok: true as const, consignment_id: body.data.consignment_id as string, order_status: body.data.order_status };
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

// Fixed pickup/sender details printed on every label (edit here if they change).
const FROM = { name: "Shape N' Shine", phone: "01841217767", address: "Banasree, Block C, Road 7, House 19" };

// Build the packing list as a PDF styled like a Pathao courier sticker:
// tracking-ID box + From (store) / To (customer) columns + COD; FOUR labels per page.
// deno-lint-ignore no-explicit-any
async function buildPackingPdf(rows: any[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, margin = 30, gap = 14, perPage = 4;
  const labelH = (H - margin * 2 - gap * (perPage - 1)) / perPage; // ~185
  const red = rgb(0.85, 0.12, 0.20);

  const wrap = (text: string, size: number, maxW: number) => {
    const words = String(text || "").split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const t = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(t, size) > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  };

  // deno-lint-ignore no-explicit-any
  let page: any = null;
  let slot = perPage; // force a new page for the first label

  const drawParty = (px: number, py: number, colW: number, header: string, name: string, phone: string, address: string) => {
    page.drawText(header, { x: px, y: py, size: 10, font: bold, color: red });
    let ly = py - 15;
    page.drawText(`Name: ${name}`, { x: px, y: ly, size: 9, font: bold }); ly -= 14;
    page.drawText(`Phone: ${phone}`, { x: px, y: ly, size: 9, font: bold }); ly -= 14;
    page.drawText("Address:", { x: px, y: ly, size: 9, font: bold }); ly -= 12;
    for (const ln of wrap(address, 8, colW - 6).slice(0, 3)) { page.drawText(ln, { x: px, y: ly, size: 8, font }); ly -= 11; }
  };

  rows.forEach((r) => {
    if (slot >= perPage) { page = doc.addPage([W, H]); slot = 0; }
    const x = margin, w = W - margin * 2;
    const top = H - margin - slot * (labelH + gap);
    const bottom = top - labelH;
    const cx = x + w / 2;

    page.drawRectangle({ x, y: bottom, width: w, height: labelH, borderColor: rgb(0, 0, 0), borderWidth: 1 });
    page.drawText("Pathao Courier", { x: x + w - 92, y: top - 15, size: 9, font: bold, color: red });

    const tbY = top - 34;
    page.drawRectangle({ x: x + 10, y: tbY, width: w - 20, height: 18, borderColor: rgb(0, 0, 0), borderWidth: 0.7 });
    page.drawText(`TRACKING ID:  ${r.consignment_id ?? ""}`, { x: x + 14, y: tbY + 6, size: 8, font: bold });

    page.drawLine({ start: { x: cx, y: tbY - 4 }, end: { x: cx, y: bottom + 26 }, thickness: 0.8, color: rgb(0, 0, 0) });

    const partyTop = tbY - 16;
    drawParty(x + 12, partyTop, w / 2 - 24, "From ,", FROM.name, FROM.phone, FROM.address);
    drawParty(cx + 12, partyTop, w / 2 - 24, "To,", String(r.name || ""), String(r.phone || ""), String(r.address || ""));

    page.drawText("Amount To Be Collected/COD:", { x: x + 12, y: bottom + 10, size: 8.5, font: bold });
    slot++;
  });

  return await doc.save();
}

// deno-lint-ignore no-explicit-any
async function sendPackingEmail(rows: any[]) {
  const key = Deno.env.get("RESEND_API_KEY");
  const toRaw = Deno.env.get("PACKING_EMAIL");
  if (!key || !toRaw || rows.length === 0) return;
  // PACKING_EMAIL may be a comma/semicolon-separated list (e.g. print shop + owner).
  const to = toRaw.split(/[,;]/).map((s) => s.trim()).filter(Boolean);

  const content = toBase64(await buildPackingPdf(rows));
  const escHtml = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const items = rows.map((r) => `<li>${escHtml(r.name)}</li>`).join("");
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;">
    <p><strong>${rows.length} order${rows.length === 1 ? "" : "s"} to ship today.</strong></p>
    <p>Packages (same order as the attached labels):</p>
    <ol>${items}</ol>
    <p>Labels attached: <strong>packing-list.pdf</strong> (4 per page).</p>
  </div>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Ageless Fulfilment <noreply@agelessbytulee.com>",
      to,
      subject: `Ageless: ${rows.length} band(s) to ship`,
      html,
      attachments: [{ filename: "packing-list.pdf", content }],
    }),
  });
  if (!res.ok) console.error("packing email failed:", res.status, await res.text());
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    if ((request.headers.get("x-batch-secret") || "") !== requireEnv("PATHAO_BATCH_SECRET")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const base = requireEnv("PATHAO_BASE_URL").replace(/\/+$/, "");
    const storeId = parseInt(requireEnv("PATHAO_STORE_ID"), 10);
    const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));

    // Cap: never exceed 50 shipments total.
    const { count: shippedCount } = await supabase.from("band_shipments").select("id", { count: "exact", head: true });
    const remaining = BAND_CAP - (shippedCount || 0);
    if (remaining <= 0) return json({ ok: true, shipped_total: shippedCount, created: 0, note: "cap reached" });

    // First-50 eligible: real paid orders with an address, oldest first, not already shipped.
    const { data: eligible } = await supabase.from("preorders")
      .select("id,name,phone,address,created_at,verified_at,status,tier")
      .in("status", ["verified", "activated"]).in("tier", ["1", "3", "6"])
      .not("address", "is", null)
      .order("verified_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .limit(BAND_CAP);
    const { data: existing } = await supabase.from("band_shipments").select("preorder_id");
    const shipped = new Set((existing || []).map((r: { preorder_id: string }) => r.preorder_id));
    const toShip = (eligible || []).filter((p: { id: string }) => !shipped.has(p.id)).slice(0, remaining);

    if (toShip.length === 0) return json({ ok: true, shipped_total: shippedCount, created: 0 });

    const token = await getAccessToken(supabase, base);
    const packed: unknown[] = [];
    let created = 0, failed = 0;

    for (const pre of toShip) {
      // Claim the slot first (unique on preorder_id) so a re-run can't duplicate.
      const claim = await supabase.from("band_shipments").insert({
        preorder_id: pre.id, recipient_name: pre.name, recipient_phone: pre.phone,
        recipient_address: pre.address, status: "pending",
      });
      if (claim.error) { if (claim.error.code === "23505") continue; failed++; continue; }

      const r = await createPathaoOrder(base, token, storeId, pre);
      if (r.ok) {
        await supabase.from("band_shipments").update({
          status: "created", pathao_consignment_id: r.consignment_id,
          pathao_status: r.order_status ?? null, shipped_at: new Date().toISOString(),
        }).eq("preorder_id", pre.id);
        packed.push({ name: pre.name, phone: pre.phone, address: pre.address, consignment_id: r.consignment_id });
        created++;
      } else {
        await supabase.from("band_shipments").update({ status: "failed", note: r.error }).eq("preorder_id", pre.id);
        failed++;
      }
    }

    // deno-lint-ignore no-explicit-any
    await sendPackingEmail(packed as any[]);
    return json({ ok: true, created, failed, shipped_total: (shippedCount || 0) + created });
  } catch (error) {
    console.error(error);
    return json({ error: String(error).slice(0, 300) }, 500);
  }
});
