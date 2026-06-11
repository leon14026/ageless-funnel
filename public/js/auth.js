/**
 * Authentication Module
 * Ageless by Tulee
 *
 * Handles user authentication with Supabase
 */

const Auth = {
    /**
     * Sign up with email and password
     * @param {string} email
     * @param {string} password
     * @param {string} fullName
     * @returns {Promise<{data: object, error: object}>}
     */
    async signUp(email, password, fullName) {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName
                }
            }
        });
        return { data, error };
    },

    /**
     * Sign in with email and password
     * @param {string} email
     * @param {string} password
     * @returns {Promise<{data: object, error: object}>}
     */
    async signIn(email, password) {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });
        return { data, error };
    },

    /**
     * Sign out the current user
     * @returns {Promise<{error: object}>}
     */
    async signOut() {
        const { error } = await supabaseClient.auth.signOut();
        if (!error) {
            window.location.href = '/index.html';
        }
        return { error };
    },

    /**
     * Get the current session
     * @returns {Promise<object|null>}
     */
    async getSession() {
        if (!window.supabaseClient) return null;
        const { data: { session } } = await supabaseClient.auth.getSession();
        return session;
    },

    /**
     * Get the current user
     * @returns {Promise<object|null>}
     */
    async getUser() {
        if (!window.supabaseClient) return null;
        const { data: { user } } = await supabaseClient.auth.getUser();
        return user;
    },

    /**
     * Listen to authentication state changes
     * @param {Function} callback
     * @returns {object} Subscription object
     */
    onAuthStateChange(callback) {
        if (!window.supabaseClient) return { data: { subscription: { unsubscribe() {} } } };
        return supabaseClient.auth.onAuthStateChange((event, session) => {
            callback(event, session);
        });
    },

    /**
     * Send password reset email
     * @param {string} email
     * @returns {Promise<{data: object, error: object}>}
     */
    async resetPassword(email) {
        const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/pages/auth/reset-password.html`
        });
        return { data, error };
    },

    /**
     * Update user's password (for password reset flow)
     * @param {string} newPassword
     * @returns {Promise<{data: object, error: object}>}
     */
    async updatePassword(newPassword) {
        const { data, error } = await supabaseClient.auth.updateUser({
            password: newPassword
        });
        return { data, error };
    },

    /**
     * Update user's profile metadata
     * @param {object} metadata - e.g., { full_name: 'New Name' }
     * @returns {Promise<{data: object, error: object}>}
     */
    async updateProfile(metadata) {
        const { data, error } = await supabaseClient.auth.updateUser({
            data: metadata
        });
        return { data, error };
    },

    /**
     * Get user's display name from metadata
     * @param {object} user
     * @returns {string}
     */
    getDisplayName(user) {
        if (!user) return 'Guest';
        return user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
    },

    /**
     * Sign in with Google OAuth
     * @returns {Promise<{data: object, error: object}>}
     */
    async signInWithGoogle() {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/pages/tracker/index.html`
            }
        });
        return { data, error };
    },

    /**
     * Sign in with Facebook OAuth
     * @returns {Promise<{data: object, error: object}>}
     */
    async signInWithFacebook() {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'facebook',
            options: {
                redirectTo: `${window.location.origin}/pages/tracker/index.html`
            }
        });
        return { data, error };
    }
};

// Export globally
window.Auth = Auth;
