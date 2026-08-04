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
            window.location.href = this.pricingUrl();
            return false;
        }
        return true;
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
