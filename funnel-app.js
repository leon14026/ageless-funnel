/**
 * Ageless by Tulee — Funnel SPA Router & Interactivity
 */
(function () {
    'use strict';

    // ==========================================
    // Route Configuration
    // ==========================================
    const routes = {
        '/': 'page-home',
        '/free-plan': 'page-free-plan',
        '/free-plan/thank-you': 'page-free-plan-thank-you',
        '/quiz': 'page-quiz',
        '/quiz/results': 'page-quiz-results',
        '/tulee-story': 'page-tulee-story',
        '/join': 'page-join',
        '/pricing': 'page-pricing',
        '/checkout': 'page-checkout',
        '/checkout/upsell': 'page-upsell',
        '/checkout/downsell': 'page-downsell',
        '/checkout/confirmation': 'page-confirmation',
        '/dashboard': 'page-dashboard',
        '/waitlist': 'page-waitlist',
        '/waitlist/thank-you': 'page-waitlist-thank-you',
        '/privacy': 'page-privacy',
        '/terms': 'page-terms',
        '/disclaimer': 'page-disclaimer'
    };

    // Pages where the nav starts transparent (dark hero sections)
    const darkHeroPages = ['page-home', 'page-free-plan', 'page-join'];

    // Pages with no navigation
    const noNavPages = ['page-free-plan'];
    const checkout = window.FunnelCheckout.create('A');
    const checkoutState = checkout.state;
    const mealPlanRows = [
        {
            title: 'Custom Diet Plans',
            helper: 'Goal-based plans for every age, routine, and health need',
            direction: 'left',
            plans: [
                { title: 'Iron &amp; Strength &mdash; Red Meat', detail: 'Iron-conscious meal structure for energy, strength, and recovery support.', image: 'images/new%20food/Selected%20Tulee%20Food%20Pics/food_1.webp', alt: 'Meal plan food photo for Iron &amp; Strength &mdash; Red Meat' },
                { title: 'Fat Loss &amp; Weight Management', detail: 'Portion-aware meals that help you feel lighter while staying nourished.', image: 'images/new%20food/Regular%20Food%20Pics/Food_1A.webp', alt: 'Meal plan food photo for Fat Loss &amp; Weight Management' },
                { title: 'General Health &amp; Wellness for Menopause', detail: 'A balanced menopause-aware foundation for energy, strength, and everyday wellbeing.', image: 'images/new%20food/Selected%20Tulee%20Food%20Pics/food_2.webp', alt: 'Meal plan food photo for General Health &amp; Wellness for Menopause' },
                { title: 'Lean &amp; Strong &mdash; Chicken-Powered', detail: 'Simple chicken-based meals for women who want structure and protein.', image: 'images/new%20food/Regular%20Food%20Pics/Food_2A.webp', alt: 'Meal plan food photo for Lean &amp; Strong &mdash; Chicken-Powered' },
                { title: 'The Balanced Blueprint &mdash; General Health', detail: 'A steady everyday plan for energy, focus, and realistic routines.', image: 'images/new%20food/Selected%20Tulee%20Food%20Pics/food_3.webp', alt: 'Meal plan food photo for The Balanced Blueprint &mdash; General Health' },
                { title: 'Sunshine Restore &mdash; Vitamin D Deficiency', detail: 'Meal structure that pairs nourishment with vitamin-D-aware habits.', image: 'images/new%20food/Regular%20Food%20Pics/Food_3A.webp', alt: 'Meal plan food photo for Sunshine Restore &mdash; Vitamin D Deficiency' },
                { title: 'Cool &amp; Calm &mdash; Hot Flash Fighter', detail: 'Cooling, lighter choices that support calmer days without extreme restriction.', image: 'images/new%20food/Selected%20Tulee%20Food%20Pics/food_4.webp', alt: 'Meal plan food photo for Cool &amp; Calm &mdash; Hot Flash Fighter' },
                { title: 'Hormone Harmony &mdash; PCOS Management', detail: 'Steady meals that support cravings, energy, and hormone-aware routines.', image: 'images/new%20food/Regular%20Food%20Pics/Food_4A.webp', alt: 'Meal plan food photo for Hormone Harmony &mdash; PCOS Management' },
                { title: 'Heart &amp; Bone Health Focus', detail: 'Meals that support protein, calcium, fiber, and heart-smart habits.', image: 'images/new%20food/Selected%20Tulee%20Food%20Pics/food_5.webp', alt: 'Meal plan food photo for Heart &amp; Bone Health Focus' },
                { title: 'Green Plate &mdash; Sustainable &amp; Planet-Friendly', detail: 'Plant-forward choices for lighter eating and long-term habits.', image: 'images/new%20food/Regular%20Food%20Pics/Food_5A.webp', alt: 'Meal plan food photo for Green Plate &mdash; Sustainable &amp; Planet-Friendly' },
                { title: 'Blood Sugar Control &mdash; Diabetic-Friendly', detail: 'Balanced carbs, protein, and fiber for steadier meals.', image: 'images/new%20food/Selected%20Tulee%20Food%20Pics/food_6.webp', alt: 'Meal plan food photo for Blood Sugar Control &mdash; Diabetic-Friendly' },
                { title: 'Weekly Soup Day &mdash; Digestive Reset', detail: 'A lighter reset day built around warm, gentle, filling meals.', image: 'images/new%20food/Regular%20Food%20Pics/Food_6A.webp', alt: 'Meal plan food photo for Weekly Soup Day &mdash; Digestive Reset' },
                { title: 'Muscle Building &amp; Strength', detail: 'Protein-forward planning to support strength, tone, and steady training.', image: 'images/new%20food/Selected%20Tulee%20Food%20Pics/food_7.webp', alt: 'Meal plan food photo for Muscle Building &amp; Strength' },
                { title: 'Bone Fortress &mdash; Osteoporosis Shield', detail: 'Bone-supportive meals focused on protein, calcium, and strength habits.', image: 'images/new%20food/Regular%20Food%20Pics/Food_7A.webp', alt: 'Meal plan food photo for Bone Fortress &mdash; Osteoporosis Shield' },
                { title: 'Thyroid Shield &mdash; Thyroid-Friendly', detail: 'Gentle planning for steady energy, protein, and routine consistency.', image: 'images/new%20food/Selected%20Tulee%20Food%20Pics/Food_12.webp', alt: 'Meal plan food photo for Thyroid Shield &mdash; Thyroid-Friendly' },
                { title: 'Plant Power &mdash; Vegetarian Vitality', detail: 'Vegetarian meals planned around protein, fiber, and daily energy.', image: 'images/new%20food/Regular%20Food%20Pics/Food_8A.webp', alt: 'Meal plan food photo for Plant Power &mdash; Vegetarian Vitality' },
                { title: 'Heart Guardian &mdash; Cardiovascular Protection', detail: 'Heart-conscious meals built around fiber, lighter choices, and balance.', image: 'images/new%20food/Selected%20Tulee%20Food%20Pics/food_9.webp', alt: 'Meal plan food photo for Heart Guardian &mdash; Cardiovascular Protection' },
                { title: 'Clear Mind &mdash; Brain Fog Buster', detail: 'Steady meals designed to support focus, mood, and daily energy.', image: 'images/new%20food/Regular%20Food%20Pics/Food_9A.webp', alt: 'Meal plan food photo for Clear Mind &mdash; Brain Fog Buster' },
                { title: 'Sunshine Within &mdash; Mood &amp; Depression Support', detail: 'Nourishing routines that support mood, sunlight habits, and consistency.', image: 'images/new%20food/Selected%20Tulee%20Food%20Pics/food_10.webp', alt: 'Meal plan food photo for Sunshine Within &mdash; Mood &amp; Depression Support' },
                { title: 'Skin Health &amp; Glow', detail: 'Nourishing choices that support hydration, color, and a healthier glow.', image: 'images/new%20food/Regular%20Food%20Pics/Food_10A.webp', alt: 'Meal plan food photo for Skin Health &amp; Glow' },
                { title: 'Pressure Balance &mdash; Hypertension Control', detail: 'Balanced meals that support lighter choices, fiber, and blood-pressure-conscious habits.', image: 'images/new%20food/Selected%20Tulee%20Food%20Pics/Food_11.webp', alt: 'Meal plan food photo for Pressure Balance &mdash; Hypertension Control' },
                { title: 'Gentle Lift &mdash; Low Blood Pressure Support', detail: 'Steady nourishment to support energy, hydration, and gentle daily balance.', image: 'images/new%20food/Regular%20Food%20Pics/Food_11A.webp', alt: 'Meal plan food photo for Gentle Lift &mdash; Low Blood Pressure Support' },
                { title: 'Hair Nourish &mdash; Strength &amp; Growth Support', detail: 'Protein- and nutrient-aware meals that support hair strength, shine, and consistency.', image: 'images/new%20food/Selected%20Tulee%20Food%20Pics/food_8.webp', alt: 'Meal plan food photo for Hair Nourish &mdash; Strength &amp; Growth Support' },
                { title: 'Nourish &amp; Gain &mdash; Healthy Weight Gain', detail: 'Gentle calorie-supportive meals for women who want healthy, steady nourishment.', image: 'images/new%20food/Regular%20Food%20Pics/Food_12A.webp', alt: 'Meal plan food photo for Nourish &amp; Gain &mdash; Healthy Weight Gain' }
            ]
        }
    ];

    // ==========================================
    // Router
    // ==========================================
    function getRouteFromHash() {
        var hash = window.location.hash.replace('#', '') || '/';
        // Strip query params for route matching
        var path = hash.split('?')[0];
        // Try exact match first, then partial matches for dynamic routes
        if (routes[path]) return { pageId: routes[path], path: path };
        return { pageId: 'page-home', path: '/' };
    }

    function navigateTo(path) {
        window.location.hash = '#' + path;
    }

    function handleRoute() {
        var route = getRouteFromHash();
        if (!window.FunnelCheckout.isDemoMode() && (route.path === '/checkout/upsell' || route.path === '/checkout/downsell')) {
            navigateTo('/checkout');
            return;
        }
        if (!window.FunnelCheckout.isDemoMode() && (route.path === '/free-plan' || route.path === '/free-plan/thank-you')) {
            navigateTo('/');
            return;
        }
        if (!window.FunnelCheckout.isDemoMode() && route.path === '/checkout/confirmation' && !checkoutState.payment) {
            navigateTo('/checkout');
            return;
        }
        if (!window.FunnelCheckout.isDemoMode() && route.path === '/dashboard') {
            window.FunnelCheckout.guardDashboard('#/').then(function (hasAccess) {
                if (!hasAccess) navigateTo('/pricing');
            });
        }
        var pages = document.querySelectorAll('.funnel-page');
        pages.forEach(function (p) {
            p.classList.remove('active', 'active-flex');
        });

        var target = document.getElementById(route.pageId);
        if (target) {
            target.classList.add('active');
        }

        // Nav visibility & style
        var nav = document.getElementById('mainNav');
        if (noNavPages.indexOf(route.pageId) !== -1) {
            nav.style.display = 'none';
        } else {
            nav.style.display = '';
            if (darkHeroPages.indexOf(route.pageId) !== -1) {
                nav.classList.remove('scrolled');
                nav.dataset.dark = 'true';
            } else {
                nav.classList.add('scrolled');
                nav.dataset.dark = 'false';
            }
        }

        // Close mobile menu on navigate
        closeMobileMenu();

        // Scroll to top
        window.scrollTo(0, 0);

        // Fire tracking event
        trackEvent('page_view', { page: route.path });
        var tier = getHashTier();
        if (tier) checkoutState.selectedTier = tier;
        updateCheckoutDisplay();
        updateConfirmationDisplay();
    }

    window.addEventListener('hashchange', handleRoute);

    // ==========================================
    // Navigation
    // ==========================================
    function initNav() {
        var nav = document.getElementById('mainNav');
        var hamburger = document.getElementById('hamburgerBtn');
        var mobileMenu = document.getElementById('mobileMenu');
        var overlay = document.getElementById('mobileOverlay');

        // Scroll behavior for nav
        var lastScroll = 0;
        window.addEventListener('scroll', function () {
            if (nav.dataset.dark === 'true') {
                if (window.scrollY > 80) {
                    nav.classList.add('scrolled');
                } else {
                    nav.classList.remove('scrolled');
                }
            }
            lastScroll = window.scrollY;
        });

        // Mobile menu toggle
        hamburger.addEventListener('click', function () {
            hamburger.classList.toggle('open');
            mobileMenu.classList.toggle('open');
            overlay.classList.toggle('open');
        });
        overlay.addEventListener('click', closeMobileMenu);

        // Close mobile menu on link click
        mobileMenu.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', closeMobileMenu);
        });
    }

    function closeMobileMenu() {
        var hamburger = document.getElementById('hamburgerBtn');
        var mobileMenu = document.getElementById('mobileMenu');
        var overlay = document.getElementById('mobileOverlay');
        if (hamburger) hamburger.classList.remove('open');
        if (mobileMenu) mobileMenu.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
    }

    // ==========================================
    // FAQ Accordion
    // ==========================================
    function initFaqAccordions() {
        document.querySelectorAll('.f-faq-question').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var item = btn.closest('.f-faq-item');
                var isOpen = item.classList.contains('open');

                // Close siblings in the same container
                var container = item.parentElement;
                container.querySelectorAll('.f-faq-item.open').forEach(function (openItem) {
                    openItem.classList.remove('open');
                });

                if (!isOpen) {
                    item.classList.add('open');
                }
            });
        });
    }

    // ==========================================
    // Quiz Logic
    // ==========================================
    var quizAnswers = {};

    function initQuiz() {
        var quizOptions = document.querySelectorAll('#page-quiz .f-quiz-option');
        var progressBar = document.getElementById('quizProgressBar');
        var totalSteps = 6;

        quizOptions.forEach(function (option) {
            option.addEventListener('click', function () {
                var step = option.closest('.f-quiz-step');
                var stepNum = parseInt(step.dataset.step);

                // Mark selection
                step.querySelectorAll('.f-quiz-option').forEach(function (o) {
                    o.classList.remove('selected');
                });
                option.classList.add('selected');

                // Store answer
                var keys = ['goal', 'level', 'time', 'joint_concerns', 'nutrition_challenge'];
                if (stepNum <= 5) {
                    quizAnswers[keys[stepNum - 1]] = option.dataset.value;
                }

                trackEvent('quiz_answer', { step: stepNum, value: option.dataset.value });

                // Auto-advance after short delay
                setTimeout(function () {
                    goToQuizStep(stepNum + 1);
                }, 400);
            });

            option.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    option.click();
                }
            });
        });

        // Quiz email form
        var quizForm = document.getElementById('quizEmailForm');
        if (quizForm) {
            quizForm.addEventListener('submit', function (e) {
                e.preventDefault();
                trackEvent('quiz_completed', quizAnswers);
                updateQuizResults();
                navigateTo('/quiz/results');
            });
        }

        function goToQuizStep(stepNum) {
            if (stepNum > totalSteps) return;
            var steps = document.querySelectorAll('#page-quiz .f-quiz-step');
            steps.forEach(function (s) { s.classList.remove('active'); });
            var target = document.querySelector('#page-quiz .f-quiz-step[data-step="' + stepNum + '"]');
            if (target) target.classList.add('active');
            if (progressBar) {
                progressBar.style.width = Math.round(((stepNum - 1) / (totalSteps - 1)) * 100) + '%';
            }
        }
    }

    function updateQuizResults() {
        var focusEl = document.getElementById('quizResultFocus');
        var planEl = document.getElementById('quizResultPlan');
        var timeEl = document.getElementById('quizResultTimeline');

        var goalMap = {
            'weight_loss': 'Lighter, Slimmer, Sustainable',
            'energy': 'Energy, Sleep & Glow',
            'strength': 'Tone, Shape & Move Freely',
            'health': 'Holistic Wellness'
        };

        if (focusEl && quizAnswers.goal) {
            focusEl.textContent = goalMap[quizAnswers.goal] || 'Personalized Program';
        }

        // Single plan recommendation
        if (planEl) planEl.textContent = '6-Month Transformation';

        var timeline = '6 Months';
        if (quizAnswers.level === 'beginner' || quizAnswers.level === 'lapsed') timeline = '6 Months (gentle start)';
        if (quizAnswers.level === 'active') timeline = '6 Months (accelerated pace)';
        if (timeEl) timeEl.textContent = timeline;

        // Personalized note based on joint concerns
        var noteEl = document.getElementById('quizResultNote');
        if (noteEl) {
            var noteMap = {
                'none': 'You\'re in a great spot to begin. Your program will build tone, mobility, and everyday strength progressively while keeping movements controlled.',
                'knees': 'We\'ve noted your knee/hip concerns. Every exercise in your program includes a low-impact modification designed to protect your joints while supporting lighter, freer movement.',
                'back': 'We\'ve noted your back/shoulder concerns. Coach Tulee will guide you through posture-aware exercises and gentle modifications that build support without punishing strain.',
                'general': 'We understand stiffness and flexibility are concerns for you. Your program starts with extra mobility warm-ups and gentle stretching to support a steadier range of motion over time.'
            };
            var note = noteMap[quizAnswers.joint_concerns] || noteMap['none'];

            // Add nutrition note
            if (quizAnswers.nutrition_challenge === 'cooking') {
                note += ' Plus, you\'ll get simple, family-friendly Bangladeshi recipes that the whole household will enjoy.';
            } else if (quizAnswers.nutrition_challenge === 'knowledge') {
                note += ' The nutrition tracker will help you understand exactly what your body needs at this stage of life.';
            }

            noteEl.innerHTML = '<p class="text-secondary" style="font-size: 0.9375rem;">' + note + '</p>';
        }
    }

    // ==========================================
    // Lead Magnet Form
    // ==========================================
    function initLeadMagnetForm() {
        var form = document.getElementById('leadMagnetForm');
        if (form) {
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                trackEvent('lead_magnet_opt_in', { source: 'free_plan_page' });
                navigateTo('/free-plan/thank-you');
            });
        }
    }

    // ==========================================
    // BMI + BMR Calculator
    // ==========================================
    function initBmiBmrCalculator() {
        var form = document.getElementById('bmiBmrForm');
        if (!form) return;

        var weightEl = document.getElementById('bmi-weight');
        var heightEl = document.getElementById('bmi-height-inches');
        var ageEl = document.getElementById('bmi-age');
        var genderEl = document.getElementById('bmi-gender');
        var weightOutputEl = document.getElementById('bmiWeightOutput');
        var heightOutputEl = document.getElementById('bmiHeightOutput');
        var errorEl = document.getElementById('bmiBmrError');
        var resultEl = document.getElementById('bmiBmrResult');
        var bmiValueEl = document.getElementById('bmiResultValue');
        var bmiCategoryEl = document.getElementById('bmiResultCategory');
        var bmrValueEl = document.getElementById('bmrResultValue');
        var scaleEl = document.getElementById('bmiScale');
        var markerEl = document.getElementById('bmiScaleMarker');
        var statusEl = document.getElementById('bmiStatus');
        var statusIconEl = document.getElementById('bmiStatusIcon');
        var statusTextEl = document.getElementById('bmiStatusText');
        var hasTracked = false;

        function getBmiCategory(bmi) {
            if (bmi < 18.5) return 'Underweight';
            if (bmi < 25) return 'Healthy range';
            if (bmi < 30) return 'Overweight';
            return 'Obesity range';
        }

        function formatHeight(totalInches) {
            var feet = Math.floor(totalInches / 12);
            var inches = totalInches % 12;
            return feet + ' ft ' + inches + ' in';
        }

        function getBmiStatus(category) {
            if (category === 'Underweight') {
                return {
                    icon: '!',
                    className: 'is-warning',
                    text: 'Your BMI is on the lower side. Focus on eating enough, feeling steady, and getting medical guidance if anything feels off.'
                };
            }
            if (category === 'Obesity range') {
                return {
                    icon: '!',
                    className: 'is-warning',
                    text: 'Your BMI is on the higher side. Gentle, joint-friendly movement and menopause-aware meals are a kind, sustainable place to start.'
                };
            }
            if (category === 'Overweight') {
                return {
                    icon: 'i',
                    className: 'is-neutral',
                    text: 'Your BMI is above the healthy range, but it is only one clue. Feeling lighter, moving freely, and building steadier energy matter too.'
                };
            }
            return {
                icon: 'i',
                className: 'is-ok',
                text: 'Your BMI sits in the healthy range. Keep building mobility, calm energy, and sustainable habits.'
            };
        }

        function updateCalculator() {
            var weight = parseFloat(weightEl.value);
            var heightInches = parseInt(heightEl.value, 10);
            var age = parseInt(ageEl.value, 10);
            var gender = genderEl.value;

            weightOutputEl.textContent = Math.round(weight) + ' kg';
            heightOutputEl.textContent = formatHeight(heightInches);

            if (!age || age < 18 || age > 100) {
                errorEl.textContent = 'Enter your age to see your BMI and BMR.';
                resultEl.hidden = true;
                scaleEl.hidden = true;
                statusEl.hidden = true;
                return;
            }

            var height = heightInches * 2.54;
            var heightMeters = height / 100;
            var bmi = weight / (heightMeters * heightMeters);
            var bmr = (10 * weight) + (6.25 * height) - (5 * age);
            bmr += gender === 'female' ? -161 : 5;
            var category = getBmiCategory(bmi);
            var status = getBmiStatus(category);
            var markerPercent = Math.max(0, Math.min(100, ((bmi - 15) / 25) * 100));

            errorEl.textContent = '';
            bmiValueEl.textContent = bmi.toFixed(1);
            bmiCategoryEl.textContent = category;
            bmrValueEl.textContent = Math.round(bmr).toLocaleString();
            markerEl.style.left = markerPercent + '%';
            statusIconEl.textContent = status.icon;
            statusTextEl.textContent = status.text;
            statusEl.classList.remove('is-warning', 'is-neutral', 'is-ok');
            statusEl.classList.add(status.className);
            resultEl.hidden = false;
            scaleEl.hidden = false;
            statusEl.hidden = false;

            if (!hasTracked) {
                trackEvent('bmi_bmr_calculated', {
                    bmi_category: category,
                    gender: gender
                });
                hasTracked = true;
            }
        }

        [weightEl, heightEl, ageEl, genderEl].forEach(function (input) {
            input.addEventListener('input', updateCalculator);
            input.addEventListener('change', updateCalculator);
        });

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            updateCalculator();
        });

        updateCalculator();
    }

    // ==========================================
    // Checkout Logic
    // ==========================================
    function getHashTier() {
        var parts = window.location.hash.split('?');
        var tier = parts.length > 1 ? new URLSearchParams(parts[1]).get('tier') : null;
        return window.FunnelCheckout.PRICING.plans[tier] ? tier : null;
    }

    function updateCheckoutDisplay() {
        var plan = window.FunnelCheckout.PRICING.plans[checkoutState.selectedTier];
        var totals = checkout.getTotals();
        var money = window.FunnelCheckout.formatMoney;
        var bumpRow = document.getElementById('checkoutBumpRow');

        if (document.getElementById('checkoutSubmitBtn')) document.getElementById('checkoutSubmitBtn').textContent = 'Continue - ' + money(totals.usd, totals.bdt);
        if (document.getElementById('checkoutPlanName')) document.getElementById('checkoutPlanName').textContent = plan.name;
        if (document.getElementById('checkoutPlanPrice')) document.getElementById('checkoutPlanPrice').textContent = money(plan.usd, plan.bdt);
        if (document.getElementById('checkoutTotalPrice')) document.getElementById('checkoutTotalPrice').textContent = money(totals.usd, totals.bdt);
        if (bumpRow) bumpRow.style.display = checkoutState.bumpSelected ? 'flex' : 'none';

        // Preorder manual-payment amount (base tier only; addons are gateway-only)
        var bdtAmount = '৳' + Number(plan.bdt).toLocaleString('en-US');
        if (document.getElementById('preorderAmount')) document.getElementById('preorderAmount').textContent = bdtAmount;
        document.querySelectorAll('.preorderAmountBank').forEach(function (el) { el.textContent = bdtAmount; });

        document.querySelectorAll('.checkout-tier-option').forEach(function (option) {
            var selected = option.getAttribute('data-tier') === checkoutState.selectedTier;
            option.style.borderColor = selected ? 'var(--color-primary)' : 'var(--color-border-light)';
            option.style.background = selected ? 'rgba(233,167,181,0.06)' : '';
            var radio = option.querySelector('input[type="radio"]');
            if (radio) radio.checked = selected;
        });
    }

    function updateConfirmationDisplay() {
        var plan = window.FunnelCheckout.PRICING.plans[checkoutState.selectedTier];
        var totals = checkout.getTotals();
        var money = window.FunnelCheckout.formatMoney;
        var addonRows = document.getElementById('confirmAddonRows');
        if (document.getElementById('confirmPlanName')) document.getElementById('confirmPlanName').textContent = plan.name;
        if (document.getElementById('confirmPlanPrice')) document.getElementById('confirmPlanPrice').textContent = money(plan.usd, plan.bdt);
        if (document.getElementById('confirmAccessDuration')) document.getElementById('confirmAccessDuration').textContent = plan.months + (plan.months === 1 ? ' month' : ' months');
        if (document.getElementById('confirmTotalPrice')) document.getElementById('confirmTotalPrice').textContent = money(totals.usd, totals.bdt);
        var totalLabel = document.getElementById('confirmTotalLabel');
        if (totalLabel) totalLabel.textContent = window.FunnelCheckout.isPreorderMode() ? 'Amount to Pay' : 'Total Charged';
        if (addonRows) {
            addonRows.innerHTML = checkout.getItems().slice(1).map(function (item) {
                return '<div class="f-order-summary-row"><span>' + item.name + '</span><span>' + money(item.usd, item.bdt) + '</span></div>';
            }).join('');
        }
    }

    async function completeCheckout() {
        try {
            await checkout.completePayment(navigateTo);
        } catch (error) {
            console.error('Checkout completion failed:', error);
            alert(error.message || 'Could not start secure payment. Please try again.');
        }
    }

    function initCheckout() {
        var form = document.getElementById('checkoutForm');
        var tier = getHashTier();
        if (tier) checkoutState.selectedTier = tier;

        document.querySelectorAll('.checkout-tier-option').forEach(function (option) {
            option.addEventListener('click', function () {
                checkoutState.selectedTier = option.getAttribute('data-tier');
                checkout.resetAddons();
                updateCheckoutDisplay();
            });
        });

        var bump = document.getElementById('orderBump');
        if (bump) {
            bump.checked = checkoutState.bumpSelected;
            bump.addEventListener('change', function () {
                checkoutState.bumpSelected = bump.checked;
                checkout.save();
                updateCheckoutDisplay();
            });
        }

        // --- Manual pre-order payment UI (preorder mode) ---
        if (window.CONFIG && window.CONFIG.PAYMENT) {
            var bkashEl = document.getElementById('bkashNumber');
            if (bkashEl && window.CONFIG.PAYMENT.BKASH_NUMBER) bkashEl.textContent = window.CONFIG.PAYMENT.BKASH_NUMBER;
            var bankEl = document.getElementById('bankDetails');
            if (bankEl && window.CONFIG.PAYMENT.BANK_DETAILS) bankEl.textContent = window.CONFIG.PAYMENT.BANK_DETAILS;
        }

        function selectedPreorderMethod() {
            var r = document.querySelector('input[name="preorderMethod"]:checked');
            return r ? r.value : 'bkash';
        }

        function syncPreorderMethodUI() {
            var method = selectedPreorderMethod();
            ['bkash', 'bank', 'card'].forEach(function (m) {
                var instr = document.getElementById('preorderInstr-' + m);
                if (instr) instr.style.display = (m === method) ? 'block' : 'none';
            });
            var refGroup = document.getElementById('preorderReferenceGroup');
            if (refGroup) refGroup.style.display = (method === 'card') ? 'none' : '';
            document.querySelectorAll('#preorderMethods .f-preorder-method').forEach(function (label) {
                var radio = label.querySelector('input[type="radio"]');
                label.style.borderColor = (radio && radio.checked) ? 'var(--color-primary)' : 'var(--color-border-light)';
            });
        }
        document.querySelectorAll('input[name="preorderMethod"]').forEach(function (radio) {
            radio.addEventListener('change', syncPreorderMethodUI);
        });
        syncPreorderMethodUI();

        function handlePreorderSubmit() {
            var err = document.getElementById('preorderError');
            if (err) err.textContent = '';
            var honeypot = document.getElementById('checkoutCompany');
            if (honeypot && honeypot.value) return; // silently drop bots

            var method = selectedPreorderMethod();
            if (method === 'card') {
                trackEvent('preorder_card_to_waitlist', {});
                navigateTo('/waitlist');
                return;
            }

            var refInput = document.getElementById('preorderReference');
            var reference = refInput ? refInput.value.trim() : '';
            var terms = document.getElementById('preorderTerms');
            if (!reference) { if (err) err.textContent = 'Enter your bKash/bank transaction reference.'; return; }
            if (terms && !terms.checked) { if (err) err.textContent = 'Please agree to the pre-order terms to continue.'; return; }

            var btn = document.getElementById('checkoutSubmitBtn');
            if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

            checkout.submitPreorder({ method: method, reference: reference }).then(function (res) {
                trackEvent(res && res.duplicate ? 'preorder_duplicate' : 'preorder_submitted', { tier: checkoutState.selectedTier, method: method });
                navigateTo('/checkout/confirmation');
            }).catch(function (error) {
                if (err) err.textContent = error.message || 'Could not submit your pre-order. Please try again.';
                if (btn) { btn.disabled = false; updateCheckoutDisplay(); }
            });
        }

        if (form) {
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                var name = document.getElementById('checkout-name').value;
                var email = document.getElementById('checkout-email').value;
                var phone = document.getElementById('checkout-phone').value;

                if (window.FunnelCheckout.isPreorderMode()) {
                    // Card/international visitors go to the waitlist and don't need a BD phone.
                    if (selectedPreorderMethod() !== 'card' && !window.FunnelCheckout.validateBangladeshiPhone(phone)) {
                        alert('Enter a valid Bangladeshi phone number, such as 01712345678.');
                        return;
                    }
                    checkoutState.customer = { name: name, email: email, phone: phone };
                    checkout.save();
                    handlePreorderSubmit();
                    return;
                }

                if (!window.FunnelCheckout.validateBangladeshiPhone(phone)) {
                    alert('Enter a valid Bangladeshi phone number, such as 01712345678.');
                    return;
                }

                checkoutState.customer = { name: name, email: email, phone: phone };
                checkout.save();
                trackEvent('checkout_details_saved', { plan: checkoutState.selectedTier, amount: checkout.getTotals().bdt, currency: 'BDT' });
                if (window.FunnelCheckout.isDemoMode()) navigateTo('/checkout/upsell');
                else completeCheckout();
            });
        }

        var upsellAccept = document.getElementById('upsellAcceptBtn');
        if (upsellAccept) {
            upsellAccept.addEventListener('click', function () {
                checkoutState.upsellAccepted = true;
                checkoutState.downsellAccepted = false;
                checkout.save();
                trackEvent('upsell_accepted', { product: 'personal_nutrition_plan', price: 1499 });
                completeCheckout();
            });
        }

        var downsellAccept = document.getElementById('downsellAcceptBtn');
        if (downsellAccept) {
            downsellAccept.addEventListener('click', function () {
                checkoutState.downsellAccepted = true;
                checkoutState.upsellAccepted = false;
                checkout.save();
                trackEvent('downsell_accepted', { product: 'meal_plan_collection', price: 699 });
                completeCheckout();
            });
        }

        var downsellDecline = document.getElementById('downsellDeclineBtn');
        if (downsellDecline) {
            downsellDecline.addEventListener('click', function (event) {
                event.preventDefault();
                checkoutState.downsellAccepted = false;
                checkoutState.upsellAccepted = false;
                checkout.save();
                completeCheckout();
            });
        }

        updateCheckoutDisplay();
    }

    // ==========================================
    // Upsell Countdown Timer
    // ==========================================
    function initUpsellCountdown() {
        var countdownEl = document.getElementById('upsellCountdown');
        if (!countdownEl) return;

        var totalSeconds = 15 * 60;

        function updateDisplay() {
            var minutes = Math.floor(totalSeconds / 60);
            var seconds = totalSeconds % 60;
            countdownEl.textContent = '⏱ ' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
        }

        setInterval(function () {
            if (totalSeconds > 0) {
                totalSeconds--;
                updateDisplay();
            }
        }, 1000);

        updateDisplay();

    }

    // ==========================================
    // Category Tabs
    // ==========================================
    function initCategoryTabs() {
        document.querySelectorAll('.f-category-tabs').forEach(function (tabGroup) {
            tabGroup.querySelectorAll('.f-category-tab').forEach(function (tab) {
                tab.addEventListener('click', function () {
                    tabGroup.querySelectorAll('.f-category-tab').forEach(function (t) {
                        t.classList.remove('active');
                    });
                    tab.classList.add('active');
                });
            });
        });
    }

    // ==========================================
    // Meal Plan Rails
    // ==========================================
    function initMealPlanRails() {
        function renderCard(plan, duplicate) {
            return '<article class="f-meal-plan-tile" tabindex="' + (duplicate ? '-1' : '0') + '"' + (duplicate ? ' aria-hidden="true"' : '') + '>' +
                '<img src="' + plan.image + '" alt="' + plan.alt + '" loading="lazy" decoding="async">' +
                '<div class="f-meal-plan-overlay">' +
                    '<h3>' + plan.title + '</h3>' +
                    '<p class="f-meal-plan-detail">' + plan.detail + '</p>' +
                '</div>' +
            '</article>';
        }

        function renderSet(row, duplicate) {
            return '<div class="f-meal-plan-set"' + (duplicate ? ' aria-hidden="true"' : '') + '>' +
                row.plans.map(function (plan) { return renderCard(plan, duplicate); }).join('') +
            '</div>';
        }

        document.querySelectorAll('[data-meal-plan-groups]').forEach(function (container) {
            if (container.dataset.rendered === 'true') return;
            container.innerHTML = mealPlanRows.map(function (row) {
                return '<div class="f-meal-plan-row" data-meal-direction="' + row.direction + '">' +
                    '<div class="f-container f-meal-plan-row-header">' +
                        '<h3>' + row.title + '</h3>' +
                        '<p>' + row.helper + '</p>' +
                    '</div>' +
                    '<div class="f-meal-plan-marquee" aria-label="' + row.title + ' meal plans">' +
                        '<div class="f-meal-plan-track" tabindex="0">' +
                            renderSet(row, false) +
                            renderSet(row, true) +
                        '</div>' +
                    '</div>' +
                '</div>';
            }).join('');
            container.dataset.rendered = 'true';
        });
    }

    // ==========================================
    // Exercise Marquee
    // ==========================================
    function initExerciseMarqueeRows() {
        document.querySelectorAll('.f-exercise-showcase').forEach(function (section) {
            if (section.dataset.exerciseRowsRendered === 'true') return;

            var marquee = section.querySelector('.f-exercise-marquee');
            if (!marquee) return;

            marquee.dataset.exerciseDirection = 'left';
            marquee.setAttribute('aria-label', 'Workout and diet categories');
            marquee.querySelectorAll('.f-exercise-tile').forEach(function (tile) {
                var title = tile.querySelector('.f-exercise-title');
                if (!title) return;
                var category = title.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                tile.dataset.exerciseCategory = category;
            });

            section.dataset.exerciseRowsRendered = 'true';
        });
    }

    // ==========================================
    // Scroll Animations
    // ==========================================
    function initScrollAnimations() {
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        document.querySelectorAll('.f-animate').forEach(function (el) {
            observer.observe(el);
        });
    }

    // ==========================================
    // Cookie Banner
    // ==========================================
    function initCookieBanner() {
        var banner = document.getElementById('cookieBanner');
        var acceptBtn = document.getElementById('acceptCookies');
        var customizeBtn = document.getElementById('customizeCookies');

        if (localStorage.getItem('awt_cookies_accepted')) {
            if (banner) banner.classList.remove('show');
            return;
        }

        if (acceptBtn) {
            acceptBtn.addEventListener('click', function () {
                localStorage.setItem('awt_cookies_accepted', 'all');
                if (banner) banner.classList.remove('show');
                trackEvent('cookies_accepted', { type: 'all' });
            });
        }

        if (customizeBtn) {
            customizeBtn.addEventListener('click', function () {
                localStorage.setItem('awt_cookies_accepted', 'essential');
                if (banner) banner.classList.remove('show');
            });
        }
    }

    // ==========================================
    // Analytics (Stub)
    // ==========================================
    function trackEvent(eventName, data) {
        if (typeof console !== 'undefined') {
            console.log('[Ageless by Tulee]', eventName, data || '');
        }
        // Integration points for real analytics:
        // if (window.gtag) gtag('event', eventName, data);
        // if (window.fbq) fbq('trackCustom', eventName, data);
        // if (window.mixpanel) mixpanel.track(eventName, data);
    }

    // ==========================================
    // Form Submissions (Generic)
    // ==========================================
    function initWaitlistForm() {
        var form = document.getElementById('waitlistForm');
        if (!form) return;
        var err = document.getElementById('waitlistError');
        var btn = document.getElementById('waitlistSubmitBtn');

        // Prefill from checkout details if a card/international visitor was routed here.
        if (checkoutState.customer) {
            if (checkoutState.customer.name) document.getElementById('waitlist-name').value = checkoutState.customer.name;
            if (checkoutState.customer.email) document.getElementById('waitlist-email').value = checkoutState.customer.email;
            if (checkoutState.customer.phone) document.getElementById('waitlist-phone').value = checkoutState.customer.phone;
        }

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            if (err) err.textContent = '';
            var honeypot = document.getElementById('waitlistCompany');
            if (honeypot && honeypot.value) return; // silently drop bots

            var name = document.getElementById('waitlist-name').value.trim();
            var email = document.getElementById('waitlist-email').value.trim();
            var phone = document.getElementById('waitlist-phone').value.trim();
            if (!name || !email) { if (err) err.textContent = 'Please enter your name and email.'; return; }
            if (phone && !window.FunnelCheckout.validateBangladeshiPhone(phone)) {
                if (err) err.textContent = 'Enter a valid Bangladeshi phone number, or leave it blank.';
                return;
            }

            if (btn) { btn.disabled = true; btn.textContent = 'Joining…'; }
            checkout.submitWaitlist({ name: name, email: email, phone: phone, source: 'funnel' }).then(function (res) {
                trackEvent(res && res.duplicate ? 'waitlist_duplicate' : 'waitlist_submitted', {});
                navigateTo('/waitlist/thank-you');
            }).catch(function (error) {
                if (err) err.textContent = error.message || 'Could not add you to the waitlist. Please try again.';
                if (btn) { btn.disabled = false; btn.textContent = 'Join the Waitlist'; }
            });
        });
    }

    function initForms() {
        document.querySelectorAll('form').forEach(function (form) {
            if (form.id === 'leadMagnetForm' || form.id === 'checkoutForm' || form.id === 'quizEmailForm' || form.id === 'bmiBmrForm' || form.id === 'waitlistForm' || form.id === 'transformationPreviewForm') return;

            form.addEventListener('submit', function (e) {
                e.preventDefault();
                var btn = form.querySelector('button[type="submit"]');
                if (btn) {
                    var originalText = btn.textContent;
                    btn.textContent = 'Saved!';
                    btn.disabled = true;
                    setTimeout(function () {
                        btn.textContent = originalText;
                        btn.disabled = false;
                    }, 2000);
                }
            });
        });
    }

    // ==========================================
    // Smooth Link Handling
    // ==========================================
    function initLinks() {
        document.addEventListener('click', function (e) {
            var link = e.target.closest('a[data-link]');
            if (link) {
                var href = link.getAttribute('href');
                if (href && href.startsWith('#/')) {
                    // Already handled by hash change, no need for extra logic
                    closeMobileMenu();
                }
            }
        });
    }

    // ==========================================
    // Mindvalley-Inspired Dynamic Elements
    // ==========================================
    function initMindvalleyElements() {
        if (!window.FunnelCheckout.isDemoMode()) return;
        // 1. Live viewer count — fluctuates randomly
        var viewerEl = document.getElementById('liveViewerCount');
        if (viewerEl) {
            function updateViewerCount() {
                var base = 18 + Math.floor(Math.random() * 15); // 18-32
                viewerEl.textContent = base + ' women';
            }
            updateViewerCount();
            setInterval(updateViewerCount, 8000);
        }

        // 2. Recent enrollment counter — fluctuates weekly
        var enrollEl = document.getElementById('recentEnrollCount');
        if (enrollEl) {
            var enrollCount = 12 + Math.floor(Math.random() * 11); // 12-22
            enrollEl.textContent = enrollCount + ' women';
        }

        // 3. Pricing page countdown timer — resets daily
        var timerEl = document.getElementById('pricingTimer');
        if (timerEl) {
            function updateTimer() {
                var now = new Date();
                var endOfDay = new Date(now);
                endOfDay.setHours(23, 59, 59, 999);
                var diff = endOfDay - now;
                if (diff <= 0) diff = 86400000;
                var h = Math.floor(diff / 3600000);
                var m = Math.floor((diff % 3600000) / 60000);
                var s = Math.floor((diff % 60000) / 1000);
                timerEl.textContent =
                    String(h).padStart(2, '0') + ':' +
                    String(m).padStart(2, '0') + ':' +
                    String(s).padStart(2, '0');
            }
            updateTimer();
            setInterval(updateTimer, 1000);
        }

        // 4. Sticky CTA bar on sales page — shows after scrolling past hero
        var stickyCta = document.getElementById('joinStickyCta');
        if (stickyCta) {
            var joinPage = document.getElementById('page-join');
            window.addEventListener('scroll', function () {
                if (!joinPage || !joinPage.classList.contains('active')) {
                    stickyCta.classList.remove('visible');
                    return;
                }
                if (window.scrollY > 600) {
                    stickyCta.classList.add('visible');
                } else {
                    stickyCta.classList.remove('visible');
                }
            });
        }

        // 5. Quiz Results countdown timer (15 min, persisted in sessionStorage)
        var quizTimerEl = document.getElementById('quizResultsCountdown');
        if (quizTimerEl) {
            var storageKey = 'quizResultsTimerEnd';
            var savedEnd = sessionStorage.getItem(storageKey);
            var endTime;
            if (savedEnd && parseInt(savedEnd) > Date.now()) {
                endTime = parseInt(savedEnd);
            } else {
                endTime = Date.now() + 15 * 60 * 1000;
                sessionStorage.setItem(storageKey, endTime);
            }
            function updateQuizTimer() {
                var remaining = Math.max(0, endTime - Date.now());
                var m = Math.floor(remaining / 60000);
                var s = Math.floor((remaining % 60000) / 1000);
                quizTimerEl.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
                if (remaining <= 0) quizTimerEl.textContent = '00:00';
            }
            updateQuizTimer();
            setInterval(updateQuizTimer, 1000);
        }

        // 6. Checkout countdown timer (10 min, persisted in sessionStorage)
        var checkoutTimerEl = document.getElementById('checkoutCountdown');
        if (checkoutTimerEl) {
            var ckStorageKey = 'checkoutTimerEnd';
            var ckSavedEnd = sessionStorage.getItem(ckStorageKey);
            var ckEndTime;
            if (ckSavedEnd && parseInt(ckSavedEnd) > Date.now()) {
                ckEndTime = parseInt(ckSavedEnd);
            } else {
                ckEndTime = Date.now() + 10 * 60 * 1000;
                sessionStorage.setItem(ckStorageKey, ckEndTime);
            }
            function updateCheckoutTimer() {
                var remaining = Math.max(0, ckEndTime - Date.now());
                var m = Math.floor(remaining / 60000);
                var s = Math.floor((remaining % 60000) / 1000);
                checkoutTimerEl.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
                if (remaining <= 0) checkoutTimerEl.textContent = '00:00';
            }
            updateCheckoutTimer();
            setInterval(updateCheckoutTimer, 1000);
        }

        // 7. Quiz results enrollment counter
        var quizEnrollEl = document.getElementById('quizResultsEnrollCount');
        if (quizEnrollEl) {
            var qEnrollCount = 12 + Math.floor(Math.random() * 11); // 12-22
            quizEnrollEl.textContent = qEnrollCount + ' women';
        }

        // 8. Checkout enrollment counter
        var checkoutEnrollEl = document.getElementById('checkoutEnrollCount');
        if (checkoutEnrollEl) {
            var cEnrollCount = 8 + Math.floor(Math.random() * 10); // 8-17
            checkoutEnrollEl.textContent = cEnrollCount + ' women';
        }

        // Quiz results tier selection
        var tierPrices = window.FunnelCheckout ? window.FunnelCheckout.PRICING.plans : {};
        var quizTierOptions = document.querySelectorAll('.tier-option');
        var quizResultsCta = document.getElementById('quizResultsCta');
        quizTierOptions.forEach(function (opt) {
            opt.addEventListener('click', function () {
                var tier = opt.getAttribute('data-tier');
                quizTierOptions.forEach(function (o) {
                    o.style.borderColor = 'var(--color-border-light)';
                    o.style.background = '';
                    o.classList.remove('selected');
                });
                opt.style.borderColor = 'var(--color-primary)';
                opt.style.background = 'rgba(233,167,181,0.08)';
                opt.classList.add('selected');
                if (quizResultsCta) {
                    var plan = tierPrices[tier];
                    var label = plan && window.FunnelCheckout
                        ? window.FunnelCheckout.formatMoney(plan.usd, plan.bdt)
                        : '$74.99 / \u09f37,499';
                    quizResultsCta.textContent = 'Choose My Journey — ' + label;
                    quizResultsCta.href = '#/checkout?tier=' + tier;
                }
            });
        });

    }

    // ==========================================
    // Local stakeholder demo: AI transformation preview
    // ==========================================
    function initTransformationPreview() {
        var openButton = document.getElementById('transformationPreviewOpen');
        var modal = document.getElementById('transformationPreviewModal');
        var dialog = modal ? modal.querySelector('.f-transformation-modal') : null;
        var form = document.getElementById('transformationPreviewForm');
        var photoInput = document.getElementById('transformationPreviewPhoto');
        var emailInput = document.getElementById('transformationPreviewEmail');
        var consentInput = document.getElementById('transformationPreviewConsent');
        var fileName = document.getElementById('transformationPreviewFileName');
        var formError = document.getElementById('transformationPreviewFormError');
        var formState = document.getElementById('transformationPreviewFormState');
        var loadingState = document.getElementById('transformationPreviewLoadingState');
        var resultState = document.getElementById('transformationPreviewResultState');
        var errorState = document.getElementById('transformationPreviewErrorState');
        var errorMessage = document.getElementById('transformationPreviewErrorMessage');
        var beforeImage = document.getElementById('transformationPreviewBefore');
        var afterImage = document.getElementById('transformationPreviewAfter');
        var download = document.getElementById('transformationPreviewDownload');
        var retry = document.getElementById('transformationPreviewRetry');
        var errorRetry = document.getElementById('transformationPreviewErrorRetry');
        var closeButtons = modal ? modal.querySelectorAll('[data-transformation-close]') : [];
        var allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        var maxPhotoBytes = 10 * 1024 * 1024;
        var photoUrl = '';
        var requestController = null;
        var turnstileContainer = document.getElementById('transformationPreviewTurnstile');
        var siteKey = (window.CONFIG && window.CONFIG.TURNSTILE_SITE_KEY) || '';
        var functionsBase = (window.CONFIG && window.CONFIG.SUPABASE_FUNCTIONS_URL) || '';
        var anonKey = (window.CONFIG && window.CONFIG.SUPABASE_ANON_KEY) || '';
        var turnstileWidgetId = null;

        if (!openButton || !modal || !dialog || !form) return;

        function renderTurnstile() {
            if (!turnstileContainer || !siteKey || !window.turnstile || typeof window.turnstile.render !== 'function') return;
            if (turnstileWidgetId !== null) { try { window.turnstile.reset(turnstileWidgetId); } catch (e) {} return; }
            try {
                turnstileWidgetId = window.turnstile.render(turnstileContainer, { sitekey: siteKey });
            } catch (e) { /* already rendered */ }
        }
        function getTurnstileToken() {
            if (window.turnstile && turnstileWidgetId !== null) {
                try { return window.turnstile.getResponse(turnstileWidgetId) || ''; } catch (e) { return ''; }
            }
            return '';
        }
        function resetTurnstile() {
            if (window.turnstile && turnstileWidgetId !== null) {
                try { window.turnstile.reset(turnstileWidgetId); } catch (e) {}
            }
        }

        function setState(activeState) {
            [formState, loadingState, resultState, errorState].forEach(function (state) {
                if (state) state.hidden = state !== activeState;
            });
        }

        function revokePhotoUrl() {
            if (!photoUrl) return;
            URL.revokeObjectURL(photoUrl);
            photoUrl = '';
        }

        function clearPreviewImages() {
            revokePhotoUrl();
            if (beforeImage) beforeImage.removeAttribute('src');
            if (afterImage) afterImage.removeAttribute('src');
            if (download) download.removeAttribute('href');
        }

        function validatePhoto(file) {
            if (!file) return 'Choose a photo before creating your preview.';
            if (allowedTypes.indexOf(file.type) === -1) return 'Use a JPEG, PNG, or WebP photo.';
            if (file.size > maxPhotoBytes) return 'Choose a photo smaller than 10 MB.';
            return '';
        }

        function resetForAnotherPhoto() {
            if (requestController) requestController.abort();
            requestController = null;
            clearPreviewImages();
            photoInput.value = '';
            fileName.textContent = 'No photo selected.';
            formError.textContent = '';
            setState(formState);
            photoInput.focus();
        }

        function closeModal() {
            if (requestController) requestController.abort();
            requestController = null;
            clearPreviewImages();
            form.reset();
            fileName.textContent = 'No photo selected.';
            formError.textContent = '';
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('f-modal-open');
            setState(formState);
            openButton.focus();
        }

        function openModal() {
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('f-modal-open');
            setState(formState);
            renderTurnstile();
            dialog.focus();
        }

        function showRequestError(message) {
            errorMessage.textContent = message || 'Please try again with a different photo.';
            setState(errorState);
        }

        photoInput.addEventListener('change', function () {
            var file = photoInput.files && photoInput.files[0];
            var validationError = validatePhoto(file);
            fileName.textContent = file ? file.name : 'No photo selected.';
            formError.textContent = validationError;
        });

        form.addEventListener('submit', async function (event) {
            event.preventDefault();
            var file = photoInput.files && photoInput.files[0];
            var validationError = validatePhoto(file);
            if (!emailInput.value.trim() || !emailInput.checkValidity()) validationError = 'Enter a valid email address.';
            if (!consentInput.checked) validationError = 'Confirm that you are allowed to use this photo.';
            formError.textContent = validationError;
            if (validationError) return;

            var token = getTurnstileToken();
            if (siteKey && !token) {
                formError.textContent = 'Please complete the verification challenge below.';
                return;
            }

            clearPreviewImages();
            photoUrl = URL.createObjectURL(file);
            beforeImage.src = photoUrl;
            setState(loadingState);
            requestController = new AbortController();

            try {
                var payload = new FormData();
                payload.append('photo', file, file.name);
                payload.append('email', emailInput.value.trim());
                payload.append('consent', 'true');
                if (token) payload.append('cf-turnstile-response', token);

                var endpoint = functionsBase
                    ? functionsBase.replace(/\/+$/, '') + '/transformation-preview'
                    : '/api/transformation-preview';
                var headers = {};
                if (anonKey) { headers.Authorization = 'Bearer ' + anonKey; headers.apikey = anonKey; }

                var response = await fetch(endpoint, {
                    method: 'POST',
                    headers: headers,
                    body: payload,
                    signal: requestController.signal
                });
                var result = await response.json().catch(function () { return {}; });
                if (!response.ok || !result.image_base64) {
                    throw new Error(result.error || 'The preview could not be generated. Please try again.');
                }

                var previewUrl = 'data:' + (result.mime_type || 'image/webp') + ';base64,' + result.image_base64;
                afterImage.src = previewUrl;
                download.href = previewUrl;
                setState(resultState);
                trackEvent('transformation_preview_generated', { source: 'homepage_consequence_section' });
            } catch (error) {
                if (error.name === 'AbortError') return;
                showRequestError(error.message);
            } finally {
                requestController = null;
                resetTurnstile();
            }
        });

        openButton.addEventListener('click', openModal);
        closeButtons.forEach(function (button) { button.addEventListener('click', closeModal); });
        retry.addEventListener('click', resetForAnotherPhoto);
        errorRetry.addEventListener('click', resetForAnotherPhoto);
        modal.addEventListener('click', function (event) {
            if (event.target === modal) closeModal();
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && modal.classList.contains('open')) closeModal();
        });
    }

    // ==========================================
    // Initialize Everything
    // ==========================================
    function init() {
        window.FunnelCheckout.applyDemoMode();
        window.FunnelCheckout.syncAuthCtas();
        handleRoute();
        initNav();
        initFaqAccordions();
        initQuiz();
        initLeadMagnetForm();
        initBmiBmrCalculator();
        initCheckout();
        initUpsellCountdown();
        initCategoryTabs();
        initMealPlanRails();
        initExerciseMarqueeRows();
        initScrollAnimations();
        initCookieBanner();
        initForms();
        initLinks();
        initMindvalleyElements();
        initTransformationPreview();
        initWaitlistForm();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
