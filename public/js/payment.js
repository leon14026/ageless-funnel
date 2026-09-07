/**
 * Secure payment client for Ageless by Tulee.
 * Gateway credentials and amount validation live in Supabase Edge Functions.
 */
const Payment = {
    get functionsUrl() {
        return window.CONFIG?.SUPABASE_FUNCTIONS_URL ||
            (window.CONFIG?.SUPABASE_URL ? window.CONFIG.SUPABASE_URL + '/functions/v1' : '');
    },

    get anonKey() {
        return window.CONFIG?.SUPABASE_ANON_KEY || '';
    },

    async callFunction(name, payload) {
        if (!this.functionsUrl || !this.anonKey) {
            throw new Error('Secure payment is not configured.');
        }

        const response = await fetch(this.functionsUrl + '/' + name, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: this.anonKey,
                Authorization: 'Bearer ' + this.anonKey
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Payment request failed.');
        }
        return data;
    },

    async initiateFunnelPayment(payload) {
        const result = await this.callFunction('initiate-payment', payload);
        if (!result.gateway_url) {
            throw new Error('Payment gateway did not return a checkout URL.');
        }
        window.location.href = result.gateway_url;
    },

    async getPaymentStatus(transactionId) {
        return this.callFunction('validate-payment', { transaction_id: transactionId });
    },

    getTransactionIdFromURL() {
        return new URLSearchParams(window.location.search).get('tran_id');
    },

    formatPrice(amount, currency) {
        const value = Number(amount || 0).toLocaleString('en-US');
        return currency === 'BDT' ? '\u09f3' + value : (currency || '$') + value;
    },

    async getOrderHistory(limit) {
        if (!window.supabaseClient) return { data: [], error: null };
        // Defense in depth: scope to the signed-in user explicitly, on top of the orders RLS policy.
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return { data: [], error: null };
        return window.supabaseClient
            .from('orders')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(limit || 50);
    },

    async initiatePayment() {
        throw new Error('Shop checkout is not enabled until server-side product SKUs are configured.');
    },

    /**
     * Active entitlements: lifetime (ends_at null) or a legacy timed grant not yet expired.
     * Filtering the expiry in JS keeps the "null means lifetime" rule in one obvious place.
     */
    async _activeEntitlements(userId) {
        if (!userId || !window.supabaseClient) return [];
        const { data, error } = await window.supabaseClient
            .from('access_entitlements')
            .select('status, starts_at, ends_at, months')
            .eq('user_id', userId)
            .eq('status', 'active');
        if (error || !Array.isArray(data)) return [];
        const now = Date.now();
        return data.filter(e => !e.ends_at || new Date(e.ends_at).getTime() >= now);
    },

    async hasActiveEntitlement(userId) {
        const rows = await this._activeEntitlements(userId);
        return rows.length > 0;
    },

    /**
     * Combined access scope for the content drip.
     * months     = widest tier bought (so an upgrade widens access rather than conflicting)
     * starts_at  = earliest grant (so an upgrade never restarts the drip clock)
     */
    async getEntitlement(userId) {
        const rows = await this._activeEntitlements(userId);
        if (!rows.length) return null;
        let months = 0;
        let startsAt = null;
        rows.forEach(e => {
            months = Math.max(months, Number(e.months) || 0);
            const t = e.starts_at ? new Date(e.starts_at).getTime() : null;
            if (t && (startsAt === null || t < startsAt)) startsAt = t;
        });
        // Unknown scope (e.g. a manual grant) falls back to the full programme.
        return { months: months || 6, starts_at: startsAt ? new Date(startsAt) : null };
    },

    // Compatibility for older member pages while they migrate to entitlement naming.
    async hasActiveSubscription(userId) {
        return this.hasActiveEntitlement(userId);
    }
};

window.Payment = Payment;
