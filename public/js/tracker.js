/**
 * Progress Tracker Module
 * Ageless by Tulee
 *
 * CRUD operations for tracking calories, weight, and body measurements
 */

const Tracker = {
    /**
     * Add a new progress entry
     * @param {object} entryData - Entry data (weight, calories, measurements)
     * @returns {Promise<{data: object, error: object}>}
     */
    async addEntry(entryData) {
        const session = await Auth.getSession();
        if (!session) {
            return { data: null, error: { message: 'Not authenticated' } };
        }

        const { data, error } = await supabaseClient
            .from('progress_entries')
            .insert([{
                user_id: session.user.id,
                ...entryData
            }])
            .select();

        return { data, error };
    },

    /**
     * Get all entries for the current user
     * @param {number} limit - Maximum number of entries to fetch
     * @returns {Promise<{data: array, error: object}>}
     */
    async getEntries(limit = 30) {
        const { data, error } = await supabaseClient
            .from('progress_entries')
            .select('*')
            .order('entry_date', { ascending: false })
            .limit(limit);

        return { data, error };
    },

    /**
     * Get a single entry by ID
     * @param {string} id - Entry UUID
     * @returns {Promise<{data: object, error: object}>}
     */
    async getEntry(id) {
        const { data, error } = await supabaseClient
            .from('progress_entries')
            .select('*')
            .eq('id', id)
            .single();

        return { data, error };
    },

    /**
     * Update an existing entry
     * @param {string} id - Entry UUID
     * @param {object} updates - Fields to update
     * @returns {Promise<{data: object, error: object}>}
     */
    async updateEntry(id, updates) {
        const { data, error } = await supabaseClient
            .from('progress_entries')
            .update(updates)
            .eq('id', id)
            .select();

        return { data, error };
    },

    /**
     * Delete an entry
     * @param {string} id - Entry UUID
     * @returns {Promise<{error: object}>}
     */
    async deleteEntry(id) {
        const { error } = await supabaseClient
            .from('progress_entries')
            .delete()
            .eq('id', id);

        return { error };
    },

    /**
     * Calculate stats from entries
     * @returns {Promise<object|null>}
     */
    async getStats() {
        const { data, error } = await this.getEntries(90);

        if (error || !data || data.length === 0) {
            return null;
        }

        const latest = data[0];
        const oldest = data[data.length - 1];

        // Find latest and oldest entries that actually have each measurement
        const latestWithWeight = data.find(e => e.weight != null);
        const oldestWithWeight = [...data].reverse().find(e => e.weight != null);
        const latestWithWaist = data.find(e => e.waist != null);
        const oldestWithWaist = [...data].reverse().find(e => e.waist != null);

        // Calculate weight change between first and last entries that have weight
        let weightChange = null;
        if (latestWithWeight && oldestWithWeight && latestWithWeight !== oldestWithWeight) {
            weightChange = (latestWithWeight.weight - oldestWithWeight.weight).toFixed(1);
        }

        // Calculate waist change between first and last entries that have waist
        let waistChange = null;
        if (latestWithWaist && oldestWithWaist && latestWithWaist !== oldestWithWaist) {
            waistChange = (latestWithWaist.waist - oldestWithWaist.waist).toFixed(1);
        }

        return {
            totalEntries: data.length,
            latestEntry: latest,
            oldestEntry: oldest,
            currentWeight: latestWithWeight?.weight || null,
            weightChange: weightChange,
            currentWaist: latestWithWaist?.waist || null,
            waistChange: waistChange,
            periodDays: this.daysBetween(oldest.entry_date, latest.entry_date)
        };
    },

    /**
     * Calculate days between two dates
     * @param {string} date1
     * @param {string} date2
     * @returns {number}
     */
    daysBetween(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const diffTime = Math.abs(d2 - d1);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    },

    /**
     * Validate entry data
     * @param {object} entry
     * @returns {array} Array of error messages
     */
    validateEntry(entry) {
        const errors = [];

        if (entry.weight && (entry.weight < 20 || entry.weight > 500)) {
            errors.push('Weight must be between 20 and 500 kg');
        }

        if (entry.calories && (entry.calories < 0 || entry.calories > 10000)) {
            errors.push('Calories must be between 0 and 10,000');
        }

        const measurements = ['chest', 'waist', 'hips', 'thighs', 'arms'];
        measurements.forEach(m => {
            if (entry[m] && (entry[m] < 10 || entry[m] > 300)) {
                errors.push(`${m.charAt(0).toUpperCase() + m.slice(1)} must be between 10 and 300 cm`);
            }
        });

        return errors;
    },

    /**
     * Format date for display
     * @param {string} dateStr
     * @returns {string}
     */
    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
};

// Export globally
window.Tracker = Tracker;
