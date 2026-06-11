/**
 * Shared Funnel Checkout
 * Browser-safe catalog, persisted SPA state, and payment handoff.
 */
(function () {
    'use strict';

    const STORAGE_PREFIX = 'abt_checkout_';
    const PRICING = {
        plans: {
            '1': { sku: 'access_1_month', months: 1, name: '1 Month Access', usd: 49.99, bdt: 4999 },
            '3': { sku: 'access_3_months', months: 3, name: '3 Months Access', usd: 59.99, bdt: 5999 },
            '6': { sku: 'access_6_months', months: 6, name: '6 Months Access', usd: 74.99, bdt: 7499 }
        },
        addons: {
            bump: { sku: 'meal_prep_guide', name: '7-Day Meal Prep Guide', usd: 9.99, bdt: 999 },
            upsell: { sku: 'personal_nutrition_plan', name: 'Personal Nutrition Plan', usd: 14.99, bdt: 1499 },
            downsell: { sku: 'meal_plan_collection', name: 'Bangladeshi Meal Plan Collection', usd: 6.99, bdt: 699 }
        }
    };

    // ---- Launch mode (single source of truth, read-only over frozen CONFIG) ----
    function getLaunchMode() {
        var m = window.CONFIG && window.CONFIG.APP && window.CONFIG.APP.LAUNCH_MODE;
        if (m === 'demo' || m === 'preorder' || m === 'live') return m;
        // Back-compat fallback: legacy DEMO_MODE flag. DEMO_MODE === false => live (gateway).
        return (window.CONFIG && window.CONFIG.APP && window.CONFIG.APP.DEMO_MODE === false) ? 'live' : 'demo';
    }
    function isDemoMode() { return getLaunchMode() === 'demo'; }
    function isPreorderMode() { return getLaunchMode() === 'preorder'; }
    function isLiveMode() { return getLaunchMode() === 'live'; }

    function formatMoney(usd, bdt) {
        return '$' + Number(usd).toFixed(2) + ' / ৳' + Number(bdt).toLocaleString('en-US');
    }

    function validateBangladeshiPhone(phone) {
        return /^(?:\+?88)?01[3-9]\d{8}$/.test(String(phone || '').replace(/[\s-]/g, ''));
    }

    function getDefaultState() {
        return {
            selectedTier: '6',
            bumpSelected: false,
            upsellAccepted: false,
            downsellAccepted: false,
            customer: { name: '', email: '', phone: '' },
            payment: null,
            quizAnswers: {}
        };
    }

    function create(funnelId) {
        const storageKey = STORAGE_PREFIX + funnelId.toLowerCase();
        let saved = {};
        try {
            saved = JSON.parse(sessionStorage.getItem(storageKey) || '{}');
        } catch (error) {
            console.warn('Could not restore checkout state:', error);
        }

        const state = Object.assign(getDefaultState(), saved);
        state.customer = Object.assign(getDefaultState().customer, saved.customer || {});
        state.quizAnswers = Object.assign({}, saved.quizAnswers || {});

        function save() {
            sessionStorage.setItem(storageKey, JSON.stringify(state));
        }

        function resetAddons() {
            state.upsellAccepted = false;
            state.downsellAccepted = false;
            state.payment = null;
            save();
        }

        function getItems() {
            const items = [PRICING.plans[state.selectedTier] || PRICING.plans['6']];
            if (state.bumpSelected) items.push(PRICING.addons.bump);
            if (state.upsellAccepted) items.push(PRICING.addons.upsell);
            if (state.downsellAccepted) items.push(PRICING.addons.downsell);
            return items;
        }

        function getTotals() {
            return getItems().reduce(function (total, item) {
                total.usd += item.usd;
                total.bdt += item.bdt;
                return total;
            }, { usd: 0, bdt: 0 });
        }

        function toPaymentPayload() {
            return {
                funnel: funnelId,
                customer: Object.assign({}, state.customer),
                items: getItems().map(function (item) { return item.sku; })
            };
        }

        function getPlan() {
            return PRICING.plans[state.selectedTier] || PRICING.plans['6'];
        }

        // ---- Preorder (manual bKash/bank) submission ----
        // Sends only non-monetary fields; the DB trigger derives sku/amount server-side.
        async function submitPreorder(opts) {
            opts = opts || {};
            var method = opts.method;
            var reference = (opts.reference || '').trim() || null;

            // Persist confirmation state BEFORE navigating so the confirmation page renders.
            state.payment = {
                status: 'preorder_pending',
                method: method,
                reference: reference,
                tier: state.selectedTier,
                totals: { usd: getPlan().usd, bdt: getPlan().bdt }
            };
            save();

            if (!window.supabaseClient) {
                state.payment = null; save();
                throw new Error('Sign-ups are not available right now. Please contact support.');
            }

            var row = {
                funnel: funnelId,
                name: state.customer.name,
                email: state.customer.email,
                phone: state.customer.phone,
                tier: state.selectedTier,
                payment_method: method,
                txn_reference: reference
            };

            var res = await window.supabaseClient.from('preorders').insert(row);
            if (res.error) {
                if (res.error.code === '23505') {
                    // Already pre-ordered with this email — treat as success.
                    return { duplicate: true };
                }
                state.payment = null; save();
                console.error('Preorder insert failed:', res.error);
                throw new Error('Could not submit your pre-order. Please try again.');
            }
            return { ok: true };
        }

        // ---- Free waitlist submission ----
        async function submitWaitlist(opts) {
            opts = opts || {};
            if (!window.supabaseClient) {
                throw new Error('The waitlist is not available right now. Please contact support.');
            }
            var row = {
                funnel: funnelId,
                name: (opts.name || '').trim(),
                email: (opts.email || '').trim(),
                phone: (opts.phone || '').trim() || null,
                source: opts.source || 'funnel'
            };
            var res = await window.supabaseClient.from('waitlist').insert(row);
            if (res.error) {
                if (res.error.code === '23505') return { duplicate: true };
                console.error('Waitlist insert failed:', res.error);
                throw new Error('Could not add you to the waitlist. Please try again.');
            }
            return { ok: true };
        }

        async function completePayment(navigateTo) {
            if (isDemoMode()) {
                state.payment = {
                    transactionId: 'DEMO_' + Date.now(),
                    status: 'demo_verified',
                    totals: getTotals()
                };
                save();
                navigateTo('/checkout/confirmation');
                return;
            }

            if (isPreorderMode()) {
                // Preorder is submitted from the manual-payment UI via submitPreorder().
                throw new Error('Pre-order is submitted from the checkout form.');
            }

            if (!window.Payment || typeof window.Payment.initiateFunnelPayment !== 'function') {
                throw new Error('Secure payment is not configured.');
            }

            await window.Payment.initiateFunnelPayment(toPaymentPayload());
        }

        return {
            funnelId: funnelId,
            state: state,
            save: save,
            resetAddons: resetAddons,
            getItems: getItems,
            getTotals: getTotals,
            getPlan: getPlan,
            toPaymentPayload: toPaymentPayload,
            completePayment: completePayment,
            submitPreorder: submitPreorder,
            submitWaitlist: submitWaitlist
        };
    }

    function applyDemoMode() {
        const mode = getLaunchMode();
        const demo = mode === 'demo';
        document.body.classList.toggle('f-demo', demo);
        document.body.classList.toggle('f-production', !demo);
        document.body.classList.remove('f-mode-demo', 'f-mode-preorder', 'f-mode-live');
        document.body.classList.add('f-mode-' + mode);

        if (!demo || document.getElementById('fDemoBanner')) return;
        const banner = document.createElement('div');
        banner.id = 'fDemoBanner';
        banner.className = 'f-demo-banner';
        banner.textContent = 'Demo mode: checkout is simulated and placeholder claims may be visible.';
        document.body.prepend(banner);
    }

    async function syncAuthCtas() {
        if (!window.Auth || typeof window.Auth.getSession !== 'function') return;
        try {
            const session = await window.Auth.getSession();
            const guest = document.getElementById('navCtaGuest');
            const member = document.getElementById('navCtaMember');
            if (guest) guest.style.display = session ? 'none' : '';
            if (member) member.style.display = session ? '' : 'none';
        } catch (error) {
            console.warn('Could not update funnel auth navigation:', error);
        }
    }

    async function guardDashboard(loginUrl) {
        if (isDemoMode()) return true;

        if (!window.Auth || typeof window.Auth.getSession !== 'function') {
            window.location.href = loginUrl;
            return false;
        }

        const session = await window.Auth.getSession();
        if (!session) {
            window.location.href = loginUrl;
            return false;
        }

        if (!window.Payment || typeof window.Payment.hasActiveEntitlement !== 'function') {
            return false;
        }

        return window.Payment.hasActiveEntitlement(session.user.id);
    }

    window.FunnelCheckout = {
        PRICING: PRICING,
        create: create,
        getLaunchMode: getLaunchMode,
        isDemoMode: isDemoMode,
        isPreorderMode: isPreorderMode,
        isLiveMode: isLiveMode,
        formatMoney: formatMoney,
        validateBangladeshiPhone: validateBangladeshiPhone,
        applyDemoMode: applyDemoMode,
        syncAuthCtas: syncAuthCtas,
        guardDashboard: guardDashboard
    };
})();
