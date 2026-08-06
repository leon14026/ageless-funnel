/**
 * Member Home — greeting, guided first-run setup tour, and smart getting-started checklist.
 * Reuses Nutrition (goal calc + save) and the existing Supabase client / Auth guard.
 */
(function () {
    'use strict';

    var currentUser = null;
    var selectedGoal = null;
    var step = 1;

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        if (!window.supabaseClient || !window.Auth) return;
        var session = await Auth.getSession();
        if (!session) return; // auth-guard handles the redirect to login
        currentUser = session.user;

        var nameEl = document.getElementById('member-name');
        if (nameEl) nameEl.textContent = Auth.getDisplayName(currentUser);

        setupTour();

        var goals = await Nutrition.getGoals();
        await renderChecklist(goals);

        // First-run: no goals yet and not skipped this session -> open the tour.
        if (!goals && !sessionStorage.getItem('abt_tour_skipped')) {
            openTour();
        }
    }

    // ---------------- Smart getting-started checklist ----------------
    async function countRows(table) {
        try {
            var res = await window.supabaseClient.from(table).select('id', { count: 'exact', head: true });
            return res.error ? 0 : (res.count || 0);
        } catch (e) {
            return 0;
        }
    }

    async function renderChecklist(goals) {
        var card = document.getElementById('getting-started');
        var list = document.getElementById('gs-list');
        var countEl = document.getElementById('gs-count');
        if (!card || !list) return;

        var counts = await Promise.all([
            countRows('food_entries'),
            countRows('progress_entries')
        ]);
        var workoutDone = false;
        try { workoutDone = Object.keys(JSON.parse(localStorage.getItem('abt_days_done') || '{}')).length > 0; } catch (e) {}
        var profileDone = !!(currentUser.user_metadata && currentUser.user_metadata.full_name);

        var items = [
            { done: !!goals, label: 'Set your nutrition goals', action: 'tour', cta: 'Set goals' },
            { done: workoutDone, label: 'Do your first workout', href: '../programs/index.html', cta: 'Open Programs' },
            { done: counts[0] > 0, label: 'Log your first meal', href: '../tracker/index.html#nutrition-section', cta: 'Log food' },
            { done: counts[1] > 0, label: 'Add your starting measurements', href: '../tracker/index.html', cta: 'Add entry' },
            { done: profileDone, label: 'Complete your profile', href: '../account/profile.html', cta: 'Edit profile' }
        ];

        var doneCount = items.filter(function (i) { return i.done; }).length;
        if (doneCount === items.length) {
            card.style.display = 'none';
            return;
        }
        card.style.display = '';
        if (countEl) countEl.textContent = doneCount + ' of ' + items.length + ' done';

        list.innerHTML = items.map(function (i) {
            var check = i.done
                ? '<span class="gs-check gs-check-done" aria-hidden="true">&#10003;</span>'
                : '<span class="gs-check" aria-hidden="true"></span>';
            var cta = '';
            if (!i.done) {
                cta = i.action === 'tour'
                    ? '<button class="gs-cta" type="button" data-open-tour>' + i.cta + '</button>'
                    : '<a class="gs-cta" href="' + i.href + '">' + i.cta + '</a>';
            }
            return '<li class="gs-item' + (i.done ? ' gs-item-done' : '') + '">' +
                check + '<span class="gs-label">' + i.label + '</span>' + cta + '</li>';
        }).join('');

        list.querySelectorAll('[data-open-tour]').forEach(function (b) {
            b.addEventListener('click', openTour);
        });
    }

    // ---------------- Guided tour ----------------
    function setupTour() {
        var tour = document.getElementById('tour');
        if (!tour) return;

        // Goal choices from Nutrition.GOAL_TYPES
        var goalWrap = document.getElementById('goal-choices');
        if (goalWrap && window.Nutrition) {
            goalWrap.innerHTML = Object.keys(Nutrition.GOAL_TYPES).map(function (k) {
                var g = Nutrition.GOAL_TYPES[k];
                return '<button type="button" class="tour-choice" data-goal="' + k + '">' +
                    '<strong>' + g.label + '</strong><span>' + g.description + '</span></button>';
            }).join('');
            goalWrap.querySelectorAll('.tour-choice').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    goalWrap.querySelectorAll('.tour-choice').forEach(function (b) { b.classList.remove('selected'); });
                    btn.classList.add('selected');
                    selectedGoal = btn.getAttribute('data-goal');
                    var next = document.getElementById('goal-next');
                    if (next) next.disabled = false;
                });
            });
        }

        // Activity levels from Nutrition.ACTIVITY_LEVELS
        var act = document.getElementById('f-activity');
        if (act && window.Nutrition) {
            act.innerHTML = Object.keys(Nutrition.ACTIVITY_LEVELS).map(function (k) {
                return '<option value="' + k + '">' + Nutrition.ACTIVITY_LEVELS[k].label + '</option>';
            }).join('');
            act.value = 'light';
        }

        tour.querySelectorAll('[data-next]').forEach(function (b) { b.addEventListener('click', function () { goStep(1); }); });
        tour.querySelectorAll('[data-back]').forEach(function (b) { b.addEventListener('click', function () { goStep(-1); }); });

        wire('tour-close', closeTour);
        wire('tour-done', closeTour);
        wire('tour-skip', function () { sessionStorage.setItem('abt_tour_skipped', '1'); closeTour(); });
        wire('details-save', saveDetails);
    }

    function wire(id, fn) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('click', fn);
    }

    function showStep(n) {
        step = Math.min(4, Math.max(1, n));
        var tour = document.getElementById('tour');
        tour.querySelectorAll('.tour-step').forEach(function (s) {
            s.hidden = (parseInt(s.getAttribute('data-step'), 10) !== step);
        });
        var ind = document.getElementById('tour-step-indicator');
        if (ind) ind.textContent = 'Step ' + step + ' of 4';
    }
    function goStep(delta) {
        if (delta > 0 && step === 2 && !selectedGoal) return; // must pick a goal
        showStep(step + delta);
    }

    function openTour() {
        var tour = document.getElementById('tour');
        if (!tour) return;
        tour.hidden = false;
        document.body.classList.add('tour-open');
        showStep(1);
    }
    function closeTour() {
        var tour = document.getElementById('tour');
        if (!tour) return;
        tour.hidden = true;
        document.body.classList.remove('tour-open');
    }

    async function saveDetails() {
        var err = document.getElementById('details-error');
        if (err) err.textContent = '';

        if (!selectedGoal) { showStep(2); return; }

        var age = parseInt(document.getElementById('f-age').value, 10);
        var gender = document.getElementById('f-gender').value;
        var weight = parseFloat(document.getElementById('f-weight').value);
        var height = parseFloat(document.getElementById('f-height').value);
        var activityKey = document.getElementById('f-activity').value;
        var activityLevel = (Nutrition.ACTIVITY_LEVELS[activityKey] || { value: 1.375 }).value;

        if (!age || !weight || !height) {
            if (err) err.textContent = 'Please fill in your age, weight, and height.';
            return;
        }

        var targets = Nutrition.calculateTargets({
            weight: weight, height: height, age: age, gender: gender,
            activityLevel: activityLevel, goalType: selectedGoal
        });

        var btn = document.getElementById('details-save');
        if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

        var result = await Nutrition.setGoals({
            goalType: selectedGoal,
            dailyCalories: targets.dailyCalories, dailyProtein: targets.dailyProtein,
            dailyCarbs: targets.dailyCarbs, dailyFat: targets.dailyFat,
            weight: weight, height: height, age: age, gender: gender, activityLevel: activityLevel
        });

        if (btn) { btn.disabled = false; btn.textContent = 'Calculate my targets'; }
        if (result.error) {
            if (err) err.textContent = 'Could not save. Please try again.';
            return;
        }

        var summary = document.getElementById('targets-summary');
        if (summary) {
            summary.textContent = 'Daily target: ' + targets.dailyCalories + ' kcal · ' +
                targets.dailyProtein + 'g protein · ' + targets.dailyCarbs + 'g carbs · ' + targets.dailyFat + 'g fat.';
        }
        showStep(4);

        // Refresh the checklist so "Set nutrition goals" ticks off.
        var goals = await Nutrition.getGoals();
        renderChecklist(goals);
    }
})();
