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
        return window.supabaseClient
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit || 50);
    },

    async initiatePayment() {
        throw new Error('Shop checkout is not enabled until server-side product SKUs are configured.');
    },

    async hasActiveEntitlement(userId) {
        if (!userId || !window.supabaseClient) return false;
        const now = new Date().toISOString();
        const { data, error } = await window.supabaseClient
            .from('access_entitlements')
            .select('status, ends_at')
            .eq('user_id', userId)
            .eq('status', 'active')
            .gte('ends_at', now)
            .limit(1);
        return !error && Array.isArray(data) && data.length > 0;
    },

    // Compatibility for older member pages while they migrate to entitlement naming.
    async hasActiveSubscription(userId) {
        return this.hasActiveEntitlement(userId);
    }
};

window.Payment = Payment;
