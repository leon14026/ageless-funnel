/**
 * Auth Guard - Route Protection
 * Ageless by Tulee
 *
 * Protects pages that require authentication
 */

const AuthGuard = {
    loginUrl() {
        return new URL('../auth/login.html', window.location.href).href;
    },

    pricingUrl() {
        return new URL('/index.html#/pricing', window.location.href).href;
    },

    /**
     * Check if user is authenticated, redirect to login if not
     * @returns {Promise<boolean>}
     */
    async requireAuth() {
        if (window.CONFIG?.APP?.DEMO_MODE !== false) return true;
        const session = await Auth.getSession();
        if (!session) {
            sessionStorage.setItem('redirectAfterLogin', window.location.href);
            window.location.href = this.loginUrl();
            return false;
        }
        return true;
    },

    /**
     * Check if user has active term-access entitlement, redirect if not
     * @returns {Promise<boolean>}
     */
    async requireEntitlement() {
        if (window.CONFIG?.APP?.DEMO_MODE !== false) return true;
        const session = await Auth.getSession();
        if (!session) {
            sessionStorage.setItem('redirectAfterLogin', window.location.href);
            window.location.href = this.loginUrl();
            return false;
        }
        if (typeof Payment === 'undefined' || typeof Payment.hasActiveEntitlement !== 'function') {
            window.location.href = this.pricingUrl();
            return false;
        }
        const hasAccess = await Payment.hasActiveEntitlement(session.user.id);
        if (!hasAccess) {
            // Paid, but the gateway flagged it and access is held for a manual check. Sending this
            // person to the pricing page would look like their payment never landed.
            if (typeof Payment.getHeldOrder === 'function') {
                try {
                    const held = await Payment.getHeldOrder(session.user.id);
                    if (held) { this.showHeldNotice(); return false; }
                } catch (e) { /* fall through to the normal redirect */ }
            }
            window.location.href = this.pricingUrl();
            return false;
        }
        return true;
    },

    /** Full-page notice for a member whose payment is awaiting manual verification. */
    showHeldNotice() {
        document.body.innerHTML =
            '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.5rem;' +
            'font-family:Nunito,system-ui,sans-serif;background:#faf6f2;color:#2c2420;">' +
            '<div style="background:#fff;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.08);' +
            'max-width:480px;width:100%;padding:2.5rem 2rem;text-align:center;">' +
            '<div style="font-size:3rem;line-height:1;">&#128270;</div>' +
            '<h1 style="font-size:1.6rem;margin:.75rem 0 .5rem;">We&rsquo;re verifying your payment</h1>' +
            '<p style="color:#6b5f57;line-height:1.6;">Your payment went through and your account is set up. ' +
            'For security this one needs a quick manual check before we open your access &mdash; ' +
            '<strong>please don&rsquo;t pay again</strong>.</p>' +
            '<p style="color:#6b5f57;line-height:1.6;">We&rsquo;ll email you as soon as it&rsquo;s done, usually ' +
            'within one business day. Questions? <a href="mailto:support@agelessbytulee.com" ' +
            'style="color:#c96a80;">support@agelessbytulee.com</a></p>' +
            '<p style="margin-top:1.5rem;"><a href="/" style="color:#c96a80;">Back to Home</a></p>' +
            '</div></div>';
    },

    /**
     * Initialize auth guard on page load
     */
    async init() {
        // Check if this page is protected
        const isProtected = document.body.hasAttribute('data-protected');
        const requiresEntitlement = document.body.hasAttribute('data-requires-entitlement');

        if (isProtected) {
            // Legacy attribute name: protected member pages require an entitlement.
            if (requiresEntitlement) {
                const hasAccess = await this.requireEntitlement();
                if (!hasAccess) return;
            } else {
                // Just check authentication
                const isAuthenticated = await this.requireAuth();
                if (!isAuthenticated) return;
            }
        }

        // Get initial session and update navigation
        const session = await Auth.getSession();
        this.updateNavigation(session);

        // Listen for auth state changes
        Auth.onAuthStateChange((event, session) => {
            this.updateNavigation(session);

            // Handle sign out
            if (event === 'SIGNED_OUT' && isProtected) {
                window.location.href = this.loginUrl();
            }
        });
    },

    /**
     * Update navigation based on auth state
     * @param {object|null} session
     */
    updateNavigation(session) {
        const authNav = document.querySelector('.auth-nav');
        if (!authNav) return;

        if (session) {
            const displayName = Auth.getDisplayName(session.user);
            authNav.innerHTML = `
                <a href="/pages/account/profile.html" class="user-greeting">Hi, ${displayName}</a>
                <button class="btn btn-nav" onclick="Auth.signOut()">Logout</button>
            `;
        } else {
            authNav.innerHTML = `
                <a href="/pages/auth/login.html" class="btn btn-nav">Sign In</a>
            `;
        }
    },

    /**
     * Redirect to stored URL or default page after login
     */
    redirectAfterLogin() {
        const redirectUrl = sessionStorage.getItem('redirectAfterLogin');
        sessionStorage.removeItem('redirectAfterLogin');

        if (redirectUrl && !redirectUrl.includes('/auth/')) {
            window.location.href = redirectUrl;
        } else {
            window.location.href = '/pages/home/index.html';
        }
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    AuthGuard.init();
});

// Export globally
window.AuthGuard = AuthGuard;
