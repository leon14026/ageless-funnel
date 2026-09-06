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
            '3': { sku: 'access_3_months', months: 3, name: '3 Months Access', usd: 59.99, bdt: 5999, origUsd: 99.99, origBdt: 9999, discount: 40 },
            '6': { sku: 'access_6_months', months: 6, name: '6 Months Access', usd: 74.99, bdt: 7499, origUsd: 149.99, origBdt: 14999, discount: 50 },
            // Hidden end-to-end test plan. Not shown on any pricing card; reachable only via
            // the secret link #/checkout?tier=test. Pays ৳10 so a real person can run the
            // full pay -> auto-verify -> auto-grant -> login flow cheaply.
            'test': { sku: 'access_test', months: 1, name: 'Test Plan (৳10)', usd: 0.10, bdt: 10 }
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
            customer: { name: '', email: '', phone: '', address: '' },
            payment: null,
            quizAnswers: {},
            // Applied promo code, or null. Shape: { code, amount_bdt, amount_usd, label }.
            discount: null
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

        // Base plan price, or the discounted price when a promo code is applied.
        function getEffectivePlanPrice() {
            var plan = getPlan();
            if (state.discount && state.discount.code) {
                return { usd: Number(state.discount.amount_usd), bdt: Number(state.discount.amount_bdt) };
            }
            return { usd: plan.usd, bdt: plan.bdt };
        }

        function getTotals() {
            var eff = getEffectivePlanPrice();
            return getItems().reduce(function (total, item, idx) {
                // Item 0 is the base plan; apply the discount there. Addons are never discounted.
                var price = idx === 0 ? eff : item;
                total.usd += price.usd;
                total.bdt += price.bdt;
                return total;
            }, { usd: 0, bdt: 0 });
        }

        // ---- Promo code: preview (server-validated) ----
        // Calls the preview_discount RPC so the shown price + bKash amount reflect the code.
        // The set_preorder_amount trigger re-applies the same discount authoritatively on submit.
        async function applyDiscount(code) {
            var clean = (code || '').trim();
            if (!clean) { state.discount = null; save(); return { cleared: true }; }
            if (!window.supabaseClient) {
                return { ok: false, message: 'Discount codes are unavailable right now.' };
            }
            var res = await window.supabaseClient.rpc('preview_discount', {
                p_code: clean, p_tier: state.selectedTier
            });
            if (res.error) {
                console.warn('preview_discount failed:', res.error);
                return { ok: false, message: 'Could not check that code. Please try again.' };
            }
            var row = Array.isArray(res.data) ? res.data[0] : res.data;
            if (!row || !row.valid) {
                state.discount = null; save();
                return { ok: false, message: (row && row.message) || "That code isn't valid." };
            }
            state.discount = {
                code: clean,
                amount_bdt: Number(row.amount_bdt),
                amount_usd: Number(row.amount_usd),
                label: row.label
            };
            save();
            return { ok: true, message: row.message || 'Code applied.', discount: state.discount };
        }

        function clearDiscount() { state.discount = null; save(); }

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
                totals: { usd: getEffectivePlanPrice().usd, bdt: getEffectivePlanPrice().bdt }
            };
            save();

            if (!window.supabaseClient) {
                state.payment = null; save();
                throw new Error('Sign-ups are not available right now. Please email support@agelessbytulee.com.');
            }

            var row = {
                funnel: funnelId,
                name: state.customer.name,
                email: state.customer.email,
                phone: state.customer.phone,
                address: (state.customer.address || '').trim() || null,
                tier: state.selectedTier,
                payment_method: method,
                txn_reference: reference,
                discount_code: (state.discount && state.discount.code) ? state.discount.code : null
            };

            var res = await window.supabaseClient.from('preorders').insert(row);
            if (res.error) {
                if (res.error.code === '23505') {
                    // Already pre-ordered with this email — treat as success.
                    return { duplicate: true };
                }
                state.payment = null; save();
                // The set_preorder_amount trigger rejects a since-invalidated code with a
                // check_violation (23514). Clear it and tell the customer to re-check the price.
                var msg = res.error.message || '';
                if (res.error.code === '23514' || msg.indexOf('discount_invalid') !== -1) {
                    state.discount = null; save();
                    var m = msg.match(/discount_invalid:\s*(.+?)\s*$/);
                    var reason = m ? m[1] : 'Your discount code is no longer valid.';
                    var err = new Error(reason + ' It has been removed — please review the price and try again.');
                    err.discountInvalid = true;
                    throw err;
                }
                console.error('Preorder insert failed:', res.error);
                throw new Error('Could not submit your pre-order. Please try again.');
            }
            return { ok: true };
        }

        // ---- Free waitlist submission ----
        async function submitWaitlist(opts) {
            opts = opts || {};
            if (!window.supabaseClient) {
                throw new Error('The waitlist is not available right now. Please email support@agelessbytulee.com.');
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

        // ---- Quiz lead capture (best-effort; never blocks the funnel) ----
        // Saves the finished quiz + name/email gate so we keep leads who don't buy.
        async function submitQuiz(opts) {
            opts = opts || {};
            if (!window.supabaseClient) return { skipped: true };
            var email = (opts.email || '').trim();
            if (!email) return { skipped: true };
            var row = {
                funnel: funnelId,
                name: (opts.name || '').trim() || null,
                email: email,
                answers: opts.answers || {},
                source: opts.source || 'quiz'
            };
            var res = await window.supabaseClient.from('quiz_responses').insert(row);
            if (res.error) {
                console.warn('Quiz response insert failed:', res.error);
                return { error: res.error };
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
            getEffectivePlanPrice: getEffectivePlanPrice,
            applyDiscount: applyDiscount,
            clearDiscount: clearDiscount,
            toPaymentPayload: toPaymentPayload,
            completePayment: completePayment,
            submitPreorder: submitPreorder,
            submitWaitlist: submitWaitlist,
            submitQuiz: submitQuiz
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
            const login = document.getElementById('navCtaLogin');
            const loginM = document.getElementById('navCtaLoginMobile');
            const memberM = document.getElementById('navCtaMemberMobile');
            if (guest) guest.style.display = session ? 'none' : '';
            if (member) member.style.display = session ? '' : 'none';
            if (login) login.style.display = session ? 'none' : '';
            if (loginM) loginM.style.display = session ? 'none' : '';
            if (memberM) memberM.style.display = session ? '' : 'none';
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
