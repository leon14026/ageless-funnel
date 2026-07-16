/**
 * Flexible Weekly Program Module
 * Ageless by Tulee
 */

const Programs = {
    /**
     * Get all weeks with user's completion status
     * @returns {Promise<{data: array, error: object}>}
     */
    async getWeeksWithProgress() {
        const session = await Auth.getSession();

        // Get all published weeks
        const { data: weeks, error: weeksError } = await supabaseClient
            .from('program_weeks')
            .select('*')
            .eq('is_published', true)
            .order('week_number', { ascending: true });

        if (weeksError) {
            return { data: null, error: weeksError };
        }

        // Get user's progress if logged in
        let completedWeekIds = [];
        if (session?.user?.id) {
            const { data: progress } = await supabaseClient
                .from('user_program_progress')
                .select('week_id')
                .eq('user_id', session.user.id);

            if (progress) {
                completedWeekIds = progress.map(p => p.week_id);
            }
        }

        // Merge completion status
        const weeksWithProgress = weeks.map(week => ({
            ...week,
            isCompleted: completedWeekIds.includes(week.id)
        }));

        return { data: weeksWithProgress, error: null };
    },

    /**
     * Get single week with videos
     * @param {number} weekNumber
     * @returns {Promise<{data: object, error: object}>}
     */
    async getWeek(weekNumber) {
        const { data, error } = await supabaseClient
            .from('program_weeks')
            .select('*')
            .eq('week_number', weekNumber)
            .eq('is_published', true)
            .single();

        return { data, error };
    },

    /**
     * Get videos for a week
     * @param {string} weekId
     * @returns {Promise<{data: array, error: object}>}
     */
    async getWeekVideos(weekId) {
        const { data, error } = await supabaseClient
            .from('workout_videos')
            .select('*')
            .eq('week_id', weekId)
            .order('sort_order', { ascending: true });

        return { data, error };
    },

    /**
     * Check if a week is completed by current user
     * @param {string} weekId
     * @returns {Promise<boolean>}
     */
    async isWeekCompleted(weekId) {
        const session = await Auth.getSession();
        if (!session?.user?.id) return false;

        const { data } = await supabaseClient
            .from('user_program_progress')
            .select('id')
            .eq('user_id', session.user.id)
            .eq('week_id', weekId)
            .single();

        return !!data;
    },

    /**
     * Mark week as complete
     * @param {string} weekId
     * @returns {Promise<{success: boolean, error: object}>}
     */
    async markWeekComplete(weekId) {
        const session = await Auth.getSession();
        if (!session?.user?.id) {
            return { success: false, error: { message: 'Not authenticated' } };
        }

        const { error } = await supabaseClient
            .from('user_program_progress')
            .insert([{
                user_id: session.user.id,
                week_id: weekId,
                completed_at: new Date().toISOString()
            }]);

        if (error && error.code === '23505') {
            // Already completed (unique constraint)
            return { success: true, error: null };
        }

        return { success: !error, error };
    },

    /**
     * Unmark week (if user wants to redo)
     * @param {string} weekId
     * @returns {Promise<{success: boolean, error: object}>}
     */
    async unmarkWeekComplete(weekId) {
        const session = await Auth.getSession();
        if (!session?.user?.id) {
            return { success: false, error: { message: 'Not authenticated' } };
        }

        const { error } = await supabaseClient
            .from('user_program_progress')
            .delete()
            .eq('user_id', session.user.id)
            .eq('week_id', weekId);

        return { success: !error, error };
    },

    /**
     * Get user's overall progress
     * @returns {Promise<{completed: number, total: number, percentage: number}>}
     */
    async getProgress() {
        const session = await Auth.getSession();

        // Get total published weeks
        const { count: total } = await supabaseClient
            .from('program_weeks')
            .select('*', { count: 'exact', head: true })
            .eq('is_published', true);

        if (!session?.user?.id) {
            return { completed: 0, total: total || 16, percentage: 0 };
        }

        // Get completed weeks count
        const { count: completed } = await supabaseClient
            .from('user_program_progress')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', session.user.id);

        const totalWeeks = total || 16;
        const completedWeeks = completed || 0;
        const percentage = totalWeeks > 0 ? Math.round((completedWeeks / totalWeeks) * 100) : 0;

        return {
            completed: completedWeeks,
            total: totalWeeks,
            percentage
        };
    },

    /**
     * Extract YouTube embed URL from various formats
     * @param {string} url
     * @returns {string}
     */
    getYouTubeEmbedUrl(url) {
        if (!url) return '';

        // Already an embed URL
        if (url.includes('youtube.com/embed/')) {
            return url;
        }

        // Extract video ID from various formats
        let videoId = null;

        // youtu.be/VIDEO_ID
        const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
        if (shortMatch) {
            videoId = shortMatch[1];
        }

        // youtube.com/watch?v=VIDEO_ID
        const watchMatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
        if (watchMatch) {
            videoId = watchMatch[1];
        }

        // youtube.com/v/VIDEO_ID
        const vMatch = url.match(/youtube\.com\/v\/([a-zA-Z0-9_-]+)/);
        if (vMatch) {
            videoId = vMatch[1];
        }

        if (videoId) {
            return `https://www.youtube.com/embed/${videoId}`;
        }

        return url;
    },

    /**
     * Render week card for overview grid
     * @param {object} week
     * @returns {string}
     */
    renderWeekCard(week) {
        const completedClass = week.isCompleted ? 'completed' : '';
        const checkIcon = week.isCompleted ? '<span class="check-icon">✓</span>' : '';

        return `
            <a href="week.html?week=${week.week_number}" class="week-card ${completedClass}">
                <div class="week-number">Week ${week.week_number}</div>
                <h3 class="week-title">${week.title}</h3>
                ${week.description ? `<p class="week-description">${week.description}</p>` : ''}
                ${checkIcon}
            </a>
        `;
    },

    /**
     * Render video embed
     * @param {object} video
     * @returns {string}
     */
    renderVideo(video) {
        const embedUrl = this.getYouTubeEmbedUrl(video.youtube_url);
        const duration = video.duration_minutes ? `<span class="video-duration">${video.duration_minutes} min</span>` : '';

        return `
            <div class="video-item">
                <div class="video-container">
                    <iframe
                        src="${embedUrl}"
                        title="${video.title}"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen>
                    </iframe>
                </div>
                <div class="video-info">
                    <h4>${video.title}</h4>
                    ${duration}
                </div>
            </div>
        `;
    }
};

// Export globally
window.Programs = Programs;
