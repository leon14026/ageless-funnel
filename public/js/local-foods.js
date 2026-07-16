/**
 * Local Food Database - Bangladeshi/South Asian Foods
 * Pre-populated with common foods and their nutritional values
 * All values are approximate per serving
 */

const LOCAL_FOODS = [
    // === RICE DISHES ===
    { name: 'White Rice (1 cup cooked)', calories: 206, protein: 4.3, carbs: 45, fat: 0.4, category: 'rice' },
    { name: 'Brown Rice (1 cup cooked)', calories: 216, protein: 5, carbs: 45, fat: 1.8, category: 'rice' },
    { name: 'Fried Rice (1 cup)', calories: 350, protein: 8, carbs: 52, fat: 12, category: 'rice' },
    { name: 'Khichuri (1 cup)', calories: 280, protein: 10, carbs: 42, fat: 8, category: 'rice' },
    { name: 'Biryani - Chicken (1 plate)', calories: 490, protein: 22, carbs: 65, fat: 18, category: 'rice' },
    { name: 'Biryani - Mutton (1 plate)', calories: 550, protein: 25, carbs: 62, fat: 22, category: 'rice' },
    { name: 'Biryani - Vegetable (1 plate)', calories: 380, protein: 10, carbs: 68, fat: 10, category: 'rice' },
    { name: 'Pulao (1 cup)', calories: 320, protein: 7, carbs: 55, fat: 9, category: 'rice' },
    { name: 'Tehari (1 plate)', calories: 520, protein: 24, carbs: 60, fat: 20, category: 'rice' },

    // === BREADS ===
    { name: 'Roti/Chapati (1 piece)', calories: 71, protein: 3, carbs: 15, fat: 0.4, category: 'bread' },
    { name: 'Paratha - Plain (1 piece)', calories: 120, protein: 3, carbs: 14, fat: 6, category: 'bread' },
    { name: 'Paratha - Aloo (1 piece)', calories: 180, protein: 4, carbs: 22, fat: 9, category: 'bread' },
    { name: 'Paratha - Egg (1 piece)', calories: 220, protein: 8, carbs: 18, fat: 13, category: 'bread' },
    { name: 'Naan (1 piece)', calories: 262, protein: 9, carbs: 45, fat: 5, category: 'bread' },
    { name: 'Luchi (1 piece)', calories: 95, protein: 2, carbs: 12, fat: 5, category: 'bread' },
    { name: 'Porota (1 piece)', calories: 150, protein: 4, carbs: 20, fat: 7, category: 'bread' },
    { name: 'Puri (1 piece)', calories: 80, protein: 2, carbs: 10, fat: 4, category: 'bread' },
    { name: 'White Bread (1 slice)', calories: 79, protein: 3, carbs: 15, fat: 1, category: 'bread' },

    // === PROTEIN - CHICKEN ===
    { name: 'Chicken Curry (1 cup)', calories: 243, protein: 27, carbs: 6, fat: 12, category: 'protein' },
    { name: 'Chicken Bhuna (1 cup)', calories: 280, protein: 30, carbs: 5, fat: 15, category: 'protein' },
    { name: 'Chicken Korma (1 cup)', calories: 350, protein: 28, carbs: 10, fat: 22, category: 'protein' },
    { name: 'Chicken Roast (100g)', calories: 190, protein: 25, carbs: 3, fat: 9, category: 'protein' },
    { name: 'Chicken Rezala (1 cup)', calories: 320, protein: 26, carbs: 8, fat: 20, category: 'protein' },
    { name: 'Tandoori Chicken (1 piece)', calories: 180, protein: 26, carbs: 4, fat: 7, category: 'protein' },
    { name: 'Chicken Tikka (4 pieces)', calories: 200, protein: 28, carbs: 3, fat: 8, category: 'protein' },

    // === PROTEIN - FISH ===
    { name: 'Fish Curry - Ilish (1 cup)', calories: 220, protein: 20, carbs: 5, fat: 13, category: 'protein' },
    { name: 'Fish Curry - Rui (1 cup)', calories: 180, protein: 22, carbs: 5, fat: 8, category: 'protein' },
    { name: 'Fish Fry - Ilish (1 piece)', calories: 250, protein: 18, carbs: 8, fat: 16, category: 'protein' },
    { name: 'Fish Fry - Rui (1 piece)', calories: 200, protein: 20, carbs: 6, fat: 11, category: 'protein' },
    { name: 'Shrimp/Chingri Curry (1 cup)', calories: 190, protein: 24, carbs: 6, fat: 8, category: 'protein' },
    { name: 'Fish Bharta - Ilish (1/2 cup)', calories: 180, protein: 15, carbs: 3, fat: 12, category: 'protein' },

    // === PROTEIN - MEAT ===
    { name: 'Beef Curry (1 cup)', calories: 320, protein: 28, carbs: 8, fat: 20, category: 'protein' },
    { name: 'Beef Bhuna (1 cup)', calories: 350, protein: 30, carbs: 6, fat: 23, category: 'protein' },
    { name: 'Mutton Curry (1 cup)', calories: 340, protein: 26, carbs: 7, fat: 24, category: 'protein' },
    { name: 'Kala Bhuna (1 cup)', calories: 380, protein: 28, carbs: 8, fat: 26, category: 'protein' },
    { name: 'Keema/Mince Curry (1 cup)', calories: 290, protein: 24, carbs: 8, fat: 18, category: 'protein' },

    // === PROTEIN - EGGS ===
    { name: 'Boiled Egg (1 large)', calories: 78, protein: 6, carbs: 0.6, fat: 5, category: 'protein' },
    { name: 'Fried Egg (1 large)', calories: 92, protein: 6, carbs: 0.6, fat: 7, category: 'protein' },
    { name: 'Egg Curry (1 egg + gravy)', calories: 150, protein: 8, carbs: 5, fat: 11, category: 'protein' },
    { name: 'Egg Bhurji/Scrambled (2 eggs)', calories: 180, protein: 12, carbs: 3, fat: 13, category: 'protein' },
    { name: 'Omelette - Plain (2 eggs)', calories: 180, protein: 12, carbs: 1, fat: 14, category: 'protein' },
    { name: 'Omelette - Vegetable (2 eggs)', calories: 200, protein: 13, carbs: 4, fat: 14, category: 'protein' },

    // === DALS (LENTILS) ===
    { name: 'Dal - Masoor (1 cup)', calories: 230, protein: 18, carbs: 40, fat: 1, category: 'dal' },
    { name: 'Dal - Mung (1 cup)', calories: 210, protein: 14, carbs: 38, fat: 1, category: 'dal' },
    { name: 'Dal - Chana (1 cup)', calories: 270, protein: 15, carbs: 45, fat: 4, category: 'dal' },
    { name: 'Dal - Toor/Arhar (1 cup)', calories: 240, protein: 16, carbs: 42, fat: 1, category: 'dal' },
    { name: 'Dal Fry (1 cup)', calories: 180, protein: 12, carbs: 28, fat: 4, category: 'dal' },
    { name: 'Dal Tadka (1 cup)', calories: 200, protein: 13, carbs: 30, fat: 5, category: 'dal' },
    { name: 'Haleem (1 cup)', calories: 350, protein: 20, carbs: 35, fat: 14, category: 'dal' },

    // === VEGETABLES ===
    { name: 'Aloo Bhaji/Potato Curry (1 cup)', calories: 180, protein: 3, carbs: 30, fat: 6, category: 'vegetable' },
    { name: 'Aloo Bharta (1/2 cup)', calories: 150, protein: 2, carbs: 22, fat: 6, category: 'vegetable' },
    { name: 'Begun Bhaja/Fried Eggplant (3 pieces)', calories: 120, protein: 1, carbs: 8, fat: 9, category: 'vegetable' },
    { name: 'Shak/Leafy Greens (1 cup)', calories: 60, protein: 3, carbs: 8, fat: 2, category: 'vegetable' },
    { name: 'Mixed Vegetable Curry (1 cup)', calories: 150, protein: 4, carbs: 18, fat: 7, category: 'vegetable' },
    { name: 'Cabbage Bhaji (1 cup)', calories: 80, protein: 2, carbs: 10, fat: 4, category: 'vegetable' },
    { name: 'Cauliflower Curry (1 cup)', calories: 120, protein: 4, carbs: 12, fat: 6, category: 'vegetable' },
    { name: 'Bhindi/Okra Fry (1 cup)', calories: 110, protein: 2, carbs: 10, fat: 7, category: 'vegetable' },
    { name: 'Pumpkin Curry (1 cup)', calories: 100, protein: 2, carbs: 16, fat: 4, category: 'vegetable' },
    { name: 'Korola/Bitter Gourd (1 cup)', calories: 80, protein: 3, carbs: 8, fat: 4, category: 'vegetable' },

    // === SNACKS ===
    { name: 'Samosa (1 piece)', calories: 150, protein: 3, carbs: 18, fat: 8, category: 'snack' },
    { name: 'Singara (1 piece)', calories: 130, protein: 3, carbs: 15, fat: 7, category: 'snack' },
    { name: 'Pitha - Chitoi (1 piece)', calories: 100, protein: 2, carbs: 18, fat: 2, category: 'snack' },
    { name: 'Pitha - Bhapa (1 piece)', calories: 120, protein: 3, carbs: 22, fat: 3, category: 'snack' },
    { name: 'Pitha - Patishapta (1 piece)', calories: 180, protein: 4, carbs: 28, fat: 6, category: 'snack' },
    { name: 'Jilapi (1 piece)', calories: 150, protein: 2, carbs: 28, fat: 5, category: 'snack' },
    { name: 'Beguni (1 piece)', calories: 90, protein: 1, carbs: 10, fat: 5, category: 'snack' },
    { name: 'Pakora/Piaju (3 pieces)', calories: 120, protein: 3, carbs: 12, fat: 7, category: 'snack' },
    { name: 'Fuchka/Pani Puri (6 pieces)', calories: 180, protein: 4, carbs: 30, fat: 5, category: 'snack' },
    { name: 'Chotpoti (1 bowl)', calories: 250, protein: 8, carbs: 35, fat: 8, category: 'snack' },
    { name: 'Jhalmuri (1 serving)', calories: 200, protein: 5, carbs: 32, fat: 6, category: 'snack' },

    // === BREAKFAST ===
    { name: 'Oatmeal with Milk (1 cup)', calories: 220, protein: 8, carbs: 35, fat: 5, category: 'breakfast' },
    { name: 'Cornflakes with Milk (1 cup)', calories: 180, protein: 4, carbs: 38, fat: 2, category: 'breakfast' },
    { name: 'Muri/Puffed Rice (1 cup)', calories: 54, protein: 1, carbs: 12, fat: 0.1, category: 'breakfast' },
    { name: 'Chira/Flattened Rice (1 cup dry)', calories: 180, protein: 3, carbs: 40, fat: 0.5, category: 'breakfast' },
    { name: 'Toast with Butter (2 slices)', calories: 200, protein: 5, carbs: 26, fat: 9, category: 'breakfast' },

    // === DAIRY ===
    { name: 'Milk - Full Fat (1 glass)', calories: 150, protein: 8, carbs: 12, fat: 8, category: 'dairy' },
    { name: 'Milk - Low Fat (1 glass)', calories: 100, protein: 8, carbs: 12, fat: 2.5, category: 'dairy' },
    { name: 'Yogurt/Doi (1 cup)', calories: 150, protein: 8, carbs: 17, fat: 5, category: 'dairy' },
    { name: 'Mishti Doi (1/2 cup)', calories: 180, protein: 5, carbs: 28, fat: 6, category: 'dairy' },
    { name: 'Lassi - Sweet (1 glass)', calories: 200, protein: 6, carbs: 32, fat: 6, category: 'dairy' },
    { name: 'Lassi - Salted (1 glass)', calories: 120, protein: 6, carbs: 12, fat: 5, category: 'dairy' },
    { name: 'Borhani (1 glass)', calories: 80, protein: 4, carbs: 8, fat: 3, category: 'dairy' },
    { name: 'Paneer (100g)', calories: 265, protein: 18, carbs: 3, fat: 20, category: 'dairy' },

    // === FRUITS ===
    { name: 'Banana (1 medium)', calories: 105, protein: 1.3, carbs: 27, fat: 0.4, category: 'fruit' },
    { name: 'Mango (1 cup sliced)', calories: 100, protein: 1, carbs: 25, fat: 0.6, category: 'fruit' },
    { name: 'Apple (1 medium)', calories: 95, protein: 0.5, carbs: 25, fat: 0.3, category: 'fruit' },
    { name: 'Orange (1 medium)', calories: 62, protein: 1.2, carbs: 15, fat: 0.2, category: 'fruit' },
    { name: 'Papaya (1 cup)', calories: 55, protein: 0.9, carbs: 14, fat: 0.2, category: 'fruit' },
    { name: 'Watermelon (1 cup)', calories: 46, protein: 0.9, carbs: 12, fat: 0.2, category: 'fruit' },
    { name: 'Jackfruit (1 cup)', calories: 155, protein: 2.8, carbs: 40, fat: 1, category: 'fruit' },
    { name: 'Litchi/Lychee (10 pieces)', calories: 66, protein: 0.8, carbs: 17, fat: 0.4, category: 'fruit' },
    { name: 'Guava (1 medium)', calories: 68, protein: 2.6, carbs: 14, fat: 1, category: 'fruit' },

    // === BEVERAGES ===
    { name: 'Tea with Milk & Sugar (1 cup)', calories: 60, protein: 1, carbs: 10, fat: 2, category: 'beverage' },
    { name: 'Tea - Black (1 cup)', calories: 2, protein: 0, carbs: 0.5, fat: 0, category: 'beverage' },
    { name: 'Coffee with Milk & Sugar (1 cup)', calories: 70, protein: 1, carbs: 12, fat: 2, category: 'beverage' },
    { name: 'Coffee - Black (1 cup)', calories: 5, protein: 0.3, carbs: 1, fat: 0, category: 'beverage' },
    { name: 'Coconut Water (1 cup)', calories: 46, protein: 2, carbs: 9, fat: 0.5, category: 'beverage' },
    { name: 'Sugarcane Juice (1 glass)', calories: 180, protein: 0.5, carbs: 45, fat: 0, category: 'beverage' },
    { name: 'Mango Shake (1 glass)', calories: 250, protein: 5, carbs: 45, fat: 6, category: 'beverage' },
    { name: 'Banana Shake (1 glass)', calories: 220, protein: 6, carbs: 38, fat: 5, category: 'beverage' },

    // === SWEETS/DESSERTS ===
    { name: 'Rasgulla (2 pieces)', calories: 180, protein: 4, carbs: 35, fat: 3, category: 'sweet' },
    { name: 'Gulab Jamun (2 pieces)', calories: 280, protein: 4, carbs: 42, fat: 10, category: 'sweet' },
    { name: 'Roshogolla (2 pieces)', calories: 160, protein: 4, carbs: 32, fat: 2, category: 'sweet' },
    { name: 'Sandesh (2 pieces)', calories: 200, protein: 6, carbs: 28, fat: 8, category: 'sweet' },
    { name: 'Payesh/Kheer (1 cup)', calories: 280, protein: 8, carbs: 45, fat: 8, category: 'sweet' },
    { name: 'Firni (1/2 cup)', calories: 180, protein: 4, carbs: 30, fat: 5, category: 'sweet' },
    { name: 'Shemai (1 cup)', calories: 350, protein: 8, carbs: 55, fat: 12, category: 'sweet' },
    { name: 'Halwa (1/2 cup)', calories: 250, protein: 3, carbs: 35, fat: 12, category: 'sweet' }
];

// Food categories for filtering
const FOOD_CATEGORIES = [
    { id: 'rice', name: 'Rice Dishes' },
    { id: 'bread', name: 'Breads' },
    { id: 'protein', name: 'Protein (Meat/Fish/Eggs)' },
    { id: 'dal', name: 'Dals & Lentils' },
    { id: 'vegetable', name: 'Vegetables' },
    { id: 'snack', name: 'Snacks' },
    { id: 'breakfast', name: 'Breakfast' },
    { id: 'dairy', name: 'Dairy' },
    { id: 'fruit', name: 'Fruits' },
    { id: 'beverage', name: 'Beverages' },
    { id: 'sweet', name: 'Sweets & Desserts' }
];

/**
 * Search local foods database
 * @param {string} query - Search term
 * @param {string} category - Optional category filter
 * @returns {Array} Matching foods
 */
function searchLocalFoods(query, category = null) {
    const searchTerm = query.toLowerCase().trim();

    if (!searchTerm && !category) return [];

    return LOCAL_FOODS.filter(food => {
        const matchesQuery = !searchTerm || food.name.toLowerCase().includes(searchTerm);
        const matchesCategory = !category || food.category === category;
        return matchesQuery && matchesCategory;
    }).slice(0, 10); // Limit to 10 results
}

/**
 * Get foods by category
 * @param {string} category - Category ID
 * @returns {Array} Foods in category
 */
function getFoodsByCategory(category) {
    return LOCAL_FOODS.filter(food => food.category === category);
}

/**
 * Get all categories
 * @returns {Array} Food categories
 */
function getFoodCategories() {
    return FOOD_CATEGORIES;
}

// Export for use in other modules
window.LOCAL_FOODS = LOCAL_FOODS;
window.FOOD_CATEGORIES = FOOD_CATEGORIES;
window.searchLocalFoods = searchLocalFoods;
window.getFoodsByCategory = getFoodsByCategory;
window.getFoodCategories = getFoodCategories;
