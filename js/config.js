/**
 * Application Configuration  —  PUBLIC values only (safe to commit).
 *
 * This file ships to the browser. It must contain ONLY public, non-secret values:
 *   - Supabase URL + publishable (anon) key  → data is protected by RLS, not key secrecy
 *   - Supabase Functions URL                  → public endpoint base
 *   - Turnstile SITE key                      → public widget key
 *   - bKash / bank details                    → shown to customers anyway
 *
 * TRUE SECRETS NEVER GO HERE. They live only as Supabase Edge Function secrets:
 *   OPENAI_API_KEY, TURNSTILE_SECRET_KEY, the Supabase service-role key, SSLCommerz creds.
 */

const CONFIG = {
    // Supabase (project: ageless-funnel, ap-southeast-1 / Singapore)
    SUPABASE_URL: 'https://osbaarjfafflzoftojbd.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_-4Z1adKiTvDJMQiPqajb2w__T3FHmah',
    SUPABASE_FUNCTIONS_URL: 'https://osbaarjfafflzoftojbd.supabase.co/functions/v1',

    // Cloudflare Turnstile SITE key (public). Get it from the Turnstile dashboard.
    // The matching SECRET key goes in Supabase Edge Function secrets, never here.
    // TODO(owner): paste your Turnstile site key. AI preview stays disabled until set.
    TURNSTILE_SITE_KEY: '',

    // Manual pre-order payment details shown on the checkout page (preorder mode).
    // bKash only for the beta (no bank transfer yet).
    PAYMENT: {
        BKASH_NUMBER: '01727217767'
    },

    // Application Settings
    APP: {
        NAME: 'Ageless by Tulee',
        SUPPORT_URL: 'https://facebook.com/combatgymbytulee',
        // Launch mode: 'demo' | 'preorder' | 'live'. Beta launch = 'preorder'.
        LAUNCH_MODE: 'preorder',
        // Legacy flag kept for back-compat; LAUNCH_MODE is the source of truth.
        DEMO_MODE: false,
    }
};

// Freeze config to prevent accidental modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.APP);
Object.freeze(CONFIG.PAYMENT);

window.CONFIG = CONFIG;
