/**
 * Nutrition Module
 * Handles food search, calorie goals, and meal logging
 */

const Nutrition = {
    // CalorieNinjas API configuration
    // API key loaded from js/config.js
    API_URL: 'https://api.calorieninjas.com/v1/nutrition',
    get API_KEY() { return window.CONFIG?.CALORIE_NINJAS_API_KEY || ''; },

    // Activity level multipliers for TDEE calculation
    ACTIVITY_LEVELS: {
        sedentary: { value: 1.2, label: 'Sedentary (little or no exercise)' },
        light: { value: 1.375, label: 'Light (exercise 1-3 days/week)' },
        moderate: { value: 1.55, label: 'Moderate (exercise 3-5 days/week)' },
        active: { value: 1.725, label: 'Active (exercise 6-7 days/week)' },
        very_active: { value: 1.9, label: 'Very Active (hard exercise daily)' }
    },

    // Goal type configurations
    GOAL_TYPES: {
        weight_loss: { label: 'Weight Loss', calorieAdjust: -500, description: 'Lose ~0.5kg per week' },
        maintenance: { label: 'Maintenance', calorieAdjust: 0, description: 'Maintain current weight' },
        muscle_gain: { label: 'Muscle Gain', calorieAdjust: 300, description: 'Build muscle slowly' }
    },

    // ========================================
    // FOOD SEARCH
    // ========================================

    /**
     * Search for food - combines local DB and API results
     * @param {string} query - Search term
     * @returns {Promise<Array>} Combined search results
     */
    async searchFood(query) {
        if (!query || query.trim().length < 2) return [];

        // Get local results first (instant)
        const localResults = searchLocalFoods(query);

        // Try API if key is configured
        let apiResults = [];
        if (this.API_KEY) {
            try {
                apiResults = await this.searchAPI(query);
            } catch (error) {
                console.warn('API search failed, using local results only:', error);
            }
        }

        // Combine results, local first, then API (avoid duplicates)
        const seen = new Set(localResults.map(f => f.name.toLowerCase()));
        const uniqueApiResults = apiResults.filter(f => !seen.has(f.name.toLowerCase()));

        return [...localResults, ...uniqueApiResults].slice(0, 15);
    },

    /**
     * Search CalorieNinjas API
     * @param {string} query - Natural language food query
     * @returns {Promise<Array>} API results
     */
    async searchAPI(query) {
        if (!this.API_KEY) return [];

        try {
            const response = await fetch(`${this.API_URL}?query=${encodeURIComponent(query)}`, {
                method: 'GET',
                headers: {
                    'X-Api-Key': this.API_KEY
                }
            });

            if (!response.ok) throw new Error('API request failed');

            const data = await response.json();

            // Transform API response to our format
            return (data.items || []).map(item => ({
                name: item.name.charAt(0).toUpperCase() + item.name.slice(1),
                calories: Math.round(item.calories || 0),
                protein: Math.round((item.protein_g || 0) * 10) / 10,
                carbs: Math.round((item.carbohydrates_total_g || 0) * 10) / 10,
                fat: Math.round((item.fat_total_g || 0) * 10) / 10,
                serving_size: item.serving_size_g ? `${item.serving_size_g}g` : 'per serving',
                source: 'api'
            }));
        } catch (error) {
            console.error('CalorieNinjas API error:', error);
            return [];
        }
    },

    // ========================================
    // CALORIE GOAL CALCULATION
    // ========================================

    /**
     * Calculate BMR using Mifflin-St Jeor equation
     * @param {number} weight - Weight in kg
     * @param {number} height - Height in cm
     * @param {number} age - Age in years
     * @param {string} gender - 'female' or 'male'
     * @returns {number} Basal Metabolic Rate
     */
    calculateBMR(weight, height, age, gender) {
        // Mifflin-St Jeor Equation
        let bmr = (10 * weight) + (6.25 * height) - (5 * age);
        bmr += gender === 'female' ? -161 : 5;
        return Math.round(bmr);
    },

    /**
     * Calculate TDEE (Total Daily Energy Expenditure)
     * @param {number} bmr - Basal Metabolic Rate
     * @param {number} activityLevel - Activity multiplier (1.2 - 1.9)
     * @returns {number} TDEE
     */
    calculateTDEE(bmr, activityLevel) {
        return Math.round(bmr * activityLevel);
    },

    /**
     * Calculate daily calorie target based on goal
     * @param {Object} params - User parameters
     * @returns {Object} Calculated targets
     */
    calculateTargets(params) {
        const { weight, height, age, gender, activityLevel, goalType } = params;

        const bmr = this.calculateBMR(weight, height, age, gender);
        const tdee = this.calculateTDEE(bmr, activityLevel);
        const goalAdjust = this.GOAL_TYPES[goalType]?.calorieAdjust || 0;
        const dailyCalories = Math.max(1200, tdee + goalAdjust); // Minimum 1200 cal

        // Macro distribution (can be customized)
        // Default: 30% protein, 40% carbs, 30% fat
        const proteinPercent = 0.30;
        const carbsPercent = 0.40;
        const fatPercent = 0.30;

        return {
            bmr,
            tdee,
            dailyCalories,
            dailyProtein: Math.round((dailyCalories * proteinPercent) / 4), // 4 cal per gram
            dailyCarbs: Math.round((dailyCalories * carbsPercent) / 4), // 4 cal per gram
            dailyFat: Math.round((dailyCalories * fatPercent) / 9) // 9 cal per gram
        };
    },

    // ========================================
    // GOALS MANAGEMENT (Database)
    // ========================================

    /**
     * Get user's nutrition goals
     * @returns {Promise<Object>} Goals data or null
     */
    async getGoals() {
        try {
            const { data, error } = await supabaseClient
                .from('user_nutrition_goals')
                .select('*')
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
                console.error('Error fetching goals:', error);
                return null;
            }

            return data;
        } catch (error) {
            console.error('Error fetching goals:', error);
            return null;
        }
    },

    /**
     * Save user's nutrition goals (upsert)
     * @param {Object} goalData - Goal data to save
     * @returns {Promise<Object>} Result with data or error
     */
    async setGoals(goalData) {
        try {
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) return { data: null, error: { message: 'Not authenticated' } };

            const record = {
                user_id: user.id,
                goal_type: goalData.goalType,
                daily_calorie_target: goalData.dailyCalories,
                daily_protein_target: goalData.dailyProtein,
                daily_carbs_target: goalData.dailyCarbs,
                daily_fat_target: goalData.dailyFat,
                weight: goalData.weight,
                height: goalData.height,
                age: goalData.age,
                gender: goalData.gender,
                activity_level: goalData.activityLevel,
                updated_at: new Date().toISOString()
            };

            const { data, error } = await supabaseClient
                .from('user_nutrition_goals')
                .upsert(record, { onConflict: 'user_id' })
                .select()
                .single();

            return { data, error };
        } catch (error) {
            return { data: null, error };
        }
    },

    // ========================================
    // FOOD ENTRIES MANAGEMENT (Database)
    // ========================================

    /**
     * Add a food entry
     * @param {Object} entry - Food entry data
     * @returns {Promise<Object>} Result with data or error
     */
    async addFoodEntry(entry) {
        try {
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) return { data: null, error: { message: 'Not authenticated' } };

            const record = {
                user_id: user.id,
                entry_date: entry.date || new Date().toISOString().split('T')[0],
                meal_type: entry.mealType,
                food_name: entry.foodName,
                calories: entry.calories,
                protein: entry.protein,
                carbs: entry.carbs,
                fat: entry.fat,
                serving_size: entry.servingSize || null
            };

            const { data, error } = await supabaseClient
                .from('food_entries')
                .insert(record)
                .select()
                .single();

            return { data, error };
        } catch (error) {
            return { data: null, error };
        }
    },

    /**
     * Get food entries for a specific date
     * @param {string} date - Date in YYYY-MM-DD format
     * @returns {Promise<Object>} Result with data or error
     */
    async getFoodEntriesForDate(date) {
        try {
            const { data, error } = await supabaseClient
                .from('food_entries')
                .select('*')
                .eq('entry_date', date)
                .order('created_at', { ascending: true });

            return { data, error };
        } catch (error) {
            return { data: null, error };
        }
    },

    /**
     * Delete a food entry
     * @param {string} id - Entry ID
     * @returns {Promise<Object>} Result with error if any
     */
    async deleteFoodEntry(id) {
        try {
            const { error } = await supabaseClient
                .from('food_entries')
                .delete()
                .eq('id', id);

            return { error };
        } catch (error) {
            return { error };
        }
    },

    /**
     * Get daily totals for a specific date
     * @param {string} date - Date in YYYY-MM-DD format
     * @returns {Promise<Object>} Totals by meal and overall
     */
    async getDailyTotals(date) {
        const { data, error } = await this.getFoodEntriesForDate(date);

        if (error || !data) {
            return {
                total: { calories: 0, protein: 0, carbs: 0, fat: 0 },
                byMeal: {}
            };
        }

        const byMeal = {
            breakfast: { calories: 0, protein: 0, carbs: 0, fat: 0, entries: [] },
            lunch: { calories: 0, protein: 0, carbs: 0, fat: 0, entries: [] },
            dinner: { calories: 0, protein: 0, carbs: 0, fat: 0, entries: [] },
            snack: { calories: 0, protein: 0, carbs: 0, fat: 0, entries: [] }
        };

        const total = { calories: 0, protein: 0, carbs: 0, fat: 0 };

        data.forEach(entry => {
            const meal = entry.meal_type || 'snack';
            if (byMeal[meal]) {
                byMeal[meal].calories += entry.calories || 0;
                byMeal[meal].protein += entry.protein || 0;
                byMeal[meal].carbs += entry.carbs || 0;
                byMeal[meal].fat += entry.fat || 0;
                byMeal[meal].entries.push(entry);
            }

            total.calories += entry.calories || 0;
            total.protein += entry.protein || 0;
            total.carbs += entry.carbs || 0;
            total.fat += entry.fat || 0;
        });

        return { total, byMeal };
    },

    // ========================================
    // CUSTOM FOODS MANAGEMENT
    // ========================================

    /**
     * Add a custom food to user's library
     * @param {Object} food - Custom food data
     * @returns {Promise<Object>} Result with data or error
     */
    async addCustomFood(food) {
        try {
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) return { data: null, error: { message: 'Not authenticated' } };

            const record = {
                user_id: user.id,
                food_name: food.name,
                calories: food.calories,
                protein: food.protein || 0,
                carbs: food.carbs || 0,
                fat: food.fat || 0,
                serving_size: food.servingSize || null
            };

            const { data, error } = await supabaseClient
                .from('custom_foods')
                .insert(record)
                .select()
                .single();

            return { data, error };
        } catch (error) {
            return { data: null, error };
        }
    },

    /**
     * Get user's custom foods
     * @returns {Promise<Array>} Custom foods list
     */
    async getCustomFoods() {
        try {
            const { data, error } = await supabaseClient
                .from('custom_foods')
                .select('*')
                .order('food_name', { ascending: true });

            if (error) return [];
            return data || [];
        } catch (error) {
            return [];
        }
    },

    /**
     * Delete a custom food
     * @param {string} id - Custom food ID
     * @returns {Promise<Object>} Result with error if any
     */
    async deleteCustomFood(id) {
        try {
            const { error } = await supabaseClient
                .from('custom_foods')
                .delete()
                .eq('id', id);

            return { error };
        } catch (error) {
            return { error };
        }
    },

    // ========================================
    // UTILITY FUNCTIONS
    // ========================================

    /**
     * Format number with commas
     * @param {number} num - Number to format
     * @returns {string} Formatted number
     */
    formatNumber(num) {
        return num.toLocaleString();
    },

    /**
     * Calculate percentage
     * @param {number} value - Current value
     * @param {number} target - Target value
     * @returns {number} Percentage (0-100)
     */
    calculatePercentage(value, target) {
        if (!target || target === 0) return 0;
        return Math.min(100, Math.round((value / target) * 100));
    },

    /**
     * Get color class based on percentage
     * @param {number} percentage - Percentage value
     * @returns {string} CSS class name
     */
    getProgressColor(percentage) {
        if (percentage >= 100) return 'progress-over';
        if (percentage >= 80) return 'progress-near';
        return 'progress-good';
    },

    /**
     * Get today's date in YYYY-MM-DD format
     * @returns {string} Today's date
     */
    getToday() {
        return new Date().toISOString().split('T')[0];
    },

    /**
     * Format date for display
     * @param {string} dateStr - Date string
     * @returns {string} Formatted date
     */
    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    }
};

// Export globally
window.Nutrition = Nutrition;
