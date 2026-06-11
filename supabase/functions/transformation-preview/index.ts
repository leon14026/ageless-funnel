// Public Edge Function: "future self" wellness photo preview.
// Ports demo-server.js logic to Supabase + adds Cloudflare Turnstile verification.
// Deploy with verify_jwt = false (public endpoint, abuse-gated by Turnstile).
//
// Required secrets (set in Supabase dashboard -> Edge Functions -> Secrets):
//   OPENAI_API_KEY         (required)
//   TURNSTILE_SECRET_KEY   (required - the function fails closed without it)
//   OPENAI_IMAGE_MODEL     (optional, defaults to gpt-image-1)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

const OPENAI_IMAGE_MODEL = Deno.env.get("OPENAI_IMAGE_MODEL") || "gpt-image-1";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EDIT_PROMPT = [
  "Create a subtle, realistic future wellness visualization of the adult woman in the uploaded photo.",
  "Preserve her identity, recognizable facial features, clothing, background, lighting, pose, and framing.",
  "Make the change modest and achievable: slightly leaner and fitter overall appearance, gently improved posture, and a subtly fresher appearance as if she looks and feels a few years younger.",
  "Preserve natural skin texture and realistic body proportions.",
  "Do not create dramatic weight loss, exaggerated muscles, artificial beauty-filter effects, cosmetic-procedure effects, wardrobe changes, heavy makeup changes, or unrealistic body reshaping.",
  "The result should look like the same person after sustainable movement, nutrition, and self-care habits.",
].join(" ");

async function verifyTurnstile(token: string, ip: string | null): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) {
    console.error("TURNSTILE_SECRET_KEY is not set; rejecting request.");
    return false; // fail closed
  }
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);

  try {
    const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
    });
    const data = await resp.json().catch(() => ({}));
    return Boolean(data && data.success);
  } catch (error) {
    console.error("Turnstile verification error:", (error as Error).message);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return json({ error: "Upload a JPEG, PNG, or WebP photo." }, 415);
    }

    const form = await req.formData();
    const email = String(form.get("email") || "").trim();
    const consent = String(form.get("consent") || "") === "true";
    const turnstileToken = String(
      form.get("turnstile_token") || form.get("cf-turnstile-response") || "",
    );
    const photo = form.get("photo");

    if (!turnstileToken) return json({ error: "Please complete the verification challenge." }, 400);
    const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for");
    if (!(await verifyTurnstile(turnstileToken, ip))) {
      return json({ error: "Verification failed. Please refresh and try again." }, 403);
    }

    if (!EMAIL_PATTERN.test(email)) return json({ error: "Enter a valid email address." }, 400);
    if (!consent) return json({ error: "Confirm that you are allowed to use this photo." }, 400);
    if (!(photo instanceof File)) {
      return json({ error: "Choose a photo before creating your preview." }, 400);
    }
    if (!ALLOWED_IMAGE_TYPES.has(photo.type)) {
      return json({ error: "Use a JPEG, PNG, or WebP photo." }, 415);
    }
    if (photo.size > MAX_IMAGE_BYTES) return json({ error: "Choose a photo smaller than 10 MB." }, 413);

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      console.error("OPENAI_API_KEY is not set.");
      return json({ error: "The preview service is not configured yet." }, 503);
    }

    const providerForm = new FormData();
    providerForm.append("model", OPENAI_IMAGE_MODEL);
    providerForm.append("image", photo, photo.name || "wellness-preview-input.webp");
    providerForm.append("prompt", EDIT_PROMPT);
    providerForm.append("n", "1");
    providerForm.append("size", "auto");
    providerForm.append("quality", "medium");
    providerForm.append("output_format", "webp");

    const providerResponse = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: providerForm,
    });
    const providerBody = await providerResponse.json().catch(() => ({}));

    if (!providerResponse.ok) {
      // Detailed reason stays server-side (visible in Supabase function logs); users see a generic message.
      console.error("OpenAI image edit failed:", providerResponse.status, JSON.stringify(providerBody?.error || {}));
      return json({ error: "The preview could not be generated. Please try again." }, 502);
    }

    const imageBase64 = providerBody?.data?.[0]?.b64_json;
    if (!imageBase64) {
      console.error("OpenAI image edit returned no image:", JSON.stringify(providerBody).slice(0, 500));
      return json({ error: "The preview could not be generated. Please try again." }, 502);
    }

    return json({ image_base64: imageBase64, mime_type: "image/webp" }, 200);
  } catch (error) {
    console.error("Transformation preview failed:", (error as Error).message);
    return json({ error: "The preview could not be generated. Please try again." }, 500);
  }
});
