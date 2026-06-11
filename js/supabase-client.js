/**
 * Supabase Client Configuration
 * Ageless by Tulee
 *
 * Credentials are loaded from js/config.js
 * See js/config.example.js for setup instructions
 */

// Check if config is loaded
if (typeof window.CONFIG === 'undefined') {
    console.error('CONFIG not loaded. Make sure to include js/config.js before this script.');
}

// Check if Supabase library is loaded
if (typeof window.supabase === 'undefined') {
    console.error('Supabase library not loaded. Make sure to include the Supabase CDN script.');
}

// Initialize only when public runtime configuration is available.
const canInitializeSupabase = Boolean(
    window.supabase &&
    window.CONFIG?.SUPABASE_URL &&
    window.CONFIG?.SUPABASE_ANON_KEY
);
const supabaseClient = canInitializeSupabase
    ? window.supabase.createClient(window.CONFIG.SUPABASE_URL, window.CONFIG.SUPABASE_ANON_KEY)
    : null;

// Export globally for use in other modules
window.supabaseClient = supabaseClient;

// Log initialization status (remove in production)
if (supabaseClient) {
    console.log('Supabase client initialized');
} else {
    console.warn('Supabase client not initialized. Check your configuration.');
}
