/**
 * Workout Program Module — reads the local routine (public/data/routine.json)
 * and a name-keyed URL map (public/data/videos.json). No database needed for content.
 * Day completions are stored per-device in localStorage.
 */
const Programs = {
    _data: null,

    async load() {
        if (this._data) return this._data;
        const bust = '?v=' + Date.now();
        const [routine, videos] = await Promise.all([
            fetch('/data/routine.json' + bust).then(r => r.json()).catch(() => ({ months: [] })),
            fetch('/data/videos.json' + bust).then(r => r.json()).catch(() => ({}))
        ]);
        this._data = { months: routine.months || [], videos: videos || {} };
        return this._data;
    },

    // ---- Access scope + content drip -------------------------------------------------
    // A member keeps the months their tier bought, for life, but those months reveal one at a
    // time: month N opens N months after the anchor (the later of the program launch or their
    // access start). unlockedThrough = min(tier months, elapsed + 1), so month 1 is always open
    // and a 1-month member stays capped at month 1 forever.
    _access: null,

    async loadAccess() {
        if (this._access) return this._access;
        const total = (this._data && this._data.months.length) || 6;
        const demo = !(window.CONFIG && window.CONFIG.APP && window.CONFIG.APP.DEMO_MODE === false);
        const openAll = { months: total, unlockedThrough: total, anchor: null, full: true };

        // Demo/preview shows everything rather than looking half-broken.
        if (demo) { this._access = openAll; return this._access; }

        let ent = null;
        try {
            const session = window.Auth ? await Auth.getSession() : null;
            if (session && window.Payment && Payment.getEntitlement) {
                ent = await Payment.getEntitlement(session.user.id);
            }
        } catch (e) { /* fall through */ }

        // No readable entitlement: the page guard already handles access, so don't lock content.
        if (!ent) { this._access = openAll; return this._access; }

        const launch = (window.CONFIG && window.CONFIG.APP && window.CONFIG.APP.PROGRAM_START) || null;
        const launchDate = launch ? new Date(launch + 'T00:00:00') : null;
        const start = ent.starts_at || launchDate || new Date();
        const anchor = (launchDate && launchDate > start) ? launchDate : start;

        const scope = Math.min(total, Number(ent.months) || total);
        const unlocked = Math.min(scope, this._monthsSince(anchor, new Date()) + 1);

        this._access = { months: scope, unlockedThrough: Math.max(1, unlocked), anchor: anchor, full: false };
        return this._access;
    },

    /** Whole calendar months between two dates (not yet reached day-of-month doesn't count). */
    _monthsSince(from, to) {
        let n = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
        if (to.getDate() < from.getDate()) n--;
        return Math.max(0, n);
    },

    addMonths(date, n) {
        const d = new Date(date.getTime());
        const day = d.getDate();
        d.setMonth(d.getMonth() + n);
        if (d.getDate() < day) d.setDate(0); // clamp e.g. 31 Jan + 1 month -> 28/29 Feb
        return d;
    },

    /** true once the month has unlocked; false while it is still on the drip or out of scope. */
    isMonthUnlocked(m) { return !this._access || m <= this._access.unlockedThrough; },
    /** true when the month is beyond what their tier ever includes (an upgrade, not a wait). */
    isMonthOutOfPlan(m) { return !!this._access && !this._access.full && m > this._access.months; },
    unlockDateFor(m) {
        if (!this._access || !this._access.anchor) return null;
        return this.addMonths(this._access.anchor, m - 1);
    },
    formatUnlockDate(d) {
        return d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    },

    urlFor(name) { return (this._data && this._data.videos[name]) || ''; },
    getMonth(m) { return (this._data.months || []).find(x => x.month === m); },
    getDay(m, d) { const mo = this.getMonth(m); return mo && mo.days.find(x => x.day === d); },
    monthLabel(mo) {
        const parts = String(mo.title || '').split(' - ');
        return parts.length > 1 ? parts[parts.length - 1] : (mo.title || ('Month ' + mo.month));
    },

    // Distinct month names (the sheet title is generic); reused from the funnel curriculum.
    MONTH_NAMES: { 1: 'Gentle Reset', 2: 'Energy & Glow', 3: 'Tone & Mobility', 4: 'Slimmer & Lighter', 5: 'Radiance & Resilience', 6: 'Be Ageless' },
    monthName(n) { return this.MONTH_NAMES[n] || ('Month ' + n); },

    monthProgress(m) {
        const mo = this.getMonth(m);
        let total = 0, done = 0;
        if (mo) mo.days.forEach(d => { if (!d.rest) { total++; if (this.isDayComplete(m, d.day)) done++; } });
        return { done: done, total: total };
    },

    renderMonthCard(mo) {
        // Locked months stay visible (not hidden) so members can see what's coming and what an
        // upgrade would add — it advertises the program rather than concealing it.
        if (!this.isMonthUnlocked(mo.month)) {
            const outOfPlan = this.isMonthOutOfPlan(mo.month);
            const note = outOfPlan
                ? 'Not included in your plan'
                : 'Unlocks ' + this.formatUnlockDate(this.unlockDateFor(mo.month));
            return '<div class="program-month-card month-locked" aria-disabled="true">' +
                '<span class="pmc-badge">Month ' + mo.month + '</span>' +
                '<h3 class="pmc-title">' + this.esc(this.monthName(mo.month)) + '</h3>' +
                '<p class="pmc-sub">' + this.esc(note) + '</p>' +
                (outOfPlan ? '<a class="pmc-upgrade" href="/index.html#/pricing">Upgrade</a>' : '') +
                '</div>';
        }
        const p = this.monthProgress(mo.month);
        const complete = p.total > 0 && p.done >= p.total;
        const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
        return '<a class="program-month-card' + (complete ? ' month-complete' : '') + '" href="month.html?month=' + mo.month + '">' +
            (complete ? '<span class="day-check">✓</span>' : '') +
            '<span class="pmc-badge">Month ' + mo.month + '</span>' +
            '<h3 class="pmc-title">' + this.esc(this.monthName(mo.month)) + '</h3>' +
            '<p class="pmc-sub">7-day routine · one rest day</p>' +
            '<div class="pmc-progress"><div class="pmc-bar" style="width:' + pct + '%"></div></div>' +
            '<span class="pmc-meta">' + p.done + ' of ' + p.total + ' days</span></a>';
    },

    // ---- Progress (Supabase-backed, cross-device; localStorage mirror for resilience) ----
    _completedSet: null,
    dayKey(m, d) { return m + '-' + d; },
    _lsKeys() { try { return Object.keys(JSON.parse(localStorage.getItem('abt_days_done') || '{}')); } catch (e) { return []; } },
    _lsMirror() { try { const o = {}; this._completedSet.forEach(k => { o[k] = 1; }); localStorage.setItem('abt_days_done', JSON.stringify(o)); } catch (e) {} },

    async loadCompletions() {
        if (this._completedSet) return this._completedSet;
        const set = new Set();
        let session = null;
        try { session = window.Auth ? await Auth.getSession() : null; } catch (e) {}
        if (window.supabaseClient && session) {
            try {
                const res = await window.supabaseClient
                    .from('program_day_completions')
                    .select('month_number, day_number')
                    .eq('user_id', session.user.id);
                (res.data || []).forEach(r => set.add(r.month_number + '-' + r.day_number));
                // One-time migration: push any localStorage-only completions to the cloud.
                const extra = this._lsKeys().filter(k => !set.has(k));
                if (extra.length) {
                    const rows = extra.map(k => { const p = k.split('-'); return { user_id: session.user.id, month_number: parseInt(p[0], 10), day_number: parseInt(p[1], 10) }; });
                    await window.supabaseClient.from('program_day_completions').upsert(rows, { onConflict: 'user_id,month_number,day_number' });
                    extra.forEach(k => set.add(k));
                }
                this._completedSet = set;
                this._lsMirror();
                return set;
            } catch (e) { /* fall back to localStorage below */ }
        }
        this._lsKeys().forEach(k => set.add(k));
        this._completedSet = set;
        return set;
    },

    isDayComplete(m, d) { return !!(this._completedSet && this._completedSet.has(this.dayKey(m, d))); },

    async setDayComplete(m, d, val) {
        if (!this._completedSet) await this.loadCompletions();
        const key = this.dayKey(m, d);
        if (val) this._completedSet.add(key); else this._completedSet.delete(key);
        this._lsMirror();
        try {
            const session = window.Auth ? await Auth.getSession() : null;
            if (window.supabaseClient && session) {
                if (val) {
                    await window.supabaseClient.from('program_day_completions')
                        .upsert({ user_id: session.user.id, month_number: m, day_number: d }, { onConflict: 'user_id,month_number,day_number' });
                } else {
                    await window.supabaseClient.from('program_day_completions')
                        .delete().eq('user_id', session.user.id).eq('month_number', m).eq('day_number', d);
                }
            }
        } catch (e) { /* stays in cache + localStorage mirror */ }
    },

    completedCount() { return this._completedSet ? this._completedSet.size : 0; },
    totalWorkoutDays() {
        let n = 0;
        (this._data.months || []).forEach(mo => mo.days.forEach(d => { if (!d.rest) n++; }));
        return n || 36;
    },

    getYouTubeEmbedUrl(url) {
        if (!url) return '';
        if (url.includes('youtube.com/embed/')) return url;
        let id = null;
        let m = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/); if (m) id = m[1];
        m = url.match(/[?&]v=([a-zA-Z0-9_-]+)/); if (m) id = m[1];
        m = url.match(/youtube\.com\/v\/([a-zA-Z0-9_-]+)/); if (m) id = m[1];
        m = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/); if (m) id = m[1];
        return id ? ('https://www.youtube.com/embed/' + id) : url;
    },

    esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    },

    catLabel(cat) { return { warmup: 'Warm-up', cooldown: 'Cool-down', workout: 'Workout' }[cat] || 'Workout'; },

    /** Render one video block: embed if a URL exists, else a "Coming soon" box. */
    renderBlock(block) {
        const url = this.urlFor(block.name);
        const dur = block.duration ? '<span class="block-dur">' + this.esc(block.duration) + '</span>' : '';
        // Client-facing: show only the category (+ duration), never the internal exercise name.
        const head = '<div class="block-head"><span class="block-cat block-cat-' + block.category + '">' +
            this.catLabel(block.category) + '</span>' + dur + '</div>';
        if (url) {
            const embed = this.getYouTubeEmbedUrl(url);
            return '<div class="block-card">' + head +
                '<div class="video-container"><iframe src="' + this.esc(embed) + '" title="' + this.catLabel(block.category) +
                '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div></div>';
        }
        return '<div class="block-card block-soon">' + head +
            '<div class="coming-soon"><span class="coming-soon-pill">Coming soon</span>' +
            '<p>This video is being added — check back soon.</p></div></div>';
    },

    /** Render a day card for the month grid. */
    renderDayCard(monthNum, day) {
        const done = this.isDayComplete(monthNum, day.day);
        if (day.rest) {
            return '<div class="day-card day-rest">' +
                '<span class="day-num">Day ' + day.day + '</span>' +
                '<span class="rest-badge">Rest day</span>' +
                '<p class="day-theme">Recovery &amp; gentle movement</p></div>';
        }
        const count = day.blocks.length;
        return '<a class="day-card' + (done ? ' day-done' : '') + '" href="day.html?month=' + monthNum + '&day=' + day.day + '">' +
            (done ? '<span class="day-check">✓</span>' : '') +
            '<span class="day-num">Day ' + day.day + '</span>' +
            '<h3 class="day-theme">' + this.esc(day.theme || ('Day ' + day.day)) + '</h3>' +
            '<span class="day-meta">' + count + ' video' + (count === 1 ? '' : 's') + '</span></a>';
    }
};

window.Programs = Programs;
