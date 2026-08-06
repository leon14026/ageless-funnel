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

    // ---- Progress (localStorage, per-device) ----
    _completed() { try { return JSON.parse(localStorage.getItem('abt_days_done') || '{}'); } catch (e) { return {}; } },
    dayKey(m, d) { return m + '-' + d; },
    isDayComplete(m, d) { return !!this._completed()[this.dayKey(m, d)]; },
    setDayComplete(m, d, val) {
        const c = this._completed();
        if (val) c[this.dayKey(m, d)] = Date.now(); else delete c[this.dayKey(m, d)];
        localStorage.setItem('abt_days_done', JSON.stringify(c));
    },
    completedCount() { return Object.keys(this._completed()).length; },
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
